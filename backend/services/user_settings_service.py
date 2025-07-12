"""Centralized service for managing user settings."""
import json
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
from pydantic import BaseModel

from gcs_utils import GCSClient
from firestore_client import firestore_client

logger = logging.getLogger(__name__)


class UserSettingsService:
    """Manages user settings stored in GCS and provides a unified interface."""
    
    DEFAULT_USER_SETTINGS = {
        "macroPhrases": [],
        "customVocabulary": [],
        "officeInformation": [],
        "transcriptionProfiles": [],
        "doctorName": "",
        "doctorSignature": None,
        "clinicLogo": None,
        "includeLogoOnPdf": False,
        "medicalSpecialty": "",
        "customBillingRules": "",
        "cptFees": {},
        "timezone": "America/Los_Angeles"  # Default to Pacific Time
    }
    
    def __init__(self, gcs_client: GCSClient):
        """Initialize the service with a GCS client.
        
        Args:
            gcs_client: The Google Cloud Storage client
        """
        self.gcs_client = gcs_client
        self._cache = {}  # Simple in-memory cache
        self._cache_ttl = 300  # 5 minutes
    
    def _get_settings_key(self, user_id: str) -> str:
        """Get the GCS key for user settings."""
        return f"{user_id}/settings/user_settings.json"
    
    def _get_cache_key(self, user_id: str) -> str:
        """Get the cache key for user settings."""
        return f"settings:{user_id}"
    
    def _is_cache_valid(self, cache_entry: dict) -> bool:
        """Check if a cache entry is still valid."""
        if not cache_entry:
            return False
        
        cached_at = cache_entry.get("cached_at", 0)
        age = datetime.now(timezone.utc).timestamp() - cached_at
        return age < self._cache_ttl
    
    async def get_user_settings(
        self, 
        user_id: str, 
        use_cache: bool = True
    ) -> Dict[str, Any]:
        """Get user settings from GCS with caching.
        
        Args:
            user_id: The user's ID
            use_cache: Whether to use cached settings if available
            
        Returns:
            User settings dictionary
        """
        cache_key = self._get_cache_key(user_id)
        
        # Check cache first
        if use_cache and cache_key in self._cache:
            cache_entry = self._cache[cache_key]
            if self._is_cache_valid(cache_entry):
                logger.debug(f"Returning cached settings for user {user_id}")
                return cache_entry["data"]
        
        # Load from GCS
        settings_key = self._get_settings_key(user_id)
        try:
            settings_content = self.gcs_client.get_gcs_object_content(settings_key)
            
            if settings_content:
                settings = json.loads(settings_content)
                logger.info(f"Loaded settings from GCS for user {user_id}")
                logger.info(f"=== DEBUG: GCS content for {user_id} ===")
                logger.info(f"transcriptionProfiles: {len(settings.get('transcriptionProfiles', []))} items")
                logger.info(f"doctorName: {settings.get('doctorName', '')}")
                logger.info(f"medicalSpecialty: {settings.get('medicalSpecialty', '')}")
            else:
                settings = self.DEFAULT_USER_SETTINGS.copy()
                logger.info(f"Using default settings for user {user_id} - NO GCS CONTENT FOUND")
            
            # Update cache
            self._cache[cache_key] = {
                "data": settings,
                "cached_at": datetime.now(timezone.utc).timestamp()
            }
            
            return settings
            
        except Exception as e:
            logger.error(f"Error loading settings for user {user_id}: {e}")
            return self.DEFAULT_USER_SETTINGS.copy()
    
    async def save_user_settings(
        self, 
        user_id: str, 
        settings: Dict[str, Any],
        partial_update: bool = False
    ) -> bool:
        """Save user settings to GCS.
        
        Args:
            user_id: The user's ID
            settings: The settings to save
            partial_update: If True, merge with existing settings
            
        Returns:
            True if successful, False otherwise
        """
        try:
            if partial_update:
                # Load existing settings and merge
                current_settings = await self.get_user_settings(user_id, use_cache=False)
                current_settings.update(settings)
                settings = current_settings
            
            # Log what we're about to save
            logger.info(f"=== DEBUG: Saving to GCS for user {user_id} ===")
            logger.info(f"transcriptionProfiles: {len(settings.get('transcriptionProfiles', []))} items")
            logger.info(f"doctorName: {settings.get('doctorName', '')}")
            logger.info(f"medicalSpecialty: {settings.get('medicalSpecialty', '')}")
            
            # Save to GCS
            settings_key = self._get_settings_key(user_id)
            success = self.gcs_client.save_data_to_gcs(
                user_id=user_id,
                data_type="settings",
                session_id="user_settings",
                content=json.dumps(settings)
            )
            
            if success:
                # Update cache
                cache_key = self._get_cache_key(user_id)
                self._cache[cache_key] = {
                    "data": settings,
                    "cached_at": datetime.now(timezone.utc).timestamp()
                }
                logger.info(f"Saved settings for user {user_id}")
                
                # Verify what was saved
                saved_content = self.gcs_client.get_gcs_object_content(settings_key)
                if saved_content:
                    saved_data = json.loads(saved_content)
                    logger.info(f"=== DEBUG: Verified GCS save for {user_id} ===")
                    logger.info(f"transcriptionProfiles in saved data: {len(saved_data.get('transcriptionProfiles', []))} items")
            else:
                logger.error(f"Failed to save settings for user {user_id}")
            
            return success
            
        except Exception as e:
            logger.error(f"Error saving settings for user {user_id}: {e}")
            return False
    
    async def update_setting(
        self, 
        user_id: str, 
        key: str, 
        value: Any
    ) -> bool:
        """Update a single setting.
        
        Args:
            user_id: The user's ID
            key: The setting key
            value: The new value
            
        Returns:
            True if successful, False otherwise
        """
        return await self.save_user_settings(
            user_id, 
            {key: value}, 
            partial_update=True
        )
    
    async def get_setting(
        self, 
        user_id: str, 
        key: str, 
        default: Any = None
    ) -> Any:
        """Get a single setting value.
        
        Args:
            user_id: The user's ID
            key: The setting key
            default: Default value if key doesn't exist
            
        Returns:
            The setting value or default
        """
        settings = await self.get_user_settings(user_id)
        return settings.get(key, default)
    
    async def reset_user_settings(self, user_id: str) -> bool:
        """Reset user settings to defaults.
        
        Args:
            user_id: The user's ID
            
        Returns:
            True if successful, False otherwise
        """
        return await self.save_user_settings(
            user_id, 
            self.DEFAULT_USER_SETTINGS.copy()
        )
    
    def invalidate_cache(self, user_id: str) -> None:
        """Invalidate cached settings for a user.
        
        Args:
            user_id: The user's ID
        """
        cache_key = self._get_cache_key(user_id)
        if cache_key in self._cache:
            del self._cache[cache_key]
            logger.debug(f"Invalidated cache for user {user_id}")
    
    async def migrate_legacy_format(self, user_id: str) -> bool:
        """Migrate legacy settings format to new format.
        
        Args:
            user_id: The user's ID
            
        Returns:
            True if migration was performed, False if not needed
        """
        settings = await self.get_user_settings(user_id, use_cache=False)
        
        # Check if migration is needed
        needs_migration = False
        
        # Convert macroPhrases from dict to list format
        macro_phrases = settings.get("macroPhrases", {})
        if isinstance(macro_phrases, dict):
            settings["macroPhrases"] = [
                {"shortcut": k, "expansion": v} 
                for k, v in macro_phrases.items()
            ]
            needs_migration = True
            logger.info(f"Migrating macroPhrases format for user {user_id}")
        
        # Add any other format migrations here
        
        if needs_migration:
            success = await self.save_user_settings(user_id, settings)
            if success:
                logger.info(f"Successfully migrated settings for user {user_id}")
            return success
        
        return False
    
    async def get_transcription_profile(
        self, 
        user_id: str, 
        profile_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get a specific transcription profile.
        
        Args:
            user_id: The user's ID
            profile_id: The profile ID
            
        Returns:
            The profile data or None if not found
        """
        profiles = await self.get_setting(user_id, "transcriptionProfiles", [])
        
        for profile in profiles:
            if profile.get("id") == profile_id:
                return profile
        
        return None
    
    async def get_default_transcription_profile(
        self, 
        user_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get the default transcription profile.
        
        Args:
            user_id: The user's ID
            
        Returns:
            The default profile or None if not set
        """
        profiles = await self.get_setting(user_id, "transcriptionProfiles", [])
        
        for profile in profiles:
            if profile.get("isDefault", False):
                return profile
        
        # Return first profile if no default is set
        return profiles[0] if profiles else None
    
    async def update_transcription_profile(
        self, 
        user_id: str, 
        profile_id: str,
        profile_data: Dict[str, Any]
    ) -> bool:
        """Update a transcription profile.
        
        Args:
            user_id: The user's ID
            profile_id: The profile ID to update
            profile_data: The new profile data
            
        Returns:
            True if successful, False otherwise
        """
        profiles = await self.get_setting(user_id, "transcriptionProfiles", [])
        
        # Find and update the profile
        updated = False
        for i, profile in enumerate(profiles):
            if profile.get("id") == profile_id:
                profiles[i] = {**profile, **profile_data, "id": profile_id}
                updated = True
                break
        
        if not updated:
            # Profile doesn't exist, add it
            profile_data["id"] = profile_id
            profiles.append(profile_data)
        
        return await self.update_setting(user_id, "transcriptionProfiles", profiles)
    
    async def sync_to_firestore(self, user_id: str) -> bool:
        """Sync user settings to Firestore for faster queries.
        
        This is useful for settings that need to be queried frequently
        or across multiple users.
        
        Args:
            user_id: The user's ID
            
        Returns:
            True if successful, False otherwise
        """
        try:
            settings = await self.get_user_settings(user_id)
            
            # Log what we're getting from GCS
            logger.info(f"=== DEBUG: Settings from GCS for user {user_id} ===")
            logger.info(f"transcriptionProfiles: {len(settings.get('transcriptionProfiles', []))} items")
            logger.info(f"customVocabulary: {len(settings.get('customVocabulary', []))} items")
            logger.info(f"macroPhrases: {len(settings.get('macroPhrases', []))} items")
            logger.info(f"doctorName: {settings.get('doctorName', '')}")
            logger.info(f"medicalSpecialty: {settings.get('medicalSpecialty', '')}")
            
            # Convert to Firestore format (snake_case) and include ALL settings
            firestore_settings = {
                'custom_vocabulary': settings.get('customVocabulary', []),
                'macro_phrases': settings.get('macroPhrases', []),
                'transcription_profiles': settings.get('transcriptionProfiles', []),
                'doctor_name': settings.get('doctorName', ''),
                'medical_specialty': settings.get('medicalSpecialty', ''),
                'doctor_signature': settings.get('doctorSignature'),
                'clinic_logo': settings.get('clinicLogo'),
                'include_logo_on_pdf': settings.get('includeLogoOnPdf', False),
                'office_information': settings.get('officeInformation', []),
                'custom_billing_rules': settings.get('customBillingRules', ''),
                'cpt_fees': settings.get('cptFees', {}),
                'updated_at': datetime.now(timezone.utc)
            }
            
            # Log what we're sending to Firestore
            logger.info(f"=== DEBUG: Sending to Firestore for user {user_id} ===")
            logger.info(f"transcription_profiles: {len(firestore_settings.get('transcription_profiles', []))} items")
            logger.info(f"custom_vocabulary: {len(firestore_settings.get('custom_vocabulary', []))} items")
            logger.info(f"macro_phrases: {len(firestore_settings.get('macro_phrases', []))} items")
            logger.info(f"office_information: type={type(firestore_settings.get('office_information'))}, value={firestore_settings.get('office_information', [])}")
            
            # Save full settings to Firestore
            success = await firestore_client.update_user_settings(
                user_id, 
                firestore_settings
            )
            
            if success:
                logger.info(f"Synced full settings to Firestore for user {user_id}")
                
                # Verify what was actually saved
                saved_doc = await firestore_client.get_user_settings(user_id)
                if saved_doc:
                    logger.info(f"=== DEBUG: Verified in Firestore for user {user_id} ===")
                    logger.info(f"transcription_profiles exists: {'transcription_profiles' in saved_doc}")
                    logger.info(f"transcription_profiles count: {len(saved_doc.get('transcription_profiles', []))}")
                    logger.info(f"doctor_name: {saved_doc.get('doctor_name', 'NOT FOUND')}")
                    logger.info(f"medical_specialty: {saved_doc.get('medical_specialty', 'NOT FOUND')}")
                    logger.info(f"office_information exists: {'office_information' in saved_doc}")
                    logger.info(f"office_information: type={type(saved_doc.get('office_information'))}, value={saved_doc.get('office_information', 'NOT FOUND')}")
            
            return success
            
        except Exception as e:
            logger.error(f"Error syncing to Firestore for user {user_id}: {e}")
            return False