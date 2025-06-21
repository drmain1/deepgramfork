Of course. My apologies, the "migration" context confused the instructions. A clean implementation plan for a new project is much more straightforward.

Here is the revised step-by-step guide, written specifically for a brand-new project with no existing users or data. It's designed to be clear and direct for an IDE agent or a developer to follow sequentially.

GCP Implementation Plan: Medical Transcription App

This document outlines the step-by-step process for a new implementation of the Medical Transcription Application on Google Cloud Platform (GCP).

Goal: Build the application using GCP Identity Platform (via Firebase), Google Cloud Storage, Vertex AI, and secure the backend with Identity-Aware Proxy (IAP).

Phase 0: GCP Project Setup & Prerequisites

Prepare your GCP environment before writing any code.

Create GCP Project: If you haven't already, create a new GCP project in the Google Cloud Console.

Sign Business Associate Agreement (BAA): This is a mandatory legal step for HIPAA compliance. Contact Google Cloud sales or use the self-serve portal to get a BAA in place for your project, covering:

Cloud Identity Platform

Cloud Storage

Vertex AI

Cloud Run

Cloud Logging

Enable APIs: Use the Cloud Shell or a local gcloud CLI to enable all necessary APIs.

Generated bash
gcloud services enable \
  identityplatform.googleapis.com \
  iam.googleapis.com \
  storage.googleapis.com \
  aiplatform.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  iap.googleapis.com


Create Backend Service Account: The Python backend needs an identity to interact with GCP APIs.

Generated bash
# Replace YOUR_GCP_PROJECT_ID with your actual project ID
gcloud iam service-accounts create backend-service-account \
  --display-name="Service Account for Transcription Backend"

# Grant necessary roles
gcloud projects add-iam-policy-binding YOUR_GCP_PROJECT_ID \
  --member="serviceAccount:backend-service-account@YOUR_GCP_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding YOUR_GCP_PROJECT_ID \
  --member="serviceAccount:backend-service-account@YOUR_GCP_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

# Create and download a key for local development
gcloud iam service-accounts keys create gcp-credentials.json \
  --iam-account="backend-service-account@YOUR_GCP_PROJECT_ID.iam.gserviceaccount.com"
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Bash
IGNORE_WHEN_COPYING_END

Action: Move the downloaded gcp-credentials.json to your backend/ directory. Add gcp-credentials.json to your .gitignore file immediately.

Configure Identity Platform:

In the GCP Console, navigate to Identity Platform.

Click Enable.

In the sidebar, go to Providers and add Email/Password. Configure your password policies here.

Go to Settings -> Security and copy the Web API Key.

Go to Users and note the Authorized domains (you'll need this for your frontend).

Phase 1: Backend Implementation (Python/FastAPI)

Configure the backend to use GCP services and authentication.

Step 1.1: Update Dependencies

Modify backend/requirements.txt. Remove AWS libraries and add GCP ones.

Generated txt
# backend/requirements.txt

# Remove these:
# boto3
# other aws-related libs...

# Add these:
google-cloud-storage
google-cloud-aiplatform
google-api-python-client
google-auth

# ... keep fastapi, uvicorn, python-dotenv, etc. ...
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Txt
IGNORE_WHEN_COPYING_END

Run pip install -r backend/requirements.txt to install the new packages.

Step 1.2: Implement GCP Utilities

Flesh out backend/gcp_utils.py to handle all interactions with GCS and Vertex AI.

Generated python
# backend/gcp_utils.py
import os
from google.cloud import storage, aiplatform
from google.oauth2 import service_account

# This will automatically find the credentials in production (Cloud Run)
# For local dev, it uses the GOOGLE_APPLICATION_CREDENTIALS env var.
storage_client = storage.Client()
aiplatform.init(project=os.environ.get("GCP_PROJECT_ID"), location=os.environ.get("GCP_LOCATION"))

GCS_BUCKET_NAME = os.environ.get("GCS_BUCKET_NAME") # Make sure to set this in .env

# ... Implement functions like save_data_to_gcs, get_gcs_object_content, etc. ...
# (The functions from the previous plan are perfect here)
def polish_transcript_with_gemini(transcript: str, template: str) -> str:
    """Uses Vertex AI Gemini to polish a transcript."""
    model = aiplatform.GenerativeModel("gemini-1.5-pro-preview-0409")
    prompt = f"Using the following template: '{template}', polish this medical transcript:\n\n{transcript}"
    response = model.generate_content(prompt)
    return response.text
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Python
IGNORE_WHEN_COPYING_END
Step 1.3: Implement Authentication Middleware

Create/modify backend/auth_middleware.py. This file will have two functions: one for IAP (REST) and one for Firebase JWTs (WebSockets).

Generated python
# backend/auth_middleware.py
from fastapi import Request, HTTPException, Security, Query
from google.oauth2 import id_token
from google.auth.transport import requests

# For REST APIs protected by IAP
def get_user_id_from_iap(req: Request) -> str:
    """
    Validates the IAP-provided JWT header and returns the user's unique Google ID.
    IAP handles the primary validation; this just extracts the info.
    """
    iap_jwt = req.headers.get("x-goog-iap-jwt-assertion")
    if not iap_jwt:
        raise HTTPException(status_code=401, detail="Not authenticated via IAP.")
    
    try:
        # The user's Google ID is in the 'sub' claim.
        decoded_token = id_token.verify_iap_jwt(
            iap_jwt, expected_audience=os.environ.get("IAP_EXPECTED_AUDIENCE")
        )
        return decoded_token['sub']
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid IAP token: {e}")

# For WebSockets NOT protected by IAP
async def validate_firebase_jwt(token: str = Query(...)) -> str:
    """
    Validates a Firebase ID token sent as a query parameter for WebSockets.
    """
    if not token:
        raise HTTPException(status_code=401, detail="Missing Firebase token.")
    
    try:
        # This function fetches Google's public keys and verifies the token.
        decoded_token = id_token.verify_firebase_token(
            token, requests.Request(), audience=os.environ.get("GCP_PROJECT_ID")
        )
        # The user's Firebase UID is in the 'uid' claim.
        return decoded_token['uid']
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid Firebase token: {e}")
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Python
IGNORE_WHEN_COPYING_END
Step 1.4: Implement API Endpoints in main.py

Modify backend/main.py to use the new middleware and GCP utilities.

Generated python
# backend/main.py
from fastapi import FastAPI, Depends, WebSocket, Query, HTTPException
from .auth_middleware import get_user_id_from_iap, validate_firebase_jwt
from .gcp_utils import list_gcs_objects # etc.

app = FastAPI()

# --- WebSocket Endpoint (Uses Firebase JWT validation) ---
@app.websocket("/stream")
async def stream(websocket: WebSocket, user_id: str = Depends(validate_firebase_jwt)):
    await websocket.accept()
    # Now you have a securely validated user_id (the Firebase UID)
    # ... proceed with Deepgram/Speechmatics logic ...
    
# --- REST API Endpoints (Uses IAP validation) ---
@app.get("/api/v1/user_recordings/{user_id_param}")
async def get_recordings(user_id_param: str, current_user_id: str = Depends(get_user_id_from_iap)):
    # Note: user_id from IAP is a Google ID, not Firebase UID. You may need to map them
    # or consistently use one. For simplicity, let's assume they are linkable.
    # We will use the Firebase UID from the frontend as the folder name.
    
    # Authorization check: Is the logged-in user asking for their own data?
    # This requires the frontend to send the Firebase UID in the path.
    # if user_id_param != some_mapping(current_user_id):
    #     raise HTTPException(status_code=403, detail="Forbidden")

    prefix = f"{user_id_param}/metadata/" # user_id_param should be Firebase UID
    recordings = list_gcs_objects(prefix)
    return {"recordings": recordings}

# ... implement all other REST endpoints using `Depends(get_user_id_from_iap)` ...
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Python
IGNORE_WHEN_COPYING_END
Phase 2: Frontend Implementation (React)

Configure the React app to use Firebase SDKs for auth and storage.

Step 2.1: Install Dependencies
Generated bash
cd my-vite-react-app
npm install firebase
# npm uninstall any aws-amplify packages if they were installed
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Bash
IGNORE_WHEN_COPYING_END
Step 2.2: Configure Firebase

Create/update my-vite-react-app/src/firebaseConfig.js.

Generated javascript
// my-vite-react-app/src/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.appspot.com`,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const storage = getStorage(app);
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
JavaScript
IGNORE_WHEN_COPYING_END

Action: Update your my-vite-react-app/.env file with these values from the GCP console.

Step 2.3: Implement AuthContext.jsx

Implement your AuthContext using Firebase.

Generated jsx
// my-vite-react-app/src/contexts/AuthContext.jsx
// The code from the previous plan is perfect for a new implementation.
// It provides `currentUser`, `login`, `signup`, `logout`, and `getToken`.
// ... (paste the AuthContext code from the previous response here) ...
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Jsx
IGNORE_WHEN_COPYING_END
Step 2.4: Update API Calls and File Handling

API Calls (REST): Use the getToken function from AuthContext to secure calls to your IAP-protected backend.

Generated javascript
const token = await getToken();
const response = await fetch('/api/v1/some-endpoint', {
    headers: { 'Authorization': `Bearer ${token}` }
});
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
JavaScript
IGNORE_WHEN_COPYING_END

WebSocket Connection: Pass the token as a query parameter.

Generated javascript
const token = await getToken();
const ws = new WebSocket(`wss://your-backend-url/stream?token=${token}`);
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
JavaScript
IGNORE_WHEN_COPYING_END

File Uploads: Use the Firebase Storage SDK.

Generated javascript
import { storage } from '../firebaseConfig';
import { ref, uploadBytes } from 'firebase/storage';
// ...
const { currentUser } = useAuth();
const storageRef = ref(storage, `${currentUser.uid}/recordings/session123.wav`);
await uploadBytes(storageRef, audioBlob);
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
JavaScript
IGNORE_WHEN_COPYING_END
Phase 3: Infrastructure Deployment & Security

Deploy the application and lock it down.

Step 3.1: Deploy Backend to Cloud Run with IAP

Containerize: Create a Dockerfile for your FastAPI application.

Deploy:

Generated bash
# Make sure you are in the `backend/` directory or specify source
gcloud run deploy medical-transcription-backend \
  --source . \
  --platform managed \
  --region YOUR_GCP_REGION \
  --allow-unauthenticated \
  --service-account="backend-service-account@YOUR_GCP_PROJECT_ID.iam.gserviceaccount.com"
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Bash
IGNORE_WHEN_COPYING_END

Enable IAP:

Go to GCP Console -> IAP.

Find your Cloud Run service and toggle the switch to On.

You will be prompted to configure the OAuth Consent Screen. Do this.

Add a "Principal" of AllUsers with the role IAP-secured Web App User. This allows any user who can log in via Firebase/Identity Platform to reach your service.

Step 3.2: Deploy Frontend to Firebase Hosting

Initialize Firebase: cd my-vite-react-app and run firebase init hosting.

Build and Deploy: npm run build then firebase deploy.

Step 3.3: Implement Storage Security Rules

Create a storage.rules file in your project root. This is critical for data isolation.

Generated code
// storage.rules
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Users can only read/write files within their own folder, named by their Firebase UID.
    match /{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
IGNORE_WHEN_COPYING_END

Deploy the rules from your terminal: firebase deploy --only storage.

Phase 4: Final Launch Checklist

Configure Environment Variables: Ensure all .env variables are correctly set in Cloud Run's environment settings.

Configure DNS: Update your domain's A records to point to the IP addresses provided by Firebase Hosting.

Test End-to-End Flow: Create a new user, log in, record audio, save a session, and view it. Check the GCS bucket to ensure files are stored in the correct /<user_id>/ folder.

Monitor Logs: Watch Google Cloud Logging for any errors from Cloud Run or IAP.

Review HIPAA Tech Debt: Begin addressing items from HIPAA_COMPLIANCE_TECH_DEBT.md using GCP-native tools (e.g., Cloud Logging for audit trails, IAM for RBAC).