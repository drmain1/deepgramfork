# User Timezone Feature - July 11, 2025

## Overview
Implemented a user-configurable timezone setting to permanently resolve date grouping issues in the sidebar. Users can now select their timezone once, and all dates throughout the application will be displayed consistently in their chosen timezone.

## Problem Statement
- Recordings created late in the day (Pacific Time) were showing as "Yesterday" instead of "Today"
- UTC timestamps were being converted to local browser time, causing confusion
- Date grouping was inconsistent across different user timezones
- This was a recurring issue that kept resurfacing with various fixes

## Solution
Added a timezone preference to user settings that:
1. Allows users to select their timezone once
2. Stores the preference in their user settings
3. Applies the timezone consistently across all date displays
4. Maintains UTC storage in the backend (no data migration needed)

## Implementation Details

### Backend Changes

#### File: `backend/services/user_settings_service.py`
- Added `timezone` field to `DEFAULT_USER_SETTINGS`
- Default value: `"America/Los_Angeles"`

```python
DEFAULT_USER_SETTINGS = {
    # ... existing fields ...
    "timezone": "America/Los_Angeles"  # Default to Pacific Time
}
```

### Frontend Changes

#### 1. User Settings Service
**File**: `my-vite-react-app/src/services/userSettingsService.js`
- Added `updateTimezone` method to handle timezone updates

```javascript
async updateTimezone(timezone) {
    const currentSettings = useUserSettingsStore.getState().getSettingsForAPI();
    const updatedSettings = { ...currentSettings, timezone };
    return this.saveUserSettings(updatedSettings, true);
}
```

#### 2. User Settings Hook
**File**: `my-vite-react-app/src/hooks/useUserSettings.js`
- Exposed `updateTimezone` method to components

#### 3. Timezone Data
**File**: `my-vite-react-app/src/utils/timezones.js`
- Created timezone configuration with US timezones
- Includes helper function for timezone labels

```javascript
export const timezones = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Phoenix', label: 'Mountain Time - Arizona (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'America/Puerto_Rico', label: 'Atlantic Time (AT)' },
];
```

#### 4. Timezone Utilities
**File**: `my-vite-react-app/src/utils/timezoneUtils.js`
- Created comprehensive timezone conversion utilities
- Key functions:
  - `convertToTimezone()` - Convert UTC dates to specific timezone
  - `getDateAtMidnightInTimezone()` - Get midnight in a timezone
  - `getTodayInTimezone()` - Get today's date in a timezone
  - `getYesterdayInTimezone()` - Get yesterday's date in a timezone
  - `formatDateInTimezone()` - Format dates in a specific timezone

#### 5. Settings UI
**File**: `my-vite-react-app/src/components/OfficeInformationTab.jsx`
- Added timezone selector dropdown
- Placed after Medical Specialty selector
- Auto-saves on change with debouncing
- Shows "Saving..." indicator during save

#### 6. Sidebar Date Grouping
**File**: `my-vite-react-app/src/components/Sidebar.jsx`
- Updated `groupRecordingsByDate` function to use user's timezone
- Falls back to browser timezone if user hasn't set one
- All date comparisons now happen in user's timezone

```javascript
// Use user's timezone if available, otherwise fallback to browser timezone
const userTimezone = userSettings?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

// Get today and yesterday at midnight in user's timezone
const today = getTodayInTimezone(userTimezone);
const yesterday = getYesterdayInTimezone(userTimezone);
```

## User Experience

### Setting Timezone
1. Navigate to Settings → Office Information
2. Find the "Time Zone" dropdown
3. Select your timezone from the list
4. Changes are saved automatically

### Benefits
- Consistent date display across the application
- No more "Today/Yesterday" confusion
- Works correctly for users in any timezone
- One-time setup - set it and forget it

## Technical Considerations

### Data Storage
- All timestamps continue to be stored in UTC
- No data migration required
- Timezone is only used for display purposes

### Compatibility
- Falls back to browser timezone if not set
- Compatible with existing date handling
- No breaking changes to API or data structures

### Performance
- Timezone conversions are done client-side
- Uses native JavaScript Intl API for efficiency
- Minimal performance impact

## Testing Recommendations

1. **Timezone Boundary Testing**
   - Create recordings late in the day (after 5 PM Pacific)
   - Verify they show as "Today" with Pacific timezone selected
   - Switch to Eastern timezone and verify grouping updates

2. **Different Timezone Testing**
   - Test with users in different timezones
   - Verify each user sees dates in their selected timezone
   - Confirm UTC storage remains unchanged

3. **Fallback Testing**
   - Test with no timezone selected
   - Verify browser timezone is used as fallback

## Future Enhancements

1. **Automatic Detection**
   - Could add "Detect from browser" option
   - Show current detected timezone to user

2. **International Support**
   - Add more international timezones
   - Group by regions for easier selection

3. **Time Display**
   - Apply timezone to time displays throughout app
   - Add timezone abbreviation to time displays

## Migration Notes

- Existing users will default to Pacific Time
- No action required unless they want a different timezone
- Settings are preserved across sessions