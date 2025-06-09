import uvicorn
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
import os
from dotenv import load_dotenv
from deepgram import AsyncLiveClient, DeepgramClientOptions, LiveOptions, LiveTranscriptionEvents
from deepgram.clients.listen.v1.websocket.response import CloseResponse
import logging
import boto3
from datetime import datetime
import json
import tempfile
import time
from typing import Callable
from pydantic import BaseModel, Field
from fastapi import HTTPException
from typing import Optional, List, Dict, Any, Union
from fastapi import Path
from botocore.exceptions import ClientError
from datetime import datetime, timedelta, timezone

# Import the refactored Deepgram handler
from deepgram_utils import handle_deepgram_websocket

# Import the new Speechmatics handler for multilingual support
from speechmatics_utils import handle_speechmatics_websocket

# Import the new AWS utility functions
from aws_utils import polish_transcript_with_bedrock, save_text_to_s3, delete_s3_object

# Import authentication middleware
from auth_middleware import get_current_user, get_user_id

# Load .env file from backend directory first, then fall back to parent directory
backend_env_path = os.path.join(os.path.dirname(__file__), '.env')
parent_env_path = os.path.join(os.path.dirname(__file__), '..', '.env')

if os.path.exists(backend_env_path):
    load_dotenv(dotenv_path=backend_env_path)
    print(f"Loaded .env from backend directory: {backend_env_path}")
else:
    load_dotenv(dotenv_path=parent_env_path)
    print(f"Loaded .env from parent directory: {parent_env_path}")

deepgram_api_key = os.getenv("deepgram_api_key")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_S3_BUCKET_NAME = os.getenv("AWS_S3_BUCKET_NAME")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1") # Used for S3 and Bedrock
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

# Global placeholders for clients, to be initialized in startup event
s3_client = None
bedrock_runtime_client = None

@app.on_event("startup")
async def startup_event():
    global s3_client, bedrock_runtime_client
    print("FastAPI startup event: Initializing AWS clients...")
    
    if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY and AWS_S3_BUCKET_NAME:
        try:
            s3_client = boto3.client(
                's3',
                aws_access_key_id=AWS_ACCESS_KEY_ID,
                aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
                region_name=AWS_REGION
            )
            print("S3 client initialized successfully during startup.")
            
            # HIPAA Compliance: Verify S3 bucket encryption (see HIPAA_COMPLIANCE_TECH_DEBT.md #3)
            try:
                # Check if bucket encryption is enabled
                encryption = s3_client.get_bucket_encryption(Bucket=AWS_S3_BUCKET_NAME)
                sse_algorithm = encryption['ServerSideEncryptionConfiguration']['Rules'][0]['ApplyServerSideEncryptionByDefault']['SSEAlgorithm']
                if sse_algorithm == 'aws:kms':
                    print(f"✓ S3 bucket encryption verified: AWS KMS encryption (even better than AES-256!)")
                else:
                    print(f"✓ S3 bucket encryption verified: {sse_algorithm}")
            except ClientError as e:
                if e.response['Error']['Code'] == 'ServerSideEncryptionConfigurationNotFoundError':
                    print("⚠️  WARNING: S3 bucket encryption not enabled! This is required for HIPAA compliance.")
                    print("   Please enable AES-256 encryption on your S3 bucket.")
                else:
                    print(f"⚠️  Could not verify bucket encryption: {e}")
            
            # Check versioning for audit trail purposes
            try:
                versioning = s3_client.get_bucket_versioning(Bucket=AWS_S3_BUCKET_NAME)
                versioning_status = versioning.get('Status', 'Disabled')
                if versioning_status == 'Enabled':
                    print(f"✓ S3 bucket versioning enabled (good for audit trails)")
                else:
                    print(f"ℹ️  S3 bucket versioning is {versioning_status} (consider enabling for better audit trails)")
            except Exception as e:
                print(f"Could not check bucket versioning: {e}")
            
            # Note about CORS configuration
            print("\n📋 CORS Configuration Note:")
            print("   Since the IAM user lacks s3:PutBucketCORS permission, you need to manually configure CORS in the AWS Console.")
            print("   This is actually a security best practice - bucket-level policies should be managed separately from the application.")
            print("\n   Required CORS configuration for your S3 bucket:")
            print("   - Allowed Origins: http://localhost:5173, http://localhost:5174, https://yourdomain.com")
            print("   - Allowed Methods: GET, HEAD")
            print("   - Allowed Headers: *")
            print("   - Expose Headers: ETag")
            print("   - Max Age: 3600\n")
                
        except Exception as e:
            print(f"Failed to initialize S3 client during startup: {e}")
            s3_client = None # Ensure it's None if init fails
    else:
        print("S3 credentials/bucket name not fully configured. S3 uploads will be skipped.")

    if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY:
        try:
            bedrock_runtime_client = boto3.client(
                service_name='bedrock-runtime',
                region_name=AWS_REGION, 
                aws_access_key_id=AWS_ACCESS_KEY_ID,
                aws_secret_access_key=AWS_SECRET_ACCESS_KEY
            )
            print(f"Bedrock runtime client initialized successfully for region {AWS_REGION} during startup.")
        except Exception as e:
            print(f"Failed to initialize Bedrock runtime client during startup: {e}")
            bedrock_runtime_client = None # Ensure it's None if init fails
    else:
        print("AWS credentials not fully configured for Bedrock. Bedrock integration will be skipped.")
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
    # Verify JWT token before accepting WebSocket connection
    try:
        # Use the existing token verifier from auth_middleware
        from auth_middleware import token_verifier
        user_payload = token_verifier.verify_token(token)
        user_id = user_payload.get('sub')
        
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
    # Verify JWT token before accepting WebSocket connection
    try:
        # Use the existing token verifier from auth_middleware
        from auth_middleware import token_verifier
        user_payload = token_verifier.verify_token(token)
        user_id = user_payload.get('sub')
        
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
    includeLogoOnPdf=False
).model_dump()

@app.get("/api/v1/user_settings/{user_id}", response_model=UserSettingsData)
async def get_user_settings(
    user_id: str = Path(..., description="The ID of the user whose settings are to be fetched"),
    current_user_id: str = Depends(get_user_id)
):
    # Verify that the requested user_id matches the authenticated user
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="You can only access your own settings")
    if not s3_client:
        raise HTTPException(status_code=503, detail="S3 client not initialized. Cannot fetch settings.")
    if not AWS_S3_BUCKET_NAME:
        raise HTTPException(status_code=503, detail="S3 bucket name not configured. Cannot fetch settings.")

    s3_key = f"user_settings/{user_id}/settings.json"
    print(f"Attempting to fetch settings from S3: {AWS_S3_BUCKET_NAME}/{s3_key}")

    try:
        response = s3_client.get_object(Bucket=AWS_S3_BUCKET_NAME, Key=s3_key)
        settings_data_json = response['Body'].read().decode('utf-8')
        settings_data = json.loads(settings_data_json)
        # Ensure all default keys are present if the loaded data is partial
        # This also helps in migrating older structures if new keys are added to UserSettingsData
        loaded_settings_with_defaults = DEFAULT_USER_SETTINGS.copy()
        loaded_settings_with_defaults.update(settings_data) 
        return UserSettingsData(**loaded_settings_with_defaults)
    except ClientError as e:
        if e.response['Error']['Code'] == 'NoSuchKey':
            print(f"No settings file found for user {user_id} at {s3_key}, returning defaults.")
            return UserSettingsData(**DEFAULT_USER_SETTINGS) # Return Pydantic model instance
        else:
            print(f"S3 ClientError fetching settings from S3 for user {user_id}: {e}")
            raise HTTPException(status_code=500, detail=f"Error fetching user settings from S3: {e.response['Error']['Code']}")
    except json.JSONDecodeError as e:
        print(f"JSONDecodeError for user {user_id} at {s3_key}: {e}. Returning default settings.")
        # Optionally, you could try to recover or delete the malformed file
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

@app.post("/api/v1/user_settings")
async def save_user_settings(
    request: SaveUserSettingsRequest,
    current_user_id: str = Depends(get_user_id)
):
    # Verify that the user_id in the request matches the authenticated user
    if request.user_id != current_user_id:
        raise HTTPException(status_code=403, detail="You can only save your own settings")
    if not s3_client:
        raise HTTPException(status_code=503, detail="S3 client not initialized. Cannot save settings.")
    if not AWS_S3_BUCKET_NAME:
        raise HTTPException(status_code=503, detail="S3 bucket name not configured. Cannot save settings.")

    s3_key = f"user_settings/{request.user_id}/settings.json"
    print(f"Attempting to save settings to S3: {AWS_S3_BUCKET_NAME}/{s3_key}")

    try:
        s3_client.put_object(
            Bucket=AWS_S3_BUCKET_NAME,
            Key=s3_key,
            Body=json.dumps(request.settings.model_dump()),
            ContentType='application/json'
        )
        # Return the saved settings object directly
        return request.settings
    except ClientError as e:
        print(f"S3 ClientError saving settings to S3 for user {request.user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error saving user settings to S3: {e.response['Error']['Code']}")
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
    
    if not s3_client:
        raise HTTPException(status_code=503, detail="S3 client not initialized")
    if not AWS_S3_BUCKET_NAME:
        raise HTTPException(status_code=503, detail="S3 bucket name not configured")
    
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
        
        # Update user settings with the base64 logo
        settings_key = f"user_settings/{current_user_id}/settings.json"
        
        # Get current settings
        try:
            response = s3_client.get_object(Bucket=AWS_S3_BUCKET_NAME, Key=settings_key)
            current_settings = json.loads(response['Body'].read().decode('utf-8'))
        except ClientError as e:
            if e.response['Error']['Code'] == 'NoSuchKey':
                current_settings = DEFAULT_USER_SETTINGS
            else:
                raise
        
        # Update with base64 logo data
        current_settings['clinicLogo'] = logo_data_url
        
        # Save updated settings
        s3_client.put_object(
            Bucket=AWS_S3_BUCKET_NAME,
            Key=settings_key,
            Body=json.dumps(current_settings),
            ContentType='application/json'
        )
        
        return {"logoUrl": logo_data_url, "message": "Logo uploaded successfully"}
        
    except Exception as e:
        print(f"Error uploading logo for user {current_user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload logo: {str(e)}")

@app.delete("/api/v1/delete_logo")
async def delete_logo(
    current_user_id: str = Depends(get_user_id)
):
    """Delete clinic logo from user settings"""
    if not s3_client:
        raise HTTPException(status_code=503, detail="S3 client not initialized")
    if not AWS_S3_BUCKET_NAME:
        raise HTTPException(status_code=503, detail="S3 bucket name not configured")
    
    try:
        
        # Update user settings to remove logo URL
        settings_key = f"user_settings/{current_user_id}/settings.json"
        
        # Get current settings
        try:
            response = s3_client.get_object(Bucket=AWS_S3_BUCKET_NAME, Key=settings_key)
            current_settings = json.loads(response['Body'].read().decode('utf-8'))
        except ClientError as e:
            if e.response['Error']['Code'] == 'NoSuchKey':
                current_settings = DEFAULT_USER_SETTINGS
            else:
                raise
        
        # Remove logo URL and reset flag
        current_settings['clinicLogo'] = None
        current_settings['includeLogoOnPdf'] = False
        
        # Save updated settings
        s3_client.put_object(
            Bucket=AWS_S3_BUCKET_NAME,
            Key=settings_key,
            Body=json.dumps(current_settings),
            ContentType='application/json'
        )
        
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
    
    settings_key = f"user_settings/{user_id}/settings.json"
    
    try:
        response = s3_client.get_object(Bucket=AWS_S3_BUCKET_NAME, Key=settings_key)
        settings = json.loads(response['Body'].read().decode('utf-8'))
        
        return {
            "clinicLogo": settings.get('clinicLogo'),
            "includeLogoOnPdf": settings.get('includeLogoOnPdf'),
            "hasLogo": bool(settings.get('clinicLogo'))
        }
    except ClientError as e:
        if e.response['Error']['Code'] == 'NoSuchKey':
            return {"error": "No settings found", "clinicLogo": None}
        raise

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

    # Get user settings to retrieve the actual LLM instructions from the profile
    custom_instructions = None
    try:
        user_settings = await get_user_settings(user_id, current_user_id=user_id)  # Pass the user_id as current_user_id
        if user_settings and user_settings.transcriptionProfiles:
            # First try to find by ID (more reliable), then fallback to name
            selected_profile = None
            if llm_template_id:
                selected_profile = next((p for p in user_settings.transcriptionProfiles if p.id == llm_template_id), None)
            if not selected_profile and llm_template:
                selected_profile = next((p for p in user_settings.transcriptionProfiles if p.name == llm_template), None)
            if selected_profile:
                print(f"Found profile '{selected_profile.name}' (ID: {selected_profile.id}) for session {session_id}")
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
        custom_instructions = f"Patient Context: {patient_context}\nEncounter Type: {encounter_type}\nTemplate: {llm_template}"
        print(f"Using fallback LLM instructions for session {session_id}")
        print(f"Fallback reason: No profile instructions found. Template ID: {llm_template_id}, Template Name: {llm_template}")
    else:
        # Append context information to the profile instructions
        custom_instructions += f"\n\nAdditional Context:\nPatient Context: {patient_context}\nEncounter Type: {encounter_type}"
        print(f"Final instructions length after adding context: {len(custom_instructions)}") 

    print(f"Received save request for session: {session_id}, user: {user_id}")

    global s3_client, bedrock_runtime_client
    if s3_client is None:
        print("CRITICAL: S3 client not initialized when save_session_data_endpoint was called.")
        # raise HTTPException(status_code=500, detail="S3 client not available. Cannot save data.")
        # For now, we'll let it try and fail in the helper functions if s3_client is truly None.

    if bedrock_runtime_client is None:
        print("WARN: Bedrock client not initialized when save_session_data_endpoint was called. Polishing might be skipped.")


    s3_paths = {}
    errors = []

    if s3_client:
        print(f"Attempting to save original transcript for session_id: {session_id}, user_id: {user_id}")
        try:
            s3_original_transcript_path = await save_text_to_s3(
                s3_client=s3_client,
                aws_s3_bucket_name=AWS_S3_BUCKET_NAME,
                tenant_id=user_id,  
                session_id=session_id,
                content=original_transcript,
                folder="transcripts/original" 
            )
            if s3_original_transcript_path:
                s3_paths["original_transcript"] = s3_original_transcript_path
                print(f"Original transcript saved to: {s3_original_transcript_path}")
            else:
                errors.append("Failed to save original transcript to S3.")
        except Exception as e:
            print(f"Error saving original transcript for {session_id}: {e}")
            errors.append(f"Error saving original transcript: {str(e)}")
    else:
        message = "S3 client not configured. Skipping original transcript S3 upload."
        print(message)
        errors.append(message)

    if bedrock_runtime_client and s3_client:
        print(f"Attempting to polish transcript for session_id: {session_id}, user_id: {user_id}")
        try:
            polished_result = await polish_transcript_with_bedrock(
                transcript=original_transcript,
                bedrock_client=bedrock_runtime_client,
                custom_instructions=custom_instructions 
            )
            if polished_result and polished_result.strip() != original_transcript.strip():
                polished_transcript_content = polished_result.strip()
                print(f"Transcript polished successfully for session_id: {session_id}")
                s3_polished_transcript_path = await save_text_to_s3(
                    s3_client=s3_client,
                    aws_s3_bucket_name=AWS_S3_BUCKET_NAME,
                    tenant_id=user_id,  
                    session_id=session_id,
                    content=polished_transcript_content,
                    folder="transcripts/polished" 
                )
                if s3_polished_transcript_path:
                    s3_paths["polished_transcript"] = s3_polished_transcript_path
                    print(f"Polished transcript saved to: {s3_polished_transcript_path}")
                else:
                    errors.append("Failed to save polished transcript to S3 (after successful polishing).")
            elif polished_result:
                 print(f"Transcript polishing did not significantly alter transcript or returned original for session_id: {session_id}. Original will be used if no separate polished version is saved.")
            else:
                print(f"Transcript polishing returned None or empty for session_id: {session_id}. Original will be used.")

        except Exception as e:
            print(f"Error polishing transcript for {session_id}: {e}")
            errors.append(f"Error polishing transcript: {str(e)}")
    elif not bedrock_runtime_client:
        print(f"Bedrock client not configured for session_id {session_id}. Skipping transcript polishing.")
    elif not s3_client:
        print(f"S3 client not configured for session_id {session_id}. Skipping transcript polishing as polished note cannot be saved.")

    # Save session metadata to S3 (including patient name and other details)
    if s3_client:
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
                "s3_paths": s3_paths
            }
            
            metadata_content = json.dumps(session_metadata, indent=2)
            s3_metadata_path = await save_text_to_s3(
                s3_client=s3_client,
                aws_s3_bucket_name=AWS_S3_BUCKET_NAME,
                tenant_id=user_id,
                session_id=session_id,
                content=metadata_content,
                folder="metadata"
            )
            if s3_metadata_path:
                s3_paths["metadata"] = s3_metadata_path
                print(f"Session metadata saved to: {s3_metadata_path}")
            else:
                errors.append("Failed to save session metadata to S3.")
        except Exception as e:
            print(f"Error saving session metadata for {session_id}: {e}")
            errors.append(f"Error saving session metadata: {str(e)}")

    response_message = "Session data processing completed."
    if not s3_paths and errors:
         raise HTTPException(status_code=500, detail=f"Failed to save any session data to S3 for session_id {session_id}. Errors: {'; '.join(errors)}")
    
    if errors:
        response_message += f" Some issues occurred: {'; '.join(errors)}"

    return {
        "message": response_message,
        "session_id": session_id,
        "saved_paths": s3_paths,
        "processing_errors": errors if errors else None
    }

@app.delete("/api/v1/recordings/{user_id}/{session_id}", status_code=200)
async def delete_session_recording(
    user_id: str = Path(..., description="The ID of the user who owns the recording"),
    session_id: str = Path(..., description="The ID of the session recording to delete"),
    current_user_id: str = Depends(get_user_id)
):
    # Verify that the user_id matches the authenticated user
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="You can only delete your own recordings")
    if not s3_client:
        raise HTTPException(status_code=503, detail="S3 client not initialized. Cannot delete recording.")
    if not AWS_S3_BUCKET_NAME:
        raise HTTPException(status_code=503, detail="S3 bucket name not configured. Cannot delete recording.")

    print(f"Attempting to delete transcripts for user {user_id}, session {session_id}.")

    original_transcript_key = f"{user_id}/transcripts/original/{session_id}.txt"
    polished_transcript_key = f"{user_id}/transcripts/polished/{session_id}.txt"
    metadata_key = f"{user_id}/metadata/{session_id}.txt"  # Add metadata key

    deleted_count = 0
    error_messages = [] # To collect any specific error messages if needed later

    # --- Delete Original Transcript ---
    print(f"  Attempting to delete original transcript: {original_transcript_key}")
    original_deleted = await delete_s3_object(s3_client, AWS_S3_BUCKET_NAME, original_transcript_key)
    if original_deleted:
        deleted_count += 1
        print(f"  Successfully deleted original transcript: {original_transcript_key}")
    else:
        # delete_s3_object logs its own errors. We note here it wasn't successful.
        print(f"  Failed to delete or original transcript not found: {original_transcript_key}")

    # --- Delete Polished Transcript ---
    print(f"  Attempting to delete polished transcript: {polished_transcript_key}")
    polished_deleted = await delete_s3_object(s3_client, AWS_S3_BUCKET_NAME, polished_transcript_key)
    if polished_deleted:
        deleted_count += 1
        print(f"  Successfully deleted polished transcript: {polished_transcript_key}")
    else:
        print(f"  Failed to delete or polished transcript not found: {polished_transcript_key}")

    # --- Delete Metadata ---
    print(f"  Attempting to delete metadata: {metadata_key}")
    metadata_deleted = await delete_s3_object(s3_client, AWS_S3_BUCKET_NAME, metadata_key)
    if metadata_deleted:
        deleted_count += 1
        print(f"  Successfully deleted metadata: {metadata_key}")
    else:
        print(f"  Failed to delete or metadata not found: {metadata_key}")

    if deleted_count > 0:
        return {"message": f"Successfully deleted {deleted_count} associated file(s) for session {session_id}."}
    else:
        # This implies none of the targeted files (original, polished) were found or deleted.
        return {"message": f"No files found to delete for session {session_id}. They may have already been deleted or never existed at the expected paths."}


class RecordingInfo(BaseModel):
    id: str # session_id
    name: str # Derived name, e.g., from patient context or session title
    date: datetime # Last modified date of the metadata file or a date from metadata
    status: str = "saved" # This endpoint returns saved recordings
    s3PathTranscript: Optional[str] = None
    s3PathPolished: Optional[str] = None
    s3PathMetadata: Optional[str] = None # S3 key for the session_metadata.json file itself, now optional
    patientContext: Optional[str] = None
    encounterType: Optional[str] = None # Or selected profile name
    llmTemplateName: Optional[str] = None # Name of the LLM template/profile used
    location: Optional[str] = None
    durationSeconds: Optional[int] = None
    # Add any other relevant fields that might be in session_metadata.json and useful for display

@app.get("/api/v1/user_recordings/{user_id}", response_model=List[RecordingInfo])
async def get_user_recordings(
    user_id: str = Path(..., description="User's unique identifier"),
    current_user_id: str = Depends(get_user_id)
):
    # Verify that the user_id matches the authenticated user
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="You can only access your own recordings")
    print(f"--- get_user_recordings called with user_id: '{user_id}' ---") # Enhanced log
    if not s3_client:
        print("S3 client not initialized. Cannot fetch recordings.")
        raise HTTPException(status_code=503, detail="S3 service not available")
    if not AWS_S3_BUCKET_NAME:
        print("AWS_S3_BUCKET_NAME not configured.")
        raise HTTPException(status_code=500, detail="S3 bucket configuration missing")

    recordings_info = []
    # New prefix targeting the original transcript files directly.
    prefix = f"{user_id}/transcripts/original/"
    print(f"Attempting to list recordings for user_id: '{user_id}' in bucket '{AWS_S3_BUCKET_NAME}' with prefix: '{prefix}' (based on original transcripts)") # Enhanced log

    fifteen_days_ago = datetime.now(timezone.utc) - timedelta(days=15)
    print(f"Filtering for recordings newer than: {fifteen_days_ago.isoformat()}") # Enhanced log

    try:
        paginator = s3_client.get_paginator('list_objects_v2')
        print(f"Initialized S3 paginator for bucket '{AWS_S3_BUCKET_NAME}', prefix '{prefix}'") # Enhanced log
        for page in paginator.paginate(Bucket=AWS_S3_BUCKET_NAME, Prefix=prefix):
            if "Contents" not in page:
                print("S3 page response did not contain 'Contents' key. Skipping page.") # Enhanced log
                continue
            
            print(f"S3 page Contents (found {len(page['Contents'])} items):") # Enhanced log
            for i, item in enumerate(page["Contents"]): # Log all items first
                print(f"  Item {i+1}: Key='{item['Key']}', LastModified='{item['LastModified']}'")

            for obj in page["Contents"]:
                obj_key = obj['Key'] # Full S3 key, e.g., "user_id/transcripts/original/session_id.txt"
                
                # S3 LastModified is already timezone-aware (UTC)
                if obj['LastModified'] < fifteen_days_ago:
                    print(f"FILTERED OUT (too old): Key='{obj_key}', LastModified='{obj['LastModified']}'") # Enhanced log
                    continue

                # We are looking for .txt files (original transcripts)
                if obj_key.endswith('.txt'):
                    print(f"MATCHED SUFFIX (.txt): Key='{obj_key}'. Proceeding to process.") # Enhanced log
                    try:
                        # Extract session_id from the filename part of the S3 key
                        # e.g., from "user_id/transcripts/original/some_session_id.txt" -> "some_session_id"
                        filename_with_extension = obj_key.split('/')[-1]
                        session_id = filename_with_extension.rsplit('.', 1)[0]
                        
                        record_date = obj['LastModified'] # Use S3 object's LastModified for the date

                        s3_path_transcript_original = obj_key # The S3 key of the .txt file itself
                        s3_path_transcript_polished = f"{user_id}/transcripts/polished/{session_id}.txt"
                        s3_path_metadata = f"{user_id}/metadata/{session_id}.txt"
                        
                        # Try to load metadata to get patient name and other details
                        rec_name = None
                        patient_context = None
                        encounter_type = None
                        llm_template_name = None
                        location = None
                        
                        try:
                            # Attempt to fetch metadata from S3
                            metadata_response = s3_client.get_object(Bucket=AWS_S3_BUCKET_NAME, Key=s3_path_metadata)
                            metadata_content = metadata_response['Body'].read().decode('utf-8')
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
                            
                        except ClientError as e:
                            if e.response['Error']['Code'] == 'NoSuchKey':
                                print(f"No metadata found for session {session_id}, using fallback name generation")
                            else:
                                print(f"Error fetching metadata for session {session_id}: {e}")
                        except Exception as e:
                            print(f"Error parsing metadata for session {session_id}: {e}")
                        
                        # Fallback name generation if no patient name from metadata
                        if not rec_name:
                            rec_name = f"Tx @ {session_id}" # Default name
                            if len(session_id) == 20 and session_id.isdigit(): # Basic check for timestamp-like string
                                try:
                                    ts_dt = datetime.strptime(session_id[:14], "%Y%m%d%H%M%S")
                                    rec_name = ts_dt.strftime("Transcript %Y-%m-%d %H:%M")
                                except ValueError:
                                    pass # Keep default if parsing fails

                        info = RecordingInfo(
                            id=session_id,
                            name=rec_name, # Use patient name from metadata or fallback
                            date=record_date,
                            s3PathTranscript=s3_path_transcript_original,
                            s3PathPolished=s3_path_transcript_polished,
                            s3PathMetadata=s3_path_metadata, # Include metadata path
                            patientContext=patient_context,
                            encounterType=encounter_type,
                            llmTemplateName=llm_template_name,
                            location=location,
                            durationSeconds=None,
                            status="saved" # Default status from RecordingInfo model
                        )
                        recordings_info.append(info)
                    except Exception as e:
                        print(f"Unexpected error processing transcript file {obj_key}: {e}")
                        
        # Sort recordings by date, most recent first
        recordings_info.sort(key=lambda r: r.date, reverse=True)
        print(f"Found {len(recordings_info)} recordings for user {user_id} (from original transcripts) within the last 15 days.")
        return recordings_info

    except ClientError as e:
        print(f"S3 ClientError listing transcript files for user {user_id} with prefix {prefix}: {e}")
        raise HTTPException(status_code=500, detail=f"Error listing transcript files from S3: {e.response['Error']['Code']}")
    except Exception as e:
        print(f"Unexpected error listing transcript files for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Unexpected error listing transcript files: {str(e)}")

from fastapi.responses import PlainTextResponse

@app.get("/api/v1/s3_object_content", response_class=PlainTextResponse)
async def get_s3_object_content(
    s3_key: str,
    current_user: dict = Depends(get_current_user)
):
    # Extract user_id from the S3 key to verify ownership
    # S3 keys are in format: {user_id}/transcripts/... or {user_id}/metadata/...
    key_parts = s3_key.split('/')
    if len(key_parts) < 3:
        raise HTTPException(status_code=400, detail="Invalid S3 key format")
    
    # The user_id is the first part of the key
    key_user_id = key_parts[0]
    
    # Verify that the user can only access their own content
    if key_user_id != current_user['sub']:
        raise HTTPException(status_code=403, detail="You can only access your own content")
    if not s3_client:
        print("S3 client not initialized. Cannot fetch S3 object content.")
        raise HTTPException(status_code=503, detail="S3 service not available")
    if not AWS_S3_BUCKET_NAME:
        print("AWS_S3_BUCKET_NAME not configured.")
        raise HTTPException(status_code=500, detail="S3 bucket configuration missing")

    print(f"Attempting to fetch S3 object content for key: {s3_key} from bucket: {AWS_S3_BUCKET_NAME}")
    try:
        response = s3_client.get_object(Bucket=AWS_S3_BUCKET_NAME, Key=s3_key)
        content = response['Body'].read().decode('utf-8')
        return content
    except ClientError as e:
        if e.response['Error']['Code'] == 'NoSuchKey':
            print(f"S3 object not found: {s3_key}")
            raise HTTPException(status_code=404, detail=f"S3 object not found: {s3_key}")
        else:
            print(f"S3 ClientError fetching S3 object {s3_key}: {e}")
            raise HTTPException(status_code=500, detail=f"Error fetching S3 object: {e.response['Error']['Code']}")
    except Exception as e:
        print(f"Unexpected error fetching S3 object {s3_key}: {e}")
        raise HTTPException(status_code=500, detail=f"Unexpected error fetching S3 object: {str(e)}")
        
if __name__ == "__main__":
    if not deepgram_api_key:
        print("deepgram_api_key not found. Ensure .env is in the /Users/davidmain/Desktop/trans10 directory and contains the key 'deepgram_api_key'.")
    else:
        print(f"deepgram_api_key found: {deepgram_api_key[:5]}...")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, ws_ping_interval=20, ws_ping_timeout=20) 