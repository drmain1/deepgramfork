import asyncio
import logging
import os
import json
import tempfile
from datetime import datetime
from dotenv import load_dotenv
from fastapi import WebSocket # For type hinting, WebSocketDisconnect might not be needed here
from deepgram import (
    AsyncLiveClient,
    DeepgramClientOptions,
    LiveOptions,
    LiveTranscriptionEvents,
)
from deepgram.clients.listen.v1.websocket.response import CloseResponse

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=dotenv_path)

DEEPGRAM_API_KEY = os.getenv("deepgram_api_key")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Directory for temporary audio files specific to deepgram_utils
DG_TEMP_AUDIO_DIR = os.path.join(tempfile.gettempdir(), "trans10_dg_audio_temp")
os.makedirs(DG_TEMP_AUDIO_DIR, exist_ok=True)
logger.info(f"Deepgram temporary audio files will be stored in: {DG_TEMP_AUDIO_DIR}")

async def convert_raw_pcm_to_wav(input_pcm_path: str, output_wav_path: str) -> bool:
    ffmpeg_cmd = [
        'ffmpeg',
        '-f', 's16le', 
        '-ar', '16000',
        '-ac', '1',
        '-i', input_pcm_path,
        '-y',
        output_wav_path
    ]
    logger.info(f"Converting PCM to WAV: {' '.join(ffmpeg_cmd)}")
    process = await asyncio.create_subprocess_exec(
        *ffmpeg_cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    stdout, stderr = await process.communicate()
    if process.returncode == 0:
        logger.info(f"Successfully converted {input_pcm_path} to {output_wav_path}")
        return True
    else:
        logger.error(f"Error converting PCM to WAV. FFMPEG stderr: {stderr.decode().strip()}")
        return False

async def handle_deepgram_websocket(websocket: WebSocket, get_user_settings_func: callable):
    await websocket.accept()
    logger.info(f"WebSocket connection accepted from: {websocket.client.host}:{websocket.client.port}")

    session_id = datetime.now().strftime("%Y%m%d%H%M%S%f")
    dg_smart_format = True
    dg_diarize = False
    user_profile_utterances = False # Default, will be updated from profile if available

    initial_message_str = await websocket.receive_text()
    try:
        initial_message = json.loads(initial_message_str)
        logger.info(f"Received initial message from client: {initial_message}")
        user_id_from_client = initial_message.get("user_id")
        selected_profile_id_from_client = initial_message.get("profile_id")

        if user_id_from_client and selected_profile_id_from_client:
            logger.info(f"Attempting to load settings for user: {user_id_from_client} to find profile: {selected_profile_id_from_client}")
            try:
                user_settings = await get_user_settings_func(user_id_from_client)
                if user_settings and user_settings.transcriptionProfiles:
                    selected_profile = next((p for p in user_settings.transcriptionProfiles if p.id == selected_profile_id_from_client), None)
                    if selected_profile:
                        logger.info(f"Found profile '{selected_profile.name}'. Applying its Deepgram settings.")
                        dg_smart_format = selected_profile.smart_format
                        dg_diarize = selected_profile.diarize
                        user_profile_utterances = selected_profile.utterances
                        logger.info(f"Using profile settings: smart_format={dg_smart_format}, diarize={dg_diarize}, utterances_in_profile={user_profile_utterances}")
                    else:
                        logger.warning(f"Profile ID {selected_profile_id_from_client} not found. Using default Deepgram options.")
                else:
                    logger.warning(f"No transcription profiles for user {user_id_from_client}. Using default Deepgram options.")
            except Exception as e_settings:
                logger.error(f"Error fetching/processing user settings: {e_settings}. Using defaults.")
        else:
            logger.warning("user_id or profile_id missing in initial message. Using defaults.")
    except json.JSONDecodeError:
        logger.error(f"Could not decode initial message: {initial_message_str}. Using defaults.")
    except Exception as e_initial_msg:
        logger.error(f"Error processing initial message: {e_initial_msg}. Using defaults.")

    try:
        await websocket.send_text(json.dumps({"type": "session_init", "session_id": session_id}))
        logger.info(f"Sent session_init with session_id: {session_id} to client.")
    except Exception as e:
        logger.error(f"Error sending session_id to client: {e}")

    dg_connection = None
    ffmpeg_proc = None
    raw_pcm_file_fd, raw_pcm_file_path = tempfile.mkstemp(suffix='.pcm', dir=DG_TEMP_AUDIO_DIR)
    os.close(raw_pcm_file_fd)
    logger.info(f"Temporary raw PCM file: {raw_pcm_file_path}")

    final_transcript_accumulator = []

    try:
        client_options = DeepgramClientOptions(api_key=DEEPGRAM_API_KEY, verbose=logging.WARNING)
        dg_connection = AsyncLiveClient(client_options)

        async def on_open_handler(client, open_data, **kwargs):
            logger.info(f"Deepgram Connection Open: {open_data}")

        async def on_message_handler(client, result, **kwargs):
            transcript = result.channel.alternatives[0].transcript
            if transcript:
                # logger.debug(f"Sending transcript (is_final: {result.is_final}) to client: {transcript[:50]}...")
                await websocket.send_text(json.dumps({
                    "type": "transcript",
                    "text": transcript,
                    "is_final": result.is_final,
                    "session_id": session_id
                }))
                if result.is_final:
                    final_transcript_accumulator.append(transcript)
            if result.is_final: logger.debug("Deepgram: Final transcript received.")
            if result.speech_final: logger.debug("Deepgram: Speech final marker received.")
        
        async def on_metadata_handler(client, metadata, **kwargs): logger.info(f"Deepgram Metadata: {metadata}")
        async def on_speech_started_handler(client, speech_started, **kwargs): logger.info(f"Deepgram Speech Started: {speech_started}")
        async def on_utterance_end_handler(client, utterance_end, **kwargs): logger.info(f"Deepgram Utterance Ended: {utterance_end}")
        async def on_error_handler(client, error_payload, **kwargs): logger.error(f"Deepgram Error: {error_payload}")
        async def on_warning_handler(client, warning_payload, **kwargs): logger.warning(f"Deepgram Warning: {warning_payload}")
        async def on_close_handler(client, close: CloseResponse, **kwargs): logger.info(f"Deepgram Connection Closed. Code: {close.code}, Reason: {close.reason}")

        dg_connection.on(LiveTranscriptionEvents.Open, on_open_handler)
        dg_connection.on(LiveTranscriptionEvents.Transcript, on_message_handler)
        dg_connection.on(LiveTranscriptionEvents.Metadata, on_metadata_handler)
        dg_connection.on(LiveTranscriptionEvents.SpeechStarted, on_speech_started_handler)
        dg_connection.on(LiveTranscriptionEvents.UtteranceEnd, on_utterance_end_handler)
        dg_connection.on(LiveTranscriptionEvents.Error, on_error_handler)
        dg_connection.on(LiveTranscriptionEvents.Warning, on_warning_handler)
        dg_connection.on(LiveTranscriptionEvents.Close, on_close_handler)
        
        options_dict = {
            "model": "nova-3-medical",
            "language": "en-US",
            "smart_format": dg_smart_format,
            "diarize": dg_diarize,
            "encoding": "linear16",
            "sample_rate": 16000,
            "channels": 1,
            "interim_results": True,
            "utterance_end_ms": "1000",
            "vad_events": True,
        }
        # Conditionally add utterances if it was true in profile and we're testing it.
        # For now, adhering to MEMORY[4a3e7cda-15af-49b0-a065-3ef40cb7be39] - it's typically managed by utterance_end_ms and vad_events.
        # If future SDK versions handle 'utterances' kwarg differently, this can be revisited.
        # if user_profile_utterances:
        #    options_dict["utterances"] = True 

        live_options = LiveOptions(**options_dict)

        logger.info(f"Attempting to start Deepgram connection with options: {options_dict}")
        if not await dg_connection.start(live_options):
            logger.error("Failed to start Deepgram connection.")
            await websocket.close(code=1011, reason="Failed to connect to speech service")
            return
        logger.info("Deepgram connection started successfully.")

        ffmpeg_command = ['ffmpeg', '-loglevel', 'error', '-i', 'pipe:0', '-f', 's16le', '-acodec', 'pcm_s16le', '-ac', '1', '-ar', '16000', 'pipe:1']
        logger.info(f"Starting ffmpeg: {' '.join(ffmpeg_command)}")
        ffmpeg_proc = await asyncio.create_subprocess_exec(*ffmpeg_command, stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        logger.info("ffmpeg process started.")

        async def read_ffmpeg_stdout():
            try:
                while True:
                    if not ffmpeg_proc or not ffmpeg_proc.stdout: break
                    data = await ffmpeg_proc.stdout.read(4096)
                    if not data: logger.info("FFMPEG stdout EOF."); break
                    if dg_connection and dg_connection.is_connected: await dg_connection.send(data)
                    else: logger.warning("DG conn closed/unavailable. Breaking stdout read."); break
                    if raw_pcm_file_path: 
                        with open(raw_pcm_file_path, 'ab') as f: f.write(data)
            except Exception as e: logger.error(f"read_ffmpeg_stdout error: {e}", exc_info=True)
            finally: logger.info("Exiting read_ffmpeg_stdout.")

        async def log_ffmpeg_stderr():
            try:
                while True:
                    if not ffmpeg_proc or not ffmpeg_proc.stderr: break
                    line = await ffmpeg_proc.stderr.readline()
                    if not line: logger.info("FFMPEG stderr EOF."); break
                    logger.error(f"ffmpeg stderr: {line.decode().strip()}")
            except Exception as e: logger.error(f"log_ffmpeg_stderr error: {e}", exc_info=True)
            finally: logger.info("Exiting log_ffmpeg_stderr.")

        async def forward_audio_to_ffmpeg_task_fn():
            logger.info("forward_audio_to_ffmpeg task started.")
            try:
                while True:
                    audio_data = await websocket.receive_bytes()
                    if not audio_data: logger.info("Empty bytes from client, ending forward."); break 
                    if ffmpeg_proc and ffmpeg_proc.stdin and not ffmpeg_proc.stdin.is_closing():
                        ffmpeg_proc.stdin.write(audio_data); await ffmpeg_proc.stdin.drain()
                    else: logger.warning("FFMPEG stdin closed/unavailable. Breaking forward."); break
            except WebSocketDisconnect:
                logger.info("Client disconnected during audio forwarding.")
            except Exception as e: logger.error(f"forward_audio_to_ffmpeg error: {e}", exc_info=True)
            finally:
                logger.info("Exiting forward_audio_to_ffmpeg.")
                if ffmpeg_proc and ffmpeg_proc.stdin and not ffmpeg_proc.stdin.is_closing():
                    try: ffmpeg_proc.stdin.close() # await ffmpeg_proc.stdin.wait_closed() # Python 3.11+
                    except Exception as e_stdin_close: logger.error(f"Error closing ffmpeg stdin: {e_stdin_close}")
        
        tasks = [
            asyncio.create_task(read_ffmpeg_stdout(), name="ReadFFmpegStdOut"),
            asyncio.create_task(log_ffmpeg_stderr(), name="LogFFmpegStdErr"),
            asyncio.create_task(forward_audio_to_ffmpeg_task_fn(), name="ForwardAudioToFFmpeg")
        ]
        await asyncio.gather(*tasks, return_exceptions=True)

    except WebSocketDisconnect as e:
        logger.info(f"Client disconnected: {e.code} {e.reason}")
    except Exception as e:
        logger.error(f"WebSocket stream error: {e}", exc_info=True)
        if websocket.client_state.value != 3: # WebSocketState.DISCONNECTED is 3
             try: await websocket.close(code=1011, reason=f"Server error: {str(e)[:120]}")
             except: pass # Ignore errors during close if already problematic
    finally:
        logger.info(f"Cleaning up for session_id: {session_id}")
        
        # Cancel any lingering tasks
        if 'tasks' in locals():
            for task in tasks:
                if not task.done(): task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True) # Wait for cancellation

        if dg_connection and dg_connection.is_connected:
            logger.info("Closing Deepgram connection.")
            await dg_connection.finish()
            logger.info("Deepgram connection closed.")

        if ffmpeg_proc and ffmpeg_proc.returncode is None:
            logger.info("Terminating FFMPEG process.")
            try: 
                ffmpeg_proc.terminate()
                await asyncio.wait_for(ffmpeg_proc.wait(), timeout=2.0)
            except asyncio.TimeoutError: ffmpeg_proc.kill(); await ffmpeg_proc.wait()
            except Exception as e_ffmpeg_term: logger.error(f"Error terminating FFMPEG: {e_ffmpeg_term}")
            logger.info(f"FFMPEG exited with {ffmpeg_proc.returncode}.")

        target_wav_filename = f"{session_id}.wav"
        target_wav_path = os.path.join(DG_TEMP_AUDIO_DIR, target_wav_filename)
        final_payload = {
            "type": "session_end", "session_id": session_id,
            "full_transcript": " ".join(final_transcript_accumulator),
            "temp_wav_path": None, "temp_wav_filename": None, # Will be set if conversion succeeds
            "message": "Session processing ended."
        }

        if os.path.exists(raw_pcm_file_path) and os.path.getsize(raw_pcm_file_path) > 0:
            if await convert_raw_pcm_to_wav(raw_pcm_file_path, target_wav_path):
                logger.info(f"Audio for {session_id} converted to {target_wav_path}")
                final_payload["temp_wav_path"] = target_wav_path
                final_payload["temp_wav_filename"] = target_wav_filename
                final_payload["message"] = "Session ended. Full transcript and audio processing complete."
            else:
                logger.error(f"Failed to convert audio for {session_id}.")
                final_payload["error"] = "Audio conversion failed."
        else:
            logger.warning(f"PCM file {raw_pcm_file_path} empty or not found. No WAV conversion.")
            final_payload["message"] = "Session ended. Audio data was empty or missing."
            if not os.path.exists(raw_pcm_file_path): final_payload["error"] = "Audio data not found."
            else: final_payload["error"] = "Audio data was empty."

        try: 
            await websocket.send_text(json.dumps(final_payload))
            logger.info(f"Sent session_end to client for {session_id}.")
        except Exception as e_send_final: logger.error(f"Failed to send session_end: {e_send_final}")

        if os.path.exists(raw_pcm_file_path):
            try: os.remove(raw_pcm_file_path); logger.info(f"Removed temp PCM: {raw_pcm_file_path}")
            except OSError as e: logger.error(f"Error removing {raw_pcm_file_path}: {e}")
        
        logger.info(f"Finished cleanup for WebSocket session_id: {session_id}")
