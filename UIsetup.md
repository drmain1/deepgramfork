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
*   **`EasySetupModal.jsx`**: Likely a modal component for a simplified or guided setup process.
*   **`MacroPhrasesTab.jsx`**: Suggests a tab for managing macro phrases or text snippets, possibly for quick insertion into notes.
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

This overview should help in managing and understanding the frontend codebase.