# Timestamp Display Tech Debt

## Issue Summary
Recording timestamps were displaying incorrectly and updating to the current time on every browser refresh. While we've fixed the refresh issue, timestamps still show incorrect times due to timezone handling complexity.

## Root Cause
1. **Session ID Generation**: Session IDs contain timestamps in the format `YYYYMMDDHHMMSSxxxxxx` where the timestamp portion represents when the recording started
2. **Timezone Mismatch**: The backend generates these timestamps in the server's local time, but various parts of the system interpret them differently
3. **Metadata Storage**: The frontend stores `lastUpdated` timestamps that were being confused with recording creation times

## Attempted Solutions
1. ✅ **Fixed browser refresh issue**: Modified frontend to parse timestamps directly from immutable session IDs instead of relying on stored metadata
2. ✅ **Improved sorting**: Recordings now sort correctly by actual recording time using parsed session IDs
3. ❌ **Timezone correction**: Attempted to standardize on UTC but this created compatibility issues with existing recordings

## Current State
- Recording times no longer change on browser refresh ✅
- Recordings sort correctly by date for the 21-day retention period ✅
- Time display removed from UI to avoid showing incorrect times ✅
- Session IDs still contain accurate timestamp information if needed in future

## Technical Implementation
The solution parses timestamps directly from session IDs in the frontend:

```javascript
// Parse timestamp from session ID (format: YYYYMMDDHHMMSSxxxxxx)
const parseSessionIdTime = (sessionId) => {
  if (!sessionId || sessionId.length < 14 || !sessionId.substring(0, 14).match(/^\d{14}$/)) {
    return null;
  }
  
  const year = sessionId.substring(0, 4);
  const month = sessionId.substring(4, 6);
  const day = sessionId.substring(6, 8);
  const hour = sessionId.substring(8, 10);
  const minute = sessionId.substring(10, 12);
  const second = sessionId.substring(12, 14);
  
  return new Date(year, month - 1, day, hour, minute, second);
};
```

## Future Improvements
1. **Standardize timezone handling**: All timestamps should be generated and stored in UTC
2. **Add timezone to session IDs**: Include timezone offset in session ID format (e.g., `YYYYMMDDHHMMSSzzxxxxxx` where `zz` is timezone offset)
3. **Store recording metadata separately**: Don't conflate sync timestamps with recording timestamps
4. **Add user timezone preference**: Allow users to set their preferred timezone for display

## Impact
- Users can reliably find recordings by date within the 21-day retention window
- Doctors can organize patient visits chronologically
- No data loss or corruption - only display issues

## Decision
Given the complexity of retrofitting timezone handling and the low priority of exact time display, we've removed the time display from the UI while maintaining correct date-based sorting. This provides the essential functionality doctors need without the confusion of incorrect times.