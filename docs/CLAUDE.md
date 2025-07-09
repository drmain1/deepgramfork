# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a multi-tenant HIPAA-compliant medical transcription application that converts audio recordings into structured medical notes. The system uses speech-to-text services (Deepgram for medical, Speechmatics for multilingual) and LLM-based formatting (Google Vertex AI) to produce professional medical documentation.

**Current Status**: Active migration from AWS to Google Cloud Platform (branch: `gcp-migration`)

## Critical

this application uses a venv for all backend functions, if you want to test something please load venv on your backend console first 

for all new functions please create using zustand with hipaa complaint data (nothing stored in browser)

If you run in to files with code that is likely extremely difficult to maintain please tell human to plan refactoring

if you run in to non hipaa complaint data transfers or other security risk alert human

## Architecture Overview

### Backend Structure (FastAPI)
- **main.py**: FastAPI application with WebSocket endpoints for real-time transcription
- **firestore_endpoints.py**: Firestore-based API endpoints replacing GCS metadata
- **deepgram_utils.py**: Deepgram WebSocket handling and audio processing
- **gcp_utils.py**: Google Vertex AI integration for transcript polishing
- **firestore_client.py**: Firestore database client and operations
- **services/**: Modular services (PDF generation, user settings)
- **middleware/**: CORS and security middleware
- **models.py**: Pydantic models for API requests/responses

### Frontend Structure (React + Vite)
- **stores/**: Zustand stores for state management (recordings, transcripts, users, patients)
- **hooks/**: Custom React hooks for WebSocket, audio recording, and API calls
- **contexts/**: React contexts for Firebase auth and recordings
- **pages/**: Main application pages (Home, Transcription, Settings, Patients)
- **components/**: Reusable UI components
- **services/**: API service layer for backend communication
- **utils/**: Utility functions for formatting, dates, and business logic

### Key Data Flow
1. Audio recording → WebSocket → Deepgram → Real-time transcription
2. Transcript polishing → Google Vertex AI → Formatted medical notes
3. Session management → Firestore → Persistent storage
4. PDF generation → WeasyPrint → Professional medical documents

## Development Commands

### Frontend (React + Vite)
```bash
cd my-vite-react-app
npm run dev      # Start development server (localhost:5173)
npm run build    # Build for production
npm run lint     # Run ESLint
npm run preview  # Preview production build
```

### Backend (FastAPI)
**Note**: Backend uses Python venv - ask human for specific backend commands if needed.

Common testing utilities:
```bash
cd backend
python test_firestore_connection.py  # Test Firestore connection
python test_gcs_operations.py        # Test Google Cloud Storage
python test_firebase_token.py        # Test Firebase authentication
python test_gcs_health.py           # Test GCS health
```

### Deployment
```bash
./deploy.sh                          # Deploy to GCP (App Engine + Cloud Storage)
firebase deploy                      # Deploy Firebase (Firestore rules, hosting)
firebase deploy --only firestore     # Deploy only Firestore rules
```

## Core Dependencies

### Backend (Python 3.10)
- **FastAPI**: Web framework with WebSocket support
- **Firebase Admin SDK**: Authentication and Firestore
- **Google Cloud SDK**: Storage, Vertex AI, Secret Manager
- **Deepgram SDK**: Medical transcription
- **Speechmatics**: Multilingual transcription
- **WeasyPrint**: PDF generation from HTML/CSS
- **python-jose**: JWT token handling

### Frontend (React 19)
- **Vite**: Build tool and dev server
- **React Router v7**: Client-side routing
- **Zustand**: State management with persistence
- **Firebase SDK**: Authentication
- **Material-UI (MUI)**: UI components
- **date-fns**: Date manipulation

## State Management Architecture

### Zustand Stores
- **recordingsStore**: Audio recordings, transcripts, WebSocket state
- **transcriptsStore**: Transcript history and management
- **userSettingsStore**: User preferences and configuration
- **patientsStore**: Patient data and search
- **transcriptionSessionStore**: Active transcription sessions

### Security Considerations
- **PHI Protection**: Stores use secure storage to exclude Protected Health Information from localStorage
- **Token Management**: Firebase JWT tokens for authenticated API calls
- **HIPAA Compliance**: Audit logging and secure data handling

## Quick Reference

- **Frontend**: http://localhost:5173 (React + Vite)
- **Backend**: http://localhost:8000 (FastAPI)
- **Database**: Firestore (NoSQL)
- **Storage**: Google Cloud Storage (logos/signatures only)
- **Auth**: Firebase Authentication
- **Speech-to-Text**: Deepgram (medical), Speechmatics (multilingual)
- **AI**: Google Vertex AI (Gemini models)