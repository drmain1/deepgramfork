#!/usr/bin/env python3
"""
Script to help secure Firebase API keys by setting up restrictions
"""

import os
import sys

def print_instructions():
    print("""
Firebase API Key Security Setup
==============================

This script will guide you through securing your Firebase API keys.

IMMEDIATE ACTIONS REQUIRED:
1. Go to https://console.cloud.google.com/apis/credentials
2. Select project: medlegaldoc-b31df
3. Find your API key ending in 'Wrr3Yjk7Zqk'
4. Click on it and add these restrictions:

APPLICATION RESTRICTIONS:
- Select: HTTP referrers (web sites)
- Add these referrers:
  * http://localhost:5173/*
  * http://localhost:5174/*
  * https://medlegaldoc.com/*
  * https://www.medlegaldoc.com/*

API RESTRICTIONS:
- Select: Restrict key
- Enable these APIs:
  * Identity Toolkit API
  * Firebase Installations API
  * Cloud Storage API
  * Cloud Firestore API (if using)

CREATING A NEW KEY:
1. Click "Create Credentials" → "API key"
2. Apply the same restrictions immediately
3. Copy the new key
4. Update your .env file

Press Enter to continue...
""")
    input()

def create_env_template():
    env_template = """# Firebase Configuration
VITE_FIREBASE_API_KEY=your-new-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=medlegaldoc-b31df.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=medlegaldoc-b31df
VITE_FIREBASE_STORAGE_BUCKET=medlegaldoc-b31df.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1078333885289
VITE_FIREBASE_APP_ID=1:1078333885289:web:da7de056dfa811e72fcbf8

# Backend Configuration
VITE_API_URL=http://localhost:8000

# Development Settings
VITE_USE_AUTH_EMULATOR=false
"""
    
    env_path = os.path.join(os.path.dirname(__file__), '..', 'my-vite-react-app', '.env.template')
    with open(env_path, 'w') as f:
        f.write(env_template)
    
    print(f"\nCreated .env.template at: {env_path}")
    print("Use this as a template for your .env file with the new API key")

def check_gitignore():
    gitignore_path = os.path.join(os.path.dirname(__file__), '..', '.gitignore')
    with open(gitignore_path, 'r') as f:
        content = f.read()
    
    if '.env' in content:
        print("\n✅ .env files are already in .gitignore")
    else:
        print("\n⚠️  WARNING: .env files are NOT in .gitignore!")
        print("Add these lines to .gitignore:")
        print(".env")
        print("*.env")
        print(".env.*")

def main():
    print_instructions()
    create_env_template()
    check_gitignore()
    
    print("""
Next Steps:
===========
1. Complete the API key restrictions in Google Cloud Console
2. Create a new API key with the same restrictions
3. Update your .env file with the new key
4. Test your application
5. Delete the old compromised key

Security Best Practices:
- Always restrict API keys by domain
- Use App Check for additional security
- Regularly rotate keys
- Monitor usage in Google Cloud Console
- Set up billing alerts

Remember: Firebase API keys are meant to be public, but should still be restricted!
""")

if __name__ == "__main__":
    main()