#!/usr/bin/env python3
"""Test script to verify user settings persistence in GCS"""

import asyncio
import json
from datetime import datetime
from google.cloud import storage
from services.user_settings_service import UserSettingsService
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_settings_persistence():
    """Test saving and loading user settings from GCS"""
    
    # Test user ID (you can change this to your actual user ID)
    test_user_id = "HqFlxE8ig8TDNLrcgHKRVSzIs7L2"
    
    # Initialize the service
    settings_service = UserSettingsService()
    
    # 1. Load current settings
    logger.info(f"\n1. Loading current settings for user {test_user_id}...")
    current_settings = await settings_service.get_user_settings(test_user_id)
    
    if current_settings:
        logger.info("Current settings found:")
        logger.info(f"- Doctor Name: {current_settings.get('doctorName', 'Not set')}")
        logger.info(f"- Specialty: {current_settings.get('specialty', 'Not set')}")
        logger.info(f"- Number of transcription profiles: {len(current_settings.get('transcriptionProfiles', []))}")
        
        # Show transcription profiles
        profiles = current_settings.get('transcriptionProfiles', [])
        if profiles:
            logger.info("\nTranscription Profiles:")
            for profile in profiles:
                logger.info(f"  - {profile.get('name')} (ID: {profile.get('id')})")
    else:
        logger.warning("No settings found!")
    
    # 2. Check GCS directly
    logger.info(f"\n2. Checking GCS directly...")
    try:
        client = storage.Client()
        bucket = client.bucket('brainpower-transcription-audio')
        blob_path = f"{test_user_id}/settings/user_settings.json"
        blob = bucket.blob(blob_path)
        
        if blob.exists():
            logger.info(f"Settings file exists in GCS at: {blob_path}")
            # Get blob metadata
            blob.reload()
            logger.info(f"- Last modified: {blob.updated}")
            logger.info(f"- Size: {blob.size} bytes")
            
            # Download and display content
            content = blob.download_as_text()
            settings_data = json.loads(content)
            logger.info(f"- Settings version: {settings_data.get('version', 'Unknown')}")
            logger.info(f"- Last updated: {settings_data.get('lastUpdated', 'Unknown')}")
        else:
            logger.warning(f"Settings file NOT found in GCS at: {blob_path}")
    except Exception as e:
        logger.error(f"Error checking GCS: {e}")
    
    # 3. Test save operation
    logger.info(f"\n3. Testing save operation...")
    if current_settings:
        # Add a test timestamp to verify save
        current_settings['testTimestamp'] = datetime.now().isoformat()
        
        # Save settings
        save_result = await settings_service.save_user_settings(test_user_id, current_settings)
        if save_result:
            logger.info("Save operation successful!")
            
            # Verify by loading again
            updated_settings = await settings_service.get_user_settings(test_user_id)
            if updated_settings and updated_settings.get('testTimestamp'):
                logger.info(f"Verification successful - test timestamp: {updated_settings['testTimestamp']}")
            else:
                logger.error("Verification failed - test timestamp not found!")
        else:
            logger.error("Save operation failed!")
    
    # 4. Check cache
    logger.info(f"\n4. Checking in-memory cache...")
    cache_key = f"user_settings:{test_user_id}"
    if hasattr(settings_service, '_cache') and cache_key in settings_service._cache:
        cache_entry = settings_service._cache[cache_key]
        logger.info(f"Cache entry found - expires at: {cache_entry.get('expires_at', 'Unknown')}")
    else:
        logger.info("No cache entry found")

if __name__ == "__main__":
    asyncio.run(test_settings_persistence())