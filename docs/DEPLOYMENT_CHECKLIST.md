# Deployment Checklist for scribe.medlegaldoc.com

## ✅ Completed
- [x] Reserved static IP in GCP: 34.110.238.208
- [x] Created DNS A record for scribe.medlegaldoc.com
- [x] Updated backend CORS settings

## 📋 Before Deployment

### 1. Firebase Console Setup
- [ ] Go to Firebase Console > Authentication > Settings
- [ ] Add `scribe.medlegaldoc.com` to Authorized domains
- [ ] Update OAuth redirect URIs if using Google Sign-in

### 2. Environment Variables
- [ ] Set up Google Secret Manager for sensitive keys:
  ```bash
  # Create secrets
  echo "your-deepgram-key" | gcloud secrets create deepgram-api-key --data-file=-
 
  ```

### 3. Frontend Configuration
- [ ] Update `my-vite-react-app/.env.production`:
  ```
  VITE_API_URL=https://scribe.medlegaldoc.com/api
  ```

### 4. Backend Requirements
- [ ] Add `gunicorn` to requirements.txt:
  ```bash
  echo "gunicorn==21.2.0" >> backend/requirements.txt
  ```

## 🚀 Deployment Options

### Option 1: App Engine (Simplest)
```bash
# Backend
cd backend
gcloud app deploy

# Frontend (static hosting)
cd ../my-vite-react-app
npm run build
gsutil -m cp -r dist/* gs://scribe-medlegaldoc-frontend/
```

### Option 2: Compute Engine (More control)
- Create VM instance
- Install Python, Node.js
- Clone repo
- Run with systemd services

### Option 3: Cloud Run (Without full containerization)
```bash
# Use Google's buildpacks
gcloud run deploy medlegaldoc-backend \
  --source . \
  --region us-central1
```

## 🔒 SSL Certificate

### Google-managed Certificate (Recommended)
1. In GCP Console > Network Services > Load Balancing
2. Create HTTPS Load Balancer
3. Add managed certificate for scribe.medlegaldoc.com
4. Attach static IP 34.110.238.208

## 📊 Post-Deployment

- [ ] Test all endpoints
- [ ] Verify WebSocket connections work
- [ ] Check CORS headers
- [ ] Monitor logs in Cloud Logging
- [ ] Set up uptime monitoring
- [ ] Test audio upload/transcription flow
- [ ] Verify Firebase authentication

## 🔄 Rollback Plan

If issues arise:
1. Update DNS to point to backup/staging server
2. Or use Cloud Load Balancer traffic splitting
3. Keep last working version tagged in git

## 📝 Notes

- DNS propagation is complete (verified)
- Static IP is reserved and ready
- No containerization required per your preference
- Consider setting up staging environment on dev.medlegaldoc.com