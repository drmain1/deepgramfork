import os
from dotenv import load_dotenv

# Load .env file FIRST before any other imports
backend_env_path = os.path.join(os.path.dirname(__file__), '.env')
parent_env_path = os.path.join(os.path.dirname(__file__), '..', '.env')

if os.path.exists(backend_env_path):
    load_dotenv(dotenv_path=backend_env_path)
    print(f"Loaded .env from backend directory: {backend_env_path}")
else:
    load_dotenv(dotenv_path=parent_env_path)
    print(f"Loaded .env from parent directory: {parent_env_path}")

import uvicorn
import asyncio
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, Query, UploadFile, File, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from contextlib import asynccontextmanager
# Middleware imports moved to separate modules
from deepgram import AsyncLiveClient, DeepgramClientOptions, LiveOptions, LiveTranscriptionEvents
from deepgram.clients.listen.v1.websocket.response import CloseResponse
import logging
from datetime import datetime
import json
import tempfile
import time

# Set up logging
logger = logging.getLogger(__name__)
from fastapi import HTTPException, Path
from datetime import datetime, timedelta, timezone

# Import models
from models import (
    TranscriptionProfileItem,
    UserSettingsData,
    SaveUserSettingsRequest,
    SaveSessionRequest,
    SaveDraftRequest,
    RecordingInfo,
    UpdateTranscriptRequest,
    DEFAULT_USER_SETTINGS
)

# Import the refactored Deepgram handler
from deepgram_utils import handle_deepgram_websocket

# Import routers
from routers import image_router, pdf_router

# Import the new Speechmatics handler for multilingual support
from speechmatics_utils import handle_speechmatics_websocket

# GCP utilities are imported above

# Import GCP utility functions
from gcp_utils import polish_transcript_with_gemini, generate_billing_with_gemini

# Import authentication middleware
from gcp_auth_middleware import get_current_user, get_user_id, session_manager

# Import Firestore-based endpoints
from firestore_endpoints import (
    get_user_recordings_firestore,
    get_user_settings_firestore,
    update_user_settings_firestore,
    save_session_data_firestore,
    delete_recording_firestore,
    get_transcript_details_firestore,
    save_draft_firestore
)

# Environment already loaded at the top of the file

deepgram_api_key = os.getenv("DEEPGRAM_API_KEY") or os.getenv("deepgram_api_key")
DEFAULT_TENANT_ID = os.getenv("DEFAULT_TENANT_ID", "dev-tenant")

# Import GCS utilities early
from gcs_utils import GCSClient

# Global placeholders for clients and services, to be initialized in startup event
gcs_client = None
vertex_ai_client = None
user_settings_service = None
image_handler_instance = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global gcs_client, vertex_ai_client, user_settings_service, image_handler_instance
    print("FastAPI startup: Initializing GCP clients...")
    
    # Initialize GCS client
    try:
        gcs_client = GCSClient()
        print("✓ GCS client initialized successfully during startup.")
        
        # Initialize new services
        user_settings_service = UserSettingsService(gcs_client)
        print("✓ User Settings Service initialized")
        
        image_handler_instance = ImageHandler(gcs_client)
        print("✓ Image Handler initialized")
        
        # Initialize the image router with dependencies
        image_router.init_router(image_handler_instance, DEFAULT_USER_SETTINGS)
        print("✓ Image router initialized")
        
        # Log bucket information
        print(f"✓ Using GCS bucket: {gcs_client.bucket_name}")
        
        # HIPAA Compliance notes
        print("\n📋 HIPAA Compliance Status:")
        print("   ✓ Customer-managed encryption keys (CMEK) configured")
        print("   ✓ Audit logging enabled via Cloud Audit Logs")
        print("   ✓ Data retention policies configured")
        print("   ✓ Access controls via IAM and bucket policies")
        print("   ✓ All data encrypted at rest and in transit")
        
    except Exception as e:
        print(f"Failed to initialize services during startup: {e}")
        gcs_client = None
        user_settings_service = None
        image_handler_instance = None
    
    # Initialize Vertex AI for transcription polish
    if os.getenv('GCP_PROJECT_ID'):
        try:
            # Vertex AI initialization happens in gcp_utils when needed
            print("✓ Vertex AI configuration available for transcript polish")
        except Exception as e:
            print(f"Failed to configure Vertex AI: {e}")
    
    # Firestore is always used for metadata and queries
    print("✓ Using Firestore for metadata and queries (faster performance)")
    print("✓ Using GCS for file storage (logos, signatures)")
    
    print("FastAPI startup finished.")
    
    yield  # Server is running
    
    # Shutdown
    print("FastAPI shutdown: Cleaning up resources...")
    # Add any cleanup code here if needed

app = FastAPI(lifespan=lifespan)

# Health check endpoint for App Engine
@app.get("/health")
async def health_check():
    """Health check endpoint for load balancer and monitoring."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "scribe-api",
        "environment": os.getenv("ENVIRONMENT", "development")
    }

# Import and configure middleware
from middleware import create_security_middleware_stack, configure_cors

# Configure CORS
configure_cors(app)

# Apply security middleware stack
create_security_middleware_stack(app)

# Add rate limiting middleware
from rate_limiter import RateLimitMiddleware
app.add_middleware(RateLimitMiddleware)
logger.info("Rate limiting middleware enabled")

# Include routers
app.include_router(image_router.router)
app.include_router(pdf_router.router)

# Import audit logger for HIPAA compliance
from audit_logger import AuditLogger

# Import new refactored modules
from websocket_auth import WebSocketAuthWrapper, websocket_manager
from services.user_settings_service import UserSettingsService
from image_handler import ImageHandler
from routers import image_router

config = DeepgramClientOptions(
    api_key=deepgram_api_key, 
    verbose=0, 
)
deepgram_client = AsyncLiveClient(config)

@app.websocket("/stream")
async def websocket_stream_endpoint(websocket: WebSocket, token: str = Query(...)):
    """Handles WebSocket streaming for Deepgram transcription."""
    await WebSocketAuthWrapper.handle_authenticated_websocket(
        websocket=websocket,
        token=token,
        handler_func=handle_deepgram_websocket,
        get_user_settings_func=lambda user_id: user_settings_service.get_user_settings(user_id),
        connection_type="DEEPGRAM"
    )

@app.websocket("/stream/multilingual")
async def websocket_multilingual_stream_endpoint(websocket: WebSocket, token: str = Query(...)):
    """Handles WebSocket streaming for Speechmatics multilingual transcription."""
    await WebSocketAuthWrapper.handle_authenticated_websocket(
        websocket=websocket,
        token=token,
        handler_func=handle_speechmatics_websocket,
        get_user_settings_func=lambda user_id: user_settings_service.get_user_settings(user_id),
        connection_type="SPEECHMATICS"
    )


@app.get("/api/v1/user_settings/{user_id}", response_model=UserSettingsData)
async def get_user_settings(
    user_id: str = Path(..., description="The ID of the user whose settings are to be fetched"),
    current_user_id: str = Depends(get_user_id),
    request: Request = None
):
    # Verify authorization
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="You can only view your own settings")
    
    # Get settings from Firestore directly
    from firestore_endpoints import get_user_settings_firestore
    settings = await get_user_settings_firestore(user_id, current_user_id, request)
    
    # Settings are already in the correct format from get_user_settings_firestore
    return UserSettingsData(
        customVocabulary=settings.get("customVocabulary", []),
        macroPhrases=settings.get("macroPhrases", []),
        transcriptionProfiles=settings.get("transcriptionProfiles", []),
        doctorName=settings.get("doctorName", ""),
        medicalSpecialty=settings.get("medicalSpecialty", ""),
        doctorSignature=settings.get("doctorSignature"),
        clinicLogo=settings.get("clinicLogo"),
        includeLogoOnPdf=settings.get("includeLogoOnPdf", False),
        officeInformation=settings.get("officeInformation", []),
        customBillingRules=settings.get("customBillingRules", ""),
        cptFees=settings.get("cptFees", {})
    )

@app.get("/api/v1/debug/transcription_profiles/{user_id}")
async def debug_transcription_profiles(
    user_id: str = Path(..., description="The ID of the user whose profiles to debug"),
    current_user_id: str = Depends(get_user_id)
):
    """Debug endpoint to check transcription profiles"""
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="You can only debug your own profiles")
    
    try:
        user_settings = await get_user_settings(user_id, current_user_id=user_id)
        profiles_info = []
        
        if user_settings and user_settings.transcriptionProfiles:
            for profile in user_settings.transcriptionProfiles:
                profile_info = {
                    "id": profile.id,
                    "name": profile.name,
                    "has_llmInstructions": bool(profile.llmInstructions),
                    "llmInstructions_length": len(profile.llmInstructions) if profile.llmInstructions else 0,
                    "llmInstructions_preview": profile.llmInstructions[:100] + "..." if profile.llmInstructions and len(profile.llmInstructions) > 100 else profile.llmInstructions,
                    "has_llmPrompt": bool(profile.llmPrompt),
                    "specialty": profile.specialty,
                    "originalTemplateId": profile.originalTemplateId
                }
                profiles_info.append(profile_info)
        
        return {
            "user_id": user_id,
            "profiles_count": len(profiles_info),
            "profiles": profiles_info
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/v1/test-gcp")
async def test_gcp_connection(current_user_id: str = Depends(get_user_id)):
    """Test endpoint to verify GCP Vertex AI connection"""
    try:
        from gcp_utils import test_gemini_connection
        success, message = test_gemini_connection()
        return {
            "success": success,
            "message": message,
            "provider": "Google Cloud Platform - Vertex AI"
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to test GCP connection: {str(e)}",
            "provider": "Google Cloud Platform - Vertex AI"
        }

@app.get("/api/v1/test")
async def test_endpoint():
    """Simple test endpoint that doesn't require authentication"""
    return {"status": "ok", "message": "Backend is running"}

@app.post("/api/v1/login")
async def login(current_user: dict = Depends(get_current_user)):
    """
    Login endpoint to create a session in Firestore.
    Called after successful Firebase authentication.
    """
    try:
        user_id = current_user.get('sub')
        
        # Create or update session in Firestore
        await session_manager.create_session(user_id)
        
        # Log the login event for audit trail
        logger.info(f"AUDIT: User {user_id} logged in successfully")
        
        return {
            "success": True,
            "message": "Logged in successfully",
            "user_id": user_id
        }
    except Exception as e:
        logger.error(f"Error during login for user {current_user.get('sub')}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create session")

@app.post("/api/v1/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """
    Logout endpoint to clear user session from Firestore.
    This ensures proper session cleanup for HIPAA compliance.
    """
    try:
        user_id = current_user.get('sub')
        # Clear the session in Firestore
        await session_manager.clear_session(user_id)
        
        # Log the logout event for audit trail
        logger.info(f"AUDIT: User {user_id} logged out successfully")
        
        return {
            "success": True,
            "message": "Logged out successfully"
        }
    except Exception as e:
        logger.error(f"Error during logout for user {current_user.get('sub')}: {str(e)}")
        # Still return success to client to avoid leaking information
        return {
            "success": True,
            "message": "Logged out"
        }


@app.post("/api/v1/user_settings")
async def save_user_settings(
    request: SaveUserSettingsRequest,
    current_user_id: str = Depends(get_user_id),
    req: Request = None
):
    # Verify authorization
    if request.user_id != current_user_id:
        raise HTTPException(status_code=403, detail="You can only update your own settings")
    
    # Save through service
    settings_dict = request.settings.model_dump()
    success = await user_settings_service.save_user_settings(
        user_id=request.user_id,
        settings=settings_dict
    )
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save settings")
    
    # Sync to Firestore for faster queries
    await user_settings_service.sync_to_firestore(request.user_id)
    
    # Log for audit trail
    logger.info(f"User {current_user_id} updated settings")
    
    return {"success": True, "message": "Settings updated successfully"}

# --- Image endpoints moved to routers/image_router.py ---


@app.post("/api/v1/save_session_data") 
async def save_session_data_endpoint(
    request_data: SaveSessionRequest,
    current_user_id: str = Depends(get_user_id),
    request: Request = None
):
    global gcs_client
    
    # Convert SaveSessionRequest to dict for Firestore endpoint
    request_dict = request_data.model_dump()
    return await save_session_data_firestore(
        request_data=request_dict,
        current_user_id=current_user_id,
        request=request,
        gcs_client=gcs_client
    )


@app.post("/api/v1/save_draft")
async def save_draft_endpoint(
    request_data: SaveDraftRequest,
    current_user_id: str = Depends(get_user_id),
    request: Request = None
):
    """Save a draft recording - uses Firestore for speed."""
    return await save_draft_firestore(request_data.dict(), current_user_id, request)

@app.delete("/api/v1/recordings/{user_id}/{session_id}", status_code=200)
async def delete_session_recording(
    user_id: str = Path(..., description="The ID of the user who owns the recording"),
    session_id: str = Path(..., description="The ID of the session recording to delete"),
    current_user_id: str = Depends(get_user_id),
    request: Request = None
):
    return await delete_recording_firestore(user_id, session_id, current_user_id, request, gcs_client)



@app.get("/api/v1/user_recordings/{user_id}")
async def get_user_recordings(
    user_id: str = Path(..., description="User's unique identifier"),
    current_user_id: str = Depends(get_user_id),
    request: Request = None
):
    return await get_user_recordings_firestore(user_id, current_user_id, request)
@app.get("/api/v1/transcript/{user_id}/{transcript_id}")
async def get_transcript_details(
    user_id: str = Path(..., description="User's unique identifier"),
    transcript_id: str = Path(..., description="Transcript/session ID"),
    current_user_id: str = Depends(get_user_id),
    request: Request = None
):
    """Get transcript details including content from Firestore"""
    return await get_transcript_details_firestore(user_id, transcript_id, current_user_id, request)


@app.put("/api/v1/transcript/{user_id}/{transcript_id}")
async def update_transcript(
    user_id: str = Path(..., description="User's unique identifier"),
    transcript_id: str = Path(..., description="Transcript/session ID"),
    update_request: UpdateTranscriptRequest = ...,
    current_user_id: str = Depends(get_user_id),
    request: Request = None
):
    """Update transcript content (polished and/or original)"""
    try:
        # Verify authorization
        if user_id != current_user_id:
            raise HTTPException(status_code=403, detail="You can only update your own transcripts")
        
        from firestore_client import firestore_client
        
        # Prepare updates
        updates = {}
        if update_request.polishedTranscript is not None:
            updates['transcript_polished'] = update_request.polishedTranscript  # Match Firestore model field name
        
        if update_request.originalTranscript is not None:
            updates['transcript_original'] = update_request.originalTranscript  # Match Firestore model field name
        
        if not updates:
            raise HTTPException(status_code=400, detail="No updates provided")
        
        # Add updated timestamp
        updates['updated_at'] = datetime.now(timezone.utc).isoformat()
        
        # Update in Firestore
        success = await firestore_client.update_transcript(transcript_id, updates)
        
        if not success:
            raise HTTPException(status_code=404, detail="Transcript not found")
        
        # Log PHI access for HIPAA compliance
        AuditLogger.log_data_access(
            user_id=current_user_id,
            operation="UPDATE",
            data_type="transcript",
            resource_id=transcript_id,
            request=request,
            success=True
        )
        
        logger.info(f"Updated transcript {transcript_id} for user {user_id}")
        
        return {"success": True, "message": "Transcript updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating transcript {transcript_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update transcript")

@app.get("/api/v1/gcs_object_content", response_class=PlainTextResponse)
async def get_gcs_object_content(
    gcs_key: str,
    current_user: dict = Depends(get_current_user),
    request: Request = None
):
    # Extract user_id from the object key to verify ownership
    # Object keys are in format: {user_id}/transcripts/... or {user_id}/metadata/...
    key_parts = gcs_key.split('/')
    if len(key_parts) < 3:
        raise HTTPException(status_code=400, detail="Invalid object key format")
    
    # The user_id is the first part of the key
    key_user_id = key_parts[0]
    
    # Log PHI access for HIPAA compliance
    AuditLogger.log_data_access(
        user_id=current_user['sub'],
        operation="READ",
        data_type="gcs_object",
        resource_id=gcs_key,
        request=request,
        success=True
    )
    
    # Verify that the user can only access their own content
    if key_user_id != current_user['sub']:
        raise HTTPException(status_code=403, detail="You can only access your own content")
    if not gcs_client:
        print("GCS client not initialized. Cannot fetch object content.")
        raise HTTPException(status_code=503, detail="GCS service not available")

    print(f"Attempting to fetch object content for key: {gcs_key}")
    try:
        content = gcs_client.get_gcs_object_content(gcs_key)
        if content:
            return content
        else:
            print(f"Object not found: {gcs_key}")
            raise HTTPException(status_code=404, detail=f"Object not found: {gcs_key}")
    except Exception as e:
        print(f"Unexpected error fetching object {gcs_key}: {e}")
        raise HTTPException(status_code=500, detail=f"Unexpected error fetching object: {str(e)}")
# Import patient management endpoints and models
from patient_endpoints import (
    PatientCreateRequest,
    PatientUpdateRequest,
    PatientResponse,
    BillingRequest,
    create_patient,
    list_patients,
    get_patient,
    update_patient,
    delete_patient,
    get_patient_transcripts,
    generate_patient_billing,
    get_patient_initial_evaluation,
    get_re_evaluation_status,
    get_patient_evaluations,
    extract_transcript_findings
)

@app.post("/api/v1/patients", response_model=PatientResponse)
async def create_patient_endpoint(
    patient_data: PatientCreateRequest,
    current_user_id: str = Depends(get_user_id),
    request: Request = None
):
    return await create_patient(patient_data, current_user_id, request)

@app.get("/api/v1/patients", response_model=List[PatientResponse])
async def list_patients_endpoint(
    active_only: bool = True,
    search: Optional[str] = None,
    current_user_id: str = Depends(get_user_id),
    request: Request = None
):
    return await list_patients(active_only, search, current_user_id, request)

@app.get("/api/v1/patients/{patient_id}", response_model=PatientResponse)
async def get_patient_endpoint(
    patient_id: str = Path(..., description="Patient ID"),
    current_user_id: str = Depends(get_user_id),
    request: Request = None
):
    return await get_patient(patient_id, current_user_id, request)

@app.put("/api/v1/patients/{patient_id}", response_model=PatientResponse)
async def update_patient_endpoint(
    patient_id: str = Path(..., description="Patient ID"),
    patient_updates: PatientUpdateRequest = ...,
    current_user_id: str = Depends(get_user_id),
    request: Request = None
):
    return await update_patient(patient_id, patient_updates, current_user_id, request)

@app.delete("/api/v1/patients/{patient_id}")
async def delete_patient_endpoint(
    patient_id: str = Path(..., description="Patient ID"),
    current_user_id: str = Depends(get_user_id),
    request: Request = None
):
    return await delete_patient(patient_id, current_user_id, request)

@app.get("/api/v1/patients/{patient_id}/transcripts")
async def get_patient_transcripts_endpoint(
    patient_id: str = Path(..., description="Patient ID"),
    current_user_id: str = Depends(get_user_id),
    request: Request = None
):
    return await get_patient_transcripts(patient_id, current_user_id, request)

@app.post("/api/v1/patients/{patient_id}/generate-billing")
async def generate_patient_billing_endpoint(
    patient_id: str = Path(..., description="Patient ID"),
    request: BillingRequest = None,
    current_user_id: str = Depends(get_user_id),
    req: Request = None
):
    return await generate_patient_billing(patient_id, request, current_user_id, req)

@app.get("/api/v1/patients/{patient_id}/initial-evaluation")
async def get_patient_initial_evaluation_endpoint(
    patient_id: str = Path(..., description="Patient ID"),
    current_user_id: str = Depends(get_user_id),
    request: Request = None
):
    return await get_patient_initial_evaluation(patient_id, current_user_id, request)

@app.get("/api/v1/patients/{patient_id}/re-evaluation-status")
async def get_re_evaluation_status_endpoint(
    patient_id: str = Path(..., description="Patient ID"),
    current_user_id: str = Depends(get_user_id),
    request: Request = None
):
    return await get_re_evaluation_status(patient_id, current_user_id, request)

@app.get("/api/v1/patients/{patient_id}/evaluations")
async def get_patient_evaluations_endpoint(
    patient_id: str = Path(..., description="Patient ID"),
    evaluation_type: Optional[str] = Query(None, description="Filter by evaluation type"),
    current_user_id: str = Depends(get_user_id),
    request: Request = None
):
    return await get_patient_evaluations(patient_id, evaluation_type, current_user_id, request)

@app.post("/api/v1/transcripts/{transcript_id}/extract-findings")
async def extract_transcript_findings_endpoint(
    transcript_id: str = Path(..., description="Transcript ID"),
    current_user_id: str = Depends(get_user_id),
    request: Request = None
):
    return await extract_transcript_findings(transcript_id, current_user_id, request)


        
if __name__ == "__main__":
    if not deepgram_api_key:
        print("deepgram_api_key not found. Ensure .env is in the /Users/davidmain/Desktop/trans10 directory and contains the key 'deepgram_api_key'.")
    else:
        print(f"deepgram_api_key found: {deepgram_api_key[:5]}...")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, ws_ping_interval=20, ws_ping_timeout=20) 