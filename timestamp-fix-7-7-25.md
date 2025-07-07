# Timestamp Fix - July 7, 2025

## Issue Description
The sidebar was incorrectly showing recordings from previous days as "Today" due to unstable date grouping logic that had complex timezone handling and mixed date sources.

## Root Cause
- Complex session ID parsing with different logic for pre/post June 26, 2025 dates
- Mixing backend dates with session ID timestamps
- Incorrect UTC/local date conversions causing timezone boundary issues
- `toDateString()` comparison method was unreliable across timezones

## Solution Implemented
Completely rewrote the `groupRecordingsByDate` function in `Sidebar.jsx` to:

1. **Use single source of truth**: Only backend date field, removed session ID parsing
2. **Stable timezone handling**: Compare dates at midnight in local timezone using `getTime()`
3. **Simplified logic**: Clear, maintainable date comparison without complex conditionals
4. **Cleanup**: Removed unused imports and functions

## Code Changes
- **File**: `my-vite-react-app/src/components/Sidebar.jsx`
- **Lines**: 133-182 (groupRecordingsByDate function)
- **Removed**: `parseSessionIdTime` import, unused `formatTime` function, debug logging

## New Date Grouping Logic
```javascript
const groupRecordingsByDate = (recordings) => {
  const groups = {};
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  recordings.forEach(recording => {
    const recordingDate = new Date(recording.date);
    if (!recordingDate || isNaN(recordingDate.getTime())) return;
    
    // Get date at midnight in local timezone for comparison
    const recordingDay = new Date(
      recordingDate.getFullYear(),
      recordingDate.getMonth(),
      recordingDate.getDate()
    );
    
    let groupKey;
    if (recordingDay.getTime() === today.getTime()) {
      groupKey = 'Today';
    } else if (recordingDay.getTime() === yesterday.getTime()) {
      groupKey = 'Yesterday';
    } else {
      // Format appropriately based on year
      const isThisYear = recordingDate.getFullYear() === now.getFullYear();
      groupKey = recordingDate.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        ...(isThisYear ? {} : { year: 'numeric' })
      });
    }
    
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(recording);
  });
  
  return groups;
};
```

## Benefits
- **Stability**: No more incorrect "Today" grouping
- **Maintainability**: Much simpler logic, easier to debug
- **Performance**: Removed complex session ID parsing
- **Reliability**: Consistent behavior across all timezones
- **Cleaner code**: Removed unused functions and debug statements

## Testing
- Verified recordings from July 6, 2025 now correctly show as "Yesterday" instead of "Today"
- Date grouping works correctly across timezone boundaries
- No more complex session ID handling edge cases