# Recording Timestamp Bug - Root Cause Analysis & Fix

## Executive Summary

A critical bug in the medical transcription application caused all recordings to display the current time instead of their actual creation time. This occurred because the backend API was overwriting timestamps with `datetime.now()` when fetching recordings, rather than preserving the original recording start times.

## Bug Symptoms

- All recordings showed identical timestamps (within milliseconds) when the recordings list was loaded
- Timestamps updated to the current time with each page refresh
- Recordings from previous days incorrectly appeared under "Today"
- The bug affected both new and existing recordings

### Evidence from Console Logs
```
Recording date analysis: {name: 'Ceja, Rosa', originalDate: '2025-07-10T15:11:16.367113Z', ...}
Recording date analysis: {name: 'Johnson, Bryan', originalDate: '2025-07-10T15:11:16.367242Z', ...}
Recording date analysis: {name: 'Patient, Test', originalDate: '2025-07-10T15:11:16.367473Z', ...}
```
All timestamps differ by only microseconds - clear evidence they were assigned at fetch time.

## Root Cause Analysis

### Primary Issue: Backend Timestamp Overwriting

**Location**: `backend/firestore_endpoints.py` in `get_user_recordings_firestore()` function

```python
# Lines 81-85 (BEFORE FIX)
date_str = transcript.get('created_at', transcript.get('updated_at', ''))
try:
    date_obj = datetime.fromisoformat(date_str.replace('Z', '+00:00')) if date_str else datetime.now(timezone.utc)
except:
    date_obj = datetime.now(timezone.utc)  # ← BUG: Always falls back to current time
```

The backend was using `datetime.now(timezone.utc)` as a fallback when:
1. The `created_at` field was missing or empty in Firestore
2. The date parsing failed for any reason

### Secondary Issue: Missing Recording Start Time on Save

**Location**: `backend/firestore_endpoints.py` in `save_session_data_firestore()` function

```python
# Line 247 (BEFORE FIX)
created_at = datetime.now(timezone.utc)  # ← BUG: Ignores actual recording start time
```

The backend was not accepting or using the `recording_start_time` sent by the frontend, always using the current time instead.

### Contributing Factor: Missing Model Field

**Location**: `backend/models.py`

The `SaveSessionRequest` model didn't include a `recording_start_time` field, so the backend couldn't receive this data even though the frontend was sending it.

## Dependency Chain

### Frontend → Backend Data Flow

1. **Frontend captures recording start time** (`RecordingView.jsx`):
   - Stored in Zustand store as `recordingStartTime`
   - Set when recording session starts

2. **Frontend sends timestamp in save payload** (`sessionSaveUtils.js`):
   ```javascript
   recording_start_time: recordingStartTime ? new Date(recordingStartTime).toISOString() : new Date().toISOString()
   ```

3. **Backend receives but ignores the timestamp** ❌:
   - Model didn't have the field
   - Save function used `datetime.now()` instead

4. **Backend returns current time when fetching** ❌:
   - Missing/invalid `created_at` in Firestore
   - Fallback to `datetime.now()` for all records

## The Fix

### 1. Backend Model Updates (`models.py`)

Added `recording_start_time` field to accept frontend data:

```python
class SaveSessionRequest(BaseModel):
    # ... existing fields ...
    recording_start_time: Optional[str] = None  # ← NEW

class SaveDraftRequest(BaseModel):
    # ... existing fields ...
    recording_start_time: Optional[str] = None  # ← NEW
```

### 2. Backend Save Function Updates (`firestore_endpoints.py`)

Updated `save_session_data_firestore()` to use the provided timestamp:

```python
# Use recording_start_time if provided
recording_start_time = request_data.get('recording_start_time')

if recording_start_time:
    created_at = datetime.fromisoformat(recording_start_time.replace('Z', '+00:00'))
    logger.info(f"Using recording_start_time from frontend: {created_at.isoformat()}")
else:
    created_at = datetime.now(timezone.utc)  # Fallback only if not provided
```

### 3. Backend Fetch Function Updates (`firestore_endpoints.py`)

Improved `get_user_recordings_firestore()` to handle missing timestamps gracefully:

```python
# Try to parse timestamp from session_id if created_at is missing
if not date_str and transcript.get('session_id'):
    session_id = transcript.get('session_id')
    if len(session_id) >= 14 and session_id[:14].isdigit():
        try:
            # Session ID format: YYYYMMDDHHMMSSxxxxxx
            date_obj = datetime.strptime(session_id[:14], "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)
            logger.info(f"Parsed date from session_id {session_id}: {date_obj}")
        except ValueError:
            date_obj = datetime.now(timezone.utc)
```

### 4. Frontend Draft Save Updates

Updated `saveDraftToBackend()` to include recording start time:

```javascript
body: JSON.stringify({
    // ... existing fields ...
    recording_start_time: recordingStartTime ? new Date(recordingStartTime).toISOString() : null
})
```

## Why Existing Recordings Also Got Fixed

The fix for existing recordings works because:

1. **Session IDs contain timestamps**: Format `YYYYMMDDHHMMSSxxxxxx`
2. **Fallback parsing**: When `created_at` is missing, the code now parses the timestamp from the session ID
3. **Proper date preservation**: Once parsed, these dates are displayed correctly instead of being overwritten

## Lessons Learned

1. **Always preserve original timestamps** - Never use `datetime.now()` for historical data
2. **Validate data flow end-to-end** - The frontend was sending the correct data, but the backend wasn't receiving it
3. **Model fields must match** - Ensure API models include all fields being sent by the frontend
4. **Graceful fallbacks** - When data is missing, try to recover it from other sources (like session IDs) before falling back to defaults

## Testing Verification

To verify the fix:

1. **New recordings**: Create a recording, save it, refresh the page - timestamp should remain constant
2. **Existing recordings**: Should now show their original creation times (parsed from session IDs)
3. **Date grouping**: Recordings should appear under their correct dates, not all under "Today"

## Related Issues

This bug was exposed after removing localStorage caching (see `REMOVE_LOCALSTORAGE_AND_POLLING_PLAN.md`), which had been masking the timestamp issue by preserving dates locally.

## Files Modified

- `backend/models.py` - Added `recording_start_time` fields
- `backend/firestore_endpoints.py` - Fixed timestamp handling in save and fetch functions  
- `my-vite-react-app/src/components/RecordingView.jsx` - Updated draft save call
- `my-vite-react-app/src/utils/sessionSaveUtils.js` - Added `recording_start_time` to draft payload

## Conclusion

This bug demonstrated the importance of end-to-end data validation and proper timestamp handling. The fix ensures that recording timestamps are preserved throughout the entire data lifecycle, from creation through storage to retrieval.