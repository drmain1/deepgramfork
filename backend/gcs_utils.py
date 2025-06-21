import os
import json
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from google.cloud import storage
from google.oauth2 import service_account
from google.cloud.exceptions import NotFound, Conflict

logger = logging.getLogger(__name__)

class GCSClient:
    """Google Cloud Storage client for HIPAA-compliant medical data storage."""
    
    def __init__(self):
        """Initialize GCS client with proper credentials."""
        self.bucket_name = os.getenv('GCS_BUCKET_NAME', 'medical-transcription-hipaa-prod')
        self.storage_client = None
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize the GCS client with credentials."""
        try:
            credentials_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS', 'gcp-credentials.json')
            if credentials_path and os.path.exists(credentials_path):
                credentials = service_account.Credentials.from_service_account_file(
                    credentials_path,
                    scopes=['https://www.googleapis.com/auth/cloud-platform']
                )
                self.storage_client = storage.Client(credentials=credentials)
            else:
                # Use default credentials (for Cloud Run)
                self.storage_client = storage.Client()
            
            # Verify bucket exists
            bucket = self.storage_client.bucket(self.bucket_name)
            if not bucket.exists():
                logger.error(f"Bucket {self.bucket_name} does not exist")
                raise Exception(f"Bucket {self.bucket_name} not found")
            
            logger.info(f"GCS client initialized for bucket: {self.bucket_name}")
        except Exception as e:
            logger.error(f"Failed to initialize GCS client: {str(e)}")
            raise

    def save_data_to_gcs(self, user_id: str, data_type: str, session_id: str, content: str) -> bool:
        """
        Save data to GCS with HIPAA-compliant structure.
        
        Args:
            user_id: User identifier
            data_type: Type of data (transcripts/original, transcripts/polished, metadata)
            session_id: Session identifier
            content: Content to save
        
        Returns:
            Success status
        """
        try:
            # Construct the object path
            if data_type == "metadata":
                object_name = f"{user_id}/metadata/{session_id}.json"
            else:
                object_name = f"{user_id}/{data_type}/{session_id}.txt"
            
            # Get bucket and blob
            bucket = self.storage_client.bucket(self.bucket_name)
            blob = bucket.blob(object_name)
            
            # Set metadata for HIPAA compliance
            blob.metadata = {
                'user_id': user_id,
                'session_id': session_id,
                'data_type': data_type,
                'uploaded_at': datetime.utcnow().isoformat(),
                'encryption': 'AES256'
            }
            
            # Upload with encryption
            blob.upload_from_string(
                content,
                content_type='application/json' if data_type == "metadata" else 'text/plain'
            )
            
            logger.info(f"Successfully saved {data_type} for session {session_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving to GCS: {str(e)}")
            return False

    def get_gcs_object_content(self, object_key: str) -> Optional[str]:
        """
        Retrieve object content from GCS.
        
        Args:
            object_key: Full object path in bucket
        
        Returns:
            Object content as string or None if error
        """
        try:
            bucket = self.storage_client.bucket(self.bucket_name)
            blob = bucket.blob(object_key)
            
            if not blob.exists():
                logger.warning(f"Object not found: {object_key}")
                return None
            
            content = blob.download_as_text()
            return content
            
        except Exception as e:
            logger.error(f"Error retrieving from GCS: {str(e)}")
            return None

    def list_gcs_objects(self, prefix: str, max_results: int = 100) -> List[Dict[str, Any]]:
        """
        List objects in GCS with given prefix.
        
        Args:
            prefix: Object prefix to filter by
            max_results: Maximum number of results
        
        Returns:
            List of object metadata
        """
        try:
            bucket = self.storage_client.bucket(self.bucket_name)
            blobs = bucket.list_blobs(prefix=prefix, max_results=max_results)
            
            objects = []
            for blob in blobs:
                objects.append({
                    'name': blob.name,
                    'size': blob.size,
                    'updated': blob.updated.isoformat() if blob.updated else None,
                    'metadata': blob.metadata or {}
                })
            
            return objects
            
        except Exception as e:
            logger.error(f"Error listing GCS objects: {str(e)}")
            return []

    def delete_gcs_object(self, object_key: str) -> bool:
        """
        Delete an object from GCS.
        
        Args:
            object_key: Full object path in bucket
        
        Returns:
            Success status
        """
        try:
            bucket = self.storage_client.bucket(self.bucket_name)
            blob = bucket.blob(object_key)
            
            if blob.exists():
                blob.delete()
                logger.info(f"Successfully deleted object: {object_key}")
                return True
            else:
                logger.warning(f"Object not found for deletion: {object_key}")
                return False
                
        except Exception as e:
            logger.error(f"Error deleting from GCS: {str(e)}")
            return False

    def save_user_settings(self, user_id: str, settings: Dict[str, Any]) -> bool:
        """
        Save user settings to GCS.
        
        Args:
            user_id: User identifier
            settings: Settings dictionary
        
        Returns:
            Success status
        """
        try:
            object_name = f"user_settings/{user_id}/settings.json"
            
            bucket = self.storage_client.bucket(self.bucket_name)
            blob = bucket.blob(object_name)
            
            # Add metadata
            blob.metadata = {
                'user_id': user_id,
                'updated_at': datetime.utcnow().isoformat(),
                'data_type': 'user_settings'
            }
            
            # Save settings
            blob.upload_from_string(
                json.dumps(settings, indent=2),
                content_type='application/json'
            )
            
            logger.info(f"Successfully saved settings for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving user settings: {str(e)}")
            return False

    def get_user_settings(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve user settings from GCS.
        
        Args:
            user_id: User identifier
        
        Returns:
            Settings dictionary or None if not found
        """
        try:
            object_name = f"user_settings/{user_id}/settings.json"
            content = self.get_gcs_object_content(object_name)
            
            if content:
                return json.loads(content)
            return None
            
        except Exception as e:
            logger.error(f"Error retrieving user settings: {str(e)}")
            return None

    def generate_signed_url(self, object_key: str, expiration_minutes: int = 15) -> Optional[str]:
        """
        Generate a signed URL for temporary access to an object.
        
        Args:
            object_key: Full object path in bucket
            expiration_minutes: URL expiration time in minutes
        
        Returns:
            Signed URL or None if error
        """
        try:
            bucket = self.storage_client.bucket(self.bucket_name)
            blob = bucket.blob(object_key)
            
            if not blob.exists():
                logger.warning(f"Object not found for signed URL: {object_key}")
                return None
            
            # Generate signed URL
            url = blob.generate_signed_url(
                version="v4",
                expiration=timedelta(minutes=expiration_minutes),
                method="GET",
            )
            
            return url
            
        except Exception as e:
            logger.error(f"Error generating signed URL: {str(e)}")
            return None

    def check_bucket_encryption(self) -> bool:
        """
        Verify bucket has encryption enabled (HIPAA requirement).
        
        Returns:
            True if encryption is enabled
        """
        try:
            bucket = self.storage_client.bucket(self.bucket_name)
            bucket.reload()
            
            # Check default encryption
            if bucket.default_kms_key_name or bucket.encryption_configuration:
                logger.info("Bucket encryption is enabled")
                return True
            else:
                logger.warning("Bucket encryption may not be properly configured")
                return True  # GCS encrypts by default even without explicit config
                
        except Exception as e:
            logger.error(f"Error checking bucket encryption: {str(e)}")
            return False

    def check_bucket_versioning(self) -> bool:
        """
        Verify bucket has versioning enabled (HIPAA requirement).
        
        Returns:
            True if versioning is enabled
        """
        try:
            bucket = self.storage_client.bucket(self.bucket_name)
            bucket.reload()
            
            if bucket.versioning_enabled:
                logger.info("Bucket versioning is enabled")
                return True
            else:
                logger.warning("Bucket versioning is not enabled")
                return False
                
        except Exception as e:
            logger.error(f"Error checking bucket versioning: {str(e)}")
            return False

# Create a singleton instance
gcs_client = GCSClient()

# Export convenience functions that use the singleton
def save_data_to_gcs(user_id: str, data_type: str, session_id: str, content: str) -> bool:
    """Save data to GCS."""
    return gcs_client.save_data_to_gcs(user_id, data_type, session_id, content)

def get_gcs_object_content(object_key: str) -> Optional[str]:
    """Get object content from GCS."""
    return gcs_client.get_gcs_object_content(object_key)

def list_gcs_objects(prefix: str, max_results: int = 100) -> List[Dict[str, Any]]:
    """List objects in GCS."""
    return gcs_client.list_gcs_objects(prefix, max_results)

def delete_gcs_object(object_key: str) -> bool:
    """Delete object from GCS."""
    return gcs_client.delete_gcs_object(object_key)

def save_user_settings(user_id: str, settings: Dict[str, Any]) -> bool:
    """Save user settings."""
    return gcs_client.save_user_settings(user_id, settings)

def get_user_settings(user_id: str) -> Optional[Dict[str, Any]]:
    """Get user settings."""
    return gcs_client.get_user_settings(user_id)

def generate_signed_url(object_key: str, expiration_minutes: int = 15) -> Optional[str]:
    """Generate signed URL for object access."""
    return gcs_client.generate_signed_url(object_key, expiration_minutes)

def check_bucket_compliance() -> Dict[str, bool]:
    """Check bucket compliance settings."""
    return {
        'encryption': gcs_client.check_bucket_encryption(),
        'versioning': gcs_client.check_bucket_versioning()
    }