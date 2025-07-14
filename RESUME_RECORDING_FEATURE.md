# Resume Recording Feature Documentation

## Overview

The Resume Recording feature allows users to save their recording sessions as drafts and resume them later. This is particularly useful for long recording sessions that may need to be paused and continued at a different time. When a recording is saved as a draft, it preserves the transcript, patient details, and session metadata, allowing users to pick up exactly where they left off.

## Feature Components

### 1. Save as Draft Dialog

When users attempt to close a recording session with unsaved content, they are presented with a dialog offering three options:
- **Cancel**: Continue with the current recording
- **Discard**: Close without saving
- **Save as Draft**: Save the current transcript and session data for later resumption

### 2. Draft Storage

Drafts are stored both locally (in Zustand store) and in the backend (Firestore) with the following data:
- Session ID
- Transcript content
- Patient details
- Profile ID
- Timestamp
- Recording status (set to 'draft')

### 3. Resume Recording

Users can resume a draft recording by:
1. Selecting a draft from the recordings list
2. The RecordingView component loads with the saved transcript
3. Clicking "Resume Recording" to continue adding to the transcript

## Bug Fix: Disabled Resume Recording Button

### Issue Description
After saving a recording as draft and reloading it, the "Resume Recording" button was disabled, preventing users from continuing their recording session.

### Root Cause
The button's disabled state was checking `patientDetails` from the Zustand store, which was empty when resuming a draft. The draft's patient details were passed via `resumeData` but not being used for the button's enabled/disabled logic.

### Solution
Created an `effectivePatientDetails` variable that prioritizes draft data over store data:

```javascript
// Use resumeData patient details if available
const effectivePatientDetails = resumeData?.patientDetails || patientDetails;
```

Then updated all references throughout the component to use `effectivePatientDetails` instead of `patientDetails`.

## File Structure and Dependencies

### Core Files

#### 1. `/my-vite-react-app/src/components/RecordingView.jsx`
The main component handling recording sessions and draft resumption.

**Key Functions:**
- `handleCloseSession()`: Triggers the save draft dialog
- `handleConfirmClose(saveAsDraft)`: Handles the user's choice from the dialog
- `startRecordingProcess()`: Initiates or resumes recording

**Draft-Related State:**
```javascript
const [hasStreamedOnce, setHasStreamedOnce] = useState(!!resumeData);
const [finalTranscript, setFinalTranscript] = useState(resumeData?.savedTranscript || '');
const [sessionId, setSessionId] = useState(resumeData?.sessionId || null);
const [currentProfileId, setCurrentProfileId] = useState(resumeData?.profileId || selectedProfileId);
```

#### 2. `/my-vite-react-app/src/pages/TranscriptionPage.jsx`
Manages the overall transcription flow and handles draft selection.

**Draft Detection Logic:**
```javascript
if (selectedRecording && selectedRecording.status === 'draft') {
  const draftData = {
    patientDetails: selectedRecording.name?.replace('Draft: ', '') || patientDetails,
    savedTranscript: selectedRecording.transcript || '',
    sessionId: selectedRecording.id,
    profileId: selectedRecording.profileId || selectedProfileId
  };
  
  return (
    <RecordingView
      userSettings={userSettings}
      onClose={() => {
        selectRecording(null);
        handleCloseRecording();
      }}
      resumeData={draftData}
    />
  );
}
```

#### 3. `/my-vite-react-app/src/utils/sessionSaveUtils.js`
Contains utility functions for saving sessions and drafts.

**Key Function:**
```javascript
export const saveDraftToBackend = async ({
  sessionId,
  transcript,
  patientDetails,
  currentProfileId,
  user,
  isDictationMode,
  dateOfService,
  selectedLocation,
  accessToken,
  API_BASE_URL
}) => {
  // Saves draft to backend
  const response = await fetch(`${API_BASE_URL}/api/v1/save_draft`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      session_id: sessionId,
      transcript: transcript,
      patient_details: patientDetails,
      profile_id: currentProfileId,
      user_email: user.email,
      is_dictation_mode: isDictationMode,
      date_of_service: dateOfService,
      location: selectedLocation,
      status: 'draft'
    })
  });
};
```

#### 4. `/my-vite-react-app/src/stores/transcriptionSessionStore.js`
Zustand store managing transcription session state.

**Relevant State:**
```javascript
// Patient Information
patientDetails: '',
patientContext: '',
selectedPatientId: null,

// Recording Session State
sessionId: null,
hasStreamedOnce: false,
finalTranscript: '',
currentInterimTranscript: '',
isSessionSaved: false,
```

#### 5. `/my-vite-react-app/src/contexts/RecordingsContext.jsx`
Context providing recording management functions.

**Key Functions:**
- `updateRecording()`: Updates recording status and metadata
- `fetchUserRecordings()`: Retrieves all recordings including drafts
- `selectRecording()`: Sets the selected recording for viewing/resuming

### Backend Files

#### 1. `/backend/main.py`
FastAPI endpoint for saving drafts:

```python
@app.post("/api/v1/save_draft")
async def save_draft_endpoint(
    request: SaveDraftRequest,
    current_user: dict = Depends(get_current_user_ws)
):
    # Handles draft saving logic
```

#### 2. `/backend/firestore_endpoints.py`
Firestore integration for draft persistence:

```python
async def save_draft_firestore(
    session_id: str,
    transcript: str,
    patient_details: str,
    profile_id: str,
    user_email: str,
    is_dictation_mode: bool = False,
    date_of_service: Optional[str] = None,
    location: Optional[str] = None
) -> Dict[str, Any]:
    # Saves draft to Firestore
```

#### 3. `/backend/models.py`
Data models for draft operations:

```python
class SaveDraftRequest(BaseModel):
    session_id: str
    transcript: str
    patient_details: str
    profile_id: str
    user_email: str
    is_dictation_mode: bool = False
    date_of_service: Optional[str] = None
    location: Optional[str] = None
    status: str = 'draft'
```

### Constants and Types

#### `/my-vite-react-app/src/constants/recordingConstants.js`
```javascript
export const RECORDING_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  DRAFT: 'draft'
};
```

## Implementation Flow

### Saving a Draft

1. User clicks "Close Session" with unsaved content
2. `handleCloseSession()` detects unsaved content and shows dialog
3. User selects "Save as Draft"
4. `handleConfirmClose(true)` is called
5. Recording is updated in local store with status 'draft'
6. `saveDraftToBackend()` sends draft to backend
7. Backend saves to Firestore
8. User is returned to recordings list

### Resuming a Draft

1. User selects a draft from recordings list
2. `TranscriptionPage` detects draft status
3. Prepares `draftData` object from saved recording
4. Renders `RecordingView` with `resumeData` prop
5. `RecordingView` initializes with saved transcript and session data
6. "Resume Recording" button is enabled (using `effectivePatientDetails`)
7. User clicks "Resume Recording" to continue

## Error Handling

### Known Issues (from ERROR_HANDLING_ANALYSIS.md)

1. **Race Conditions**: Draft saving may have race conditions with WebSocket disconnection
2. **No Retry Logic**: Failed draft saves are not retried
3. **Session ID Conflicts**: Potential conflicts when resuming drafts
4. **User Feedback**: Draft save failures are logged but not always communicated to users

### Recommended Improvements

1. Implement retry logic for failed draft saves
2. Add optimistic UI updates for better user experience
3. Handle session ID conflicts when resuming
4. Improve error messaging to users
5. Add draft auto-save functionality

## Testing Considerations

### Manual Testing Steps

1. Start a new recording session
2. Add some transcript content
3. Click "Close Session"
4. Select "Save as Draft"
5. Verify draft appears in recordings list
6. Select the draft
7. Verify "Resume Recording" button is enabled
8. Click "Resume Recording" and continue adding content
9. Save the final recording

### Edge Cases to Test

1. Resuming a draft with empty patient details
2. Resuming a draft with special characters in patient name
3. Multiple draft saves of the same session
4. Network failures during draft save
5. Concurrent draft operations

## Future Enhancements

1. **Auto-save**: Periodically save drafts automatically
2. **Draft Versioning**: Keep multiple versions of drafts
3. **Draft Expiration**: Auto-delete old drafts after X days
4. **Draft Indicators**: Visual indicators for draft age and size
5. **Bulk Operations**: Select and delete multiple drafts
6. **Draft Search**: Search within draft content
7. **Draft Templates**: Save drafts as templates for repeated use

## Security Considerations

1. Drafts contain PHI and must be properly secured
2. Draft access should be limited to the creating user
3. Drafts should be encrypted at rest
4. Draft operations should be logged for audit trails
5. Implement proper session validation when resuming drafts

## Performance Considerations

1. Large transcripts may impact draft save/load performance
2. Consider pagination for users with many drafts
3. Implement lazy loading for draft content in lists
4. Use debouncing for auto-save functionality
5. Optimize Firestore queries for draft retrieval