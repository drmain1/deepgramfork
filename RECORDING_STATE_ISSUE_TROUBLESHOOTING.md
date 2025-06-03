# Recording State Issue Troubleshooting Log

## Problem Statement

**Original Issue**: When a user finishes making a recording and tries to click on that recording in the left-hand menu, it shows "Original transcript s3" error until browser refresh, then the data populates correctly.

**Additional Context**: 
- For some recordings, LLM polishing takes 10-20 seconds to complete
- Need status icon indicating recording is in process
- State synchronization issue between frontend and backend

## Root Cause Analysis

The issue was identified as a state synchronization problem where:
1. **Property Name Mismatch**: RecordingView.jsx was saving S3 paths with incorrect property names
2. **Missing Status Updates**: Recording status wasn't being updated to 'saving' immediately when save process started
3. **Inadequate State Refresh**: Frontend wasn't properly detecting when backend processing completed

## Changes Attempted (Session Date: [Current Date])

### 1. Fixed S3 Path Property Names in RecordingView.jsx
**Problem**: Backend returns paths under 'saved_paths' object, but component was using wrong property names.

**Changes Made**:
```javascript
// OLD (incorrect):
s3PathTranscript: result.original_transcript_s3_path
s3PathPolished: result.polished_transcript_s3_path

// NEW (correct):
s3PathTranscript: result.saved_paths?.original_transcript
s3PathPolished: result.saved_paths?.polished_transcript
```

### 2. Immediate Status Update to 'saving'
**Problem**: Recording status wasn't updated to 'saving' until after API call completed.

**Changes Made**:
- Added `updateRecording(sessionId, { status: 'saving' })` at start of `handleSaveSession`
- This was intended to show immediate feedback to user

### 3. Enhanced RecentRecordingItem.jsx
**Problem**: No visual indication of processing state and clicking on processing recordings caused issues.

**Changes Made**:
- Prevented clicking on recordings with 'pending' or 'saving' status
- Added pulsing animation for 'saving' status
- Improved visual indicators for different states

### 4. RecordingsContext.jsx State Management Overhaul
**Problem**: Complex logic for merging local and S3 recordings wasn't handling status transitions properly.

**Changes Made**:
- Modified merging logic to prioritize S3 data when recordings transition from 'saving' to 'saved'
- Added periodic refresh (every 5 seconds) when recordings have 'saving' status
- Added multiple useEffect hooks to detect status transitions
- Added delay before fetching transcripts to allow state propagation

### 5. Transcript Loading Logic
**Problem**: When recordings transitioned from 'saving' to 'saved', transcripts weren't automatically loaded.

**Changes Made**:
- Added dependency on `recordings` array to transcript loading useEffect
- Added separate useEffect to detect status transitions
- Added logic to clear processing error when recording becomes 'saved'

## What Went Wrong

### 1. Over-Engineering the Solution
- Added too many useEffect hooks with complex dependencies
- Created potential infinite loops and race conditions
- Made the state management logic overly complex

### 2. Merging Logic Issues
The complex merging logic between local and S3 recordings became fragile:
```javascript
// This logic became too complex and fragile
localNonSaved.forEach(localRec => {
  const s3Version = s3Map.get(localRec.id);
  if (s3Version) {
    // Complex merging logic here
  }
});
```

### 3. Multiple useEffect Dependencies
Created a web of dependencies that made the state unpredictable:
- Main useEffect with `[selectedRecordingId, recordings, fetchTranscriptContent, selectedTranscriptError]`
- Separate useEffect for status transitions
- Periodic refresh useEffect

### 4. Race Conditions
- Multiple state updates happening simultaneously
- Periodic refresh conflicting with manual updates
- Transcript fetching competing with status updates

## Lessons Learned

### 1. Keep State Management Simple
- Fewer, more focused useEffect hooks
- Clear, single responsibility for each state update
- Avoid complex merging logic

### 2. Alternative Approaches to Consider

#### Option A: Backend WebSocket for Status Updates
```javascript
// Instead of polling, use WebSocket for real-time status updates
const statusSocket = new WebSocket('/ws/recording-status');
statusSocket.onmessage = (event) => {
  const { sessionId, status, s3Paths } = JSON.parse(event.data);
  updateRecording(sessionId, { status, ...s3Paths });
};
```

#### Option B: Simplified Polling
```javascript
// Simple, targeted polling only when needed
useEffect(() => {
  if (selectedRecordingId && selectedRecordingStatus === 'saving') {
    const interval = setInterval(() => {
      checkSingleRecordingStatus(selectedRecordingId);
    }, 3000);
    return () => clearInterval(interval);
  }
}, [selectedRecordingId, selectedRecordingStatus]);
```

#### Option C: Backend-Driven Refresh
```javascript
// Let backend tell frontend when to refresh
// Backend could return 'retry-after' headers or status codes
const response = await fetch('/api/save-session');
if (response.status === 202) { // Accepted, still processing
  const retryAfter = response.headers.get('retry-after');
  setTimeout(() => refetchRecording(sessionId), retryAfter * 1000);
}
```

### 3. Debugging Strategy
- Add extensive logging for state transitions
- Use React DevTools to monitor state changes
- Test with network throttling to simulate slow responses

## Files Modified in This Session
1. `my-vite-react-app/src/components/RecordingView.jsx`
2. `my-vite-react-app/src/components/RecentRecordingItem.jsx`
3. `my-vite-react-app/src/contexts/RecordingsContext.jsx`

## Recommended Next Steps

1. **Revert to last working state**
2. **Start with minimal changes**:
   - Fix only the S3 path property names
   - Add simple status update to 'saving'
3. **Test each change incrementally**
4. **Consider simpler polling approach**
5. **Add comprehensive logging for debugging**

## Status: REVERTED
- Changes were too complex and broke existing functionality
- Need simpler, more targeted approach
- Original issue still needs resolution

---
*Created: [Current Date]*
*Status: Failed attempt, needs revision* 