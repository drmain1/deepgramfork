# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. 

this product uses venv on python backend, please ask human if you need backend commands. 



## Project Overview

This is a multi tenat HIPAA-compliant medical transcription application that converts audio recordings into structured medical notes. The system uses speech-to-text services (Deepgram for medical, Speechmatics for multilingual) and LLM-based formatting (Google Vertex AI) to produce professional medical documentation.  This file is getting towards production if you see code that could be refactored to be improved or made shorter for maintainability please advise me. 

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

Please remove all debugging once we have confirmed a feature is functional

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
-
refactor @recordingview 7/1/25
1. Created reusable hooks and utilities:
    - useTranscriptionWebSocket - Manages WebSocket
  connections
    - useAudioRecording - Handles audio recording logic
    - sessionSaveUtils.js - Contains save/draft logic
    - recordingConstants.js - All magic strings and constants
  2. Simplified state management:
    - Removed redundant combinedTranscript state (now computed
   with useMemo)
    - Combined error states from different sources
    - Removed unnecessary refs
  3. Cleaned up code:
    - Removed all console.log statements
    - Removed legacy WebSocket message handling
    - Extracted complex functions into smaller, focused
  utilities
    - Used constants instead of magic strings
  4. Improved maintainability:
    - WebSocket logic is now encapsulated and reusable
    - Audio recording logic is separate from UI concerns
    - Save/draft logic is extracted and testable
    - Constants are centralized