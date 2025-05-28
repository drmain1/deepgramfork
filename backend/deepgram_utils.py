import asyncio
import logging
import os
import json
from datetime import datetime
from dotenv import load_dotenv
from fastapi import WebSocket, WebSocketDisconnect
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

async def handle_deepgram_websocket(websocket: WebSocket, get_user_settings_func: callable):
    await websocket.accept()
    logger.info(f"WebSocket connection accepted from: {websocket.client.host}:{websocket.client.port}")

    session_id = datetime.now().strftime("%Y%m%d%H%M%S%f")
    
    # Initialize Deepgram settings
    dg_smart_format = True  # Default value
    dg_diarize = False  # Default value
    user_profile_utterances = False  # Default value
    multilingual_enabled = False  # Default value
    target_language = None  # Default value for specific language targeting
    deepgram_started = False

    # Send session init immediately with default settings
    try:
        await websocket.send_text(json.dumps({"type": "session_init", "session_id": session_id}))
        logger.info(f"Sent session_init with session_id: {session_id} to client.")
    except Exception as e:
        logger.error(f"Error sending session_id to client: {e}")
        return

    dg_connection = None
    ffmpeg_proc = None

    final_transcript_accumulator = []

    async def start_deepgram_connection():
        """Initialize Deepgram connection with current settings"""
        nonlocal dg_connection, deepgram_started
        
        if deepgram_started:
            return True
            
        try:
            client_options = DeepgramClientOptions(api_key=DEEPGRAM_API_KEY, verbose=logging.WARNING)
            dg_connection = AsyncLiveClient(client_options)

            async def on_open_handler(client, open_data, **kwargs):
                logger.info(f"Deepgram Connection Open: {open_data}")

            async def on_message_handler(client, result, **kwargs):
                transcript = result.channel.alternatives[0].transcript
                if transcript:
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
            async def on_close_handler(client, close, **kwargs): logger.info(f"Deepgram Connection Closed. Code: {close.code}, Reason: {close.reason}")

            dg_connection.on(LiveTranscriptionEvents.Open, on_open_handler)
            dg_connection.on(LiveTranscriptionEvents.Transcript, on_message_handler)
            dg_connection.on(LiveTranscriptionEvents.Metadata, on_metadata_handler)
            dg_connection.on(LiveTranscriptionEvents.SpeechStarted, on_speech_started_handler)
            dg_connection.on(LiveTranscriptionEvents.UtteranceEnd, on_utterance_end_handler)
            dg_connection.on(LiveTranscriptionEvents.Error, on_error_handler)
            dg_connection.on(LiveTranscriptionEvents.Warning, on_warning_handler)
            dg_connection.on(LiveTranscriptionEvents.Close, on_close_handler)
            
            # Choose model and language based on multilingual setting
            if multilingual_enabled:
                if target_language == "es" or target_language == "spanish":
                    # For pure Spanish content, use Nova-2 which has better Spanish support
                    model_name = "nova-2-general"
                    language_setting = "es"
                    logger.info("Multilingual mode with Spanish target - using nova-2-general with language=es for pure Spanish content")
                elif target_language and target_language != "multi":
                    # For other specific languages, try Nova-2 first
                    model_name = "nova-2-general"
                    language_setting = target_language
                    logger.info(f"Multilingual mode with {target_language} target - using nova-2-general with language={target_language}")
                else:
                    # For general multilingual/code-switching, use Nova-3
                    model_name = "nova-3-general"
                    language_setting = "multi"
                    logger.info("Multilingual mode enabled - using nova-3-general with language=multi for code-switching")
                    logger.info("Note: For pure single-language content, consider specifying target_language in the request")
            else:
                model_name = "nova-3-medical"
                language_setting = "en-US"
                logger.info("Monolingual mode - using nova-3-medical with en-US language")
            
            options_dict = {
                "model": model_name,
                "smart_format": dg_smart_format,
                "diarize": dg_diarize,
                "encoding": "linear16",
                "sample_rate": 16000,
                "channels": 1,
                "interim_results": True,
                "utterance_end_ms": "1000",
                "vad_events": True,
                "language": language_setting,
            }

            live_options = LiveOptions(**options_dict)

            logger.info(f"Starting Deepgram connection with options: {options_dict}")
            if not await dg_connection.start(live_options):
                logger.error("Failed to start Deepgram connection.")
                return False
            
            logger.info("Deepgram connection started successfully.")
            deepgram_started = True
            return True
            
        except Exception as e:
            logger.error(f"Error starting Deepgram connection: {e}")
            return False

    async def start_ffmpeg():
        """Initialize FFmpeg process"""
        nonlocal ffmpeg_proc
        
        if ffmpeg_proc:
            return True
            
        try:
            ffmpeg_command = ['ffmpeg', '-loglevel', 'error', '-i', 'pipe:0', '-f', 's16le', '-acodec', 'pcm_s16le', '-ac', '1', '-ar', '16000', 'pipe:1']
            logger.info(f"Starting ffmpeg: {' '.join(ffmpeg_command)}")
            ffmpeg_proc = await asyncio.create_subprocess_exec(*ffmpeg_command, stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
            logger.info("ffmpeg process started.")
            return True
        except Exception as e:
            logger.error(f"Error starting FFmpeg: {e}")
            return False

    async def handle_configuration_message(config_data):
        """Handle configuration messages from client"""
        nonlocal dg_smart_format, dg_diarize, user_profile_utterances, multilingual_enabled, target_language
        
        try:
            user_id_from_client = config_data.get("user_id")
            selected_profile_id_from_client = config_data.get("profile_id")
            is_multilingual_from_client = config_data.get("is_multilingual", False)
            target_language_from_client = config_data.get("target_language", None)  # New: specific language target
            
            # Update multilingual setting from client
            multilingual_enabled = is_multilingual_from_client
            target_language = target_language_from_client
            logger.info(f"Multilingual setting from client: {multilingual_enabled}")
            if target_language:
                logger.info(f"Target language specified: {target_language}")

            if user_id_from_client and selected_profile_id_from_client:
                logger.info(f"Updating settings for user: {user_id_from_client}, profile: {selected_profile_id_from_client}")
                try:
                    user_settings = await get_user_settings_func(user_id_from_client)
                    if user_settings and user_settings.transcriptionProfiles:
                        selected_profile = next((p for p in user_settings.transcriptionProfiles if p.id == selected_profile_id_from_client), None)
                        if selected_profile:
                            logger.info(f"Found profile '{selected_profile.name}'. Updating Deepgram settings.")
                            dg_smart_format = selected_profile.smart_format
                            dg_diarize = selected_profile.diarize
                            user_profile_utterances = selected_profile.utterances
                            logger.info(f"Updated settings: smart_format={dg_smart_format}, diarize={dg_diarize}, utterances={user_profile_utterances}, multilingual_enabled={multilingual_enabled}")
                        else:
                            logger.warning(f"Profile ID {selected_profile_id_from_client} not found.")
                    else:
                        logger.warning(f"No transcription profiles for user {user_id_from_client}.")
                except Exception as e_settings:
                    logger.error(f"Error fetching/processing user settings: {e_settings}")
            else:
                logger.warning("user_id or profile_id missing in configuration message.")
        except Exception as e:
            logger.error(f"Error processing configuration message: {e}")

    try:
        # Start with basic initialization - services will start when first audio data arrives
        services_started = False
        
        async def read_ffmpeg_stdout():
            """Read processed audio from FFmpeg and send to Deepgram"""
            try:
                while ffmpeg_proc and ffmpeg_proc.stdout:
                    data = await ffmpeg_proc.stdout.read(4096)
                    if not data: 
                        logger.info("FFMPEG stdout EOF.")
                        break
                    if dg_connection and dg_connection.is_connected:
                        await dg_connection.send(data)
                    else:
                        logger.warning("DG conn closed/unavailable. Breaking stdout read.")
                        break
            except Exception as e: 
                logger.error(f"read_ffmpeg_stdout error: {e}", exc_info=True)
            finally: 
                logger.info("Exiting read_ffmpeg_stdout.")

        async def log_ffmpeg_stderr():
            """Log FFmpeg errors"""
            try:
                while ffmpeg_proc and ffmpeg_proc.stderr:
                    line = await ffmpeg_proc.stderr.readline()
                    if not line: 
                        logger.info("FFMPEG stderr EOF.")
                        break
                    logger.error(f"ffmpeg stderr: {line.decode().strip()}")
            except Exception as e: 
                logger.error(f"log_ffmpeg_stderr error: {e}", exc_info=True)
            finally: 
                logger.info("Exiting log_ffmpeg_stderr.")

        async def websocket_message_handler():
            """Handle all WebSocket messages"""
            nonlocal services_started
            logger.info("WebSocket message handler started.")
            
            try:
                while True:
                    message_data = await websocket.receive()
                    
                    if "bytes" in message_data:
                        # Handle audio data
                        audio_data = message_data["bytes"]
                        if not audio_data: 
                            logger.info("Empty bytes from client, ending session.")
                            break
                        
                        # Start services on first audio data
                        if not services_started:
                            logger.info("First audio data received, starting services...")
                            if await start_ffmpeg() and await start_deepgram_connection():
                                services_started = True
                                logger.info("Services started successfully.")
                                # Start the FFmpeg monitoring tasks
                                asyncio.create_task(read_ffmpeg_stdout(), name="ReadFFmpegStdOut")
                                asyncio.create_task(log_ffmpeg_stderr(), name="LogFFmpegStdErr")
                            else:
                                logger.error("Failed to start services.")
                                break
                        
                        # Forward audio data to FFmpeg
                        if ffmpeg_proc and ffmpeg_proc.stdin and not ffmpeg_proc.stdin.is_closing():
                            ffmpeg_proc.stdin.write(audio_data)
                            await ffmpeg_proc.stdin.drain()
                        else: 
                            logger.warning("FFMPEG stdin closed/unavailable. Breaking handler.")
                            break
                            
                    elif "text" in message_data:
                        # Handle text messages (configuration, control messages)
                        text_data = message_data["text"]
                        logger.debug(f"Received text message: {text_data}")
                        
                        try:
                            text_message = json.loads(text_data)
                            message_type = text_message.get("type")
                            
                            if message_type == "initial_metadata":
                                logger.info("Received configuration message")
                                await handle_configuration_message(text_message)
                            elif message_type == "eos":
                                logger.info("Received end-of-stream signal from client.")
                                break
                            else:
                                logger.debug(f"Ignoring text message type: {message_type}")
                                
                        except json.JSONDecodeError:
                            logger.debug(f"Received non-JSON text message: {text_data}")
                    
                    elif message_data.get("type") == "websocket.disconnect":
                        logger.info("WebSocket disconnect received.")
                        break
                    else:
                        logger.warning(f"Received unexpected message format: {message_data}")
                        
            except WebSocketDisconnect:
                logger.info("Client disconnected during message handling.")
            except RuntimeError as e:
                if "Cannot call \"receive\" once a disconnect message has been received" in str(e):
                    logger.info("WebSocket already disconnected.")
                else:
                    logger.error(f"WebSocket RuntimeError: {e}")
            except Exception as e: 
                logger.error(f"WebSocket message handler error: {e}", exc_info=True)
            finally:
                logger.info("Exiting WebSocket message handler.")
                if ffmpeg_proc and ffmpeg_proc.stdin and not ffmpeg_proc.stdin.is_closing():
                    try: 
                        ffmpeg_proc.stdin.close()
                    except Exception as e_stdin_close: 
                        logger.error(f"Error closing ffmpeg stdin: {e_stdin_close}")
        
        # Run the main message handler
        await websocket_message_handler()

    except WebSocketDisconnect as e:
        logger.info(f"Client disconnected: {e.code} {e.reason}")
    except Exception as e:
        logger.error(f"WebSocket stream error: {e}", exc_info=True)
        if hasattr(websocket, 'client_state') and websocket.client_state.value != 3: # WebSocketState.DISCONNECTED is 3
             try: 
                 await websocket.close(code=1011, reason=f"Server error: {str(e)[:120]}")
             except: 
                 pass # Ignore errors during close if already problematic
    finally:
        logger.info(f"Cleaning up for session_id: {session_id}")
        
        # No need to cancel tasks since we're not using asyncio.gather with task list anymore

        if dg_connection and dg_connection.is_connected:
            logger.info("Closing Deepgram connection.")
            try:
                await dg_connection.finish()
                logger.info("Deepgram connection closed.")
            except Exception as e_dg_close:
                logger.error(f"Error closing Deepgram connection: {e_dg_close}")

        if ffmpeg_proc and ffmpeg_proc.returncode is None:
            logger.info("Terminating FFMPEG process.")
            try: 
                ffmpeg_proc.terminate()
                await asyncio.wait_for(ffmpeg_proc.wait(), timeout=2.0)
            except asyncio.TimeoutError: 
                ffmpeg_proc.kill()
                await ffmpeg_proc.wait()
            except Exception as e_ffmpeg_term: 
                logger.error(f"Error terminating FFMPEG: {e_ffmpeg_term}")
            logger.info(f"FFMPEG exited with {ffmpeg_proc.returncode}.")

        final_payload = {
            "type": "session_end",
            "session_id": session_id,
            "full_transcript": " ".join(final_transcript_accumulator),
            "message": "Session ended. Transcript processing complete."
        }

        # Only try to send final payload if WebSocket is still connected
        try: 
            if hasattr(websocket, 'client_state') and websocket.client_state.value == 1:  # WebSocketState.CONNECTED is 1
                await websocket.send_text(json.dumps(final_payload))
                logger.info(f"Sent session_end to client for {session_id}.")
            else:
                logger.info("WebSocket already disconnected, skipping session_end message.")
        except Exception as e_send_final: 
            logger.error(f"Failed to send session_end: {e_send_final}")

        logger.info(f"Finished cleanup for WebSocket session_id: {session_id}")
