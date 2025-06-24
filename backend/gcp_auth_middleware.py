import os
import json
import logging
from typing import Optional
from datetime import datetime
from fastapi import Request, HTTPException, Security, Query, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from google.oauth2 import id_token
from google.auth.transport import requests
import firebase_admin
from firebase_admin import auth as firebase_auth, credentials

logger = logging.getLogger(__name__)

# Initialize Firebase Admin SDK once
if not firebase_admin._apps:
    try:
        # Get Firebase project ID from environment
        firebase_project_id = os.getenv('FIREBASE_PROJECT_ID', 'medlegaldoc-b31df')
        
        # Try to use service account credentials
        cred_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS', 'gcp-credentials.json')
        if os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred, {
                'projectId': firebase_project_id
            })
        else:
            # Use default credentials (for Cloud Run)
            firebase_admin.initialize_app(options={
                'projectId': firebase_project_id
            })
        logger.info(f"Firebase Admin SDK initialized successfully for project: {firebase_project_id}")
    except Exception as e:
        logger.error(f"Failed to initialize Firebase Admin SDK: {str(e)}")
        raise

# Security scheme for HTTP Bearer tokens
security = HTTPBearer()

def get_user_id_from_iap(req: Request) -> str:
    """
    Validates the IAP-provided JWT header and returns the user's unique Google ID.
    Used for REST APIs protected by Identity-Aware Proxy.
    """
    iap_jwt = req.headers.get("x-goog-iap-jwt-assertion")
    if not iap_jwt:
        # During local development, check for Firebase token instead
        if os.getenv("ENVIRONMENT") == "development":
            return get_current_user_firebase(req)
        raise HTTPException(status_code=401, detail="Not authenticated via IAP")
    
    try:
        # Verify the IAP JWT
        expected_audience = os.getenv("IAP_EXPECTED_AUDIENCE")
        if not expected_audience:
            raise HTTPException(status_code=500, detail="IAP audience not configured")
        
        # Verify the token
        decoded_token = id_token.verify_oauth2_token(
            iap_jwt, 
            requests.Request(), 
            expected_audience
        )
        
        # Extract user ID from 'sub' claim
        user_id = decoded_token.get('sub')
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid IAP token: no user ID")
        
        # Log successful authentication
        logger.info(f"User authenticated via IAP: {user_id}")
        return user_id
        
    except Exception as e:
        logger.error(f"IAP token validation failed: {str(e)}")
        raise HTTPException(status_code=401, detail=f"Invalid IAP token: {str(e)}")

def get_current_user_firebase(req: Request) -> str:
    """
    Validates Firebase ID token from Authorization header.
    Used for local development and WebSocket connections.
    """
    # Get token from Authorization header
    auth_header = req.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = auth_header.split(" ")[1]
    return validate_firebase_token(token)

async def validate_firebase_jwt(token: str = Query(...)) -> str:
    """
    Validates a Firebase ID token sent as a query parameter.
    Used for WebSocket connections where headers are not easily accessible.
    """
    if not token:
        raise HTTPException(status_code=401, detail="Missing Firebase token")
    
    return validate_firebase_token(token)

def validate_firebase_token(token: str) -> str:
    """
    Common function to validate Firebase tokens.
    Returns the user's Firebase UID.
    """
    try:
        # Verify the token
        decoded_token = firebase_auth.verify_id_token(token)
        
        # Extract user ID
        user_id = decoded_token.get('uid')
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: no user ID")
        
        # Check if email is verified (required for HIPAA compliance)
        email_verified = decoded_token.get('email_verified', False)
        if not email_verified:
            logger.warning(f"User {user_id} attempted access without verified email")
            raise HTTPException(status_code=403, detail="Email verification required. Please verify your email address before accessing this application.")
        
        # Log successful authentication
        logger.info(f"User authenticated via Firebase: {user_id}")
        return user_id
        
    except firebase_auth.InvalidIdTokenError:
        raise HTTPException(status_code=401, detail="Invalid Firebase token")
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(status_code=401, detail="Firebase token expired")
    except Exception as e:
        logger.error(f"Firebase token validation failed: {str(e)}")
        raise HTTPException(status_code=401, detail=f"Token validation failed: {str(e)}")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> dict:
    """
    Unified authentication function that works with both IAP and Firebase tokens.
    Returns a user dict to maintain compatibility with AWS middleware.
    """
    user_info = validate_firebase_token(credentials.credentials)
    
    # Extract user_id first
    user_id = user_info.get('user_id', user_info.get('uid')) if isinstance(user_info, dict) else user_info
    
    # Check session validity with Firestore
    session_valid = await session_manager.check_session(user_id)
    
    if not session_valid:
        # Try to create a new session if the user has a valid token
        # This handles cases where the session expired but the Firebase token is still valid
        try:
            await session_manager.create_session(user_id)
            logger.info(f"Created new session for user with valid token: {user_id}")
        except Exception as e:
            logger.warning(f"Session expired and couldn't create new one for user: {user_id}, error: {str(e)}")
            raise HTTPException(
                status_code=401,
                detail="Session expired. Please log in again."
            )
    
    logger.info(f"User authenticated with valid session: {user_id}")
    
    # Return user dict for compatibility with existing code
    return {
        'sub': user_id,
        'username': user_id,
        'email': user_info.get('email') if isinstance(user_info, dict) else None,
        'email_verified': user_info.get('email_verified', False) if isinstance(user_info, dict) else False,
        'token_use': 'id'
    }

async def get_current_user_async(credentials: HTTPAuthorizationCredentials = Security(security)) -> dict:
    """
    Async version of get_current_user that can properly handle session checks.
    """
    user_info = validate_firebase_token(credentials.credentials)
    
    # Extract user_id first
    user_id = user_info.get('user_id', user_info.get('uid')) if isinstance(user_info, dict) else user_info
    
    # Check session validity
    session_valid = await session_manager.check_session(user_id)
    
    if not session_valid:
        logger.warning(f"Session expired for user: {user_id}")
        raise HTTPException(
            status_code=401,
            detail="Session expired. Please log in again."
        )
    
    # Return user dict for compatibility with existing code
    return {
        'sub': user_id,
        'username': user_id,
        'email': user_info.get('email') if isinstance(user_info, dict) else None,
        'email_verified': user_info.get('email_verified', False) if isinstance(user_info, dict) else False,
        'token_use': 'id'
    }

async def get_user_id(current_user: dict = Security(get_current_user)) -> str:
    """Get just the user ID from the current user (AWS compatibility)"""
    return current_user['sub']

# Dependency injection functions for different scenarios
async def require_auth_iap(user_id: str = Depends(get_user_id_from_iap)) -> str:
    """Require IAP authentication (production REST APIs)."""
    return user_id

async def require_auth_firebase(user_id: str = Depends(get_current_user)) -> str:
    """Require Firebase authentication (development/WebSockets)."""
    return user_id

async def require_auth_flexible(req: Request) -> str:
    """
    Flexible authentication that tries IAP first, then Firebase.
    Use this for endpoints that need to work in both environments.
    """
    # Try IAP first
    iap_jwt = req.headers.get("x-goog-iap-jwt-assertion")
    if iap_jwt:
        return get_user_id_from_iap(req)
    
    # Fall back to Firebase
    return get_current_user_firebase(req)

# Audit logging for HIPAA compliance
def log_user_access(user_id: str, action: str, resource: str, request: Request):
    """
    Log user access for HIPAA compliance.
    In production, this should write to Cloud Logging.
    """
    try:
        # Get client IP
        client_ip = request.client.host if request.client else "unknown"
        
        # For Cloud Run/IAP, get the real IP from headers
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()
        
        log_entry = {
            "user_id": user_id,
            "action": action,
            "resource": resource,
            "ip_address": client_ip,
            "user_agent": request.headers.get("User-Agent", "unknown"),
            "timestamp": datetime.utcnow().isoformat(),
            "path": str(request.url.path),
            "method": request.method
        }
        
        # In production, send to Cloud Logging
        logger.info(f"AUDIT_LOG: {json.dumps(log_entry)}")
        
    except Exception as e:
        logger.error(f"Failed to log user access: {str(e)}")

# Import Firestore-based session manager for production use
from firestore_session_manager import firestore_session_manager as session_manager