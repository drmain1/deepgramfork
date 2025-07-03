"""
Updated API endpoints that use Firestore for metadata instead of GCS.
These will replace the existing endpoints in main.py.
"""

from fastapi import HTTPException, Depends, Path, Request
from typing import List, Optional
import logging
import json
from datetime import datetime, timezone, timedelta
import asyncio

from firestore_client import firestore_client
from firestore_models import TranscriptStatus
from gcs_utils import GCSClient
from gcp_auth_middleware import get_user_id
from audit_logger import AuditLogger
from pydantic import BaseModel
from gcp_utils import polish_transcript_with_gemini

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
    polishedTranscript: Optional[str] = None
    profileId: Optional[str] = None
    patientId: Optional[str] = None

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
        # Get recent transcripts from Firestore (last 365 days to support dictation mode)
        transcripts = await firestore_client.get_recent_transcripts(user_id, days=365)
        
        recordings_info = []
        
        # Debug log first transcript to see available fields
        if transcripts:
            logger.info(f"[DICTATION DEBUG] First transcript fields: {list(transcripts[0].keys())}")
            logger.info(f"[DICTATION DEBUG] First transcript is_dictation: {transcripts[0].get('is_dictation')}")
        
        for transcript in transcripts:
            # Parse the date string - use created_at as primary timestamp (when recording was made)
            # Only fall back to updated_at if created_at is missing
            date_str = transcript.get('created_at', transcript.get('updated_at', ''))
            try:
                date_obj = datetime.fromisoformat(date_str.replace('Z', '+00:00')) if date_str else datetime.now(timezone.utc)
            except:
                date_obj = datetime.now(timezone.utc)
            
            # For dictation mode recordings, use the date_of_service instead of created_at
            if transcript.get('date_of_service'):
                logger.info(f"[DICTATION DEBUG] Recording {transcript.get('session_id')} has date_of_service: {transcript.get('date_of_service')}, created_at: {date_str}")
                try:
                    # Parse date_of_service and use it as the recording date
                    service_date_str = transcript.get('date_of_service')
                    date_obj = datetime.fromisoformat(service_date_str.replace('Z', '+00:00')) if service_date_str else date_obj
                    logger.info(f"[DICTATION DEBUG] Using date_of_service for date field: {date_obj}")
                except Exception as e:
                    logger.error(f"[DICTATION DEBUG] Failed to parse date_of_service: {e}")
                    # Fall back to created_at if parsing fails
            
            # Convert Firestore document to RecordingInfo
            # Ensure we always get a string, never None
            transcript_content = transcript.get('transcript_original') or ''
            polished_content = transcript.get('transcript_polished') or ''
            
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
                profileId=transcript.get('llm_template_id'),
                patientId=transcript.get('patient_id'),
                # Include transcript content directly
                transcript=transcript_content,
                polishedTranscript=polished_content,
                # Check for dictation mode - fallback to checking date_of_service if is_dictation not set
                isDictation=transcript.get('is_dictation', bool(transcript.get('date_of_service')))
            )
            
            # Debug logging - transcript_content is now guaranteed to be a string
            logger.info(f"Recording {recording.id}: has transcript content: {bool(transcript_content)}, length: {len(transcript_content)}, "
                       f"has polished: {bool(polished_content)}")
            
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
            "officeInformation": user_doc.get('office_information', []),
            "customBillingRules": user_doc.get('custom_billing_rules', ''),
            "cptFees": user_doc.get('cpt_fees', {})
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
            'office_information': settings_data.get('officeInformation', []),
            'custom_billing_rules': settings_data.get('customBillingRules', ''),
            'cpt_fees': settings_data.get('cptFees', {})
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
    
    # Log the raw request data to debug date_of_service
    logger.info(f"Request data keys: {list(request_data.keys())}")
    logger.info(f"Full request data: {json.dumps(request_data, indent=2)}")
    if 'date_of_service' in request_data:
        logger.info(f"date_of_service value: '{request_data['date_of_service']}' (type: {type(request_data['date_of_service'])})")
    else:
        logger.warning("date_of_service NOT found in request data!")
    
    try:
        # Parse created_at from session_id if it's a timestamp format
        created_at = datetime.now(timezone.utc)
        logger.info(f"Processing session_id: {session_id} (length: {len(session_id)})")
        
        # Check if date_of_service is provided (dictation mode)
        date_of_service = request_data.get('date_of_service')
        original_date_of_service = date_of_service  # Preserve original value
        logger.info(f"[DICTATION DEBUG] Date of service from request: {date_of_service}")
        logger.info(f"[DICTATION DEBUG] Full request data keys: {list(request_data.keys())}")
        logger.info(f"[DICTATION DEBUG] Transcript field present: {'final_transcript_text' in request_data}")
        logger.info(f"[DICTATION DEBUG] Transcript length: {len(request_data.get('final_transcript_text', ''))}")
        if date_of_service:
            try:
                logger.info(f"[DICTATION DEBUG] Processing date_of_service: {date_of_service}")
                # For dictation mode, use the provided service date as created_at
                # The date_of_service is in the user's local date (YYYY-MM-DD)
                # We need to treat it as a date in the user's timezone, not UTC
                
                # Parse the date string
                service_date = datetime.strptime(date_of_service, "%Y-%m-%d")
                logger.info(f"[DICTATION DEBUG] Parsed service_date: {service_date}")
                
                # Preserve the time portion from session_id if available
                if len(session_id) >= 14 and session_id[8:14].isdigit():
                    time_part = session_id[8:14]  # HHMMSS portion
                    # Create datetime with the service date and time from session_id
                    # This represents the user's local time when they created the dictation
                    local_datetime = datetime.strptime(f"{date_of_service} {time_part[:2]}:{time_part[2:4]}:{time_part[4:6]}", "%Y-%m-%d %H:%M:%S")
                else:
                    # Use the service date with current time
                    now = datetime.now()
                    local_datetime = service_date.replace(hour=now.hour, 
                                                         minute=now.minute,
                                                         second=now.second)
                
                # IMPORTANT: We store this as if it were UTC, but it actually represents
                # the user's local time. This ensures that when the frontend displays it,
                # it shows the correct date without timezone shifting.
                # This is a deliberate choice to handle the date_of_service correctly.
                created_at = local_datetime.replace(tzinfo=timezone.utc)
                
                logger.info(f"[DICTATION DEBUG] Final created_at before saving: {created_at.isoformat()}")
                logger.info(f"[DICTATION DEBUG] Created_at type: {type(created_at)}")
                logger.info(f"Dictation mode: Using date_of_service {date_of_service}, created_at: {created_at.isoformat()} (stored as UTC but represents user's local time)")
            except ValueError as e:
                logger.warning(f"Could not parse date_of_service: {date_of_service}, error: {e}")
                # Fall back to parsing from session_id
                date_of_service = None
        
        # If no date_of_service, try to parse from session_id
        if not date_of_service and len(session_id) >= 14 and session_id[:14].isdigit():
            try:
                # Session ID format: YYYYMMDDHHMMSSxxxxxx (generated in UTC)
                timestamp_part = session_id[:14]
                logger.info(f"Attempting to parse timestamp from: {timestamp_part}")
                created_at = datetime.strptime(timestamp_part, "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)
                logger.info(f"Successfully parsed recording start time from session_id: {created_at.isoformat()}")
            except ValueError as e:
                logger.warning(f"Could not parse timestamp from session_id: {session_id}, error: {e}")
        elif not date_of_service:
            logger.warning(f"Session ID format not recognized for timestamp parsing: {session_id}")
        
        # Create transcript document in Firestore
        # Log patient_id for debugging
        patient_id = request_data.get('patient_id')
        logger.info(f"Saving session with patient_id: {patient_id}, patient_name: {request_data.get('patient_name')}")
        
        # Handle evaluation type
        evaluation_type = request_data.get('evaluation_type')
        initial_evaluation_id = request_data.get('initial_evaluation_id')
        previous_findings = request_data.get('previous_findings')
        
        # Auto-detect evaluation type if not provided
        if not evaluation_type and request_data.get('encounter_type'):
            encounter_type_lower = request_data.get('encounter_type', '').lower()
            if 'initial' in encounter_type_lower or 'new patient' in encounter_type_lower:
                evaluation_type = 'initial'
            elif 'follow' in encounter_type_lower:
                evaluation_type = 'follow_up'
            elif 're-eval' in encounter_type_lower or 'reeval' in encounter_type_lower:
                evaluation_type = 're_evaluation'
        
        transcript_data = {
            'user_id': user_id,
            'session_id': session_id,
            'status': TranscriptStatus.PROCESSING,
            'patient_name': request_data.get('patient_name', 'Unknown Patient'),
            'patient_id': patient_id,  # Add patient profile reference
            'patient_context': request_data.get('patient_context'),
            'encounter_type': request_data.get('encounter_type'),
            'location': request_data.get('location'),
            'llm_template': request_data.get('llm_template'),
            'llm_template_id': request_data.get('llm_template_id'),
            'duration_seconds': request_data.get('duration'),
            # Use parsed created_at from session_id or current time - pass as datetime object
            'created_at': created_at,  # Pass as datetime object, not string
            'updated_at': datetime.now(timezone.utc),  # Pass as datetime object, not string
            'date_of_service': original_date_of_service,  # Store the original service date if provided
            'is_dictation': bool(original_date_of_service),  # Flag to identify dictation mode transcripts
            'evaluation_type': evaluation_type,
            'initial_evaluation_id': initial_evaluation_id,
            'positive_findings': previous_findings
        }
        
        logger.info(f"[DICTATION DEBUG] Saving transcript with created_at: {created_at.isoformat()}, is_dictation: {bool(original_date_of_service)}")
        
        # Check if transcript already exists
        existing_transcript = await firestore_client.get_transcript(session_id)
        
        if existing_transcript:
            # Update existing transcript
            update_data = {
                'patient_name': transcript_data['patient_name'],
                'patient_id': transcript_data.get('patient_id'),
                'patient_context': transcript_data.get('patient_context'),
                'encounter_type': transcript_data.get('encounter_type'),
                'location': transcript_data.get('location'),
                'llm_template': transcript_data.get('llm_template'),
                'llm_template_id': transcript_data.get('llm_template_id'),
                'duration_seconds': transcript_data.get('duration_seconds'),
                'status': transcript_data['status'],
                'evaluation_type': transcript_data.get('evaluation_type'),
                'initial_evaluation_id': transcript_data.get('initial_evaluation_id'),
                'positive_findings': transcript_data.get('positive_findings'),
                'date_of_service': transcript_data.get('date_of_service'),
                'is_dictation': transcript_data.get('is_dictation'),
                'updated_at': datetime.now(timezone.utc)  # Pass as datetime object
            }
            
            # For dictation mode, always update created_at with the service date
            if original_date_of_service:
                update_data['created_at'] = created_at  # Pass as datetime object, not string
                logger.info(f"Dictation mode: Updating created_at to {created_at.isoformat()} for session {session_id}")
            else:
                # For regular sessions, only update created_at if we have a better date
                existing_created_at = existing_transcript.get('created_at')
                if existing_created_at:
                    try:
                        existing_date = datetime.fromisoformat(existing_created_at.replace('Z', '+00:00'))
                        # Only update created_at if our parsed date is earlier (more accurate)
                        if created_at < existing_date:
                            logger.info(f"Updating created_at from {existing_created_at} to {created_at.isoformat()}")
                            update_data['created_at'] = created_at  # Pass as datetime object
                    except Exception as e:
                        logger.warning(f"Error comparing dates: {e}")
            
            # Update the transcript
            await firestore_client.update_transcript(session_id, update_data)
        else:
            # Create new transcript
            logger.info(f"[DICTATION DEBUG] Creating new transcript with created_at type: {type(transcript_data['created_at'])}, value: {transcript_data['created_at']}")
            await firestore_client.create_transcript(transcript_data)
        
        # Get transcript content (support both field names for compatibility)
        transcript_content = request_data.get('transcript') or request_data.get('final_transcript_text', '')
        
        # Ensure transcript_content is never None
        if transcript_content is None:
            transcript_content = ''
        
        logger.info(f"Transcript content length: {len(transcript_content)}")
        logger.info(f"First 100 chars: {transcript_content[:100] if transcript_content else 'Empty'}")
        
        # Validate that transcript has actual content before saving
        if not transcript_content or not transcript_content.strip():
            logger.warning(f"Attempting to save empty transcript for session {session_id}")
            raise HTTPException(
                status_code=400, 
                detail="Cannot save empty transcript. Please ensure recording contains speech before saving."
            )
        
        # Check if the problematic date is in the transcript
        if transcript_content and "2024-05-16" in transcript_content:
            logger.warning("Found date '2024-05-16' in transcript content!")
            idx = transcript_content.find("2024-05-16")
            logger.warning(f"Date appears at position {idx}, context: ...{transcript_content[max(0,idx-50):idx+60]}...")
        
        # Update Firestore with transcript content directly
        update_data = {
            'transcript_original': transcript_content,
            'status': TranscriptStatus.COMPLETED
        }
        
        # Also save to GCS for backwards compatibility (optional)
        saved_paths = {}
        if transcript_content and gcs_client:
            try:
                success = gcs_client.save_data_to_gcs(
                    user_id=user_id,
                    data_type="transcripts/original",
                    session_id=session_id,
                    content=transcript_content
                )
                if success:
                    saved_paths['original_transcript'] = f"{user_id}/transcripts/original/{session_id}.txt"
                    update_data['gcs_path_original'] = saved_paths['original_transcript']
            except Exception as e:
                logger.warning(f"Failed to save to GCS (will continue with Firestore only): {e}")
        
        # Process with AI if template provided
        if request_data.get('llm_template'):
            logger.info(f"Processing transcript with LLM for session {session_id}")
            
            # Get user settings to retrieve LLM instructions
            try:
                # Get user settings directly from Firestore
                user_settings = await firestore_client.get_user_settings(user_id)
                custom_instructions = None
                
                if user_settings and user_settings.get('transcription_profiles'):
                    llm_template_id = request_data.get('llm_template_id')
                    llm_template = request_data.get('llm_template')
                    
                    # Find matching profile
                    selected_profile = None
                    profiles = user_settings.get('transcription_profiles', [])
                    
                    if llm_template_id:
                        selected_profile = next((p for p in profiles if p.get('id') == llm_template_id), None)
                    if not selected_profile and llm_template:
                        selected_profile = next((p for p in profiles if p.get('name') == llm_template), None)
                    
                    if selected_profile:
                        custom_instructions = selected_profile.get('llmInstructions') or selected_profile.get('llmPrompt')
                        logger.info(f"Found LLM instructions from profile '{selected_profile.get('name')}')")
                
                # Fallback instructions if no profile found
                if not custom_instructions:
                    patient_name = request_data.get('patient_name', '')
                    patient_context = request_data.get('patient_context', '')
                    encounter_type = request_data.get('encounter_type', '')
                    custom_instructions = f"Patient Name: {patient_name}\nPatient Context: {patient_context}\nEncounter Type: {encounter_type}"
                    if original_date_of_service:
                        custom_instructions += f"\nDate of Service: {original_date_of_service}"
                    custom_instructions += f"\nTemplate: {llm_template}"
                    
                    # Add previous findings context for re-evaluations (also in fallback path)
                    if evaluation_type == 're_evaluation' and previous_findings:
                        custom_instructions += f"\n\nPrevious Initial Evaluation Findings:\n{json.dumps(previous_findings, indent=2)}"
                        logger.info("Added previous findings to LLM context for re-evaluation (fallback path)")
                        logger.info(f"Previous findings added (first 500 chars): {json.dumps(previous_findings, indent=2)[:500]}...")
                else:
                    # Append context to profile instructions
                    patient_name = request_data.get('patient_name', '')
                    patient_context = request_data.get('patient_context', '')
                    encounter_type = request_data.get('encounter_type', '')
                    custom_instructions += f"\n\nAdditional Context:\nPatient Name: {patient_name}\nPatient Context: {patient_context}\nEncounter Type: {encounter_type}"
                    if original_date_of_service:
                        custom_instructions += f"\nDate of Service: {original_date_of_service}"
                        logger.info(f"Added date of service to instructions: {original_date_of_service}")
                    else:
                        logger.info("No date of service to add to instructions")
                    
                    # Add previous findings context for re-evaluations
                    if evaluation_type == 're_evaluation' and previous_findings:
                        custom_instructions += f"\n\nPrevious Initial Evaluation Findings:\n{json.dumps(previous_findings, indent=2)}"
                        logger.info("Added previous findings to LLM context for re-evaluation")
                        logger.info(f"Previous findings added (first 500 chars): {json.dumps(previous_findings, indent=2)[:500]}...")
                    else:
                        logger.info(f"Re-evaluation check: evaluation_type={evaluation_type}, has_previous_findings={bool(previous_findings)}")
                
                logger.info(f"Custom instructions being sent to LLM (first 500 chars): {custom_instructions[:500]}...")
                logger.info(f"Total custom instructions length: {len(custom_instructions)} characters")
                
                # Polish transcript using Gemini
                polished_result = await asyncio.get_event_loop().run_in_executor(
                    None,
                    polish_transcript_with_gemini,
                    transcript_content,
                    request_data.get('patient_name', ''),
                    request_data.get('patient_context', ''),
                    request_data.get('encounter_type', ''),
                    custom_instructions,
                    request_data.get('location', '')
                )
                
                if polished_result['success']:
                    update_data['transcript_polished'] = polished_result['polished_transcript']
                    logger.info(f"Transcript polished successfully for session {session_id}")
                    
                    # Save to GCS as well for backwards compatibility
                    if gcs_client and polished_result['polished_transcript']:
                        try:
                            success = gcs_client.save_data_to_gcs(
                                user_id=user_id,
                                data_type="transcripts/polished",
                                session_id=session_id,
                                content=polished_result['polished_transcript']
                            )
                            if success:
                                update_data['gcs_path_polished'] = f"{user_id}/transcripts/polished/{session_id}.txt"
                        except Exception as e:
                            logger.warning(f"Failed to save polished transcript to GCS: {e}")
                else:
                    logger.error(f"Failed to polish transcript: {polished_result.get('error', 'Unknown error')}")
                    
            except Exception as e:
                logger.error(f"Error during LLM processing: {str(e)}")
                # Continue without polishing rather than failing the entire save
        
        # Update Firestore with transcript content
        logger.info(f"Updating transcript {session_id} with content (length: {len(transcript_content)})")
        await firestore_client.update_transcript(session_id, update_data)
        
        # Delete draft if exists
        if gcs_client:
            draft_key = f"{user_id}/drafts/{session_id}.txt"
            try:
                gcs_client.delete_gcs_object(draft_key)
                logger.info(f"Deleted draft {draft_key}")
            except Exception as e:
                logger.warning(f"Failed to delete draft {draft_key}: {e}")
        
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

async def get_transcript_details_firestore(
    user_id: str,
    transcript_id: str,
    current_user_id: str = Depends(get_user_id),
    request: Request = None
):
    """
    Get detailed transcript information including content from Firestore.
    """
    # Verify authorization
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="You can only access your own transcripts")
    
    logger.info(f"Fetching transcript details for {transcript_id}")
    
    try:
        # Get transcript from Firestore
        transcript = await firestore_client.get_transcript(transcript_id)
        
        if not transcript:
            raise HTTPException(status_code=404, detail="Transcript not found")
        
        # Verify ownership
        if transcript.get('user_id') != user_id:
            raise HTTPException(status_code=403, detail="Unauthorized access to transcript")
        
        # Get transcript content, ensuring we always have strings
        original_transcript = transcript.get('transcript_original') or ''
        polished_transcript = transcript.get('transcript_polished') or ''
        
        # Safe logging with extra protection
        try:
            logger.info(f"Transcript data: has original: {bool(original_transcript)}, "
                       f"has polished: {bool(polished_transcript)}")
            logger.info(f"Original transcript length: {len(original_transcript)}")
            logger.info(f"Polished transcript length: {len(polished_transcript)}")
        except Exception as e:
            logger.warning(f"Error logging transcript details: {e}. Original type: {type(original_transcript)}, Polished type: {type(polished_transcript)}")
        
        # Return transcript with content
        return {
            'id': transcript['session_id'],
            'originalTranscript': original_transcript,
            'polishedTranscript': polished_transcript,
            'patientName': transcript.get('patient_name'),
            'status': transcript.get('status'),
            'createdAt': transcript.get('created_at'),
            'updatedAt': transcript.get('updated_at')
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching transcript details: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch transcript details")

async def save_draft_firestore(
    request_data: dict,
    current_user_id: str = Depends(get_user_id),
    request: Request = None
):
    """
    Save a draft recording directly to Firestore for faster access.
    """
    session_id = request_data.get("session_id")
    user_id = request_data.get("user_id")
    
    # Log PHI access
    AuditLogger.log_data_access(
        user_id=current_user_id,
        operation="CREATE",
        data_type="draft_recording",
        resource_id=session_id,
        request=request,
        success=True
    )
    
    # Verify authorization
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="You can only save your own drafts")
    
    logger.info(f"Saving draft {session_id} for user {user_id}")
    
    # Get transcript content
    transcript_content = request_data.get('transcript', '')
    
    # Validate that draft has actual content before saving
    if not transcript_content or not transcript_content.strip():
        logger.warning(f"Attempting to save empty draft for session {session_id}")
        raise HTTPException(
            status_code=400, 
            detail="Cannot save empty draft. Please ensure recording contains speech before saving."
        )
    
    try:
        # Check if transcript already exists
        existing = await firestore_client.get_transcript(session_id)
        
        if existing:
            # Update existing transcript
            update_data = {
                'status': TranscriptStatus.DRAFT,
                'transcript_original': request_data.get('transcript', ''),
                'patient_name': request_data.get('patient_name', 'Draft Session'),
                'updated_at': datetime.now(timezone.utc).isoformat()
            }
            
            if request_data.get('profile_id'):
                update_data['llm_template_id'] = request_data['profile_id']
                
            await firestore_client.update_transcript(session_id, update_data)
        else:
            # Parse created_at from session_id if it's a timestamp format
            created_at = datetime.now(timezone.utc)
            if len(session_id) >= 14 and session_id[:14].isdigit():
                try:
                    # Session ID format: YYYYMMDDHHMMSSxxxxxx (generated in UTC)
                    created_at = datetime.strptime(session_id[:14], "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)
                    logger.info(f"Draft: Parsed recording start time from session_id: {created_at.isoformat()}")
                except ValueError:
                    logger.warning(f"Draft: Could not parse timestamp from session_id: {session_id}")
            
            # Create new draft transcript
            transcript_data = {
                'user_id': user_id,
                'session_id': session_id,
                'status': TranscriptStatus.DRAFT,
                'patient_name': request_data.get('patient_name', 'Draft Session'),
                'transcript_original': request_data.get('transcript', ''),
                'llm_template_id': request_data.get('profile_id'),
                'created_at': created_at.isoformat(),
                'updated_at': datetime.now(timezone.utc).isoformat()
            }
            
            await firestore_client.create_transcript(transcript_data)
        
        logger.info(f"Draft saved successfully for session {session_id}")
        return {"message": "Draft saved successfully", "session_id": session_id}
        
    except Exception as e:
        logger.error(f"Error saving draft: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save draft: {str(e)}")

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