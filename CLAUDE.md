# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a multi tenat HIPAA-compliant medical transcription application that converts audio recordings into structured medical notes. The system uses speech-to-text services (Deepgram for medical, Speechmatics for multilingual) and LLM-based formatting (Google Vertex AI) to produce professional medical documentation.

**Current Status**: Active migration from AWS to Google Cloud Platform (branch: `gcp-migration`)

## Quick Reference

- **Frontend**: http://localhost:5173 (React + Vite)
- **Backend**: http://localhost:8000 (FastAPI)
- **Database**: Firestore (NoSQL)
- **Storage**: Google Cloud Storage (for logos/signatures only)
- **Auth**: Firebase Authentication
- **Speech-to-Text**: Deepgram (medical), Speechmatics (multilingual)
- **AI**: Google Vertex AI (Gemini models)

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
- **Storage**: 
  - Firestore: Primary database for ALL transcripts, metadata, settings, patient data
  - Google Cloud Storage (GCS): ONLY for graphical assets (signatures & logos)
  - Note: Transcripts are stored directly in Firestore, NOT in GCS
- **Speech Processing**: 
  - `deepgram_utils.py` - Medical transcription
  - `speechmatics_utils.py` - Multilingual support
- **AI Processing**: `gcp_utils.py` - Vertex AI integration
- **Session Management**: `FirestoreSessionManager` with 25-minute timeout

**Key WebSocket Endpoints**:
- `/stream` - Deepgram medical transcription
- `/stream/multilingual` - Speechmatics multilingual transcription



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


## Useful Resources

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

**Prevention Tips**:
- Always check the Firestore model definitions in `firestore_models.py`
- When adding new endpoints, verify field mapping matches existing patterns
- Test both save and load operations to ensure data persists correctly

## Data Storage Architecture

### Current Storage Strategy
1. **Firestore (NoSQL Database)**:
   - All transcript content (original & polished)
   - User settings and preferences
   - Patient profiles and demographics
   - Session metadata
   - Draft recordings
   - Audit logs (future)

2. **Google Cloud Storage (GCS)**:
   - **Current Usage**: ONLY graphical assets
   
   - **Storage Path**: `{user_id}/signatures/` and `{user_id}/logos/`


### Important Notes

- **No Audio Storage**: Audio is streamed directly to speech-to-text services, never stored
- **HIPAA Compliance**: Both Firestore and GCS are configured with encryption at rest

## Firestore Database Schema

### Collections Overview
```
firestore/
├── users/                 # User profiles and settings
├── transcripts/          # All transcriptions
├── patients/             # Patient profiles
├── user_sessions/        # Active login sessions (HIPAA compliance)
└── audit_logs/           # Audit trail (future)
```

### Detailed Schema

#### 1. `users` Collection
Document ID: Firebase Auth UID
```python
{
    # Basic Info
    email: str                              # User's email
    name: Optional[str]                     # Display name
    clinic_name: Optional[str]              # Clinic/practice name
    
    # Timestamps
    created_at: datetime                    # Account creation
    updated_at: datetime                    # Last profile update
    last_login: Optional[datetime]          # For audit trail
    
    # Settings (migrated from GCS)
    custom_vocabulary: List[str]            # Custom medical terms
    macro_phrases: Dict[str, str]           # Text expansion shortcuts
    transcription_profiles: List[Dict]      # Custom templates
    
    # References to GCS files
    logo_gcs_path: Optional[str]            # Path to clinic logo in GCS
    
    # HIPAA Compliance
    email_verified: bool                    # Email verification status
}
```

#### 2. `transcripts` Collection
Document ID: Unique session ID (format: YYYYMMDD_HHMMSS_randomsuffix)
```python
{
    # Ownership & Identity
    user_id: str                            # Firebase UID (owner)
    session_id: str                         # Unique transcript ID
    
    # Status Tracking
    status: str                             # "processing", "completed", "error", "draft"
    
    # Timestamps
    created_at: datetime                    # When recording started
    updated_at: datetime                    # Last modification
    completed_at: Optional[datetime]        # When processing finished
    
    # Recording Details
    duration_seconds: Optional[int]         # Length of recording
    patient_name: str                       # Patient's name
    patient_id: Optional[str]               # Link to patients collection
    patient_context: Optional[str]          # Additional context (DOB, DOA, etc)
    encounter_type: Optional[str]           # Visit type
    location: Optional[str]                 # Clinic location
    
    # Dictation Mode Fields
    is_dictation: Optional[bool]            # True if dictation mode
    date_of_service: Optional[str]          # Historical date (YYYY-MM-DD)
    
    # Transcription Settings
    llm_template: Optional[str]             # Template content used
    llm_template_id: Optional[str]          # Profile ID used
    language: str = "en"                    # Language code
    
    # Content (stored directly in Firestore)
    transcript_original: Optional[str]      # Raw speech-to-text
    transcript_polished: Optional[str]      # AI-formatted version
   
    # Error Tracking
    error_message: Optional[str]            # Main error message
    processing_errors: List[str]            # Detailed error log
}
```

#### 3. `patients` Collection
Document ID: Auto-generated unique ID
```python
{
    # Ownership
    user_id: str                            # Doctor who created profile
    
    # Demographics
    first_name: str                         # Patient first name
    last_name: str                          # Patient last name
    date_of_birth: datetime                 # DOB
    date_of_accident: Optional[datetime]    # DOA (if applicable)
    
    # Clinical Notes
    notes_private: Optional[str]            # Doctor's private notes
    notes_ai_context: Optional[str]         # Shared with AI for context
    
    # Timestamps
    created_at: datetime                    # Profile creation
    updated_at: datetime                    # Last update
    
    # Status
    active: bool = True                     # Soft delete flag
}
```

#### 4. `user_sessions` Collection
Document ID: Firebase Auth UID
```python
{
    # Session Info
    user_id: str                            # Firebase UID
    created_at: datetime                    # Session start
    last_activity: datetime                 # Last API call
    expires_at: datetime                    # Session expiration
    active: bool = True                     # Is session valid
    
    # Audit Fields
    ip_address: Optional[str]               # Client IP
    user_agent: Optional[str]               # Browser info
    
    # Logout Tracking
    logged_out_at: Optional[datetime]       # Manual logout time
    expired_at: Optional[datetime]          # Auto-expiration time
}
```

## API Reference

### Authentication
All API endpoints (except `/health`) require Firebase Authentication:
```
Authorization: Bearer {firebase_id_token}
```

### REST Endpoints

#### User Management
```python
# Get user settings
GET /api/v1/user_settings/{user_id}
Response: UserSettingsData

# Update user settings
POST /api/v1/user_settings
Body: SaveUserSettingsRequest
Response: {success: bool, message: str}

# Login (create session)
POST /api/v1/login
Response: {success: bool, message: str, user_id: str}

# Logout (clear session)
POST /api/v1/logout
Response: {success: bool, message: str}
```

#### Transcription Management
```python
# List user's transcripts
GET /api/v1/user_recordings/{user_id}
Response: List[RecordingInfo]

# Get specific transcript
GET /api/v1/transcript/{user_id}/{transcript_id}
Response: RecordingInfo

# Update transcript (edit note)
PUT /api/v1/transcript/{user_id}/{transcript_id}
Body: UpdateTranscriptRequest
Response: {success: bool, message: str}

# Save completed session
POST /api/v1/save_session_data
Body: SaveSessionRequest
Response: {success: bool, session_id: str}

# Save draft
POST /api/v1/save_draft
Body: SaveDraftRequest
Response: {success: bool}

# Delete transcript
DELETE /api/v1/recordings/{user_id}/{session_id}
Response: {success: bool, message: str}
```

#### Patient Management
```python
# Create patient
POST /api/v1/patients
Body: PatientCreateRequest
Response: PatientResponse

# List patients
GET /api/v1/patients
Response: List[PatientResponse]

# Get patient details
GET /api/v1/patients/{patient_id}
Response: PatientResponse

# Update patient
PUT /api/v1/patients/{patient_id}
Body: PatientUpdateRequest
Response: PatientResponse

# Soft delete patient
DELETE /api/v1/patients/{patient_id}
Response: {success: bool}

# Get patient's transcripts
GET /api/v1/patients/{patient_id}/transcripts
Response: List[RecordingInfo]

# Generate billing summary
POST /api/v1/patients/{patient_id}/generate-billing
Body: BillingRequest
Response: {billing_text: str}
```

#### Utility Endpoints

# Test GCP connection
GET /api/v1/test-gcp
Response: {success: bool, message: str, provider: str}

# Debug transcription profiles
GET /api/v1/debug/transcription_profiles/{user_id}
Response: {profiles_count: int, profiles: List[ProfileInfo]}

# Debug logo
GET /api/v1/debug_logo/{user_id}
Response: {has_logo: bool, logo_url: str, ...}
```

### WebSocket Endpoints

#### Deepgram Medical Transcription
```
ws://localhost:8000/stream?token={firebase_token}

# Initial metadata message (from client):
{
    "session_id": "20240101_123456_abc123",
    "patient_name": "John Doe",
    "patient_id": "patient123",  // optional
    "patient_context": "DOB: 01/01/1970, DOA: 12/01/2023",
    "encounter_type": "Initial Evaluation",
    "location": "Main Clinic",
    "llm_template_id": "template123",
    "date_of_service": "2024-01-01"  // optional, for dictation mode
}

# Audio data: raw audio bytes (16kHz, 16-bit PCM)

# Transcription updates (from server):
{
    "type": "transcription",
    "transcript": "Patient reports pain in...",
    "is_final": false
}

# Final message (from server):
{
    "type": "final",
    "transcript": "Complete transcription text...",
    "session_id": "20240101_123456_abc123"
}
```

```

## Request/Response Models

### User Settings Models
```python
class TranscriptionProfileItem(BaseModel):
    id: str
    name: str
    llmInstructions: Optional[str]
    llmPrompt: Optional[str]  
    specialty: Optional[str]
    useSmartFormatting: bool = True
    useSpeakerDiarization: bool = False
    language: str = "en"
    originalTemplateId: Optional[str]

class UserSettingsData(BaseModel):
    customVocabulary: List[str]
    macroPhrases: List[MacroPhraseItem]
    officeInformation: List[InfoItem]
    transcriptionProfiles: List[TranscriptionProfileItem]
    doctorName: Optional[str]
    doctorSignature: Optional[str]  # Base64 encoded
    clinicLogo: Optional[str]       # GCS URL
    includeLogoOnPdf: bool = False
    medicalSpecialty: Optional[str]
```

### Session/Transcript Models
```python
class SaveSessionRequest(BaseModel):
    session_id: str
    user_id: str
    patient_name: str
    patient_id: Optional[str]
    patient_context: Optional[str]
    encounter_type: Optional[str]
    location: Optional[str]
    transcript: str
    duration: int
    llm_template_id: Optional[str]
    date_of_service: Optional[str]  # For dictation mode

class RecordingInfo(BaseModel):
    id: str                          # session_id
    name: str                        # Display name
    date: datetime                   # created_at or date_of_service
    status: str                      # "saved", "draft", "processing"
    patientContext: Optional[str]
    encounterType: Optional[str]
    location: Optional[str]
    durationSeconds: Optional[int]
    transcript: Optional[str]        # Original
    polishedTranscript: Optional[str]
    patientId: Optional[str]
```

### Patient Models
```python
class PatientCreateRequest(BaseModel):
    first_name: str
    last_name: str
    date_of_birth: str              # YYYY-MM-DD
    date_of_accident: Optional[str]  # YYYY-MM-DD
    notes_private: Optional[str]
    notes_ai_context: Optional[str]

class PatientResponse(BaseModel):
    id: str
    user_id: str
    first_name: str
    last_name: str
    date_of_birth: datetime
    date_of_accident: Optional[datetime]
    notes_private: Optional[str]
    notes_ai_context: Optional[str]
    created_at: datetime
    updated_at: datetime
    active: bool
```

## Frontend Component Hierarchy

### Main Application Structure
```
App.jsx
├── AuthProvider (Firebase Auth Context)
├── AppRoutes (React Router v7)
│   ├── Layout.jsx (Sidebar + Main Content)
│   │   ├── Sidebar.jsx
│   │   │   ├── Navigation Links
│   │   │   ├── Recent Recordings List
│   │   │   └── User Menu
│   │   └── Main Content Area
│   │       ├── TranscriptionPage.jsx (Main workflow)
│   │       │   ├── SetupView.jsx
│   │       │   │   ├── PatientSelector.jsx
│   │       │   │   ├── ProfileSelector.jsx
│   │       │   │   └── Date Picker (Dictation Mode)
│   │       │   ├── RecordingView.jsx
│   │       │   │   ├── AudioRecorder
│   │       │   │   ├── TranscriptDisplay
│   │       │   │   └── RecordingControls
│   │       │   └── TranscriptViewer.jsx
│   │       │       ├── EditableNote.jsx
│   │       │       └── PDF Export
│   │       ├── PatientsPage.jsx
│   │       │   └── PatientTable
│   │       ├── PatientTranscriptList.jsx
│   │       │   └── TranscriptTable
│   │       ├── SettingsPage.jsx
│   │       │   ├── PersonalInfo
│   │       │   ├── TranscriptionProfiles
│   │       │   ├── MacroPhrases
│   │       │   └── CustomVocabulary
│   │       └── RecordingsHistoryPage.jsx
│   └── Login.jsx
```

### State Management (Zustand Stores)

#### 1. `useRecordingsStore.js`
```javascript
{
    recordings: [],              // List of recordings
    selectedRecording: null,     // Currently selected
    isLoading: false,
    error: null,
    
    // Actions
    fetchRecordings: async (userId) => {},
    loadSelectedTranscript: async (userId, sessionId) => {},
    updateTranscript: async (userId, sessionId, data) => {},
    deleteRecording: async (userId, sessionId) => {}
}
```

#### 2. `useUserSettingsStore.js`
```javascript
{
    settings: {
        customVocabulary: [],
        macroPhrases: [],
        transcriptionProfiles: [],
        doctorName: '',
        clinicLogo: null,
        // ... etc
    },
    isLoading: false,
    
    // Actions
    fetchSettings: async (userId) => {},
    updateSettings: async (userId, settings) => {},
    uploadLogo: async (file) => {}
}
```

#### 3. `usePatientsStore.js`
```javascript
{
    patients: [],                // All patients
    selectedPatient: null,       // Current patient
    lastFetch: null,            // Cache timestamp
    isLoading: false,
    
    // Actions
    fetchPatients: async () => {},
    createPatient: async (data) => {},
    updatePatient: async (id, data) => {},
    deletePatient: async (id) => {}
}
```

## Data Flow Patterns

### 1. Recording Creation Flow
```
User Action                     Frontend                          Backend                         Services
-----------                     --------                          -------                         --------
Click "Start Recording" ──────> SetupView.jsx
                               │
Select Patient & Profile ─────> PatientSelector.jsx
                               │
Fill Setup Form ──────────────> Validate & Submit
                               │
                               RecordingView.jsx
                               │
Start Recording ──────────────> Create WebSocket ───────────────> /stream endpoint
                               │                                  │
Send Audio Stream ────────────> Forward Audio Bytes ─────────────> Process Audio ─────────────> Deepgram API
                               │                                  │                              │
Receive Transcription <────────┘                                  └── Return Transcript <───────┘
                               │
Stop Recording ───────────────> Close WebSocket
                               │
Save Transcript ──────────────> POST /save_session_data ─────────> Save to Firestore
                               │                                  │
                               │                                  └── Polish with AI ──────────> Vertex AI
                               │                                                                 │
Update UI <───────────────────────────────────────────────────────── Return Polished <─────────┘
```

### 2. Authentication Flow
```
User Login ────────> Firebase Auth ────────> Get ID Token
                                            │
                                            v
API Request ──────> Add Bearer Token ────> Backend Middleware ────> Validate Token
                                                                   │
                                                                   v
                                                          Create/Update Session ────> Firestore
```

### 3. Patient Context Integration
```
Select Patient ────> Load Patient Data ────> Include in Recording Metadata
                                           │
                                           v
                    Patient Context (DOB, DOA, Notes) ────> Pass to LLM ────> Enhanced Transcript
```

## Common Development Patterns

### Adding a New Feature Checklist

1. **Backend Changes**:
   - [ ] Add data model to `firestore_models.py` if needed
   - [ ] Create/update API endpoint in `main.py`
   - [ ] Add authentication with `Depends(get_current_user)`
   - [ ] Implement business logic in appropriate utility file
   - [ ] Update Firestore rules if accessing new collections

2. **Frontend Changes**:
   - [ ] Create/update Zustand store if managing state
   - [ ] Build UI components (follow Material-UI patterns)
   - [ ] Add API calls with proper error handling
   - [ ] Include loading states and error boundaries
   - [ ] Update routing if adding new pages


### Common Gotchas

1. **Field Name Mapping**:
   - Frontend uses camelCase: `polishedTranscript`
   - Firestore uses snake_case: `transcript_polished`
   - Always map between them in API endpoints

2. **Authentication**:
   - WebSocket auth via query param: `?token={token}`
   - REST API auth via header: `Authorization: Bearer {token}`
   - Sessions expire after 25 minutes of inactivity

3. **Date Handling**:
   - Frontend sends dates as strings: "YYYY-MM-DD"
   - Backend converts to datetime objects
   - Timezone: Always use UTC in backend

4. **State Management**:
   - Never store PHI in localStorage
   - Use Zustand stores for all application state
   - Implement cache TTL to prevent stale data

5. **WebSocket Reconnection**:
   - Implement exponential backoff
   - Max 5 reconnection attempts
   - Show clear error messages to user



## File Organization

### Backend Structure
```
backend/
├── main.py                    # FastAPI app & endpoints
├── firestore_models.py        # Data models
├── firestore_client.py        # Firestore operations
├── firestore_endpoints.py     # Endpoint implementations
├── gcp_auth_middleware.py     # Authentication
├── gcp_utils.py              # Vertex AI integration
├── deepgram_utils.py         # Deepgram WebSocket handler
├── speechmatics_utils.py     # Speechmatics handler
├── gcs_utils.py              # Cloud Storage operations
├── audit_logger.py           # Audit trail logging
├── requirements.txt          # Python dependencies
└── .env                      # Environment variables
```

### Frontend Structure
```
my-vite-react-app/
├── src/
│   ├── components/           # Reusable UI components
│   │   ├── EditableNote.jsx
│   │   ├── PatientSelector.jsx
│   │   └── Sidebar.jsx
│   ├── pages/               # Page components
│   │   ├── TranscriptionPage.jsx
│   │   ├── PatientsPage.jsx
│   │   └── SettingsPage.jsx
│   ├── store/               # Zustand state management
│   │   ├── useRecordingsStore.js
│   │   └── usePatientsStore.js
│   ├── utils/               # Utility functions
│   │   ├── api.js           # API client
│   │   ├── auth.js          # Auth helpers
│   │   └── pdfUtils.js      # PDF generation
│   ├── App.jsx              # Main app component
│   └── main.jsx             # Entry point
├── .env                     # Environment variables
└── vite.config.js           # Vite configuration
```

## Debugging Tips

### Common Issues

1. **"No transcript content available" in PDFs**:
   - Check field mapping in `get_patient_transcripts()`
   - Verify `transcript_original` → `transcript` mapping

2. **WebSocket connection fails**:
   - Check Firebase token is valid
   - Verify WebSocket URL includes token parameter
   - Check browser console for CORS errors

3. **Transcripts not saving**:
   - Check `SaveSessionRequest` includes all required fields
   - Verify `date_of_service` field for dictation mode
   - Check Firestore rules allow write access

4. **Settings not persisting**:
   - Verify user has write access to their document
   - Check field names match between frontend/backend
   - Look for validation errors in backend logs


## Adding New Features - Complete Example

### Example: Adding Re-evaluation Feature

1. **Define Data Model** (firestore_models.py):
```python
class EvaluationType(str, Enum):
    INITIAL = "initial"
    FOLLOW_UP = "follow_up"
    RE_EVALUATION = "re_evaluation"

# Add to TranscriptDocument:
evaluation_type: Optional[EvaluationType] = None
previous_evaluation_id: Optional[str] = None
```

2. **Create API Endpoint** (main.py):
```python
@app.get("/api/v1/evaluations/{patient_id}/compare")
async def compare_evaluations(
    patient_id: str,
    current_user_id: str = Depends(get_user_id)
):
    # Get all evaluations for patient
    # Compare and return improvements
    pass
```

3. **Add Frontend Component**:
```javascript
// EvaluationComparison.jsx
const EvaluationComparison = ({ patientId }) => {
    const [comparison, setComparison] = useState(null);
    
    useEffect(() => {
        fetchComparison(patientId);
    }, [patientId]);
    
    // Render comparison UI
};
```

4. **Update Recording Flow**:
   - Add evaluation type selector to SetupView
   - Pass evaluation type to WebSocket metadata
   - Store in Firestore with transcript

5. **Test End-to-End**:
   - Create initial evaluation
   - Create follow-up after 30 days
   - Verify comparison shows improvements

## Critical Files Reference

### Most Important Backend Files
- `main.py` - All API endpoints and WebSocket handlers
- `firestore_models.py` - Data structure definitions (source of truth)
- `firestore_client.py` - Database operations and field mapping
- `gcp_utils.py` - AI integration (Vertex AI/Gemini)
- `deepgram_utils.py` - Medical transcription WebSocket
- `gcp_auth_middleware.py` - Authentication and session management

### Most Important Frontend Files
- `TranscriptionPage.jsx` - Main recording workflow
- `RecordingView.jsx` - WebSocket audio streaming
- `SetupView.jsx` - Recording configuration
- `useRecordingsStore.js` - Transcript state management
- `usePatientsStore.js` - Patient data state
- `api.js` - API client with auth headers

### Configuration Files
- `backend/.env` - Backend environment variables
- `my-vite-react-app/.env` - Frontend environment variables
- `firestore.rules` - Database security rules
- `app.yaml` - Google App Engine config
- `requirements.txt` - Python dependencies
- `package.json` - JavaScript dependencies

## Deployment Process

### Pre-deployment Checklist
1. [ ] Run frontend build: `npm run build`
2. [ ] Update version in `package.json`
3. [ ] Test all critical flows locally
4. [ ] Review environment variables
5. [ ] Check Firestore indexes

### Deployment Commands
```bash
# Deploy everything
./deploy.sh

# Deploy only backend
gcloud app deploy backend/app.yaml

# Deploy only frontend
cd my-vite-react-app && npm run build
gsutil -m rsync -d -r dist/ gs://your-frontend-bucket/

# Deploy Firestore rules
firebase deploy --only firestore
```
## Quick Start: Adding a New Feature

### Step 1: Plan the Feature
1. Identify required data models
2. Design API endpoints
3. Plan UI components
4. Consider HIPAA implications

### Step 2: Backend Implementation
```python
# 1. Add to firestore_models.py
class NewFeatureDocument(BaseModel):
    user_id: str
    # ... fields

# 2. Add endpoint to main.py
@app.post("/api/v1/new-feature")
async def create_new_feature(
    request: NewFeatureRequest,
    current_user_id: str = Depends(get_user_id)
):
    # Implementation

# 3. Add Firestore operations
async def save_new_feature(data):
    # Save to Firestore
```

### Step 3: Frontend Implementation
```javascript
// 1. Create Zustand store
const useNewFeatureStore = create((set) => ({
    data: null,
    fetchData: async () => {
        // API call
    }
}));

// 2. Build UI component
const NewFeature = () => {
    const { data, fetchData } = useNewFeatureStore();
    // Component logic
};

// 3. Add to routing
<Route path="/new-feature" element={<NewFeature />} />
```


---
