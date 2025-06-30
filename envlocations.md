## Environment Variables

### Backend (.env)
```bash
# Google Cloud Platform
GOOGLE_CLOUD_PROJECT="your-project-id"
GCS_BUCKET_NAME="your-bucket-name"
GOOGLE_APPLICATION_CREDENTIALS="path/to/service-account.json"

# Firebase
FIREBASE_SERVICE_ACCOUNT_PATH="path/to/firebase-admin.json"

# Speech-to-Text APIs
DEEPGRAM_API_KEY="your-deepgram-key"
SPEECHMATICS_API_KEY="your-speechmatics-key"

# Application
DEFAULT_TENANT_ID="dev-tenant"
ENVIRONMENT="development"  # or "production"
```

### Frontend (.env)
```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY="your-api-key"
VITE_FIREBASE_AUTH_DOMAIN="your-auth-domain"
VITE_FIREBASE_PROJECT_ID="your-project-id"
VITE_FIREBASE_STORAGE_BUCKET="your-storage-bucket"
VITE_FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
VITE_FIREBASE_APP_ID="your-app-id"

# API Configuration
VITE_API_BASE_URL="http://localhost:8000"  # or production URL

# Feature Flags
VITE_ENABLE_BILLING="true"
VITE_ENABLE_DICTATION_MODE="true"
```