#!/usr/bin/env python3
"""Fix user settings path inconsistencies in GCS."""

import os
import json
from gcs_utils import GCSClient

def fix_user_settings_paths():
    """Check for user settings in wrong locations and move them to correct path."""
    print("🔧 Fixing User Settings Paths in GCS\n")
    
    # Initialize client
    client = GCSClient()
    bucket = client.storage_client.bucket(client.bucket_name)
    
    # Known user ID to check
    user_id = "7J67JTZCAhZX3Zmdr8G5CPmiUew2"
    
    # Possible paths where settings might be stored
    possible_paths = [
        f"{user_id}/settings/user_settings.txt",  # Wrong extension from save_data_to_gcs
        f"{user_id}/settings/user_settings.json", # Correct path
        f"user_settings/{user_id}/settings.json", # Old path structure
        f"{user_id}/user_settings.json",          # Alternative path
    ]
    
    print(f"Checking for settings for user: {user_id}")
    
    settings_found = False
    settings_data = None
    found_path = None
    
    # Check each possible path
    for path in possible_paths:
        blob = bucket.blob(path)
        if blob.exists():
            print(f"✅ Found settings at: {path}")
            try:
                content = blob.download_as_text()
                settings_data = json.loads(content)
                found_path = path
                settings_found = True
                print(f"   Settings loaded successfully")
                break
            except json.JSONDecodeError:
                print(f"   ⚠️  Failed to parse JSON from {path}")
            except Exception as e:
                print(f"   ❌ Error reading {path}: {e}")
    
    if not settings_found:
        print(f"\n❌ No settings found for user {user_id}")
        
        # List all objects for this user to debug
        print(f"\n📋 Listing all objects for user {user_id}:")
        blobs = bucket.list_blobs(prefix=f"{user_id}/")
        count = 0
        for blob in blobs:
            print(f"   - {blob.name}")
            count += 1
            if count > 20:
                print("   ... (showing first 20 objects)")
                break
        
        if count == 0:
            print("   No objects found for this user")
    else:
        # If settings found in wrong location, move to correct location
        correct_path = f"{user_id}/settings/user_settings.json"
        
        if found_path != correct_path:
            print(f"\n🔄 Moving settings from {found_path} to {correct_path}")
            
            # Save to correct location
            correct_blob = bucket.blob(correct_path)
            correct_blob.metadata = {
                'user_id': user_id,
                'data_type': 'user_settings',
                'migrated_from': found_path
            }
            correct_blob.upload_from_string(
                json.dumps(settings_data, indent=2),
                content_type='application/json'
            )
            
            print(f"✅ Settings saved to correct location")
            
            # Delete old location
            old_blob = bucket.blob(found_path)
            old_blob.delete()
            print(f"✅ Deleted settings from old location")
        else:
            print(f"\n✅ Settings are already in the correct location")
    
    # Test retrieval using the client method
    print(f"\n🧪 Testing retrieval using get_user_settings method:")
    try:
        retrieved_settings = client.get_user_settings(user_id)
        if retrieved_settings:
            print(f"✅ Settings retrieved successfully")
            print(f"   Name: {retrieved_settings.get('name', 'Not set')}")
            print(f"   Specialty: {retrieved_settings.get('medicalSpecialty', 'Not set')}")
        else:
            print("❌ Failed to retrieve settings")
    except Exception as e:
        print(f"❌ Error retrieving settings: {e}")

if __name__ == "__main__":
    # Set up environment
    os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = './gcp-credentials.json'
    os.environ['GCS_BUCKET_NAME'] = 'medical-transcription-hipaa-prod'
    
    fix_user_settings_paths()