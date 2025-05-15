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
*   **`CustomVocabularyTab.jsx`**: Probably a tab within a settings or configuration interface for managing custom vocabulary lists for transcription.
*   **`EasySetupModal.jsx`**: Likely a modal component for a simplified or guided setup process.
*   **`MacroPhrasesTab.jsx`**: Suggests a tab for managing macro phrases or text snippets, possibly for quick insertion into notes.
*   **`NoteStructureTab.jsx`**: Likely a tab for configuring the structure or template of generated notes.
*   **`RecentRecordingItem.jsx`**: A component to display a single item in a list of recent recordings.
*   **`SettingsTabs.jsx`**: A component that likely manages the tabbed interface within the settings page.
*   **`Sidebar.jsx`**: The main navigation sidebar for the application. **This is where the \"New Session\" or \"Start Transcribing\" button that triggers the `AudioRecorder` panel should reside.**

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

This overview should help in managing and understanding the frontend codebase.