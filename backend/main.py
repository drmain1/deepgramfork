import uvicorn
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
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
from typing import Optional

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
from aws_utils import polish_transcript_with_bedrock, save_text_to_s3, save_audio_file_to_s3

async def convert_raw_pcm_to_wav(input_pcm_path: str, output_wav_path: str) -> bool:
    ffmpeg_cmd = [
        'ffmpeg',
        '-f', 's16le',      # Format: signed 16-bit little-endian PCM
        '-ar', '16000',     # Audio rate: 16kHz
        '-ac', '1',         # Audio channels: mono
        '-i', input_pcm_path,
        '-y',               # Overwrite output file if it exists
        output_wav_path
    ]
    print(f"Converting PCM to WAV: {' '.join(ffmpeg_cmd)}")
    process = await asyncio.create_subprocess_exec(
        *ffmpeg_cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    stdout, stderr = await process.communicate()
    if process.returncode == 0:
        print(f"Successfully converted {input_pcm_path} to {output_wav_path}")
        return True
    else:
        print(f"Error converting PCM to WAV. FFMPEG stderr: {stderr.decode().strip()}")
        return False

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
    await websocket.accept() # CRITICAL: Accept connection first
    print(f"WebSocket connection accepted from: {websocket.client.host}:{websocket.client.port}")

    session_id = datetime.now().strftime("%Y%m%d%H%M%S%f") # Added microsecond for more uniqueness
    tenant_id_to_use = DEFAULT_TENANT_ID 
    
    # Send session_id to client immediately after connection
    try:
        await websocket.send_text(json.dumps({"type": "session_init", "session_id": session_id}))
        print(f"Sent session_init with session_id: {session_id} to client.")
    except Exception as e:
        print(f"Error sending session_id to client: {e}")
        # Optionally, close connection if session_id cannot be sent, or handle error
        # For now, we'll proceed, but client won't be able to save.

    dg_connection = None
    ffmpeg_proc = None
    raw_pcm_file_fd, raw_pcm_file_path = tempfile.mkstemp(suffix='.pcm')
    os.close(raw_pcm_file_fd)
    print(f"Temporary raw PCM file will be at: {raw_pcm_file_path}")

    # Initialize final_transcript_accumulator for this session
    # This list will store dicts like {"is_final": True, "channel_index": [0], "speech_final": True, "channel": [0], "duration": ..., "start": ..., "transcript": "..."}
    # Or just the transcript strings if that's how it was designed.
    # Based on MEMORY[87d2e5d1-84c8-4936-9725-68bccc12560c] it accumulates transcript segments.
    final_transcript_accumulator = [] 

    try:
        # Define event handlers (nested functions)
        async def on_open_handler(client, open_data, **kwargs):
            print(f"Deepgram Connection Open. Client instance: {client}, Open Data: {open_data}")

        async def on_message_handler(client, result, **kwargs):
            # print(f"--- Deepgram on_message RAW Result: {result}") 
            transcript = result.channel.alternatives[0].transcript
            if transcript:
                # print(f"Transcript from Deepgram: {transcript}")
                # await websocket.send_text(transcript) # Send transcript to client
                if result.is_final:
                    print(f"Sending Final transcript to client: {transcript}")
                    await websocket.send_text(f"Final: {transcript}")
                    final_transcript_accumulator.append(transcript) # Accumulate final
                else:
                    # print(f"Sending Interim transcript to client: {transcript}")
                    await websocket.send_text(f"Interim: {transcript}")
                    # full_transcript_accumulator.append(transcript) # DO NOT append interim for S3
            # else:
                # print("Transcript from Deepgram is empty.")
            
            if result.is_final:
                print("Deepgram: Final transcript received.")
            if result.speech_final:
                 print("Deepgram: Speech final marker received.")

        async def on_metadata_handler(client, metadata, **kwargs):
            print(f"Deepgram Metadata: {metadata}")

        async def on_speech_started_handler(client, speech_started, **kwargs):
            print(f"Deepgram Speech Started: {speech_started}")

        async def on_utterance_end_handler(client, utterance_end, **kwargs):
            print(f"Deepgram Utterance Ended: {utterance_end}")

        async def on_error_handler(client, error_payload, **kwargs):
            error_message = error_payload.get('message') or str(error_payload)
            print(f"Deepgram Error: {error_message}")
            # More detailed error introspection if needed
            if hasattr(error_payload, 'err_code') and hasattr(error_payload, 'err_msg'):
                print(f"Deepgram Error Code: {error_payload.err_code}, Message: {error_payload.err_msg}")
            # Close client WebSocket on critical Deepgram error
            # Consider which errors are critical enough to warrant this.
            # await websocket.close(code=1011, reason=f"Deepgram error: {error_message}")

        async def on_warning_handler(client, warning_payload, **kwargs):
            print(f"Deepgram Warning: {warning_payload}")

        async def on_close_handler(client_instance, *, close: CloseResponse, **kwargs):
            print(f"Deepgram Connection Closed. Code: {close.code if close else 'N/A'}, Reason: {close.reason if close else 'N/A'}")

        dg_connection = AsyncLiveClient(config)
        dg_connection.on(LiveTranscriptionEvents.Open, on_open_handler)
        dg_connection.on(LiveTranscriptionEvents.Transcript, on_message_handler)
        dg_connection.on(LiveTranscriptionEvents.Metadata, on_metadata_handler)
        dg_connection.on(LiveTranscriptionEvents.SpeechStarted, on_speech_started_handler)
        dg_connection.on(LiveTranscriptionEvents.UtteranceEnd, on_utterance_end_handler)
        dg_connection.on(LiveTranscriptionEvents.Error, on_error_handler)
        dg_connection.on(LiveTranscriptionEvents.Warning, on_warning_handler)
        dg_connection.on(LiveTranscriptionEvents.Close, on_close_handler)

        options = LiveOptions(
            model="nova-3-medical",
            language="en-US",
            smart_format=True,
            encoding="linear16",
            sample_rate=16000,
            channels=1,
            interim_results=True, # Enable interim results for faster feedback
            utterance_end_ms="1000",
            vad_events=True,
        )

        print("Attempting to start Deepgram connection...")
        if not await dg_connection.start(options):
            print("Failed to start Deepgram connection.")
            await websocket.close(code=1011, reason="Failed to connect to speech service")
            return
        print("Deepgram connection started successfully.")

        # Start ffmpeg process for transcoding
        ffmpeg_command = [
            'ffmpeg',
            '-loglevel', 'error',  # Or 'info'/'debug' for more verbose ffmpeg logs
            '-i', 'pipe:0',       # Input from stdin (data from client WebSocket)
            '-f', 's16le',        # Output format: signed 16-bit little-endian PCM
            '-acodec', 'pcm_s16le',# Audio codec: PCM s16le
            '-ac', '1',           # Number of audio channels: 1 (mono)
            '-ar', '16000',       # Audio sample rate: 16000 Hz
            'pipe:1'              # Output to stdout (to be sent to Deepgram)
        ]
        print(f"Starting ffmpeg process with command: {' '.join(ffmpeg_command)}")
        ffmpeg_proc = await asyncio.create_subprocess_exec(
            *ffmpeg_command,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        print("ffmpeg process started.")

        # Task to read FFMPEG's stdout, forward to Deepgram, and write to PCM file
        async def read_ffmpeg_stdout_and_forward_to_deepgram():
            try:
                while True:
                    if ffmpeg_proc.stdout is None:
                        print("FFMPEG stdout is None. Breaking read loop.")
                        break
                    
                    data = await ffmpeg_proc.stdout.read(4096) # Read up to 4096 bytes
                    
                    if not data:
                        print("FFMPEG stdout EOF. Breaking read loop.")
                        break # End of stream
                    
                    if dg_connection and dg_connection.is_connected:
                         await dg_connection.send(data) # MODIFIED: Added await
                    else:
                        print("Deepgram connection not available or closed. Cannot send data. Breaking read loop.")
                    
                    if raw_pcm_file_path and os.path.exists(raw_pcm_file_path):
                        try:
                            with open(raw_pcm_file_path, 'ab') as f:
                                f.write(data)
                        except Exception as e_write:
                            print(f"Error writing to PCM file: {e_write}")
                            # Decide if we should close the file or try to continue
                            break # Stop processing if file writing fails
                    
            except asyncio.CancelledError:
                print("read_ffmpeg_stdout_and_forward_to_deepgram task cancelled.")
            except Exception as e:
                print(f"Error in read_ffmpeg_stdout_and_forward_to_deepgram: {e}")
            finally:
                print("Exiting read_ffmpeg_stdout_and_forward_to_deepgram.")

        # Task to log FFMPEG's stderr
        async def log_ffmpeg_stderr():
            try:
                while True:
                    line = await ffmpeg_proc.stderr.readline()
                    if not line:
                        print("ffmpeg stderr EOF, stopping logger.")
                        break # ffmpeg process has closed its stderr
                    print(f"ffmpeg stderr: {line.decode('utf-8', errors='ignore').strip()}")
            except asyncio.CancelledError:
                print("ffmpeg stderr logging task cancelled.")
            except Exception as e:
                print(f"Error in log_ffmpeg_stderr_output: {e}")
            finally:
                print("log_ffmpeg_stderr_output task finished.")

        # Start tasks
        # Task to forward client audio to FFMPEG's stdin
        async def forward_audio_to_ffmpeg():
            print("DEBUG: forward_audio_to_ffmpeg task started.") # New log
            try:
                while True:
                    print("DEBUG: Attempting to receive audio data from client WebSocket...") # New log
                    audio_data_from_client = await websocket.receive_bytes()
                    print(f"DEBUG: Received {len(audio_data_from_client)} bytes from client WebSocket.") # Modified log

                    if audio_data_from_client:
                        if ffmpeg_proc and ffmpeg_proc.stdin and not ffmpeg_proc.stdin.is_closing():
                            try:
                                ffmpeg_proc.stdin.write(audio_data_from_client)
                                await ffmpeg_proc.stdin.drain()
                            except BrokenPipeError:
                                print("ffmpeg stdin broken pipe. Likely ffmpeg process terminated.")
                                # Consider whether to await websocket.close() here or let the main try/finally handle it.
                                break
                            except Exception as e:
                                print(f"Error writing to ffmpeg stdin: {e}")
                                # Consider closing or breaking based on error severity
                                break
                        else:
                            print("ffmpeg process stdin not available. Ending receive loop.")
                            break
                    else:
                        # Client might send an empty message to signal end of stream, or it might be an error.
                        print("DEBUG: Received empty data from client. Assuming end of stream or issue.") # Modified log
                        break
            
            except asyncio.CancelledError:
                print("forward_audio_to_ffmpeg task cancelled.")
            except Exception as e:
                print(f"Error in forward_audio_to_ffmpeg: {e}")
                print(f"Type of error in forward_audio_to_ffmpeg: {type(e)}")
            finally:
                print("Exiting forward_audio_to_ffmpeg.")

        forward_audio_task = asyncio.create_task(forward_audio_to_ffmpeg())
        read_ffmpeg_stdout_and_forward_to_deepgram_task = asyncio.create_task(read_ffmpeg_stdout_and_forward_to_deepgram())
        log_ffmpeg_stderr_task = asyncio.create_task(log_ffmpeg_stderr())

        # Ensure all tasks are awaited to catch exceptions and ensure cleanup
        await asyncio.gather(
            forward_audio_task,
            read_ffmpeg_stdout_and_forward_to_deepgram_task, 
            log_ffmpeg_stderr_task,
            return_exceptions=True # Allows us to see exceptions from tasks if any
        )

    except WebSocketDisconnect as e:
        print(f"Client {websocket.client.host}:{websocket.client.port} disconnected. Code: {e.code}, Reason: {e.reason if e.reason else 'N/A'}")
    except Exception as e:
        print(f"Error in WebSocket stream for {websocket.client.host}:{websocket.client.port}: {e}")
        # Consider logging traceback for more detailed debugging
        import traceback
        traceback.print_exc()
        # Attempt to close the WebSocket gracefully if it's not already closed
        if not websocket.client_state == WebSocketState.DISCONNECTED:
            await websocket.close(code=1011, reason=f"Server error: {str(e)[:120]}") # Max reason length is 123 bytes
    finally:
        print(f"Cleaning up resources for session_id: {session_id}")

        # 1. Ensure Deepgram connection is closed
        if dg_connection and dg_connection.is_connected:
            print("Closing Deepgram connection...")
            await dg_connection.finish()
            print("Deepgram connection closed.")
        elif dg_connection:
            print("Deepgram connection was not active or already closed.")

        # 2. Ensure FFMPEG process is terminated
        if ffmpeg_proc:
            print("Terminating FFMPEG process...")
            if ffmpeg_proc.stdin and not ffmpeg_proc.stdin.is_closing():
                try:
                    ffmpeg_proc.stdin.close()
                    await ffmpeg_proc.stdin.wait_closed() # Ensure it's fully closed
                    print("FFMPEG stdin closed.")
                except Exception as e_ffmpeg_stdin:
                    print(f"Error closing FFMPEG stdin: {e_ffmpeg_stdin}")
            
            if ffmpeg_proc.returncode is None: # Check if process is still running
                try:
                    ffmpeg_proc.terminate() # Send SIGTERM
                    await asyncio.wait_for(ffmpeg_proc.wait(), timeout=5.0) # Wait for termination
                    print(f"FFMPEG process terminated with code: {ffmpeg_proc.returncode}")
                except asyncio.TimeoutError:
                    print("FFMPEG process did not terminate in time, killing...")
                    ffmpeg_proc.kill() # Send SIGKILL
                    await ffmpeg_proc.wait()
                    print(f"FFMPEG process killed, code: {ffmpeg_proc.returncode}")
                except Exception as e_ffmpeg_term:
                    print(f"Error terminating FFMPEG process: {e_ffmpeg_term}")
            else:
                print(f"FFMPEG process already exited with code: {ffmpeg_proc.returncode}")

        # 3. Convert raw PCM to WAV and save it
        target_wav_filename = f"{session_id}.wav"
        target_wav_path = os.path.join(TEMP_AUDIO_DIR, target_wav_filename)
        print(f"Preparing to convert PCM ({raw_pcm_file_path}) to WAV ({target_wav_path})")

        if os.path.exists(raw_pcm_file_path) and os.path.getsize(raw_pcm_file_path) > 0:
            conversion_success = await convert_raw_pcm_to_wav(raw_pcm_file_path, target_wav_path)
            if conversion_success:
                print(f"Audio for session {session_id} successfully converted and saved to {target_wav_path}")
            else:
                print(f"Failed to convert/save audio for session {session_id} to WAV.")
        elif os.path.exists(raw_pcm_file_path):
            print(f"Temporary PCM file {raw_pcm_file_path} is empty. Skipping WAV conversion.")
        else:
            print(f"Temporary PCM file {raw_pcm_file_path} not found. Cannot convert to WAV.")

        # 4. Clean up temporary raw PCM file
        if os.path.exists(raw_pcm_file_path):
            try:
                os.remove(raw_pcm_file_path)
                print(f"Removed temporary PCM file: {raw_pcm_file_path}")
            except OSError as e_remove_pcm:
                print(f"Error removing temporary PCM file {raw_pcm_file_path}: {e_remove_pcm}")
        
        # Final cleanup of tasks (if they were defined and might still be pending)
        # This is more of a safeguard; ideally, tasks should exit cleanly when their inputs/outputs close.
        tasks_to_cancel = []
        if 'forward_audio_task' in locals() and not forward_audio_task.done():
             tasks_to_cancel.append(forward_audio_task)
        if 'read_ffmpeg_stdout_and_forward_to_deepgram_task' in locals() and not read_ffmpeg_stdout_and_forward_to_deepgram_task.done():
             tasks_to_cancel.append(read_ffmpeg_stdout_and_forward_to_deepgram_task)
        if 'log_ffmpeg_stderr_task' in locals() and not log_ffmpeg_stderr_task.done():
            tasks_to_cancel.append(log_ffmpeg_stderr_task)
        
        for task in tasks_to_cancel:
            if not task.done():
                try:
                    task.cancel()
                    # Using asyncio.wait_for with a short timeout to prevent indefinite blocking
                    await asyncio.wait_for(task, timeout=1.0) 
                except asyncio.CancelledError:
                    print(f"Task {task.get_name()} was cancelled as expected.")
                except asyncio.TimeoutError:
                    print(f"Timeout waiting for task {task.get_name()} to cancel. It might be stuck.")
                except Exception as e_task_cancel:
                    print(f"Error cancelling task {task.get_name()}: {e_task_cancel}")

        print(f"Finished cleanup for WebSocket session_id: {session_id}")


class SaveSessionRequest(BaseModel):
    session_id: str
    final_transcript_text: str 
    claude_custom_instructions: Optional[str] = None 

@app.post("/api/v1/save_session_data")
async def save_session_data_endpoint(request_data: SaveSessionRequest):
    """
    Receives session_id, final transcript text, and optional Claude custom instructions.
    Saves the original transcript to S3.
    Saves the corresponding local WAV audio file (identified by session_id) to S3.
    Optionally polishes the transcript using Bedrock (Claude Haiku) and saves it to S3.
    Removes the local temporary WAV file after successful S3 upload.
    """
    session_id = request_data.session_id
    original_transcript = request_data.final_transcript_text
    custom_instructions = request_data.claude_custom_instructions 

    print(f"Received request to save session data for session_id: {session_id}")
    if custom_instructions:
        print(f"Custom Claude instructions provided for session_id: {session_id}")
    
    s3_paths = {}
    errors = []

    # Ensure s3_client is initialized
    if not s3_client or not AWS_S3_BUCKET_NAME:
        error_msg = "S3 client or bucket name not configured. Cannot save session data."
        print(f"Error for session_id {session_id}: {error_msg}")
        raise HTTPException(status_code=500, detail=error_msg)

    # 1. Save original transcript to S3
    try:
        print(f"Attempting to save original transcript for session_id: {session_id}")
        s3_original_transcript_path = await save_text_to_s3(
            s3_client=s3_client,
            aws_s3_bucket_name=AWS_S3_BUCKET_NAME,
            tenant_id=DEFAULT_TENANT_ID,
            session_id=session_id,
            content=original_transcript,
            folder="transcripts/original" # Specific subfolder for original transcripts
        )
        if s3_original_transcript_path:
            s3_paths["original_transcript"] = s3_original_transcript_path
            print(f"Original transcript saved to: {s3_original_transcript_path}")
        else:
            errors.append("Failed to save original transcript to S3.")
    except Exception as e:
        print(f"Error saving original transcript for {session_id}: {e}")
        errors.append(f"Error saving original transcript: {str(e)}")

    # 2. Save audio file to S3
    local_wav_file_path = os.path.join(TEMP_AUDIO_DIR, f"{session_id}.wav")
    if not os.path.exists(local_wav_file_path):
        warning_msg = f"Local WAV file {local_wav_file_path} not found for session_id {session_id}. Cannot save audio to S3."
        print(warning_msg)
        errors.append(warning_msg) # Log as a processing error/warning
    else:
        try:
            print(f"Attempting to save audio file {local_wav_file_path} for session_id: {session_id}")
            s3_audio_path = await save_audio_file_to_s3(
                s3_client=s3_client,
                aws_s3_bucket_name=AWS_S3_BUCKET_NAME,
                tenant_id=DEFAULT_TENANT_ID,
                session_id=session_id,
                local_file_path=local_wav_file_path,
                folder="audio" # Specific subfolder for audio files
            )
            if s3_audio_path:
                s3_paths["audio"] = s3_audio_path
                print(f"Audio file saved to: {s3_audio_path}")
                try:
                    os.remove(local_wav_file_path)
                    print(f"Removed temporary local WAV file: {local_wav_file_path}")
                except OSError as e_remove:
                    print(f"Error removing temporary local WAV file {local_wav_file_path}: {e_remove}")
                    # Not adding to main 'errors' as S3 upload succeeded, but good to log
            else:
                errors.append("Failed to save audio file to S3.")
        except Exception as e:
            print(f"Error saving audio file for {session_id}: {e}")
            errors.append(f"Error saving audio file: {str(e)}")

    # 3. Polish transcript with Bedrock (if configured and s3_client is available)
    polished_transcript_content = original_transcript # Default to original if polishing fails or is skipped
    if bedrock_runtime_client and s3_client: # Ensure s3_client is also available for saving polished transcript
        print(f"Attempting to polish transcript for session_id: {session_id}")
        try:
            polished_result = await polish_transcript_with_bedrock(
                transcript=original_transcript,
                bedrock_client=bedrock_runtime_client,
                custom_instructions=custom_instructions 
            )
            if polished_result and polished_result.strip() != original_transcript.strip():
                polished_transcript_content = polished_result.strip()
                print(f"Transcript polished successfully for session_id: {session_id}")
                # 4. Save polished transcript to S3
                s3_polished_transcript_path = await save_text_to_s3(
                    s3_client=s3_client,
                    aws_s3_bucket_name=AWS_S3_BUCKET_NAME,
                    tenant_id=DEFAULT_TENANT_ID,
                    session_id=session_id,
                    content=polished_transcript_content,
                    folder="transcripts/polished" # Specific subfolder for polished transcripts
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
         # If nothing was saved and there are errors, it's a more critical failure.
         raise HTTPException(status_code=500, detail=f"Failed to save any session data to S3 for session_id {session_id}. Errors: {'; '.join(errors)}")
    
    if errors:
        response_message += f" Some issues occurred: {'; '.join(errors)}"

    return {
        "message": response_message,
        "session_id": session_id,
        "saved_paths": s3_paths,
        "processing_errors": errors if errors else None
    }

if __name__ == "__main__":
    if not deepgram_api_key:
        print("deepgram_api_key not found. Ensure .env is in the /Users/davidmain/Desktop/trans10 directory and contains the key 'deepgram_api_key'.")
    else:
        print(f"deepgram_api_key found: {deepgram_api_key[:5]}...")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, ws_ping_interval=20, ws_ping_timeout=20)
