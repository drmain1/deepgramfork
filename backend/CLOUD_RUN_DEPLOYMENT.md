# Cloud Run Deployment Guide

## Overview
This guide documents the deployment process for the MedLegalDoc backend to Google Cloud Run.

## Prerequisites

### 1. GCP CLI Installation
```bash
# Verify installation
gcloud version

# Authenticate
gcloud auth login

# Set project
gcloud config set project medlegaldoc-b31df
```

### 2. Enable Required APIs
```bash
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

## Initial Setup

### 1. Create Artifact Registry Repository
```bash
gcloud artifacts repositories create medlegaldoc-backend \
    --repository-format=docker \
    --location=us-central1 \
    --description="Backend container images for MedLegalDoc"

# Configure Docker authentication
gcloud auth configure-docker us-central1-docker.pkg.dev
```

### 2. Create Service Account
```bash
gcloud iam service-accounts create backend-service \
    --display-name="Backend Service Account" \
    --description="Service account for MedLegalDoc backend on Cloud Run"
```

### 3. Grant IAM Permissions
```bash
# Storage permissions (for Firebase Storage)
gcloud projects add-iam-policy-binding medlegaldoc-b31df \
    --member="serviceAccount:backend-service@medlegaldoc-b31df.iam.gserviceaccount.com" \
    --role="roles/storage.objectAdmin"

# Firestore access
gcloud projects add-iam-policy-binding medlegaldoc-b31df \
    --member="serviceAccount:backend-service@medlegaldoc-b31df.iam.gserviceaccount.com" \
    --role="roles/datastore.user"

# Firebase Auth access
gcloud projects add-iam-policy-binding medlegaldoc-b31df \
    --member="serviceAccount:backend-service@medlegaldoc-b31df.iam.gserviceaccount.com" \
    --role="roles/firebaseauth.viewer"

# Secret Manager access
gcloud projects add-iam-policy-binding medlegaldoc-b31df \
    --member="serviceAccount:backend-service@medlegaldoc-b31df.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

# Firebase Admin (for full Firebase access)
gcloud projects add-iam-policy-binding medlegaldoc-b31df \
    --member="serviceAccount:backend-service@medlegaldoc-b31df.iam.gserviceaccount.com" \
    --role="roles/firebase.admin"
```

### 4. Create Secrets
```bash
# Create required secrets in Secret Manager
echo -n "your-deepgram-api-key" | gcloud secrets create deepgram-api-key --data-file=- --replication-policy="automatic"
echo -n "your-iap-audience" | gcloud secrets create iap-expected-audience --data-file=- --replication-policy="automatic"
echo -n "your-firebase-api-key" | gcloud secrets create firebase-api-key --data-file=- --replication-policy="automatic"
```

### 5. Storage Configuration
The application uses Firebase Storage:
- Bucket: `medlegaldoc-b31df.firebasestorage.app`
- Permissions are managed through Firebase Admin SDK and IAM roles

## Dockerfile Modifications for Cloud Run

The Dockerfile must be configured for Cloud Run:

```dockerfile
# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080

# Expose port (documentation only)
EXPOSE 8080

# Add Cloud Run signal handling
STOPSIGNAL SIGTERM

# Use exec form for proper signal handling and security
ENTRYPOINT ["python", "-m", "uvicorn"]
CMD ["main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1", "--access-log", "--log-level", "info"]
```

## Building and Deploying

### 1. Build Docker Image
```bash
# Build for linux/amd64 architecture (required for Cloud Run)
docker buildx build --platform linux/amd64 \
    -t us-central1-docker.pkg.dev/medlegaldoc-b31df/medlegaldoc-backend/backend:latest \
    --push .
```

### 2. Deploy to Cloud Run
```bash
gcloud run deploy medlegaldoc-backend \
    --image=us-central1-docker.pkg.dev/medlegaldoc-b31df/medlegaldoc-backend/backend:latest \
    --platform=managed \
    --region=us-central1 \
    --service-account=backend-service@medlegaldoc-b31df.iam.gserviceaccount.com \
    --ingress=all \
    --cpu=2 \
    --memory=2Gi \
    --max-instances=10 \
    --min-instances=0 \
    --timeout=300 \
    --concurrency=100 \
    --port=8080 \
    --no-allow-unauthenticated \
    --set-env-vars="ENVIRONMENT=production,GCP_PROJECT_ID=medlegaldoc-b31df,GCS_BUCKET_NAME=medlegaldoc-b31df.firebasestorage.app,FIREBASE_PROJECT_ID=medlegaldoc-b31df,PYTHONUNBUFFERED=1,SECURE_HEADERS_ENABLED=true,CORS_ALLOW_CREDENTIALS=false,SESSION_COOKIE_SECURE=true,SESSION_COOKIE_HTTPONLY=true,SESSION_COOKIE_SAMESITE=strict"
```

## Environment Variables

Required environment variables for Cloud Run:

| Variable | Description | Example |
|----------|-------------|---------|
| `ENVIRONMENT` | Deployment environment | `production` |
| `GCP_PROJECT_ID` | Google Cloud project ID | `medlegaldoc-b31df` |
| `GCS_BUCKET_NAME` | Storage bucket name | `medlegaldoc-b31df.firebasestorage.app` |
| `FIREBASE_PROJECT_ID` | Firebase project ID | `medlegaldoc-b31df` |
| `PORT` | Port for Cloud Run | `8080` |
| `PYTHONUNBUFFERED` | Python output buffering | `1` |
| `SECURE_HEADERS_ENABLED` | Enable security headers | `true` |
| `CORS_ALLOW_CREDENTIALS` | CORS credentials | `false` |
| `SESSION_COOKIE_SECURE` | Secure cookies | `true` |
| `SESSION_COOKIE_HTTPONLY` | HTTP-only cookies | `true` |
| `SESSION_COOKIE_SAMESITE` | Same-site policy | `strict` |

## Post-Deployment

### 1. Verify Deployment
```bash
# Check service status
gcloud run services describe medlegaldoc-backend --region=us-central1

# View logs
gcloud run services logs read medlegaldoc-backend --region=us-central1 --limit=50

# Get service URL
gcloud run services describe medlegaldoc-backend --region=us-central1 --format="value(status.url)"
```

### 2. Configure Authentication

The service is configured to allow public access with Firebase Authentication handling security within the application:

```bash
# Grant public access (allows Firebase Auth to handle authentication)
gcloud run services add-iam-policy-binding medlegaldoc-backend \
    --region=us-central1 \
    --member="allUsers" \
    --role="roles/run.invoker"
```

### 3. Configure Custom Domain

For custom domain setup with CloudFlare:

1. In CloudFlare DNS settings, create a CNAME record:
   - Name: `scribe` (or your subdomain)
   - Target: `medlegaldoc-backend-quflsak5hq-uc.a.run.app` (your Cloud Run URL)
   - Proxy status: Proxied (orange cloud)

2. Wait 1-5 minutes for DNS propagation

3. Test the custom domain:
   ```bash
   curl https://scribe.medlegaldoc.com/docs
   ```

## Troubleshooting

### Common Issues

1. **Container fails to start**
   - Check logs: `gcloud run services logs read medlegaldoc-backend --region=us-central1`
   - Verify all environment variables are set
   - Ensure secrets exist in Secret Manager

2. **Permission errors**
   - Verify service account has all required IAM roles
   - Check bucket permissions for Firebase Storage
   - Ensure Secret Manager permissions are granted

3. **Architecture mismatch**
   - Always build with `--platform linux/amd64` for Cloud Run
   - Use `docker buildx` for cross-platform builds

4. **CloudFlare 522 Connection Timeout**
   - Ensure DNS record is CNAME (not A record) pointing to Cloud Run URL
   - Verify Cloud Run service is running and accessible
   - Check CloudFlare proxy settings are enabled
   - Allow 1-5 minutes for DNS propagation after changes

5. **Frontend API 404 Errors**
   - **Symptom**: `Failed to load resource: the server responded with a status of 404 (Not Found)`
   - **Cause**: Frontend making relative API calls to local dev server instead of GCP backend
   - **Solution**: Update all API calls to use `${API_BASE_URL}/api/...` pattern
   - **Check**: Search codebase for `fetch('/api/` or `fetch("/api/` patterns
   - **Verify**: Ensure `VITE_API_URL` is set correctly in `.env` files

6. **Import/Export Errors**
   - **Symptom**: `SyntaxError: The requested module does not provide an export named 'API_ENDPOINTS'`
   - **Cause**: Hardcoded API endpoint constants removed but still being imported
   - **Solution**: Remove imports of unused constants and use dynamic URL construction

7. **WebSocket Connection Failures**
   - **Symptom**: WebSocket fails to connect or connects to wrong endpoint
   - **Cause**: WebSocket URL construction using relative paths or wrong protocol
   - **Solution**: Ensure WebSocket URLs use WSS for HTTPS backends:
     ```javascript
     const wsProtocol = API_BASE_URL.startsWith('https') ? 'wss' : 'ws';
     ```

8. **CORS Policy Errors**
   - **Symptom**: `blocked by CORS policy` in browser console
   - **Cause**: Frontend domain not allowed in backend CORS settings
   - **Solution**: Add frontend domain to backend CORS allowed origins
   - **Check**: Verify backend allows `http://localhost:5173` for development

9. **Session Login Errors (500 Internal Server Error)**
   - **Symptom**: `Failed to create backend session: 500` when frontend tries to login
   - **Cause**: AuditLogger method signature mismatch
   - **Error**: `AuditLogger.log_authentication() got an unexpected keyword argument 'event_type'`
   - **Solution**: Fix firestore_session_manager.py to use `action` instead of `event_type` parameter
   - **Files affected**: firestore_session_manager.py (4 occurrences)

10. **WebSocket/Deepgram Transcription Not Working**
    - **Symptom**: WebSocket connects but no transcript text appears
    - **Multiple causes and solutions**:
    
    a) **FFmpeg not installed**
       - **Error**: `Error starting FFmpeg: [Errno 2] No such file or directory`
       - **Solution**: Add `ffmpeg` to Dockerfile runtime dependencies
       
    b) **Deepgram API key not loading**
       - **Error**: `HTTP 401` from Deepgram
       - **Cause**: Using lowercase env var `deepgram_api_key` instead of uppercase
       - **Solution**: Update deepgram_utils.py to use config system: `config.deepgram_api_key`
       
    c) **Secret Manager permissions**
       - **Error**: Deepgram API key returns empty/None
       - **Solution**: Grant service account access to secret:
         ```bash
         gcloud secrets add-iam-policy-binding deepgram-api-key \
           --member="serviceAccount:backend-service@medlegaldoc-b31df.iam.gserviceaccount.com" \
           --role="roles/secretmanager.secretAccessor"
         ```
    
    d) **User settings format mismatch**
       - **Error**: `'dict' object has no attribute 'transcriptionProfiles'`
       - **Cause**: Code expects object but receives dict from API
       - **Solution**: Update deepgram_utils.py to handle both dict and object formats

11. **Patient Transcripts Not Loading**
    - **Symptom**: Clicking on patient shows no transcripts/recordings
    - **Cause**: Frontend API calls using relative paths instead of absolute URLs
    - **Solution**: Update all frontend files to use `${API_BASE_URL}/api/v1/...` pattern
    - **Files to update**:
      - patientTranscriptConstants.js - Add API_BASE_URL to all endpoints
      - PatientSelector.jsx - Fix POST to `/api/v1/patients`
      - Any other files with `fetch('/api/...)` calls

### Useful Commands

```bash
# View all revisions
gcloud run revisions list --service=medlegaldoc-backend --region=us-central1

# Delete old revisions
gcloud run revisions delete REVISION_NAME --region=us-central1

# Update environment variables
gcloud run services update medlegaldoc-backend \
    --update-env-vars="KEY=VALUE" \
    --region=us-central1

# View service account permissions
gcloud projects get-iam-policy medlegaldoc-b31df \
    --flatten="bindings[].members" \
    --format="table(bindings.role)" \
    --filter="bindings.members:backend-service@medlegaldoc-b31df.iam.gserviceaccount.com"
```

## Security Considerations

1. **Authentication**: Service allows public invocation with Firebase Auth handling user authentication
2. **Network**: Consider using VPC connector for private resources
3. **Secrets**: All sensitive data stored in Secret Manager
4. **IAM**: Service account follows principle of least privilege
5. **Container**: Runs as non-root user (configured in Dockerfile)
6. **HTTPS**: All traffic encrypted via CloudFlare proxy and Cloud Run

## Current Deployment

- **Service URL**: https://medlegaldoc-backend-quflsak5hq-uc.a.run.app
- **Custom Domain**: https://scribe.medlegaldoc.com (via CloudFlare)
- **Static IP**: 34.110.238.208 (CloudFlare)
- **Region**: us-central1
- **Service Account**: backend-service@medlegaldoc-b31df.iam.gserviceaccount.com
- **Authentication**: Firebase Auth (public invoker access enabled)

## Frontend Integration

### Configuration

Update your frontend `.env` files to point to the deployed backend:

#### Development Environment (.env)
```bash
# API Configuration
VITE_API_URL=https://scribe.medlegaldoc.com

# Firebase Configuration
VITE_FIREBASE_API_KEY=AIzaSyB6a5fkjD5O90jEqQAONJF9C9tTdRVxX64
VITE_FIREBASE_AUTH_DOMAIN=medlegaldoc-b31df.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=medlegaldoc-b31df
VITE_FIREBASE_STORAGE_BUCKET=medlegaldoc-b31df.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1078333885289
VITE_FIREBASE_APP_ID=1:1078333885289:web:da7de056dfa811e72fcbf8

# Development Settings
VITE_USE_AUTH_EMULATOR=false
```

#### Production Environment (.env.production)
```bash
# API Configuration
VITE_API_URL=https://scribe.medlegaldoc.com

# Firebase Configuration (same as development)
VITE_FIREBASE_API_KEY=AIzaSyB6a5fkjD5O90jEqQAONJF9C9tTdRVxX64
VITE_FIREBASE_AUTH_DOMAIN=medlegaldoc-b31df.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=medlegaldoc-b31df
VITE_FIREBASE_STORAGE_BUCKET=medlegaldoc-b31df.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1078333885289
VITE_FIREBASE_APP_ID=1:1078333885289:web:da7de056dfa811e72fcbf8

# Production Settings
VITE_USE_AUTH_EMULATOR=false
```

### Critical: Update All API Calls

**IMPORTANT**: All frontend API calls must use absolute URLs, not relative paths. The following files require updates:

#### Required Changes for API Calls

All `fetch()` calls must use the full backend URL. Replace relative paths like `/api/v1/...` with:

```javascript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const response = await fetch(`${API_BASE_URL}/api/v1/endpoint`, {
  // ... rest of fetch options
});
```

#### Files That Need Updates

1. **FirebaseAuthContext.jsx** - 4 API endpoints:
   - `/api/v1/login` → `${API_BASE_URL}/api/v1/login`
   - `/api/v1/logout` → `${API_BASE_URL}/api/v1/logout`
   - `/api/v1/refresh-session` → `${API_BASE_URL}/api/v1/refresh-session`

2. **sessionManager.js** - Login endpoint
3. **patientsStore.js** - Patients endpoint
4. **useServerPdfGeneration.js** - PDF generation endpoints
5. **FirebaseAuthenticator.jsx** - Auth lockout endpoints
6. **billingPdfGenerator.js** - Billing PDF endpoint
7. **sessionSaveUtils.js** - Session and draft save endpoints

#### Remove Vite Proxy Configuration

Remove any proxy configuration from `vite.config.js` as it causes conflicts:

```javascript
// Remove this section from vite.config.js
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
    }
  }
}
```

### WebSocket Configuration

Update WebSocket connections to use secure WSS protocol:

```javascript
// In RecordingView.jsx or similar components
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const wsProtocol = API_BASE_URL.startsWith('https') ? 'wss' : 'ws';
const wsBaseUrl = isMultilingual 
  ? `${wsProtocol}://${API_BASE_URL.replace(/^https?:\/\//, '')}/stream/multilingual`
  : `${wsProtocol}://${API_BASE_URL.replace(/^https?:\/\//, '')}/stream`;
```

### CORS Configuration

The backend is configured to allow requests from:
- `http://localhost:5173` (default Vite dev server)
- `http://localhost:5174` (alternative Vite port)
- `https://scribe.medlegaldoc.com` (production domain)
- `https://www.scribe.medlegaldoc.com` (www subdomain)

### Testing Integration

1. Start frontend development server:
   ```bash
   cd my-vite-react-app
   npm run dev
   ```

2. Test API connectivity:
   ```bash
   curl https://scribe.medlegaldoc.com/health
   ```

3. Verify WebSocket connections work through the frontend

4. Check for frontend API call issues:
   ```bash
   # Search for any remaining relative API calls
   grep -r "fetch(['\"]/" src/ --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx"
   
   # Should return no results if all calls are properly updated
   ```

5. Verify environment variables are loaded:
   ```javascript
   // In browser console
   console.log('API URL:', import.meta.env.VITE_API_URL);
   // Should output: https://scribe.medlegaldoc.com
   ```

### Deployment

For production frontend deployment, build and serve the frontend:

```bash
# Build frontend
cd my-vite-react-app
npm run build

# Serve built files (example with nginx or other static server)
# Point to the dist/ directory
```

## Quick Deployment Commands

When making backend changes:

```bash
# 1. Build and push Docker image
cd backend
docker buildx build --platform linux/amd64 \
  -t us-central1-docker.pkg.dev/medlegaldoc-b31df/medlegaldoc-backend/backend:latest \
  --push .

# 2. Deploy to Cloud Run
gcloud run deploy medlegaldoc-backend \
  --image=us-central1-docker.pkg.dev/medlegaldoc-b31df/medlegaldoc-backend/backend:latest \
  --region=us-central1

# 3. Check logs for errors
gcloud run services logs read medlegaldoc-backend --region=us-central1 --limit=50
```

## CI/CD Integration

For automated deployments, create a Cloud Build trigger or GitHub Action that:
1. Builds the Docker image
2. Pushes to Artifact Registry
3. Updates the Cloud Run service

Example GitHub Action step:
```yaml
- name: Deploy to Cloud Run
  run: |
    gcloud run deploy medlegaldoc-backend \
      --image=us-central1-docker.pkg.dev/${{ secrets.GCP_PROJECT }}/medlegaldoc-backend/backend:${{ github.sha }} \
      --region=us-central1
```