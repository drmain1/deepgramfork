# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a medical dictation/transcription application with:
- **Frontend**: React 19 + Vite, using Tailwind CSS and Material UI
- **Backend**: Python FastAPI with WebSocket support
- **Transcription**: Dual-provider system (Deepgram for medical English, Speechmatics for multilingual)
- **Storage**: AWS S3 for audio/transcripts
- **LLM Processing**: AWS Bedrock (Claude) for transcript polishing
- **Auth**: Auth0 integration

## Development Commands

### Frontend (in `my-vite-react-app/`)
```bash
npm install          # Install dependencies
npm run dev          # Start development server (port 5173)
npm run build        # Build for production
npm run lint         # Run ESLint
npm run preview      # Preview production build
```

### Backend (in `backend/`)
```bash
pip install -r requirements.txt    # Install Python dependencies
uvicorn main:app --reload         # Start backend server (port 8000)
```

## Environment Setup

Create `.env` file in project root with:
```
# AWS
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_S3_BUCKET_NAME=your_bucket
AWS_REGION=us-east-1

# Transcription APIs
deepgram_api_key=your_deepgram_key
SPEECHMATICS_API_KEY=your_speechmatics_key

# Auth0 (for frontend)
VITE_AUTH0_DOMAIN=your_domain
VITE_AUTH0_CLIENT_ID=your_client_id

# Other
DEFAULT_TENANT_ID=dev-tenant
```

## Architecture & Key Patterns

### Routing Structure
- `/` - Homepage dashboard
- `/transcription` - Main recording/transcript interface (handles all recording functionality)
- `/settings` - User settings and configuration
- `/pdf-test` - PDF generation testing

**Important**: All recording/transcript functionality is centralized in `TranscriptionPage`. When navigating to view recordings, always use `/transcription`.

### State Management
- **RecordingsContext**: Manages recordings list and selected recording state
- **TemplateContext**: Manages LLM instruction templates
- **UserSettingsContext**: User preferences and transcription profiles

### WebSocket Endpoints
- `/stream` - Deepgram transcription (medical English)
- `/stream/multilingual` - Speechmatics transcription (Spanish/English code-switching)

### Key Frontend Components
- `TranscriptionPage.jsx` - Main orchestrator for recording workflow
- `RecordingView.jsx` - Handles WebSocket audio streaming
- `TranscriptViewer.jsx` - Displays and edits transcripts
- `SetupView.jsx` - Patient details and recording configuration

### Backend Structure
- `main.py` - FastAPI app and endpoints
- `deepgram_utils.py` - Deepgram WebSocket handler
- `speechmatics_utils.py` - Speechmatics WebSocket handler
- `aws_utils.py` - S3 and Bedrock utilities
- `core_models.py` - Pydantic models for data validation

### API Patterns
- RESTful endpoints under `/api/v1/`
- WebSocket endpoints for real-time transcription
- Bearer token authentication via Auth0
- Consistent error handling with HTTPException

### Frontend-Backend Communication
1. Frontend proxies `/api` requests to `http://localhost:8000` (configured in vite.config.js)
2. WebSocket connections use session IDs for tracking
3. S3 paths are returned for audio/transcript storage

## Code Style & Conventions

### React Components
- Functional components with hooks
- Props destructuring in component parameters
- useEffect for side effects and data fetching
- Error boundaries for graceful error handling

### Python Backend
- Async/await patterns throughout
- Type hints using typing module
- Pydantic models for request/response validation
- Comprehensive error logging

### State Updates
- Preserve user preferences (profile, location) between sessions
- Reset patient-specific data for new recordings
- Handle async state updates with proper loading states

## Common Development Tasks

### Adding a New LLM Template
1. Update template configuration in `templates/templateConfig.js`
2. Add instruction generator in `templates/llm-instructions/`
3. Update `TemplateContext` if needed

### Modifying Transcription Settings
1. Update `TranscriptionProfileItem` in `core_models.py`
2. Modify Deepgram options in `deepgram_utils.py`
3. Update UI in `TranscriptionProfilesTab.jsx`

### Testing WebSocket Connections
- Use browser DevTools to monitor WebSocket frames
- Check backend logs for connection status
- Verify audio format compatibility (16kHz, 16-bit PCM)

## Debugging Tips

1. **Recording State Issues**: Check `RecordingsContext` state and localStorage sync
2. **Transcription Failures**: Verify API keys and WebSocket connection status
3. **S3 Upload Issues**: Check AWS credentials and bucket permissions
4. **LLM Processing**: Monitor Bedrock API responses in backend logs

## Performance Considerations

- Recordings list can grow large - implement pagination if needed
- WebSocket connections have timeout handling
- S3 operations are async to avoid blocking
- Frontend uses React.memo for expensive components