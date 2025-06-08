import os
from typing import Optional
from fastapi import HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt, JWTError
import httpx
import json
from functools import lru_cache

security = HTTPBearer()

class CognitoTokenVerifier:
    def __init__(self):
        # Load environment variables
        from dotenv import load_dotenv
        load_dotenv()
        
        self.region = os.getenv('AWS_REGION', 'us-east-1')
        self.user_pool_id = os.getenv('COGNITO_USER_POOL_ID', 'us-east-1_c2pePFAr6')
        self.client_id = os.getenv('COGNITO_CLIENT_ID', '34qvlmvb253ne4gvb25hh59pf4')
        print(f"CognitoTokenVerifier initialized - Region: {self.region}, Pool: {self.user_pool_id}, Client: {self.client_id}")
        print(f"Loaded from env - COGNITO_CLIENT_ID: {os.getenv('COGNITO_CLIENT_ID')}")
        self.jwks_url = f'https://cognito-idp.{self.region}.amazonaws.com/{self.user_pool_id}/.well-known/jwks.json'
        self._keys = None

    @property
    @lru_cache(maxsize=1)
    def keys(self):
        """Fetch and cache JWKS keys from Cognito"""
        if self._keys is None:
            print(f"Fetching JWKS from: {self.jwks_url}")
            response = httpx.get(self.jwks_url)
            self._keys = response.json()['keys']
            print(f"Fetched {len(self._keys)} keys from Cognito")
        return self._keys

    def get_public_key(self, token):
        """Extract public key from JWKS based on kid in token header"""
        try:
            headers = jwt.get_unverified_header(token)
            print(f"Token headers: {headers}")
            kid = headers['kid']
            print(f"Looking for kid: {kid}")
            
            for key in self.keys:
                print(f"Checking key with kid: {key['kid']}")
                if key['kid'] == kid:
                    print(f"Found matching key!")
                    # Return the key as-is for python-jose
                    return key
            
            raise HTTPException(status_code=401, detail="Public key not found")
        except Exception as e:
            print(f"Error in get_public_key: {str(e)}")
            raise HTTPException(status_code=401, detail=f"Invalid token headers: {str(e)}")

    def verify_token(self, token: str) -> dict:
        """Verify and decode Cognito JWT token"""
        try:
            print(f"Verifying token starting with: {token[:50]}...")
            # Get the public key
            public_key = self.get_public_key(token)
            
            # Decode and verify the token
            print(f"About to decode token with public key")
            try:
                # For python-jose, we need to pass the key dict directly
                payload = jwt.decode(
                    token,
                    public_key,
                    algorithms=['RS256'],
                    options={"verify_exp": True},
                    audience=self.client_id  # Add audience verification
                )
                print(f"Token decoded successfully. Payload: {payload}")
            except Exception as decode_error:
                print(f"JWT decode error: {decode_error}")
                print(f"Error type: {type(decode_error)}")
                raise
            
            # Verify token use (should be 'id' or 'access')
            token_use = payload.get('token_use')
            if token_use not in ['id', 'access']:
                raise HTTPException(status_code=401, detail="Invalid token use")
            
            # Verify audience (client_id) for id tokens
            if token_use == 'id':
                token_aud = payload.get('aud')
                print(f"Token audience: {token_aud}, Expected: {self.client_id}")
                if token_aud != self.client_id:
                    raise HTTPException(status_code=401, detail=f"Invalid audience. Got: {token_aud}, Expected: {self.client_id}")
            
            # Verify client_id for access tokens
            if token_use == 'access' and payload.get('client_id') != self.client_id:
                raise HTTPException(status_code=401, detail="Invalid client_id")
            
            # Verify issuer
            expected_issuer = f'https://cognito-idp.{self.region}.amazonaws.com/{self.user_pool_id}'
            if payload.get('iss') != expected_issuer:
                raise HTTPException(status_code=401, detail="Invalid issuer")
            
            return payload
            
        except JWTError as e:
            raise HTTPException(status_code=401, detail=f"Token validation failed: {str(e)}")
        except Exception as e:
            raise HTTPException(status_code=401, detail=f"Token verification error: {str(e)}")

# Initialize the verifier
token_verifier = CognitoTokenVerifier()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> dict:
    """Dependency to get current authenticated user from JWT token"""
    token = credentials.credentials
    print(f"Received token: {token[:20]}..." if len(token) > 20 else f"Received token: {token}")
    payload = token_verifier.verify_token(token)
    
    # Extract user information
    user = {
        'sub': payload.get('sub'),
        'email': payload.get('email'),
        'username': payload.get('cognito:username', payload.get('username')),
        'token_use': payload.get('token_use')
    }
    
    return user

# Optional: Create a dependency that returns just the user_id
async def get_user_id(current_user: dict = Security(get_current_user)) -> str:
    """Get just the user ID from the current user"""
    return current_user['sub']