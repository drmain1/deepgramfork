# Timestamp Display Tech Debt

## Issue Summary
Recording timestamps were displaying incorrectly and updating to the current time on every browser refresh. While we've fixed the refresh issue, timestamps still show incorrect times due to timezone handling complexity.

**UPDATE (June 26, 2025)**: This issue has been resolved. See "Solution Implemented" section below.

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
- Timestamps now display correctly with timezone information ✅
- Session IDs are now generated in UTC for consistency ✅

## Solution Implemented (June 26, 2025)

### Backend Changes
1. **UTC Session IDs**: Modified `deepgram_utils.py` to generate session IDs using UTC:
   ```python
   session_id = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f")
   ```

2. **Consistent Timestamps**: All Firestore timestamps already use `datetime.now(timezone.utc)`, ensuring consistency

### Frontend Changes
1. **UTC Parsing**: Updated `parseSessionIdTime` in `Sidebar.jsx` to parse timestamps as UTC:
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
     
     // Handle backward compatibility
     const sessionDate = parseInt(year + month + day);
     const migrationDate = 20250626;
     
     if (sessionDate < migrationDate) {
       // Old session IDs - parse as local time
       return new Date(year, month - 1, day, hour, minute, second);
     } else {
       // New session IDs - parse as UTC
       const utcDateString = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
       return new Date(utcDateString);
     }
   };
   ```

2. **Timezone Display**: All time displays now include timezone information using `timeZoneName: 'short'`:
   - Displays show times like "2:30 PM PST" or "9:30 AM EST"
   - Users always know what timezone the time is displayed in

### Components Updated
- `Sidebar.jsx` - Time display with timezone using parseSessionIdTime
- `PatientTranscriptList.jsx` - Transcript times with timezone using parseSessionIdTime (fixed June 2025)
- `RecentRecordingItem.jsx` - Recording times with timezone
- `HomePage.jsx` - Recent activity times with timezone
- `TranscriptViewer.jsx` - Signature timestamps with timezone
- `pdfUtils.js` - PDF signature timestamps with timezone

### Implementation Details
- All components that display recording timestamps now use the `parseSessionIdTime` function
- This function extracts timestamps from session IDs (format: YYYYMMDDHHMMSSxxxxxx)
- Handles backward compatibility with a cutoff date of June 26, 2025
- Pre-cutoff session IDs are parsed as local time, post-cutoff as UTC
- Ensures consistent timestamp display across all views

## Impact
- **Multi-timezone Support**: Users in different timezones see correct local times
- **HIPAA Compliance**: Accurate timestamps prevent potential fraud issues
- **User Clarity**: Timezone indicators prevent confusion
- **Backward Compatibility**: Existing recordings display correctly

## Technical Notes
- Session IDs generated before June 26, 2025 are treated as server local time
- Session IDs generated after June 26, 2025 are treated as UTC
- All times display in the user's browser timezone with clear timezone indicators
- No data migration required - the solution handles both old and new formats

7/1/25 again same problem, easily fixed 

Fixed! The issue was that new Date(formData.date_of_birth).toISOString() was
  converting the date based on your local timezone, which could shift the date
  backward.

  The fix appends T00:00:00.000Z directly to the date string (YYYY-MM-DD
  format), ensuring it's interpreted as midnight UTC without any timezone
  conversion. This way, January 1st, 2025 will stay as January 1st, 2025
  regardless of your timezone.

  Try adding a new patient now - the date should display correctly as
  01/01/2025.

  7/2/25 

   Fixed the date timezone issue for date_of_accident
  (and date_of_birth) displays across all components.
  The problem was that dates stored as UTC midnight
  (e.g., "2025-01-01T00:00:00.000Z") were being
  converted to local timezone when displayed, which
  could shift them backward by a day.

  The fix:
  1. Created a utility function formatDateForDisplay
  that extracts the date portion and creates a local
  date object to avoid timezone shifts
  2. Updated all components that display dates to use
  this timezone-safe approach
  3. Fixed both date_of_accident and date_of_birth
  displays

  Now when you enter January 1st, 2025 as the date of
  accident, it will display as 01/01/2025 regardless of
   your timezone.
