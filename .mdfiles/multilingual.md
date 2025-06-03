# Multilingual Support Implementation

## Overview
This document outlines the implementation of multilingual support in the dictation app, allowing users to transcribe audio in multiple languages automatically. **Updated to include Speechmatics integration for advanced multilingual support.**

## Current Architecture (Updated)

### Dual-Provider System
The application now supports two transcription providers:

1. **Deepgram** (`/stream` endpoint) - For monolingual English medical transcription
2. **Speechmatics** (`/stream/multilingual` endpoint) - For multilingual Spanish/English code-switching

### Implementation Status

#### ✅ Completed Backend Implementation

1. **New Dependencies**
   - Added `speechmatics-python` to `backend/requirements.txt`
   - Speechmatics SDK for real-time WebSocket transcription

2. **New Files Created**
   - `backend/speechmatics_utils.py` - Complete Speechmatics WebSocket handler
   - Implements Spanish/English translation and code-switching
   - Uses proper Speechmatics SDK patterns with AudioProcessor class

3. **Updated Files**
   - `backend/main.py` - Added `/stream/multilingual` endpoint
   - Removed unused routing functions for cleaner architecture
   - Maintains existing `/stream` endpoint for Deepgram medical transcription

#### ⚠️ Current Status
- Backend implementation is **largely complete** but needs testing
- Frontend needs to be updated to use different WebSocket endpoints based on multilingual setting
- Environment setup may need verification (virtual environment activation issues)

## Backend Architecture Details

### WebSocket Endpoints

#### `/stream` (Deepgram - Monolingual)
```python
@app.websocket("/stream")
async def websocket_stream_endpoint(websocket: WebSocket):
    """
    Handles Deepgram transcription for monolingual medical transcription.
    Uses nova-3-medical model for optimal medical terminology.
    """
    await handle_deepgram_websocket(websocket, get_user_settings)
```

#### `/stream/multilingual` (Speechmatics - Multilingual)
```python
@app.websocket("/stream/multilingual")
async def websocket_multilingual_stream_endpoint(websocket: WebSocket):
    """
    Handles Speechmatics transcription for Spanish/English code-switching
    and translation capabilities.
    """
    await handle_speechmatics_websocket(websocket, get_user_settings)
```

### Speechmatics Implementation (`speechmatics_utils.py`)

#### Key Features
- **Real-time transcription** with English primary language
- **Spanish translation** with enable_partials=True
- **Enhanced operating point** for better accuracy
- **FFmpeg integration** for audio processing (pcm_s16le, 16000Hz)
- **Event-driven architecture** with proper SDK event handlers

#### Core Components

```python
# Connection Settings
connection_settings = ConnectionSettings(
    url="wss://eu2.rt.speechmatics.com/v2",
    auth_token=SPEECHMATICS_API_KEY,
)

# Audio Settings
audio_settings = AudioSettings(
    encoding="pcm_s16le",
    sample_rate=16000,
    chunk_size=1024
)

# Transcription Config
transcription_config = TranscriptionConfig(
    language="en",  # Primary language
    enable_partials=True,
    max_delay=2.0,
    operating_point="enhanced",
    translation_config={
        "target_languages": ["es"],  # Spanish translation
        "enable_partials": True
    }
)
```

#### AudioProcessor Class
```python
class AudioProcessor:
    """Audio processor for Speechmatics SDK"""
    def __init__(self):
        self.wave_data = bytearray()
        self.read_offset = 0
        self.finished = False

    async def read(self, chunk_size):
        # Async audio reading for SDK
        
    def write_audio(self, data):
        # Audio data buffering
        
    def finish(self):
        # Signal end of audio stream
```

#### Event Handlers
- `on_partial_transcript` - Real-time partial transcriptions
- `on_final_transcript` - Final transcription results
- `on_translation` - Spanish translations
- `on_recognition_started` - Session initialization
- `on_error` / `on_warning` - Error handling

### Environment Variables Required

```bash
# Existing
DEEPGRAM_API_KEY=your_deepgram_key

# New for Speechmatics
SPEECHMATICS_API_KEY=your_speechmatics_key
```

## Frontend Integration Requirements

### ⚠️ TODO: Frontend Updates Needed

The frontend needs to be updated to route to different WebSocket endpoints:

```javascript
// In RecordingView.jsx or similar WebSocket connection logic
const getWebSocketUrl = (isMultilingual) => {
  const baseUrl = 'ws://localhost:8000';
  return isMultilingual 
    ? `${baseUrl}/stream/multilingual`  // Speechmatics
    : `${baseUrl}/stream`;              // Deepgram
};

// Connect to appropriate endpoint
const wsUrl = getWebSocketUrl(isMultilingual);
const ws = new WebSocket(wsUrl);
```

### Message Format Consistency

Both providers send similar message formats:

```json
{
  "type": "transcript",
  "text": "transcribed text",
  "is_final": true,
  "session_id": "session_id",
  "source": "speechmatics" | "deepgram"
}

// Speechmatics also sends translation messages
{
  "type": "translation", 
  "text": "translated text",
  "language": "es",
  "is_final": true,
  "session_id": "session_id",
  "source": "speechmatics"
}
```

## Chat Summary - Speechmatics Implementation

### Problem Addressed
- Need for advanced multilingual support with Spanish/English code-switching
- Current Deepgram implementation limited for true multilingual scenarios
- Requirement to maintain existing medical transcription quality

### Solution Implemented
- **Dual-provider architecture** with separate endpoints
- **Speechmatics integration** for multilingual scenarios
- **Deepgram retention** for medical English transcription
- **Clean separation** of concerns between providers

### Technical Decisions Made

1. **Separate Endpoints**: Instead of complex routing, used distinct WebSocket endpoints
2. **SDK Compliance**: Used official Speechmatics Python SDK patterns
3. **Audio Processing**: Maintained FFmpeg pipeline for consistent audio format
4. **Error Handling**: Comprehensive logging and error recovery
5. **Session Management**: Consistent session ID and state management

### Files Modified/Created

#### New Files
- `backend/speechmatics_utils.py` (17KB) - Complete Speechmatics handler

#### Modified Files  
- `backend/requirements.txt` - Added speechmatics-python dependency
- `backend/main.py` - Added multilingual endpoint, removed unused routing functions

#### Unchanged Files
- `backend/deepgram_utils.py` - Maintains existing Deepgram functionality
- All frontend files - Ready for endpoint routing updates

## Next Steps for New Chat

### Immediate Priority
1. **Test Backend Setup**
   - Verify virtual environment activation
   - Install dependencies: `pip install speechmatics-python`
   - Test both endpoints: `/stream` and `/stream/multilingual`

2. **Frontend Routing Update**
   - Modify WebSocket connection logic to use appropriate endpoint
   - Test multilingual checkbox functionality
   - Verify message handling for both transcript and translation types

3. **Environment Configuration**
   - Add SPEECHMATICS_API_KEY to .env file
   - Verify API key validity and permissions

### Testing Scenarios
1. **Monolingual English** → `/stream` (Deepgram) → Medical terminology
2. **Spanish/English Mix** → `/stream/multilingual` (Speechmatics) → Code-switching + translation
3. **Error Handling** → Both endpoints → Graceful degradation

### Known Issues to Address
- Backend startup errors (likely environment/dependency related)
- Virtual environment activation path issues
- Potential import/dependency conflicts

## Technical Architecture Summary

```
Frontend (Multilingual Checkbox)
    ↓
WebSocket Endpoint Routing
    ├─ isMultilingual=false → ws://localhost:8000/stream (Deepgram)
    └─ isMultilingual=true  → ws://localhost:8000/stream/multilingual (Speechmatics)
    ↓
Provider-Specific Processing
    ├─ Deepgram: nova-3-medical, English medical transcription
    └─ Speechmatics: enhanced model, English + Spanish translation
    ↓
Unified Message Format
    └─ Consistent transcript/translation messages to frontend
```

This architecture provides flexibility to use the best provider for each use case while maintaining a consistent frontend interface.

## Data Flow

```
SetupView (checkbox) 
  ↓ isMultilingual
TranscriptionPage (state management)
  ↓ isMultilingual + targetLanguage
RecordingView (WebSocket message)
  ↓ is_multilingual: boolean + target_language: string
Backend deepgram_utils.py (configuration)
  ↓ Nova-2/Nova-3 models with appropriate language settings
Deepgram API (transcription)
```

## Frontend Components

### SetupView.jsx
```jsx
<input
  type="checkbox"
  checked={isMultilingual}
  onChange={(e) => setIsMultilingual(e.target.checked)}
/>

{isMultilingual && (
  <select
    value={targetLanguage || ''}
    onChange={(e) => setTargetLanguage(e.target.value)}
  >
    <option value="">Auto-detect (Code-switching)</option>
    <option value="es">Spanish</option>
    <option value="fr">French</option>
    <!-- Additional language options -->
  </select>
)}
```

### TranscriptionPage.jsx
```jsx
const [isMultilingual, setIsMultilingual] = useState(false);
const [targetLanguage, setTargetLanguage] = useState('');

// Pass to both setup and recording views
<SetupView
  isMultilingual={isMultilingual}
  setIsMultilingual={setIsMultilingual}
  targetLanguage={targetLanguage}
  setTargetLanguage={setTargetLanguage}
  // ... other props
/>

<RecordingView
  isMultilingual={isMultilingual}
  targetLanguage={targetLanguage}
  // ... other props
/>
```

### RecordingView.jsx
```jsx
const initialMetadata = {
  user_id: user.sub,
  session_id: sessionId,
  profile_id: selectedProfileId,
  is_multilingual: isMultilingual,
  target_language: targetLanguage
};
```

## Backend Implementation

### deepgram_utils.py
```python
multilingual_enabled = False
target_language = None

async def handle_configuration_message(config_data):
    global multilingual_enabled, target_language
    
    # Extract multilingual settings
    multilingual_enabled = config_data.get('is_multilingual', False)
    target_language = config_data.get('target_language', None)
    
    # Configure model and language based on multilingual setting
    if multilingual_enabled:
        if target_language == "es" or target_language == "spanish":
            # For pure Spanish content
            model_name = "nova-2-general"
            language_setting = "es"
        elif target_language and target_language != "multi":
            # For other specific languages
            model_name = "nova-2-general"
            language_setting = target_language
        else:
            # For general multilingual/code-switching
            model_name = "nova-3-general"
            language_setting = "multi"
    else:
        model_name = "nova-3-medical"
        language_setting = "en-US"
    
    options_dict = {
        "model": model_name,
        "language": language_setting,
        # ... other options
    }
    
    live_options = LiveOptions(**options_dict)
```

## Deepgram Model Strategy

### Multilingual Mode Enabled
- **Pure Spanish Content**: Uses `nova-2-general` with `language="es"`
- **Other Specific Languages**: Uses `nova-2-general` with target language code
- **Code-switching/Auto-detect**: Uses `nova-3-general` with `language="multi"`

### Monolingual Mode (Default)
- Uses `nova-3-medical` with `language="en-US"`

## Language Support

### Supported Languages
Based on Deepgram's multilingual models:
- Spanish (es)
- French (fr) 
- German (de)
- Hindi (hi)
- Russian (ru)
- Portuguese (pt)
- Japanese (ja)
- Italian (it)
- Dutch (nl)
- Chinese (zh)
- Korean (ko)
- Turkish (tr)
- Swedish (sv)
- Ukrainian (uk)
- Indonesian (id)

### Auto-detect Mode
When no target language is selected:
- Uses Nova-3 model with `language="multi"`
- Automatically handles code-switching between languages
- Supports multilingual conversations

## Implementation Details

### Deepgram SDK Compatibility
- ✅ Uses standard `LiveOptions` parameters
- ✅ No custom or invalid parameters like `detect_language`
- ✅ Compatible with current Deepgram Python SDK

### Model Selection Logic
1. **Medical English**: `nova-3-medical` for optimal medical terminology
2. **Pure Foreign Language**: `nova-2-general` for single-language content
3. **Multilingual**: `nova-3-general` for code-switching scenarios

### Error Handling
- Graceful fallback to English if unsupported language requested
- Logging of language selection decisions
- Client notification of active language settings

## Testing Recommendations

### Multilingual Scenarios
1. **Pure Single-Language Content**
   - Test with Spanish-only audio
   - Test with French-only audio
   - Verify appropriate model selection

2. **Code-switching Content**
   - Test English-Spanish conversations
   - Test rapid language switching
   - Verify multi-language detection

3. **Fallback Scenarios**
   - Test with unsupported languages
   - Test error handling
   - Verify graceful degradation

## Next Steps

1. **Enhanced Language Detection**
   - Add language confidence reporting
   - Implement detected language feedback to UI
   - Add language detection statistics

2. **User Experience Improvements**
   - Add language detection indicators
   - Implement real-time language switching feedback
   - Add multilingual transcription quality metrics

3. **Additional Features**
   - Support for more languages as Deepgram adds them
   - Custom vocabulary for multilingual content
   - Language-specific formatting rules

## Files Modified
- `my-vite-react-app/src/components/SetupView.jsx`
- `my-vite-react-app/src/pages/TranscriptionPage.jsx`
- `my-vite-react-app/src/components/RecordingView.jsx`
- `backend/deepgram_utils.py`
- `multilingual.md` (this file)

