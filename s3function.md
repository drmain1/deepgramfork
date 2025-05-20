{{ ... }}
# S3 Integration for User Data and Recordings

This document outlines how Amazon S3 is used within the application to store and manage user-specific data, primarily recordings and application settings. This approach supports multi-tenancy and ensures data persistence and accessibility across user sessions and devices.

## Key Functionalities

1.  **User-Specific Recordings Storage:**
    *   **Purpose:** To store audio files, generated transcripts, and associated metadata for each user's recording session.
    *   **S3 Path Structure:** `user_recordings/{user_id}/{session_id}/`
        *   `{user_id}`: The unique identifier for the user (e.g., from Auth0).
        *   `{session_id}`: A unique identifier for each recording session (typically a timestamp).
    *   **Files Stored per Session:**
        *   `audio.wav` (or other audio format): The raw audio of the recording.
        *   `transcript.txt`: The full transcript of the recording.
        *   `session_metadata.json`: A JSON file containing metadata such as the recording's display name, creation date, duration, S3 paths to audio/transcript, and any contextual tags or notes.

2.  **User Settings Persistence:**
    *   **Purpose:** To store user-configurable settings like macro phrases, custom vocabulary, and transcription profiles.
    *   **S3 Path Structure:** `user_settings/{user_id}/settings.json`
    *   **Data Format:** A JSON object containing all user settings.

## Backend API Endpoints (Interacting with S3)

The backend (FastAPI application in `main.py`) provides the following key endpoints that interact with S3:

*   **`POST /api/v1/save_recording_details`**: 
    *   Receives recording details (audio, transcript, metadata) after a session.
    *   Uploads the audio file, transcript file, and `session_metadata.json` to the appropriate user-specific path in S3.

*   **`GET /api/v1/user_recordings/{user_id}`**:
    *   **Functionality:** Fetches a list of a user's recent recordings.
    *   **Process:**
        1.  Lists objects in S3 under `user_recordings/{user_id}/` for files named `session_metadata.json`.
        2.  **Data Retention (15 days):** Filters these metadata files based on their `LastModified` timestamp in S3, only including those modified within the last 15 days.
        3.  For each valid metadata file, it parses the content to extract recording details (name, date, S3 paths, etc.).
        4.  Returns a list of `RecordingInfo` objects, sorted by date (most recent first).
    *   **Pydantic Model:** `RecordingInfo` structures the data sent to the frontend.

*   **`GET /api/v1/user_settings/{user_id}`**:
    *   Fetches `user_settings/{user_id}/settings.json` from S3.
    *   If the file doesn't exist or an error occurs, it returns default settings.

*   **`POST /api/v1/user_settings`**:
    *   Receives user settings data in the request body.
    *   Saves these settings to `user_settings/{user_id}/settings.json` in S3, overwriting any existing file.

*   **`DELETE /api/v1/recordings/{user_id}/{session_id}`**:
    *   Deletes all S3 objects associated with a specific recording session (audio, transcript, metadata) from `user_recordings/{user_id}/{session_id}/`.

## Frontend Interaction (`RecordingsContext.jsx`, `UserSettingsContext.jsx`)

*   **Fetching Recordings:** The `RecordingsContext.jsx` uses `fetchUserRecordings` to call the `GET /api/v1/user_recordings/{user_id}` endpoint upon user authentication. It merges these S3-backed recordings with any local non-saved recordings and manages `localStorage` for persistence across browser sessions for the authenticated user.
*   **Managing Settings:** The `UserSettingsContext.jsx` calls the `GET /api/v1/user_settings/{user_id}` and `POST /api/v1/user_settings` endpoints to load and save user preferences, respectively.

## Security and Access

*   Backend S3 operations use AWS credentials configured via environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET_NAME`).
*   API endpoints that access user-specific data are protected and require authentication (e.g., Auth0 JWT tokens passed in the `Authorization` header).

This S3 integration ensures that user data is securely stored, versioned (implicitly by S3 object versions if enabled), and consistently available to the user, forming a core part of the application's data management strategy.