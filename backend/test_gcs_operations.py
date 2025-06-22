#!/usr/bin/env python3
"""Test script to verify GCS operations for medical transcription app."""

import os
import json
import sys
from datetime import datetime
from gcs_utils import GCSClient

def test_gcs_operations():
    """Test all GCS operations."""
    print("🧪 Testing GCS Operations for Medical Transcription App\n")
    
    # Initialize client
    try:
        client = GCSClient()
        print(f"✅ GCS client initialized for bucket: {client.bucket_name}")
    except Exception as e:
        print(f"❌ Failed to initialize GCS client: {e}")
        return False
    
    # Test data
    test_user_id = "test_user_123"
    test_session_id = f"test_session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    # Test 1: Save user settings
    print("\n📝 Test 1: Save User Settings")
    test_settings = {
        "name": "Test User",
        "specialty": "Internal Medicine",
        "office_address": "123 Test St",
        "updated_at": datetime.now().isoformat()
    }
    
    try:
        success = client.save_user_settings(test_user_id, test_settings)
        if success:
            print("✅ User settings saved successfully")
        else:
            print("❌ Failed to save user settings")
    except Exception as e:
        print(f"❌ Error saving user settings: {e}")
    
    # Test 2: Get user settings
    print("\n📖 Test 2: Get User Settings")
    try:
        settings = client.get_user_settings(test_user_id)
        if settings:
            print(f"✅ User settings retrieved: {json.dumps(settings, indent=2)}")
        else:
            print("❌ No user settings found")
    except Exception as e:
        print(f"❌ Error getting user settings: {e}")
    
    # Test 3: Save transcript
    print("\n📄 Test 3: Save Transcript")
    test_transcript = "This is a test medical transcription for patient John Doe."
    
    try:
        # Save original transcript
        success = client.save_data_to_gcs(
            test_user_id, 
            "transcripts/original", 
            test_session_id, 
            test_transcript
        )
        if success:
            print("✅ Original transcript saved successfully")
        
        # Save polished transcript
        polished_transcript = "This is a polished test medical transcription for patient John Doe."
        success = client.save_data_to_gcs(
            test_user_id,
            "transcripts/polished",
            test_session_id,
            polished_transcript
        )
        if success:
            print("✅ Polished transcript saved successfully")
    except Exception as e:
        print(f"❌ Error saving transcript: {e}")
    
    # Test 4: List user recordings
    print("\n📋 Test 4: List User Recordings")
    try:
        recordings = client.list_user_recordings(test_user_id)
        print(f"✅ Found {len(recordings)} recordings")
        for rec in recordings[:5]:  # Show first 5
            print(f"  - {rec.get('session_id', 'Unknown')}: {rec.get('created_at', 'Unknown date')}")
    except Exception as e:
        print(f"❌ Error listing recordings: {e}")
    
    # Test 5: Get object content
    print("\n📃 Test 5: Get Object Content")
    try:
        content = client.get_object_content(test_user_id, f"transcripts/original/{test_session_id}.txt")
        if content:
            print(f"✅ Retrieved content: {content[:100]}...")
        else:
            print("❌ No content found")
    except Exception as e:
        print(f"❌ Error getting object content: {e}")
    
    # Test 6: Delete test data
    print("\n🗑️  Test 6: Cleanup Test Data")
    try:
        # Delete test recordings
        success = client.delete_recording(test_user_id, test_session_id)
        if success:
            print("✅ Test recording deleted successfully")
        
        # Note: We'll keep user settings for now as they might be useful
    except Exception as e:
        print(f"❌ Error during cleanup: {e}")
    
    print("\n✅ All GCS tests completed!")
    return True

if __name__ == "__main__":
    # Set up environment
    os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = './gcp-credentials.json'
    os.environ['GCS_BUCKET_NAME'] = 'medical-transcription-hipaa-prod'
    
    # Run tests
    test_gcs_operations()