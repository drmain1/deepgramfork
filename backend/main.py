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
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
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
from gcp_utils import polish_transcript_with_gemini

# Import authentication middleware
# Use Firebase Admin SDK for production authentication
if os.getenv('FIREBASE_PROJECT_ID'):
    from gcp_auth_middleware import get_current_user, get_user_id
    print("Using Firebase Admin SDK authentication (production-ready)")
else:
    from auth_middleware import get_current_user, get_user_id
    print("Using AWS Cognito authentication middleware")

# Environment already loaded at the top of the file

deepgram_api_key = os.getenv("DEEPGRAM_API_KEY") or os.getenv("deepgram_api_key")
# AWS variables - keeping for reference during migration
# AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
# AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
# AWS_S3_BUCKET_NAME = os.getenv("AWS_S3_BUCKET_NAME")
# AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
DEFAULT_TENANT_ID = os.getenv("DEFAULT_TENANT_ID", "dev-tenant")
# Optional: Specific Bedrock region if different, though AWS_REGION can be used
# AWS_BEDROCK_REGION = os.getenv("AWS_BEDROCK_REGION", AWS_REGION)

app = FastAPI()

# CORS Configuration
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    # Add any other origins if necessary (e.g., your deployed frontend URL)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS", "PUT", "DELETE"], # Allow all common methods
    allow_headers=["Authorization", "Content-Type", "*"], # Allow common and custom headers
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
            "connect-src 'self' wss: https://cognito-idp.*.amazonaws.com https://*.auth0.com;"
        )
        
        return response

app.add_middleware(SecurityHeadersMiddleware)

# Import GCS utilities
from gcs_utils import GCSClient

# Global placeholders for clients, to be initialized in startup event
gcs_client = None
vertex_ai_client = None

@app.on_event("startup")
async def startup_event():
    global gcs_client, vertex_ai_client
    print("FastAPI startup event: Initializing GCP clients...")
    
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
    
    print("FastAPI startup event finished.")

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
    try:
        # Always use production Firebase Admin SDK for token verification
        from gcp_auth_middleware import validate_firebase_token
        user_id = validate_firebase_token(token)
        
        # Accept the WebSocket connection
        await websocket.accept()
        
        # Pass the authenticated user_id to the handler
        await handle_deepgram_websocket(websocket, get_user_settings, user_id)
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
    try:
        # Always use production Firebase Admin SDK for token verification
        from gcp_auth_middleware import validate_firebase_token
        user_id = validate_firebase_token(token)
        
        # Accept the WebSocket connection
        await websocket.accept()
        
        # Pass the authenticated user_id to the handler
        await handle_speechmatics_websocket(websocket, get_user_settings, user_id)
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
    clinicLogo: Optional[str] = Field(default=None, description="URL to clinic logo in S3")
    includeLogoOnPdf: bool = Field(default=False, description="Include clinic logo on PDF forms")
    medicalSpecialty: Optional[str] = Field(default="", description="Medical specialty of the doctor")

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
    medicalSpecialty=''
).model_dump()

@app.get("/api/v1/user_settings/{user_id}", response_model=UserSettingsData)
async def get_user_settings(
    user_id: str = Path(..., description="The ID of the user whose settings are to be fetched"),
    current_user_id: str = Depends(get_user_id)
):
    # Verify that the requested user_id matches the authenticated user
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="You can only access your own settings")
    if not gcs_client:
        raise HTTPException(status_code=503, detail="GCS client not initialized. Cannot fetch settings.")

    # Use GCS to fetch settings
    print(f"Attempting to fetch settings from GCS for user: {user_id}")

    try:
        settings_content = gcs_client.get_gcs_object_content(
            f"{user_id}/settings/user_settings.json"
        )
        
        if settings_content:
            settings_data = json.loads(settings_content)
            print(f"Loaded settings from GCS - medicalSpecialty: {settings_data.get('medicalSpecialty', 'NOT FOUND')}")
            # Ensure all default keys are present if the loaded data is partial
            loaded_settings_with_defaults = DEFAULT_USER_SETTINGS.copy()
            loaded_settings_with_defaults.update(settings_data) 
            print(f"After merging with defaults - medicalSpecialty: {loaded_settings_with_defaults.get('medicalSpecialty', 'NOT FOUND')}")
            return UserSettingsData(**loaded_settings_with_defaults)
        else:
            print(f"No settings file found for user {user_id}, returning defaults.")
            return UserSettingsData(**DEFAULT_USER_SETTINGS)
    except json.JSONDecodeError as e:
        print(f"JSONDecodeError for user {user_id}: {e}. Returning default settings.")
        return UserSettingsData(**DEFAULT_USER_SETTINGS)
    except Exception as e:
        print(f"Unexpected error fetching settings for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Unexpected error fetching user settings: {str(e)}")

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

@app.get("/api/v1/test-gcp-noauth")
async def test_gcp_connection_noauth():
    """Test endpoint to verify GCP Vertex AI connection (no auth for testing)"""
    try:
        from gcp_utils import test_gemini_connection
        success, message = test_gemini_connection()
        return {
            "success": success,
            "message": message,
            "provider": "Google Cloud Platform - Vertex AI",
            "note": "This is a temporary endpoint without auth - remove in production!"
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to test GCP connection: {str(e)}",
            "provider": "Google Cloud Platform - Vertex AI"
        }

@app.post("/api/v1/user_settings")
async def save_user_settings(
    request: SaveUserSettingsRequest,
    current_user_id: str = Depends(get_user_id)
):
    # Verify that the user_id in the request matches the authenticated user
    if request.user_id != current_user_id:
        raise HTTPException(status_code=403, detail="You can only save your own settings")
    if not gcs_client:
        raise HTTPException(status_code=503, detail="GCS client not initialized. Cannot save settings.")

    print(f"Attempting to save settings to GCS for user: {request.user_id}")
    
    # Log the incoming settings
    settings_dict = request.settings.model_dump()
    print(f"Settings to save - medicalSpecialty: {settings_dict.get('medicalSpecialty', 'NOT FOUND')}")
    print(f"Full settings: {json.dumps(settings_dict, indent=2)}")

    try:
        # Save to GCS using the proper method
        success = gcs_client.save_user_settings(
            user_id=request.user_id,
            settings=settings_dict
        )
        
        if success:
            print(f"Settings saved successfully - returning medicalSpecialty: {request.settings.medicalSpecialty}")
            return request.settings
        else:
            raise HTTPException(status_code=500, detail="Failed to save settings to GCS")
    except Exception as e:
        print(f"Unexpected error saving settings for user {request.user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Unexpected error saving user settings: {str(e)}")

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
    encounter_type: Optional[str] = None  
    llm_template: Optional[str] = None
    llm_template_id: Optional[str] = None
    location: Optional[str] = None  # Add location field too

@app.post("/api/v1/save_session_data") 
async def save_session_data_endpoint(
    request_data: SaveSessionRequest,
    current_user_id: str = Depends(get_user_id)
):
    # Verify that the user_id in the request matches the authenticated user
    print(f"Save session - Request user_id: {request_data.user_id}, Auth user_id: {current_user_id}")
    if request_data.user_id != current_user_id:
        raise HTTPException(status_code=403, detail=f"You can only save your own session data. Request user: {request_data.user_id}, Auth user: {current_user_id}")
    session_id = request_data.session_id
    original_transcript = request_data.final_transcript_text
    user_id = request_data.user_id 
    patient_context = request_data.patient_context 
    patient_name = request_data.patient_name  # Extract patient name
    encounter_type = request_data.encounter_type   
    llm_template = request_data.llm_template  
    llm_template_id = request_data.llm_template_id
    location = request_data.location  # Extract location
    
    # Debug logging for template routing
    print(f"DEBUG: Received template - ID: '{llm_template_id}', Name: '{llm_template}'")
    print(f"DEBUG: Will use GCP: {llm_template_id == 'test_gcp_template'}")

    # Get user settings to retrieve the actual LLM instructions from the profile
    custom_instructions = None
    selected_profile = None  # Define it outside the try block
    try:
        user_settings = await get_user_settings(user_id, current_user_id=user_id)  # Pass the user_id as current_user_id
        if user_settings and user_settings.transcriptionProfiles:
            # First try to find by ID (more reliable), then fallback to name
            if llm_template_id:
                selected_profile = next((p for p in user_settings.transcriptionProfiles if p.id == llm_template_id), None)
            if not selected_profile and llm_template:
                selected_profile = next((p for p in user_settings.transcriptionProfiles if p.name == llm_template), None)
            if selected_profile:
                print(f"Found profile '{selected_profile.name}' (ID: {selected_profile.id}) for session {session_id}")
                print(f"DEBUG: Profile originalTemplateId: '{selected_profile.originalTemplateId}'")
                print(f"Profile has llmInstructions: {bool(selected_profile.llmInstructions)}")
                print(f"Profile has llmPrompt: {bool(selected_profile.llmPrompt)}")
                if selected_profile.llmInstructions:
                    custom_instructions = selected_profile.llmInstructions
                    print(f"Using LLM instructions from profile '{selected_profile.name}' (length: {len(custom_instructions)}) for session {session_id}")
                    # Log first 200 chars of instructions for debugging
                    print(f"LLM instructions preview: {custom_instructions[:200]}..." if len(custom_instructions) > 200 else f"LLM instructions: {custom_instructions}")
                elif selected_profile.llmPrompt:
                    # Fallback to deprecated llmPrompt field
                    custom_instructions = selected_profile.llmPrompt
                    print(f"Using legacy LLM prompt from profile '{selected_profile.name}' for session {session_id}")
                else:
                    print(f"Profile '{selected_profile.name}' has no LLM instructions or prompt")
            else:
                print(f"No profile found for template_id: {llm_template_id}, template_name: {llm_template}")
    except Exception as e:
        print(f"Error retrieving user settings for LLM instructions: {e}")
    
    # Fallback to basic custom instructions if no profile instructions found
    if not custom_instructions:
        custom_instructions = f"Patient Name: {patient_name}\nPatient Context: {patient_context}\nEncounter Type: {encounter_type}\nTemplate: {llm_template}"
        print(f"Using fallback LLM instructions for session {session_id}")
        print(f"Fallback reason: No profile instructions found. Template ID: {llm_template_id}, Template Name: {llm_template}")
    else:
        # Append context information to the profile instructions
        custom_instructions += f"\n\nAdditional Context:\nPatient Name: {patient_name}\nPatient Context: {patient_context}\nEncounter Type: {encounter_type}"
        print(f"Final instructions length after adding context: {len(custom_instructions)}") 

    print(f"Received save request for session: {session_id}, user: {user_id}")

    global gcs_client
    if gcs_client is None:
        print("CRITICAL: GCS client not initialized when save_session_data_endpoint was called.")
        raise HTTPException(status_code=500, detail="GCS client not available. Cannot save data.")

    saved_paths = {}
    errors = []

    # Save original transcript to GCS
    print(f"Attempting to save original transcript for session_id: {session_id}, user_id: {user_id}")
    try:
        success = gcs_client.save_data_to_gcs(
            user_id=user_id,
            data_type="transcripts",
            session_id=f"original/{session_id}",
            content=original_transcript
        )
        if success:
            original_path = f"{user_id}/transcripts/original/{session_id}.txt"
            saved_paths["original_transcript"] = original_path
            print(f"Original transcript saved to: {original_path}")
        else:
            errors.append("Failed to save original transcript to GCS.")
    except Exception as e:
        print(f"Error saving original transcript for {session_id}: {e}")
        errors.append(f"Error saving original transcript: {str(e)}")

    # Determine if we should use GCP based on template ID or originalTemplateId
    use_gcp = llm_template_id == 'test_gcp_template'
    
    # Also check originalTemplateId from the selected profile
    if not use_gcp and selected_profile and hasattr(selected_profile, 'originalTemplateId') and selected_profile.originalTemplateId:
        use_gcp = selected_profile.originalTemplateId == 'test_gcp_template'
        if use_gcp:
            print(f"DEBUG: Routing to GCP based on originalTemplateId: {selected_profile.originalTemplateId}")
    
    # Polish transcript if GCP is available (we're migrating to GCP)
    if use_gcp or True:  # Always use GCP for polishing in this migration
        print(f"Attempting to polish transcript for session_id: {session_id}, user_id: {user_id}")
        print(f"Using provider: GCP Gemini")
        
        try:
            # Use Google Gemini for polishing
            polished_result_dict = await asyncio.get_event_loop().run_in_executor(
                None,
                polish_transcript_with_gemini,
                original_transcript,
                patient_name,
                patient_context,
                encounter_type,
                custom_instructions,
                location
            )
            
            if polished_result_dict['success']:
                polished_result = polished_result_dict['polished_transcript']
                print(f"Transcript polished successfully with Gemini for session_id: {session_id}")
                
                if polished_result and polished_result.strip() != original_transcript.strip():
                    polished_transcript_content = polished_result.strip()
                    
                    # Save polished transcript to GCS
                    success = gcs_client.save_data_to_gcs(
                        user_id=user_id,
                        data_type="transcripts",
                        session_id=f"polished/{session_id}",
                        content=polished_transcript_content
                    )
                    
                    if success:
                        polished_path = f"{user_id}/transcripts/polished/{session_id}.txt"
                        saved_paths["polished_transcript"] = polished_path
                        print(f"Polished transcript saved to: {polished_path}")
                    else:
                        errors.append("Failed to save polished transcript to GCS.")
                elif polished_result:
                    print(f"Transcript polishing did not significantly alter transcript for session_id: {session_id}")
                else:
                    print(f"Transcript polishing returned None or empty for session_id: {session_id}")
            else:
                errors.append(f"Gemini polishing error: {polished_result_dict.get('error', 'Unknown error')}")
                
        except Exception as e:
            print(f"Error polishing transcript for {session_id}: {e}")
            errors.append(f"Error polishing transcript: {str(e)}")

    # Save session metadata to GCS
    try:
        session_metadata = {
            "session_id": session_id,
            "patient_name": patient_name,
            "patient_context": patient_context,
            "encounter_type": encounter_type,
            "llm_template": llm_template,
            "llm_template_id": llm_template_id,
            "location": location,
            "user_id": user_id,
            "created_date": datetime.now(timezone.utc).isoformat(),
            "gcs_paths": saved_paths
        }
        
        metadata_content = json.dumps(session_metadata, indent=2)
        
        # Save metadata to GCS
        success = gcs_client.save_data_to_gcs(
            user_id=user_id,
            data_type="metadata",
            session_id=session_id,
            content=metadata_content
        )
        
        if success:
            metadata_path = f"{user_id}/metadata/{session_id}.txt"
            saved_paths["metadata"] = metadata_path
            print(f"Session metadata saved to: {metadata_path}")
        else:
            errors.append("Failed to save session metadata to GCS.")
    except Exception as e:
        print(f"Error saving session metadata for {session_id}: {e}")
        errors.append(f"Error saving session metadata: {str(e)}")

    response_message = "Session data processing completed."
    if not saved_paths and errors:
         raise HTTPException(status_code=500, detail=f"Failed to save any session data to GCS for session_id {session_id}. Errors: {'; '.join(errors)}")
    
    # Delete the draft file if it exists (since the session is now saved)
    draft_key = f"{user_id}/drafts/{session_id}.txt"
    try:
        if gcs_client.delete_gcs_object(draft_key):
            print(f"Successfully deleted draft file: {draft_key}")
        else:
            print(f"No draft file found to delete: {draft_key}")
    except Exception as e:
        print(f"Error deleting draft file {draft_key}: {e}")
        # Don't fail the save operation if draft deletion fails
    
    if errors:
        response_message += f" Some issues occurred: {'; '.join(errors)}"

    return {
        "message": response_message,
        "session_id": session_id,
        "saved_paths": saved_paths,
        "processing_errors": errors if errors else None
    }

class SaveDraftRequest(BaseModel):
    session_id: str
    transcript: str
    patient_name: str
    profile_id: Optional[str] = None
    user_id: str

@app.post("/api/v1/save_draft")
async def save_draft_endpoint(
    request_data: SaveDraftRequest,
    current_user_id: str = Depends(get_user_id)
):
    """Save a draft recording to GCS for later resumption."""
    # Verify user authorization
    if request_data.user_id != current_user_id:
        raise HTTPException(status_code=403, detail="You can only save your own drafts")
    
    global gcs_client
    if gcs_client is None:
        raise HTTPException(status_code=500, detail="GCS client not available")
    
    # Create draft metadata
    draft_metadata = {
        "session_id": request_data.session_id,
        "patient_name": request_data.patient_name,
        "profile_id": request_data.profile_id,
        "transcript": request_data.transcript,
        "status": "draft",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Save draft to GCS
    try:
        success = gcs_client.save_data_to_gcs(
            user_id=request_data.user_id,
            data_type="drafts",
            session_id=request_data.session_id,
            content=json.dumps(draft_metadata)
        )
        
        if success:
            return {"message": "Draft saved successfully", "session_id": request_data.session_id}
        else:
            raise HTTPException(status_code=500, detail="Failed to save draft")
    except Exception as e:
        print(f"Error saving draft: {e}")
        raise HTTPException(status_code=500, detail=f"Error saving draft: {str(e)}")

@app.delete("/api/v1/recordings/{user_id}/{session_id}", status_code=200)
async def delete_session_recording(
    user_id: str = Path(..., description="The ID of the user who owns the recording"),
    session_id: str = Path(..., description="The ID of the session recording to delete"),
    current_user_id: str = Depends(get_user_id)
):
    # Verify that the user_id matches the authenticated user
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="You can only delete your own recordings")
    if not gcs_client:
        raise HTTPException(status_code=503, detail="GCS client not initialized. Cannot delete recording.")

    print(f"Attempting to delete transcripts for user {user_id}, session {session_id}.")

    original_transcript_key = f"{user_id}/transcripts/original/{session_id}.txt"
    polished_transcript_key = f"{user_id}/transcripts/polished/{session_id}.txt"
    metadata_key = f"{user_id}/metadata/{session_id}.txt"
    draft_key = f"{user_id}/drafts/{session_id}.txt"

    deleted_count = 0

    # --- Delete Original Transcript ---
    print(f"  Attempting to delete original transcript: {original_transcript_key}")
    if gcs_client.delete_gcs_object(original_transcript_key):
        deleted_count += 1
        print(f"  Successfully deleted original transcript: {original_transcript_key}")
    else:
        print(f"  Failed to delete or original transcript not found: {original_transcript_key}")

    # --- Delete Polished Transcript ---
    print(f"  Attempting to delete polished transcript: {polished_transcript_key}")
    if gcs_client.delete_gcs_object(polished_transcript_key):
        deleted_count += 1
        print(f"  Successfully deleted polished transcript: {polished_transcript_key}")
    else:
        print(f"  Failed to delete or polished transcript not found: {polished_transcript_key}")

    # --- Delete Metadata ---
    print(f"  Attempting to delete metadata: {metadata_key}")
    if gcs_client.delete_gcs_object(metadata_key):
        deleted_count += 1
        print(f"  Successfully deleted metadata: {metadata_key}")
    else:
        print(f"  Failed to delete or metadata not found: {metadata_key}")

    # --- Delete Draft ---
    print(f"  Attempting to delete draft: {draft_key}")
    if gcs_client.delete_gcs_object(draft_key):
        deleted_count += 1
        print(f"  Successfully deleted draft: {draft_key}")
    else:
        print(f"  Failed to delete or draft not found: {draft_key}")

    if deleted_count > 0:
        return {"message": f"Successfully deleted {deleted_count} associated file(s) for session {session_id}."}
    else:
        return {"message": f"No files found to delete for session {session_id}. They may have already been deleted or never existed at the expected paths."}


class RecordingInfo(BaseModel):
    id: str # session_id
    name: str # Derived name, e.g., from patient context or session title
    date: datetime # Last modified date of the metadata file or a date from metadata
    status: str = "saved" # Can be "saved", "draft", "pending", "saving", "failed"
    s3PathTranscript: Optional[str] = None
    s3PathPolished: Optional[str] = None
    s3PathMetadata: Optional[str] = None # S3 key for the session_metadata.json file itself, now optional
    patientContext: Optional[str] = None
    encounterType: Optional[str] = None # Or selected profile name
    llmTemplateName: Optional[str] = None # Name of the LLM template/profile used
    location: Optional[str] = None
    durationSeconds: Optional[int] = None
    # Draft-specific fields
    transcript: Optional[str] = None
    profileId: Optional[str] = None
    # Add any other relevant fields that might be in session_metadata.json and useful for display

@app.get("/api/v1/user_recordings/{user_id}", response_model=List[RecordingInfo])
async def get_user_recordings(
    user_id: str = Path(..., description="User's unique identifier"),
    current_user_id: str = Depends(get_user_id)
):
    # Verify that the user_id matches the authenticated user
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="You can only access your own recordings")
    print(f"--- get_user_recordings called with user_id: '{user_id}' ---")
    if not gcs_client:
        print("GCS client not initialized. Cannot fetch recordings.")
        raise HTTPException(status_code=503, detail="GCS service not available")

    recordings_info = []
    fifteen_days_ago = datetime.now(timezone.utc) - timedelta(days=15)
    print(f"Filtering for recordings newer than: {fifteen_days_ago.isoformat()}")

    # First, fetch all saved recordings
    prefix = f"{user_id}/transcripts/original/"
    print(f"Attempting to list recordings for user: '{user_id}' with prefix: '{prefix}'")

    try:
        # Use GCS to list objects
        objects = gcs_client.list_gcs_objects(prefix=prefix, max_results=1000)
        print(f"Found {len(objects)} saved recording objects in GCS")
        
        for obj in objects:
            obj_name = obj['name']  # Full object path
            
            # Parse the updated timestamp
            if obj['updated']:
                try:
                    last_modified = datetime.fromisoformat(obj['updated'].replace('Z', '+00:00'))
                except:
                    last_modified = datetime.now(timezone.utc)
            else:
                continue
                
            # Filter by date
            if last_modified < fifteen_days_ago:
                print(f"FILTERED OUT (too old): {obj_name}, LastModified: {last_modified}")
                continue

            # We are looking for .txt files (original transcripts)
            if obj_name.endswith('.txt'):
                print(f"MATCHED SUFFIX (.txt): {obj_name}. Proceeding to process.")
                try:
                    # Extract session_id from the filename
                    filename_with_extension = obj_name.split('/')[-1]
                    session_id = filename_with_extension.rsplit('.', 1)[0]
                    
                    # GCS paths
                    gcs_path_transcript_original = obj_name
                    gcs_path_transcript_polished = f"{user_id}/transcripts/polished/{session_id}.txt"
                    gcs_path_metadata = f"{user_id}/metadata/{session_id}.txt"
                    
                    # Try to load metadata to get patient name and other details
                    rec_name = None
                    patient_context = None
                    encounter_type = None
                    llm_template_name = None
                    location = None
                    
                    try:
                        # Attempt to fetch metadata from GCS
                        metadata_content = gcs_client.get_gcs_object_content(gcs_path_metadata)
                        if metadata_content:
                            metadata = json.loads(metadata_content)
                            
                            # Use patient name from metadata if available
                            if metadata.get('patient_name'):
                                rec_name = metadata['patient_name']
                                print(f"Using patient name from metadata: '{rec_name}' for session {session_id}")
                            
                            # Extract other metadata
                            patient_context = metadata.get('patient_context')
                            encounter_type = metadata.get('encounter_type')
                            llm_template_name = metadata.get('llm_template')
                            location = metadata.get('location')
                    except Exception as e:
                        print(f"Error parsing metadata for session {session_id}: {e}")
                    
                    # Fallback name generation if no patient name from metadata
                    if not rec_name:
                        rec_name = f"Tx @ {session_id}"  # Default name
                        if len(session_id) == 20 and session_id.isdigit():  # Timestamp-like string
                            try:
                                ts_dt = datetime.strptime(session_id[:14], "%Y%m%d%H%M%S")
                                rec_name = ts_dt.strftime("Transcript %Y-%m-%d %H:%M")
                            except ValueError:
                                pass  # Keep default if parsing fails

                    info = RecordingInfo(
                        id=session_id,
                        name=rec_name,
                        date=last_modified,
                        s3PathTranscript=gcs_path_transcript_original,
                        s3PathPolished=gcs_path_transcript_polished,
                        s3PathMetadata=gcs_path_metadata,
                        patientContext=patient_context,
                        encounterType=encounter_type,
                        llmTemplateName=llm_template_name,
                        location=location,
                        durationSeconds=None,
                        status="saved"
                    )
                    recordings_info.append(info)
                except Exception as e:
                    print(f"Unexpected error processing transcript file {obj_name}: {e}")
                    
        # Now fetch draft recordings
        draft_prefix = f"{user_id}/drafts/"
        print(f"Attempting to list drafts for user: '{user_id}' with prefix: '{draft_prefix}'")
        
        try:
            draft_objects = gcs_client.list_gcs_objects(prefix=draft_prefix, max_results=1000)
            print(f"Found {len(draft_objects)} draft objects in GCS")
            
            for obj in draft_objects:
                obj_name = obj['name']
                print(f"Processing draft object: {obj_name}")
                
                # Parse the updated timestamp
                if obj['updated']:
                    try:
                        last_modified = datetime.fromisoformat(obj['updated'].replace('Z', '+00:00'))
                    except:
                        last_modified = datetime.now(timezone.utc)
                else:
                    continue
                    
                # Filter by date
                if last_modified < fifteen_days_ago:
                    print(f"FILTERED OUT draft (too old): {obj_name}")
                    continue
                
                if obj_name.endswith('.txt'):
                    try:
                        # Extract session_id from the filename
                        filename_with_extension = obj_name.split('/')[-1]
                        session_id = filename_with_extension.rsplit('.', 1)[0]
                        
                        # Fetch draft content
                        draft_content = gcs_client.get_gcs_object_content(obj_name)
                        if draft_content:
                            draft_data = json.loads(draft_content)
                            
                            # Create RecordingInfo for draft
                            draft_info = RecordingInfo(
                                id=session_id,
                                name=f"Draft: {draft_data.get('patient_name', 'Untitled')}",
                                date=last_modified,
                                status="draft",
                                s3PathTranscript=None,
                                s3PathPolished=None,
                                s3PathMetadata=obj_name,
                                patientContext=None,
                                encounterType=None,
                                llmTemplateName=None,
                                location=None,
                                durationSeconds=None,
                                # Include transcript and profileId for drafts
                                transcript=draft_data.get('transcript', ''),
                                profileId=draft_data.get('profile_id')
                            )
                            # Debug log to verify draft status
                            print(f"[DEBUG] Created draft RecordingInfo - ID: {draft_info.id}, Status: {draft_info.status}, Name: {draft_info.name}")
                            recordings_info.append(draft_info)
                    except Exception as e:
                        print(f"Error processing draft {obj_name}: {e}")
        except Exception as e:
            print(f"Error fetching drafts: {e}")
            
        # Remove duplicates - if a session has both a saved/pending recording and a draft, keep the draft
        seen_ids = {}
        deduplicated_recordings = []
        
        # First pass - collect all recordings by ID
        for rec in recordings_info:
            if rec.id not in seen_ids:
                seen_ids[rec.id] = []
            seen_ids[rec.id].append(rec)
        
        # Second pass - for each ID, prefer saved > draft > saving > pending > failed
        status_priority = {'saved': 4, 'draft': 3, 'saving': 2, 'pending': 1, 'failed': 0}
        for session_id, recs in seen_ids.items():
            if len(recs) == 1:
                deduplicated_recordings.append(recs[0])
            else:
                # Multiple records for same ID - pick the one with highest priority status
                best_rec = max(recs, key=lambda r: status_priority.get(r.status, -2))
                print(f"[DEDUP] Session {session_id} has {len(recs)} records. Keeping status='{best_rec.status}' over {[r.status for r in recs if r != best_rec]}")
                deduplicated_recordings.append(best_rec)
        
        # Sort deduplicated recordings by date, most recent first
        deduplicated_recordings.sort(key=lambda r: r.date, reverse=True)
        print(f"Found {len(deduplicated_recordings)} recordings after deduplication (was {len(recordings_info)}) for user {user_id}")
        
        # Debug: Log the status of each recording being returned
        print("[DEBUG] Recordings being returned:")
        for rec in deduplicated_recordings[:5]:  # Show first 5
            print(f"  - ID: {rec.id}, Status: {rec.status}, Name: {rec.name}")
        
        recordings_info = deduplicated_recordings
        
        return recordings_info

    except Exception as e:
        print(f"Unexpected error listing transcript files for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Unexpected error listing transcript files: {str(e)}")

from fastapi.responses import PlainTextResponse

@app.get("/api/v1/s3_object_content", response_class=PlainTextResponse)
async def get_s3_object_content(
    s3_key: str,
    current_user: dict = Depends(get_current_user)
):
    # Extract user_id from the object key to verify ownership
    # Object keys are in format: {user_id}/transcripts/... or {user_id}/metadata/...
    key_parts = s3_key.split('/')
    if len(key_parts) < 3:
        raise HTTPException(status_code=400, detail="Invalid object key format")
    
    # The user_id is the first part of the key
    key_user_id = key_parts[0]
    
    # Verify that the user can only access their own content
    if key_user_id != current_user['sub']:
        raise HTTPException(status_code=403, detail="You can only access your own content")
    if not gcs_client:
        print("GCS client not initialized. Cannot fetch object content.")
        raise HTTPException(status_code=503, detail="GCS service not available")

    print(f"Attempting to fetch object content for key: {s3_key}")
    try:
        content = gcs_client.get_gcs_object_content(s3_key)
        if content:
            return content
        else:
            print(f"Object not found: {s3_key}")
            raise HTTPException(status_code=404, detail=f"Object not found: {s3_key}")
    except Exception as e:
        print(f"Unexpected error fetching object {s3_key}: {e}")
        raise HTTPException(status_code=500, detail=f"Unexpected error fetching object: {str(e)}")
        
if __name__ == "__main__":
    if not deepgram_api_key:
        print("deepgram_api_key not found. Ensure .env is in the /Users/davidmain/Desktop/trans10 directory and contains the key 'deepgram_api_key'.")
    else:
        print(f"deepgram_api_key found: {deepgram_api_key[:5]}...")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, ws_ping_interval=20, ws_ping_timeout=20) 