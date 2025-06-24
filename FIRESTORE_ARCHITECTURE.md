# Firestore + GCS Architecture

## Overview
This document explains the hybrid architecture using Firestore for metadata/queries and Google Cloud Storage (GCS) for file storage.

## Architecture Design

### What Goes Where

| Data Type | Storage | Why |
|-----------|---------|-----|
| User profiles & settings | Firestore | Fast queries, real-time updates |
| Session metadata | Firestore | Searchable, sortable, filterable |
| Transcript text files | GCS | Large files, cost-effective |
| Audio files | GCS | Binary data, streaming |
| User sessions | Firestore | Fast validation, HIPAA audit trail |

### Firestore Collections

#### 1. `users` Collection
```javascript
{
  // Document ID: Firebase Auth UID
  "email": "doctor@clinic.com",
  "name": "Dr. Smith",
  "clinic_name": "Springfield Medical",
  "created_at": "2024-06-24T10:00:00Z",
  "custom_vocabulary": ["medication1", "medication2"],
  "macro_phrases": {"phrase1": "expansion1"},
  "transcription_profiles": [...],
  "last_login": "2024-06-24T15:30:00Z"
}
```

#### 2. `transcripts` Collection
```javascript
{
  // Document ID: Session ID
  "user_id": "abc123",
  "session_id": "session-xyz",
  "status": "completed", // processing, completed, error
  "created_at": "2024-06-24T14:00:00Z",
  "patient_name": "John Doe",
  "duration_seconds": 300,
  "gcs_path_original": "abc123/transcripts/original/session-xyz.txt",
  "gcs_path_polished": "abc123/transcripts/polished/session-xyz.txt"
}
```

#### 3. `user_sessions` Collection
```javascript
{
  // Document ID: Firebase Auth UID
  "user_id": "abc123",
  "created_at": "2024-06-24T10:00:00Z",
  "last_activity": "2024-06-24T15:30:00Z",
  "expires_at": "2024-06-24T15:55:00Z",
  "active": true
}
```

### Benefits of This Architecture

1. **Performance**: Firestore queries are milliseconds vs seconds for GCS scanning
2. **Scalability**: Can handle millions of transcripts efficiently
3. **Real-time**: Firestore supports real-time listeners for live updates
4. **Cost**: Large files in GCS are cheaper than Firestore storage
5. **HIPAA**: Both services are HIPAA-compliant with proper configuration

## Migration Steps

### 1. Enable Firestore in GCP Console
```bash
# Visit this URL and select "Firestore in Native mode"
https://console.cloud.google.com/datastore/setup?project=medlegaldoc-b31df
```

### 2. Install Dependencies
```bash
cd backend
pip install -r requirements.txt  # Includes google-cloud-firestore
```

### 3. Run Migration Script
```bash
# Migrate all users
python migrate_to_firestore.py

# Or migrate specific user
MIGRATE_USER_ID=abc123 python migrate_to_firestore.py
```

### 4. Update Backend Configuration
Switch from memory sessions to Firestore:
```python
# In gcp_auth_middleware.py
from firestore_session_manager import firestore_session_manager as session_manager
```

### 5. Update API Endpoints
The new Firestore-based endpoints are in `firestore_endpoints.py`. These need to be integrated into `main.py`.

## Query Examples

### Get Recent Recordings (Firestore)
```python
# Old way (GCS) - Slow
# List all files, download metadata, parse, sort

# New way (Firestore) - Fast
transcripts = firestore_client.transcripts_collection
    .where('user_id', '==', user_id)
    .where('created_at', '>=', last_week)
    .order_by('created_at', direction='DESCENDING')
    .limit(10)
    .get()
```

### Search by Patient Name
```python
# Impossible with GCS alone
# Easy with Firestore
results = firestore_client.search_transcripts(
    user_id=user_id,
    patient_name="John Doe"
)
```

## Security Considerations

1. **Firestore Security Rules**: Currently using server-side access only
2. **User Isolation**: All queries filtered by user_id
3. **Audit Logging**: All PHI access logged
4. **Session Management**: 25-minute timeout with Firestore persistence

## Next Steps

1. Complete migration of existing data
2. Update frontend to use new faster endpoints
3. Add real-time listeners for live updates
4. Implement advanced search features
5. Add data retention policies in Firestore

## Monitoring

- Firestore metrics: Console > Firestore > Usage
- Query performance: Console > Firestore > Monitoring
- Cost tracking: Console > Billing > Reports

## Rollback Plan

If issues arise:
1. Switch back to memory sessions temporarily
2. Endpoints can fall back to GCS metadata if needed
3. All original data remains in GCS unchanged