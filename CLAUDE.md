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
  - Google Cloud Storage for graphical signatures and logos
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
       - **Critical Files and Components**:
         - `SetupView.jsx`: UI for enabling dictation mode with date picker
         - `RecordingView.jsx`: Passes `date_of_service` to WebSocket and save endpoint
         - `main.py`: **IMPORTANT** - `SaveSessionRequest` model MUST include `date_of_service: Optional[str] = None`
         - `deepgram_utils.py`: Generates special session ID format for dictation mode
         - `speechmatics_utils.py`: Similar session ID generation
         - `firestore_endpoints.py`: Handles date parsing for dictation mode, passes date to LLM
         - `firestore_client.py`: Special query logic for dictation transcripts
       - **LLM Integration**:
         - Date of service is passed to LLM in custom instructions as "Date of Service: YYYY-MM-DD"
         - Templates should reference this date appropriately (e.g., "Follow up treatment date: [Date of Service]")
         - Templates must NOT hallucinate dates - only use the provided date or indicate "[Date not specified]"
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
     - **Common Issues and Solutions**:
       - **Date not appearing in polished notes**: Ensure `SaveSessionRequest` in `main.py` includes `date_of_service` field
       - **LLM hallucinating dates**: Update template instructions to explicitly state not to generate dates
       - **Date format issues**: Frontend sends YYYY-MM-DD format, backend expects and validates this format

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

### Edit Note Functionality
The edit note feature allows users to modify polished transcripts after AI processing.

**Architecture**:
1. **Frontend Components**:
   - `TranscriptViewer.jsx` - Main container that handles save logic
   - `EditableNote.jsx` - UI component with edit/save buttons and text field
   - `useRecordings` hook - Provides `loadSelectedTranscript` function

2. **Backend Endpoint**:
   - `PUT /api/v1/transcript/{user_id}/{transcript_id}` in `main.py`
   - Updates transcript in Firestore via `firestore_client.update_transcript()`
   - Supports updating both `polishedTranscript` and `originalTranscript`

3. **Data Flow**:
   ```
   User clicks Edit → Enter edit mode → Make changes → Click Save
   ↓
   handleSaveNote() called → Updates local state (instant feedback)
   ↓
   PUT request to backend → Updates Firestore
   ↓
   loadSelectedTranscript() → Reloads from backend → UI shows latest version
   ```

**Key Implementation Details**:
- `handleSaveNote` in TranscriptViewer is async and handles the full save flow
- Updates local state first for immediate UI feedback
- Shows loading spinner and success/error notifications
- Automatically reloads transcript after save to ensure consistency
- Both camelCase and snake_case fields updated for backwards compatibility

**Common Issues**:
- If saves aren't persisting: Check that `loadSelectedTranscript` is exposed in `useRecordings` hook
- If getting 403 errors: Verify user_id matches current_user_id in backend
- If changes disappear on refresh: Ensure backend update is successful (check logs)

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


## PDF Generation
- `pdfUtils.js` - PDF generation utilities
- `generatePagedMedicalPdf` - Multi-transcript PDF for patient profiles
- `generatePdfFromText` - Single transcript PDF generation

## Field Name Mapping (CRITICAL)

### Firestore Database Schema
The Firestore database stores transcript content in these exact field names:
- `transcript_original` - Raw transcript from speech-to-text
- `transcript_polished` - AI-processed/formatted transcript

### Frontend Expected Fields
The frontend expects these field names:
- `transcript` - Maps from `transcript_original`
- `polishedTranscript` - Maps from `transcript_polished`

### Common Field Mapping Issues
This project has experienced multiple bugs due to inconsistent field name mapping between Firestore and the frontend. When working with transcript data:

1. **Reading from Firestore**: Always map `transcript_original` → `transcript` and `transcript_polished` → `polishedTranscript`
2. **Writing to Firestore**: Always save to `transcript_original` and `transcript_polished` (not `polishedTranscript` or other variations)
3. **Critical Backend Functions**:
   - `get_user_recordings_firestore()` - Correctly maps fields for recording lists
   - `get_patient_transcripts()` - Must map fields for patient profile PDFs
   - `update_transcript()` - Must save to correct Firestore field names

### Recent Bug Fixes (June 2025)
1. **Edit Note Persistence**: Fixed field name mismatch in `update_transcript` endpoint where edits were saved to `polishedTranscript` instead of `transcript_polished`
2. **Patient Profile PDFs**: Fixed `get_patient_transcripts` mapping from non-existent fields, causing "No transcript content available" in multi-transcript PDFs

**Prevention Tips**:
- Always check the Firestore model definitions in `firestore_models.py`
- When adding new endpoints, verify field mapping matches existing patterns
- Test both save and load operations to ensure data persists correctly
