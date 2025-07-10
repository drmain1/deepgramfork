"""
Patient Management API Endpoints

This module contains all patient-related endpoints including:
- Patient CRUD operations
- Patient transcript management
- Billing generation
- Evaluation tracking
"""

from fastapi import Path, Query, Depends, HTTPException, Request
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
import logging

from gcp_auth_middleware import get_user_id
from audit_logger import AuditLogger
from firestore_endpoints import get_transcript_details_firestore
from gcp_utils import polish_transcript_with_gemini

# Set up logging
logger = logging.getLogger(__name__)


# --- Patient Management Models --- #

class PatientCreateRequest(BaseModel):
    first_name: str
    last_name: str
    date_of_birth: datetime
    date_of_accident: Optional[datetime] = None
    notes_private: Optional[str] = None
    notes_ai_context: Optional[str] = None


class PatientUpdateRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    date_of_accident: Optional[datetime] = None
    notes_private: Optional[str] = None
    notes_ai_context: Optional[str] = None


class PatientResponse(BaseModel):
    id: str
    user_id: str
    first_name: str
    last_name: str
    date_of_birth: datetime
    date_of_accident: Optional[datetime] = None
    notes_private: Optional[str] = None
    notes_ai_context: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    active: bool


class BillingRequest(BaseModel):
    transcript_ids: List[str]
    billing_instructions: Optional[str] = ""


# --- Patient Management Endpoints --- #

async def create_patient(
    patient_data: PatientCreateRequest,
    current_user_id: str = Depends(get_user_id),
    request: Request = None
):
    """Create a new patient profile for the authenticated user"""
    try:
        # Add user_id to patient data
        patient_dict = patient_data.dict()
        patient_dict['user_id'] = current_user_id
        
        # Create patient in Firestore
        from firestore_client import firestore_client
        patient_id = await firestore_client.create_patient(patient_dict)
        
        # Retrieve the created patient
        patient = await firestore_client.get_patient(patient_id, current_user_id)
        
        # Log PHI access for HIPAA compliance
        AuditLogger.log_data_access(
            user_id=current_user_id,
            operation="CREATE",
            data_type="patient_profile",
            resource_id=patient_id,
            request=request,
            success=True
        )
        
        return PatientResponse(**patient)
        
    except Exception as e:
        logger.error(f"Error creating patient for user {current_user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create patient profile")


async def list_patients(
    active_only: bool = True,
    search: Optional[str] = None,
    current_user_id: str = Depends(get_user_id),
    request: Request = None
):
    """List all patients for the authenticated user"""
    try:
        from firestore_client import firestore_client
        
        if search:
            # Search patients by name
            patients = await firestore_client.search_patients(current_user_id, search, active_only)
        else:
            # List all patients
            patients = await firestore_client.list_user_patients(current_user_id, active_only)
        
        # Log PHI access for HIPAA compliance
        AuditLogger.log_data_access(
            user_id=current_user_id,
            operation="LIST",
            data_type="patient_profiles",
            resource_id=f"count:{len(patients)}",
            request=request,
            success=True
        )
        
        return [PatientResponse(**patient) for patient in patients]
        
    except Exception as e:
        logger.error(f"Error listing patients for user {current_user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to list patients")


async def get_patient(
    patient_id: str = Path(..., description="Patient ID"),
    current_user_id: str = Depends(get_user_id),
    request: Request = None
):
    """Get a specific patient profile"""
    try:
        from firestore_client import firestore_client
        
        patient = await firestore_client.get_patient(patient_id, current_user_id)
        
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        
        # Log PHI access for HIPAA compliance
        AuditLogger.log_data_access(
            user_id=current_user_id,
            operation="READ",
            data_type="patient_profile",
            resource_id=patient_id,
            request=request,
            success=True
        )
        
        return PatientResponse(**patient)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting patient {patient_id} for user {current_user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get patient")


async def update_patient(
    patient_id: str = Path(..., description="Patient ID"),
    patient_updates: PatientUpdateRequest = ...,
    current_user_id: str = Depends(get_user_id),
    request: Request = None
):
    """Update a patient profile"""
    try:
        from firestore_client import firestore_client
        
        # Only include non-None fields in updates
        updates = {k: v for k, v in patient_updates.dict().items() if v is not None}
        
        if not updates:
            raise HTTPException(status_code=400, detail="No updates provided")
        
        # Update patient
        success = await firestore_client.update_patient(patient_id, current_user_id, updates)
        
        if not success:
            raise HTTPException(status_code=404, detail="Patient not found or unauthorized")
        
        # Get updated patient
        patient = await firestore_client.get_patient(patient_id, current_user_id)
        
        # Log PHI access for HIPAA compliance
        AuditLogger.log_data_access(
            user_id=current_user_id,
            operation="UPDATE",
            data_type="patient_profile",
            resource_id=patient_id,
            request=request,
            success=True
        )
        
        return PatientResponse(**patient)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating patient {patient_id} for user {current_user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update patient")


async def delete_patient(
    patient_id: str = Path(..., description="Patient ID"),
    current_user_id: str = Depends(get_user_id),
    request: Request = None
):
    """Soft delete a patient profile (sets active=False)"""
    try:
        from firestore_client import firestore_client
        
        success = await firestore_client.soft_delete_patient(patient_id, current_user_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Patient not found or unauthorized")
        
        # Log PHI access for HIPAA compliance
        AuditLogger.log_data_access(
            user_id=current_user_id,
            operation="DELETE",
            data_type="patient_profile",
            resource_id=patient_id,
            request=request,
            success=True
        )
        
        return {"message": "Patient deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting patient {patient_id} for user {current_user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete patient")


async def get_patient_transcripts(
    patient_id: str = Path(..., description="Patient ID"),
    current_user_id: str = Depends(get_user_id),
    request: Request = None
):
    """Get all transcripts for a specific patient"""
    try:
        from firestore_client import firestore_client
        
        # First verify the patient belongs to this user
        patient = await firestore_client.get_patient(patient_id, current_user_id)
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        
        # Get all transcripts for this patient
        transcripts = await firestore_client.get_patient_transcripts(patient_id, current_user_id)
        
        # Log PHI access for HIPAA compliance
        AuditLogger.log_data_access(
            user_id=current_user_id,
            operation="READ",
            data_type="patient_transcripts",
            resource_id=patient_id,
            request=request,
            success=True
        )
        
        return transcripts
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting transcripts for patient {patient_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get patient transcripts")


async def generate_patient_billing(
    patient_id: str = Path(..., description="Patient ID"),
    request: BillingRequest = None,
    current_user_id: str = Depends(get_user_id),
    req: Request = None
):
    """Generate billing information for patient transcripts using Gemini 2.5 Pro"""
    try:
        from firestore_client import firestore_client
        from base_billing_rules import get_base_billing_rules
        from gcp_utils import generate_billing_with_gemini
        from firestore_endpoints import get_user_settings_firestore
        
        # Verify the patient belongs to this user
        patient = await firestore_client.get_patient(patient_id, current_user_id)
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        
        # Validate request
        if not request.transcript_ids or len(request.transcript_ids) == 0:
            raise HTTPException(status_code=400, detail="At least one transcript ID is required")
        
        logger.info(f"Billing generation requested for transcripts: {request.transcript_ids}")
        
        # If no specific transcript IDs provided, get all patient transcripts
        if not request.transcript_ids:
            logger.info(f"No specific transcripts requested, fetching all for patient {patient_id}")
            all_transcripts = await firestore_client.get_patient_transcripts(patient_id, current_user_id)
        else:
            # Fetch the specific transcripts
            all_transcripts = []
            for transcript_id in request.transcript_ids:
                transcript_data = await firestore_client.get_transcript(transcript_id)
                if transcript_data:
                    # Check user ownership and patient linkage
                    transcript_user_id = transcript_data.get('user_id') or transcript_data.get('userId')
                    transcript_patient_id = transcript_data.get('patient_id') or transcript_data.get('patientId')
                    
                    logger.info(f"Transcript {transcript_id}: user={transcript_user_id}, patient={transcript_patient_id}")
                    
                    if transcript_user_id == current_user_id:
                        # Verify it belongs to the requested patient
                        if transcript_patient_id == patient_id:
                            all_transcripts.append(transcript_data)
                        else:
                            logger.warning(f"Transcript {transcript_id} belongs to different patient")
                    else:
                        logger.warning(f"Transcript {transcript_id} does not belong to current user")
                else:
                    logger.warning(f"Transcript {transcript_id} not found")
        
        if not all_transcripts:
            raise HTTPException(status_code=404, detail="No transcripts found for this patient")
        
        # Combine transcript content
        combined_transcript = ""
        service_dates = []
        encounter_types = set()
        
        for transcript in all_transcripts:
            # Get the content (prefer polished over original)
            # Handle both raw Firestore fields and mapped fields from get_patient_transcripts
            content = (transcript.get('transcript_polished') or      # Raw Firestore field
                      transcript.get('polishedTranscript') or        # Mapped field from get_patient_transcripts
                      transcript.get('transcript_original') or       # Raw Firestore field
                      transcript.get('transcript', ''))
            
            # If no content in the list response, fetch the full transcript
            if not content:
                logger.info(f"Fetching full transcript for {transcript.get('id')}")
                try:
                    # Use the get_transcript_details_firestore function
                    full_transcript = await get_transcript_details_firestore(
                        user_id=current_user_id,
                        transcript_id=transcript.get('id'),
                        current_user_id=current_user_id
                    )
                    if full_transcript:
                        # get_transcript_details_firestore returns mapped fields
                        content = (full_transcript.get('polishedTranscript') or
                                 full_transcript.get('originalTranscript', ''))
                except Exception as e:
                    logger.error(f"Error fetching full transcript: {str(e)}")
            
            if content:
                combined_transcript += f"\n\n--- Transcript from {transcript.get('created_at', transcript.get('date', 'Unknown date'))} ---\n"
                combined_transcript += content
                logger.info(f"Found content of length: {len(content)} for transcript {transcript.get('id')}")
            else:
                logger.warning(f"No content found in transcript {transcript.get('id', 'unknown')}. Available fields: {list(transcript.keys())}")
            
            # Collect service dates
            if transcript.get('created_at') or transcript.get('date'):
                service_dates.append(transcript.get('created_at') or transcript.get('date'))
            
            # Collect encounter types
            encounter_type = transcript.get('encounterType') or transcript.get('encounter_type')
            if encounter_type:
                encounter_types.add(encounter_type)
        
        if not combined_transcript.strip():
            logger.error(f"No transcript content found in {len(all_transcripts)} transcripts")
            raise HTTPException(status_code=400, detail="No transcript content found")
        
        # Prepare patient info for billing
        patient_info = {
            'first_name': patient.get('first_name', ''),
            'last_name': patient.get('last_name', ''),
            'date_of_birth': patient.get('date_of_birth', ''),
            'insurance_info': patient.get('insurance_info', '')
        }
        
        # Get base billing rules
        base_rules = get_base_billing_rules()
        
        # Get user's custom billing rules and CPT fees
        try:
            user_settings = await get_user_settings_firestore(
                user_id=current_user_id,
                current_user_id=current_user_id,
                request=req
            )
            custom_rules = user_settings.get('customBillingRules', '') or user_settings.get('custom_billing_rules', '')
            custom_cpt_fees = user_settings.get('cptFees', {})
        except Exception as e:
            logger.warning(f"Failed to fetch user settings for billing: {str(e)}")
            custom_rules = ""
            custom_cpt_fees = {}
        
        # Combine rules: base + custom + any additional instructions from request
        combined_billing_instructions = base_rules
        if custom_rules and custom_rules.strip():
            combined_billing_instructions += f"\n\n## CUSTOM CLINIC RULES\n\n{custom_rules}"
        
        # Optionally append any additional instructions from the request
        if request.billing_instructions and request.billing_instructions.strip():
            combined_billing_instructions += f"\n\n## ADDITIONAL INSTRUCTIONS FOR THIS REQUEST\n\n{request.billing_instructions}"
        
        # Generate billing using Gemini 2.5 Pro
        result = generate_billing_with_gemini(
            transcript=combined_transcript,
            patient_info=patient_info,
            billing_instructions=combined_billing_instructions,
            encounter_type=', '.join(encounter_types) if encounter_types else 'Medical Encounter',
            service_date=service_dates[0] if service_dates else None,
            custom_cpt_fees=custom_cpt_fees,
            model_name="gemini-2.5-pro"
        )
        
        if not result['success']:
            logger.error(f"Billing generation failed: {result.get('error')}")
            raise HTTPException(status_code=500, detail=f"Failed to generate billing: {result.get('error')}")
        
        # Log PHI access for HIPAA compliance
        AuditLogger.log_data_access(
            user_id=current_user_id,
            operation="GENERATE_BILLING",
            data_type="patient_billing",
            resource_id=patient_id,
            request=req,
            success=True
        )
        
        # Return the billing data
        return {
            'billing_data': result['billing_data'],
            'patient_id': patient_id,
            'transcript_count': len(all_transcripts),
            'service_dates': service_dates,
            'encounter_types': list(encounter_types),
            'generated_at': result['timestamp'],
            'model_used': result['model_used']
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        logger.error(f"Error generating billing for patient {patient_id}: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to generate billing: {str(e)}")


async def get_patient_initial_evaluation(
    patient_id: str = Path(..., description="Patient ID"),
    current_user_id: str = Depends(get_user_id),
    request: Request = None
):
    """Get the most recent initial evaluation for a patient"""
    try:
        from firestore_client import firestore_client
        from firestore_models import EvaluationType
        
        # Verify the patient belongs to this user
        patient = await firestore_client.get_patient(patient_id, current_user_id)
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        
        # Get all transcripts for this patient
        transcripts = await firestore_client.get_patient_transcripts(patient_id, current_user_id)
        
        # Filter for initial evaluations
        initial_evaluations = [
            t for t in transcripts 
            if (t.get('evaluation_type') == EvaluationType.INITIAL or 
                (t.get('encounter_type') and 'initial' in t.get('encounter_type', '').lower()))
        ]
        
        # Debug logging
        logger.info(f"Total transcripts found: {len(transcripts)}")
        logger.info(f"Initial evaluations found: {len(initial_evaluations)}")
        if transcripts:
            logger.info(f"Sample transcript evaluation_type: {transcripts[0].get('evaluation_type')}")
            logger.info(f"Sample transcript encounter_type: {transcripts[0].get('encounter_type')}")
        
        if not initial_evaluations:
            raise HTTPException(status_code=404, detail="No initial evaluation found for this patient")
        
        # Sort by date and get the most recent
        initial_evaluations.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        most_recent = initial_evaluations[0]
        
        # Debug log the findings
        logger.info(f"Most recent initial evaluation has positive_findings: {bool(most_recent.get('positive_findings'))}")
        if most_recent.get('positive_findings'):
            logger.info(f"Positive findings keys: {list(most_recent.get('positive_findings', {}).keys())}")
            
            # Log ROM findings format specifically
            rom_findings = most_recent.get('positive_findings', {}).get('range_of_motion_findings', [])
            logger.info(f"ROM findings type: {type(rom_findings)}")
            logger.info(f"ROM findings count: {len(rom_findings) if isinstance(rom_findings, list) else 'N/A'}")
            
            if isinstance(rom_findings, list) and len(rom_findings) > 0:
                # Check format of first finding
                first_finding = rom_findings[0]
                if isinstance(first_finding, dict):
                    logger.info(f"ROM format: NEW (dict) - Keys: {list(first_finding.keys())}")
                    logger.info(f"First ROM finding: {first_finding}")
                else:
                    logger.info(f"ROM format: OLD (string)")
                    logger.info(f"First ROM finding: {first_finding}")
        
        # Log PHI access for HIPAA compliance
        AuditLogger.log_data_access(
            user_id=current_user_id,
            operation="READ",
            data_type="initial_evaluation",
            resource_id=most_recent.get('id'),
            request=request,
            success=True
        )
        
        return most_recent
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting initial evaluation for patient {patient_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get initial evaluation")


async def get_patient_previous_evaluation(
    patient_id: str = Path(..., description="Patient ID"),
    current_user_id: str = Depends(get_user_id),
    request: Request = None
):
    """Get the most recent evaluation (initial or re-evaluation) for a patient"""
    try:
        from firestore_client import firestore_client
        from firestore_models import EvaluationType
        
        # Verify the patient belongs to this user
        patient = await firestore_client.get_patient(patient_id, current_user_id)
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        
        # Get all transcripts for this patient
        transcripts = await firestore_client.get_patient_transcripts(patient_id, current_user_id)
        
        # Filter for evaluations (both initial and re-evaluation types)
        evaluations = [
            t for t in transcripts 
            if t.get('evaluation_type') in [EvaluationType.INITIAL, EvaluationType.RE_EVALUATION]
        ]
        
        # Debug logging
        logger.info(f"Total transcripts found: {len(transcripts)}")
        logger.info(f"Evaluations (initial + re-evaluation) found: {len(evaluations)}")
        if transcripts:
            logger.info(f"Sample transcript evaluation_type: {transcripts[0].get('evaluation_type')}")
            logger.info(f"Sample transcript encounter_type: {transcripts[0].get('encounter_type')}")
        
        if not evaluations:
            raise HTTPException(status_code=404, detail="No previous evaluation found for this patient")
        
        # Sort by date and get the most recent
        evaluations.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        most_recent = evaluations[0]
        
        # Debug log the findings
        logger.info(f"Most recent evaluation has positive_findings: {bool(most_recent.get('positive_findings'))}")
        logger.info(f"Most recent evaluation type: {most_recent.get('evaluation_type')}")
        if most_recent.get('positive_findings'):
            logger.info(f"Positive findings keys: {list(most_recent.get('positive_findings', {}).keys())}")
            
            # Log ROM findings format specifically
            rom_findings = most_recent.get('positive_findings', {}).get('range_of_motion_findings', [])
            logger.info(f"ROM findings type: {type(rom_findings)}")
            logger.info(f"ROM findings count: {len(rom_findings) if isinstance(rom_findings, list) else 'N/A'}")
        
        # Log PHI access for HIPAA compliance
        AuditLogger.log_data_access(
            user_id=current_user_id,
            operation="READ",
            data_type="previous_evaluation",
            resource_id=most_recent.get('id'),
            request=request,
            success=True
        )
        
        return most_recent
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting previous evaluation for patient {patient_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get previous evaluation")


async def get_re_evaluation_status(
    patient_id: str = Path(..., description="Patient ID"),
    current_user_id: str = Depends(get_user_id),
    request: Request = None
):
    """Get the re-evaluation status for a patient"""
    try:
        from firestore_client import firestore_client
        from firestore_models import EvaluationType
        from datetime import datetime, timezone
        
        # Verify the patient belongs to this user
        patient = await firestore_client.get_patient(patient_id, current_user_id)
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        
        # Get all transcripts for this patient
        transcripts = await firestore_client.get_patient_transcripts(patient_id, current_user_id)
        
        # Filter for evaluations only (initial and re-evaluations)
        evaluations = [
            t for t in transcripts 
            if t.get('evaluation_type') in [EvaluationType.INITIAL, EvaluationType.RE_EVALUATION]
        ]
        
        if not evaluations:
            # Count all sessions as they're all "since" a non-existent evaluation
            all_sessions = len(transcripts)
            return {
                "status": "no_evaluation",
                "days_since_last": None,
                "session_count": all_sessions,
                "sessions_since_evaluation": all_sessions,
                "last_evaluation_date": None,
                "last_evaluation_type": None,
                "color": "gray" if all_sessions < 10 else "yellow" if all_sessions < 12 else "red",
                "message": f"{all_sessions} visits - Initial evaluation needed",
                "patient_name": f"{patient['last_name']}, {patient['first_name']}"
            }
        
        # Filter out evaluations without created_at timestamp
        valid_evaluations = [e for e in evaluations if e.get('created_at')]
        
        if not valid_evaluations:
            # If no evaluations have timestamps, count all sessions
            all_sessions = len(transcripts)
            logger.warning(f"Found {len(evaluations)} evaluations but none have created_at timestamps")
            return {
                "status": "no_evaluation",
                "days_since_last": None,
                "session_count": all_sessions,
                "sessions_since_evaluation": all_sessions,
                "last_evaluation_date": None,
                "last_evaluation_type": None,
                "color": "gray" if all_sessions < 10 else "yellow" if all_sessions < 12 else "red",
                "message": f"{all_sessions} visits - No valid evaluation dates found",
                "patient_name": f"{patient['last_name']}, {patient['first_name']}"
            }
        
        # Sort valid evaluations by date (newest first)
        valid_evaluations.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        last_evaluation = valid_evaluations[0]
        
        # Calculate days since last evaluation
        created_at = last_evaluation.get('created_at')
        last_eval_date = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        days_since = (datetime.now(timezone.utc) - last_eval_date).days
        
        # Count sessions SINCE the last evaluation (initial or re-evaluation)
        # Sort all transcripts by date
        transcripts_with_dates = [t for t in transcripts if t.get('created_at')]
        transcripts_with_dates.sort(key=lambda x: x.get('created_at', ''), reverse=False)
        
        # Find sessions that occurred after the last evaluation
        sessions_since_evaluation = 0
        for transcript in transcripts_with_dates:
            transcript_created_at = transcript.get('created_at')
            transcript_date = datetime.fromisoformat(transcript_created_at.replace('Z', '+00:00'))
            if transcript_date > last_eval_date:
                sessions_since_evaluation += 1
                
        # Also count transcripts without dates (they might be newer)
        transcripts_without_dates = len([t for t in transcripts if not t.get('created_at')])
        if transcripts_without_dates > 0:
            logger.warning(f"Found {transcripts_without_dates} transcripts without created_at timestamps")
            sessions_since_evaluation += transcripts_without_dates
        
        # Determine status color based on sessions since last evaluation
        # Green: 0-30 days AND less than 12 sessions
        # Yellow: 31-45 days OR 10-11 sessions
        # Red: 46+ days OR 12+ sessions
        if sessions_since_evaluation >= 12:
            color = "red"
            message = f"Re-evaluation needed: {sessions_since_evaluation} sessions since last evaluation"
        elif days_since > 45:
            color = "red"
            message = f"Re-evaluation overdue: {days_since} days since last evaluation"
        elif days_since > 30 or sessions_since_evaluation >= 10:
            color = "yellow"
            message = f"Re-evaluation due soon: {days_since} days, {sessions_since_evaluation} sessions"
        else:
            color = "green"
            message = f"Last evaluation: {days_since} days ago ({sessions_since_evaluation} sessions)"
        
        # Log PHI access for HIPAA compliance
        AuditLogger.log_data_access(
            user_id=current_user_id,
            operation="READ",
            data_type="re_evaluation_status",
            resource_id=patient_id,
            request=request,
            success=True
        )
        
        return {
            "status": "evaluated",
            "days_since_last": days_since,
            "session_count": len(transcripts),  # Total sessions for patient
            "sessions_since_evaluation": sessions_since_evaluation,  # Sessions since last eval
            "last_evaluation_date": last_evaluation.get('created_at'),
            "last_evaluation_type": last_evaluation.get('evaluation_type'),
            "color": color,
            "message": message,
            "patient_name": f"{patient['last_name']}, {patient['first_name']}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching re-evaluation status: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get re-evaluation status")


async def get_patient_evaluations(
    patient_id: str = Path(..., description="Patient ID"),
    evaluation_type: Optional[str] = Query(None, description="Filter by evaluation type"),
    current_user_id: str = Depends(get_user_id),
    request: Request = None
):
    """Get all evaluations for a patient, optionally filtered by type"""
    try:
        from firestore_client import firestore_client
        from firestore_models import EvaluationType
        
        # Verify the patient belongs to this user
        patient = await firestore_client.get_patient(patient_id, current_user_id)
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        
        # Get all transcripts for this patient
        transcripts = await firestore_client.get_patient_transcripts(patient_id, current_user_id)
        
        # Filter by evaluation type if specified
        if evaluation_type:
            transcripts = [
                t for t in transcripts 
                if t.get('evaluation_type') == evaluation_type
            ]
        
        # Sort by date
        transcripts.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        # Log PHI access for HIPAA compliance
        AuditLogger.log_data_access(
            user_id=current_user_id,
            operation="LIST",
            data_type="patient_evaluations",
            resource_id=patient_id,
            request=request,
            success=True
        )
        
        return transcripts
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting evaluations for patient {patient_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get patient evaluations")


async def extract_transcript_findings(
    transcript_id: str = Path(..., description="Transcript ID"),
    current_user_id: str = Depends(get_user_id),
    request: Request = None
):
    """Extract positive findings from a transcript using AI"""
    try:
        from firestore_client import firestore_client
        import asyncio
        
        # Get the transcript
        transcript_data = await firestore_client.get_transcript(transcript_id)
        if not transcript_data:
            raise HTTPException(status_code=404, detail="Transcript not found")
        
        # Verify ownership
        transcript_user_id = transcript_data.get('user_id') or transcript_data.get('userId')
        if transcript_user_id != current_user_id:
            raise HTTPException(status_code=403, detail="Unauthorized access to transcript")
        
        # Get the transcript content
        content = (transcript_data.get('transcript_polished') or 
                  transcript_data.get('transcript_original', ''))
        
        if not content:
            raise HTTPException(status_code=400, detail="No transcript content available")
        
        # Get extraction prompt based on user's specialty
        from extraction_prompts import get_extraction_prompt
        from extraction_prompts_enhanced import get_enhanced_extraction_prompt
        
        # Try to get user's specialty from settings
        from firestore_client import firestore_client
        user_settings = await firestore_client.get_user_settings(current_user_id)
        specialty = user_settings.get('medicalSpecialty', 'general') if user_settings else 'general'
        
        # Use enhanced extraction prompt that generates both JSON and markdown
        logger.info(f"Extracting findings for transcript {transcript_id}")
        logger.info(f"User specialty: {specialty}")
        extraction_prompt = get_enhanced_extraction_prompt(specialty=specialty)
        logger.info(f"Using extraction prompt type: enhanced")
        logger.info(f"Extraction prompt length: {len(extraction_prompt)} characters")
        
        # Run the synchronous function in an executor
        # Use lightweight model for findings extraction
        import time
        start_time = time.time()
        result = await asyncio.get_event_loop().run_in_executor(
            None,
            polish_transcript_with_gemini,
            content,  # transcript
            "",  # patient_name
            "",  # patient_context
            "findings_extraction",  # encounter_type
            extraction_prompt,  # llm_instructions
            None,  # location (optional)
            "gemini-2.5-flash"  # Use standard flash model for extraction
        )
        extraction_time = time.time() - start_time
        logger.info(f"Findings extraction completed in {extraction_time:.2f} seconds")
        
        if result['success']:
            # Parse the enhanced extraction output (contains both JSON and markdown)
            try:
                import json
                import re
                
                output = result['polished_transcript']
                
                # Extract JSON section
                json_match = re.search(r'```json\n(.*?)\n```', output, re.DOTALL)
                findings = {}
                if json_match:
                    try:
                        findings = json.loads(json_match.group(1))
                        logger.info(f"Successfully parsed JSON findings: {list(findings.keys())}")
                        
                        # Log the ROM findings format
                        if 'range_of_motion_findings' in findings:
                            rom_findings = findings['range_of_motion_findings']
                            logger.info(f"ROM findings type: {type(rom_findings)}")
                            if isinstance(rom_findings, list) and len(rom_findings) > 0:
                                logger.info(f"ROM findings count: {len(rom_findings)}")
                                logger.info(f"First ROM finding sample: {rom_findings[0]}")
                            else:
                                logger.info(f"ROM findings content: {rom_findings}")
                    except Exception as e:
                        logger.error(f"Failed to parse JSON: {e}")
                        findings = {"raw_findings": json_match.group(1)}
                else:
                    logger.warning("No JSON section found in LLM output")
                    # Try to parse the entire output as JSON
                    try:
                        findings = json.loads(output)
                        logger.info("Parsed entire output as JSON")
                    except:
                        logger.warning("Could not parse output as JSON")
                
                # Extract markdown section
                markdown_match = re.search(r'```markdown\n(.*?)\n```', output, re.DOTALL)
                findings_markdown = markdown_match.group(1) if markdown_match else None
                logger.info(f"Extracted markdown length: {len(findings_markdown) if findings_markdown else 0}")
                
                # If no markdown found, try to get any text after JSON
                if not findings_markdown:
                    # Look for markdown content after the JSON block
                    parts = output.split('```')
                    for i, part in enumerate(parts):
                        if part.strip().startswith('markdown'):
                            findings_markdown = parts[i+1] if i+1 < len(parts) else None
                            break
                
                # Debug logging
                logger.info(f"Raw LLM output length: {len(output)}")
                logger.info(f"Found JSON section: {bool(json_match)}")
                logger.info(f"Found markdown section: {bool(markdown_match)}")
                if not findings_markdown:
                    logger.warning("No markdown found in LLM output. First 500 chars of output:")
                    logger.warning(output[:500])
                
            except Exception as e:
                logger.error(f"Failed to parse enhanced extraction output: {str(e)}")
                logger.error(f"Raw output preview: {result['polished_transcript'][:500]}...")
                # Fallback to simple JSON parsing
                try:
                    findings = json.loads(result['polished_transcript'])
                    findings_markdown = None
                    logger.info("Fallback: parsed as plain JSON")
                except:
                    # If all else fails, create basic findings structure
                    findings = {
                        "pain_findings": ["Unable to parse findings - check raw transcript"],
                        "raw_output": result['polished_transcript'][:1000]
                    }
                    findings_markdown = "### Extraction Error\n\nUnable to extract structured findings. Please review the transcript manually."
                    logger.error("Fallback: created error findings structure")
            
            # Update the transcript with both JSON findings and markdown
            update_data = {'positive_findings': findings}
            if findings_markdown:
                update_data['positive_findings_markdown'] = findings_markdown
            
            await firestore_client.update_transcript(
                transcript_id, 
                update_data
            )
            
            # Log PHI access
            AuditLogger.log_data_access(
                user_id=current_user_id,
                operation="EXTRACT_FINDINGS",
                data_type="transcript_findings",
                resource_id=transcript_id,
                request=request,
                success=True
            )
            
            response_data = {
                'success': True,
                'findings': findings,
                'findings_markdown': findings_markdown,
                'transcript_id': transcript_id
            }
            logger.info(f"Returning extraction response with markdown: {bool(findings_markdown)}")
            return response_data
        else:
            raise HTTPException(status_code=500, detail=f"Failed to extract findings: {result.get('error')}")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error extracting findings from transcript {transcript_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to extract findings")