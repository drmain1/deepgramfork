# Async Transcript Loading Fix Documentation

## Problem Description
After creating a recording, the transcript viewer would show "No original transcript available" until the browser was refreshed multiple times. Sometimes clicking on a transcript would cycle between showing the actual content and the error message.

## Root Cause Analysis

### The Race Condition
1. **Frontend saves recording** → Backend returns success immediately
2. **Backend processes asynchronously**:
   - Saves to Firestore with status 'processing'
   - Processes transcript with LLM (can take 5-10 seconds)
   - Updates status to 'completed' BEFORE transcript content is fully written
3. **Frontend fetches too early** → Gets a recording marked 'completed' but with empty transcript content
4. **No real-time updates** → Frontend doesn't know when processing actually finishes

### Key Issues Identified
- Backend sets status to 'completed' in `firestore_endpoints.py:349` before LLM processing
- Frontend waits arbitrary 3 seconds before fetching (not reliable)
- No WebSocket/SSE notifications for processing completion
- Transcript content checked but not status-gated properly

## Files Modified and Changes Made

### 1. Frontend State Management

#### `/my-vite-react-app/src/stores/recordingsStore.js`

**Changes in `selectRecording()` method (lines 320-347):**
```javascript
// Added check for processing status
if (recording?.status === 'processing' || recording?.status === 'saving') {
  set({ 
    selectedRecordingId: recordingId,
    originalTranscriptContent: null,
    polishedTranscriptContent: null,
    selectedTranscriptError: 'PROCESSING',
    isLoadingSelectedTranscript: false
  });
  return;
}
```

**Changes in `loadSelectedTranscript()` method (lines 390-447):**
```javascript
// Check if still processing at start
if (recording.status === 'processing' || recording.status === 'saving') {
  console.log(`[loadSelectedTranscript] Recording ${selectedRecordingId} is still processing`);
  set({ 
    selectedTranscriptError: 'PROCESSING',
    isLoadingSelectedTranscript: false 
  });
  return;
}

// After API call, check if content is actually available
if (!transcriptData.originalTranscript || transcriptData.originalTranscript === '') {
  // Transcript exists but content not ready yet
  set({
    selectedTranscriptError: 'PROCESSING',
    isLoadingSelectedTranscript: false
  });
  return;
}
```

**Also fixed lint errors:**
- Line 371: Fixed regex escape character
- Line 372: Removed unused `pathParts` variable
- Line 506: Removed unused `gcsError` parameter

### 2. Enhanced Polling Mechanism

#### `/my-vite-react-app/src/hooks/useRecordings.js`

**Updated recording status polling (lines 52-71):**
```javascript
// Poll for recordings with 'saving' or 'processing' status
useEffect(() => {
  if (!currentUser?.uid) return;

  const hasProcessingRecordings = recordings.some(rec => 
    rec.status === 'saving' || rec.status === 'processing'
  );
  if (!hasProcessingRecordings) return;

  console.log('Detected recordings with saving/processing status, setting up periodic refresh...');
  
  const intervalId = setInterval(() => {
    console.log('Checking for completed recordings...');
    fetchUserRecordings(currentUser, getToken);
  }, 3000); // Reduced to 3 seconds for better UX

  return () => {
    console.log('Clearing periodic refresh interval');
    clearInterval(intervalId);
  };
}, [recordings, currentUser, fetchUserRecordings, getToken]);
```

**Added transcript-specific polling (lines 73-95):**
```javascript
// Poll when selected transcript is processing
useEffect(() => {
  if (!currentUser?.uid || !selectedRecordingId || selectedTranscriptError !== 'PROCESSING') return;

  console.log('Selected transcript is processing, setting up polling...');
  
  const intervalId = setInterval(() => {
    console.log('Retrying to load processing transcript...');
    loadSelectedTranscript(currentUser, getToken);
  }, 3000); // Poll every 3 seconds

  // Also fetch recordings to update status
  const recordingsIntervalId = setInterval(() => {
    fetchUserRecordings(currentUser, getToken);
  }, 5000); // Poll recordings every 5 seconds

  return () => {
    console.log('Clearing transcript processing poll');
    clearInterval(intervalId);
    clearInterval(recordingsIntervalId);
  };
}, [selectedTranscriptError, selectedRecordingId, currentUser, loadSelectedTranscript, fetchUserRecordings, getToken]);
```

### 3. Recording Save Flow Updates

#### `/my-vite-react-app/src/components/RecordingView.jsx`

**Changed initial status (line 372-376):**
```javascript
// Update status to 'processing' immediately to show processing indicator
updateRecording(sessionId, { 
  status: 'processing', 
  name: `${patientDetails || 'New Note'}` 
});
```

**Updated post-save status (lines 466-476):**
```javascript
// Keep status as 'processing' until backend confirms completion
updateRecording(sessionId, {
  status: 'processing', // Keep as processing until backend confirms completion
  name: savedName,
  // Don't update date - preserve the original recording start time
  gcsPathTranscript: result.saved_paths?.original_transcript,
  gcsPathPolished: result.saved_paths?.polished_transcript,
  gcsPathAudio: result.saved_paths?.audio,
  context: patientContext,
  location: selectedLocation === '__LEAVE_OUT__' ? '' : selectedLocation,
  encounterType: encounterType
});
```

**Removed arbitrary delay (lines 484-491):**
```javascript
// Immediately fetch recordings to get initial status
if (fetchUserRecordings) {
  console.log('Fetching updated recordings after save...');
  fetchUserRecordings();
}

// The polling mechanism in useRecordings will handle checking for completion
```

### 4. UI Components (No changes needed)

#### `/my-vite-react-app/src/components/TranscriptViewer.jsx`
Already handles the 'PROCESSING' error state properly (lines 118-165) with a nice progress bar animation.

## Backend Observations

### `/backend/firestore_endpoints.py`

Key areas that contribute to the issue:
- Line 290: Sets initial status to `TranscriptStatus.PROCESSING`
- Line 349: Sets status to `TranscriptStatus.COMPLETED` before LLM processing
- Lines 369-442: LLM processing happens AFTER status is set to completed
- Line 446: Final Firestore update with transcript content

**Note:** Backend changes were not made as part of this fix. The frontend now handles the race condition gracefully.

## Dependencies and Context

### Frontend Dependencies
- **Zustand**: State management for recordings
- **React hooks**: useEffect for polling mechanisms
- **Firebase Auth**: For user authentication and token management

### Backend Dependencies
- **Firestore**: Primary storage for transcripts and metadata
- **Google Cloud Storage (GCS)**: Audio file storage (backward compatibility)
- **Vertex AI/Gemini**: LLM processing for transcript polish
- **FastAPI**: Backend framework
- **WebSocket**: For live transcription streaming (not for status updates)

### Environment Variables Required
```bash
# Frontend (.env)
VITE_API_URL=http://localhost:8000
VITE_FIREBASE_*  # Firebase configuration

# Backend (.env)
GCP_PROJECT_ID=your-project-id
DEEPGRAM_API_KEY=your-api-key
SPEECHMATICS_API_KEY=your-api-key
# Plus Firebase service account credentials
```

## How the Fix Works

1. **Immediate Status Tracking**: Recording marked as 'processing' immediately upon save
2. **Smart Polling**: Frontend polls every 3 seconds for recordings with 'processing' status
3. **Content Verification**: Even if backend says 'completed', frontend checks actual content
4. **Graceful UI**: Shows "Processing your transcript..." with animated progress bar
5. **Automatic Resolution**: Once content is available, UI updates automatically

## Testing the Fix

1. Create a new recording
2. Save the recording with an LLM template selected
3. Observe the transcript viewer shows "Processing your transcript..."
4. Wait 5-10 seconds without refreshing
5. Transcript should appear automatically when ready

## Future Improvements

### Recommended Backend Changes
1. **Proper Status Management**: Don't set 'completed' until transcript is fully processed
2. **WebSocket Notifications**: Implement real-time updates for transcript completion
3. **Firestore Real-time Listeners**: Use Firestore's built-in real-time capabilities
4. **Request Tracking**: Add request IDs to match saves with completions

### Recommended Frontend Changes
1. **Exponential Backoff**: Instead of fixed 3-second polling
2. **Maximum Retry Limits**: Prevent infinite polling
3. **Better Error States**: Distinguish between processing and actual errors
4. **Local State Persistence**: Better draft/recovery mechanisms

## Troubleshooting

### If the issue persists:
1. Check browser console for polling messages
2. Verify recording status in Firestore console
3. Check if transcript_original field has content in Firestore
4. Look for errors in backend logs during LLM processing
5. Ensure all environment variables are properly set

### Common Issues:
- **Stuck in processing**: Backend might have failed - check error_message in Firestore
- **No polling**: Ensure useRecordings hook is properly imported and used
- **Auth errors**: Token might be expired - check getToken() calls

## Code References

- Recording save: `RecordingView.jsx:350-510`
- State management: `recordingsStore.js:319-517`
- Polling logic: `useRecordings.js:52-95`
- Backend save: `firestore_endpoints.py:238-470`
- Transcript fetch: `firestore_endpoints.py:472-526`