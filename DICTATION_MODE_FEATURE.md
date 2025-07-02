# Dictation Mode Feature

## Overview

The Dictation Mode feature allows healthcare providers to create transcripts for patient visits that occurred in the past. This is useful for documenting encounters after the fact, such as when a provider needs to catch up on documentation or when dictating notes from memory.

## Key Features

- **Past Date Selection**: Users can select any date in the past for the service date
- **Date Preservation**: The selected date is properly stored and displayed throughout the system
- **Visual Indicators**: Clear UI indicators show when dictation mode is active
- **Template Integration**: LLM templates are instructed to use the provided service date

## User Flow

1. **Enable Dictation Mode**:
   - In SetupView, after selecting a patient, check "Dictation Mode"
   - A date picker appears requiring selection of the service date
   - Only past dates are selectable (max date is today)

2. **Recording Session**:
   - The recording view displays "[Dictation Mode - Service Date: MM/DD/YYYY]"
   - Recording proceeds normally with real-time transcription

3. **Save Process**:
   - The service date is included in the save payload
   - Backend creates the transcript with the historical date
   - The transcript appears with the correct service date in the patient's history

## Technical Implementation

### Frontend Components

#### SetupView.jsx
- **Location**: `/my-vite-react-app/src/components/SetupView.jsx`
- **Functionality**:
  - Checkbox to enable/disable dictation mode (lines 367-412)
  - Date picker with max date validation
  - Form validation ensures date is selected when mode is enabled
  - Stores state in Zustand store

#### RecordingView.jsx
- **Location**: `/my-vite-react-app/src/components/RecordingView.jsx`
- **Functionality**:
  - Retrieves `isDictationMode` and `dateOfService` from store (lines 56-57)
  - Sends date via WebSocket in initial metadata (line 225)
  - Includes date in save payload (line 319)
  - Displays date in header when active (lines 431-439)

#### TranscriptionSessionStore.js
- **Location**: `/my-vite-react-app/src/stores/transcriptionSessionStore.js`
- **State Management**:
  - `isDictationMode`: boolean flag (line 20)
  - `dateOfService`: string in YYYY-MM-DD format (line 21)
  - Auto-clears date when mode is disabled (lines 53-57)

### Utility Functions

#### sessionSaveUtils.js
- **Location**: `/my-vite-react-app/src/utils/sessionSaveUtils.js`
- **Save Logic**:
  - Includes `date_of_service` in payload only when dictation mode is active (line 48)
  - Same logic applies to draft saves (line 109)

### Backend Processing

#### deepgram_utils.py
- **WebSocket Handler**:
  - Receives `date_of_service` in initial metadata (lines 172-186)
  - Uses the date to generate appropriate session ID

#### firestore_endpoints.py
- **Save Endpoint** (`/api/save-session-data-firestore`):
  - Extracts `date_of_service` from request (line 286)
  - Special date handling to prevent timezone shifting (lines 289-315)
  - Stores date as `created_at` while preserving original time
  - Sets `is_dictation` flag for identification (line 372)
  - Includes fields in update operations (lines 408-409)

#### firestore_models.py
- **TranscriptDocument Model**:
  - `date_of_service`: Optional[str] field (line 115)
  - `is_dictation`: Optional[bool] field

### LLM Template Integration

#### chiropractic-followup-narrative.js
- Templates receive instruction to use provided date (line 10)
- Format: "Follow up treatment date: [Date of Service]"

## Data Flow

```
1. User enables dictation mode and selects date
   SetupView → Zustand Store
   
2. Recording starts with metadata
   RecordingView → WebSocket → Backend
   {
     type: 'initial_metadata',
     date_of_service: 'YYYY-MM-DD',
     ...
   }
   
3. Save transcript
   RecordingView → buildSaveSessionPayload → Backend
   {
     date_of_service: 'YYYY-MM-DD',
     ...
   }
   
4. Backend processing
   firestore_endpoints.py:
   - Parse date string
   - Create datetime with user's local time
   - Store as created_at (appears as historical date)
   - Set is_dictation flag
   
5. Display in UI
   - Transcript list shows correct historical date
   - No timezone shifting occurs
```

## Date Handling Strategy

The system uses a deliberate approach to handle historical dates:

1. **Frontend**: Sends date as YYYY-MM-DD string
2. **Backend**: 
   - Parses the date and combines with session time
   - Stores as UTC but represents user's local time
   - This prevents timezone shifting when displayed
3. **Display**: Shows the exact date selected by the user

## Dependencies

### Frontend
- React 19
- Zustand (state management)
- date-fns (date formatting)
- Material-UI (date picker component)

### Backend
- Python datetime module
- Firebase Admin SDK
- Firestore for persistence

## Configuration

No special configuration required. The feature is available to all users with patient selection capability.

## Known Limitations

1. Cannot select future dates
2. Date is required when dictation mode is enabled
3. Once saved, the service date cannot be modified
4. Time portion uses current time or session ID time

## Error Handling

- Form validation prevents submission without date
- Backend validates date format
- Fallback to session ID parsing if date parsing fails
- Clear error messages for user guidance

## Testing Considerations

1. **Date Selection**: Verify only past dates are selectable
2. **Save Process**: Confirm date is properly stored
3. **Display**: Check transcript shows correct historical date
4. **Timezone**: Ensure no date shifting occurs
5. **Update Operations**: Verify date persists through updates