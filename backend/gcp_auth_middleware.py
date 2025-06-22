import os
import logging
from typing import Optional
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
        
        # Check if email is verified (optional but recommended)
        email_verified = decoded_token.get('email_verified', False)
        if not email_verified:
            logger.warning(f"User {user_id} email not verified")
            # You might want to enforce this for production
            # raise HTTPException(status_code=403, detail="Email not verified")
        
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

def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> dict:
    """
    Unified authentication function that works with both IAP and Firebase tokens.
    Returns a user dict to maintain compatibility with AWS middleware.
    """
    user_id = validate_firebase_token(credentials.credentials)
    
    # Return user dict for compatibility with existing code
    return {
        'sub': user_id,
        'username': user_id,
        'email': None,  # Could be populated from Firebase token if needed
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

# Middleware for session timeout (HIPAA requirement)
from datetime import datetime, timedelta
import json

class SessionTimeoutMiddleware:
    """
    Middleware to enforce session timeouts for HIPAA compliance.
    """
    def __init__(self, timeout_minutes: int = 15):
        self.timeout_minutes = timeout_minutes
        self.sessions = {}  # In production, use Redis or Firestore
    
    async def check_session(self, user_id: str) -> bool:
        """Check if user session is still valid."""
        if user_id not in self.sessions:
            self.sessions[user_id] = datetime.utcnow()
            return True
        
        last_activity = self.sessions[user_id]
        if datetime.utcnow() - last_activity > timedelta(minutes=self.timeout_minutes):
            # Session expired
            del self.sessions[user_id]
            return False
        
        # Update last activity
        self.sessions[user_id] = datetime.utcnow()
        return True
    
    async def clear_session(self, user_id: str):
        """Clear user session on logout."""
        if user_id in self.sessions:
            del self.sessions[user_id]

# Create singleton instance
session_manager = SessionTimeoutMiddleware(
    timeout_minutes=int(os.getenv("SESSION_TIMEOUT_MINUTES", "25"))
)