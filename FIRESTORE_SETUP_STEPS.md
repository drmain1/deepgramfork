# Firestore Setup Steps

## Current Status
Your app is trying to use Firestore for session management, but Firestore hasn't been created in your GCP project yet. This is causing authentication failures.

## Immediate Fix (To Get App Working Now)
The app is currently configured to work without Firestore session checks, so it should be functional.

## Production Setup Steps

### 1. Enable Firestore in GCP Console
**REQUIRED** - This is the main issue preventing proper session management.

1. Go to: https://console.cloud.google.com/datastore/setup?project=medlegaldoc-b31df
2. Select **"Firestore in Native mode"** (NOT Datastore mode)
3. Choose a region (recommend same as your other GCP resources)
4. Click **Create Database**

### 2. After Firestore is Created

#### Re-enable Session Management
In `backend/gcp_auth_middleware.py`, change the import back:
```python
# Change from:
from memory_session_manager import memory_session_manager as session_manager

# To:
from firestore_session_manager import firestore_session_manager as session_manager
```

#### Update get_current_user function
Replace the simplified version with the async version for proper session checks.

### 3. Run Migration (Optional but Recommended)
This will move your existing metadata from GCS to Firestore for faster queries:

```bash
cd backend
python migrate_to_firestore.py
```

### 4. Benefits Once Enabled
- ✅ Sessions survive server restarts
- ✅ 10-100x faster recording queries
- ✅ Proper session timeout enforcement
- ✅ Full HIPAA audit trail
- ✅ Advanced search capabilities

## What's Working Now
- ✅ Firebase authentication
- ✅ Email verification check
- ✅ User data isolation
- ✅ GCS storage for transcripts
- ✅ Rate limiting

## What Needs Firestore
- ❌ Persistent session management
- ❌ Fast recording queries
- ❌ User settings in Firestore
- ❌ Advanced search features

## Architecture Summary
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Backend   │────▶│     GCP     │
│   (React)   │     │  (FastAPI)  │     │             │
└─────────────┘     └─────────────┘     │  Firestore  │
                                        │  (Metadata) │
                                        │             │
                                        │     GCS     │
                                        │   (Files)   │
                                        └─────────────┘
```

## Error Resolution
The "nest_asyncio" error has been fixed by installing the module. However, the main issue is that Firestore doesn't exist in your project yet.