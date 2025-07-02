"""Unified image handling module for logos and signatures.
All images are stored in Google Cloud Storage, not as base64 in Firestore.
"""
import time
import json
import base64
from typing import Optional, Tuple, Dict, Any
from fastapi import HTTPException, UploadFile
from gcs_utils import GCSClient
import logging

logger = logging.getLogger(__name__)

class ImageHandler:
    """Handles image uploads, migrations, and deletions for logos and signatures."""
    
    # Configuration
    ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/jpg"]
    MAX_LOGO_SIZE = 5 * 1024 * 1024  # 5MB
    MAX_SIGNATURE_SIZE = 2 * 1024 * 1024  # 2MB
    
    EXT_TO_MIME = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp'
    }
    
    MIME_TO_EXT = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp'
    }
    
    def __init__(self, gcs_client: GCSClient):
        self.gcs_client = gcs_client
        
    async def validate_and_prepare_image(
        self, 
        file: UploadFile, 
        image_type: str
    ) -> Tuple[bytes, str, str]:
        """Validate image file and prepare for upload.
        
        Args:
            file: The uploaded file
            image_type: Either 'logo' or 'signature'
            
        Returns:
            Tuple of (file_contents, content_type, file_extension)
        """
        # Determine max size based on image type
        max_size = self.MAX_LOGO_SIZE if image_type == 'logo' else self.MAX_SIGNATURE_SIZE
        size_limit_mb = 5 if image_type == 'logo' else 2
        
        # Debug logging
        logger.info(f"{image_type.capitalize()} upload - File: {file.filename}, "
                   f"Content-Type: {file.content_type}, Size: {file.size}")
        
        # Validate content type
        content_type = file.content_type
        if not content_type or content_type not in self.ALLOWED_IMAGE_TYPES:
            # Try to infer from filename
            file_ext = file.filename.lower().split('.')[-1] if '.' in file.filename else ''
            
            if file_ext in self.EXT_TO_MIME:
                content_type = self.EXT_TO_MIME[file_ext]
                logger.info(f"Inferred content type from extension: {content_type}")
            else:
                logger.error(f"Invalid content type: {content_type}")
                raise HTTPException(
                    status_code=400, 
                    detail=f"Invalid file type: {content_type}. Allowed types: {self.ALLOWED_IMAGE_TYPES}"
                )
        
        # Read and validate file size
        contents = await file.read()
        if len(contents) > max_size:
            raise HTTPException(
                status_code=400, 
                detail=f"File size exceeds {size_limit_mb}MB limit"
            )
            
        # Get file extension
        file_ext = file.filename.lower().split('.')[-1] if '.' in file.filename else 'png'
        
        return contents, content_type, file_ext
    
    async def upload_image(
        self,
        user_id: str,
        file: UploadFile,
        image_type: str  # 'logo' or 'signature'
    ) -> str:
        """Upload an image to GCS and return the public URL.
        
        Args:
            user_id: The user's ID
            file: The uploaded file
            image_type: Either 'logo' or 'signature'
            
        Returns:
            The public URL of the uploaded image
        """
        # Validate and prepare the image
        contents, content_type, file_ext = await self.validate_and_prepare_image(file, image_type)
        
        # Generate unique filename
        timestamp = int(time.time() * 1000)
        filename = f"{image_type}_{timestamp}.{file_ext}"
        data_type = f"{image_type}s"  # 'logos' or 'signatures'
        
        # Upload to GCS
        success = self.gcs_client.save_data_to_gcs(
            user_id=user_id,
            data_type=data_type,
            session_id=filename,
            content=contents,
            content_type=content_type
        )
        
        if not success:
            raise Exception(f"Failed to upload {image_type} to GCS")
        
        # Generate public URL
        image_key = f"{user_id}/{data_type}/{filename}"
        image_url = f"https://storage.googleapis.com/{self.gcs_client.bucket_name}/{image_key}"
        logger.info(f"{image_type.capitalize()} uploaded to GCS: {image_url}")
        
        return image_url
    
    async def update_user_settings_with_image(
        self,
        user_id: str,
        image_url: str,
        image_type: str,  # 'logo' or 'signature'
        default_settings: Dict[str, Any]
    ) -> None:
        """Update user settings with new image URL and delete old image if exists.
        
        Args:
            user_id: The user's ID
            image_url: The new image URL
            image_type: Either 'logo' or 'signature'
            default_settings: Default settings to use if none exist
        """
        # Get current settings from GCS
        settings_key = f"{user_id}/settings/user_settings.json"
        settings_content = self.gcs_client.get_gcs_object_content(settings_key)
        
        if settings_content:
            current_settings = json.loads(settings_content)
        else:
            current_settings = default_settings.copy()
        
        # Determine the settings field name
        field_name = 'clinicLogo' if image_type == 'logo' else 'doctorSignature'
        
        # Check if there's an old image to delete
        old_image_url = current_settings.get(field_name)
        if old_image_url and old_image_url.startswith('https://storage.googleapis.com/'):
            try:
                old_key = old_image_url.replace(
                    f"https://storage.googleapis.com/{self.gcs_client.bucket_name}/", ""
                )
                self.gcs_client.delete_gcs_object(old_key)
                logger.info(f"Deleted old {image_type}: {old_key}")
            except Exception as e:
                logger.warning(f"Failed to delete old {image_type}: {e}")
        
        # Update with new image URL
        current_settings[field_name] = image_url
        
        # Save updated settings to GCS
        success = self.gcs_client.save_data_to_gcs(
            user_id=user_id,
            data_type="settings",
            session_id="user_settings",
            content=json.dumps(current_settings)
        )
        
        if not success:
            raise Exception("Failed to save settings to GCS")
    
    async def delete_image(
        self,
        user_id: str,
        image_type: str,  # 'logo' or 'signature'
        default_settings: Dict[str, Any]
    ) -> None:
        """Delete an image from GCS and update user settings.
        
        Args:
            user_id: The user's ID
            image_type: Either 'logo' or 'signature'
            default_settings: Default settings to use if none exist
        """
        # Get current settings from GCS
        settings_key = f"{user_id}/settings/user_settings.json"
        settings_content = self.gcs_client.get_gcs_object_content(settings_key)
        
        if settings_content:
            current_settings = json.loads(settings_content)
        else:
            current_settings = default_settings.copy()
        
        # Determine the settings field name
        field_name = 'clinicLogo' if image_type == 'logo' else 'doctorSignature'
        
        # Delete the image file from GCS if it exists
        image_url = current_settings.get(field_name)
        if image_url and image_url.startswith('https://storage.googleapis.com/'):
            try:
                # Extract the key from the URL
                image_key = image_url.replace(
                    f"https://storage.googleapis.com/{self.gcs_client.bucket_name}/", ""
                )
                deleted = self.gcs_client.delete_gcs_object(image_key)
                if deleted:
                    logger.info(f"Deleted {image_type} file from GCS: {image_key}")
                else:
                    logger.info(f"{image_type.capitalize()} file not found in GCS: {image_key}")
            except Exception as e:
                logger.warning(f"Failed to delete {image_type} file from GCS: {e}")
        
        # Remove image URL from settings
        current_settings[field_name] = None
        
        # For logos, also reset the includeLogoOnPdf flag
        if image_type == 'logo':
            current_settings['includeLogoOnPdf'] = False
        
        # Save updated settings to GCS
        success = self.gcs_client.save_data_to_gcs(
            user_id=user_id,
            data_type="settings",
            session_id="user_settings",
            content=json.dumps(current_settings)
        )
        
        if not success:
            raise Exception("Failed to save settings to GCS")
    
    async def migrate_base64_to_gcs(
        self,
        user_id: str,
        image_type: str,  # 'logo' or 'signature'
        default_settings: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Migrate base64 image data to GCS file storage.
        
        This function handles the migration from old base64 storage (in settings)
        to proper GCS file storage.
        
        Args:
            user_id: The user's ID
            image_type: Either 'logo' or 'signature'
            default_settings: Default settings to use if none exist
            
        Returns:
            Migration result with status and new URL if migrated
        """
        # Get current settings
        settings_key = f"{user_id}/settings/user_settings.json"
        settings_content = self.gcs_client.get_gcs_object_content(settings_key)
        
        if not settings_content:
            return {"message": "No settings found", "migrated": False}
        
        current_settings = json.loads(settings_content)
        field_name = 'clinicLogo' if image_type == 'logo' else 'doctorSignature'
        image_data = current_settings.get(field_name)
        
        # Check if image exists and needs migration
        if not image_data:
            return {"message": f"No {image_type} found", "migrated": False}
        
        if image_data.startswith('https://'):
            return {"message": f"{image_type.capitalize()} already migrated to GCS", "migrated": False}
        
        if not image_data.startswith('data:'):
            return {"message": f"Invalid {image_type} format", "migrated": False}
        
        # Parse base64 data URL
        try:
            # Format: data:image/png;base64,iVBORw0KGgo...
            header, base64_data = image_data.split(',', 1)
            mime_type = header.split(':')[1].split(';')[0]
            
            # Decode base64
            decoded_image = base64.b64decode(base64_data)
            
            # Determine file extension
            file_ext = self.MIME_TO_EXT.get(mime_type, 'png')
            
            # Generate filename
            timestamp = int(time.time() * 1000)
            filename = f"{image_type}_migrated_{timestamp}.{file_ext}"
            data_type = f"{image_type}s"
            
            # Upload to GCS
            success = self.gcs_client.save_data_to_gcs(
                user_id=user_id,
                data_type=data_type,
                session_id=filename,
                content=decoded_image,
                content_type=mime_type
            )
            
            if not success:
                raise Exception(f"Failed to upload migrated {image_type} to GCS")
            
            # Generate public URL
            image_key = f"{user_id}/{data_type}/{filename}"
            image_url = f"https://storage.googleapis.com/{self.gcs_client.bucket_name}/{image_key}"
            
            # Update settings with new URL
            current_settings[field_name] = image_url
            
            # Save updated settings
            success = self.gcs_client.save_data_to_gcs(
                user_id=user_id,
                data_type="settings",
                session_id="user_settings",
                content=json.dumps(current_settings)
            )
            
            if not success:
                raise Exception("Failed to save updated settings")
            
            logger.info(f"Successfully migrated {image_type} for user {user_id} to {image_url}")
            
            result = {
                "message": f"{image_type.capitalize()} migrated successfully",
                "migrated": True
            }
            result[f"{image_type}Url"] = image_url
            
            return result
            
        except Exception as e:
            logger.error(f"Error parsing base64 data: {e}")
            raise HTTPException(status_code=400, detail=f"Failed to parse base64 data: {str(e)}")