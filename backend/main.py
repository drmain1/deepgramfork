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

# Ensure the .env file is in the root of the trans10 directory or adjust path
# Example: load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=dotenv_path)

deepgram_api_key = os.getenv("deepgram_api_key")

app = FastAPI()

config = DeepgramClientOptions(
    api_key=deepgram_api_key, 
    verbose=0, 
)
deepgram_client = AsyncLiveClient(config)

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
    await websocket.accept()
    print("Client connected to /stream endpoint")

    dg_connection = AsyncLiveClient(config)
    ffmpeg_process = None
    forward_audio_task = None
    log_ffmpeg_stderr_task = None

    try:
        # Define event handlers (nested functions)
        async def on_open_handler(client, open_data, **kwargs):
            print(f"Deepgram Connection Open. Client instance: {client}, Open Data: {open_data}")

        async def on_message_handler(client, result, **kwargs):
            # print(f"--- Deepgram on_message RAW Result: {result}") 
            transcript = result.channel.alternatives[0].transcript
            if transcript:
                print(f"Transcript from Deepgram: {transcript}")
                await websocket.send_text(transcript) # Send transcript to client
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
        ffmpeg_process = await asyncio.create_subprocess_exec(
            *ffmpeg_command,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        print("ffmpeg process started.")

        # Task to read transcoded audio from ffmpeg's stdout and send to Deepgram
        async def forward_audio_to_deepgram():
            try:
                while True:
                    pcm_audio_data = await ffmpeg_process.stdout.read(4096) # Read in chunks
                    if not pcm_audio_data:
                        print("ffmpeg stdout EOF, stopping forwarder.")
                        break # ffmpeg process has closed its stdout
                    # print(f"Read {len(pcm_audio_data)} bytes from ffmpeg stdout, sending to Deepgram.")
                    await dg_connection.send(pcm_audio_data)
            except asyncio.CancelledError:
                print("Audio forwarding task cancelled.")
            except Exception as e:
                print(f"Error in forward_audio_to_deepgram: {e}")
            finally:
                print("forward_audio_to_deepgram task finished.")

        # Task to log ffmpeg's stderr for debugging
        async def log_ffmpeg_stderr_output():
            try:
                while True:
                    line = await ffmpeg_process.stderr.readline()
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

        forward_audio_task = asyncio.create_task(forward_audio_to_deepgram())
        log_ffmpeg_stderr_task = asyncio.create_task(log_ffmpeg_stderr_output())

        # Background task to keep Deepgram connection alive (already part of dg_connection SDK v3+)
        # The SDK handles keepalives automatically. If issues persist, this could be re-added
        # but typically not needed with AsyncLiveClient.

        # Main loop to receive audio from client and pipe to ffmpeg
        while True:
            audio_data_from_client = await websocket.receive_bytes()
            # print(f"Received {len(audio_data_from_client)} bytes from client WebSocket.")

            if audio_data_from_client:
                if ffmpeg_process and ffmpeg_process.stdin and not ffmpeg_process.stdin.is_closing():
                    try:
                        ffmpeg_process.stdin.write(audio_data_from_client)
                        await ffmpeg_process.stdin.drain()
                    except BrokenPipeError:
                        print("ffmpeg stdin pipe broken. Cannot write more data. Ending receive loop.")
                        break # Exit loop, ffmpeg likely died or stdin closed
                    except Exception as e:
                        print(f"Error writing to ffmpeg stdin: {e}. Ending receive loop.")
                        break
                else:
                    print("ffmpeg process stdin not available. Ending receive loop.")
                    break
            else:
                # Client might send an empty message to signal end of stream, or it might be an error.
                print("Received empty data from client. Assuming end of stream or issue.")
                break
            
    except WebSocketDisconnect:
        print("Client disconnected from /stream endpoint")
    except Exception as e:
        print(f"Error in WebSocket connection main try-block: {e}")
        import traceback
        traceback.print_exc()
    finally:
        print("Initiating cleanup...")

        # Cancel helper tasks
        if forward_audio_task and not forward_audio_task.done():
            forward_audio_task.cancel()
        if log_ffmpeg_stderr_task and not log_ffmpeg_stderr_task.done():
            log_ffmpeg_stderr_task.cancel()
        
        # Attempt to gracefully close ffmpeg stdin first
        if ffmpeg_process and ffmpeg_process.stdin and not ffmpeg_process.stdin.is_closing():
            print("Closing ffmpeg stdin...")
            try:
                ffmpeg_process.stdin.close()
                # For Python 3.11+ you can await ffmpeg_process.stdin.wait_closed()
            except Exception as e:
                print(f"Error closing ffmpeg stdin: {e}")

        # Wait for tasks to finish (important after cancelling)
        try:
            if forward_audio_task:
                await forward_audio_task
            if log_ffmpeg_stderr_task:
                await log_ffmpeg_stderr_task
        except asyncio.CancelledError:
            print("Helper tasks confirmed cancelled.")
        except Exception as e:
            print(f"Error awaiting helper tasks: {e}")

        # Terminate ffmpeg process
        if ffmpeg_process and ffmpeg_process.returncode is None: # If still running
            print("Terminating ffmpeg process...")
            try:
                # Try to wait for a bit for graceful exit after stdin close
                await asyncio.wait_for(ffmpeg_process.wait(), timeout=2.0)
                print(f"ffmpeg process exited with code {ffmpeg_process.returncode}.")
            except asyncio.TimeoutError:
                print("ffmpeg process did not exit gracefully after 2s, killing.")
                ffmpeg_process.kill()
                await ffmpeg_process.wait() # Ensure it's killed
                print(f"ffmpeg process killed, exit code {ffmpeg_process.returncode}.")
            except Exception as e:
                print(f"Error during ffmpeg termination: {e}")
                if ffmpeg_process.returncode is None: # Still running despite error
                    ffmpeg_process.kill()
                    await ffmpeg_process.wait()
                    print(f"ffmpeg process force-killed after error, exit code {ffmpeg_process.returncode}.")
        elif ffmpeg_process:
            print(f"ffmpeg process already exited with code {ffmpeg_process.returncode}.")

        # Close Deepgram connection
        if dg_connection:
            print("Closing Deepgram connection...")
            await dg_connection.finish()
            print("Deepgram connection finished.")
        
        # Ensure client websocket is closed if not already (FastAPI might handle this)
        # if websocket.client_state == WebSocketState.CONNECTED:
        #     print("Closing client WebSocket connection.")
        #     await websocket.close(code=1000)
        #     print("Client WebSocket connection closed.")

        print("Cleanup complete.")

if __name__ == "__main__":
    if not deepgram_api_key:
        print("deepgram_api_key not found. Ensure .env is in the /Users/davidmain/Desktop/trans10 directory and contains the key 'deepgram_api_key'.")
    else:
        print(f"deepgram_api_key found: {deepgram_api_key[:5]}...")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, ws_ping_interval=20, ws_ping_timeout=20)
