#!/usr/bin/env python3
"""Debug script to investigate user settings persistence issue"""

import asyncio
import json
from datetime import datetime, timezone
from google.cloud import storage
from firestore_client import firestore_client
from services.user_settings_service import UserSettingsService
from gcs_utils import GCSClient
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def investigate_settings_issue(user_id: str):
    """Investigate the settings persistence issue"""
    
    logger.info(f"=== Investigating Settings for User: {user_id} ===")
    
    # 1. Check Firestore
    logger.info("\n1. Checking Firestore...")
    try:
        user_doc = await firestore_client.get_user_settings(user_id)
        if user_doc:
            logger.info("User document found in Firestore:")
            logger.info(f"- Last updated: {user_doc.get('updated_at', 'Unknown')}")
            
            # Check transcription profiles in Firestore
            profiles = user_doc.get('transcription_profiles', [])
            logger.info(f"- Transcription profiles count: {len(profiles)}")
            if profiles:
                logger.info("- Profile names:")
                for p in profiles:
                    logger.info(f"  * {p.get('name')} (ID: {p.get('id')})")
        else:
            logger.warning("No user document found in Firestore!")
    except Exception as e:
        logger.error(f"Error checking Firestore: {e}")
    
    # 2. Check GCS
    logger.info("\n2. Checking Google Cloud Storage...")
    try:
        gcs_client = GCSClient()
        settings_key = f"{user_id}/settings/user_settings.json"
        
        # Get raw content from GCS
        content = gcs_client.get_gcs_object_content(settings_key)
        if content:
            logger.info(f"Settings file found in GCS at: {settings_key}")
            settings_data = json.loads(content)
            
            # Check transcription profiles in GCS
            profiles = settings_data.get('transcriptionProfiles', [])
            logger.info(f"- Transcription profiles count: {len(profiles)}")
            if profiles:
                logger.info("- Profile names:")
                for p in profiles:
                    logger.info(f"  * {p.get('name')} (ID: {p.get('id')})")
            
            # Check if there's a timestamp
            if 'lastUpdated' in settings_data:
                logger.info(f"- Last updated (from data): {settings_data['lastUpdated']}")
        else:
            logger.warning(f"No settings file found in GCS at: {settings_key}")
    except Exception as e:
        logger.error(f"Error checking GCS: {e}")
    
    # 3. Check through UserSettingsService
    logger.info("\n3. Checking through UserSettingsService...")
    try:
        settings_service = UserSettingsService(gcs_client)
        
        # Get settings without cache
        settings = await settings_service.get_user_settings(user_id, use_cache=False)
        if settings:
            logger.info("Settings loaded through service:")
            profiles = settings.get('transcriptionProfiles', [])
            logger.info(f"- Transcription profiles count: {len(profiles)}")
            if profiles:
                logger.info("- Profile names:")
                for p in profiles:
                    logger.info(f"  * {p.get('name')} (ID: {p.get('id')})")
        
        # Check cache
        cache_key = settings_service._get_cache_key(user_id)
        if cache_key in settings_service._cache:
            cache_entry = settings_service._cache[cache_key]
            logger.info(f"\n- Cache entry found")
            logger.info(f"- Cached at: {datetime.fromtimestamp(cache_entry['cached_at'], tz=timezone.utc).isoformat()}")
            logger.info(f"- Cache TTL: {settings_service._cache_ttl} seconds")
            
            # Check if cache is expired
            age = datetime.now(timezone.utc).timestamp() - cache_entry['cached_at']
            logger.info(f"- Cache age: {age:.1f} seconds")
            logger.info(f"- Cache expired: {age > settings_service._cache_ttl}")
        else:
            logger.info("\n- No cache entry found")
    except Exception as e:
        logger.error(f"Error checking through service: {e}")
    
    # 4. Compare sources
    logger.info("\n4. Summary:")
    logger.info("The issue appears to be that the main.py refactoring changed from storing settings")
    logger.info("directly in Firestore to storing them in GCS with only a summary synced to Firestore.")
    logger.info("The UserSettingsService has a 5-minute cache, but that shouldn't cause 1-2 hour persistence issues.")
    logger.info("\nPossible causes:")
    logger.info("1. The sync_to_firestore only saves a summary, not the full settings")
    logger.info("2. The frontend might be reading from Firestore instead of the GCS-backed endpoint")
    logger.info("3. There might be a mismatch between save and load paths")

if __name__ == "__main__":
    # You can change this to your actual user ID for testing
    test_user_id = "HqFlxE8ig8TDNLrcgHKRVSzIs7L2"
    
    import sys
    if len(sys.argv) > 1:
        test_user_id = sys.argv[1]
    
    asyncio.run(investigate_settings_issue(test_user_id))