#!/usr/bin/env python3
"""Simple script to check user settings via API"""

import requests
import json
import sys

def check_user_settings(user_id, token):
    """Check user settings via API"""
    
    # API endpoint
    api_url = "http://localhost:8000"
    
    # Headers with authorization
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # 1. Get current settings
    print(f"\n1. Getting settings for user: {user_id}")
    response = requests.get(f"{api_url}/api/v1/user_settings/{user_id}", headers=headers)
    
    if response.status_code == 200:
        settings = response.json()
        print("Settings found!")
        print(f"- Doctor Name: {settings.get('doctorName', 'Not set')}")
        print(f"- Specialty: {settings.get('specialty', 'Not set')}")
        
        profiles = settings.get('transcriptionProfiles', [])
        print(f"- Number of transcription profiles: {len(profiles)}")
        
        if profiles:
            print("\nTranscription Profiles:")
            for profile in profiles:
                print(f"  - {profile.get('name')} (ID: {profile.get('id')})")
                if profile.get('isDefault'):
                    print("    ^ This is the default profile")
        
        # Check for narrative template
        for profile in profiles:
            if profile.get('narrativeTemplateId'):
                print(f"\nProfile '{profile.get('name')}' has narrative template:")
                print(f"  - Template ID: {profile.get('narrativeTemplateId')}")
                print(f"  - Template Name: {profile.get('narrativeTemplateName', 'Unknown')}")
        
        return settings
    elif response.status_code == 404:
        print("No settings found for this user!")
        return None
    else:
        print(f"Error: {response.status_code} - {response.text}")
        return None

if __name__ == "__main__":
    # You need to provide these values
    print("Usage: python check_user_settings.py <user_id> <auth_token>")
    print("\nTo get your auth token:")
    print("1. Open browser developer tools (F12)")
    print("2. Go to Network tab")
    print("3. Make any API request in the app")
    print("4. Look for the Authorization header (starts with 'Bearer')")
    print("5. Copy the token part (after 'Bearer ')")
    
    if len(sys.argv) == 3:
        user_id = sys.argv[1]
        token = sys.argv[2]
        check_user_settings(user_id, token)
    else:
        # Default test with your user ID
        print("\nNo arguments provided. Please provide user_id and auth_token")