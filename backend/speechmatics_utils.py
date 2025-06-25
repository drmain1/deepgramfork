import asyncio
import logging
import os
import json
from datetime import datetime, timezone
from dotenv import load_dotenv
from fastapi import WebSocket, WebSocketDisconnect
import speechmatics
from speechmatics.models import ConnectionSettings, TranscriptionConfig, AudioSettings, ServerMessageType, TranslationConfig

# Configure logging first
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables - try multiple locations
backend_env_path = os.path.join(os.path.dirname(__file__), '.env')
parent_env_path = os.path.join(os.path.dirname(__file__), '..', '.env')

if os.path.exists(backend_env_path):
    load_dotenv(dotenv_path=backend_env_path)
    logger.info(f"Loaded .env from backend directory: {backend_env_path}")
elif os.path.exists(parent_env_path):
    load_dotenv(dotenv_path=parent_env_path)
    logger.info(f"Loaded .env from parent directory: {parent_env_path}")
else:
    logger.warning("No .env file found in backend or parent directory")

SPEECHMATICS_API_KEY = os.getenv("SPEECHMATICS_API_KEY")

# Debug log the API key status
if SPEECHMATICS_API_KEY:
    logger.info(f"Speechmatics API key loaded successfully (length: {len(SPEECHMATICS_API_KEY)})")
else:
    logger.error("SPEECHMATICS_API_KEY not found in environment variables!")

async def handle_speechmatics_websocket(websocket: WebSocket, get_user_settings_func: callable, authenticated_user_id: str = None):
    # WebSocket is already accepted in the main endpoint after auth
    logger.info(f"Speechmatics WebSocket connection accepted from: {websocket.client.host}:{websocket.client.port} for user: {authenticated_user_id}")

    # Generate default session ID - may be overridden by client
    session_id = datetime.now().strftime("%Y%m%d%H%M%S%f")
    
    # Initialize Speechmatics settings
    user_profile_utterances = False  # Default value
    target_language = "multi"  # Default for multilingual
    speechmatics_started = False

    # Don't send session_init yet - wait until after we process initial_metadata
    session_init_sent = False

    # Initialize Speechmatics and FFmpeg immediately so they're ready for audio data
    logger.info("Initializing Speechmatics and FFmpeg immediately for incoming audio...")
    
    sm_ws_client = None
    ffmpeg_proc = None
    final_transcript_accumulator = []

    # Start Speechmatics and FFmpeg immediately
    async def initialize_services():
        """Initialize services immediately when WebSocket connects"""
        nonlocal sm_ws_client, ffmpeg_proc
        
        # Start Speechmatics connection
        if await start_speechmatics_connection():
            logger.info("Speechmatics client initialized successfully.")
            
            # Start the transcription with the audio processor
            try:
                # Configure audio settings to match working config
                audio_settings = AudioSettings(
                    encoding="pcm_f32le",  # Changed from pcm_s16le to match working config
                    sample_rate=16000,
                    chunk_size=1600  # Optimized chunk size for 16kHz (100ms chunks)
                )

                # Remove translation config - turning off translation
                # translation_config = TranslationConfig(
                #     target_languages=["es"]  # Spanish translation
                # )
                
                transcription_config = TranscriptionConfig(
                    language="es",  # Changed to Spanish as primary language to match working config
                    enable_partials=True,
                    max_delay=1,   # Keep at 1 second
                    max_delay_mode="flexible",  # Added: matches working config
                    operating_point="enhanced",  # Keep enhanced for highest accuracy
                    # translation_config=translation_config,  # Removed: turning off translation
                    diarization="none",  # Changed from "speaker" to "none" to match working config
                    domain="bilingual-en",  # Added: for bilingual English support
                    # punctuation_permitted_marks=[".", "?", "!"],  # Removed to simplify config
                    enable_entities=True  # Keep entity recognition for better accuracy
                )

                logger.info("Starting Speechmatics transcription task immediately")
                # Run the transcription in a background task
                # The run() method might expect a stream parameter
                transcription_task = asyncio.create_task(
                    sm_ws_client.run(
                        stream=audio_processor,  # Audio stream 
                        transcription_config=transcription_config,
                        audio_settings=audio_settings
                    )
                )
                
            except Exception as e:
                logger.error(f"Error starting Speechmatics transcription: {e}")
                return False
        else:
            logger.error("Failed to create Speechmatics client.")
            return False

        # Start FFmpeg process
        if await start_ffmpeg():
            logger.info("FFmpeg process initialized successfully.")
        else:
            logger.error("Failed to start FFmpeg process.")
            return False
            
        return True

    async def start_speechmatics_connection():
        """Initialize Speechmatics connection with current settings"""
        nonlocal sm_ws_client, speechmatics_started
        
        if speechmatics_started:
            return True
            
        try:
            # Create connection settings
            connection_settings = ConnectionSettings(
                url="wss://eu2.rt.speechmatics.com/v2",
                auth_token=SPEECHMATICS_API_KEY,
            )
            
            # Create the WebSocket client
            sm_ws_client = speechmatics.client.WebsocketClient(connection_settings)

            # Define event handlers for different types of messages
            def on_partial_transcript(msg):
                """Handle partial transcript messages"""
                try:
                    transcript = msg.get('metadata', {}).get('transcript', '')
                    if transcript:
                        # Use create_task for async websocket operation
                        asyncio.create_task(websocket.send_text(json.dumps({
                            "type": "transcript",
                            "text": transcript,
                            "is_final": False,
                            "session_id": session_id,
                            "source": "speechmatics"
                        })))
                        logger.debug("Speechmatics: Partial transcript sent.")
                except Exception as e:
                    logger.error(f"Error handling partial transcript: {e}")

            def on_final_transcript(msg):
                """Handle final transcript messages"""
                try:
                    transcript = msg.get('metadata', {}).get('transcript', '')
                    if transcript:
                        # Use create_task for async websocket operation
                        asyncio.create_task(websocket.send_text(json.dumps({
                            "type": "transcript",
                            "text": transcript,
                            "is_final": True,
                            "session_id": session_id,
                            "source": "speechmatics"
                        })))
                        final_transcript_accumulator.append(transcript)
                        logger.debug("Speechmatics: Final transcript sent.")
                except Exception as e:
                    logger.error(f"Error handling final transcript: {e}")

            # def on_translation(msg):
            #     """Handle translation messages"""
            #     try:
            #         # Speechmatics translation format
            #         results = msg.get('results', [])
            #         language = msg.get('language', 'unknown')
            #         
            #         for result in results:
            #             content = result.get('content', '')
            #             if content:
            #                 # Use create_task for async websocket operation
            #                 asyncio.create_task(websocket.send_text(json.dumps({
            #                     "type": "translation",
            #                     "text": content,
            #                     "language": language,
            #                     "is_final": True,
            #                     "session_id": session_id,
            #                     "source": "speechmatics"
            #                 })))
            #                 logger.debug(f"Speechmatics: Translation sent for language {language}.")
            #     except Exception as e:
            #         logger.error(f"Error handling translation: {e}")

            def on_recognition_started(msg):
                """Handle recognition started messages"""
                logger.info(f"Speechmatics Recognition Started: {msg}")
                nonlocal speechmatics_started
                speechmatics_started = True

            def on_error(msg):
                """Handle error messages"""
                logger.error(f"Speechmatics Error: {msg}")

            def on_warning(msg):
                """Handle warning messages"""
                logger.warning(f"Speechmatics Warning: {msg}")

            # Register event handlers
            sm_ws_client.add_event_handler(
                event_name=ServerMessageType.AddPartialTranscript,
                event_handler=on_partial_transcript,
            )

            sm_ws_client.add_event_handler(
                event_name=ServerMessageType.AddTranscript,
                event_handler=on_final_transcript,
            )

            # Translation handlers commented out since we're disabling translation
            # sm_ws_client.add_event_handler(
            #     event_name=ServerMessageType.AddTranslation,
            #     event_handler=on_translation,
            # )

            # sm_ws_client.add_event_handler(
            #     event_name=ServerMessageType.AddPartialTranslation,
            #     event_handler=on_translation,
            # )

            sm_ws_client.add_event_handler(
                event_name=ServerMessageType.RecognitionStarted,
                event_handler=on_recognition_started,
            )

            sm_ws_client.add_event_handler(
                event_name=ServerMessageType.Error,
                event_handler=on_error,
            )

            sm_ws_client.add_event_handler(
                event_name=ServerMessageType.Warning,
                event_handler=on_warning,
            )

            logger.info("Speechmatics client created and event handlers registered")
            return True
            
        except Exception as e:
            logger.error(f"Error creating Speechmatics client: {e}")
            return False

    async def start_ffmpeg():
        """Initialize FFmpeg process"""
        nonlocal ffmpeg_proc
        
        if ffmpeg_proc:
            return True
            
        try:
            # Improved FFmpeg command to match working audio config
            ffmpeg_command = [
                'ffmpeg', 
                '-loglevel', 'error',
                '-i', 'pipe:0',
                '-f', 'f32le',                    # 32-bit float format to match working config
                '-acodec', 'pcm_f32le',          # 32-bit float little-endian PCM
                '-ac', '1',                       # Mono channel
                '-ar', '16000',                   # 16kHz sample rate (optimal for Speechmatics)
                '-af', 'highpass=f=200,lowpass=f=8000,volume=2.0',  # Audio filtering for better clarity
                'pipe:1'
            ]
            logger.info(f"Starting ffmpeg with enhanced audio processing: {' '.join(ffmpeg_command)}")
            ffmpeg_proc = await asyncio.create_subprocess_exec(*ffmpeg_command, stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
            logger.info("ffmpeg process started with enhanced audio processing.")
            return True
        except Exception as e:
            logger.error(f"Error starting FFmpeg: {e}")
            return False

    class AudioProcessor:
        """Audio processor for Speechmatics SDK"""
        def __init__(self):
            self.wave_data = bytearray()
            self.read_offset = 0
            self.finished = False

        async def read(self, chunk_size):
            while self.read_offset + chunk_size > len(self.wave_data) and not self.finished:
                await asyncio.sleep(0.001)
            if self.read_offset >= len(self.wave_data):
                return b''
            new_offset = min(self.read_offset + chunk_size, len(self.wave_data))
            data = bytes(self.wave_data[self.read_offset:new_offset])
            self.read_offset = new_offset
            return data

        def write_audio(self, data):
            self.wave_data.extend(data)
            logger.debug(f"AudioProcessor: Added {len(data)} bytes, total buffer: {len(self.wave_data)} bytes")  # Debug log

        def finish(self):
            self.finished = True

    audio_processor = AudioProcessor()

    async def handle_configuration_message(config_data):
        """Handle configuration messages from client"""
        nonlocal user_profile_utterances, target_language, session_id
        
        try:
            user_id_from_client = config_data.get("user_id")
            selected_profile_id_from_client = config_data.get("profile_id")
            is_multilingual_from_client = config_data.get("is_multilingual", False)
            target_language_from_client = config_data.get("target_language", None)
            session_id_from_client = config_data.get("session_id", None)  # Support resuming draft sessions
            
            # Update session_id if provided by client (for resuming drafts)
            if session_id_from_client:
                session_id = session_id_from_client
                logger.info(f"Using session_id from client for draft resumption: {session_id}")
            
            # Update target language from client
            target_language = target_language_from_client or "multi"
            logger.info(f"Speechmatics multilingual mode activated with target language: {target_language}")

            if authenticated_user_id and selected_profile_id_from_client:
                logger.info(f"Updating settings for authenticated user: {authenticated_user_id}, profile: {selected_profile_id_from_client}")
                try:
                    user_settings = await get_user_settings_func(authenticated_user_id, current_user_id=authenticated_user_id)
                    if user_settings and user_settings.transcriptionProfiles:
                        selected_profile = next((p for p in user_settings.transcriptionProfiles if p.id == selected_profile_id_from_client), None)
                        if selected_profile:
                            logger.info(f"Found profile '{selected_profile.name}'. Using Speechmatics for multilingual support.")
                            user_profile_utterances = selected_profile.utterances
                            logger.info(f"Updated settings: utterances={user_profile_utterances}, target_language={target_language}")
                        else:
                            logger.warning(f"Profile ID {selected_profile_id_from_client} not found.")
                    else:
                        logger.warning(f"No transcription profiles for user {user_id_from_client}.")
                except Exception as e_settings:
                    logger.error(f"Error fetching/processing user settings: {e_settings}")
            else:
                logger.info("No user ID or profile ID provided. Using default Speechmatics settings.")
            
            # User settings have been updated, but Speechmatics and FFmpeg are already running

        except Exception as e:
            logger.error(f"Error in handle_configuration_message: {e}")

    async def read_ffmpeg_stdout():
        """Read audio data from FFmpeg stdout and send to Speechmatics"""
        try:
            while True:
                if ffmpeg_proc and ffmpeg_proc.stdout:
                    audio_data = await ffmpeg_proc.stdout.read(1024)
                    if not audio_data:
                        logger.info("No more audio data from FFmpeg.")
                        audio_processor.finish()
                        break
                    
                    # Send audio data to the audio processor
                    try:
                        audio_processor.write_audio(audio_data)
                        logger.debug(f"Sent {len(audio_data)} bytes to Speechmatics audio processor")
                    except Exception as e:
                        logger.error(f"Error sending audio to Speechmatics: {e}")
                else:
                    await asyncio.sleep(0.1)
        except Exception as e:
            logger.error(f"Error in read_ffmpeg_stdout: {e}")

    async def log_ffmpeg_stderr():
        """Log FFmpeg stderr output"""
        try:
            while True:
                if ffmpeg_proc and ffmpeg_proc.stderr:
                    stderr_data = await ffmpeg_proc.stderr.read(1024)
                    if not stderr_data:
                        break
                    logger.error(f"FFmpeg stderr: {stderr_data.decode('utf-8', errors='ignore')}")
                else:
                    await asyncio.sleep(0.1)
        except Exception as e:
            logger.error(f"Error in log_ffmpeg_stderr: {e}")

    async def websocket_message_handler():
        """Handle incoming WebSocket messages"""
        nonlocal session_init_sent
        try:
            while True:
                message = await websocket.receive()
                
                if message["type"] == "websocket.disconnect":
                    logger.info("WebSocket disconnected.")
                    break
                elif message["type"] == "websocket.receive":
                    if "text" in message:
                        # Handle JSON configuration messages
                        logger.info(f"Received text message: {message['text'][:100]}...")  # Debug log
                        try:
                            config_data = json.loads(message["text"])
                            logger.info(f"Parsed config data: {config_data}")  # Debug log
                            await handle_configuration_message(config_data)
                            # Send session_init after processing configuration
                            if not session_init_sent:
                                try:
                                    await websocket.send_text(json.dumps({"type": "session_init", "session_id": session_id}))
                                    logger.info(f"Sent session_init with session_id: {session_id} to client.")
                                    session_init_sent = True
                                except Exception as e:
                                    logger.error(f"Error sending session_id to client: {e}")
                        except json.JSONDecodeError as e:
                            logger.error(f"Failed to parse JSON message: {e}")
                    elif "bytes" in message:
                        # Handle binary audio data
                        audio_data = message["bytes"]
                        logger.debug(f"Received {len(audio_data)} bytes of audio data")  # Debug log
                        
                        # Send session_init if not sent yet (in case client didn't send initial_metadata)
                        if not session_init_sent:
                            try:
                                await websocket.send_text(json.dumps({"type": "session_init", "session_id": session_id}))
                                logger.info(f"Sent session_init with session_id: {session_id} to client (on first audio).")
                                session_init_sent = True
                            except Exception as e:
                                logger.error(f"Error sending session_id to client: {e}")
                        
                        if ffmpeg_proc and ffmpeg_proc.stdin:
                            try:
                                ffmpeg_proc.stdin.write(audio_data)
                                await ffmpeg_proc.stdin.drain()
                                logger.debug(f"Sent {len(audio_data)} bytes to FFmpeg")  # Debug log
                            except Exception as e:
                                logger.error(f"Error writing audio data to FFmpeg: {e}")
                        else:
                            logger.warning("FFmpeg process not available for audio data")  # Debug log
        except WebSocketDisconnect:
            logger.info("WebSocket connection closed by client.")
        except Exception as e:
            logger.error(f"Error in websocket_message_handler: {e}")
        finally:
            # Cleanup
            audio_processor.finish()
            
            if ffmpeg_proc:
                try:
                    ffmpeg_proc.stdin.close()
                    await ffmpeg_proc.wait()
                except Exception as e:
                    logger.error(f"Error closing FFmpeg: {e}")
            
            if sm_ws_client:
                try:
                    # Cleanup Speechmatics client if needed
                    logger.info("Cleaning up Speechmatics client.")
                except Exception as e:
                    logger.error(f"Error cleaning up Speechmatics client: {e}")

    # Call initialization immediately when WebSocket connects
    if not await initialize_services():
        logger.error("Failed to initialize services. Closing connection.")
        await websocket.close()
        return

    # Start the WebSocket message handler and audio processing tasks
    try:
        await asyncio.gather(
            websocket_message_handler(),
            read_ffmpeg_stdout(),
            log_ffmpeg_stderr(),
        )
    except Exception as e:
        logger.error(f"Error in main async tasks: {e}")
    finally:
        logger.info("Speechmatics WebSocket handler finished.") 