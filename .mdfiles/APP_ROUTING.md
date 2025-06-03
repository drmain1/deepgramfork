# App Routing Documentation

This document outlines the routing structure and navigation patterns for the Dictation App to prevent confusion and ensure consistent navigation behavior.

## Route Structure

The app uses React Router with the following route configuration:

```jsx
// App.jsx
<Routes>
  <Route path="/" element={<HomePage />} />
  <Route path="/transcription" element={<TranscriptionPage />} />
  <Route path="/settings" element={<SettingsPage />} />
  <Route path="/pdf-test" element={<PdfTestComponent />} />
</Routes>
```

## Route Responsibilities

### `/` - HomePage
- **Purpose**: Landing page and dashboard
- **Component**: `HomePage`
- **Functionality**:
  - Welcome message for authenticated users
  - Quick action cards (New Encounter, View Recordings)
  - Recent activity summary
  - All navigation buttons redirect to `/transcription`
- **Does NOT handle**: 
  - Recording functionality
  - Transcript viewing
  - Audio recording

### `/transcription` - TranscriptionPage
- **Purpose**: Main working area for recordings and transcripts
- **Component**: `TranscriptionPage`
- **Functionality**:
  - **Primary recording interface** (setup, recording, playback)
  - **Transcript viewing and editing** (when `selectedRecordingId` is set)
  - Handles three views:
    - `setup`: Patient details and recording setup
    - `recording`: Active recording interface
    - `TranscriptViewer`: Shows when a recording is selected from sidebar
- **Key Logic**:
  ```jsx
  // If a recording is selected from the sidebar, show the transcript viewer
  if (selectedRecordingId) {
    return <TranscriptViewer />;
  }
  ```

### `/settings` - SettingsPage
- **Purpose**: User configuration and preferences
- **Component**: `SettingsPage`
- **Functionality**:
  - User settings management
  - Transcription profiles
  - Macro phrases, custom vocabulary
  - Office information
- **Does NOT handle**: Recording or transcript viewing

## Navigation Patterns

### From Sidebar (Available on all pages)

#### Recording Selection
```jsx
// When clicking on any recording in the sidebar
onClick={() => {
  selectRecording(recording.id);
  navigate('/transcription'); // ✅ Correct - goes to TranscriptionPage
}}
```

#### New Recording
```jsx
// When clicking "New Encounter" button
onClick={() => {
  selectRecording(null); // Clear any selected recording
  navigate('/transcription'); // ✅ Correct - goes to TranscriptionPage
}}
```

#### Settings Navigation
```jsx
// When clicking "Settings" button
onClick={() => {
  navigate('/settings'); // ✅ Correct - goes to SettingsPage
}}
```

### From HomePage

#### Start New Encounter
```jsx
// All "Start Recording" actions redirect to transcription
const handleStartNewEncounter = () => {
  navigate('/transcription');
};
```

#### View Recordings
```jsx
// "View Recordings" actions redirect to transcription
const handleViewRecordings = () => {
  navigate('/transcription');
};
```

## Context and State Management

### RecordingsContext
- **selectedRecordingId**: Controls which recording is being viewed
- **selectRecording(id)**: Sets the selected recording ID
- **Key Behavior**: When `selectedRecordingId` is set, `TranscriptionPage` automatically shows `TranscriptViewer`

### Navigation Flow
1. User clicks recording in sidebar → `selectRecording(id)` + `navigate('/transcription')`
2. `TranscriptionPage` detects `selectedRecordingId` → renders `TranscriptViewer`
3. User clicks "New Encounter" → `selectRecording(null)` + `navigate('/transcription')`
4. `TranscriptionPage` detects no `selectedRecordingId` → renders setup/recording interface

## Common Issues and Solutions

### ❌ Wrong: Navigating to `/` for recordings
```jsx
// This was the bug - HomePage doesn't handle recordings
navigate('/'); // Goes to HomePage which has no transcript viewing logic
```

### ✅ Correct: Navigating to `/transcription` for recordings
```jsx
// This is correct - TranscriptionPage handles all recording functionality
navigate('/transcription');
```

### ❌ Wrong: Multiple components handling same functionality
- Don't duplicate recording logic across components
- `AudioRecorder` component was deprecated in favor of `TranscriptionPage`

### ✅ Correct: Single source of truth
- All recording/transcript functionality goes through `TranscriptionPage`
- Sidebar navigation always uses `navigate('/transcription')` for recordings

## URL Patterns and Query Parameters

### Basic Routes
- `/` - Homepage dashboard
- `/transcription` - Main working area
- `/settings` - User configuration

### Query Parameters (TranscriptionPage)
- `/transcription?view=recording` - Direct link to recording view
- `/transcription` - Default setup view

## Component Dependencies

```
App.jsx
├── Sidebar (available on all routes)
│   ├── Navigation to /transcription for recordings
│   ├── Navigation to /settings for configuration
│   └── RecordingsContext for managing selected recording
├── HomePage (/)
│   └── All actions redirect to /transcription
├── TranscriptionPage (/transcription)
│   ├── TranscriptViewer (when selectedRecordingId exists)
│   ├── SetupView (default view)
│   └── RecordingView (during active recording)
└── SettingsPage (/settings)
    └── Settings tabs and configuration
```

## Development Guidelines

1. **Recording Functionality**: Always implement in or navigate to `TranscriptionPage`
2. **Sidebar Navigation**: Always use `/transcription` for recording-related actions
3. **Context Usage**: Use `selectedRecordingId` to control transcript viewing
4. **Route Purpose**: Keep routes focused on their primary purpose
5. **Navigation Consistency**: Use the same navigation patterns across components

## Testing Navigation

To test navigation is working correctly:

1. **From HomePage**: Click "Start Recording" → should go to `/transcription`
2. **From Settings**: Click recording in sidebar → should go to `/transcription` and show transcript
3. **From Any Page**: Click "New Encounter" → should go to `/transcription` and clear selection
4. **Sidebar**: Should be consistent across all pages

## Future Routing Considerations

- Keep transcript viewing logic centralized in `TranscriptionPage`
- Consider URL parameters for deep linking to specific recordings
- Maintain clear separation between dashboard (HomePage) and working area (TranscriptionPage)
- Document any new routes or navigation patterns in this file 