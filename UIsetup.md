# Frontend UI Setup and Component Breakdown

This document outlines the structure and key components of the `my-vite-react-app/src` directory.

## Top-Level Structure

*   **`App.css`**: Main CSS styles for the `App` component.
*   **`App.jsx`**: The root React component that sets up routing, providers, and main layout.
*   **`assets/`**: Contains static assets like images (e.g., `react.svg`).
    *   `react.svg`: React logo.
*   **`components/`**: Contains reusable UI components.
*   **`contexts/`**: Holds React Context API providers for global state management.
*   **`index.css`**: Global CSS styles, often imported into `main.jsx`.
*   **`main.jsx`**: The entry point of the React application, renders the `App` component into the DOM.
*   **`pages/`**: Components that represent entire pages/views accessible via routing.
*   **`styles.css`**: Additional global or shared styles.
*   **`theme.js`**: MUI (Material-UI) theme configuration file.
*   **`utils/`**: Utility functions and helpers.

## Component Details

### `components/` Directory

*   **`AdvancedSetupModal.jsx`**: Likely a modal component for advanced application setup or configuration options.
*   **`AudioRecorder.jsx`**: The core component for handling audio recording. It includes UI for starting/stopping recording, inputting session details (like patient name), selecting recording mode, and displaying live transcription. Uses Material-UI.
    *   **Tabbed Interface (New)**: The active recording screen now features a tabbed interface with "Transcript" and "Note" tabs.
        *   The "Transcript" tab displays the live, streaming transcription.
        *   The "Note" tab is a placeholder for the polished note that will be generated after the S3 to LLM workflow is complete.
    *   **Layout (Updated)**: The maximum width of the `AudioRecorder` component has been increased to `1200px` (from `900px`) to better utilize available screen space and reduce padding on the sides when the window is wide enough.
    *   **Manual S3 Saving**: This component now implements manual saving of session data (audio and transcript) to S3.
        *   It receives a unique `session_id` from the backend via WebSocket upon establishing a connection.
        *   After a recording is stopped, a "Save Session to S3" button becomes available.
        *   Clicking this button triggers an asynchronous function (`handleSaveSession`) that sends the `session_id` and the complete final transcript to the backend API endpoint (`POST /api/v1/save_session_data`).
        *   The backend then processes the audio (which was temporarily saved as a WAV file on the server post-recording), polishes the transcript with Bedrock, and uploads both to S3.
        *   The component displays status messages to the user (e.g., "Saving...", "Session saved successfully!", or error details) based on the backend's response.
        *   This manual save mechanism replaces the previous automatic S3 upload that occurred when the WebSocket connection closed.
*   **`CustomVocabularyTab.jsx`**: Probably a tab within a settings or configuration interface for managing custom vocabulary lists for transcription.
    *   **Data Structure Update (May 19, 2025):**
        *   The component now manages custom vocabulary internally as an array of objects, specifically `Array<{ term: string }>`, instead of an array of strings.
        *   When saving, it sends this array of objects to the backend. This aligns with the `UserSettingsData` Pydantic model in `main.py`, which expects `customVocabulary: List[Dict[str, Any]]`.
        *   This change resolved previous 422 validation errors when saving settings.
*   **`EasySetupModal.jsx`**: Likely a modal component for a simplified or guided setup process.
*   **`MacroPhrasesTab.jsx`**: Suggests a tab for managing macro phrases or text snippets, possibly for quick insertion into notes.
    *   **Data Structure Update (May 19, 2025):**
        *   Internally, macros are now managed as an array of objects: `Array<{ trigger: string, phrase: string }>`. This replaces the previous string-based format (e.g., "trigger: phrase").
        *   The component includes logic in `useEffect` to parse `initialMacroPhrases` (which could be old string-formatted data) into this new object structure.
        *   When saving, this array of objects is passed up, aligning with the backend `UserSettingsData` Pydantic model (`macroPhrases: List[Dict[str, Any]]`).
        *   This change resolved previous 422 validation errors when saving settings.
*   **`NoteStructureTab.jsx`**: Likely a tab for configuring the structure or template of generated notes.
*   **`RecentRecordingItem.jsx`**: A component to display a single item in a list of recent recordings.
*   **`SettingsTabs.jsx`**: A component that likely manages the tabbed interface within the settings page.
*   **`Sidebar.jsx`**: The main navigation sidebar for the application. **This is where the "New Session" or "Start Transcribing" button that triggers the `AudioRecorder` panel should reside.**

### `contexts/` Directory

*   **`RecordingsContext.jsx`**: Provides context related to audio recordings (e.g., list of recordings, current recording state).
*   **`TemplateContext.jsx`**: Provides context related to note templates or structures.

### `pages/` Directory

*   **`SettingsPage.jsx`**: The main component for the application's settings page, likely utilizing components like `SettingsTabs.jsx`.

### `utils/` Directory

*   **`generateLLMInstructions.js`**: A utility function, possibly for creating prompts or instructions for an LLM based on user input or settings.

## User Settings Management and Encounter Page Enhancements (May 19, 2025)

**Objective:** To centralize user settings (office locations, transcription profiles, etc.) for easier management and to integrate these settings into the encounter page for improved workflow.

### 1. `UserSettingsContext.jsx` - Centralized Settings Management

*   **Purpose:**
    *   Created a new React Context (`src/contexts/UserSettingsContext.jsx`) to serve as a single source of truth for all user-specific settings.
    *   Settings include: office information, transcription profiles, custom vocabulary, and macro phrases.
*   **Functionality:**
    *   The `UserSettingsProvider` component fetches initial settings from the backend API endpoint (`GET /api/v1/user_settings/{user_id}`) when an authenticated user's session starts.
    *   It provides the `userSettings` object and loading/error states to consuming components via the `useUserSettings` hook.
    *   It exposes specific update functions (e.g., `updateOfficeInformation`, `updateTranscriptionProfiles`, `updateCustomVocabulary`, `updateMacroPhrases`).
    *   These update functions persist changes to the backend by making a `POST` request to `/api/v1/user_settings` with the complete updated settings object.
*   **Integration:**
    *   The `UserSettingsProvider` wraps the `ProtectedApp` component in `src/main.jsx`, making user settings globally available throughout the authenticated parts of the application.

### 2. `SettingsPage.jsx` - Refactor to Use Context

*   **Purpose:** To align the main settings interface with the new centralized `UserSettingsContext`.
*   **Changes (`src/pages/SettingsPage.jsx`):
    *   Removed all local state management previously used for user settings.
    *   The page now directly consumes `userSettings`, `settingsLoading`, `settingsError`, and the context's update functions (`updateOfficeInformation`, etc.) using the `useUserSettings` hook.
    *   When users make changes in the various settings tabs (e.g., Office Information, Transcription Profiles), the save handlers now call the appropriate update functions from the context, which then handle backend synchronization.

### 3. `AudioRecorder.jsx` (Encounter Page) - New Selectors and Context Integration

*   **Purpose:** To allow clinicians to select their current office location and a preferred transcription profile directly on the encounter setup screen, using the globally available settings.
*   **Changes (`src/components/AudioRecorder.jsx`):
    *   **Context Integration:**
        *   The component now uses the `useUserSettings` hook to access `userSettings` (specifically `officeInformation` and `transcriptionProfiles`) and `settingsLoading`.
    *   **New State Variables:**
        *   `selectedLocation`: Stores the currently selected office location string.
        *   `selectedProfileId`: Stores the ID of the currently selected transcription profile.
        *   Defaults are set for these: the first office location and the first transcription profile marked as `isDefault` (or the first overall if none is default).
    *   **UI Enhancements (Encounter Setup Section):**
        *   **Location Selector:**
            *   A new Material-UI `Select` dropdown labeled "Location".
            *   Populated dynamically from `userSettings.officeInformation`.
            *   Allows selection or choosing "None / Not Specified".
        *   **Transcription Profile Selector:**
            *   A new Material-UI `Select` dropdown labeled "Transcription Profile".
            *   Populated dynamically from `userSettings.transcriptionProfiles`.
            *   Allows selection or choosing "Default / General Summary".
            *   This replaces the previous hardcoded "LLM Polishing Template" buttons.
        *   **Removed UI:** The old "Encounter Type" (In-Person/Telehealth) buttons have been commented out, as the choice of transcription profile can now imply this.
    *   **Updated Encounter Logic:**
        *   When starting a recording (`_startRecordingProcess`):
            *   The `llmPrompt` from the chosen `selectedProfileId` is used.
            *   The `selectedLocation`, the selected profile's `name`, and its `llmPrompt` are included in the metadata sent to the backend when initiating the recording session.
        *   When saving the session (`handleSaveSession`):
            *   The `selectedLocation` is included in the final session data sent for persistence.

## User Settings API - Data Structure Alignment (May 19, 2025)

The application uses backend API endpoints (`GET /api/v1/user_settings/{user_id}` and `POST /api/v1/user_settings`) defined in `main.py` to manage user settings, which are persisted in S3. The structure of the settings is defined by the `UserSettingsData` Pydantic model on the backend.

Key fields and their expected frontend data structures:
*   **`macroPhrases`**: Expected by backend as `List[Dict[str, Any]]`.
    *   Frontend (`MacroPhrasesTab.jsx`) now correctly sends data as `Array<{ trigger: string, phrase: string }>`.
*   **`customVocabulary`**: Expected by backend as `List[Dict[str, Any]]`.
    *   Frontend (`CustomVocabularyTab.jsx`) now correctly sends data as `Array<{ term: string }>`.
*   **`officeInformation`**: Expected by backend as `List[Dict[str, Any]]`.
    *   Frontend (`OfficeInformationTab.jsx`) is designed to send data as an array of objects (e.g., `Array<{ fieldName: string, fieldValue: string }>` or similar, representing key-value pairs for office details).
*   **`transcriptionProfiles`**: Expected by backend as `List[Dict[str, Any]]`.
    *   Frontend sends this as an array of profile objects (e.g., `Array<{ id: string, name: string, ...otherProfileSettings: any }>`).

These frontend data structure alignments, particularly for `macroPhrases` and `customVocabulary`, were crucial in resolving 422 Unprocessable Entity errors that occurred when the frontend sent arrays of strings instead of arrays of objects. The settings are now saved successfully via the API.

## Key Application Flow Points

*   **`main.jsx`** initializes the app and renders **`App.jsx`**.
*   **`App.jsx`** sets up:
    *   Material-UI `ThemeProvider` with the custom `theme.js`.
    *   React Router for navigation (e.g., to `SettingsPage`).
    *   `RecordingsProvider` and `TemplateProvider` for global state.
    *   The main layout including the `Sidebar.jsx`.
    *   Conditionally renders `AudioRecorder.jsx` when a new session is initiated (triggered from `Sidebar.jsx` via the `handleNewSession` prop).
*   **`Sidebar.jsx`** contains navigation links and the button to start a new recording session, which calls `handleNewSession` in `App.jsx`.
*   **`AudioRecorder.jsx`** handles microphone access, recording, and (eventually) WebSocket communication for live transcription.

## UI Flow Modifications (May 19, 2025)

**Objective:** Improve initial user experience and streamline access to settings.

1.  **Initial View Updated (`App.jsx`):
    *   The application no longer defaults to displaying the `SettingsPage` on first load.
    *   Instead, the root route (`/`) now displays a welcoming message: "Welcome to the Dictation App! Click 'New Recording' in the sidebar to start a new session, or go to 'Settings' to configure your preferences."
    *   The `SettingsPage` remains accessible via the dedicated `/settings` route.
    *   State management for `easyModalOpen` and `advancedModalOpen` (previously related to `EasySetupModal.jsx` and `AdvancedSetupModal.jsx`) has been removed from `App.jsx` as these components/modals are no longer directly triggered from the main `App` or `Sidebar` in the same way.

2.  **Sidebar Settings Access Consolidated (`components/Sidebar.jsx`):
    *   The "Easy Template Setup" and "Advanced Template Setup" buttons have been removed from the sidebar.
    *   The corresponding `EasySetupModal.jsx` and `AdvancedSetupModal.jsx` are no longer imported or directly managed by `Sidebar.jsx` (though they might still be used within `SettingsPage.jsx`).
    *   A new, single "Settings" button (MUI `Button` with `variant="contained"`) has been added to the bottom of the sidebar.
    *   This button uses `react-router-dom`'s `useNavigate` hook to navigate the user to the `/settings` page when clicked.
    *   The `Sidebar`'s main flex container in `App.jsx` was given `height: '100vh'` and styling adjustments were made to the `Sidebar.jsx` to ensure the new "Settings" button is correctly positioned at the bottom.

3.  **Macro Phrases Management Revamped (`components/MacroPhrasesTab.jsx`) (May 19, 2025):
    *   The UI for managing macro phrases within the "Settings" page has been significantly overhauled.
    *   The previous system (initially a browser `prompt()`, then a Material-UI `Dialog`) has been replaced with a more intuitive two-pane layout:
        *   **Left Pane**: Contains a "New Macro" button and a scrollable list of all existing macros. Each list item displays the macro's trigger and a preview of its phrase. Clicking an item selects it for editing.
        *   **Right Pane**: Functions as an editor. It displays input fields for the "Trigger" and the "Full Phrase" of the selected macro (or for a new macro). "Save" and "Delete" buttons are provided for managing the entry.
    *   This new interface allows for easier creation, selection, editing, and deletion of macro phrases directly within the tab, providing a more streamlined user experience inspired by common settings interfaces.

## Authentication with Auth0 (Implemented May 19, 2025)

**Objective:** Secure the entire application, requiring users to log in before accessing any features.

**Implementation Details:**

1.  **Auth0 Application Setup:**
    *   An application was created in the Auth0 dashboard.
    *   Type: Single Page Web Application.
    *   **Key Configuration in Auth0 Portal:**
        *   **Allowed Callback URLs**: Configured to `http://localhost:5173` (and any deployment URLs). This is crucial for redirecting users back to the app after login.
        *   **Allowed Logout URLs**: Configured to `http://localhost:5173` (and deployment URLs).
        *   **Allowed Web Origins**: Configured to `http://localhost:5173` (and deployment URLs).
        *   Domain and Client ID were obtained from the Auth0 application settings.

2.  **Frontend Integration (`my-vite-react-app`):**
    *   **SDK Installation:** The `@auth0/auth0-react` SDK was installed via npm/yarn.
    *   **Environment Variables:**
        *   An `.env` file was created in the root of the Vite project (`my-vite-react-app/.env`).
        *   `VITE_AUTH0_DOMAIN` and `VITE_AUTH0_CLIENT_ID` were added to this file with the values from the Auth0 dashboard.
        *   The `.env` file was added to `.gitignore` to prevent committing sensitive credentials.
    *   **`Auth0Provider` Setup (`src/main.jsx`):**
        *   The root `App` component is wrapped with `<Auth0Provider>`.
        *   The provider is configured with the `domain` and `clientId` from the environment variables.
        *   `authorizationParams.redirect_uri` is set to `window.location.origin` to redirect users to the app's root after login.
    *   **Protecting the Entire Application (`src/main.jsx`):**
        *   The `App` component is wrapped with the `withAuthenticationRequired` higher-order component (HOC) from the Auth0 SDK.
        *   A new component `AuthLoading.jsx` (`src/components/AuthLoading.jsx`) was created to display a loading indicator (Material-UI `CircularProgress`) while the SDK checks authentication status and handles redirection. This component is used as the `onRedirecting` option in `withAuthenticationRequired`.
        *   This setup ensures that no part of the application is accessible until the user successfully authenticates.
    *   **Login/Logout Components:**
        *   `LoginButton.jsx` (`src/components/LoginButton.jsx`): Uses the `useAuth0().loginWithRedirect` method to redirect users to the Auth0 Universal Login page.
        *   `LogoutButton.jsx` (`src/components/LogoutButton.jsx`): Uses the `useAuth0().logout` method with `logoutParams: { returnTo: window.location.origin }` to log users out and return them to the app's root.
    *   **Sidebar Integration (`src/components/Sidebar.jsx`):**
        *   The `useAuth0()` hook is used to get `isAuthenticated`, `isLoading`, and `user` information.
        *   Conditionally displays:
            *   A loading message if `isLoading` is true.
            *   The user's email (if available) and the `LogoutButton` if `isAuthenticated` is true.
            *   The `LoginButton` if `isAuthenticated` is false (and not loading).
        *   These UI elements are placed near the "Settings" button at the bottom of the sidebar.

**Outcome:** The entire application is now protected. Unauthenticated users attempting to access any page are automatically redirected to the Auth0 login page. After successful authentication, they are redirected back to the application and can access its features.

## UI Alignment Issue: 'Note' Tab Content (In `AudioRecorder.jsx`)

**Date:** 2025-05-15

**Problem Description:**

The content (placeholder text: "Polished note will appear here...") within the "Note" tab of the `AudioRecorder` component does not align consistently with the content in the "Transcript" tab. Specifically, the text in the "Note" tab appears vertically centered or offset from the top, while the desired behavior is for it to start flush at the top of its content area, similar to how text in the "Transcript" tab appears.

**Visual States:**

*   **Initial Problem (Centered):** Screenshot showed text in the "Note" tab vertically centered within its bordered box.
    *   *Image Ref: (User provided screenshot around Step Id 20-21)*
*   **Attempted Fix (Still Offset):** Screenshots showed text still offset from the top, even after removing centering styles. DevTools indicated the bordered `Box` itself had no top padding, but the text within it was still pushed down.
    *   *Image Ref: (User provided screenshot around Step Id 25-26, and 30)*
*   **Worse State (More Centered):** A subsequent change made the text appear even more centered, which was undesired.
    *   *Image Ref: (User provided screenshot around Step Id 44)*

**Desired State:**

The text within the "Note" tab's content area should start at the top-left, directly beneath any tabs or controls, without any unexpected vertical offset. The visual container for the note (a light gray, bordered box) should have its text content beginning at its top edge, similar to how the transcript text appears at the top of its (unbordered) container.

**Troubleshooting Attempts & Code Changes in `AudioRecorder.jsx`:**

The primary focus has been on the `TabPanel` for `index={1}` (the "Note" tab) and the `Box` and `Typography` components within it.

1.  **Initial State (Suspected Centering):** The `Box` wrapping the `Typography` in the "Note" tab had `display: 'flex', alignItems: 'center', justifyContent: 'center'`.
    *   **Action:** Removed these flex properties to prevent explicit centering.
    *   **File:** `/Users/davidmain/Desktop/trans10/my-vite-react-app/src/components/AudioRecorder.jsx`
    *   **Code Snippet (Before):**
        ```jsx
        <Box sx={{ flexGrow: 1, p: 2, backgroundColor: '#f9f9f9', borderRadius: 1, border: '1px solid #eee', minHeight: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            Polished note will appear here once generated after saving the session.
          </Typography>
        </Box>
        ```
    *   **Code Snippet (After):**
        ```jsx
        <Box sx={{ flexGrow: 1, p: 2, backgroundColor: '#f9f9f9', borderRadius: 1, border: '1px solid #eee', minHeight: '150px' }}>
          <Typography variant="body1" color="text.secondary">
            Polished note will appear here once generated after saving the session.
          </Typography>
        </Box>
        ```
    *   **Result:** Text still appeared offset from the top.

2.  **Addressing Container Padding:** The `Box` container still had `p: 2` (padding: 2).
    *   **Action:** Removed `p: 2` from the `Box` and added `sx={{ p: 2 }}` to the `Typography` component, intending for the container to have no padding but the text itself to retain spacing.
    *   **File:** `/Users/davidmain/Desktop/trans10/my-vite-react-app/src/components/AudioRecorder.jsx`
    *   **Code Snippet (Before - simplified from previous 'After'):**
        ```jsx
        <Box sx={{ flexGrow: 1, p: 2, /* other styles */ }}>
          <Typography /* ... */ >...</Typography>
        </Box>
        ```
    *   **Code Snippet (After):**
        ```jsx
        <Box sx={{ flexGrow: 1, /* other styles, no p:2 */ }}>
          <Typography sx={{ p: 2 }} /* ... */ >...</Typography>
        </Box>
        ```
    *   **Result:** Text still appeared offset from the top, indicating the `Typography`'s own padding was now causing the offset within the unpadded `Box`.

3.  **Removing All Padding from Text:** The `Typography` component had `sx={{ p: 2 }}`.
    *   **Action:** Removed `sx={{ p: 2 }}` from the `Typography` component, aiming for the text to be flush with the top-left of its container `Box` (which also had no padding at this point).
    *   **File:** `/Users/davidmain/Desktop/trans10/my-vite-react-app/src/components/AudioRecorder.jsx`
    *   **Code Snippet (Before - simplified from previous 'After'):**
        ```jsx
        <Box sx={{ flexGrow: 1, /* other styles */ }}>
          <Typography sx={{ p: 2 }} /* ... */ >...</Typography>
        </Box>
        ```
    *   **Code Snippet (After):**
        ```jsx
        <Box sx={{ flexGrow: 1, /* other styles */ }}>
          <Typography /* ... */ >...</Typography> {/* No sx={{ p: 2 }} */}
        </Box>
        ```
    *   **Result:** User reported text still not aligned to the top.

4.  **Investigating `TabPanel` and Flex Properties:** Viewed the `AudioRecorder.TabPanel` definition, which wraps children in a `Box sx={{ p: 0, flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}`.
    *   **Action:** Modified the "Note" tab's content `Box` to remove `flexGrow: 1` (as parent handles it) and add `alignSelf: 'flex-start'` and `width: '100%'`.
    *   **File:** `/Users/davidmain/Desktop/trans10/my-vite-react-app/src/components/AudioRecorder.jsx`
    *   **Code Snippet (Before - simplified from previous 'After'):**
        ```jsx
        <Box sx={{ flexGrow: 1, backgroundColor: '#f9f9f9', borderRadius: 1, border: '1px solid #eee', minHeight: '150px' }}>
          <Typography /* ... */ >...</Typography>
        </Box>
        ```
    *   **Code Snippet (After):**
        ```jsx
        <Box sx={{ alignSelf: 'flex-start', backgroundColor: '#f9f9f9', borderRadius: 1, border: '1px solid #eee', minHeight: '150px', width: '100%' }}>
          <Typography /* ... */ >...</Typography>
        </Box>
        ```
    *   **Result:** User reported this made the alignment *worse*, with the text appearing more centered.

5.  **Reverting Last Change:** The change in step 4 was detrimental.
    *   **Action:** Reverted the `Box` in the "Note" tab to its state at the end of step 3 (i.e., `flexGrow: 1`, no `alignSelf`, no `width: '100%'`).
    *   **File:** `/Users/davidmain/Desktop/trans10/my-vite-react-app/src/components/AudioRecorder.jsx`
    *   **Current State of Note Tab's inner Box and Typography (as of this documentation point):**
        ```jsx
        // Inside TabPanel for index={1}
        <Box 
          sx={{
            flexGrow: 1, 
            backgroundColor: '#f9f9f9', 
            borderRadius: 1,
            border: '1px solid #eee',
            minHeight: '150px'
            // No explicit padding on this Box
          }}
        >
          <Typography variant="body1" color="text.secondary"> 
            {/* No explicit padding on this Typography */}
            Polished note will appear here once generated after saving the session.
          </Typography>
        </Box>
        ```

**Next Steps / Possible Causes:**

*   **Inspect `TabPanel` deeply:** The `TabPanel` itself, or its internal `Box`, might have styles that are still affecting the vertical alignment of its children, despite the `p:0` on its direct child `Box`.
*   **MUI Default Styles:** Default styles for `TabPanel` or nested `Box` components in Material-UI might be playing a role if not fully overridden.
*   **CSS Specificity:** An external CSS rule or a less specific style within the component might be taking precedence.
*   **Browser DevTools:** Further detailed inspection using browser developer tools is needed, focusing on the computed layout of the `Typography` element and all its parent containers up to the `TabPanel` root. Check for margins, paddings, or flexbox/grid properties that could be causing the offset.

## UI Refinement: 'Setup New Encounter' View & Default Route (May 19, 2025 - PM Session)

**Objective:** Restructure the application's home page to directly feature the "Setup New Encounter" functionality, removing intermediate welcome screens. Refine the UI of this setup page to be less "boxed-in", more spacious, and visually aligned with a cleaner design aesthetic provided by the user.

**Key Changes:**

1.  **Default Route to Encounter Setup (`App.jsx`):**
    *   The root route (`/`) now directly renders the `AudioRecorder` component (the "Setup New Encounter" view) instead of a welcome message or other intermediate page.
    *   The `showAudioRecorderPanel` state and `handleNewSession` logic in `App.jsx` were removed, as the `AudioRecorder` is always rendered on `/`.

2.  **Sidebar Navigation Update (`components/Sidebar.jsx`):**
    *   The "New Recording" button in the sidebar now directly navigates to the root path (`/`) using `useNavigate`, effectively taking the user to the `AudioRecorder` setup screen.
    *   The `onNewSession` prop was removed from `Sidebar.jsx`.

3.  **'AudioRecorder.jsx' - Setup View Overhaul:**
    *   **Container Styling:**
        *   The main `Box` acting as a container for the "Setup New Encounter" form had its `border`, `borderRadius`, `boxShadow`, `maxWidth` (initially '700px'), `mx: 'auto'`, and `backgroundColor` removed. This allows the form to utilize more of the available screen width and removes the "boxed-in" appearance.
        *   Padding (`p: 3`) was retained for internal spacing, and `width: '100%'` was added to ensure it spans its parent container.
    *   **Title Styling:**
        *   The title "Setup New Encounter" was changed to "Encounter".
        *   Text was changed to `variant="h4"`, `component="h1"`, aligned to the `left` (from `center`), `marginBottom` increased to `4`, and `fontWeight` set to `medium`.
    *   **Form Layout & Width:**
        *   The primary `Stack` component wrapping all form fields was given `maxWidth: '800px'` and `mx: 'auto'` to create a wider, but still centered, form area. Spacing within this stack was increased to `3`.
    *   **Subheadings Added:**
        *   "CONTEXT" subheading (`Typography variant="overline"`) was added above patient detail fields.
        *   "SETTINGS" subheading (`Typography variant="overline"`) was added above encounter type and template selection fields.
    *   **Input Field Styling:**
        *   `TextField` components (Patient Details, Patient Context) and `FormControl` for `Select` components (Encounter Type, Template) were changed to use `variant="standard"` for a cleaner, less boxed look.
        *   The "Patient Context" `TextField` now uses a `placeholder` directly instead of a `label`.
    *   **Dropdown Layout:**
        *   The `Grid items` for "Encounter Type" and "LLM Polishing Template" `FormControl`s were changed from `sm={6}` to `sm={12}`, causing them to stack vertically on all screen sizes.
    *   **Button Adjustments:**
        *   The "Cancel" button was removed from the setup view.
        *   The "Start Encounter" button was made `fullWidth`, and its padding and font size were adjusted (`px: 5, py: 1.5, minWidth: '200px', fontSize: '1rem'`) for better prominence. Its top margin was also increased.
    *   **Props Removed:** `isOpen` and `onClose` props were removed from `AudioRecorder` as it's no longer a modal/panel but a directly routed view.

4.  **'AudioRecorder.jsx' - Recording View (Tab/Note Styling from Previous Session):**
    *   **Tabs:** The bottom border of the `Tabs` component (Transcript/Note) was removed for a flatter look.
    *   **"Note" Tab Content Area:** The `Box` component rendering the content for the "Note" tab had its `backgroundColor`, `borderRadius`, and `border` styles removed to eliminate the "boxed" effect within the tab panel during the recording/transcription phase.

## Settings Page and LLM Instruction Enhancements (May 19, 2025)

**Objective**: Introduce management for user-specific LLM templates (renamed to Transcription Profiles), enhance the existing note structure configuration (renamed to Standard Templates) with more options and developer-defined base prompts, and provide users with sample views of templates.

### 1. New "Transcription Profiles" Tab

A new tab was added to the settings page to manage user-specific transcription profiles (initially named "LLM Polishing Templates").

*   **`pages/SettingsPage.jsx`**:
    *   A new MUI `<Tab>` was added with the label "Transcription Profiles".
*   **`components/SettingsTabs.jsx`**:
    *   Updated to import and conditionally render a new component `TranscriptionProfilesTab.jsx` when the corresponding tab (index 3) is active.
*   **`components/TranscriptionProfilesTab.jsx` (New File)**:
    *   Created as a placeholder for users to view and remove their saved transcription profiles. Contains a title and descriptive text for now.

### 2. "Standard Templates" Tab Enhancements (Formerly "Note Structure")

The existing "Note Structure" tab was renamed and significantly updated:

*   **`pages/SettingsPage.jsx`**:
    *   The label for the first tab was changed from "Note Structure" to "Standard Templates".
*   **`components/NoteStructureTab.jsx`**:
    *   **Renaming**: Reflects the conceptual change from just structure to overall standard templates.
    *   **Removed "Narrative" Option**: The "Narrative" radio button option was removed from the list of template structures.
    *   **Output Format Toggle**: Added a new "Output Format" section with an MUI `ToggleButtonGroup`, allowing users to select between "Paragraph" and "Bullet Points" for their notes. The `outputFormat` state (defaulting to 'paragraph') is saved as part of the template.
    *   **`handleSave` Updates**: The `template` object in `handleSave` now includes `outputFormat` and `showDiagnoses` (which was previously missing from the saved object). Console logs were added to display the generated `llmInstructions` and the `template` object for easier debugging.
    *   **Sample Note Viewing**: 
        *   Imported `getNoteSample` utility and various MUI components for dialogs (`Dialog`, `DialogTitle`, `DialogContent`, `DialogContentText`, `DialogActions`, `IconButton`, `VisibilityIcon`).
        *   Added state variables (`sampleModalOpen`, `currentSampleText`, `currentSampleTitle`) to manage the sample view dialog.
        *   "View Sample" `IconButton` (eye icon) added next to each template structure radio button (SOAP, DAP, etc.).
        *   Clicking the icon calls `handleViewSample`, which fetches the appropriate sample using `getNoteSample` (based on the selected structure and current `outputFormat`) and displays it in an MUI `Paper` component.
        *   The dialog uses a `<pre>` tag to preserve the formatting of the sample text.

### 3. LLM Instruction Generation Overhaul

The way LLM instructions are generated was significantly changed to give developers more control over base prompts while still allowing user customization.

*   **`utils/generateLLMInstructions.js`**:
    *   **Developer-Defined Base Prompts**: The function now contains pre-defined, detailed base prompts for each standard template structure (SOAP, SOAP_Combined, DAP, BIRP).
    *   **Dynamic Prompt Construction**: These base prompts are selected based on `template.structure`.
    *   **Incorporates User Settings**: Instructions for `template.outputFormat` (paragraph/bullet points) and `template.showDiagnoses` are appended to the base prompt.
    *   **User's Custom Instructions**: The text entered by the user in the "Custom Instructions" field in the UI is now *appended* to these more detailed, developer-defined base prompts (previously, user input was a more central part of a simpler prompt).
    *   **Macros and Vocabulary**: Logic for appending macro phrases and custom vocabulary was retained and slightly refined to handle different data structures (array of strings vs. array of objects).
    *   **General Guidelines**: A concluding set of general guidelines for the LLM (accuracy, conciseness, professionalism) is added.

### 4. New Utility for Note Samples

*   **`utils/getNoteSample.js` (New File)**:
    *   Created a new utility function `getNoteSample(templateStructure, outputFormat)`.
    *   This function returns pre-defined, static sample note text for each template structure (SOAP, DAP, etc.) in both "paragraph" and "bullet_points" formats.
    *   These samples are used by the "View Sample" feature in the `NoteStructureTab.jsx`.

### 4. Narrative Templates and Transcription Profiles Implementation (May 19, 2025)

**Objective:** To allow users to select pre-defined narrative templates based on medical specialty, view sample narratives and LLM instructions, and save these templates as personalized transcription profiles for later use. Users can also manage (delete) their saved profiles.

**Key Changes and Components:**

1.  **New "Narrative Templates" Tab:**
    *   **`pages/SettingsPage.jsx`**:
        *   A new MUI `<Tab>` with the label "Narrative Templates" was added, positioned after "Standard Templates".
    *   **`components/NarrativeTemplatesTab.jsx` (New File)**:
        *   This component was created to house the functionality for narrative templates.
        *   **Specialty Selection**: Features an MUI `Select` dropdown populated with medical specialties (Ortho Spine, Ortho Extremity, Pain Management, Chiropractic, Acupuncture, Podiatry).
        *   **Template Display**:
            *   Upon selecting a specialty, a list of available templates for that specialty is displayed as MUI `Button` components.
            *   A placeholder data structure `templatesBySpecialty` within the component holds template details (id, name, llmInstructions, sampleNarrative).
        *   **Sample Narrative Viewing**:
            *   Clicking a template button displays its `sampleNarrative` and `llmInstructions` in a styled MUI `Paper` component.
        *   **"Save to Transcription Profile" Button**:
            *   Appears when a template is selected.
            *   Triggers saving the current template's details as a new transcription profile.
            *   Provides visual feedback:
                *   "Saved!" with a checkmark icon on successful save.
                *   "Already Saved!" with a warning icon if the profile is a duplicate.
                *   Feedback message lasts for 2.5 seconds before the button reverts to its original state.
                *   The button resets immediately if a new template is selected.

2.  **Transcription Profile Management:**
    *   **State Management (`pages/SettingsPage.jsx`)**:
        *   Manages the `transcriptionProfiles` state (an array of saved profiles).
        *   `addTranscriptionProfile(profile)`: Function to add a new profile. It now returns a status (`'success'` or `'duplicate'`) instead of using `alert()`.
        *   `deleteTranscriptionProfile(profileId)`: New function to remove a profile by its ID.
        *   These state variables and functions are passed down through `SettingsTabs.jsx`.
    *   **`components/SettingsTabs.jsx`**:
        *   Updated to accept and pass `transcriptionProfiles`, `addTranscriptionProfile`, and `deleteTranscriptionProfile` props to the relevant child tabs (`NarrativeTemplatesTab` and `TranscriptionProfilesTab`).
    *   **`components/TranscriptionProfilesTab.jsx`**:
        *   Now receives `transcriptionProfiles` and `deleteTranscriptionProfile` props.
        *   **Displaying Profiles**: Lists all saved transcription profiles, showing their name and LLM instructions within individual MUI `Paper` components.
        *   **Deleting Profiles**: Each listed profile now has an MUI `IconButton` with a `DeleteIcon` to its left. Clicking this button calls `deleteTranscriptionProfile` to remove the profile from the list.
        *   Displays a message if no profiles are saved yet.

**Flow:**
1.  User navigates to Settings -> "Narrative Templates" tab.
2.  Selects a medical specialty.
3.  Chooses a template from the displayed list.
4.  Views sample narrative and LLM instructions.
5.  Clicks "Save to Transcription Profile". Button provides feedback.
6.  User navigates to Settings -> "Transcription Profiles" tab.
7.  Sees the newly saved profile in the list.
8.  Can delete any profile using the delete icon next to it.

### 5. Implementation Plan: User-Specific Data Persistence with Auth0 and S3

**Date:** May 19, 2025

**Objective:** To implement persistent storage for user-specific settings (Transcription Profiles, Macro Phrases, Custom Vocabulary) using Auth0 for authentication and AWS S3 for data storage. This will ensure settings are saved across browser sessions and are unique to each authenticated user.

**Core Technologies:**
*   **Authentication:** Auth0
*   **Data Storage:** AWS S3 (storing user data as JSON files)
*   **Backend/API Layer (Recommended):** AWS Lambda + Amazon API Gateway (to securely broker S3 access based on Auth0 authentication)
*   **Frontend:** React

**General Workflow for Each User-Specific Feature:**
1.  **Login:** User authenticates via Auth0. Frontend receives user ID (`sub` claim) and an access token.
2.  **Load Data:** On app load (after login), frontend requests user-specific data from the backend API, passing the access token.
3.  **Backend Retrieves from S3:** Backend validates token, extracts user ID, and fetches the corresponding JSON file from S3 (e.g., `s3://your-bucket/user-data/{USER_ID}/feature_data.json`).
4.  **Display Data:** Frontend receives data and populates React state.
5.  **Modify Data:** User makes changes in the UI.
6.  **Save Data:** Frontend sends the complete updated data structure for that feature to the backend API.
7.  **Backend Saves to S3:** Backend validates token, extracts user ID, and overwrites the user's JSON file in S3 with the new data.

---

**Phase 1: User Authentication Setup (Auth0)**

1.  **Configure Auth0 Application:**
    *   Sign up/log in to Auth0.
    *   Create a new Application (select "Single Page Application").
    *   Note the **Domain** and **Client ID**.
    *   Configure **Allowed Callback URLs** (e.g., `http://localhost:3000/callback`, `https://your-deployed-app.com/callback`).
    *   Configure **Allowed Logout URLs** (e.g., `http://localhost:3000`, `https://your-deployed-app.com`).
    *   Configure **Allowed Web Origins** (e.g., `http://localhost:3000`, `https://your-deployed-app.com`).
    *   Configure **Allowed Origins (CORS)** if your API will be on a different domain.
2.  **Integrate Auth0 React SDK into Frontend:**
    *   Install: `npm install @auth0/auth0-react`
    *   In `main.jsx` or `App.jsx`, wrap your root component with `Auth0Provider`:
        ```javascript
        import { Auth0Provider } from '@auth0/auth0-react';

        ReactDOM.createRoot(document.getElementById('root')).render(
          <React.StrictMode>
            <Auth0Provider
              domain="YOUR_AUTH0_DOMAIN"
              clientId="YOUR_AUTH0_CLIENT_ID"
              authorizationParams={{
                redirect_uri: window.location.origin + '/callback' // Or your specific callback route
                // If you need to call an API, add audience: "YOUR_API_IDENTIFIER"
              }}
            >
              <App />
            </Auth0Provider>
          </React.StrictMode>
        );
        ```
    *   Implement Login/Logout: Use the `useAuth0` hook (`loginWithRedirect`, `logout`, `isAuthenticated`, `user`, `getAccessTokenSilently`).
    *   Create a callback route/component (e.g., `/callback`) if not using `window.location.origin` directly.

---

**Phase 2: Backend API Setup (AWS Lambda + API Gateway)**

1.  **Create S3 Bucket:**
    *   Create a new S3 bucket (e.g., `your-app-user-data`).
    *   **Crucial:** Keep it **private**. Access will be granted via Lambda IAM roles.
    *   Consider a folder structure like `user-data/{AUTH0_USER_ID}/resource.json`.
2.  **Develop Lambda Functions (Node.js example):**
    *   For each resource type (profiles, macros, vocab), you'll typically have:
        *   A `GET` function to retrieve data.
        *   A `POST` function to save/update data.
    *   **Dependencies:** `aws-sdk`.
    *   **Core Logic (for `GET` user-data):**
        *   Receive user ID (from Auth0 token validation by API Gateway or passed from it).
        *   Construct S3 key: `user-data/${userId}/feature_data.json`.
        *   Use `s3.getObject()` to fetch.
        *   Handle "NoSuchKey" errors (e.g., for new users, return empty array).
        *   Return JSON data.
    *   **Core Logic (for `POST` user-data):**
        *   Receive user ID and new JSON payload from the request body.
        *   Construct S3 key.
        *   Use `s3.putObject()` to overwrite the file with new content.
    *   **IAM Role for Lambdas:** Grant permissions to read/write to the specific S3 bucket and path.
3.  **Configure API Gateway:**
    *   Create a new REST API.
    *   **Authorizer:** Create an Auth0 JWT Authorizer to protect your endpoints. Configure it with your Auth0 domain and API audience (you'll need to define an API in Auth0 dashboard settings for this, e.g., `https://api.yourapp.com`).
    *   **Resources & Methods:**
        *   Example for Transcription Profiles:
            *   `GET /user/transcription-profiles` -> Lambda_GetProfiles
            *   `POST /user/transcription-profiles` -> Lambda_SaveProfiles
        *   (Similar endpoints for `/user/macro-phrases` and `/user/custom-vocabulary`)
    *   Enable CORS.
    *   Deploy the API. Note the API endpoint URL.
4.  **Update Auth0Provider (Frontend):**
    *   Add the `audience` (your API identifier from Auth0) and `scope` (if needed, e.g., `openid profile email read:data write:data`) to `authorizationParams` in `Auth0Provider` to allow `getAccessTokenSilently` to fetch a token for your API.

---

**Phase 3: Persisting Transcription Profiles**

1.  **Frontend (`SettingsPage.jsx`):**
    *   **State:** `transcriptionProfiles`, `setTranscriptionProfiles` (as is).
    *   **Loading Data (`useEffect`):**
        *   Use `useAuth0()` to get `isAuthenticated`, `user`, `getAccessTokenSilently`.
        *   If `isAuthenticated`, call `getAccessTokenSilently()` to get an API token.
        *   Make a `GET` request to your API Gateway endpoint (e.g., `/user/transcription-profiles`) with the token in `Authorization: Bearer <token>`.
        *   On success, `setTranscriptionProfiles` with the fetched data.
        *   Handle loading states and errors.
    *   **Saving Data (`addTranscriptionProfile`, `deleteTranscriptionProfile`):**
        *   After updating local React state, get the API token.
        *   Make a `POST` request to your API Gateway endpoint (e.g., `/user/transcription-profiles`) with the *entire updated array* of profiles in the request body and the auth token.
        *   The backend Lambda will overwrite the user's `transcription_profiles.json` in S3.
        *   Handle success/error feedback.
2.  **S3 Object:** `user-data/{AUTH0_USER_ID}/transcription_profiles.json`
    *   Content: `[{ "id": "...", "name": "...", "llmInstructions": "..." }, ...]`

---

**Phase 4: Persisting Macro Phrases (User-Specific)**

*This assumes "macro phrases" are currently, or will be, managed in a way that requires user-specific persistence. If they are global, this section would be different.*

1.  **Identify/Create UI:**
    *   Determine where users will manage their macro phrases (e.g., a new "Macro Phrases" tab in Settings).
    *   Implement state management in React for macro phrases (e.g., `macroPhrases`, `setMacroPhrases` in a relevant parent component).
2.  **Frontend Logic (similar to Transcription Profiles):**
    *   **Loading:** `useEffect` to fetch from `GET /user/macro-phrases` after login.
    *   **Saving:** Functions to add/edit/delete macros update local state, then `POST` the entire updated list to `/user/macro-phrases`.
3.  **Backend:** New Lambda functions and API Gateway endpoints for `/user/macro-phrases`.
4.  **S3 Object:** `user-data/{AUTH0_USER_ID}/macro_phrases.json`
    *   Content: e.g., `[{ "id": "unique_id", "abbreviation": "...", "expansion": "..." }, ...]` (define a suitable structure).

---

**Phase 5: Persisting Custom Vocabulary (User-Specific)**

*This assumes "custom vocabulary" is also intended to be user-specific.*

1.  **Identify/Create UI:**
    *   Determine where users will manage their custom vocabulary.
    *   Implement React state (e.g., `customVocabulary`, `setCustomVocabulary`).
2.  **Frontend Logic (similar to above):**
    *   **Loading:** `useEffect` to fetch from `GET /user/custom-vocabulary` after login.
    *   **Saving:** Functions to add/delete vocabulary update local state, then `POST` the entire updated list/array to `/user/custom-vocabulary`.
3.  **Backend:** New Lambda functions and API Gateway endpoints for `/user/custom-vocabulary`.
4.  **S3 Object:** `user-data/{AUTH0_USER_ID}/custom_vocabulary.json`
    *   Content: e.g., `["word1", "custom phrase 2", ...]` (a simple array of strings might suffice, or objects if more detail is needed per term).

---

**Important Considerations:**

*   **Error Handling:** Implement comprehensive error handling on the frontend (network issues, unauthorized, server errors) and backend. Provide user feedback.
*   **Loading States:** Show loading indicators in the UI while data is being fetched or saved.
*   **Data Overwriting Strategy:** The plan above uses a full overwrite for simplicity. For very large datasets or frequent small changes, a more granular update strategy (if S3 were a DB) might be considered, but for JSON files, full replace is common.
*   **Initial Data for New Users:** Backend Lambdas should gracefully handle cases where a user's JSON file doesn't exist yet in S3 (e.g., on `GET`, return an empty array; on `POST`, create the file).
*   **Security:**
    *   Ensure Lambda IAM roles have least-privilege access to S3.
    *   API Gateway authorizer is critical.
    *   S3 bucket must remain private.
*   **Testing:** Thoroughly test the auth flow, data loading, saving, and edge cases (new users, errors).

## S3 Multi-Tenancy for User Data Isolation (Implemented May 19, 2025)

**Objective:** To ensure that each user's session data (audio recordings and transcripts) is stored separately and securely in the AWS S3 bucket (`deeepgramtrans1`).

**Implementation Approach:** User-specific S3 prefixes.

**Details:**

1.  **User Identification:**
    *   The frontend (`AudioRecorder.jsx`) utilizes the `useAuth0()` hook to obtain the authenticated user's unique identifier (`user.sub`).

2.  **Frontend (`AudioRecorder.jsx`):**
    *   The `handleSaveSession` function (responsible for initiating the save process) now includes the `user.sub` as `user_id` in the payload of the `POST` request to the backend endpoint `/api/v1/save_session_data`.
    *   The endpoint URL in `handleSaveSession` was also updated from `/save_session_s3` to `/api/v1/save_session_data` for consistency with the backend.

3.  **Backend (`backend/main.py`):
    *   The Pydantic request model `SaveSessionRequest` for the `/api/v1/save_session_data` endpoint was updated to include `user_id: str`, `patient_context: Optional[str]`, `encounter_type: Optional[str]`, and `llm_template: Optional[str]`. The previous `claude_custom_instructions` field was removed.
    *   The `save_session_data_endpoint` function now extracts the `user_id` from the request.
    *   This `user_id` is then passed as the `tenant_id` argument to the S3 utility functions (`save_text_to_s3`, `save_audio_file_to_s3`) located in `backend/aws_utils.py`.

4.  **S3 Utility Functions (`backend/aws_utils.py`):
    *   The `save_text_to_s3` and `save_audio_file_to_s3` functions use the provided `tenant_id` (which is the `user.sub`) to construct the S3 object key. For example:
        *   `s3_key = f"{tenant_id}/{folder}/{session_id}.txt"`
        *   `s3_key = f"{tenant_id}/{folder}/{session_id}.wav"`
    *   This ensures that files for each user are stored under a unique prefix corresponding to their `user.sub` within the `deeepgramtrans1` bucket (e.g., `s3://deeepgramtrans1/auth0|xxxxxxxxxxxx/audio/session123.wav`).

**Outcome:** Session data for different users is now segregated into user-specific "folders" (prefixes) in the S3 bucket, enhancing data organization and enabling potential future user-specific access controls.

## User-Specific Settings (Implemented May 19, 2025)

**Objective:**
Enable user-specific settings for "Macro Phrases," "Custom Vocabulary," and "Transcription Profiles" that persist across sessions and devices (initially using localStorage, with S3 planned for true cross-device).

**Key Changes:**

1.  **Centralized Settings Management (`pages/SettingsPage.jsx`):**
    *   Integrates `useAuth0` from `@auth0/auth0-react` to get the authenticated user's ID (specifically `user.sub`).
    *   Manages a unified `userSettings` state object which holds `transcriptionProfiles`, `macroPhrases`, and `customVocabulary`.
    *   On component mount (triggered when `user` object from Auth0 is available), it attempts to load these settings from `localStorage`. The key used for storage is derived from the user's ID (e.g., `userSettings-${user.sub}`).
    *   If no settings are found in `localStorage` for the user, it initializes with empty arrays for each setting type.
    *   A `settingsLoading` boolean state is managed to indicate when settings are being fetched/initialized, allowing child components to display loading indicators.
    *   Functions like `addTranscriptionProfile`, `deleteTranscriptionProfile`, and new functions `saveMacroPhrases` and `saveCustomVocabulary` now update this central `userSettings` state. After updating the state, the entire `userSettings` object is persisted back to `localStorage` under the user-specific key.

2.  **Props Drilling for Settings (`components/SettingsTabs.jsx`):**
    *   Modified to pass down the `macroPhrases` and `customVocabulary` arrays from `userSettings`, their respective save functions (`saveMacroPhrases`, `saveCustomVocabulary`), and the `settingsLoading` boolean to the `MacroPhrasesTab` and `CustomVocabularyTab` components.
    *   It also passes the `settingsLoading` prop to `TranscriptionProfilesTab`, and `NarrativeTemplatesTab` to enable them to react to the loading state.

3.  **`MacroPhrasesTab.jsx` Refactor:**
    *   Removed its previous reliance on `TemplateContext` for managing macro phrases.
    *   Now accepts `initialMacroPhrases` (from `userSettings.macroPhrases` via props), `saveMacroPhrases` (prop function from `SettingsPage`), and `settingsLoading` (prop) as props.
    *   Uses an internal `macros` state, which is initialized and updated from the `initialMacroPhrases` prop via `useEffect`.
    *   When a macro is saved or deleted, it calls the `saveMacroPhrases` prop function, passing the *entire updated array* of macros to be saved by `SettingsPage`.
    *   Displays a loading message if `settingsLoading` is true, preventing interaction until settings are loaded.

4.  **`CustomVocabularyTab.jsx` Refactor:**
    *   Removed its previous reliance on `TemplateContext`.
    *   Accepts `initialCustomVocabulary` (from `userSettings.customVocabulary` via props), `saveCustomVocabulary` (prop function from `SettingsPage`), and `settingsLoading` (prop) as props.
    *   Uses an internal `vocabulary` state, managed similarly to `MacroPhrasesTab` via `useEffect` and the `initialCustomVocabulary` prop.
    *   Added functionality to delete vocabulary items, with a delete icon next to each item in the list.
    *   When a word/phrase is added or deleted, it calls the `saveCustomVocabulary` prop function with the complete updated list.
    *   Includes logic to prevent adding duplicate entries to the vocabulary list.
    *   Displays a loading message if `settingsLoading` is true.

5.  **Loading State Handling in Other Tabs:**
    *   **`components/TranscriptionProfilesTab.jsx`**: Updated to accept the `settingsLoading` prop. It now displays a "Loading transcription profiles..." message when `settingsLoading` is true, instead of rendering the list of profiles.
    *   **`components/NarrativeTemplatesTab.jsx`**: Updated to accept the `settingsLoading` prop. The "Save to Transcription Profile" button is now disabled if `settingsLoading` is true. This prevents users from attempting to save a new profile before the existing profiles (and other settings) have been loaded, which could lead to data inconsistencies.

**Persistence Mechanism:**
*   Currently, user settings are stored in the browser's `localStorage`. Each authenticated user's settings are stored under a unique key that includes their Auth0 user ID (`user.sub`).
*   This approach ensures that settings persist across browser sessions for the *same user on the same browser and device*.
*   **Limitation**: `localStorage` is device and browser-specific. Settings will not automatically sync across different devices or browsers.
*   **Long-term Strategy**: The plan is to replace `localStorage` with a backend solution utilizing AWS S3 for storing user settings. This will involve creating backend API endpoints for fetching and saving settings, allowing them to be truly persistent and accessible across any device the user logs into.

## S3 Integration, Live Recording Status, and Data Cleanup (May 19, 2025)

**Objective:** Resolve issues with saving transcriptions to S3, provide real-time feedback on recording status in the UI, and ensure data integrity for displayed recordings.

**Implementation Details:**

1.  **S3 Save Functionality (404 Error Resolution):**
    *   **Problem:** Attempts to save session data (transcriptions, audio) to S3 via the backend endpoint (`/api/v1/save_session_data`) were resulting in 404 errors from the frontend.
    *   **Solution:** The Vite development server (`vite.config.js`) was configured to proxy API requests starting with `/api` to the backend server running on `http://localhost:8000`.
    *   **File:** `my-vite-react-app/vite.config.js`
    *   **Change:** Added a `server.proxy` object to `defineConfig`:
        ```javascript
        server: {
          proxy: {
            '/api': {
              target: 'http://localhost:8000',
              changeOrigin: true,
            },
          },
        },
        ```
    *   **Outcome:** This resolved the 404 errors, allowing the frontend to successfully communicate with the backend endpoint for saving sessions to S3.

2.  **Live Recording Status in Sidebar:**
    *   **Goal:** Display new recordings in the sidebar as "pending" immediately upon starting a session, and update their status (e.g., "saving", "saved", "failed") dynamically.
    *   **`RecordingsContext.jsx` Enhancements (`my-vite-react-app/src/contexts/RecordingsContext.jsx`):
        *   New functions `startPendingRecording`, `updateRecording`, and `removeRecording` were added to manage the lifecycle of recordings in the shared state.
        *   `startPendingRecording`: Adds a new recording with 'pending' status and a temporary name when a session starts.
        *   `updateRecording`: Updates an existing recording's status, name, and other details (like S3 paths upon successful save).
        *   `removeRecording`: Removes a recording, used if a pending session is cancelled.
    *   **`AudioRecorder.jsx` Integration (`my-vite-react-app/src/components/AudioRecorder.jsx`):
        *   Calls `startPendingRecording` from the context when a new transcription session begins.
        *   Calls `updateRecording` with 'saving' status before attempting to save, then with 'saved' (including details like formatted name, S3 paths) or 'failed' (with error message) based on the API response from `/api/v1/save_session_data`.
        *   Calls `removeRecording` if a session is stopped before any attempt to save.
    *   **`RecentRecordingItem.jsx` Enhancements (`my-vite-react-app/src/components/RecentRecordingItem.jsx`):
        *   The component was significantly updated to visually reflect the recording's `status`:
            *   **Icons:** Displays different Material-UI icons for each status (e.g., `HourglassEmptyIcon` for pending, `CloudSyncIcon` for saving, `CheckCircleOutlineIcon` for saved, `ErrorOutlineIcon` for failed).
            *   **Styling:** Applies conditional styling, including status text color and a colored left border on the list item, to make the status immediately apparent.
            *   **Text Display:** Shows a descriptive status message. For 'saved' items, it displays "Saved: [formatted date/time]".
            *   **Tooltips:** Provides detailed tooltips on hover for 'saved' recordings (showing full name, date, patient context, S3 paths, etc.) and for 'failed' recordings (showing the error message).
            *   Date formatting was improved for display.
    *   **Outcome:** The sidebar now provides immediate and clear feedback on the status of each recording throughout its lifecycle, enhancing user experience.

3.  **Filtering Old/Placeholder Recordings from `localStorage`:**
    *   **Problem:** Old or malformed recording data persisted in `localStorage` could be displayed incorrectly or cause issues.
    *   **Solution:** The initialization logic in `RecordingsProvider` (`RecordingsContext.jsx`) was updated to filter recordings loaded from `localStorage`.
    *   **File:** `my-vite-react-app/src/contexts/RecordingsContext.jsx`
    *   **Change:** Only recordings that have a string `id` starting with `session_` and a valid `status` field (e.g., 'pending', 'saving', 'saved', 'failed') are now loaded into the application state.
    *   **Outcome:** This ensures that only valid, current-format recordings are displayed, effectively cleaning up any old placeholder data from view.

## Recording Deletion Feature (Implemented May 20, 2025)

**Objective:** Allow users to delete specific recordings from the recent recordings list, which also removes the associated data from S3.

### 1. Frontend Changes (`my-vite-react-app`)

*   **`src/components/RecentRecordingItem.jsx`:**
    *   Added a delete `IconButton` (with `DeleteIcon` from Material-UI) to each recording item using `ListItemSecondaryAction`.
    *   The component now accepts an `onDelete` prop.
    *   A `handleDelete` function is triggered on icon click, which calls `onDelete(recording.id)` and stops event propagation to prevent the item itself from being clicked.

*   **`src/components/Sidebar.jsx`:**
    *   Retrieves `deletePersistedRecording` function from `useRecordings()` context.
    *   A `handleDeleteRecording(recordingId)` function was added.
        *   This function checks for user authentication.
        *   It calls `await deletePersistedRecording(recordingId)` from the context.
        *   Includes `try...catch` for error logging if the deletion fails.
    *   The `onDelete={handleDeleteRecording}` prop is passed to each `RecentRecordingItem` instance.

*   **`src/contexts/RecordingsContext.jsx`:**
    *   Imported `useAuth0` to get `getAccessTokenSilently` and `user` details.
    *   A new asynchronous function `deletePersistedRecording(sessionId)` was added:
        *   Checks if the user is authenticated.
        *   Retrieves an access token using `getAccessTokenSilently()`.
        *   Makes an authenticated `DELETE` request to the backend API endpoint: `/api/v1/recordings/{user.sub}/{sessionId}`.
        *   If the backend deletion is successful, it calls the existing local `removeRecording(sessionId)` function to update the UI by removing the item from the `recordings` state.
        *   Includes error handling and console logging for the API call and local state update process.
    *   `deletePersistedRecording` is exposed through the `RecordingsContext.Provider`.

### 2. Backend Changes (`backend/main.py`)

*   **New API Endpoint:**
    *   A `DELETE` endpoint `/api/v1/recordings/{user_id}/{session_id}` was implemented.
    *   Path parameters `user_id` and `session_id` are used to identify the recording.
*   **Deletion Logic:**
    1.  **Check Prerequisites**: Ensures `s3_client` and `AWS_S3_BUCKET_NAME` are initialized.
    2.  **Fetch Metadata**: Retrieves the `session_metadata.json` file from S3 (path: `sessions/{user_id}/{session_id}/session_metadata.json`). This metadata file contains the S3 keys for all files associated with the recording session (e.g., audio WAV, raw transcript JSON, polished note text).
    3.  **Collect File Keys**: Parses the metadata to gather all S3 object keys listed within its `s3_paths` attribute. The metadata file key itself is also added to this list for deletion.
    4.  **S3 Delete Operation**: Uses `s3_client.delete_objects()` to remove all collected S3 objects from the bucket in a single batch operation.
    5.  **Error Handling & Logging**: Robust error handling is included for:
        *   S3 client/bucket configuration issues.
        *   `NoSuchKey` errors (if metadata is not found, it assumes the recording is already deleted).
        *   JSON decoding errors if metadata is corrupt (attempts to delete the corrupt metadata file).
        *   General `ClientError` during S3 operations.
        *   Detailed logging of the process and any errors encountered.
    6.  **Response**: Returns a JSON response indicating success (including the count of deleted files) or an appropriate HTTP error status with details if the deletion failed.

### 3. User Flow for Deletion

1.  User clicks the delete icon next to a recording in the `Sidebar`'s recent recordings list.
2.  The `handleDelete` function in `RecentRecordingItem.jsx` calls the `onDelete` prop passed from `Sidebar.jsx`.
3.  `Sidebar.jsx`'s `handleDeleteRecording` function calls `deletePersistedRecording(sessionId)` from `RecordingsContext`.
4.  `RecordingsContext` makes an authenticated `DELETE` request to `/api/v1/recordings/{user_id}/{session_id}`.
5.  The backend endpoint in `main.py` processes the request, identifies all associated S3 files via `session_metadata.json`, and deletes them from the S3 bucket.
6.  If the backend confirms successful deletion, `RecordingsContext` then calls `removeRecording(sessionId)` to remove the recording from the local state, causing the UI to update and the item to disappear from the list.
7.  Errors at any stage are logged to the console, and potentially could be surfaced to the user with future enhancements (e.g., toast notifications).