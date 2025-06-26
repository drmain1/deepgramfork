# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a HIPAA-compliant medical transcription application that converts audio recordings into structured medical notes. The system uses speech-to-text services (Deepgram for medical, Speechmatics for multilingual) and LLM-based formatting (Google Vertex AI) to produce professional medical documentation.

**Current Status**: Active migration from AWS to Google Cloud Platform (branch: `gcp-migration`)

### Core Dependencies

**Backend (Python 3.10)**:
- FastAPI - Web framework with WebSocket support
- Uvicorn/Gunicorn - ASGI server
- Firebase Admin SDK - Authentication and Firestore
- Google Cloud SDK - Storage, Vertex AI, Secret Manager
- Deepgram SDK - Medical transcription
- Speechmatics - Multilingual transcription
- python-jose - JWT token handling
- python-multipart - File upload support
- websockets - WebSocket client/server

**Frontend (React 19)**:
- Vite - Build tool and dev server
- React Router v7 - Client-side routing
- Zustand - State management
- Firebase SDK - Authentication
- Material-UI (MUI) - UI components
- date-fns - Date manipulation
- react-audio-voice-recorder - Audio recording

**Infrastructure**:
- Google Cloud Platform (App Engine, Cloud Storage, Firestore, Vertex AI)
- Firebase (Authentication, Firestore Database)
- Cloudflare (CDN, DNS)
- Google Secret Manager (API keys)

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
   - **Dictation Mode**: Advanced feature for recording notes for past patient visits
     - **How it works**:
       - Only available when selecting an existing patient from the patient selector
       - Doctor enables "Dictation Mode" checkbox in the setup view
       - Must specify the "Date of Service" (the actual date when the patient was seen)
       - Recording happens in real-time but is tagged with the historical service date
     - **Technical Implementation**:
       - Session ID format: `YYYYMMDD` (service date) + `HHMMSS` (current time) + random suffix
       - Frontend sends `date_of_service` field in WebSocket metadata and save request
       - Backend uses the service date for `created_at` timestamp to maintain chronological order
       - Transcripts are marked with `is_dictation: true` flag in Firestore
       - Special handling in `get_recent_transcripts` to include dictation transcripts based on `updated_at` rather than `created_at`
       - Files involved:
         - `SetupView.jsx` (lines 363-407): UI for enabling dictation mode
         - `RecordingView.jsx`: Passes `date_of_service` to WebSocket and save endpoint
         - `deepgram_utils.py` (lines 172-190): Generates special session ID format
         - `speechmatics_utils.py`: Similar session ID generation
         - `firestore_endpoints.py` (lines 270-299): Handles date parsing for dictation mode
         - `firestore_client.py` (lines 267-294): Special query logic for dictation transcripts
     - **UI Behavior**:
       - Blue-highlighted section appears below patient selection when enabled
       - Date picker prevents future dates
       - Form validation requires date selection before proceeding
       - Session header shows "[Dictation Mode - Service Date: MM/DD/YYYY]" during recording
       - Transcripts appear in the sidebar with the historical date
     - **Data Flow**:
       1. User selects existing patient → dictation mode checkbox appears
       2. User enables dictation mode → date picker becomes visible and required
       3. User selects past date → stored in component state
       4. Start recording → WebSocket sends `date_of_service` in initial metadata
       5. Session ID generated with format: `YYYYMMDD` (service date) + `HHMMSS` (current time)
       6. Save transcript → `date_of_service` included in POST request
       7. Backend sets `created_at` to service date, `updated_at` to current time
       8. Transcript marked with `is_dictation: true` in Firestore
       9. Recording list queries include both recent and dictation transcripts
     - **Use Cases**:
       - Recording notes after seeing a patient (e.g., end of day documentation)
       - Catching up on documentation from previous days
       - Creating records for phone consultations that happened earlier
       - Documenting home visits or off-site consultations retroactively
     - **Known Limitations**:
       - Cannot set custom time, only date (time is always current time)
       - Requires existing patient profile (cannot use for new patients)
       - Date validation prevents future dates but doesn't check business logic (e.g., weekends)

2. **Authentication Flow**:
   - Firebase Auth for user management
   - Bearer token for API authentication
   - WebSocket auth via query parameter

3. **Multilingual Support**:
   - English (Deepgram) for medical accuracy
   - Spanish/English code-switching (Speechmatics)
   - Configurable per transcription profile

4. **Patient Management**:
   - Create, edit, soft-delete patient profiles
   - Store demographics, medical history, medications
   - Link transcripts to patient records
   - Search patients by name
   - Patient context auto-populates in recordings

5. **Transcription Profiles**:
   - Custom templates for different encounter types
   - Configurable AI formatting instructions
   - Speech-to-text settings (smart format, diarization)
   - Language preferences per profile
   - Quick selection during recording setup

6. **Draft System**:
   - Auto-save transcripts as drafts every 30 seconds
   - Resume interrupted sessions
   - Backend persistence in Firestore
   - Draft indicator in recordings list
   - One-click draft recovery

7. **AI Post-Processing**:
   - Google Vertex AI (Gemini models) for formatting
   - Custom prompts per transcription profile
   - Preserves medical terminology accuracy
   - Structures notes into sections
   - Maintains both original and polished versions

8. **User Settings & Customization**:
   - Doctor name and signature
   - Medical specialty
   - Clinic logo upload (base64 encoded)
   - Custom vocabulary for speech recognition
   - Macro phrases (text expansion)
   - Office information for reports

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


