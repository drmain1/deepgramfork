"""Image management router for logos and signatures.
All images are stored in GCS, not as base64 in Firestore.
"""
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from typing import Dict, Any
import logging

from image_handler import ImageHandler
from gcp_auth_middleware import get_user_id

logger = logging.getLogger(__name__)

# This will be injected from main.py
image_handler: ImageHandler = None
DEFAULT_USER_SETTINGS: Dict[str, Any] = None

router = APIRouter(prefix="/api/v1", tags=["images"])

def init_router(handler: ImageHandler, default_settings: Dict[str, Any]):
    """Initialize the router with dependencies."""
    global image_handler, DEFAULT_USER_SETTINGS
    image_handler = handler
    DEFAULT_USER_SETTINGS = default_settings

# Logo endpoints
@router.post("/upload_logo")
async def upload_logo(
    file: UploadFile = File(...),
    current_user_id: str = Depends(get_user_id)
):
    """Upload a clinic logo - stores file in GCS and URL in settings"""
    if not image_handler:
        raise HTTPException(status_code=503, detail="Image handler not initialized")
    
    try:
        # Upload image to GCS
        logo_url = await image_handler.upload_image(current_user_id, file, "logo")
        
        # Update user settings with new logo URL
        await image_handler.update_user_settings_with_image(
            current_user_id, logo_url, "logo", DEFAULT_USER_SETTINGS
        )
        
        return {"logoUrl": logo_url, "message": "Logo uploaded successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading logo for user {current_user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload logo: {str(e)}")

@router.delete("/delete_logo")
async def delete_logo(current_user_id: str = Depends(get_user_id)):
    """Delete clinic logo from GCS and user settings"""
    if not image_handler:
        raise HTTPException(status_code=503, detail="Image handler not initialized")
    
    try:
        await image_handler.delete_image(current_user_id, "logo", DEFAULT_USER_SETTINGS)
        return {"message": "Logo deleted successfully"}
        
    except Exception as e:
        logger.error(f"Error deleting logo for user {current_user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete logo: {str(e)}")

@router.post("/migrate_logo")
async def migrate_logo(current_user_id: str = Depends(get_user_id)):
    """Migrate base64 logo to GCS file storage"""
    if not image_handler:
        raise HTTPException(status_code=503, detail="Image handler not initialized")
    
    try:
        return await image_handler.migrate_base64_to_gcs(
            current_user_id, "logo", DEFAULT_USER_SETTINGS
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error migrating logo for user {current_user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to migrate logo: {str(e)}")

# Signature endpoints
@router.post("/upload_signature")
async def upload_signature(
    file: UploadFile = File(...),
    current_user_id: str = Depends(get_user_id)
):
    """Upload a signature - stores file in GCS and URL in settings"""
    if not image_handler:
        raise HTTPException(status_code=503, detail="Image handler not initialized")
    
    try:
        # Upload image to GCS
        signature_url = await image_handler.upload_image(current_user_id, file, "signature")
        
        # Update user settings with new signature URL
        await image_handler.update_user_settings_with_image(
            current_user_id, signature_url, "signature", DEFAULT_USER_SETTINGS
        )
        
        return {"signatureUrl": signature_url, "message": "Signature uploaded successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading signature for user {current_user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload signature: {str(e)}")

@router.delete("/delete_signature")
async def delete_signature(current_user_id: str = Depends(get_user_id)):
    """Delete signature from GCS and user settings"""
    if not image_handler:
        raise HTTPException(status_code=503, detail="Image handler not initialized")
    
    try:
        await image_handler.delete_image(current_user_id, "signature", DEFAULT_USER_SETTINGS)
        return {"message": "Signature deleted successfully"}
        
    except Exception as e:
        logger.error(f"Error deleting signature for user {current_user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete signature: {str(e)}")

@router.post("/migrate_signature")
async def migrate_signature(current_user_id: str = Depends(get_user_id)):
    """Migrate base64 signature to GCS file storage"""
    if not image_handler:
        raise HTTPException(status_code=503, detail="Image handler not initialized")
    
    try:
        return await image_handler.migrate_base64_to_gcs(
            current_user_id, "signature", DEFAULT_USER_SETTINGS
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error migrating signature for user {current_user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to migrate signature: {str(e)}")

# Debug endpoint (keep for now, can be removed in production)
@router.get("/debug_logo/{user_id}")
async def debug_logo(
    user_id: str,
    current_user_id: str = Depends(get_user_id)
):
    """Debug endpoint to check logo status"""
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    if not image_handler or not image_handler.gcs_client:
        raise HTTPException(status_code=503, detail="GCS client not initialized")
    
    try:
        settings_key = f"{user_id}/settings/user_settings.json"
        settings_content = image_handler.gcs_client.get_gcs_object_content(settings_key)
        
        if settings_content:
            import json
            settings = json.loads(settings_content)
            return {
                "clinicLogo": settings.get('clinicLogo'),
                "includeLogoOnPdf": settings.get('includeLogoOnPdf'),
                "hasLogo": bool(settings.get('clinicLogo'))
            }
        else:
            return {"error": "No settings found", "clinicLogo": None}
    except Exception as e:
        logger.error(f"Error in debug_logo: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching logo info: {str(e)}")