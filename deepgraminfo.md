# Project Overview and Progress: Live Medical Transcription App

This document outlines the current state, technology choices, and key implementation details for the live medical transcription application.
/Users/davidmain/Desktop/trans10/
├── .env
├── backend/
│   ├── __pycache__/ 
│   │   └── main.cpython-39.pyc (example, actual name might vary)
│   ├── venv/ 
│   │   └── (Python virtual environment files & directories)
│   ├── main.py
│   └── requirements.txt
├── my-vite-react-app/
│   ├── .eslintrc.cjs
│   ├── .gitignore
│   ├── README.md
│   ├── index.html
│   ├── package-lock.json
│   ├── package.json
│   ├── public/
│   │   └── vite.svg
│   ├── src/
│   │   ├── App.css
│   │   ├── App.jsx
│   │   ├── assets/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── index.css
│   │   ├── main.jsx
│   │   ├── pages/
│   │   └── utils/
│   │   └── styles.css (if present)
│   └── vite.config.js
├── fullimplementationplan
└── shorttermimplementation.md
```
## I. Core Technologies

*   **Frontend:**
    *   **Framework/Library:** React with Vite
    *   **UI Components:** Material-UI (MUI)
    *   **Audio Capture:** Browser's `MediaRecorder` API (capturing as WebM/Opus)
    *   **Communication:** WebSocket for real-time audio streaming to backend and receiving transcripts.
*   **Backend:**
    *   **Framework:** FastAPI (Python)
    *   **Server:** Uvicorn
    *   **Audio Transcoding:** FFMPEG (system installation) with `ffmpeg-python` (though currently using `asyncio.create_subprocess_exec` for direct FFMPEG process management). Transcodes WebM/Opus to linear16 PCM (16kHz, mono, s16le).
    *   **Communication:** WebSocket endpoint (`/stream`) to receive audio from frontend and send transcripts back.
*   **Transcription Service:**
    *   **Provider:** Deepgram
    *   **Model:** Nova-3 Medical (`nova-3-medical`)
    *   **SDK:** `deepgram-sdk` (Python) for live streaming.
*   **Version Control:**
    *   Git
    *   **Remote Repository:** GitHub (`https://github.com/drmain1/deepgram`)

## II. Key Milestones and Recent Actions

1.  **Initial Project Setup:**
    *   Created separate frontend (`my-vite-react-app`) and backend (`backend`) directories.
    *   Established basic FastAPI server and React application structure.

2.  **Frontend Audio Capture and WebSocket:**
    *   Implemented `AudioRecorder.jsx` component to:
        *   Request microphone permissions.
        *   Capture audio using `MediaRecorder` (outputting WebM/Opus).
        *   Establish a WebSocket connection to the backend's `/stream` endpoint.
        *   Send audio data chunks over WebSocket.
        *   Receive and display transcriptions from the backend.

3.  **Backend WebSocket and Deepgram Integration:**
    *   Created a FastAPI WebSocket endpoint (`/stream`) to handle client connections.
    *   Integrated the Deepgram Python SDK (`AsyncLiveClient`) to connect to Deepgram's live transcription service using the `nova-3-medical` model.

4.  **Audio Transcoding with FFMPEG:**
    *   **Initial Challenge:** `MediaRecorder` produces WebM/Opus audio, while Deepgram (with chosen settings) requires linear16 PCM.
    *   **Solution Implemented:**
        *   The backend now uses a **persistent FFMPEG process for each WebSocket connection**.
        *   When a client connects, an `ffmpeg` process is started using `asyncio.create_subprocess_exec`.
        *   Incoming WebM/Opus audio from the client is piped to `ffmpeg`'s stdin.
        *   `ffmpeg` transcodes the audio to `s16le` PCM (16kHz, 1 channel) and outputs it to its stdout.
        *   An asyncio task reads this PCM data from `ffmpeg`'s stdout and sends it to the Deepgram connection.
        *   This approach resolved "EBML header parsing failed" errors that occurred with chunk-by-chunk FFMPEG processing.
    *   **Deepgram `LiveOptions` Configured:**
        *   `encoding="linear16"`
        *   `sample_rate=16000`
        *   `channels=1`
        *   `interim_results=True`, `utterance_end_ms="1000"`, `vad_events=True` for better responsiveness.

5.  **Live Transcript Display:**
    *   Modified the backend to prefix transcripts with "Interim: " or "Final: " based on `result.is_final` from Deepgram.
    *   The `AudioRecorder.jsx` frontend parses these prefixes to update interim and final transcript states correctly, displaying the combined live transcript in a text box.
    *   **Status:** Successfully displaying live transcriptions in the UI.

6.  **Version Control:**
    *   Initialized a Git repository for the project (`/Users/davidmain/Desktop/trans10`).
    *   Created a `.gitignore` file for Python and Node.js/Vite projects.
    *   Successfully pushed the initial project state to the GitHub repository: `https://github.com/drmain1/deepgram`.

## III. Next Steps (Priorities from `shorttermimplementation.md`)

*   LLM integration for clinical note summarization/polishing.
*   S3 integration for storing raw audio and generated notes.
*   Further UI refinements and error handling.
*   Authentication (simplified for now, possibly full Cognito later).
