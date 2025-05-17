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

6.  **Backend (FastAPI): S3 Integration via HTTP Endpoint for Storing Audio & Transcripts**
    *   **Status:** Implemented.
    *   **Workflow:**
        *   The `/stream` WebSocket endpoint in `backend/main.py` accumulates raw PCM audio during a session and saves it to a temporary local file (e.g., `/tmp/trans10_audio_temp/{session_id}.pcm`). Upon WebSocket closure, this PCM file is converted to a WAV file and saved as `TEMP_AUDIO_DIR/{session_id}.wav` (e.g., `/tmp/trans10_audio_temp/{session_id}.wav`).
        *   The frontend, after a session is stopped and the final transcript is available, makes a `POST` request to `/api/v1/save_session_data` in `backend/main.py`, sending the `session_id`, the `final_transcript_text`, and optionally `claude_custom_instructions`.
        *   The `/api/v1/save_session_data` endpoint (updated and bug-fixed):
            *   Retrieves the `session_id`, `final_transcript_text`, and optional `claude_custom_instructions` from the request. (Note: A previous conflict in request field naming, `final_transcript` vs `final_transcript_text`, has been resolved to consistently use `final_transcript_text`).
            *   Locates the corresponding `{session_id}.wav` file from `TEMP_AUDIO_DIR`.
            *   Utilizes helper functions from `backend/aws_utils.py` (`save_audio_file_to_s3`, `save_text_to_s3`, `polish_transcript_with_bedrock`) and the configured S3 client.
            *   Uploads the original transcript (from `final_transcript_text`) to S3 (e.g., `s3://[AWS_S3_BUCKET_NAME]/[DEFAULT_TENANT_ID]/transcripts/original/{session_id}.txt`).
            *   Uploads the WAV audio file to S3 (e.g., `s3://[AWS_S3_BUCKET_NAME]/[DEFAULT_TENANT_ID]/audio/{session_id}.wav`).
            *   If Bedrock is configured (which uses `anthropic.claude-3-haiku`): 
                *   It calls `polish_transcript_with_bedrock`, passing the `final_transcript_text` and any provided `claude_custom_instructions`.
                *   The `polish_transcript_with_bedrock` function in `aws_utils.py` now dynamically incorporates these instructions into the prompt sent to Claude. If no custom instructions are provided, it defaults to a general medical transcript polishing prompt.
                *   Uploads the polished version to S3 (e.g., `s3://[AWS_S3_BUCKET_NAME]/[DEFAULT_TENANT_ID]/transcripts/polished/{session_id}.txt`).
            *   Removes the temporary local WAV file after successful upload.
            *   Returns a JSON response with S3 paths and any errors.
    *   **Configuration:**
        *   `boto3` is installed and in `requirements.txt`.
        *   AWS credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) and S3/Bedrock settings (`AWS_S3_BUCKET_NAME`, `AWS_REGION`, `DEFAULT_TENANT_ID`) are loaded from `.env`.
        *   S3 client and Bedrock Runtime client are initialized in `main.py`'s startup event.
    *   **Key Files:** `backend/main.py`, `backend/aws_utils.py`, `backend/requirements.txt`, `.env`.

7.  **Frontend (React) & Backend (FastAPI): "End of Encounter" and Save Workflow**
    *   **Frontend (`AudioRecorder.jsx` or similar component):**
        *   The "Stop Recording" button finalizes local recording and WebSocket interaction.
        *   A "Save Session to S3" button (or similar) becomes active.
        *   When clicked, the frontend:
            *   Retrieves the `session_id` (received from the backend via WebSocket on connection).
            *   Gathers the complete final transcript.
            *   Sends a `POST` request to the backend's `/api/v1/save_session_data` endpoint with `session_id` and `final_transcript_text` in the request body.
            *   Displays status messages based on the backend's response (success, failure, S3 paths).
    *   **Backend (`backend/main.py`):**
        *   The `/stream` WebSocket endpoint finalizes Deepgram processing and prepares the local WAV audio file in `TEMP_AUDIO_DIR/{session_id}.wav` when the WebSocket connection closes.
        *   The `/api/v1/save_session_data` HTTP endpoint handles the S3 upload and Bedrock polishing logic as detailed in Step 6.
    *   **Files involved:**
        *   Frontend: `my-vite-react-app/src/components/AudioRecorder.jsx` (or the component responsible for session management and saving).
        *   Backend: `backend/main.py`.