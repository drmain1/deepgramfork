#!/usr/bin/env python3
"""Test Firebase token verification."""

import os
from firebase_admin import auth
from gcp_auth_middleware import validate_firebase_token

# Test token from the browser log
test_token = """eyJhbGciOiJSUzI1NiIsImtpZCI6IjNiZjA1MzkxMzk2OTEzYTc4ZWM4MGY0MjcwMzM4NjM2NDA2MTBhZGMiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiZHJtYWluMSIsImlzcyI6Imh0dHBzOi8vc2VjdXJldG9rZW4uZ29vZ2xlLmNvbS9tZWRsZWdhbGRvYy1iMzFkZiIsImF1ZCI6Im1lZGxlZ2FsZG9jLWIzMWRmIiwiYXV0aF90aW1lIjoxNzUwNjA3NzAyLCJ1c2VyX2lkIjoiN0o2N0pUWkNBaFpYM1ptZHI4RzVDUG1pVWV3MiIsInN1YiI6IjdKNjdKVFpDQWhaWDNabWRyOEc1Q1BtaVVldzIiLCJpYXQiOjE3NTA2MTE2MTYsImV4cCI6MTc1MDYxNTIxNiwiZW1haWwiOiJkdG1haW5AZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOmZhbHNlLCJmaXJlYmFzZSI6eyJpZGVudGl0aWVzIjp7ImVtYWlsIjpbImR0bWFpbkBnbWFpbC5jb20iXX0sInNpZ25faW5fcHJvdmlkZXIiOiJwYXNzd29yZCJ9fQ.MSLFny-Tr2WKkclHqqBJ8qIyWKPFAcTCJgzOUTGXivUd7SGY9sLK2RyS9EdVrXEBvEWDR3k_g4a8QafB6LGAeCXNVdgg8vnKduRNadDmgra4ygtfV5WHzKRGn3q_NWMwede5rFwFwcq-dGFOYCt_kgec2CcmSufdq2zeFzKHlBL69ig5YOloJtcXBe0U5UC4sSU8qBlfEo0eKi3mN2-8jK62pNcrNIFqoOitNle9CHPPOuYKkSq1mY9JtSKN03WScn1p7fhnCZcvSyiwD6ktqxMeku30eSGPm9dVxz3yx2ERo5YIjxsoW2Vgw5pE_jMFomqGDIgmNYErWlJjn3TUQw"""

def test_token():
    print("🔐 Testing Firebase Token Verification\n")
    
    # Set up environment
    os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = './gcp-credentials.json'
    os.environ['FIREBASE_PROJECT_ID'] = 'medlegaldoc-b31df'
    
    try:
        # Decode token without verification first to see contents
        import jwt
        decoded_no_verify = jwt.decode(test_token, options={"verify_signature": False})
        print("📋 Token contents (no verification):")
        for key, value in decoded_no_verify.items():
            print(f"  {key}: {value}")
        
        print("\n🔍 Verifying token with Firebase...")
        
        # Try to verify with Firebase
        user_id = validate_firebase_token(test_token)
        print(f"✅ Token verified successfully!")
        print(f"User ID: {user_id}")
        
    except Exception as e:
        print(f"❌ Token verification failed: {type(e).__name__}: {e}")
        
        # Check if it's an expired token
        if "exp" in decoded_no_verify:
            exp_time = decoded_no_verify["exp"]
            from datetime import datetime
            exp_datetime = datetime.fromtimestamp(exp_time)
            now = datetime.now()
            print(f"\n⏰ Token expired at: {exp_datetime}")
            print(f"   Current time: {now}")
            print(f"   Expired {now - exp_datetime} ago")

if __name__ == "__main__":
    test_token()