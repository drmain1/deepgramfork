"""
Simple Firebase authentication for development.
This uses the Firebase REST API to verify tokens without needing service account credentials.
"""

import os
import json
import httpx
from typing import Optional, Dict
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
import logging

logger = logging.getLogger(__name__)

# Security scheme for HTTP Bearer tokens
security = HTTPBearer()

# Firebase project configuration
FIREBASE_PROJECT_ID = os.getenv('FIREBASE_PROJECT_ID', 'medlegaldoc-b31df')
FIREBASE_API_KEY = os.getenv('FIREBASE_API_KEY', '')  # Must be set in environment variables

# Google's public keys for verifying Firebase tokens
GOOGLE_CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"

# Validate configuration
if not FIREBASE_API_KEY:
    logger.warning("FIREBASE_API_KEY environment variable not set. Some features may not work properly.")

class FirebaseTokenVerifier:
    def __init__(self):
        self._certs = None
        self._certs_expiry = 0
        
    async def get_certificates(self) -> Dict[str, str]:
        """Fetch Google's public certificates for token verification."""
        import time
        
        # Check if we have cached certificates
        if self._certs and time.time() < self._certs_expiry:
            return self._certs
            
        async with httpx.AsyncClient() as client:
            response = await client.get(GOOGLE_CERTS_URL)
            response.raise_for_status()
            
            # Cache certificates and expiry time
            self._certs = response.json()
            
            # Get cache control header to determine expiry
            cache_control = response.headers.get('cache-control', '')
            max_age = 3600  # Default 1 hour
            for directive in cache_control.split(','):
                if 'max-age=' in directive:
                    max_age = int(directive.split('=')[1])
                    
            self._certs_expiry = time.time() + max_age
            
        return self._certs
    
    async def verify_token(self, token: str) -> Dict:
        """Verify a Firebase ID token."""
        try:
            # Decode header to get key ID
            header = jwt.get_unverified_header(token)
            kid = header.get('kid')
            
            if not kid:
                raise HTTPException(status_code=401, detail="Invalid token: no key ID")
            
            # Get Google's public certificates
            certs = await self.get_certificates()
            
            if kid not in certs:
                raise HTTPException(status_code=401, detail="Invalid token: unknown key ID")
            
            # Verify the token
            payload = jwt.decode(
                token,
                certs[kid],
                algorithms=['RS256'],
                audience=FIREBASE_PROJECT_ID,
                issuer=f'https://securetoken.google.com/{FIREBASE_PROJECT_ID}',
                options={"verify_exp": True}
            )
            
            return payload
            
        except JWTError as e:
            logger.error(f"Token validation failed: {str(e)}")
            raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
        except Exception as e:
            logger.error(f"Token verification error: {str(e)}")
            raise HTTPException(status_code=401, detail=f"Token verification failed: {str(e)}")

# Global verifier instance
verifier = FirebaseTokenVerifier()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> dict:
    """
    Verify Firebase token and return user info.
    Compatible with existing AWS Cognito interface.
    """
    token = credentials.credentials
    
    # Verify the token
    payload = await verifier.verify_token(token)
    
    # Extract user information
    user = {
        'sub': payload.get('user_id', payload.get('sub')),
        'email': payload.get('email'),
        'username': payload.get('email', payload.get('user_id')),
        'token_use': 'id',
        'email_verified': payload.get('email_verified', False)
    }
    
    logger.info(f"User authenticated: {user['sub']}")
    return user

async def validate_firebase_token_simple(token: str) -> str:
    """
    Validate a Firebase token and return the user ID.
    Used for WebSocket connections where we have the token directly.
    """
    payload = await verifier.verify_token(token)
    return payload.get('user_id', payload.get('sub'))

async def get_user_id(current_user: dict = Security(get_current_user)) -> str:
    """Get just the user ID from the current user (AWS compatibility)"""
    return current_user['sub']

# For backwards compatibility
def get_current_user_sync(credentials: HTTPAuthorizationCredentials = Security(security)) -> dict:
    """Synchronous version for compatibility."""
    import asyncio
    return asyncio.run(get_current_user(credentials))