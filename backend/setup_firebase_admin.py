#!/usr/bin/env python3
"""
Script to help set up Firebase Admin SDK credentials for local development.

To use this script:
1. Go to Firebase Console (https://console.firebase.google.com)
2. Select your project
3. Go to Project Settings > Service accounts
4. Click "Generate new private key"
5. Save the JSON file as 'gcp-credentials.json' in the backend directory
"""

import os
import json
import sys

def check_firebase_credentials():
    """Check if Firebase credentials are properly set up."""
    cred_path = 'gcp-credentials.json'
    
    if os.path.exists(cred_path):
        print(f"✓ Found credentials file: {cred_path}")
        
        # Validate it's a proper service account file
        try:
            with open(cred_path, 'r') as f:
                creds = json.load(f)
                
            required_fields = ['type', 'project_id', 'private_key', 'client_email']
            missing_fields = [field for field in required_fields if field not in creds]
            
            if missing_fields:
                print(f"✗ Credentials file is missing required fields: {missing_fields}")
                return False
                
            if creds.get('type') != 'service_account':
                print(f"✗ Credentials file is not a service account (type: {creds.get('type')})")
                return False
                
            print(f"✓ Project ID: {creds.get('project_id')}")
            print(f"✓ Service account: {creds.get('client_email')}")
            return True
            
        except json.JSONDecodeError:
            print("✗ Credentials file is not valid JSON")
            return False
        except Exception as e:
            print(f"✗ Error reading credentials file: {e}")
            return False
    else:
        print(f"✗ Credentials file not found: {cred_path}")
        print("\nTo set up Firebase Admin SDK:")
        print("1. Go to https://console.firebase.google.com")
        print("2. Select your project (medlegaldoc)")
        print("3. Go to ⚙️ Project Settings > Service accounts")
        print("4. Click 'Generate new private key'")
        print("5. Save the downloaded JSON file as 'gcp-credentials.json' in this directory")
        return False

def create_example_env():
    """Create an example .env file for backend configuration."""
    env_example = """# Firebase/GCP Configuration
GOOGLE_APPLICATION_CREDENTIALS=gcp-credentials.json
GCP_PROJECT_ID=medlegaldoc-b31df
GCS_BUCKET_NAME=medlegaldoc-medical-data
ENVIRONMENT=development

# Session Configuration
SESSION_TIMEOUT_MINUTES=25

# API Keys (keep your existing ones)
DEEPGRAM_API_KEY=your_deepgram_key
ANTHROPIC_API_KEY=your_anthropic_key
"""
    
    if not os.path.exists('.env'):
        with open('.env.example', 'w') as f:
            f.write(env_example)
        print("\n✓ Created .env.example file - copy to .env and fill in your API keys")
    else:
        print("\n✓ .env file already exists")

if __name__ == "__main__":
    print("Firebase Admin SDK Setup Check")
    print("=" * 50)
    
    # Check if we're in the backend directory
    if not os.path.exists('main.py'):
        print("✗ This script should be run from the backend directory")
        sys.exit(1)
    
    # Check Firebase credentials
    if check_firebase_credentials():
        print("\n✅ Firebase Admin SDK is properly configured!")
    else:
        print("\n❌ Firebase Admin SDK needs to be configured")
        sys.exit(1)
    
    # Create example env file
    create_example_env()