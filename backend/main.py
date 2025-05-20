import uvicorn
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
import os
from dotenv import load_dotenv
from deepgram import AsyncLiveClient, DeepgramClientOptions, LiveOptions, LiveTranscriptionEvents
from deepgram.clients.listen.v1.websocket.response import CloseResponse
import ffmpeg
import logging
import boto3
from datetime import datetime
import json
import tempfile
from pydantic import BaseModel, Field
from fastapi import HTTPException
from typing import Optional, List, Dict, Any, Union
from fastapi import Path
from botocore.exceptions import ClientError
from datetime import datetime, timedelta

# Import the refactored Deepgram handler
from .deepgram_utils import handle_deepgram_websocket

# Ensure the .env file is in the root of the trans10 directory or adjust path
# Example: load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=dotenv_path)

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

# Global placeholders for clients, to be initialized in startup event
s3_client = None
bedrock_runtime_client = None

# Directory for temporary audio files (WAVs before manual S3 upload)
TEMP_AUDIO_DIR = os.path.join(tempfile.gettempdir(), "trans10_audio_temp")
os.makedirs(TEMP_AUDIO_DIR, exist_ok=True)
print(f"Temporary audio files will be stored in: {TEMP_AUDIO_DIR}")

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

# Import the new AWS utility functions
from .aws_utils import polish_transcript_with_bedrock, save_text_to_s3, save_audio_file_to_s3

html = """
<!DOCTYPE html>
<html>
    <head>
        <title>Chat</title>
    </head>
    <body>
        <h1>WebSocket Chat Test</h1>
        <p>This page tests a different WebSocket endpoint (/ws_test) for basic connectivity.</p>
        <p>Your main application should connect to <strong>ws://localhost:8000/stream</strong>.</p>
        <form action="" onsubmit="sendMessage(event)">
            <input type="text" id="messageText" autocomplete="off"/>
            <button>Send to /ws_test</button>
        </form>
        <ul id='messages'>
        </ul>
        <script>
            var ws = new WebSocket("ws://localhost:8000/ws_test");
            ws.onopen = function(event) {
                console.log("Connected to /ws_test");
            };
            ws.onmessage = function(event) {
                var messages = document.getElementById('messages')
                var message = document.createElement('li')
                var content = document.createTextNode(event.data)
                message.appendChild(content)
                messages.appendChild(message)
            };
            function sendMessage(event) {
                var input = document.getElementById("messageText")
                ws.send(input.value)
                input.value = ''
                event.preventDefault()
            }
            ws.onerror = function(event) {
                console.error("WebSocket error on /ws_test: ", event);
            };
            ws.onclose = function(event) {
                console.log("Disconnected from /ws_test");
            };
        </script>
    </body>
</html>
"""

@app.get("/")
async def get_test_page():
    return HTMLResponse(html) 

@app.websocket("/ws_test") # A separate endpoint for the HTML test page
async def websocket_test_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("Client connected to /ws_test")
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(f"Test echo: {data}")
    except WebSocketDisconnect:
        print("Client disconnected from /ws_test")
    except Exception as e:
        print(f"Error in /ws_test: {e}")
        await websocket.close(code=1011)

@app.websocket("/stream")
async def websocket_stream_endpoint(websocket: WebSocket):
    """
    Handles the primary WebSocket streaming connection for Deepgram transcription.
    This endpoint now delegates the complex streaming logic to handle_deepgram_websocket
    from the deepgram_utils module.
    """
    # The get_user_settings function from this file is passed as a callable
    # to handle_deepgram_websocket, allowing it to fetch user-specific settings.
    await handle_deepgram_websocket(websocket, get_user_settings)

class TranscriptionProfileItem(BaseModel):
    id: str = Field(..., description="Unique identifier for the profile")
    name: str = Field(..., description="User-defined name for the profile")
    llmPrompt: Optional[str] = Field(default=None, description="Custom LLM prompt/template for this profile")
    isDefault: Optional[bool] = Field(default=False, description="Whether this is the default profile")
    # Deepgram specific options
    smart_format: Optional[bool] = Field(default=True, description="Enable Deepgram Smart Formatting")
    diarize: Optional[bool] = Field(default=False, description="Enable Deepgram Speaker Diarization")
    num_speakers: Optional[int] = Field(default=None, ge=1, description="Suggested number of speakers if diarization is enabled") # ge=1 means greater than or equal to 1 if set
    utterances: Optional[bool] = Field(default=False, description="Enable Deepgram Word-Level Timestamps (utterances)")

class UserSettingsData(BaseModel):
    macroPhrases: List[Dict[str, Any]] = Field(default_factory=list)
    customVocabulary: List[Dict[str, Any]] = Field(default_factory=list)
    officeInformation: List[str] = Field(default_factory=list) # Consider changing to List[Dict[str, Any]] based on UIsetup.md
    transcriptionProfiles: List[TranscriptionProfileItem] = Field(default_factory=list)

class SaveUserSettingsRequest(BaseModel):
    user_id: str # This should ideally come from a validated token in the future
    settings: UserSettingsData

DEFAULT_USER_SETTINGS = UserSettingsData().model_dump()

@app.get("/api/v1/user_settings/{user_id}", response_model=UserSettingsData)
async def get_user_settings(user_id: str = Path(..., description="The ID of the user whose settings are to be fetched")):
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

@app.post("/api/v1/user_settings")
async def save_user_settings(request: SaveUserSettingsRequest):
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

# --- End User Settings --- #

class SaveSessionRequest(BaseModel):
    session_id: str
    final_transcript_text: str 
    user_id: str  
    patient_context: Optional[str] = None 
    encounter_type: Optional[str] = None  
    llm_template: Optional[str] = None    

@app.post("/api/v1/save_session_data") 
async def save_session_data_endpoint(request_data: SaveSessionRequest):
    session_id = request_data.session_id
    original_transcript = request_data.final_transcript_text
    user_id = request_data.user_id 
    patient_context = request_data.patient_context 
    encounter_type = request_data.encounter_type   
    llm_template = request_data.llm_template     

    custom_instructions = f"Patient Context: {patient_context}\nEncounter Type: {encounter_type}\nTemplate: {llm_template}" 

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

    local_wav_file_path = os.path.join(TEMP_AUDIO_DIR, f"{session_id}.wav")

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

    if s3_client and os.path.exists(local_wav_file_path):
        print(f"Attempting to save audio file for session_id: {session_id}, user_id: {user_id}")
        try:
            s3_audio_path = await save_audio_file_to_s3(
                s3_client=s3_client,
                aws_s3_bucket_name=AWS_S3_BUCKET_NAME,
                tenant_id=user_id,  
                session_id=session_id,
                local_file_path=local_wav_file_path,
                folder="audio"
            )
            if s3_audio_path:
                s3_paths["audio"] = s3_audio_path
                print(f"Audio file saved to: {s3_audio_path}")
                try:
                    os.remove(local_wav_file_path)
                    print(f"Successfully removed temporary local WAV file: {local_wav_file_path}")
                except OSError as e_remove:
                    print(f"Error removing temporary local WAV file {local_wav_file_path}: {e_remove}")
                    # Not adding to main 'errors' as S3 upload succeeded, but good to log
            else:
                errors.append("Failed to save audio file to S3.")
        except Exception as e:
            print(f"Error saving audio file for {session_id}: {e}")
            errors.append(f"Error saving audio file: {str(e)}")
    elif s3_client and not os.path.exists(local_wav_file_path):
        message = f"Local audio file not found at {local_wav_file_path}. Skipping audio S3 upload."
        print(message)
        errors.append(message)
    elif not s3_client:
        message = "S3 client not configured. Skipping audio S3 upload."
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
    session_id: str = Path(..., description="The ID of the session recording to delete")
):
    if not s3_client:
        raise HTTPException(status_code=503, detail="S3 client not initialized. Cannot delete recording.")
    if not AWS_S3_BUCKET_NAME:
        raise HTTPException(status_code=503, detail="S3 bucket name not configured. Cannot delete recording.")

    metadata_s3_key = f"sessions/{user_id}/{session_id}/session_metadata.json"
    print(f"Attempting to delete recording for user {user_id}, session {session_id}. Metadata key: {metadata_s3_key}")

    objects_to_delete = []

    try:
        # 1. Fetch the metadata file
        response = s3_client.get_object(Bucket=AWS_S3_BUCKET_NAME, Key=metadata_s3_key)
        metadata_content = response['Body'].read().decode('utf-8')
        metadata = json.loads(metadata_content)
        
        # 2. Collect S3 keys from s3_paths in metadata
        s3_paths_to_delete = metadata.get("s3_paths", {})
        for path_key, s3_key_value in s3_paths_to_delete.items():
            if isinstance(s3_key_value, str): # Ensure it's a string key
                objects_to_delete.append({'Key': s3_key_value})
                print(f"  Scheduled for deletion: {s3_key_value}")
            else:
                print(f"  Skipping non-string S3 path in metadata: {path_key}: {s3_key_value}")

        # 3. Add the metadata file itself to the list of objects to delete
        objects_to_delete.append({'Key': metadata_s3_key})
        print(f"  Scheduled for deletion: {metadata_s3_key}")

    except ClientError as e:
        if e.response['Error']['Code'] == 'NoSuchKey':
            print(f"Metadata file {metadata_s3_key} not found. Assuming recording already deleted or never existed.")
            # If metadata doesn't exist, there's nothing to delete based on it.
            # We could try to delete common paths if desired, but this implies an inconsistent state.
            # For now, return success as the state (no recording) is achieved.
            return {"message": "Recording not found or already deleted."}
        else:
            print(f"S3 ClientError fetching metadata {metadata_s3_key}: {e}")
            raise HTTPException(status_code=500, detail=f"Error fetching recording metadata: {e.response['Error']['Code']}")
    except json.JSONDecodeError as e:
        print(f"Error decoding metadata JSON from {metadata_s3_key}: {e}. Will attempt to delete metadata file only.")
        # If metadata is corrupt, still try to delete the metadata file itself.
        # Other files might be orphaned but this is a recovery attempt.
        objects_to_delete.append({'Key': metadata_s3_key})
    except Exception as e:
        print(f"Unexpected error processing metadata for {metadata_s3_key}: {e}")
        raise HTTPException(status_code=500, detail=f"Unexpected error processing recording metadata: {str(e)}")

    if not objects_to_delete:
        # This case might happen if metadata was empty or malformed and didn't even include itself.
        print(f"No objects identified for deletion for session {session_id}. This might indicate an issue or an already clean state.")
        return {"message": "No files identified for deletion. Recording might be partially deleted or in an inconsistent state."}

    try:
        # 4. Delete all collected objects
        print(f"Attempting to delete {len(objects_to_delete)} objects from S3 bucket {AWS_S3_BUCKET_NAME}...")
        delete_response = s3_client.delete_objects(
            Bucket=AWS_S3_BUCKET_NAME,
            Delete={'Objects': objects_to_delete, 'Quiet': False} # Set Quiet=False to get info about deleted/errored items
        )
        
        deleted_count = len(delete_response.get('Deleted', []))
        error_count = len(delete_response.get('Errors', []))

        print(f"S3 delete_objects response: Deleted: {deleted_count}, Errors: {error_count}")
        if error_count > 0:
            print(f"Errors during S3 deletion: {delete_response.get('Errors')}")
            # Even if some errors, others might have succeeded. Partial success.
            raise HTTPException(status_code=500, detail=f"Some files could not be deleted from S3. Errors: {error_count}")
        
        return {"message": f"Recording {session_id} and {deleted_count} associated files deleted successfully."}

    except ClientError as e:
        print(f"S3 ClientError during delete_objects for session {session_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error deleting files from S3: {e.response['Error']['Code']}")
    except Exception as e:
        print(f"Unexpected error during S3 deletion for session {session_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Unexpected error deleting files: {str(e)}")


class RecordingInfo(BaseModel):
    id: str # session_id
    name: str # Derived name, e.g., from patient context or session title
    date: datetime # Last modified date of the metadata file or a date from metadata
    status: str = "saved" # This endpoint returns saved recordings
    s3PathAudio: Optional[str] = None
    s3PathTranscript: Optional[str] = None
    s3PathPolished: Optional[str] = None
    s3PathMetadata: str # S3 key for the session_metadata.json file itself
    patientContext: Optional[str] = None
    encounterType: Optional[str] = None # Or selected profile name
    llmTemplateName: Optional[str] = None # Name of the LLM template/profile used
    location: Optional[str] = None
    durationSeconds: Optional[int] = None
    # Add any other relevant fields that might be in session_metadata.json and useful for display

@app.get("/api/v1/user_recordings/{user_id}", response_model=List[RecordingInfo])
async def get_user_recordings(user_id: str = Path(..., description="User's unique identifier")):
    if not s3_client:
        print("S3 client not initialized. Cannot fetch recordings.")
        raise HTTPException(status_code=503, detail="S3 service not available")
    if not AWS_S3_BUCKET_NAME:
        print("AWS_S3_BUCKET_NAME not configured.")
        raise HTTPException(status_code=500, detail="S3 bucket configuration missing")

    recordings_info = []
    prefix = f"user_recordings/{user_id}/"
    fifteen_days_ago = datetime.now(datetime.utcnow().tzinfo) - timedelta(days=15)

    try:
        paginator = s3_client.get_paginator('list_objects_v2')
        for page in paginator.paginate(Bucket=AWS_S3_BUCKET_NAME, Prefix=prefix):
            if "Contents" not in page:
                continue
            for obj in page["Contents"]:
                if obj['Key'].endswith('session_metadata.json'):
                    # S3 LastModified is already timezone-aware (UTC)
                    if obj['LastModified'] < fifteen_days_ago:
                        print(f"Skipping old recording: {obj['Key']}, modified: {obj['LastModified']}")
                        continue
                    
                    try:
                        metadata_obj = s3_client.get_object(Bucket=AWS_S3_BUCKET_NAME, Key=obj['Key'])
                        metadata_content = metadata_obj['Body'].read().decode('utf-8')
                        metadata = json.loads(metadata_content)

                        # Construct RecordingInfo
                        session_id = metadata.get('session_id') or obj['Key'].split('/')[-2]
                        
                        # Determine recording name - prioritize patient name/session title from metadata
                        rec_name = "Recording"
                        if metadata.get('patientNameSessionTitle'):
                            rec_name = metadata['patientNameSessionTitle']
                        elif metadata.get('patientContext'): # Fallback to patientContext if patientNameSessionTitle is not present
                             rec_name = metadata['patientContext']
                        else: # Fallback to a generic name with session_id
                            rec_name = f"Session {session_id[:8]}..."

                        # Date: Use 'sessionStartTime' from metadata if available, else S3 LastModified for the metadata file
                        record_date_str = metadata.get('sessionStartTime')
                        record_date = obj['LastModified'] # Default to metadata file's S3 LastModified time
                        if record_date_str:
                            try:
                                record_date = datetime.fromisoformat(record_date_str.replace('Z', '+00:00'))
                            except ValueError:
                                print(f"Warning: Could not parse sessionStartTime '{record_date_str}' for {obj['Key']}. Using S3 LastModified.")
                        
                        info = RecordingInfo(
                            id=session_id,
                            name=rec_name,
                            date=record_date, # Use parsed or S3 LastModified date
                            s3PathAudio=metadata.get('s3_key_audio_final') or metadata.get('s3_path_audio'),
                            s3PathTranscript=metadata.get('s3_key_transcript_raw') or metadata.get('s3_path_transcript'),
                            s3PathPolished=metadata.get('s3_key_transcript_polished') or metadata.get('s3_path_polished_note'),
                            s3PathMetadata=obj['Key'],
                            patientContext=metadata.get('patientContext'),
                            encounterType=metadata.get('encounterType'), # This might be the old field
                            llmTemplateName=metadata.get('llmTemplateName') or metadata.get('selectedProfileName'), # Check for new and old field names
                            location=metadata.get('selectedLocation'),
                            durationSeconds=metadata.get('duration_seconds') # Ensure this key exists in your metadata if used
                        )
                        recordings_info.append(info)
                    except ClientError as e:
                        print(f"Error reading/processing metadata file {obj['Key']}: {e}")
                    except json.JSONDecodeError as e:
                        print(f"Error decoding JSON from {obj['Key']}: {e}")
                    except Exception as e:
                        print(f"Unexpected error processing object {obj['Key']}: {e}")
                        
        # Sort recordings by date, most recent first
        recordings_info.sort(key=lambda r: r.date, reverse=True)
        return recordings_info

    except ClientError as e:
        print(f"S3 ClientError listing objects with prefix {prefix}: {e}")
        raise HTTPException(status_code=500, detail=f"Error listing recordings from S3: {e.response['Error']['Code']}")
    except Exception as e:
        print(f"Unexpected error listing recordings for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Unexpected error listing recordings: {str(e)}")

if __name__ == "__main__":
    if not deepgram_api_key:
        print("deepgram_api_key not found. Ensure .env is in the /Users/davidmain/Desktop/trans10 directory and contains the key 'deepgram_api_key'.")
    else:
        print(f"deepgram_api_key found: {deepgram_api_key[:5]}...")
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True, ws_ping_interval=20, ws_ping_timeout=20)
