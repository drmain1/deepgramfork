# Project Documentation

## 1. Project Overview

This is a HIPAA-compliant medical transcription application that converts audio recordings into structured medical notes. The system uses speech-to-text services (Deepgram for medical, Speechmatics for multilingual) and LLM-based formatting (Google Vertex AI) to produce professional medical documentation. The application is currently being migrated from AWS to Google Cloud Platform.

### Technology Stack
- **Frontend**: React 18 + Vite, Material-UI, Zustand
- **Backend**: Python 3.11, FastAPI, WebSockets
- **Authentication**: Firebase Authentication / Google Identity Platform
- **Storage**: Google Cloud Storage (GCS)
- **Database**: Firestore
- **AI/ML**: Google Vertex AI (Gemini)
- **Speech-to-Text**: Deepgram, Speechmatics

## 2. Architecture

### Backend
- **Framework**: FastAPI with WebSocket support
- **Main Entry**: `backend/main.py`
- **Authentication**: Firebase Admin SDK via `gcp_auth_middleware.py`
- **Storage**: Firestore for metadata and transcripts, GCS for audio files.
- **Speech Processing**: `deepgram_utils.py` and `speechmatics_utils.py`
- **AI Processing**: `gcp_utils.py` for Vertex AI integration.
- **Session Management**: `FirestoreSessionManager` with a 25-minute timeout.

### Frontend
- **Framework**: React 19 with Vite
- **Routing**: React Router v7
- **State Management**: Zustand (`recordingsStore.js`, `userSettingsStore.js`)
- **Key Components**: `RecordingView.jsx`, `TranscriptionPage.jsx`, `SettingsPage.jsx`

## 3. Security and HIPAA Compliance

- **HIPAA-compliant infrastructure**
- **Data Encryption**: Encryption at rest and in transit.
- **Authentication**: Firebase Authentication with email verification.
- **Authorization**: User data isolation; users can only access their own data.
- **Audit Logging**: Comprehensive audit logging for all PHI access.
- **Session Management**: Firestore-based session management with a 25-minute timeout.
- **Rate Limiting**: Implemented to prevent abuse.
- **No PHI in LocalStorage**: Zustand is used with secure storage to avoid storing PHI in the browser.

## 4. Development

### Frontend (`my-vite-react-app/`)
```bash
npm install
npm run dev
npm run build
npm run lint
npm run preview
```

### Backend (`backend/`)
```bash
pip install -r requirements.txt
python main.py
```

### Deployment
- **Backend**: Deployed to Google Cloud Run.
- **Frontend**: Deployed to Firebase Hosting.

## 5. API Endpoints

### WebSocket Endpoints
- `WS /stream?token={jwt_token}`: Real-time audio streaming for Deepgram transcription.
- `WS /stream/multilingual?token={jwt_token}`: Multilingual streaming via Speechmatics.

### REST API Endpoints
- `/api/v1/user_settings/{user_id}`: GET/POST user settings.
- `/api/v1/user_recordings/{user_id}`: GET user recordings.
- `/api/v1/recordings/{user_id}/{session_id}`: DELETE a recording.
- `/api/v1/save_session_data`: POST to save a transcription session.
- `/api/v1/s3_object_content?s3_key={key}`: GET transcript content.
- `/api/v1/logout`: POST to log out a user.

## 6. Data Schema

### Firestore Collections
- `users/{userId}`: User profiles and settings.
- `transcripts/{sessionId}`: All transcript records.
- `user_sessions/{userId}`: Active user sessions for HIPAA compliance.

### Google Cloud Storage
- `{user_id}/audio/{session_id}.wav`: Audio files.

## 7. Known Issues and Tech Debt

- **Timestamp Display**: Timestamps are not displayed in the UI to avoid showing incorrect times due to timezone complexities.
- **WebSocket Stability**: The WebSocket implementation lacks automatic reconnection logic and has potential memory leaks.
- **Error Handling**: The application needs more robust error handling, including React Error Boundaries.
