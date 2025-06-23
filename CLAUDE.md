# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
-this project has been built and changed over and over again, CRITICAL if you run in to files that would significantly benefit from a refactor, or if you run in to components that are depricated please alert the human so we can clean this project up
-Also please advise if agents or MCP tools may help what we are working on
-this project is 100% going to be run on GCP so let's just delete AWS functions/code as we run accross it
-also as we work if you run in to code that could be slowling the project down let's fix it, we want to be live within a week
-when you run in to scenarios that we can avoid local storage in the browser we should do that to improve security for hipaa compliance 

## Project Overview

This is a HIPAA-compliant medical transcription application that converts audio recordings into structured medical notes. The system uses speech-to-text services (Deepgram for medical, Speechmatics for multilingual) and LLM-based formatting (Google Vertex AI) to produce professional medical documentation.



**Current Status**: Active migration from AWS to Google Cloud Platform (branch: `gcp-migration`)

## Development Commands

### Frontend Development (React/Vite)
```bash
cd my-vite-react-app
npm install          # Install dependencies
npm run dev          # Start dev server (http://localhost:5173)
npm run build        # Build for production
npm run lint         # Run ESLint
npm run preview      # Preview production build
```

### Backend Development (Python/FastAPI)
```bash
cd backend
pip install -r requirements.txt  # Install dependencies
python main.py                   # Start API server (http://localhost:8000)
```

## Architecture Overview

### Backend Architecture
- **Framework**: FastAPI with WebSocket support
- **Main Entry**: `backend/main.py`
- **Authentication**: Firebase Admin SDK via `gcp_auth_middleware.py`
- **Storage**: Google Cloud Storage via `gcs_utils.py`
- **Speech Processing**: 
  - `deepgram_utils.py` - Medical transcription
  - `speechmatics_utils.py` - Multilingual support
- **AI Processing**: `gcp_utils.py` - Vertex AI integration

**Key WebSocket Endpoints**:
- `/stream` - Deepgram medical transcription
- `/stream/multilingual` - Speechmatics multilingual transcription

**Data Organization in GCS**:
```
{user_id}/
├── transcripts/original/    # Raw transcripts
├── transcripts/polished/    # AI-processed transcripts
├── metadata/               # Session metadata
├── settings/               # User preferences
└── drafts/                 # Draft recordings
```

### Frontend Architecture
- **Framework**: React 19 with Vite
- **Routing**: React Router v7
- **State Management**: React Context API
  - `FirebaseAuthContext` - Authentication
  - `RecordingsContext` - Recording management
  - `UserSettingsContext` - User preferences
- **Key Components**:
  - `RecordingView.jsx` - Live recording/transcription
  - `TranscriptionPage.jsx` - Main workflow
  - `SettingsPage.jsx` - User configuration

**WebSocket Connection**:
```javascript
// Deepgram: ws://localhost:8000/stream?token={token}
// Speechmatics: ws://localhost:8000/stream/multilingual?token={token}
```

## Key Features & Workflows

1. **Recording Flow**:
   - SetupView → RecordingView → Save/Draft → TranscriptViewer
   - Real-time transcription via WebSocket
   - Draft auto-save functionality
   - Post-processing with AI polish

2. **Authentication Flow**:
   - Firebase Auth for user management
   - Bearer token for API authentication
   - WebSocket auth via query parameter

3. **Multilingual Support**:
   - English (Deepgram) for medical accuracy
   - Spanish/English code-switching (Speechmatics)
   - Configurable per transcription profile

## Security & Compliance

- HIPAA-compliant infrastructure
- Security headers middleware
- User data isolation (users can only access their own data)
- Audit logging for all access
- Session timeout management
- Encrypted storage with Google Cloud CMEK

## Environment Setup

Both frontend and backend require environment variables:

**Backend (.env)**:
- GCP credentials and project ID
- API keys (Deepgram, Speechmatics)
- Firebase service account
- GCS bucket names

**Frontend (.env)**:
- Firebase configuration
- API base URL
- Feature flags

## Development Guidelines

1. **API Changes**: Update both WebSocket and REST endpoints in main.py
2. **State Management**: Use existing Context providers for global state
3. **Authentication**: All API calls must include Firebase auth token
4. **Storage**: Use structured paths in GCS (see data organization above)
5. **Error Handling**: Implement proper error boundaries and WebSocket reconnection
6. **Testing**: No automated tests currently - manual testing required

## Common Tasks

### Adding a New API Endpoint
1. Add route to `backend/main.py`
2. Add authentication via `Depends(get_current_user)`
3. Update frontend API calls with proper auth headers

### Modifying Transcription Settings
1. Update `TranscriptionProfileItem` model in backend
2. Update `SettingsPage.jsx` UI components
3. Ensure settings are passed through WebSocket connection

### Working with Recordings
1. Recordings stored in GCS under user-specific paths
2. Metadata includes timestamps, duration, patient info
3. Both original and polished transcripts are preserved

## Tech Debt & TODOs

See `HIPAA_COMPLIANCE_TECH_DEBT.md` for compliance-related items:
- Comprehensive audit logging (partial)
- Role-Based Access Control (RBAC)
- Automated data retention policies
- MFA enforcement


## Useful Resources

- Frontend runs on http://localhost:5173
- Backend API on http://localhost:8000
- Frontend proxies `/api` requests to backend
- WebSocket connections require authentication token


