# Speechmatics Integration Documentation

## Overview
This document covers the complete Speechmatics integration for multilingual transcription support in the dictation app. The integration provides Spanish/English code-switching capabilities alongside the existing Deepgram medical transcription.

## Architecture

### Dual-Provider System
The application uses a dual-provider architecture:

- **Deepgram** (`/stream`) - Monolingual English medical transcription
- **Speechmatics** (`/stream/multilingual`) - Multilingual Spanish/English transcription with translation

### WebSocket Endpoints

#### `/stream` - Deepgram (Default)
- **Purpose:** Medical English transcription
- **Model:** nova-3-medical
- **Use Case:** Standard medical encounters in English
- **Features:** Medical terminology optimization, smart formatting

#### `/stream/multilingual` - Speechmatics
- **Purpose:** Multilingual transcription with translation
- **Languages:** English (primary) + Spanish translation
- **Use Case:** Multilingual patient encounters
- **Features:** Code-switching, real-time translation, enhanced accuracy

## Implementation Details

### Backend Files

#### `backend/speechmatics_utils.py`
Main implementation file containing:
- WebSocket handler: `handle_speechmatics_websocket()`
- Audio processing pipeline with FFmpeg
- Speechmatics SDK integration
- Event handlers for transcription and translation

#### Key Components
```python
# Main WebSocket handler
async def handle_speechmatics_websocket(websocket: WebSocket, get_user_settings_func: callable)

# Audio processor for Speechmatics SDK
class AudioProcessor:
    def __init__(self)
    async def read(self, chunk_size)
    def write_audio(self, data)
    def finish(self)

# Service initialization
async def initialize_services()
async def start_speechmatics_connection()
async def start_ffmpeg()
```

### Frontend Integration

#### WebSocket Endpoint Routing
```javascript
// In RecordingView.jsx
const wsEndpoint = isMultilingual 
  ? 'ws://localhost:8000/stream/multilingual'  // Speechmatics
  : 'ws://localhost:8000/stream';              // Deepgram
```

#### Message Handling
```javascript
// Transcript messages (both providers)
{
  "type": "transcript",
  "text": "transcribed text",
  "is_final": true,
  "session_id": "session_id",
  "source": "speechmatics" | "deepgram"
}

// Translation messages (Speechmatics only)
{
  "type": "translation", 
  "text": "translated text",
  "language": "es",
  "is_final": true,
  "session_id": "session_id",
  "source": "speechmatics"
}
```

## Configuration

### Environment Variables
```bash
# Required in .env file
SPEECHMATICS_API_KEY=your_speechmatics_api_key

# Existing variables
DEEPGRAM_API_KEY=your_deepgram_key
```

### Dependencies
```bash
# Add to backend/requirements.txt
speechmatics-python==4.0.0
```

### Installation
```bash
cd backend
source .venv/bin/activate
pip install speechmatics-python
```

## Audio Pipeline

### FFmpeg Configuration
```bash
ffmpeg -loglevel error -i pipe:0 \
  -f f32le \
  -acodec pcm_f32le \
  -ac 1 \
  -ar 16000 \
  -af "highpass=f=200,lowpass=f=8000,volume=2.0" \
  pipe:1
```

**Audio Format Changes:**
- Changed from `pcm_s16le` to `pcm_f32le` (32-bit float)
- Updated format from `s16le` to `f32le`
- **Audio Filters:** (unchanged)
- `highpass=f=200` - Remove low-frequency noise
- `lowpass=f=8000` - Remove high-frequency noise  
- `volume=2.0` - Increase audio gain for clarity

### Speechmatics Audio Settings
```python
audio_settings = AudioSettings(
    encoding="pcm_f32le",  # 32-bit float format for better accuracy
    sample_rate=16000,
    chunk_size=1600  # 100ms chunks at 16kHz
)
```

### Transcription Configuration
```python
transcription_config = TranscriptionConfig(
    language="es",                    # Spanish as primary language
    enable_partials=True,             # Real-time partial results
    max_delay=1,                      # 1 second max delay
    max_delay_mode="flexible",        # Flexible delay mode for better accuracy
    operating_point="enhanced",       # Highest accuracy
    diarization="none",               # No speaker separation for better accuracy
    domain="bilingual-en",            # Bilingual English domain
    enable_entities=True              # Entity recognition
)

# Translation feature disabled for better accuracy
# translation_config = TranslationConfig(
#     target_languages=["es"]           # Spanish translation (disabled)
# )
```

## Data Flow

### Connection Sequence
1. **WebSocket Connect** → Speechmatics client initialization
2. **FFmpeg Start** → Audio pipeline ready
3. **Session Init** → Frontend receives session ID
4. **Configuration Message** → User settings applied
5. **Audio Streaming** → Real-time transcription begins

### Audio Processing Pipeline
```
Browser Audio (WebM) 
  ↓
WebSocket Binary Messages
  ↓  
FFmpeg (Audio Processing)
  ↓
AudioProcessor (Buffer Management)
  ↓
Speechmatics SDK
  ↓
Event Handlers (Transcript/Translation)
  ↓
WebSocket JSON Messages
  ↓
Frontend Display
```

## Testing

### Test Scenarios

#### 1. Monolingual Mode (Deepgram)
- Uncheck "Enable Multilingual Support"
- Start recording
- **Expected:** Connection to `/stream`, medical terminology optimization

#### 2. Multilingual Mode (Speechmatics)  
- Check "Enable Multilingual Support"
- Start recording
- **Expected:** Connection to `/stream/multilingual`, Spanish/English support

#### 3. Code-Switching Test
- Enable multilingual mode
- Speak mixed English/Spanish
- **Expected:** Both transcripts and Spanish translations

### Log Monitoring

#### Success Indicators
```
INFO: Speechmatics WebSocket connection accepted
INFO: Sent session_init with session_id: [ID]
INFO: Speechmatics client initialized successfully
INFO: FFmpeg process initialized successfully
INFO: Starting Speechmatics transcription task immediately
DEBUG: Received [X] bytes of audio data
DEBUG: Sent [X] bytes to FFmpeg
DEBUG: AudioProcessor: Added [X] bytes
DEBUG: Speechmatics: Partial transcript sent
DEBUG: Speechmatics: Final transcript sent
```

#### Error Indicators
```
ERROR: Failed to initialize services
WARNING: FFmpeg process not available for audio data
RuntimeWarning: coroutine never awaited
AttributeError: 'dict' object has no attribute 'asdict'
```

## Performance Optimizations

### Audio Quality Improvements
1. **Enhanced FFmpeg filtering** for noise reduction
2. **Optimal chunk sizing** (100ms at 16kHz)
3. **Reduced latency** with max_delay=1.0
4. **Volume normalization** for consistent levels

### Accuracy Enhancements
1. **Enhanced operating point** for highest accuracy
2. **Entity recognition** enabled for context
3. **Speaker diarization** for multi-speaker scenarios
4. **Punctuation optimization** for readability

### Real-time Performance
1. **Immediate service initialization** on connection
2. **Parallel audio processing** with asyncio
3. **Efficient buffer management** in AudioProcessor
4. **Non-blocking event handlers** with create_task()

## Troubleshooting

### Common Issues

#### 1. "speechmatics module not found"
```bash
# Solution
cd backend
source .venv/bin/activate
pip install speechmatics-python
```

#### 2. "FFmpeg process not available"
- **Cause:** Audio data arriving before FFmpeg initialization
- **Solution:** Services now initialize immediately on connection

#### 3. "RuntimeWarning: coroutine never awaited"
- **Cause:** Async event handlers called synchronously
- **Solution:** Event handlers converted to sync with asyncio.create_task()

#### 4. "'dict' object has no attribute 'asdict'"
- **Cause:** TranslationConfig expects object, not dictionary
- **Solution:** Use proper TranslationConfig object

#### 5. Poor transcription accuracy
- **Check:** Audio levels and background noise
- **Verify:** Enhanced operating point enabled
- **Optimize:** FFmpeg audio filters active

### Debug Logging

#### Enable Debug Mode
```python
# In speechmatics_utils.py
logging.basicConfig(level=logging.DEBUG)
```

#### Key Debug Points
- WebSocket message flow
- Audio data volume
- FFmpeg processing status
- Speechmatics event firing
- Buffer management

## API Reference

### Speechmatics SDK Classes
```python
from speechmatics.models import (
    ConnectionSettings,
    TranscriptionConfig, 
    AudioSettings,
    TranslationConfig,
    ServerMessageType
)
from speechmatics.client import WebsocketClient
```

### Event Types
- `ServerMessageType.AddPartialTranscript` - Interim results
- `ServerMessageType.AddTranscript` - Final transcripts
- `ServerMessageType.AddTranslation` - Translations
- `ServerMessageType.AddPartialTranslation` - Interim translations
- `ServerMessageType.RecognitionStarted` - Session started
- `ServerMessageType.Error` - Error messages
- `ServerMessageType.Warning` - Warning messages

## Known Limitations

### Current Scope
- **Languages:** English (primary) + Spanish (translation)
- **Audio Format:** 16-bit PCM, 16kHz, mono
- **Real-time Only:** No batch processing support
- **Translation Direction:** English → Spanish only

### Potential Improvements
- Additional target languages (French, German, etc.)
- Bidirectional translation
- Custom vocabulary support
- Advanced speaker identification
- Confidence scoring display

## Version History

### v1.0 (Current)
- ✅ Basic Speechmatics integration
- ✅ Spanish translation support
- ✅ Real-time transcription
- ✅ Enhanced audio processing
- ✅ Dual-provider architecture

### Future Roadmap
- Multi-language support expansion
- Advanced audio preprocessing
- Custom model training
- Quality metrics dashboard
- Performance analytics

## Support

### Documentation Links
- [Speechmatics API Docs](https://docs.speechmatics.com/)
- [Speechmatics Python SDK](https://github.com/speechmatics/speechmatics-python)
- [FFmpeg Audio Filters](https://ffmpeg.org/ffmpeg-filters.html)

### Configuration Files
- `backend/speechmatics_utils.py` - Main implementation
- `my-vite-react-app/src/components/RecordingView.jsx` - Frontend routing
- `backend/requirements.txt` - Dependencies
- `.env` - API keys and configuration

---

*Last Updated: May 28, 2025*
*Integration Status: ✅ Complete and Functional* 