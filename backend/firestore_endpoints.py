"""
Updated API endpoints that use Firestore for metadata instead of GCS.
These will replace the existing endpoints in main.py.
"""

from fastapi import HTTPException, Depends, Path, Request
from typing import List, Optional
import logging
from datetime import datetime, timezone, timedelta

from firestore_client import firestore_client
from firestore_models import TranscriptStatus
from gcs_utils import GCSClient
from gcp_auth_middleware import get_user_id
from audit_logger import AuditLogger
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Keep the same response models for compatibility
class RecordingInfo(BaseModel):
    id: str # session_id
    name: str # Derived name, e.g., from patient context or session title
    date: datetime # Last modified date of the metadata file or a date from metadata
    status: str = "saved" # Can be "saved", "draft", "pending", "saving", "failed"
    gcsPathTranscript: Optional[str] = None
    gcsPathPolished: Optional[str] = None
    gcsPathMetadata: Optional[str] = None # GCS key for the session_metadata.json file itself, now optional
    patientContext: Optional[str] = None
    encounterType: Optional[str] = None # Or selected profile name
    llmTemplateName: Optional[str] = None # Name of the LLM template/profile used
    location: Optional[str] = None
    durationSeconds: Optional[int] = None
    transcript: Optional[str] = None
    profileId: Optional[str] = None

async def get_user_recordings_firestore(
    user_id: str = Path(..., description="User's unique identifier"),
    current_user_id: str = Depends(get_user_id),
    request: Request = None
):
    """
    Get user recordings using Firestore for metadata queries.
    Much faster than scanning GCS objects.
    """
    # Log PHI access for HIPAA compliance
    AuditLogger.log_data_access(
        user_id=current_user_id,
        operation="READ",
        data_type="recordings_list",
        resource_id=f"user_{user_id}_recordings",
        request=request,
        success=True
    )
    
    # Verify that the user_id matches the authenticated user
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="You can only access your own recordings")
    
    logger.info(f"Fetching recordings for user {user_id} from Firestore")
    
    try:
        # Get recent transcripts from Firestore (last 15 days by default)
        transcripts = await firestore_client.get_recent_transcripts(user_id, days=15)
        
        recordings_info = []
        for transcript in transcripts:
            # Parse the date string
            date_str = transcript.get('updated_at', transcript.get('created_at', ''))
            try:
                date_obj = datetime.fromisoformat(date_str.replace('Z', '+00:00')) if date_str else datetime.now(timezone.utc)
            except:
                date_obj = datetime.now(timezone.utc)
            
            # Convert Firestore document to RecordingInfo
            recording = RecordingInfo(
                id=transcript['session_id'],
                name=transcript.get('patient_name', 'Unknown Patient'),
                date=date_obj,
                status=transcript.get('status', 'saved'),
                gcsPathTranscript=transcript.get('gcs_path_original'),
                gcsPathPolished=transcript.get('gcs_path_polished'),
                gcsPathMetadata=f"{user_id}/metadata/{transcript['session_id']}.txt",
                patientContext=transcript.get('patient_context'),
                encounterType=transcript.get('encounter_type'),
                llmTemplateName=transcript.get('llm_template'),
                location=transcript.get('location'),
                durationSeconds=transcript.get('duration_seconds'),
                profileId=transcript.get('llm_template_id')
            )
            recordings_info.append(recording)
        
        logger.info(f"Found {len(recordings_info)} recordings for user {user_id}")
        return recordings_info
        
    except Exception as e:
        logger.error(f"Error fetching recordings from Firestore: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch recordings")

async def get_user_settings_firestore(
    user_id: str = Path(..., description="User's unique identifier"),
    current_user_id: str = Depends(get_user_id),
    request: Request = None
):
    """
    Get user settings from Firestore instead of GCS.
    """
    # Log PHI access for HIPAA compliance
    AuditLogger.log_data_access(
        user_id=current_user_id,
        operation="READ",
        data_type="user_settings",
        resource_id=f"user_{user_id}_settings",
        request=request,
        success=True
    )
    
    # Verify authorization
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="You can only access your own settings")
    
    logger.info(f"Fetching settings for user {user_id} from Firestore")
    
    try:
        # Get user document from Firestore
        user_doc = await firestore_client.get_user_settings(user_id)
        
        if not user_doc:
            # Create default user if doesn't exist
            user_doc = await firestore_client.get_or_create_user(
                user_id=user_id,
                email=f"{user_id}@user.local"  # Placeholder, should be updated with real email
            )
        
        # Log what we retrieved for debugging
        logger.info(f"Retrieved user_doc from Firestore: {user_doc}")
        
        # Convert to expected format for frontend
        settings = {
            "customVocabulary": user_doc.get('custom_vocabulary', []),
            "macroPhrases": user_doc.get('macro_phrases', {}),
            "transcriptionProfiles": user_doc.get('transcription_profiles', []),
            "doctorName": user_doc.get('doctor_name', ''),
            "medicalSpecialty": user_doc.get('medical_specialty', ''),
            "doctorSignature": user_doc.get('doctor_signature'),
            "clinicLogo": user_doc.get('clinic_logo'),
            "includeLogoOnPdf": user_doc.get('include_logo_on_pdf', False),
            "officeInformation": user_doc.get('office_information', [])
        }
        
        logger.info(f"Returning settings to frontend: {settings}")
        
        return settings
        
    except Exception as e:
        logger.error(f"Error fetching settings from Firestore: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch settings")

async def update_user_settings_firestore(
    user_id: str,
    settings_data: dict,
    current_user_id: str = Depends(get_user_id),
    request: Request = None
):
    """
    Update user settings in Firestore.
    """
    # Log PHI access for HIPAA compliance
    AuditLogger.log_data_access(
        user_id=current_user_id,
        operation="UPDATE",
        data_type="user_settings",
        resource_id=f"user_{user_id}_settings",
        request=request,
        success=True
    )
    
    # Verify authorization
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="You can only update your own settings")
    
    logger.info(f"Updating settings for user {user_id} in Firestore")
    
    try:
        # Map frontend format to Firestore format
        # Convert macroPhrases list back to dict format for storage
        macro_phrases = settings_data.get('macroPhrases', [])
        if isinstance(macro_phrases, list):
            # Convert list format to dict
            macro_dict = {item.get('shortcut', ''): item.get('expansion', '') for item in macro_phrases if isinstance(item, dict)}
        else:
            macro_dict = macro_phrases if isinstance(macro_phrases, dict) else {}
            
        firestore_settings = {
            'custom_vocabulary': settings_data.get('customVocabulary', []),
            'macro_phrases': macro_dict,
            'transcription_profiles': settings_data.get('transcriptionProfiles', []),
            'doctor_name': settings_data.get('doctorName', ''),
            'medical_specialty': settings_data.get('medicalSpecialty', ''),
            'doctor_signature': settings_data.get('doctorSignature'),
            'clinic_logo': settings_data.get('clinicLogo'),
            'include_logo_on_pdf': settings_data.get('includeLogoOnPdf', False),
            'office_information': settings_data.get('officeInformation', [])
        }
        
        # Log what we're saving for debugging
        logger.info(f"Saving Firestore settings: {firestore_settings}")
        
        # Update in Firestore
        success = await firestore_client.update_user_settings(user_id, firestore_settings)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update settings")
        
        return {"message": "Settings updated successfully"}
        
    except Exception as e:
        logger.error(f"Error updating settings in Firestore: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update settings")

async def save_session_data_firestore(
    request_data: dict,
    current_user_id: str = Depends(get_user_id),
    request: Request = None,
    gcs_client: GCSClient = None
):
    """
    Save session data using Firestore for metadata and GCS for actual files.
    """
    session_id = request_data.get("session_id")
    user_id = request_data.get("user_id")
    
    # Log PHI access
    AuditLogger.log_data_access(
        user_id=current_user_id,
        operation="CREATE",
        data_type="recording_session",
        resource_id=session_id,
        request=request,
        success=True
    )
    
    # Verify authorization
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="You can only save your own recordings")
    
    logger.info(f"Saving session {session_id} for user {user_id}")
    
    try:
        # Create transcript document in Firestore
        transcript_data = {
            'user_id': user_id,
            'session_id': session_id,
            'status': TranscriptStatus.PROCESSING,
            'patient_name': request_data.get('patient_name', 'Unknown Patient'),
            'patient_context': request_data.get('patient_context'),
            'encounter_type': request_data.get('encounter_type'),
            'location': request_data.get('location'),
            'llm_template': request_data.get('llm_template'),
            'llm_template_id': request_data.get('llm_template_id'),
            'duration_seconds': request_data.get('duration')
        }
        
        # Create in Firestore
        await firestore_client.create_transcript(transcript_data)
        
        # Save actual transcript content to GCS
        saved_paths = {}
        
        # Save original transcript
        if request_data.get('transcript'):
            success = gcs_client.save_data_to_gcs(
                user_id=user_id,
                data_type="transcripts/original",
                session_id=session_id,
                content=request_data['transcript']
            )
            if success:
                saved_paths['original_transcript'] = f"{user_id}/transcripts/original/{session_id}.txt"
        
        # Process with AI if template provided
        if request_data.get('llm_template'):
            # Polish transcript logic here...
            # Update paths in Firestore after polishing
            pass
        
        # Update Firestore with GCS paths
        await firestore_client.update_transcript(session_id, {
            'gcs_path_original': saved_paths.get('original_transcript'),
            'status': TranscriptStatus.COMPLETED
        })
        
        # Delete draft if exists
        draft_key = f"{user_id}/drafts/{session_id}.txt"
        gcs_client.delete_gcs_object(draft_key)
        
        return {
            "message": "Session data saved successfully",
            "session_id": session_id,
            "saved_paths": saved_paths
        }
        
    except Exception as e:
        logger.error(f"Error saving session data: {str(e)}")
        # Update status to error in Firestore
        await firestore_client.update_transcript(session_id, {
            'status': TranscriptStatus.ERROR,
            'error_message': str(e)
        })
        raise HTTPException(status_code=500, detail=f"Failed to save session data: {str(e)}")

async def delete_recording_firestore(
    user_id: str,
    recording_id: str,
    current_user_id: str = Depends(get_user_id),
    request: Request = None,
    gcs_client: GCSClient = None
):
    """
    Delete a recording using Firestore for metadata and GCS for files.
    """
    # Log PHI access
    AuditLogger.log_data_access(
        user_id=current_user_id,
        operation="DELETE",
        data_type="recording",
        resource_id=recording_id,
        request=request,
        success=True
    )
    
    # Verify authorization
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="You can only delete your own recordings")
    
    logger.info(f"Deleting recording {recording_id} for user {user_id}")
    
    try:
        # Get transcript metadata from Firestore
        transcript = await firestore_client.get_transcript(recording_id)
        
        if not transcript:
            raise HTTPException(status_code=404, detail="Recording not found")
        
        if transcript['user_id'] != user_id:
            raise HTTPException(status_code=403, detail="Unauthorized")
        
        # Delete files from GCS
        deleted_files = []
        
        # Delete original transcript
        if transcript.get('gcs_path_original'):
            if gcs_client.delete_gcs_object(transcript['gcs_path_original']):
                deleted_files.append(transcript['gcs_path_original'])
        
        # Delete polished transcript
        if transcript.get('gcs_path_polished'):
            if gcs_client.delete_gcs_object(transcript['gcs_path_polished']):
                deleted_files.append(transcript['gcs_path_polished'])
        
        # Delete from Firestore
        await firestore_client.delete_transcript(recording_id)
        
        logger.info(f"Successfully deleted recording {recording_id} and {len(deleted_files)} files")
        return {"message": "Recording deleted successfully", "deleted_files": deleted_files}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting recording: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete recording")