# Firestore Index Required

## Issue
The backend logs show a 400 error from Firestore:
```
ERROR:firestore_session_manager:Error in session cleanup: 400 The query requires an index.
```

## Solution
You need to create a composite index in Firestore for the session cleanup query.

### Option 1: Use the provided URL
The error message includes a URL to create the index directly:
https://console.firebase.google.com/v1/r/project/medlegaldoc-b31df/firestore/indexes?create_composite=Cldwcm9qZWN0cy9tZWRsZWdhbGRvYy1iMzFkZi9kYXRhYmFzZXMvKGRlZmF1bHQpL2NvbGxlY3Rpb25Hcm91cHMvdXNlcl9zZXNzaW9ucy9pbmRleGVzL18QARoKCgZhY3RpdmUQARoOCgpleHBpcmVzX2F0EAEaDAoIX19uYW1lX18QAQ

Click this link while logged into your Firebase console to automatically create the required index.

### Option 2: Manual Creation
1. Go to Firebase Console → Firestore Database → Indexes
2. Create a new composite index with:
   - Collection: `user_sessions`
   - Fields:
     - `active` (Ascending)
     - `expires_at` (Ascending)
   - Query scope: Collection

### Option 3: Using Firebase CLI
Create a `firestore.indexes.json` file:
```json
{
  "indexes": [
    {
      "collectionGroup": "user_sessions",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "active",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "expires_at",
          "order": "ASCENDING"
        }
      ]
    }
  ]
}
```

Then deploy:
```bash
firebase deploy --only firestore:indexes
```

## Note
This index is needed for the session cleanup background task that runs every 5 minutes to mark expired sessions as inactive. The application will continue to work without this index, but session cleanup won't function properly.