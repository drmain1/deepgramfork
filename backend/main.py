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
from pydantic import BaseModel
from fastapi import HTTPException

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

    except WebSocketDisconnect:
        print(f"WebSocket disconnected by client: {websocket.client.host}:{websocket.client.port}")
    except Exception as e:
        print(f"An error occurred in websocket_endpoint: {e}")
        try:
            await websocket.send_text(json.dumps({"type": "error", "message": f"Server error: {str(e)}"}))
        except Exception as e_ws_send:
            print(f"Could not send server error to client: {e_ws_send}")
    finally:
        print("Initiating cleanup in websocket_endpoint...")

        # 1. Close Deepgram connection
        if dg_connection and dg_connection.is_connected:
            print("Closing Deepgram connection...")
            await dg_connection.finish()
            print("Deepgram connection closed.")

        # 2. Cancel and await tasks if they are still running
        tasks_to_cancel = [forward_audio_task, read_ffmpeg_stdout_and_forward_to_deepgram_task, log_ffmpeg_stderr_task]
        for task in tasks_to_cancel:
            if not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    print(f"Task {task.get_name()} was cancelled successfully.")
                except Exception as e_task_cleanup:
                    print(f"Exception during cleanup of task {task.get_name()}: {e_task_cleanup}")
            elif task and task.done():
                print(f"Task {task.get_name()} already done.")
                # Optionally check task.exception() if it's done due to an error
                if task.exception():
                    print(f"Task {task.get_name()} finished with exception: {task.exception()}")

        # 3. Terminate FFMPEG process
        if ffmpeg_proc and ffmpeg_proc.returncode is None: # Check if process is still running
            print("Terminating FFMPEG process...")
            ffmpeg_proc.terminate() # Send SIGTERM
            try:
                await asyncio.wait_for(ffmpeg_proc.wait(), timeout=5.0) # Wait for termination
                print("FFMPEG process terminated.")
            except asyncio.TimeoutError:
                print("FFMPEG process did not terminate in time, killing...")
                ffmpeg_proc.kill() # Send SIGKILL
                await ffmpeg_proc.wait()
                print("FFMPEG process killed.")
            except Exception as e_ffmpeg_term:
                print(f"Error during FFMPEG termination: {e_ffmpeg_term}")
        elif ffmpeg_proc:
            print(f"FFMPEG process already exited with code: {ffmpeg_proc.returncode}")

        # 4. Convert PCM to WAV and save to TEMP_AUDIO_DIR
        temp_wav_file_path = None
        if raw_pcm_file_path and os.path.exists(raw_pcm_file_path):
            if os.path.getsize(raw_pcm_file_path) > 0:
                # Construct path for the temporary WAV file using session_id
                temp_wav_file_path = os.path.join(TEMP_AUDIO_DIR, f"{session_id}.wav")
                print(f"Temporary WAV file will be at: {temp_wav_file_path}")

                print(f"Attempting to convert {raw_pcm_file_path} to {temp_wav_file_path}")
                conversion_ok = await convert_raw_pcm_to_wav(raw_pcm_file_path, temp_wav_file_path)
                
                if conversion_ok and os.path.exists(temp_wav_file_path) and os.path.getsize(temp_wav_file_path) > 0:
                    print(f"Conversion successful. {temp_wav_file_path} is ready for manual upload.")
                elif not conversion_ok:
                    print(f"Failed to convert PCM audio at {raw_pcm_file_path} to WAV.")
                    temp_wav_file_path = None # Ensure it's None if conversion failed
                else:
                    print(f"Converted WAV file {temp_wav_file_path} is empty or does not exist. Cannot be uploaded.")
                    if os.path.exists(temp_wav_file_path): # clean up empty/failed wav
                        try: os.remove(temp_wav_file_path) 
                        except: pass
                    temp_wav_file_path = None # Ensure it's None
            else:
                print(f"Temporary PCM file {raw_pcm_file_path} is empty. Skipping WAV conversion.")
            
            print(f"Deleting temporary PCM file: {raw_pcm_file_path}")
            try:
                os.remove(raw_pcm_file_path)
            except Exception as e_del_pcm:
                print(f"Error deleting temp PCM file {raw_pcm_file_path}: {e_del_pcm}")
        elif raw_pcm_file_path:
            print(f"Temporary PCM file {raw_pcm_file_path} not found (or already deleted). Skipping audio processing.")
        else:
            print("Raw PCM file path was not set. Skipping audio processing.")

        print(f"Cleanup complete for websocket session {session_id}. Temporary WAV (if created): {temp_wav_file_path}")
        await websocket.close()
        print(f"WebSocket connection closed for session {session_id}")

# --- New HTTP Endpoint for Manual Saving ---
class SaveSessionRequest(BaseModel):
    session_id: str
    final_transcript_text: str

@app.post("/api/v1/save_session_data")
async def save_session_data_endpoint(request_data: SaveSessionRequest):
    global s3_client, bedrock_runtime_client # Ensure access to global clients

    session_id = request_data.session_id
    final_transcript = request_data.final_transcript_text
    tenant_id_to_use = DEFAULT_TENANT_ID

    print(f"Received request to save session: {session_id}")

    temp_wav_file_path = os.path.join(TEMP_AUDIO_DIR, f"{session_id}.wav")

    if not os.path.exists(temp_wav_file_path):
        print(f"Error: Temporary WAV file not found for session {session_id} at {temp_wav_file_path}")
        raise HTTPException(status_code=404, detail=f"Audio data for session {session_id} not found or already processed.")

    # Initialize results
    notes_s3_path = None
    audio_s3_path = None
    messages = [] # To collect status/error messages

    # 1. Polish transcript
    polished_transcript = final_transcript
    if bedrock_runtime_client:
        print(f"Polishing transcript for session {session_id}...")
        try:
            polished_transcript = await polish_transcript_with_bedrock(final_transcript, bedrock_runtime_client)
            print(f"Transcript polished for session {session_id}.")
            messages.append("Transcript polished successfully.")
        except Exception as e:
            error_msg = f"Error polishing transcript for session {session_id}: {e}"
            print(error_msg)
            messages.append(f"Transcript polishing failed: {e}. Using original transcript.")
            # Proceed with original transcript if polishing fails
            polished_transcript = final_transcript
    else:
        no_bedrock_msg = f"Bedrock client not available. Using original transcript for session {session_id}."
        print(no_bedrock_msg)
        messages.append(no_bedrock_msg)

    # 2. Save polished notes to S3
    if s3_client:
        if polished_transcript and polished_transcript.strip():
            print(f"Saving polished notes to S3 for session {session_id}...")
            try:
                notes_s3_path = await save_text_to_s3(s3_client, AWS_S3_BUCKET_NAME, tenant_id_to_use, session_id, polished_transcript, folder="notes")
                if notes_s3_path:
                    print(f"Notes saved to S3: {notes_s3_path}")
                    messages.append(f"Notes saved to S3: {notes_s3_path}")
                else:
                    notes_s3_fail_msg = f"Failed to save notes to S3 for session {session_id} (save_text_to_s3 returned None or empty string)."
                    print(notes_s3_fail_msg)
                    messages.append(notes_s3_fail_msg)
            except Exception as e:
                notes_s3_err_msg = f"Error saving notes to S3 for session {session_id}: {e}"
                print(notes_s3_err_msg)
                messages.append(notes_s3_err_msg)
        else:
            no_notes_msg = f"No transcript content to save for session {session_id}."
            print(no_notes_msg)
            messages.append(no_notes_msg)
    else:
        s3_notes_skip_msg = "S3 client not available. Skipping notes save."
        print(s3_notes_skip_msg)
        messages.append(s3_notes_skip_msg)

    # 3. Save audio to S3
    if s3_client:
        if os.path.exists(temp_wav_file_path) and os.path.getsize(temp_wav_file_path) > 0:
            print(f"Saving audio to S3 for session {session_id} from {temp_wav_file_path}...")
            try:
                audio_s3_path = await save_audio_file_to_s3(s3_client, AWS_S3_BUCKET_NAME, tenant_id_to_use, session_id, temp_wav_file_path, folder="audio")
                if audio_s3_path:
                    print(f"Audio saved to S3: {audio_s3_path}")
                    messages.append(f"Audio saved to S3: {audio_s3_path}")
                else:
                    audio_s3_fail_msg = f"Failed to save audio to S3 for session {session_id} (save_audio_file_to_s3 returned None or empty string)."
                    print(audio_s3_fail_msg)
                    messages.append(audio_s3_fail_msg)
            except Exception as e:
                audio_s3_err_msg = f"Error saving audio to S3 for session {session_id}: {e}"
                print(audio_s3_err_msg)
                messages.append(audio_s3_err_msg)
        else:
            no_audio_msg = f"Temporary WAV file {temp_wav_file_path} is empty or does not exist. Skipping audio S3 upload."
            print(no_audio_msg)
            messages.append(no_audio_msg)
    else:
        s3_audio_skip_msg = "S3 client not available. Skipping audio save."
        print(s3_audio_skip_msg)
        messages.append(s3_audio_skip_msg)

    # 4. Cleanup temporary WAV file (only if it was successfully uploaded or attempted)
    # We check for existence again, as it might have been an empty file that was attempted for upload but should be cleaned.
    if os.path.exists(temp_wav_file_path):
        try:
            os.remove(temp_wav_file_path)
            print(f"Deleted temporary WAV file: {temp_wav_file_path}")
            # messages.append(f"Temporary audio file {session_id}.wav cleaned up.") # Optional: too verbose for client?
        except Exception as e:
            del_wav_err_msg = f"Error deleting temp WAV file {temp_wav_file_path}: {e}"
            print(del_wav_err_msg)
            messages.append(del_wav_err_msg) # Important to log if cleanup fails
    
    # Determine overall status for HTTP response
    if not notes_s3_path and not audio_s3_path:
        # If neither was saved, and there were actual attempts (not just S3 client unavailable)
        # This might be too complex; simplify to: if paths are None, it's an issue.
        # For now, if both are None, let's assume it's an error unless S3 wasn't available.
        if s3_client: # only raise 500 if s3 was available and uploads failed
            raise HTTPException(status_code=500, detail=f"Failed to save session data. Reported issues: {'; '.join(messages)}")
    
    return {
        "message": "Session data processing attempted.",
        "notes_s3_path": notes_s3_path,
        "audio_s3_path": audio_s3_path,
        "details": messages
    }

if __name__ == "__main__":
    if not deepgram_api_key:
        print("deepgram_api_key not found. Ensure .env is in the /Users/davidmain/Desktop/trans10 directory and contains the key 'deepgram_api_key'.")
    else:
        print(f"deepgram_api_key found: {deepgram_api_key[:5]}...")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, ws_ping_interval=20, ws_ping_timeout=20)
