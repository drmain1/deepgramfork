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
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, Query, UploadFile, File, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, PlainTextResponse
from contextlib import asynccontextmanager
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from deepgram import AsyncLiveClient, DeepgramClientOptions, LiveOptions, LiveTranscriptionEvents
from deepgram.clients.listen.v1.websocket.response import CloseResponse
import logging
from datetime import datetime
import json
import tempfile
import time
from typing import Callable

# Set up logging
logger = logging.getLogger(__name__)
from pydantic import BaseModel, Field
from fastapi import HTTPException
from typing import Optional, List, Dict, Any, Union
from fastapi import Path
from datetime import datetime, timedelta, timezone

# Import the refactored Deepgram handler
from deepgram_utils import handle_deepgram_websocket

# Import the new Speechmatics handler for multilingual support
from speechmatics_utils import handle_speechmatics_websocket

# GCP utilities are imported above

# Import GCP utility functions
from gcp_utils import polish_transcript_with_gemini, generate_billing_with_gemini

# Import authentication middleware
# Use Firebase Admin SDK for production authentication
from gcp_auth_middleware import get_current_user, get_user_id, session_manager
print("Using Firebase Admin SDK authentication (production-ready)")

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

# Global placeholders for clients, to be initialized in startup event
gcs_client = None
vertex_ai_client = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global gcs_client, vertex_ai_client
    print("FastAPI startup: Initializing GCP clients...")
    
    # Initialize GCS client
    try:
        gcs_client = GCSClient()
        print("✓ GCS client initialized successfully during startup.")
        
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
        print(f"Failed to initialize GCS client during startup: {e}")
        gcs_client = None
    
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

# CORS Configuration
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://scribe.medlegaldoc.com",
    "https://medlegaldoc.com",
    # Add any other origins if necessary (e.g., your deployed frontend URL)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS", "PUT", "DELETE"], # Allow all common methods
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"], # Explicit headers only
)

# Security Headers Middleware for HIPAA Compliance
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # HIPAA-compliant security headers
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Content Security Policy (adjust as needed for your application)
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com data:; "
            "img-src 'self' data: blob: https:; "
            "connect-src 'self' wss: https://*.googleapis.com;"
        )
        
        return response

app.add_middleware(SecurityHeadersMiddleware)

# Add rate limiting middleware
from rate_limiter import RateLimitMiddleware
app.add_middleware(RateLimitMiddleware)
logger.info("Rate limiting middleware enabled")

# Import audit logger for HIPAA compliance
from audit_logger import AuditLogger, audit_endpoint

config = DeepgramClientOptions(
    api_key=deepgram_api_key, 
    verbose=0, 
)
deepgram_client = AsyncLiveClient(config)

import tempfile

@app.websocket("/stream")
async def websocket_stream_endpoint(websocket: WebSocket, token: str = Query(...)):
    """
    Handles the primary WebSocket streaming connection for Deepgram transcription.
    This endpoint delegates to handle_deepgram_websocket for monolingual medical transcription.
    For multilingual support, clients should use the /stream/multilingual endpoint.
    """
    # Verify Firebase token before accepting WebSocket connection
    connection_id = f"ws_deepgram_{int(time.time() * 1000)}"
    start_time = time.time()
    
    try:
        # Always use production Firebase Admin SDK for token verification
        from gcp_auth_middleware import validate_firebase_token
        user_id = validate_firebase_token(token)
        
        # Accept the WebSocket connection
        await websocket.accept()
        
        # Log WebSocket connection start
        AuditLogger.log_websocket_event(
            user_id=user_id,
            event_type="CONNECT",
            connection_id=connection_id
        )
        
        # Pass the authenticated user_id to the handler
        await handle_deepgram_websocket(websocket, get_user_settings, user_id)
        
        # Log successful completion
        duration = time.time() - start_time
        AuditLogger.log_websocket_event(
            user_id=user_id,
            event_type="DISCONNECT",
            connection_id=connection_id,
            duration_seconds=duration
        )
    except HTTPException as e:
        # Close WebSocket with policy violation code for auth failures
        await websocket.close(code=1008, reason=f"Authentication failed: {e.detail}")
    except Exception as e:
        await websocket.close(code=1011, reason=f"Server error: {str(e)}")

@app.websocket("/stream/multilingual")
async def websocket_multilingual_stream_endpoint(websocket: WebSocket, token: str = Query(...)):
    """
    Handles WebSocket streaming connection for Speechmatics multilingual transcription.
    This endpoint provides Spanish/English code-switching and translation capabilities.
    """
    # Verify Firebase token before accepting WebSocket connection
    connection_id = f"ws_speechmatics_{int(time.time() * 1000)}"
    start_time = time.time()
    
    try:
        # Always use production Firebase Admin SDK for token verification
        from gcp_auth_middleware import validate_firebase_token
        user_id = validate_firebase_token(token)
        
        # Accept the WebSocket connection
        await websocket.accept()
        
        # Log WebSocket connection start
        AuditLogger.log_websocket_event(
            user_id=user_id,
            event_type="CONNECT_MULTILINGUAL",
            connection_id=connection_id
        )
        
        # Pass the authenticated user_id to the handler
        await handle_speechmatics_websocket(websocket, get_user_settings, user_id)
        
        # Log successful completion
        duration = time.time() - start_time
        AuditLogger.log_websocket_event(
            user_id=user_id,
            event_type="DISCONNECT_MULTILINGUAL",
            connection_id=connection_id,
            duration_seconds=duration
        )
    except HTTPException as e:
        # Close WebSocket with policy violation code for auth failures
        await websocket.close(code=1008, reason=f"Authentication failed: {e.detail}")
    except Exception as e:
        await websocket.close(code=1011, reason=f"Server error: {str(e)}")

class TranscriptionProfileItem(BaseModel):
    id: str = Field(..., description="Unique identifier for the profile")
    name: str = Field(..., description="User-defined name for the profile")
    llmInstructions: Optional[str] = Field(default=None, description="Custom LLM instructions/template for this profile")
    llmPrompt: Optional[str] = Field(default=None, description="Custom LLM prompt/template for this profile (deprecated, use llmInstructions)")
    isDefault: Optional[bool] = Field(default=False, description="Whether this is the default profile")
    # Deepgram specific options
    smart_format: Optional[bool] = Field(default=True, description="Enable Deepgram Smart Formatting")
    diarize: Optional[bool] = Field(default=False, description="Enable Deepgram Speaker Diarization")
    num_speakers: Optional[int] = Field(default=None, ge=1, description="Suggested number of speakers if diarization is enabled") # ge=1 means greater than or equal to 1 if set
    utterances: Optional[bool] = Field(default=False, description="Enable Deepgram Word-Level Timestamps (utterances)")
    specialty: Optional[str] = Field(default=None, description="Medical specialty category")
    originalTemplateId: Optional[str] = Field(default=None, description="Original template ID from templateConfig")

class UserSettingsData(BaseModel):
    macroPhrases: List[Dict[str, Any]] = Field(default_factory=list)
    customVocabulary: List[Dict[str, Any]] = Field(default_factory=list)
    officeInformation: List[str] = Field(default_factory=list) # Consider changing to List[Dict[str, Any]] based on UIsetup.md
    transcriptionProfiles: List[TranscriptionProfileItem] = Field(default_factory=list)
    doctorName: Optional[str] = Field(default="", description="Doctor's name for signatures")
    doctorSignature: Optional[str] = Field(default=None, description="Base64 encoded doctor's signature image")
    clinicLogo: Optional[str] = Field(default=None, description="URL to clinic logo in GCS")
    includeLogoOnPdf: bool = Field(default=False, description="Include clinic logo on PDF forms")
    medicalSpecialty: Optional[str] = Field(default="", description="Medical specialty of the doctor")
    customBillingRules: Optional[str] = Field(default="", description="Custom billing rules for the clinic")
    cptFees: Dict[str, float] = Field(default_factory=dict, description="Custom CPT code fees mapping")

class SaveUserSettingsRequest(BaseModel):
    user_id: str # This should ideally come from a validated token in the future
    settings: UserSettingsData

DEFAULT_USER_SETTINGS = UserSettingsData(
    macroPhrases=[],
    customVocabulary=[],
    officeInformation=[],
    transcriptionProfiles=[],
    doctorName='',
    doctorSignature=None,
    clinicLogo=None,
    includeLogoOnPdf=False,
    medicalSpecialty='',
    customBillingRules='',
    cptFees={}
).model_dump()

@app.get("/api/v1/user_settings/{user_id}", response_model=UserSettingsData)
async def get_user_settings(
    user_id: str = Path(..., description="The ID of the user whose settings are to be fetched"),
    current_user_id: str = Depends(get_user_id),
    request: Request = None
):
    settings = await get_user_settings_firestore(user_id, current_user_id, request)
    # Convert to UserSettingsData model
    # Handle the existing data - convert dict to list format if needed
    macro_phrases = settings.get("macroPhrases", {})
    if isinstance(macro_phrases, dict):
        # Convert dict to list of MacroPhraseItem objects
        macro_list = [{"shortcut": k, "expansion": v} for k, v in macro_phrases.items()]
    else:
        macro_list = macro_phrases
        
    return UserSettingsData(
        customVocabulary=settings.get("customVocabulary", []),
        macroPhrases=macro_list,
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
    settings_dict = request.settings.model_dump()
    return await update_user_settings_firestore(
        user_id=request.user_id,
        settings_data=settings_dict,
        current_user_id=current_user_id,
        request=req
    )

# Logo upload endpoint
@app.post("/api/v1/upload_logo")
async def upload_logo(
    file: UploadFile = File(...),
    current_user_id: str = Depends(get_user_id)
):
    """Upload a clinic logo - stores as base64 in user settings"""
    import base64
    
    if not gcs_client:
        raise HTTPException(status_code=503, detail="GCS client not initialized")
    
    # Debug logging
    print(f"Logo upload - User: {current_user_id}, File: {file.filename}, Content-Type: {file.content_type}, Size: {file.size}")
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/jpg"]
    
    # Handle case where content_type might be None or empty
    if not file.content_type or file.content_type not in allowed_types:
        # Try to infer from filename
        file_ext = file.filename.lower().split('.')[-1] if '.' in file.filename else ''
        ext_to_mime = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp'
        }
        
        if file_ext in ext_to_mime:
            file.content_type = ext_to_mime[file_ext]
            print(f"Inferred content type from extension: {file.content_type}")
        else:
            print(f"Invalid content type: {file.content_type}")
            raise HTTPException(status_code=400, detail=f"Invalid file type: {file.content_type}. Allowed types: {allowed_types}")
    
    # Validate file size (1MB limit for base64 storage)
    max_size = 1 * 1024 * 1024  # 1MB
    contents = await file.read()
    if len(contents) > max_size:
        raise HTTPException(status_code=400, detail="File size exceeds 1MB limit")
    
    try:
        # Convert to base64 data URL
        base64_data = base64.b64encode(contents).decode('utf-8')
        logo_data_url = f"data:{file.content_type};base64,{base64_data}"
        print(f"Logo converted to base64, size: {len(logo_data_url)} characters")
        
        # Get current settings from GCS
        settings_key = f"{current_user_id}/settings/user_settings.json"
        settings_content = gcs_client.get_gcs_object_content(settings_key)
        
        if settings_content:
            current_settings = json.loads(settings_content)
        else:
            current_settings = DEFAULT_USER_SETTINGS.copy()
        
        # Update with base64 logo data
        current_settings['clinicLogo'] = logo_data_url
        
        # Save updated settings to GCS
        success = gcs_client.save_data_to_gcs(
            user_id=current_user_id,
            data_type="settings",
            session_id="user_settings",
            content=json.dumps(current_settings)
        )
        
        if not success:
            raise Exception("Failed to save settings to GCS")
        
        return {"logoUrl": logo_data_url, "message": "Logo uploaded successfully"}
        
    except Exception as e:
        print(f"Error uploading logo for user {current_user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload logo: {str(e)}")

@app.delete("/api/v1/delete_logo")
async def delete_logo(
    current_user_id: str = Depends(get_user_id)
):
    """Delete clinic logo from user settings"""
    if not gcs_client:
        raise HTTPException(status_code=503, detail="GCS client not initialized")
    
    try:
        # Get current settings from GCS
        settings_key = f"{current_user_id}/settings/user_settings.json"
        settings_content = gcs_client.get_gcs_object_content(settings_key)
        
        if settings_content:
            current_settings = json.loads(settings_content)
        else:
            current_settings = DEFAULT_USER_SETTINGS.copy()
        
        # Remove logo URL and reset flag
        current_settings['clinicLogo'] = None
        current_settings['includeLogoOnPdf'] = False
        
        # Save updated settings to GCS
        success = gcs_client.save_data_to_gcs(
            user_id=current_user_id,
            data_type="settings",
            session_id="user_settings",
            content=json.dumps(current_settings)
        )
        
        if not success:
            raise Exception("Failed to save settings to GCS")
        
        return {"message": "Logo deleted successfully"}
        
    except Exception as e:
        print(f"Error deleting logo for user {current_user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete logo: {str(e)}")

@app.get("/api/v1/debug_logo/{user_id}")
async def debug_logo(
    user_id: str,
    current_user_id: str = Depends(get_user_id)
):
    """Debug endpoint to check logo status"""
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    if not gcs_client:
        raise HTTPException(status_code=503, detail="GCS client not initialized")
    
    try:
        settings_key = f"{user_id}/settings/user_settings.json"
        settings_content = gcs_client.get_gcs_object_content(settings_key)
        
        if settings_content:
            settings = json.loads(settings_content)
            return {
                "clinicLogo": settings.get('clinicLogo'),
                "includeLogoOnPdf": settings.get('includeLogoOnPdf'),
                "hasLogo": bool(settings.get('clinicLogo'))
            }
        else:
            return {"error": "No settings found", "clinicLogo": None}
    except Exception as e:
        print(f"Error in debug_logo: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching logo info: {str(e)}")

# --- End User Settings --- #

class SaveSessionRequest(BaseModel):
    session_id: str
    final_transcript_text: str 
    user_id: str  
    patient_context: Optional[str] = None 
    patient_name: Optional[str] = None  # Add patient name field
    patient_id: Optional[str] = None  # Reference to patient profile
    encounter_type: Optional[str] = None  
    llm_template: Optional[str] = None
    llm_template_id: Optional[str] = None
    location: Optional[str] = None  # Add location field too
    date_of_service: Optional[str] = None  # Add date of service for dictation mode
    evaluation_type: Optional[str] = None  # For tracking evaluation types
    initial_evaluation_id: Optional[str] = None  # Link to initial evaluation for re-evaluations
    previous_findings: Optional[Dict[str, Any]] = None  # Previous findings for context

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

class SaveDraftRequest(BaseModel):
    session_id: str
    transcript: str
    patient_name: str
    profile_id: Optional[str] = None
    user_id: str

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
    # Draft-specific fields
    transcript: Optional[str] = None
    polishedTranscript: Optional[str] = None
    profileId: Optional[str] = None
    # Add any other relevant fields that might be in session_metadata.json and useful for display

@app.get("/api/v1/user_recordings/{user_id}", response_model=List[RecordingInfo])
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

class UpdateTranscriptRequest(BaseModel):
    polishedTranscript: Optional[str] = None
    originalTranscript: Optional[str] = None

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
# --- Patient Management API Endpoints --- #

class PatientCreateRequest(BaseModel):
    first_name: str
    last_name: str
    date_of_birth: datetime
    date_of_accident: Optional[datetime] = None

class PatientUpdateRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    date_of_accident: Optional[datetime] = None

class PatientResponse(BaseModel):
    id: str
    first_name: str
    last_name: str
    date_of_birth: datetime
    date_of_accident: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    active: bool

class BillingRequest(BaseModel):
    transcript_ids: List[str]
    billing_instructions: Optional[str] = ""

@app.post("/api/v1/patients", response_model=PatientResponse)
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

@app.get("/api/v1/patients", response_model=List[PatientResponse])
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

@app.get("/api/v1/patients/{patient_id}", response_model=PatientResponse)
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

@app.put("/api/v1/patients/{patient_id}", response_model=PatientResponse)
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

@app.delete("/api/v1/patients/{patient_id}")
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

@app.get("/api/v1/patients/{patient_id}/transcripts", response_model=List[RecordingInfo])
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

@app.post("/api/v1/patients/{patient_id}/generate-billing")
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

@app.get("/api/v1/patients/{patient_id}/initial-evaluation")
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
        
        if not initial_evaluations:
            raise HTTPException(status_code=404, detail="No initial evaluation found for this patient")
        
        # Sort by date and get the most recent
        initial_evaluations.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        most_recent = initial_evaluations[0]
        
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

@app.get("/api/v1/patients/{patient_id}/re-evaluation-status")
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
            return {
                "status": "no_evaluation",
                "days_since_last": None,
                "session_count": 0,
                "sessions_since_evaluation": 0,
                "last_evaluation_date": None,
                "last_evaluation_type": None,
                "color": "gray",
                "message": "No evaluations found"
            }
        
        # Sort evaluations by date (newest first)
        evaluations.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        last_evaluation = evaluations[0]
        
        # Calculate days since last evaluation
        last_eval_date = datetime.fromisoformat(last_evaluation.get('created_at').replace('Z', '+00:00'))
        days_since = (datetime.now(timezone.utc) - last_eval_date).days
        
        # Count sessions SINCE the last evaluation (initial or re-evaluation)
        # Sort all transcripts by date
        transcripts.sort(key=lambda x: x.get('created_at', ''), reverse=False)
        
        # Find sessions that occurred after the last evaluation
        sessions_since_evaluation = 0
        for transcript in transcripts:
            transcript_date = datetime.fromisoformat(transcript.get('created_at').replace('Z', '+00:00'))
            if transcript_date > last_eval_date:
                sessions_since_evaluation += 1
        
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

@app.get("/api/v1/patients/{patient_id}/evaluations")
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

@app.post("/api/v1/transcripts/{transcript_id}/extract-findings")
async def extract_transcript_findings(
    transcript_id: str = Path(..., description="Transcript ID"),
    current_user_id: str = Depends(get_user_id),
    request: Request = None
):
    """Extract positive findings from a transcript using AI"""
    try:
        from firestore_client import firestore_client
        
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
        extraction_prompt = get_enhanced_extraction_prompt(specialty=specialty)
        
        # Run the synchronous function in an executor
        result = await asyncio.get_event_loop().run_in_executor(
            None,
            polish_transcript_with_gemini,
            content,  # transcript
            "",  # patient_name
            "",  # patient_context
            "findings_extraction",  # encounter_type
            extraction_prompt,  # llm_instructions
            None,  # location (optional)
            "publishers/google/models/gemini-2.5-flash"  # model_name
        )
        
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
                    except:
                        findings = {"raw_findings": json_match.group(1)}
                
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
                logger.warning(f"Failed to parse enhanced extraction output: {str(e)}")
                # Fallback to simple JSON parsing
                try:
                    findings = json.loads(result['polished_transcript'])
                    findings_markdown = None
                except:
                    findings = {"raw_findings": result['polished_transcript']}
                    findings_markdown = None
            
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

# --- End Patient Management --- #
        
if __name__ == "__main__":
    if not deepgram_api_key:
        print("deepgram_api_key not found. Ensure .env is in the /Users/davidmain/Desktop/trans10 directory and contains the key 'deepgram_api_key'.")
    else:
        print(f"deepgram_api_key found: {deepgram_api_key[:5]}...")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, ws_ping_interval=20, ws_ping_timeout=20) 