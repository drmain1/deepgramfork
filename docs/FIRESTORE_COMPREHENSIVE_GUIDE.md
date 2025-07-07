# Firestore Comprehensive Guide

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Firestore Schema](#firestore-schema)
3. [Security Rules](#security-rules)
4. [Setup Instructions](#setup-instructions)
5. [Implementation Progress](#implementation-progress)
6. [API Endpoints](#api-endpoints)
7. [Code Examples](#code-examples)
8. [Migration Guide](#migration-guide)
9. [Troubleshooting](#troubleshooting)
10. [Monitoring & Compliance](#monitoring--compliance)
11. [Future Enhancements](#future-enhancements)

## Architecture Overview

### Hybrid Firestore + GCS Architecture

This medical transcription application uses a hybrid approach:
- **Firestore**: Primary database for all metadata, user settings, transcript content, and queries
- **Google Cloud Storage (GCS)**: File storage for audio recordings and large files only

### Why This Architecture?

1. **Query Performance**: Firestore provides fast, indexed queries vs scanning GCS objects
2. **Real-time Updates**: Firestore supports real-time listeners for immediate UI updates
3. **Cost Optimization**: Transcript text in Firestore, large audio files in GCS
4. **HIPAA Compliance**: Both services support encryption, audit logging, and BAA

### Data Flow

```
User → Frontend → FastAPI Backend → Firestore (metadata + transcripts)
                                  ↘ GCS (audio files only)
```

## Firestore Schema

### Collections Overview

```
firestore-root/
├── users/                    # User profiles and settings
│   └── {userId}/            # Document ID = Firebase Auth UID
├── transcripts/             # All transcript records
│   └── {sessionId}/         # Document ID = unique session ID
└── user_sessions/           # Active user sessions for HIPAA compliance
    └── {userId}/            # Document ID = Firebase Auth UID
```

### Detailed Schema

#### Users Collection

```javascript
users/{userId} {
  // Basic Information
  email: string,
  name: string,
  clinic_name: string,
  created_at: timestamp,
  updated_at: timestamp,
  
  // Settings (previously in GCS)
  custom_vocabulary: string[],
  macro_phrases: {[key: string]: string},
  transcription_profiles: object[],
  doctor_name: string,
  medical_specialty: string,
  doctor_signature: string,
  clinic_logo: string,
  include_logo_on_pdf: boolean,
  office_information: object[],
  
  // References
  logo_gcs_path: string,  // Optional: path to logo in GCS
  
  // HIPAA Compliance
  last_login: timestamp,
  email_verified: boolean
}
```

#### Transcripts Collection

```javascript
transcripts/{sessionId} {
  // Ownership & Identity
  user_id: string,          // Firebase Auth UID
  session_id: string,       // Unique session identifier
  
  // Status Tracking
  status: string,           // "processing" | "completed" | "error" | "draft"
  
  // Timestamps
  created_at: timestamp,
  updated_at: timestamp,
  completed_at: timestamp,
  
  // Recording Details
  duration_seconds: number,
  patient_name: string,
  patient_context: string,
  encounter_type: string,
  location: string,
  
  // Transcription Settings
  llm_template: string,
  llm_template_id: string,
  language: string,         // Default: "en"
  
  // Transcript Content (NEW - stored directly in Firestore)
  transcript_original: string,    // Raw transcript
  transcript_polished: string,    // AI-processed transcript
  
  // File References (Optional - for backwards compatibility)
  gcs_path_audio: string,         // Audio file in GCS
  gcs_path_original: string,      // Deprecated
  gcs_path_polished: string,      // Deprecated
  
  // Error Tracking
  error_message: string,
  processing_errors: string[]
}
```

#### User Sessions Collection

```javascript
user_sessions/{userId} {
  user_id: string,
  created_at: timestamp,
  last_activity: timestamp,
  expires_at: timestamp,
  active: boolean,
  
  // Audit Fields
  ip_address: string,
  user_agent: string,
  
  // Session End Tracking
  logged_out_at: timestamp,
  expired_at: timestamp
}
```

## Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function to check if user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Helper function to check if user owns the resource
    function isOwner(userId) {
      return request.auth != null && request.auth.uid == userId;
    }
    
    // Helper function to check if email is verified
    function isEmailVerified() {
      return request.auth != null && request.auth.token.email_verified == true;
    }
    
    // Users collection - users can only access their own data
    match /users/{userId} {
      allow read: if isOwner(userId);
      allow write: if isOwner(userId) && isEmailVerified();
      allow create: if isOwner(userId);
    }
    
    // Transcripts collection - users can only access their own transcripts
    match /transcripts/{transcriptId} {
      allow read: if isAuthenticated() && 
        (resource.data.user_id == request.auth.uid);
      allow create: if isAuthenticated() && 
        request.resource.data.user_id == request.auth.uid;
      allow update: if isAuthenticated() && 
        resource.data.user_id == request.auth.uid &&
        request.resource.data.user_id == request.auth.uid; // Prevent changing ownership
      allow delete: if isAuthenticated() && 
        resource.data.user_id == request.auth.uid;
    }
    
    // User sessions collection - for session management
    match /user_sessions/{userId} {
      allow read: if isOwner(userId);
      allow write: if isOwner(userId);
    }
    
    // Deny all other access
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## Setup Instructions

### Prerequisites
- Google Cloud Project with billing enabled
- Firebase project linked to GCP project
- `gcloud` CLI installed and authenticated
- Firebase Admin SDK service account

### Console Setup (Recommended)

1. **Enable Firestore**:
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Select your project → Firestore Database → Create Database
   - Choose production mode and your region

2. **Create Indexes**:
   ```
   Collection: transcripts
   Fields: user_id (Ascending), created_at (Descending)
   ```

3. **Apply Security Rules**:
   - Copy the rules from the Security Rules section above
   - Paste in Firestore → Rules tab → Publish

### CLI Setup

```bash
# Enable Firestore API
gcloud services enable firestore.googleapis.com

# Create Firestore database (if not exists)
gcloud firestore databases create --location=us-central1

# Deploy security rules
firebase deploy --only firestore:rules

# Create composite index for transcripts
gcloud firestore indexes composite create \
  --collection-group=transcripts \
  --field-config=field-path=user_id,order=ASCENDING \
  --field-config=field-path=created_at,order=DESCENDING
```

### Backend Configuration

1. **Install Dependencies**:
   ```bash
   pip install google-cloud-firestore firebase-admin
   ```

2. **Environment Variables**:
   ```bash
   GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
   GCP_PROJECT_ID=your-project-id
   ```

## Implementation Progress

### Completed Features

#### 1. Session Management Fix
- **Problem**: `AttributeError: 'FirestoreSessionManager' object has no attribute 'create_session'`
- **Solution**: Added `create_session` method to `FirestoreSessionManager`
- **Files Modified**: `firestore_session_manager.py`, `FirebaseAuthContext.jsx`

#### 2. Settings Persistence Fix
- **Problem**: Settings not persisting after save
- **Root Cause**: `UserSettingsContext.jsx` was replacing settings with API response
- **Solution**: Changed `setUserSettings(savedData)` to `setUserSettings(newSettings)`

#### 3. Transcript Content Storage
- **Problem**: Transcripts showing as blank (length: 0)
- **Root Cause**: Field name mismatch - frontend sends `final_transcript_text`, backend expected `transcript`
- **Solution**: Backend now accepts both field names
- **Implementation**: Transcripts stored directly in Firestore fields

### Current Issues

#### Syncing and Deletion Issues
- Complex merge logic in `recordingsStore.js`
- Potential race conditions during CRUD operations
- State management complexity between local and backend

### Recommendations
1. Simplify state management - let Firestore be single source of truth
2. Implement Firestore real-time listeners
3. Add better error handling and retry logic
4. Show loading states during operations

## API Endpoints

### Firestore-Based Endpoints

```python
# Get user recordings (with Firestore queries)
GET /api/v1/user_recordings/{user_id}
Response: List[RecordingInfo]

# Get user settings
GET /api/v1/user/{user_id}/settings
Response: UserSettings

# Update user settings  
PUT /api/v1/user/{user_id}/settings
Body: UserSettings
Response: {"message": "Settings updated successfully"}

# Save recording session
POST /api/v1/recordings/save
Body: {session_id, user_id, transcript, patient_name, ...}
Response: {"message": "Session saved", "session_id": "..."}

# Get transcript details
GET /api/v1/transcript/{user_id}/{transcript_id}
Response: {originalTranscript, polishedTranscript, ...}

# Delete recording
DELETE /api/v1/recordings/{user_id}/{recording_id}
Response: {"message": "Recording deleted successfully"}
```

## Code Examples

### Query Recent Transcripts
```python
async def get_recent_transcripts(user_id: str, days: int = 15):
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    transcripts_ref = db.collection('transcripts')
    query = transcripts_ref.where('user_id', '==', user_id)\
                          .where('created_at', '>=', cutoff_date)\
                          .order_by('created_at', direction=firestore.Query.DESCENDING)\
                          .limit(100)
    
    docs = query.stream()
    return [doc.to_dict() for doc in docs]
```

### Real-time Listener (Frontend)
```javascript
// Listen for changes to user's transcripts
const unsubscribe = firebase.firestore()
  .collection('transcripts')
  .where('user_id', '==', currentUser.uid)
  .orderBy('created_at', 'desc')
  .limit(50)
  .onSnapshot((snapshot) => {
    const transcripts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    setRecordings(transcripts);
  });
```

## Migration Guide

### Phase 1: Dual Storage (Current)
- Write to both Firestore and GCS
- Read from Firestore first, fallback to GCS
- Monitor for data consistency

### Phase 2: Firestore Primary
- Write only to Firestore for metadata/transcripts
- GCS only for audio files
- Migrate existing GCS metadata to Firestore

### Phase 3: Cleanup
- Remove GCS metadata code
- Update all queries to use Firestore
- Archive old GCS metadata files

### Migration Script Example
```python
async def migrate_gcs_to_firestore():
    """One-time migration of existing GCS metadata to Firestore"""
    
    # List all users
    for user_id in get_all_user_ids():
        # Get GCS metadata files
        metadata_files = gcs_client.list_user_metadata(user_id)
        
        for metadata_file in metadata_files:
            # Read metadata from GCS
            metadata = gcs_client.read_json(metadata_file)
            
            # Create Firestore document
            await firestore_client.create_transcript({
                'user_id': user_id,
                'session_id': metadata['session_id'],
                'patient_name': metadata.get('patient_name', 'Unknown'),
                'created_at': metadata.get('timestamp'),
                # ... map other fields
            })
```

## Troubleshooting

### Common Issues

1. **"Permission Denied" Errors**
   - Check Firebase Authentication is properly initialized
   - Verify security rules allow the operation
   - Ensure user's email is verified if required

2. **Settings Not Saving**
   - Verify frontend is keeping actual settings data, not API response
   - Check Firestore rules allow write access
   - Look for console errors in browser/backend

3. **Transcripts Not Loading**
   - Check if transcript content exists in Firestore
   - Verify API endpoint is returning correct fields
   - Look for field name mismatches

4. **Session Expired Errors**
   - Check session timeout configuration
   - Ensure session refresh logic is working
   - Verify Firestore session document exists

### Debug Commands

```bash
# Check Firestore connection
gcloud firestore operations list

# View security rules
firebase firestore:rules:get

# Test security rules
firebase emulators:start --only firestore
```

## Monitoring & Compliance

### HIPAA Compliance Checklist
- ✅ Encryption at rest (Firestore default)
- ✅ Encryption in transit (HTTPS/TLS)
- ✅ Access controls via Security Rules
- ✅ Audit logging via Cloud Audit Logs
- ✅ Session management with timeout
- ✅ BAA available from Google Cloud
- ⚠️  Implement comprehensive audit logging
- ⚠️  Add data retention policies
- ⚠️  Regular security reviews

### Monitoring Setup

1. **Enable Cloud Audit Logs**:
   ```bash
   gcloud projects add-iam-policy-binding PROJECT_ID \
     --member=serviceAccount:service-PROJECT_NUMBER@gcp-sa-firestore.iam.gserviceaccount.com \
     --role=roles/logging.logWriter
   ```

2. **Set Up Alerts**:
   - Failed authentication attempts
   - Unusual data access patterns
   - High error rates
   - Session anomalies

3. **Export Audit Logs**:
   ```bash
   gcloud logging sinks create firestore-audit-sink \
     storage.googleapis.com/AUDIT_BUCKET \
     --log-filter='resource.type="firestore_database"'
   ```

## Future Enhancements

### Short Term
1. Implement Firestore real-time listeners in frontend
2. Add retry logic for failed operations
3. Improve error messages and user feedback
4. Add loading states for all operations

### Medium Term
1. Implement full-text search using Firestore + Algolia/Elasticsearch
2. Add offline support with Firestore persistence
3. Implement batch operations for bulk updates
4. Add data export functionality

### Long Term
1. Multi-tenant support with proper data isolation
2. Advanced analytics with BigQuery integration
3. Machine learning integration for transcript insights
4. Complete migration away from GCS metadata