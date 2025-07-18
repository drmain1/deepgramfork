# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a multi-tenant HIPAA-compliant medical transcription application that converts audio recordings into structured medical notes. The system uses Deepgram speech-to-text service (including multilingual support) and LLM-based formatting (Google Vertex AI) to produce professional medical documentation.

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
- **Deepgram**: Medical and multilingual transcription
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

## Docker and Security Updates

### Chainguard Security Migration (December 2024)
The backend has been migrated to use **Chainguard Wolfi** base images for enhanced security:

- **Base Image**: `cgr.dev/chainguard/wolfi-base:latest` - Minimal, security-focused Linux distribution
- **Security Features**:
  - Non-root user execution (`nonroot` user)
  - Read-only root filesystem capability
  - Minimal attack surface with distroless approach
  - Regular security updates and CVE patches
  - HIPAA-compliant security configurations

### Docker Configuration Files
- **`Dockerfile.chainguard`**: Production Dockerfile using Chainguard Wolfi base
  - Multi-stage build for smaller image size
  - Python 3.11 runtime
  - Includes WeasyPrint and FFmpeg dependencies
  - Non-root user by default
  
- **`docker-compose.chainguard.yml`**: Docker Compose for local development
  - Enhanced security options (no-new-privileges, capability dropping)
  - Resource limits and health checks
  - Temporary filesystem mounts for WeasyPrint cache
  - Volume mounts for Google Cloud credentials

### Building and Running with Chainguard
```bash
# Build the Chainguard-based image
docker build -f Dockerfile.chainguard -t backend-app-chainguard:latest .

# Run with Docker Compose
docker-compose -f docker-compose.chainguard.yml up

# For production deployment to GCP
gcloud builds submit --config=cloudbuild.yaml
```

**Important**: When debugging deployment issues, ensure you're using the Chainguard-based configuration files, not the legacy Dockerfile.

## Quick Reference

- **Frontend**: http://localhost:5173 (React + Vite)
- **Backend**: http://localhost:8000 (FastAPI) / http://localhost:8080 (Docker)
- **Database**: Firestore (NoSQL)
- **Storage**: Google Cloud Storage (logos/signatures only)
- **Auth**: Firebase Authentication
- **Speech-to-Text**: Deepgram (medical and multilingual)
- **AI**: Google Vertex AI (Gemini models)
- **Container Security**: Chainguard Wolfi base images

## Docker to GCP Deployment Guide

### Quick Deploy Checklist (Chainguard + GCP)

#### Prerequisites
- Docker Desktop running
- gcloud CLI authenticated (`gcloud auth login`)
- Project set: `gcloud config set project medlegaldoc-b31df`

#### Standard Deployment (5-minute process)

1. **Build with Chainguard base image**:
   ```bash
   cd backend
   docker build -f Dockerfile.chainguard -t medlegaldoc-backend:latest .
   ```

2. **Tag for GCP Container Registry**:
   ```bash
   docker tag medlegaldoc-backend:latest gcr.io/medlegaldoc-b31df/medlegaldoc-backend:latest
   ```

3. **Push to GCP**:
   ```bash
   docker push gcr.io/medlegaldoc-b31df/medlegaldoc-backend:latest
   ```

4. **Deploy to Cloud Run**:
   ```bash
   gcloud run deploy medlegaldoc-backend \
     --image gcr.io/medlegaldoc-b31df/medlegaldoc-backend:latest \
     --region us-central1 \
     --platform managed \
     --allow-unauthenticated
   ```

#### Alternative: Cloud Build (Recommended for CI/CD)

Use Cloud Build for automated, secure builds:
```bash
cd backend
gcloud builds submit --config=cloudbuild.yaml .
```

This automatically:
- Builds with Chainguard base
- Pushes to Container Registry
- Deploys to Cloud Run
- Sets up proper service accounts

#### Common Issues & Solutions

1. **Docker Desktop paused**: Check Docker whale icon → Resume
2. **Architecture mismatch**: Always build for amd64:
   ```bash
   docker buildx build --platform linux/amd64 -f Dockerfile.chainguard -t medlegaldoc-backend:latest .
   ```
3. **Missing files in container**: Ensure Dockerfile.chainguard includes all needed files (check COPY commands)
4. **Container fails to start**: Check PORT=8080 is properly configured in main.py

#### Environment Variables for Features

Set these after deployment:
```bash
gcloud run services update medlegaldoc-backend \
  --region us-central1 \
  --set-env-vars KEY1=value1,KEY2=value2
```

Common variables:
- `WEBSOCKET_INACTIVITY_ENABLED=true`
- `WEBSOCKET_INACTIVITY_WARNING=8`
- `WEBSOCKET_INACTIVITY_TIMEOUT=15`

#### Monitoring Deployment

Check service status:
```bash
gcloud run services describe medlegaldoc-backend --region us-central1
```

View logs:
```bash
gcloud run logs read --service medlegaldoc-backend --region us-central1
```

#### One-Line Deploy Script

Save this as `deploy-to-gcp.sh`:
```bash
#!/bin/bash
cd backend && \
docker buildx build --platform linux/amd64 -f Dockerfile.chainguard -t medlegaldoc-backend:latest . && \
docker tag medlegaldoc-backend:latest gcr.io/medlegaldoc-b31df/medlegaldoc-backend:latest && \
docker push gcr.io/medlegaldoc-b31df/medlegaldoc-backend:latest && \
gcloud run deploy medlegaldoc-backend \
  --image gcr.io/medlegaldoc-b31df/medlegaldoc-backend:latest \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated && \
echo "Deployment complete! Service URL:" && \
gcloud run services describe medlegaldoc-backend --region us-central1 --format="value(status.url)"
```

Make executable: `chmod +x deploy-to-gcp.sh`
Run: `./deploy-to-gcp.sh`