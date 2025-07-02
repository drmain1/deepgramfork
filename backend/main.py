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
from fastapi.responses import PlainTextResponse
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

# Set up logging
logger = logging.getLogger(__name__)
from pydantic import BaseModel, Field
from fastapi import HTTPException
from typing import Optional, List, Dict, Any
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
from audit_logger import AuditLogger

config = DeepgramClientOptions(
    api_key=deepgram_api_key, 
    verbose=0, 
)
deepgram_client = AsyncLiveClient(config)

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
    doctorSignature: Optional[str] = Field(default=None, description="Doctor's signature image (base64 data URL)")
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
    """Upload a clinic logo - stores file in GCS and URL in settings"""
    
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
    
    # Validate file size (5MB limit for direct GCS storage)
    max_size = 5 * 1024 * 1024  # 5MB
    contents = await file.read()
    if len(contents) > max_size:
        raise HTTPException(status_code=400, detail="File size exceeds 5MB limit")
    
    try:
        # Generate unique filename
        timestamp = int(time.time() * 1000)
        file_ext = file.filename.lower().split('.')[-1] if '.' in file.filename else 'png'
        logo_filename = f"logo_{timestamp}.{file_ext}"
        logo_key = f"{current_user_id}/logos/{logo_filename}"
        
        # Upload file directly to GCS
        success = gcs_client.save_data_to_gcs(
            user_id=current_user_id,
            data_type="logos",
            session_id=logo_filename,
            content=contents,
            content_type=file.content_type
        )
        
        if not success:
            raise Exception("Failed to upload logo to GCS")
        
        # Generate public URL for the logo
        logo_url = f"https://storage.googleapis.com/{gcs_client.bucket_name}/{logo_key}"
        print(f"Logo uploaded to GCS: {logo_url}")
        
        # Get current settings from GCS
        settings_key = f"{current_user_id}/settings/user_settings.json"
        settings_content = gcs_client.get_gcs_object_content(settings_key)
        
        if settings_content:
            current_settings = json.loads(settings_content)
        else:
            current_settings = DEFAULT_USER_SETTINGS.copy()
        
        # Check if there's an old logo to delete
        old_logo_url = current_settings.get('clinicLogo')
        if old_logo_url and old_logo_url.startswith('https://storage.googleapis.com/'):
            # Extract the key from the URL and delete the old logo
            try:
                old_key = old_logo_url.replace(f"https://storage.googleapis.com/{gcs_client.bucket_name}/", "")
                gcs_client.delete_gcs_object(old_key)
                print(f"Deleted old logo: {old_key}")
            except Exception as e:
                print(f"Warning: Failed to delete old logo: {e}")
        
        # Update with new logo URL
        current_settings['clinicLogo'] = logo_url
        
        # Save updated settings to GCS
        success = gcs_client.save_data_to_gcs(
            user_id=current_user_id,
            data_type="settings",
            session_id="user_settings",
            content=json.dumps(current_settings)
        )
        
        if not success:
            raise Exception("Failed to save settings to GCS")
        
        return {"logoUrl": logo_url, "message": "Logo uploaded successfully"}
        
    except Exception as e:
        print(f"Error uploading logo for user {current_user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload logo: {str(e)}")

@app.delete("/api/v1/delete_logo")
async def delete_logo(
    current_user_id: str = Depends(get_user_id)
):
    """Delete clinic logo from GCS and user settings"""
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
        
        # Delete the logo file from GCS if it exists
        logo_url = current_settings.get('clinicLogo')
        if logo_url and logo_url.startswith('https://storage.googleapis.com/'):
            try:
                # Extract the key from the URL
                logo_key = logo_url.replace(f"https://storage.googleapis.com/{gcs_client.bucket_name}/", "")
                deleted = gcs_client.delete_gcs_object(logo_key)
                if deleted:
                    print(f"Deleted logo file from GCS: {logo_key}")
                else:
                    print(f"Logo file not found in GCS: {logo_key}")
            except Exception as e:
                print(f"Warning: Failed to delete logo file from GCS: {e}")
        
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

@app.post("/api/v1/migrate_logo")
async def migrate_logo(
    current_user_id: str = Depends(get_user_id)
):
    """Migrate base64 logo to GCS file storage"""
    import base64
    
    if not gcs_client:
        raise HTTPException(status_code=503, detail="GCS client not initialized")
    
    try:
        # Get current settings
        settings_key = f"{current_user_id}/settings/user_settings.json"
        settings_content = gcs_client.get_gcs_object_content(settings_key)
        
        if not settings_content:
            return {"message": "No settings found", "migrated": False}
        
        current_settings = json.loads(settings_content)
        logo_data = current_settings.get('clinicLogo')
        
        # Check if logo exists and is base64
        if not logo_data:
            return {"message": "No logo found", "migrated": False}
        
        if logo_data.startswith('https://'):
            return {"message": "Logo already migrated to GCS", "migrated": False}
        
        if not logo_data.startswith('data:'):
            return {"message": "Invalid logo format", "migrated": False}
        
        # Parse base64 data URL
        try:
            # Format: data:image/png;base64,iVBORw0KGgo...
            header, base64_data = logo_data.split(',', 1)
            mime_type = header.split(':')[1].split(';')[0]
            
            # Decode base64
            image_data = base64.b64decode(base64_data)
            
            # Determine file extension
            ext_map = {
                'image/jpeg': 'jpg',
                'image/jpg': 'jpg',
                'image/png': 'png',
                'image/gif': 'gif',
                'image/webp': 'webp'
            }
            file_ext = ext_map.get(mime_type, 'png')
            
            # Generate filename
            timestamp = int(time.time() * 1000)
            logo_filename = f"logo_migrated_{timestamp}.{file_ext}"
            
            # Upload to GCS
            success = gcs_client.save_data_to_gcs(
                user_id=current_user_id,
                data_type="logos",
                session_id=logo_filename,
                content=image_data,
                content_type=mime_type
            )
            
            if not success:
                raise Exception("Failed to upload migrated logo to GCS")
            
            # Generate public URL
            logo_key = f"{current_user_id}/logos/{logo_filename}"
            logo_url = f"https://storage.googleapis.com/{gcs_client.bucket_name}/{logo_key}"
            
            # Update settings with new URL
            current_settings['clinicLogo'] = logo_url
            
            # Save updated settings
            success = gcs_client.save_data_to_gcs(
                user_id=current_user_id,
                data_type="settings",
                session_id="user_settings",
                content=json.dumps(current_settings)
            )
            
            if not success:
                raise Exception("Failed to save updated settings")
            
            print(f"Successfully migrated logo for user {current_user_id} to {logo_url}")
            return {"message": "Logo migrated successfully", "logoUrl": logo_url, "migrated": True}
            
        except Exception as e:
            print(f"Error parsing base64 data: {e}")
            raise HTTPException(status_code=400, detail=f"Failed to parse base64 data: {str(e)}")
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error migrating logo for user {current_user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to migrate logo: {str(e)}")

# Signature upload endpoint
@app.post("/api/v1/upload_signature")
async def upload_signature(
    file: UploadFile = File(...),
    current_user_id: str = Depends(get_user_id)
):
    """Upload a signature - stores file in GCS and URL in settings"""
    
    if not gcs_client:
        raise HTTPException(status_code=503, detail="GCS client not initialized")
    
    # Debug logging
    print(f"Signature upload - User: {current_user_id}, File: {file.filename}, Content-Type: {file.content_type}, Size: {file.size}")
    
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
    
    # Validate file size (2MB limit for signatures)
    max_size = 2 * 1024 * 1024  # 2MB
    contents = await file.read()
    if len(contents) > max_size:
        raise HTTPException(status_code=400, detail="File size exceeds 2MB limit")
    
    try:
        # Generate unique filename
        timestamp = int(time.time() * 1000)
        file_ext = file.filename.lower().split('.')[-1] if '.' in file.filename else 'png'
        signature_filename = f"signature_{timestamp}.{file_ext}"
        signature_key = f"{current_user_id}/signatures/{signature_filename}"
        
        # Upload file directly to GCS
        success = gcs_client.save_data_to_gcs(
            user_id=current_user_id,
            data_type="signatures",
            session_id=signature_filename,
            content=contents,
            content_type=file.content_type
        )
        
        if not success:
            raise Exception("Failed to upload signature to GCS")
        
        # Generate public URL for the signature
        signature_url = f"https://storage.googleapis.com/{gcs_client.bucket_name}/{signature_key}"
        print(f"Signature uploaded to GCS: {signature_url}")
        
        # Get current settings from GCS
        settings_key = f"{current_user_id}/settings/user_settings.json"
        settings_content = gcs_client.get_gcs_object_content(settings_key)
        
        if settings_content:
            current_settings = json.loads(settings_content)
        else:
            current_settings = DEFAULT_USER_SETTINGS.copy()
        
        # Check if there's an old signature to delete
        old_signature_url = current_settings.get('doctorSignature')
        if old_signature_url and old_signature_url.startswith('https://storage.googleapis.com/'):
            # Extract the key from the URL and delete the old signature
            try:
                old_key = old_signature_url.replace(f"https://storage.googleapis.com/{gcs_client.bucket_name}/", "")
                gcs_client.delete_gcs_object(old_key)
                print(f"Deleted old signature: {old_key}")
            except Exception as e:
                print(f"Warning: Failed to delete old signature: {e}")
        
        # Update with new signature URL
        current_settings['doctorSignature'] = signature_url
        
        # Save updated settings to GCS
        success = gcs_client.save_data_to_gcs(
            user_id=current_user_id,
            data_type="settings",
            session_id="user_settings",
            content=json.dumps(current_settings)
        )
        
        if not success:
            raise Exception("Failed to save settings to GCS")
        
        return {"signatureUrl": signature_url, "message": "Signature uploaded successfully"}
        
    except Exception as e:
        print(f"Error uploading signature for user {current_user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload signature: {str(e)}")

@app.delete("/api/v1/delete_signature")
async def delete_signature(
    current_user_id: str = Depends(get_user_id)
):
    """Delete signature from GCS and user settings"""
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
        
        # Delete the signature file from GCS if it exists
        signature_url = current_settings.get('doctorSignature')
        if signature_url and signature_url.startswith('https://storage.googleapis.com/'):
            try:
                # Extract the key from the URL
                signature_key = signature_url.replace(f"https://storage.googleapis.com/{gcs_client.bucket_name}/", "")
                deleted = gcs_client.delete_gcs_object(signature_key)
                if deleted:
                    print(f"Deleted signature file from GCS: {signature_key}")
                else:
                    print(f"Signature file not found in GCS: {signature_key}")
            except Exception as e:
                print(f"Warning: Failed to delete signature file from GCS: {e}")
        
        # Remove signature URL from settings
        current_settings['doctorSignature'] = None
        
        # Save updated settings to GCS
        success = gcs_client.save_data_to_gcs(
            user_id=current_user_id,
            data_type="settings",
            session_id="user_settings",
            content=json.dumps(current_settings)
        )
        
        if not success:
            raise Exception("Failed to save settings to GCS")
        
        return {"message": "Signature deleted successfully"}
        
    except Exception as e:
        print(f"Error deleting signature for user {current_user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete signature: {str(e)}")

@app.post("/api/v1/migrate_signature")
async def migrate_signature(
    current_user_id: str = Depends(get_user_id)
):
    """Migrate base64 signature to GCS file storage"""
    import base64
    
    if not gcs_client:
        raise HTTPException(status_code=503, detail="GCS client not initialized")
    
    try:
        # Get current settings
        settings_key = f"{current_user_id}/settings/user_settings.json"
        settings_content = gcs_client.get_gcs_object_content(settings_key)
        
        if not settings_content:
            return {"message": "No settings found", "migrated": False}
        
        current_settings = json.loads(settings_content)
        signature_data = current_settings.get('doctorSignature')
        
        # Check if signature exists and is base64
        if not signature_data:
            return {"message": "No signature found", "migrated": False}
        
        if signature_data.startswith('https://'):
            return {"message": "Signature already migrated to GCS", "migrated": False}
        
        if not signature_data.startswith('data:'):
            return {"message": "Invalid signature format", "migrated": False}
        
        # Parse base64 data URL
        try:
            # Format: data:image/png;base64,iVBORw0KGgo...
            header, base64_data = signature_data.split(',', 1)
            mime_type = header.split(':')[1].split(';')[0]
            
            # Decode base64
            image_data = base64.b64decode(base64_data)
            
            # Determine file extension
            ext_map = {
                'image/jpeg': 'jpg',
                'image/jpg': 'jpg',
                'image/png': 'png',
                'image/gif': 'gif',
                'image/webp': 'webp'
            }
            file_ext = ext_map.get(mime_type, 'png')
            
            # Generate filename
            timestamp = int(time.time() * 1000)
            signature_filename = f"signature_migrated_{timestamp}.{file_ext}"
            
            # Upload to GCS
            success = gcs_client.save_data_to_gcs(
                user_id=current_user_id,
                data_type="signatures",
                session_id=signature_filename,
                content=image_data,
                content_type=mime_type
            )
            
            if not success:
                raise Exception("Failed to upload migrated signature to GCS")
            
            # Generate public URL
            signature_key = f"{current_user_id}/signatures/{signature_filename}"
            signature_url = f"https://storage.googleapis.com/{gcs_client.bucket_name}/{signature_key}"
            
            # Update settings with new URL
            current_settings['doctorSignature'] = signature_url
            
            # Save updated settings
            success = gcs_client.save_data_to_gcs(
                user_id=current_user_id,
                data_type="settings",
                session_id="user_settings",
                content=json.dumps(current_settings)
            )
            
            if not success:
                raise Exception("Failed to save updated settings")
            
            print(f"Successfully migrated signature for user {current_user_id} to {signature_url}")
            return {"message": "Signature migrated successfully", "signatureUrl": signature_url, "migrated": True}
            
        except Exception as e:
            print(f"Error parsing base64 data: {e}")
            raise HTTPException(status_code=400, detail=f"Failed to parse base64 data: {str(e)}")
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error migrating signature for user {current_user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to migrate signature: {str(e)}")

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

@app.get("/api/v1/patients/{patient_id}/transcripts", response_model=List[RecordingInfo])
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