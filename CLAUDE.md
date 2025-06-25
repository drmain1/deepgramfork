# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

### Testing & Utilities
```bash
cd backend
python test_firestore_connection.py  # Test Firestore connection
python test_gcs_operations.py        # Test Google Cloud Storage
python test_firebase_token.py        # Test Firebase authentication
python test_gcs_health.py           # Test GCS health
```

### Deployment
```bash
./deploy.sh                # Deploy to GCP (App Engine + Cloud Storage)
firebase deploy           # Deploy Firebase (Firestore rules, hosting)
firebase deploy --only firestore  # Deploy only Firestore rules
```

## Architecture Overview

### Backend Architecture
- **Framework**: FastAPI with WebSocket support
- **Main Entry**: `backend/main.py`
- **Authentication**: Firebase Admin SDK via `gcp_auth_middleware.py`
- **Storage**: Hybrid approach
  - Firestore for metadata and transcripts
  - Google Cloud Storage for audio files only
- **Speech Processing**: 
  - `deepgram_utils.py` - Medical transcription
  - `speechmatics_utils.py` - Multilingual support
- **AI Processing**: `gcp_utils.py` - Vertex AI integration
- **Session Management**: `FirestoreSessionManager` with 25-minute timeout

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
- **State Management**: Zustand (recently migrated from Context API)
  - `recordingsStore.js` - Recording management
  - `userSettingsStore.js` - User preferences
  - No PHI stored in browser storage (HIPAA compliance)
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
- Secret Manager for sensitive keys

**Frontend (.env)**:
- Firebase configuration
- API base URL
- Feature flags

**Production Runtime**:
- Python 3.10 on App Engine
- Instance class: F4
- Auto-scaling: 1-10 instances
- Gunicorn with 4 workers and Uvicorn

## Development Guidelines

1. **API Changes**: Update both WebSocket and REST endpoints in main.py
2. **State Management**: Use Zustand stores (no localStorage for PHI)
3. **Authentication**: All API calls must include Firebase auth token
4. **Storage**: Use Firestore for transcripts/metadata, GCS for audio only
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
- Timestamp display issues (see `TIMESTAMP_TECH_DEBT.md`)
- Complex state synchronization between local and backend


## Useful Resources

- Frontend runs on http://localhost:5173
- Backend API on http://localhost:8000
- Frontend proxies `/api` requests to backend
- WebSocket connections require authentication token


