# Short-Term Implementation Plan & Progress

## Current Progress (As of 2025-05-14)

### 1. Project Setup
*   **Workspace:** `/Users/davidmain/Desktop/trans10/`
*   **Environment Configuration:** `.env` file created at the root with `deepgram_api_key`.

### 2. Frontend (`my-vite-react-app`)
*   Basic React/Vite project structure is in place.
*   Entry point: `my-vite-react-app/src/main.jsx`.
*   Initial UI elements for "New Encounter" (as per earlier visual context) are assumed to be partially implemented.

### 3. Backend (`backend`)
*   **Framework:** FastAPI with Uvicorn.
*   **Main file:** `backend/main.py`.
*   **Dependencies:** `requirements.txt` created (fastapi, uvicorn, python-dotenv, websockets).
*   **Virtual Environment:** `venv` created and activated; dependencies installed within it.
*   **API Key:** Backend `main.py` updated to correctly load `deepgram_api_key` from the `.env` file (pending verification of server restart).
*   **WebSocket Endpoint:** Basic `/stream` WebSocket endpoint is functional for connection testing (currently echoes text).
*   **Server Status:** Backend server is running and accessible at `http://localhost:8000` (pending verification of API key loading after code change).

## Current Directory Structure

```
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

## Next 6-7 Steps

1.  **Frontend (React): Implement Microphone Access & Audio Streaming to Backend**
    *   **Tasks:**
        *   Use `MediaRecorder` API to request microphone permission and capture audio.
        *   Establish a WebSocket connection from the React app to the backend (`ws://localhost:8000/stream`).
        *   Stream captured audio chunks (as binary data, e.g., `Blob` or `ArrayBuffer`) over the WebSocket.
        *   Add UI controls (e.g., "Start Recording", "Stop Recording" buttons).
        *   Create a display area for the live transcript.
    *   **Files to modify/create:** Components within `my-vite-react-app/src/components/` or `my-vite-react-app/src/pages/`.

2.  **Backend (FastAPI): Receive Audio & Connect to Deepgram**
    *   **Tasks:**
        *   Update the `/stream` WebSocket endpoint in `backend/main.py` to handle incoming binary audio data (`websocket.receive_bytes()`).
        *   Install the Deepgram Python SDK: `pip install deepgram-sdk`. (Add to `requirements.txt` and install in `venv`).
        *   In `backend/main.py`, initialize the Deepgram client using the loaded API key.
        *   When a frontend client connects to `/stream`, establish a live streaming connection to Deepgram (e.g., `nova-3-medical` model).
    *   **Files to modify:** `backend/main.py`, `backend/requirements.txt`.

3.  **Backend (FastAPI): Stream Audio to Deepgram & Relay Transcript to Frontend**
    *   **Tasks:**
        *   As binary audio data arrives from the frontend on the `/stream` WebSocket, forward this data to the active Deepgram streaming connection.
        *   Implement handlers for Deepgram's events (e.g., `Transcript`, `Open`, `Close`, `Error`).
        *   When transcription results (interim and final) are received from Deepgram, send them as text messages back to the connected frontend client via its WebSocket.
    *   **Files to modify:** `backend/main.py`.

4.  **Frontend (React): Display Live Transcript**
    *   **Tasks:**
        *   Update the React component managing the recording to listen for messages on its WebSocket connection.
        *   Parse the incoming transcription data from the backend.
        *   Dynamically update the UI to display the live transcript (both interim and final results).
    *   **Files to modify/create:** Components within `my-vite-react-app/src/`.

5.  **Backend (FastAPI): Basic LLM Integration for Note Generation (Post-Transcription)**
    *   **Tasks:**
        *   Define a trigger for note generation (e.g., WebSocket close, or a specific "stop" message from client).
        *   Accumulate the final transcript from Deepgram.
        *   Install an LLM client library (e.g., `pip install anthropic` for Claude). Add to `requirements.txt`.
        *   Implement a function to send the complete transcript to an LLM (e.g., Claude Haiku) with a prompt for clinical note summarization.
        *   For now, log the LLM's response or send it back to the client.
    *   **Files to modify:** `backend/main.py`, `backend/requirements.txt`.

6.  **Backend (FastAPI): Basic S3 Integration for Storing Audio & Notes**
    *   **Tasks:**
        *   Install Boto3: `pip install boto3`. Add to `requirements.txt`.
        *   *User to configure AWS credentials locally (e.g., via AWS CLI `aws configure` or environment variables for the backend server process).*
        *   Implement functions to:
            *   Upload the complete raw audio (accumulated chunks) to an S3 bucket (e.g., `tenant-id/audio/[timestamp].wav`).
            *   Upload the LLM-generated note (as a text file) to S3 (e.g., `tenant-id/notes/[note-id].txt`).
        *   Decide on a temporary/simplified `tenant-id` and `note-id` generation scheme.
    *   **Files to modify:** `backend/main.py`, `backend/requirements.txt`.

7.  **Frontend (React) & Backend (FastAPI): Basic "End of Encounter" Workflow**
    *   **Frontend:**
        *   Modify the "Stop Recording" button or add a new "Generate Note" button.
        *   When triggered, send a specific message to the backend WebSocket (e.g., `{"action": "stop_session"}`) or simply close the WebSocket to signal the end.
    *   **Backend:**
        *   Detect this end-of-session signal.
        *   Ensure Deepgram processing is finalized.
        *   Trigger LLM processing and S3 storage steps.
        *   Optionally, send a confirmation or the generated note ID/S3 path back to the frontend.
    *   **Files to modify:** Frontend components in `my-vite-react-app/src/`, `backend/main.py`.