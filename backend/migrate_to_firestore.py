"""
Migration script to move metadata from GCS to Firestore.
This script will:
1. Read user settings from GCS and create Firestore user documents
2. Read session metadata from GCS and create Firestore transcript documents
3. Keep actual transcript files in GCS (only references in Firestore)
"""

import os
import json
import asyncio
import logging
from datetime import datetime
from typing import Dict, List, Any
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from gcs_utils import GCSClient
from firestore_client import firestore_client
from firestore_models import TranscriptStatus

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FirestoreMigration:
    """Handles migration of metadata from GCS to Firestore"""
    
    def __init__(self):
        self.gcs_client = GCSClient()
        self.firestore = firestore_client
        self.migrated_users = set()
        self.migrated_transcripts = set()
    
    async def migrate_user_settings(self, user_id: str) -> bool:
        """Migrate user settings from GCS to Firestore"""
        try:
            # Skip if already migrated
            if user_id in self.migrated_users:
                return True
            
            logger.info(f"Migrating settings for user {user_id}")
            
            # Get settings from GCS
            settings_data = self.gcs_client.get_user_settings(user_id)
            
            if settings_data:
                # Create or update user document
                user_doc = await self.firestore.get_user_settings(user_id)
                
                if user_doc:
                    # Update existing user
                    await self.firestore.update_user_settings(user_id, {
                        'custom_vocabulary': settings_data.get('customVocabulary', []),
                        'macro_phrases': settings_data.get('macroPhrases', {}),
                        'transcription_profiles': settings_data.get('transcriptionProfiles', [])
                    })
                else:
                    # Create new user (need email - we'll use a placeholder)
                    await self.firestore.get_or_create_user(
                        user_id=user_id,
                        email=f"{user_id}@migrated.local",  # Placeholder
                        name=settings_data.get('userName')
                    )
                    
                    # Then update with settings
                    await self.firestore.update_user_settings(user_id, {
                        'custom_vocabulary': settings_data.get('customVocabulary', []),
                        'macro_phrases': settings_data.get('macroPhrases', {}),
                        'transcription_profiles': settings_data.get('transcriptionProfiles', [])
                    })
                
                self.migrated_users.add(user_id)
                logger.info(f"Successfully migrated settings for user {user_id}")
                return True
            else:
                logger.warning(f"No settings found in GCS for user {user_id}")
                return False
                
        except Exception as e:
            logger.error(f"Error migrating user settings for {user_id}: {str(e)}")
            return False
    
    async def migrate_transcript_metadata(self, user_id: str, session_id: str) -> bool:
        """Migrate a single transcript's metadata from GCS to Firestore"""
        try:
            # Skip if already migrated
            if session_id in self.migrated_transcripts:
                return True
            
            logger.info(f"Migrating transcript {session_id} for user {user_id}")
            
            # Get metadata from GCS
            metadata_key = f"{user_id}/metadata/{session_id}.json"
            metadata_str = self.gcs_client.get_gcs_object_content(metadata_key)
            
            if not metadata_str:
                logger.warning(f"No metadata found for session {session_id}")
                return False
            
            metadata = json.loads(metadata_str)
            
            # Map GCS paths
            gcs_paths = metadata.get('gcs_paths', {})
            
            # Create transcript document
            transcript_data = {
                'user_id': user_id,
                'session_id': session_id,
                'status': TranscriptStatus.COMPLETED if metadata.get('status') == 'completed' else TranscriptStatus.PROCESSING,
                'created_at': datetime.fromisoformat(metadata.get('created_date', datetime.now().isoformat())),
                'patient_name': metadata.get('patient_name', 'Unknown Patient'),
                'patient_context': metadata.get('patient_context'),
                'encounter_type': metadata.get('encounter_type'),
                'location': metadata.get('location'),
                'llm_template': metadata.get('llm_template'),
                'llm_template_id': metadata.get('llm_template_id'),
                'gcs_path_original': gcs_paths.get('original_transcript'),
                'gcs_path_polished': gcs_paths.get('polished_transcript')
            }
            
            # Create in Firestore
            await self.firestore.create_transcript(transcript_data)
            
            self.migrated_transcripts.add(session_id)
            logger.info(f"Successfully migrated transcript {session_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error migrating transcript {session_id}: {str(e)}")
            return False
    
    async def migrate_user_transcripts(self, user_id: str) -> int:
        """Migrate all transcripts for a user"""
        try:
            logger.info(f"Migrating all transcripts for user {user_id}")
            
            # List all metadata files for the user
            prefix = f"{user_id}/metadata/"
            metadata_files = self.gcs_client.list_gcs_objects(prefix)
            
            if not metadata_files:
                logger.info(f"No metadata files found for user {user_id}")
                return 0
            
            count = 0
            for metadata_file in metadata_files:
                # Extract session ID from filename
                filename = metadata_file.split('/')[-1]
                if filename.endswith('.json'):
                    session_id = filename[:-5]  # Remove .json extension
                    
                    if await self.migrate_transcript_metadata(user_id, session_id):
                        count += 1
            
            logger.info(f"Migrated {count} transcripts for user {user_id}")
            return count
            
        except Exception as e:
            logger.error(f"Error migrating transcripts for user {user_id}: {str(e)}")
            return 0
    
    async def migrate_all_users(self) -> Dict[str, Any]:
        """Migrate all users and their data"""
        try:
            logger.info("Starting full migration from GCS to Firestore")
            
            # Get all user IDs by listing top-level directories
            all_objects = self.gcs_client.list_gcs_objects("")
            user_ids = set()
            
            for obj in all_objects:
                parts = obj.split('/')
                if parts[0]:  # First part is user ID
                    user_ids.add(parts[0])
            
            logger.info(f"Found {len(user_ids)} users to migrate")
            
            # Migration stats
            stats = {
                'total_users': len(user_ids),
                'migrated_users': 0,
                'migrated_transcripts': 0,
                'failed_users': 0,
                'errors': []
            }
            
            # Migrate each user
            for user_id in user_ids:
                try:
                    # Migrate user settings
                    if await self.migrate_user_settings(user_id):
                        stats['migrated_users'] += 1
                    
                    # Migrate user's transcripts
                    transcript_count = await self.migrate_user_transcripts(user_id)
                    stats['migrated_transcripts'] += transcript_count
                    
                except Exception as e:
                    logger.error(f"Failed to migrate user {user_id}: {str(e)}")
                    stats['failed_users'] += 1
                    stats['errors'].append(f"User {user_id}: {str(e)}")
            
            logger.info(f"Migration completed: {stats}")
            return stats
            
        except Exception as e:
            logger.error(f"Migration failed: {str(e)}")
            raise

async def main():
    """Run the migration"""
    migration = FirestoreMigration()
    
    # Check if we're migrating a specific user or all users
    specific_user = os.getenv('MIGRATE_USER_ID')
    
    if specific_user:
        logger.info(f"Migrating specific user: {specific_user}")
        await migration.migrate_user_settings(specific_user)
        count = await migration.migrate_user_transcripts(specific_user)
        logger.info(f"Migration complete. Migrated {count} transcripts.")
    else:
        # Migrate all users
        stats = await migration.migrate_all_users()
        logger.info(f"Full migration complete: {stats}")

if __name__ == "__main__":
    # Run with: python migrate_to_firestore.py
    # Or for specific user: MIGRATE_USER_ID=abc123 python migrate_to_firestore.py
    asyncio.run(main())