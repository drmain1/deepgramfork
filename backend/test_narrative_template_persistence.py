#!/usr/bin/env python3
"""Test script to verify narrative template persistence after the sync_to_firestore fix."""

import asyncio
import sys
from datetime import datetime
import json

# Add the backend directory to the Python path
sys.path.insert(0, '/Users/davidmain/Desktop/cursor_projects/github_fork/backend')

from firestore_client import firestore_client
from services.user_settings_service import UserSettingsService
from gcs_utils import GCSClient


async def test_narrative_template_persistence():
    """Test that narrative templates are properly persisted to Firestore."""
    
    # Initialize services
    gcs_client = GCSClient()
    user_settings_service = UserSettingsService(gcs_client)
    
    # Test user ID (you can change this to your actual user ID)
    test_user_id = "test_user_123"
    
    print(f"\n=== Testing Narrative Template Persistence ===")
    print(f"User ID: {test_user_id}")
    print(f"Time: {datetime.now()}")
    
    # 1. Create test settings with narrative templates
    test_settings = {
        "doctorName": "Dr. Test",
        "medicalSpecialty": "Internal Medicine",
        "customVocabulary": ["test", "vocabulary"],
        "macroPhrases": [],
        "transcriptionProfiles": [
            {
                "id": "initial-consultation",
                "name": "Initial Consultation",
                "template": "Sample template for initial consultation...",
                "isDefault": True
            },
            {
                "id": "follow-up-visit",
                "name": "Follow-up Visit",
                "template": "Sample template for follow-up visit...",
                "isDefault": False
            }
        ],
        "officeInformation": [],
        "clinicLogo": None,
        "doctorSignature": None,
        "includeLogoOnPdf": False,
        "customBillingRules": "",
        "cptFees": {}
    }
    
    print("\n1. Saving settings to GCS...")
    success = await user_settings_service.save_user_settings(test_user_id, test_settings)
    print(f"   Save to GCS: {'✓ Success' if success else '✗ Failed'}")
    
    # 2. Sync to Firestore
    print("\n2. Syncing to Firestore...")
    sync_success = await user_settings_service.sync_to_firestore(test_user_id)
    print(f"   Sync to Firestore: {'✓ Success' if sync_success else '✗ Failed'}")
    
    # 3. Read directly from Firestore to verify
    print("\n3. Reading from Firestore to verify...")
    firestore_settings = await firestore_client.get_user_settings(test_user_id)
    
    if firestore_settings:
        print("   ✓ Settings found in Firestore")
        
        # Check if transcription_profiles exist
        if 'transcription_profiles' in firestore_settings:
            profiles = firestore_settings['transcription_profiles']
            print(f"   ✓ Found {len(profiles)} transcription profiles")
            
            for profile in profiles:
                print(f"      - {profile.get('name', 'Unknown')} (ID: {profile.get('id', 'N/A')})")
        else:
            print("   ✗ No transcription_profiles field found in Firestore!")
            print("   Fields in Firestore:", list(firestore_settings.keys()))
    else:
        print("   ✗ No settings found in Firestore")
    
    # 4. Clear cache and read from service to simulate a fresh read
    print("\n4. Simulating fresh read (after cache expiry)...")
    user_settings_service.invalidate_cache(test_user_id)
    
    fresh_settings = await user_settings_service.get_user_settings(test_user_id)
    
    if 'transcriptionProfiles' in fresh_settings:
        profiles = fresh_settings['transcriptionProfiles']
        print(f"   ✓ Found {len(profiles)} transcription profiles after cache clear")
    else:
        print("   ✗ No transcriptionProfiles found after cache clear!")
    
    # 5. Test the legacy Firestore endpoint
    print("\n5. Testing legacy Firestore endpoint...")
    from firestore_endpoints import get_user_settings_firestore
    
    legacy_settings = await get_user_settings_firestore(test_user_id)
    
    if legacy_settings and 'transcription_profiles' in legacy_settings:
        print("   ✓ Legacy endpoint returns transcription profiles")
    else:
        print("   ✗ Legacy endpoint does not return transcription profiles")
    
    print("\n=== Test Complete ===\n")


if __name__ == "__main__":
    asyncio.run(test_narrative_template_persistence())