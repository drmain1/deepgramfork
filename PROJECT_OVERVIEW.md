# Project Overview

This document provides an overview of the various files and components within the project, aiming to assist in understanding its structure and functionality.

## Backend

### .gitignore

**Summary:** This file specifies intentionally untracked files and directories that Git should ignore. It helps prevent committing generated files (like Python bytecode or build artifacts), local configuration files, IDE-specific files, sensitive information (like `.env` files), and dependency directories (like `node_modules/` or `venv/`) to the version control system.

**Key Patterns/Sections:**
*   Python-specific ignores (e.g., `__pycache__/`, `*.pyc`).
*   Virtual environment directories (e.g., `venv/`, `.venv/`).
*   IDE and OS-specific files (e.g., `.vscode/`, `.DS_Store`).
*   Secret files (e.g., `.env`).
*   Node.js/Vite/React specific ignores (e.g., `node_modules/`, `dist/`).
*   General build output directories (e.g., `build/`).

**Major Dependencies:** Not applicable.

### backend/__init__.py

**Summary:** This is an empty `__init__.py` file. Its presence indicates to Python that the `backend` directory should be treated as a package, allowing modules within it to be imported.

**Key Definitions:** None.

**Major Dependencies:** Not applicable.

### backend/aws_utils.py

**Summary:** This module provides asynchronous utility functions for interacting with AWS services, specifically Amazon Bedrock for transcript polishing and Amazon S3 for storage. It handles communication with these services, including error handling and logging.

**Key Definitions:**
*   [`polish_transcript_with_bedrock(transcript: str, bedrock_client, custom_instructions: str = None) -> str`](backend/aws_utils.py:5):
    *   Asynchronously sends a transcript to Amazon Bedrock (specifically Claude Haiku model) for polishing. It can use default medical transcript polishing instructions or custom instructions provided by the user. Returns the polished transcript or the original if an error occurs.
*   [`save_text_to_s3(s3_client, aws_s3_bucket_name: str, tenant_id: str, session_id: str, content: str, folder: str = "notes")`](backend/aws_utils.py:77):
    *   Asynchronously uploads a given string content to a specified S3 bucket, organizing it by tenant ID, session ID, and a folder (defaulting to "notes"). Returns the S3 path upon success, None otherwise.
*   [`save_audio_file_to_s3(s3_client, aws_s3_bucket_name: str, tenant_id: str, session_id: str, local_file_path: str, folder: str = "audio", content_type: str = "audio/wav")`](backend/aws_utils.py:96):
    *   Asynchronously uploads an audio file from a local path to a specified S3 bucket. It organizes the file by tenant ID, session ID, and a folder (defaulting to "audio"). Returns the S3 path upon success, None otherwise.
*   [`delete_s3_object(s3_client, aws_s3_bucket_name: str, s3_key: str)`](backend/aws_utils.py:119):
    *   Asynchronously deletes an object from a specified S3 bucket using its key. Returns True on success, False otherwise.

**Major Dependencies:**
*   **Internal:** None.
*   **External:**
    *   `asyncio`: For asynchronous operations.
    *   `json`: For handling JSON request and response bodies for Bedrock.
    *   `os`: (Imported but not directly used in the provided functions for environment variables like `AWS_S3_BUCKET_NAME`, which are passed as arguments).
    *   Presumably `boto3` or a similar AWS SDK is used to create the `bedrock_client` and `s3_client` objects that are passed into these functions, though the SDK itself isn't directly imported within this utility file.

### backend/core_models.py

**Summary:** This module defines Pydantic data models used throughout the backend, particularly for structuring user settings and transcription profiles. These models ensure data validation and provide clear schemas for data interchange.

**Key Definitions:**
*   [`TranscriptionProfileItem(BaseModel)`](backend/core_models.py:4):
    *   Defines the structure for a single transcription profile. It includes fields like `id`, `name`, and various Deepgram-specific settings such as `smart_format`, `diarize`, `interim_results`, `utterance_end_ms`, `vad_events`, and `utterances`.
*   [`UserSettingsData(BaseModel)`](backend/core_models.py:16):
    *   Defines the overall structure for user-specific settings. It includes lists for `macroPhrases`, `customVocabulary`, `officeInformation` (as strings), and `transcriptionProfiles` (using the `TranscriptionProfileItem` model).
*   `DEFAULT_USER_SETTINGS`:
    *   An instance of `UserSettingsData` that provides a default set of user settings, including a "Default General Profile". This is used as a fallback or initial template for new users.

**Major Dependencies:**
*   **Internal:** None.
*   **External:**
    *   `pydantic`: Used for data validation and settings management (BaseModel, Field).
    *   `typing`: For type hinting (Optional, List, Dict, Any).

### backend/deepgram_utils.py

**Summary:** This module is responsible for handling real-time audio streaming to Deepgram for transcription via WebSockets. It manages the entire lifecycle of a Deepgram live transcription session, including establishing the connection, processing audio with FFmpeg for compatibility, applying user-specific transcription profiles, and relaying transcription results back to the client. It also handles temporary file management for audio data and robust error logging.

**Key Definitions:**
*   [`convert_raw_pcm_to_wav(input_pcm_path: str, output_wav_path: str) -> bool`](backend/deepgram_utils.py:32):
    *   An asynchronous utility that uses an FFmpeg subprocess to convert raw PCM audio data (16-bit linear, 16kHz, mono) from a specified input file to a WAV audio file at the given output path. Returns `True` on successful conversion, `False` otherwise.
*   [`handle_deepgram_websocket(websocket: WebSocket, get_user_settings_func: callable)`](backend/deepgram_utils.py:56):
    *   The main asynchronous function that orchestrates the live transcription session. It accepts a client WebSocket connection and a function to fetch user settings. Its responsibilities include:
        *   Initializing the session and obtaining user/profile information from the client.
        *   Fetching and applying user-specific Deepgram settings (e.g., `smart_format`, `diarize`) based on the selected profile.
        *   Establishing and managing a connection to Deepgram's `AsyncLiveClient`.
        *   Setting up event handlers for various Deepgram transcription events (e.g., `Open`, `Transcript`, `Error`, `Close`).
        *   Launching an FFmpeg subprocess to convert incoming audio (from the client, likely WebM/Opus) into the PCM format required by Deepgram.
        *   Running concurrent tasks to:
            1.  Forward audio bytes received from the client to FFmpeg's input.
            2.  Read processed PCM audio from FFmpeg's output and send it to Deepgram, simultaneously saving it to a temporary raw PCM file.
            3.  Log any errors from the FFmpeg process.
        *   Sending interim and final transcription results received from Deepgram back to the client WebSocket.
        *   Upon session termination (e.g., client disconnect), it finalizes the transcript, converts the accumulated raw PCM data to a WAV file using `convert_raw_pcm_to_wav`, cleans up temporary files and processes, and sends a `session_end` message to the client with the full transcript and path to the temporary WAV file.

**Major Dependencies:**
*   **Internal:**
    *   Relies on a `get_user_settings_func` (passed as an argument) to fetch user-specific transcription profiles, likely interacting with models defined in [`backend/core_models.py`](backend/core_models.py:0).
*   **External:**
    *   `asyncio`: Core library for asynchronous programming and managing subprocesses (FFmpeg).
    *   `logging`: For application-level logging.
    *   `os`: For accessing environment variables (e.g., `DEEPGRAM_API_KEY`) and managing file paths.
    *   `json`: For serializing and deserializing WebSocket messages.
    *   `tempfile`: For creating and managing temporary storage for raw audio data.
    *   `datetime`: Used for generating unique session IDs.
    *   `dotenv` (from `python-dotenv` package): To load environment variables from a `.env` file.
    *   `fastapi.WebSocket`: For type hinting the WebSocket object from the FastAPI framework.
    *   `deepgram` (Deepgram Python SDK): Specifically `AsyncLiveClient`, `DeepgramClientOptions`, `LiveOptions`, and `LiveTranscriptionEvents` for interacting with the Deepgram live transcription service.
    *   `ffmpeg`: An external command-line utility invoked as a subprocess for audio format conversion. It's not a Python library but a system dependency.

### backend/main.py

**Summary:** This file defines the main FastAPI application for the backend. It handles HTTP requests, WebSocket connections for real-time transcription, and manages interactions with AWS services (S3 for storage, Bedrock for AI model processing). Key functionalities include user settings management, audio streaming to Deepgram (via `deepgram_utils`), saving session data (transcripts, audio), and listing/deleting recordings.

**Key Definitions:**
*   `app = FastAPI()`: The main FastAPI application instance.
*   `@app.on_event("startup")` [`async def startup_event()`](backend/main.py:67):
    *   An event handler that runs when the FastAPI application starts. It initializes global AWS clients for S3 (`s3_client`) and Bedrock Runtime (`bedrock_runtime_client`) using credentials from environment variables.
*   `@app.get("/")` [`async def get_test_page()`](backend/main.py:159):
    *   Serves a basic HTML page for testing WebSocket connectivity to a test endpoint.
*   `@app.websocket("/ws_test")` [`async def websocket_test_endpoint(websocket: WebSocket)`](backend/main.py:163):
    *   A simple WebSocket endpoint that echoes back any message received. Used for basic WebSocket connection testing.
*   `@app.websocket("/stream")` [`async def websocket_stream_endpoint(websocket: WebSocket)`](backend/main.py:177):
    *   The primary WebSocket endpoint for live audio transcription. It delegates the complex handling of the Deepgram streaming session to the `handle_deepgram_websocket` function imported from `./deepgram_utils.py`, passing it a reference to the `get_user_settings` function for profile loading.
*   **Pydantic Models (defined/redefined in this file):**
    *   [`TranscriptionProfileItem(BaseModel)`](backend/main.py:187): Defines the structure for transcription profiles, including Deepgram settings and an optional custom `llmPrompt`. (Note: This seems to be a slightly different version than one potentially in `core_models.py`).
    *   [`UserSettingsData(BaseModel)`](backend/main.py:198): Defines the structure for user settings, containing lists of macro phrases, custom vocabulary, office information, and transcription profiles.
    *   [`SaveUserSettingsRequest(BaseModel)`](backend/main.py:204): Model for the request body when saving user settings.
    *   [`SaveSessionRequest(BaseModel)`](backend/main.py:272): Model for the request body when saving session data (transcript, user ID, context).
    *   [`RecordingInfo(BaseModel)`](backend/main.py:487): Model for representing information about a saved recording when listing recordings.
*   `@app.get("/api/v1/user_settings/{user_id}")` [`async def get_user_settings(...)`](backend/main.py:211):
    *   API endpoint to fetch user settings for a given `user_id`. Settings are retrieved from a JSON file in an S3 bucket. Returns default settings if no specific settings are found.
*   `@app.post("/api/v1/user_settings")` [`async def save_user_settings(...)`](backend/main.py:245):
    *   API endpoint to save user settings. The settings (matching `UserSettingsData`) are provided in the request body and are saved as a JSON file to S3.
*   `@app.post("/api/v1/save_session_data")` [`async def save_session_data_endpoint(...)`](backend/main.py:281):
    *   API endpoint to process and save data from a transcription session. It receives the final transcript, user ID, and context. It then:
        *   Saves the original transcript to S3.
        *   Saves the session's audio (if available locally as a temporary WAV file) to S3.
        *   Optionally polishes the transcript using Amazon Bedrock via `polish_transcript_with_bedrock` from `aws_utils.py`.
        *   Saves the polished transcript to S3.
        *   Returns paths to the saved S3 objects and any processing errors.
*   `@app.delete("/api/v1/recordings/{user_id}/{session_id}")` [`async def delete_session_recording(...)`](backend/main.py:418):
    *   API endpoint to delete all S3 objects associated with a specific session ID for a given user, including original transcript, polished transcript, and audio file.
*   `@app.get("/api/v1/user_recordings/{user_id}")` [`async def get_user_recordings(...)`](backend/main.py:504):
    *   API endpoint to list all saved recordings for a specified user. It iterates through S3 objects in the user's directory, parses metadata, and returns a list of `RecordingInfo` objects.
*   `@app.get("/api/v1/s3_object_content")` [`async def get_s3_object_content(...)`](backend/main.py:598):
    *   API endpoint to retrieve the raw text content of a specified S3 object, given its S3 key.

**Major Dependencies:**
*   **Internal:**
    *   `.deepgram_utils` (specifically `handle_deepgram_websocket`): For managing live transcription via WebSockets.
    *   `.aws_utils` (various functions like `polish_transcript_with_bedrock`, `save_text_to_s3`, etc.): For interactions with AWS S3 and Bedrock.
    *   Pydantic models defined within this file.
*   **External:**
    *   `uvicorn`: ASGI server used to run the FastAPI application.
    *   `fastapi`: The web framework itself, used for defining routes, handling requests, WebSockets, and middleware (CORS).
    *   `python-dotenv` (`dotenv`): For loading environment variables from `.env` file (API keys, AWS config).
    *   `deepgram` (Deepgram Python SDK): Though direct interaction is largely delegated to `deepgram_utils`, some configuration objects might be initialized here.
    *   `ffmpeg` (python-ffmpeg): Likely used indirectly by `deepgram_utils` for audio processing.
    *   `boto3`: The AWS SDK for Python, used for S3 and Bedrock client interactions.
    *   `pydantic`: For data validation through request/response models.
    *   Standard Python libraries: `asyncio`, `os`, `logging`, `json`, `tempfile`, `datetime`, `typing`.

### backend/requirements.txt

**Summary:** This file lists the Python package dependencies required for the backend application to run. These packages can be installed using a package manager like `pip`.

**Key Definitions (Packages):**
*   `fastapi`: A modern, fast (high-performance) web framework for building APIs with Python 3.7+ based on standard Python type hints.
*   `uvicorn[standard]`: An ASGI (Asynchronous Server Gateway Interface) server, used to run FastAPI applications. The `[standard]` option includes extras for better performance and WebSocket support.
*   `python-dotenv`: Reads key-value pairs from a `.env` file and can set them as environment variables.
*   `websockets`: A library for building WebSocket servers and clients in Python.
*   `boto3`: The AWS SDK for Python, enabling Python developers to write software that makes use of services like Amazon S3 and Amazon Bedrock.
*   `deepgram-sdk`: The official Python SDK for interacting with the Deepgram API, used here for live audio transcription.
*   `ffmpeg-python`: Python bindings for FFmpeg, a multimedia framework, likely used for audio processing and conversion tasks.

**Major Dependencies:** Not applicable (this file *lists* dependencies).

## Frontend (my-vite-react-app)

### my-vite-react-app/.gitignore

**Summary:** This `.gitignore` file is specific to the `my-vite-react-app` frontend project. It lists files and directories that Git should ignore, primarily related to Node.js development (like `node_modules`), build outputs (like `dist/`), local editor configurations (like `.vscode/` or `.idea/`), log files, and environment variable files (like `.env`). It includes exceptions for files like `.vscode/extensions.json` and `.env.example` which might be useful to commit.

**Key Patterns/Sections:**
*   Log files (e.g., `logs`, `*.log`, `npm-debug.log*`).
*   `node_modules/` directory.
*   Build output directories (e.g., `dist/`, `dist-ssr/`).
*   Local environment files (`*.local`).
*   Editor-specific directories and files (e.g., `.vscode/*` but `!.vscode/extensions.json`, `.idea`, `.DS_Store`).
*   Environment variable files (e.g., `.env`, `.env.*` but `!.env.example`).

**Major Dependencies:** Not applicable.

### my-vite-react-app/eslint.config.js

**Summary:** This file configures ESLint for the Vite React frontend project using the modern "flat" configuration format (an array of configuration objects). It sets up linting rules, parser options for JavaScript and JSX, and integrates plugins specific to React development, such as for React Hooks and React Refresh.

**Key Definitions/Sections:**
*   **Default Export (`export default [...]`)**: An array of configuration objects.
    *   **Global Ignores (`{ ignores: ['dist'] }`)**: Specifies that the `dist` directory (typically containing build artifacts) should be ignored by ESLint.
    *   **Main Configuration Object (`{ files: ['**/*.{js,jsx}'], ... }`)**:
        *   `files`: Targets all `.js` and `.jsx` files within the project.
        *   `languageOptions`:
            *   `ecmaVersion`: Sets the ECMAScript version to 2020.
            *   `globals`: Incorporates standard browser global variables.
            *   `parserOptions`: Configures the parser for the latest ECMAScript version, enables JSX support, and sets the source type to "module".
        *   `plugins`:
            *   `'react-hooks'`: Integrates the `eslint-plugin-react-hooks` plugin.
            *   `'react-refresh'`: Integrates the `eslint-plugin-react-refresh` plugin.
        *   `rules`:
            *   Merges recommended rules from ESLint's core (`js.configs.recommended.rules`) and `eslint-plugin-react-hooks`.
            *   `'no-unused-vars'`: Overrides the default rule to allow unused variables that start with an uppercase letter or an underscore (often used for type definitions or intentionally unused parameters).
            *   `'react-refresh/only-export-components'`: Configures a warning to ensure that primarily React components are exported from modules, with an exception for constant exports. This helps with React Fast Refresh functionality.

**Major Dependencies:**
*   **Internal:** None.
*   **External (ESLint plugins/configs):**
    *   `@eslint/js`: Provides ESLint's built-in recommended rules.
    *   `globals`: A utility to define sets of global variables for different environments (e.g., browser, Node.js).
    *   `eslint-plugin-react-hooks`: Enforces the Rules of Hooks in React components.
    *   `eslint-plugin-react-refresh`: Provides ESLint rules specific to React Fast Refresh.

### my-vite-react-app/index.html

**Summary:** This is the main HTML entry point for the Vite + React single-page application (SPA). It provides the basic HTML structure, including metadata, the title, and a root `<div>` element where the React application will be mounted. It also includes the script tag that loads the main JavaScript/JSX entry point of the application (`/src/main.jsx`).

**Key Definitions/Sections:**
*   **`<!doctype html>` and `<html>` tag:** Standard HTML5 structure with language set to English.
*   **`<head>` section:**
    *   `charset`: UTF-8 character encoding.
    *   `icon`: Links to `vite.svg` as the favicon.
    *   `viewport`: Configures the viewport for responsive behavior on different devices.
    *   `title`: Sets the initial page title to "Vite + React".
*   **`<body>` section:**
    *   `<div id="root"></div>`: The main container element. The React application, managed by `src/main.jsx`, will render its components within this div.
    *   `<script type="module" src="/src/main.jsx"></script>`: This is the crucial part for a Vite project. It loads the application's JavaScript entry point (`/src/main.jsx`) as an ES module. Vite's development server and build process handle this script.

**Major Dependencies:**
*   **Internal:**
    *   `/src/main.jsx`: The main JavaScript entry point for the React application.
    *   `/vite.svg`: The favicon image.
*   **External:** None directly in the HTML, but the JavaScript it loads will pull in React, ReactDOM, and other project dependencies.

### my-vite-react-app/package.json

**Summary:** This file is the manifest for the Node.js frontend project `my-vite-react-app`. It defines project metadata (name, version, type), scripts for development and building, and lists both runtime dependencies and development dependencies. This file is crucial for managing the project's packages and build process.

**Key Definitions/Sections:**
*   `name`: "my-vite-react-app" - The name of the package.
*   `private`: `true` - Indicates this package is not intended for public publishing.
*   `version`: "0.0.0" - The current version of the package.
*   `type`: "module" - Specifies that JavaScript files in this project should be treated as ES modules by default.
*   **`scripts`**: Defines command-line scripts that can be run using `npm run <script-name>` or `yarn <script-name>`:
    *   `dev`: Starts the Vite development server (`vite`).
    *   `build`: Builds the application for production (`vite build`).
    *   `lint`: Runs ESLint to check for code quality issues (`eslint .`).
    *   `preview`: Starts a local server to preview the production build (`vite preview`).
*   **`dependencies`**: Lists packages required for the application to run in production:
    *   `@chakra-ui/react`, `@emotion/react`, `@emotion/styled`, `@mui/icons-material`, `@mui/material`: UI component libraries and related styling/animation packages (Chakra UI and Material-UI).
    *   `framer-motion`: A library for creating animations.
    *   `jspdf`: A library for generating PDF documents in JavaScript.
    *   `react`, `react-dom`: Core React libraries for building user interfaces.
    *   `react-router-dom`: For declarative routing in React applications.
*   **`devDependencies`**: Lists packages needed only for development and building, not for the production runtime:
    *   `@eslint/js`, `eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals`: ESLint and related plugins/utilities for code linting and quality checking.
    *   `@types/react`, `@types/react-dom`: TypeScript type definitions for React (though the project seems to be primarily JavaScript/JSX based on `eslint.config.js`).
    *   `@vitejs/plugin-react`: The official Vite plugin for React integration.
    *   `vite`: The build tool and development server used for the project.

**Major Dependencies:** (This file *lists* dependencies, as detailed above).

### my-vite-react-app/vite.config.js

**Summary:** This file contains the configuration for Vite, the build tool and development server used for the `my-vite-react-app` frontend project. It specifies plugins (primarily for React integration) and development server options, including a proxy setup to forward API requests to the backend server.

**Key Definitions/Sections:**
*   **Default Export (`export default defineConfig({...})`)**: The main configuration object for Vite.
    *   **`plugins: [react()]`**:
        *   Integrates the official `@vitejs/plugin-react` plugin, which enables support for React Fast Refresh, JSX transformation, and other React-specific optimizations.
    *   **`server`**: Configuration options for the Vite development server.
        *   **`proxy`**: Sets up a proxy for API requests.
            *   **`'/api': {...}`**: Configures requests made from the frontend to paths starting with `/api` to be forwarded.
                *   `target: 'http://localhost:8000'`: Specifies that these requests should be proxied to the backend server running at `http://localhost:8000`.
                *   `changeOrigin: true`: Changes the origin of the host header to the target URL, which is often necessary for backend servers that validate the `Host` header.
                *   Commented out options like `secure` (for HTTPS backends with self-signed certificates) and `rewrite` (to modify the path before forwarding) indicate potential configurations for different backend setups.

**Major Dependencies:**
*   **Internal:** None.
*   **External (Vite and plugins):**
    *   `vite` (specifically the `defineConfig` function): The core Vite library.
    *   `@vitejs/plugin-react`: The Vite plugin for React integration.

### my-vite-react-app/src/App.css

**Summary:** This CSS file provides styles for the main application layout and some example/demo components (like logos and cards) that are often part of the default Vite + React template. It includes styles for the root element, logo animations, and simple card styling.

**Key Definitions/Sections (CSS Selectors & Animations):**
*   **`#root`**: Styles the main root container of the application, setting a maximum width, centering it, and adding padding.
*   **`.logo`**: Defines styles for logo images, including height, padding, and a transition for a filter effect.
*   **`.logo:hover`, `.logo.react:hover`**: Defines hover effects for logos, applying a `drop-shadow` filter. The `.react` variant has a different shadow color.
*   **`@keyframes logo-spin`**: Defines a CSS animation that rotates an element 360 degrees.
*   **`@media (prefers-reduced-motion: no-preference)`**: Applies the `logo-spin` animation to a specific logo (`a:nth-of-type(2) .logo`) if the user has no preference for reduced motion.
*   **`.card`**: Basic padding for elements with the class `card`.
*   **`.read-the-docs`**: Sets a specific color for elements with this class, often used for informational text.

**Major Dependencies:** Not applicable (CSS file). It's typically imported by [`App.jsx`](my-vite-react-app/src/App.jsx:0) or a similar top-level component.

### my-vite-react-app/src/App.jsx

**Summary:** This file defines the main root component (`App`) for the React application. It sets up the overall application structure, including theme provider (Material-UI), CSS baseline, context providers for recordings and templates, and client-side routing using React Router. It defines the main layout with a sidebar and a main content area where different pages/components are rendered based on the current route.

**Key Definitions:**
*   [`App()`](my-vite-react-app/src/App.jsx:12): The main functional React component that serves as the root of the application.
    *   It wraps the entire application in several providers:
        *   `ThemeProvider` (from `@mui/material/styles`): Applies the custom Material-UI theme defined in [`./theme.js`](my-vite-react-app/src/theme.js:0).
        *   `CssBaseline` (from `@mui/material`): Provides a baseline set of CSS normalizations.
        *   [`RecordingsProvider`](my-vite-react-app/src/contexts/RecordingsContext.jsx:0): Manages global state related to audio recordings.
        *   [`TemplateProvider`](my-vite-react-app/src/contexts/TemplateContext.jsx:0): Manages global state related to templates.
    *   It uses `Router` (from `react-router-dom`) to enable client-side navigation.
    *   It renders a main layout using Material-UI's `Box` components, consisting of:
        *   A persistent [`Sidebar`](my-vite-react-app/src/components/Sidebar.jsx:0) component.
        *   A main content area where `Routes` are defined.
    *   **Routes:**
        *   `/`: Renders the [`AudioRecorder`](my-vite-react-app/src/components/AudioRecorder.jsx:0) component.
        *   `/settings`: Renders the [`SettingsPage`](my-vite-react-app/src/pages/SettingsPage.jsx:0) component.

**Major Dependencies:**
*   **Internal:**
    *   `./components/Sidebar.jsx`: The sidebar navigation component.
    *   `./pages/SettingsPage.jsx`: The component for the settings page.
    *   `./theme.js`: The custom Material-UI theme configuration.
    *   `./contexts/RecordingsContext.jsx`: Context provider for recordings.
    *   `./contexts/TemplateContext.jsx`: Context provider for templates.
    *   `./components/AudioRecorder.jsx`: The main component for audio recording functionality.
*   **External:**
    *   `react-router-dom`: For client-side routing (`BrowserRouter`, `Routes`, `Route`).
    *   `@mui/material/styles` (`ThemeProvider`): For applying Material-UI themes.
    *   `@mui/material` (`CssBaseline`, `Box`): Material-UI components for layout and styling.

### my-vite-react-app/src/index.css

**Summary:** This CSS file provides global baseline styles for the application, often part of the default Vite template. It defines root styles for typography, color schemes (supporting light and dark modes), and default styling for common HTML elements like `<a>`, `<body>`, `<h1>`, and `<button>`.

**Key Definitions/Sections (CSS Selectors & Media Queries):**
*   **:root**:
    *   Sets a default `font-family`, `line-height`, and `font-weight`.
    *   Defines a `color-scheme` for light and dark modes, with default text color and background color for dark mode.
    *   Includes properties for improved text rendering and font smoothing.
*   **`a`**: Styles anchor tags with a specific font weight, color, and text decoration. Includes a hover effect.
*   **`body`**: Basic body styling, including removing default margins, using flexbox for centering content (though this might be overridden by Material-UI's `CssBaseline` or app-specific layouts), and setting minimum width/height.
*   **`h1`**: Defines a base font size and line height for `<h1>` elements.
*   **`button`**: Provides default styling for buttons, including border radius, padding, font properties, background color, cursor, and transition for border color. Includes hover and focus styles.
*   **`@media (prefers-color-scheme: light)`**:
    *   Overrides some `:root` variables (text color, background color) for users who prefer a light color scheme.
    *   Adjusts link hover color and button background color for light mode.

**Major Dependencies:** Not applicable (CSS file). It's typically imported by [`main.jsx`](my-vite-react-app/src/main.jsx:0) to apply these global styles.

### my-vite-react-app/src/main.jsx

**Summary:** This is the main entry point for the Vite React application. Its primary responsibility is to initialize and render the root React component into the DOM. It sets up crucial top-level providers, including the Auth0 provider for authentication and the `UserSettingsProvider` for managing user-specific settings globally. It also wraps the main `App` component to ensure authentication is required before rendering.

**Key Definitions/Setup Logic:**
*   **Environment Variables:** Retrieves Auth0 domain (`VITE_AUTH0_DOMAIN`) and client ID (`VITE_AUTH0_CLIENT_ID`) from Vite's environment variables (`import.meta.env`).
*   **`ProtectedApp`**:
    *   A component created by wrapping the main [`App`](my-vite-react-app/src/App.jsx:0) component with Auth0's `withAuthenticationRequired` higher-order component. This ensures that users must be authenticated to access the `App`.
    *   It specifies [`AuthLoading`](my-vite-react-app/src/components/AuthLoading.jsx:0) as the component to display while authentication redirection is in progress.
*   **`ReactDOM.createRoot(...).render(...)`**:
    *   Uses React 18's `createRoot` API to get a handle to the DOM element with `id="root"` (found in [`index.html`](my-vite-react-app/index.html:0)).
    *   Renders the application within `<React.StrictMode>`.
    *   The core rendered component is `ProtectedApp`.
    *   **Providers:**
        *   `Auth0Provider`: Wraps the application to provide authentication context from Auth0. It's configured with the domain, client ID, and a `redirect_uri` set to the application's current origin.
        *   [`UserSettingsProvider`](my-vite-react-app/src/contexts/UserSettingsContext.jsx:0): Wraps `ProtectedApp` to make user settings available throughout the authenticated parts of the application.
*   **CSS Import (`import './styles.css'`)**: Imports global styles defined in [`./styles.css`](my-vite-react-app/src/styles.css:0).

**Major Dependencies:**
*   **Internal:**
    *   `./App.jsx`: The main application component.
    *   `./styles.css`: Global CSS styles.
    *   `./components/AuthLoading.jsx`: Component shown during Auth0 redirection.
    *   `./contexts/UserSettingsContext.jsx`: Context provider for user settings.
*   **External:**
    *   `react`: Core React library.
    *   `react-dom/client`: For rendering React components into the DOM.
    *   `@auth0/auth0-react`: Auth0 SDK for React, providing `Auth0Provider` and `withAuthenticationRequired`.

### my-vite-react-app/src/styles.css

**Summary:** This CSS file provides global and component-specific style overrides, primarily targeting Material-UI components. It resets body margin/padding, removes default padding from Material-UI lists, and sets default and monospace font families for Material-UI text fields.

**Key Definitions/Sections (CSS Selectors):**
*   **`body`**:
    *   Resets `margin` and `padding` to 0.
    *   Sets `box-sizing` to `border-box` for more intuitive element sizing.
*   **`.MuiList-root`**:
    *   Removes default `padding` from Material-UI List components.
*   **`.MuiTextField-root textarea`**:
    *   Sets a default `font-family` (Arial, sans-serif) for the `textarea` elements within Material-UI TextFields.
*   **`.MuiTextField-root.monospace textarea`**:
    *   Provides a way to apply a monospace font family (`'Courier New', monospace`) to `textarea` elements within Material-UI TextFields by adding a `monospace` class to the `MuiTextField-root` element.

**Major Dependencies:** Not applicable (CSS file). It's imported by [`main.jsx`](my-vite-react-app/src/main.jsx:4) to apply these styles globally or to specific components.

### my-vite-react-app/src/theme.js

**Summary:** This JavaScript file defines a custom theme for the Material-UI components used in the application. It utilizes Material-UI's `createTheme` function to specify custom palette colors (primary, secondary, background), typography settings (font family, header weights), and component-specific style overrides (for `MuiDrawer` and `MuiButton`). This theme is then exported to be used by the `ThemeProvider` in [`App.jsx`](my-vite-react-app/src/App.jsx:0).

**Key Definitions:**
*   **`theme = createTheme({...})`**: The main theme object created using Material-UI's `createTheme`.
    *   **`palette`**: Defines the color palette:
        *   `primary.main`: A dark blue (`#2c3e50`), noted for sidebar use.
        *   `secondary.main`: A gray (`#6c757d`) for secondary elements.
        *   `background.default`: A light gray (`#f8f9fa`).
        *   `background.paper`: White (`#ffffff`) for surfaces like cards and modals.
    *   **`typography`**: Customizes typography:
        *   `fontFamily`: Sets the default font to "Arial, sans-serif".
        *   `h4.fontWeight`: Sets font weight for `<h4>` elements to 600.
        *   `h5.fontWeight`: Sets font weight for `<h5>` elements to 500.
    *   **`components`**: Provides style overrides for specific Material-UI components:
        *   `MuiDrawer`:
            *   `styleOverrides.paper`: Sets the drawer's background color to the primary dark blue and text color to white.
        *   `MuiButton`:
            *   `styleOverrides.root`: Sets `textTransform` to `'none'`, preventing default uppercase styling of button text.

**Major Dependencies:**
*   **Internal:** None.
*   **External:**
    *   `@mui/material/styles` (specifically `createTheme`): The Material-UI function used to generate theme objects.

### my-vite-react-app/src/components/AdvancedSetupModal.jsx

**Summary:** This React component defines a modal dialog for "Advanced Template Setup". It allows users to input raw LLM (Large Language Model) instructions for customization. The modal includes a multi-line text field for these instructions and buttons to save or close. Currently, the save functionality is a placeholder (an alert).

**Key Definitions:**
*   **`style` (constant object)**: Defines the MUI styling for the modal's content box, positioning it centrally on the screen with specific dimensions and appearance.
*   **[`AdvancedSetupModal({ open, onClose })`](my-vite-react-app/src/components/AdvancedSetupModal.jsx:16) (React Functional Component)**:
    *   **Props:**
        *   `open` (boolean): Controls the visibility of the modal.
        *   `onClose` (function): Callback function invoked when the modal requests to be closed (e.g., by clicking the close button or outside the modal).
    *   **State:**
        *   `instructions` (string, managed by `useState`): Stores the text entered by the user in the instruction text field.
    *   **Internal Functions:**
        *   [`handleSave()`](my-vite-react-app/src/components/AdvancedSetupModal.jsx:19): Called when the "Save Advanced Template" button is clicked. It currently displays an alert with the entered instructions and then calls the `onClose` prop to close the modal.
    *   **Rendered UI:**
        *   Uses Material-UI's `Modal` component.
        *   Displays a title "Advanced Template Setup" and descriptive text.
        *   Includes a `TextField` (multi-line, 10 rows, monospace font) for users to input LLM instructions.
        *   Provides "Close" and "Save Advanced Template" buttons.

**Major Dependencies:**
*   **Internal:** None.
*   **External:**
    *   `react` (specifically `useState` hook).
    *   `@mui/material` (`Modal`, `Box`, `Typography`, `TextField`, `Button`): Material-UI components used to build the modal interface.

### my-vite-react-app/src/components/AudioRecorder.jsx

**Summary:** This React component is the core interface for managing audio recording encounters. It handles multiple views: a setup view for inputting encounter details (patient name, context, location, transcription profile), a recording view for live audio streaming and transcript display, and a detailed view for reviewing and editing transcripts of previously saved recordings. It interacts with browser media APIs for recording, WebSockets for real-time transcription streaming to the backend, and various contexts for user settings and recording data management. It also allows for saving session data to the backend and generating PDFs of polished notes.

**Key Definitions:**
*   **[`AudioRecorder = () => { ... }`](my-vite-react-app/src/components/AudioRecorder.jsx:26) (Main React Functional Component)**:
    *   Manages a significant amount of local state for UI control (e.g., `currentView`, `isRecording`, `activeTab`), encounter details (e.g., `patientDetails`, `selectedLocation`, `selectedProfileId`), transcript data (e.g., `finalTranscript`, `editablePolishedNote`), and WebSocket/MediaRecorder status (e.g., `sessionId`, `error`).
    *   Uses `useRef` for `mediaRecorderRef`, `webSocketRef`, and `audioStreamRef` to manage media and network resources.
    *   Contains numerous `useEffect` hooks for:
        *   Initializing/resetting state.
        *   Combining interim and final transcripts.
        *   Setting default transcription profile and location based on user settings.
        *   Cleaning up WebSocket connections and media streams on component unmount or when recording stops.
        *   Synchronizing `editablePolishedNote` with `polishedTranscriptContent` from context when viewing existing recordings.
    *   **Internal Handler Functions:**
        *   [`_startRecordingProcess = async () => { ... }`](my-vite-react-app/src/components/AudioRecorder.jsx:199): Initializes a new recording session (or resumes a paused one). Gets microphone access, establishes a WebSocket connection to the backend (`ws://localhost:8000/stream`), sends initial metadata (user ID, profile ID), and starts `MediaRecorder` to capture audio and send it over the WebSocket. Handles WebSocket events for incoming transcripts and errors.
        *   [`stopRecording = () => { ... }`](my-vite-react-app/src/components/AudioRecorder.jsx:412): Stops the `MediaRecorder`, closes the WebSocket connection, and releases the audio stream. Used for pausing a recording.
        *   [`handleSaveSession = async () => { ... }`](my-vite-react-app/src/components/AudioRecorder.jsx:438): Sends the current session's data (combined transcript, patient context, location, user ID) to the backend API endpoint (`/api/v1/save_session_data`) for processing and permanent storage. Updates the recording status in the `RecordingsContext`.
        *   [`handleStartEncounter = () => { ... }`](my-vite-react-app/src/components/AudioRecorder.jsx:533): Switches the view to 'recording' and initializes a new session ID, marking a pending recording in the context.
        *   [`handleCancelAndClose = () => { ... }`](my-vite-react-app/src/components/AudioRecorder.jsx:542): Resets the component state, closes any active WebSocket or media streams, and removes any unsaved pending recording from the context. Switches view back to 'setup'.
        *   [`a11yProps = (index) => { ... }`](my-vite-react-app/src/components/AudioRecorder.jsx:578): Helper function to generate accessibility props for Material-UI Tabs.
        *   `handleTranscriptDisplayTabChange`: Manages tab selection in the transcript viewer.
        *   `handleTabChange`: Manages tab selection in the recording view (Transcript/Note).
    *   **Internal Component:**
        *   [`TabPanel = (props) => { ... }`](my-vite-react-app/src/components/AudioRecorder.jsx:590): A helper component for rendering Material-UI Tab content.
    *   **Conditional Rendering Logic:**
        *   If `selectedRecordingId` (from `RecordingsContext`) is present, it renders a detailed view for that recording, allowing users to see original/polished transcripts, edit the polished note, and save it as a PDF.
        *   Otherwise, it renders either the 'setup' view or the 'recording' view based on `currentView` state.
        *   Shows loading indicators if Auth0 or user settings are loading.
        *   Shows a login prompt if the user is not authenticated.
    *   **UI Elements (largely Material-UI):**
        *   Setup View: TextFields for patient details/context, Select dropdowns for location and transcription profile, Switch for multilingual support, Button to start encounter.
        *   Recording View: Buttons to start/pause/resume streaming, generate/save note, close session. Tabs to switch between live transcript and (future) note view. Displays live `combinedTranscript` and `saveStatusMessage`.
        *   Transcript Viewer (for existing recordings): Tabs for original/polished transcript, TextField for editing polished note, Buttons to edit/save changes and save as PDF (using [`generatePdfFromText`](my-vite-react-app/src/components/pdfUtils.js:10)).

**Major Dependencies:**
*   **Internal:**
    *   `../contexts/RecordingsContext` ([`useRecordings`](my-vite-react-app/src/contexts/RecordingsContext.jsx:6)): For accessing and updating recordings list, selected recording details, and transcript content.
    *   `../contexts/UserSettingsContext` ([`useUserSettings`](my-vite-react-app/src/contexts/UserSettingsContext.jsx:6)): For accessing user-defined transcription profiles and office locations.
    *   `./pdfUtils` ([`generatePdfFromText`](my-vite-react-app/src/components/pdfUtils.js:10)): For generating PDF documents from the polished note.
*   **External:**
    *   `react` (hooks: `useState`, `useRef`, `useEffect`).
    *   `@auth0/auth0-react` ([`useAuth0`](my-vite-react-app/src/components/AuthLoading.jsx:0)): For accessing user authentication state and user information.
    *   `@mui/material`: Extensive use of Material-UI components for the UI (e.g., `Box`, `Button`, `TextField`, `Select`, `Tabs`, `CircularProgress`, `Grid`, etc.).
    *   Browser APIs: `navigator.mediaDevices.getUserMedia`, `MediaRecorder`, `WebSocket`.

### my-vite-react-app/src/components/AuthLoading.jsx

**Summary:** This React component displays a loading indicator screen. It's specifically used to show a "Loading authentication..." message with a circular progress spinner while the Auth0 authentication process (like redirection) is in progress. This provides visual feedback to the user during the authentication flow.

**Key Definitions:**
*   **[`AuthLoading = () => { ... }`](my-vite-react-app/src/components/AuthLoading.jsx:4) (React Functional Component)**:
    *   **Props:** None.
    *   **Rendered UI:**
        *   Uses Material-UI's `Box` component as a full-viewport container, centering its content both vertically and horizontally.
        *   Displays a Material-UI `CircularProgress` indicator.
        *   Shows a Material-UI `Typography` element with the text "Loading authentication...".

**Major Dependencies:**
*   **Internal:** None.
*   **External:**
    *   `react`.
    *   `@mui/material` (`Box`, `CircularProgress`, `Typography`): Material-UI components for layout and the loading UI.

### my-vite-react-app/src/components/CustomVocabularyTab.jsx

**Summary:** This React component provides a tab interface within the application's settings page for managing a user's custom vocabulary. Users can add new words or phrases and delete existing ones. The component receives the initial vocabulary list and a function to save changes via props, presumably from a context like `UserSettingsContext`. It ensures that vocabulary items are stored as objects with a `term` property.

**Key Definitions:**
*   **[`CustomVocabularyTab({ customVocabulary: initialCustomVocabulary, saveCustomVocabulary, settingsLoading })`](my-vite-react-app/src/components/CustomVocabularyTab.jsx:6) (React Functional Component)**:
    *   **Props:**
        *   `customVocabulary` (array, aliased as `initialCustomVocabulary`): The initial list of custom vocabulary items.
        *   `saveCustomVocabulary` (function): A callback function to save the updated list of custom vocabulary.
        *   `settingsLoading` (boolean): Indicates if settings are currently being loaded, used to display a loading message.
    *   **State:**
        *   `vocabulary` (array, managed by `useState`): Stores the current list of custom vocabulary items (each item is an object like `{ term: "..." }`).
    *   **`useEffect` Hook**:
        *   Synchronizes the internal `vocabulary` state with the `initialCustomVocabulary` prop, ensuring that items are correctly formatted as objects (converting strings to `{ term: "string" }` if necessary). This handles prop updates, such as when settings are reloaded.
    *   **Internal Functions:**
        *   [`handleAddWord()`](my-vite-react-app/src/components/CustomVocabularyTab.jsx:21): Prompts the user to enter a new word or phrase. If a valid, non-duplicate word is entered, it adds it to the `vocabulary` state and calls `saveCustomVocabulary` with the updated list.
        *   [`handleDeleteWord(termToDelete)`](my-vite-react-app/src/components/CustomVocabularyTab.jsx:37): Filters out the specified term from the `vocabulary` state and calls `saveCustomVocabulary` with the updated list.
    *   **Rendered UI:**
        *   Displays a loading message if `settingsLoading` is true.
        *   Otherwise, renders a Material-UI `Card` containing:
            *   A "New Word/Phrase" button (`<Button startIcon={<AddIcon />}>`) to trigger `handleAddWord`.
            *   A Material-UI `List` displaying the current vocabulary items. Each item (`ListItem`) shows the term and has a `DeleteIcon` button to trigger `handleDeleteWord`.
            *   A message indicating "No custom vocabulary defined yet" if the list is empty.

**Major Dependencies:**
*   **Internal:** None.
*   **External:**
    *   `react` (hooks: `useState`, `useEffect`).
    *   `@mui/material` (`Box`, `Button`, `List`, `ListItem`, `ListItemText`, `Card`, `CardContent`, `Typography`, `IconButton`): Material-UI components for the UI.
    *   `@mui/icons-material` (`AddIcon`, `DeleteIcon`): Material-UI icons.

### my-vite-react-app/src/components/EasySetupModal.jsx

**Summary:** This React component provides a modal dialog for an "Easy Template Setup". It allows users to select a predefined note structure (e.g., SOAP, Narrative) and add custom instructions. It then uses these selections, along with globally available macro phrases and custom vocabulary (from `TemplateContext`), to generate LLM (Large Language Model) instructions via a utility function. The generated template instructions are currently shown in an alert.

**Key Definitions:**
*   **`style` (constant object)**: Defines the MUI styling for the modal's content box, positioning it centrally.
*   **[`EasySetupModal({ open, onClose })`](my-vite-react-app/src/components/EasySetupModal.jsx:18) (React Functional Component)**:
    *   **Props:**
        *   `open` (boolean): Controls the visibility of the modal.
        *   `onClose` (function): Callback invoked when the modal requests to be closed.
    *   **State:**
        *   `structure` (string, managed by `useState`): Stores the selected note structure (default: 'SOAP').
        *   `customInstructions` (string, managed by `useState`): Stores any additional instructions entered by the user.
    *   **Context Usage:**
        *   `useTemplate()`: Retrieves `macroPhrases` and `customVocabulary` from [`TemplateContext`](my-vite-react-app/src/contexts/TemplateContext.jsx:0).
    *   **Internal Functions:**
        *   [`handleGenerate()`](my-vite-react-app/src/components/EasySetupModal.jsx:23): Called when the "Generate Template" button is clicked. It assembles a `template` object from the selected structure, custom instructions, and context-derived macros/vocabulary. It then calls [`generateLLMInstructions`](my-vite-react-app/src/utils/generateLLMInstructions.js:0) to create the final LLM prompt, displays this prompt in an alert, and closes the modal.
    *   **Rendered UI:**
        *   Uses Material-UI's `Modal` component.
        *   Displays a title "Easy Template Setup".
        *   Includes a Material-UI `Select` dropdown for choosing the "Note Structure" (SOAP, Narrative, DAP, etc.).
        *   Includes a Material-UI `TextField` (multi-line) for "Additional Instructions".
        *   Provides "Close" and "Generate Template" buttons.

**Major Dependencies:**
*   **Internal:**
    *   `../contexts/TemplateContext` ([`useTemplate`](my-vite-react-app/src/contexts/TemplateContext.jsx:5)): To access global macro phrases and custom vocabulary.
    *   `../utils/generateLLMInstructions` ([`generateLLMInstructions`](my-vite-react-app/src/utils/generateLLMInstructions.js:0)): Utility function to create LLM prompts based on the template configuration.
*   **External:**
    *   `react` (specifically `useState` hook).
    *   `@mui/material` (`Modal`, `Box`, `Typography`, `TextField`, `Button`, `FormControl`, `InputLabel`, `Select`, `MenuItem`): Material-UI components for the modal interface.

### my-vite-react-app/src/components/LoginButton.jsx

**Summary:** This React component renders a "Log In" button. When clicked, it triggers the Auth0 `loginWithRedirect` function, initiating the authentication process by redirecting the user to the Auth0 login page.

**Key Definitions:**
*   **[`LoginButton = () => { ... }`](my-vite-react-app/src/components/LoginButton.jsx:5) (React Functional Component)**:
    *   **Props:** None.
    *   **Context Usage:**
        *   `useAuth0()`: Retrieves the `loginWithRedirect` function from the Auth0 context.
    *   **Rendered UI:**
        *   Renders a Material-UI `Button` with the text "Log In".
        *   The `onClick` handler for the button calls `loginWithRedirect()`.

**Major Dependencies:**
*   **Internal:** None.
*   **External:**
    *   `react`.
    *   `@auth0/auth0-react` ([`useAuth0`](my-vite-react-app/src/components/AuthLoading.jsx:0)): To access Auth0 authentication functions.
    *   `@mui/material/Button`: The Material-UI component for the button.

### my-vite-react-app/src/components/LogoutButton.jsx

**Summary:** This React component renders a "Log Out" button. When clicked, it triggers the Auth0 `logout` function, initiating the logout process. It's configured to return the user to the application's origin (homepage) after successful logout.

**Key Definitions:**
*   **[`LogoutButton = () => { ... }`](my-vite-react-app/src/components/LogoutButton.jsx:5) (React Functional Component)**:
    *   **Props:** None.
    *   **Context Usage:**
        *   `useAuth0()`: Retrieves the `logout` function from the Auth0 context.
    *   **Rendered UI:**
        *   Renders a Material-UI `Button` with the text "Log Out".
        *   The `onClick` handler calls `logout({ logoutParams: { returnTo: window.location.origin } })`, which logs the user out and then redirects them back to the application's root URL.

**Major Dependencies:**
*   **Internal:** None.
*   **External:**
    *   `react`.
    *   `@auth0/auth0-react` ([`useAuth0`](my-vite-react-app/src/components/AuthLoading.jsx:0)): To access Auth0 authentication functions.
    *   `@mui/material/Button`: The Material-UI component for the button.

### my-vite-react-app/src/components/MacroPhrasesTab.jsx

**Summary:** This React component provides a tab interface within the application's settings for managing user-defined macro phrases. It features a two-column layout: a list of existing macros on the left, and an editor on the right to create new macros or modify selected ones. Each macro consists of a "trigger" string and a "phrase" it expands to. The component handles parsing, displaying, creating, editing, and deleting these macros, and uses a callback prop to save changes.

**Key Definitions:**
*   **[`parseMacroString(macroStr)`](my-vite-react-app/src/components/MacroPhrasesTab.jsx:17) (Utility Function)**:
    *   Takes a string (potentially in an older "trigger: phrase" format) and attempts to parse it into an object with `trigger` and `phrase` properties. Handles cases where the input is not a string or doesn't match the expected format.
*   **[`MacroPhrasesTab({ macroPhrases: initialMacroPhrases, saveMacroPhrases, settingsLoading })`](my-vite-react-app/src/components/MacroPhrasesTab.jsx:26) (React Functional Component)**:
    *   **Props:**
        *   `macroPhrases` (array, aliased as `initialMacroPhrases`): The initial list of macro phrase items.
        *   `saveMacroPhrases` (function): Callback to save the updated list of macros.
        *   `settingsLoading` (boolean): Indicates if settings are loading, used to display a loading message.
    *   **State:**
        *   `macros` (array): Stores the current list of macro objects (each with `trigger` and `phrase`).
        *   `selectedMacroIndex` (number | null): Index of the currently selected macro in the `macros` list, or `null` if none is selected for editing.
        *   `isCreatingNew` (boolean): Flag indicating if the editor is in "create new macro" mode.
        *   `editForm` (object): Stores the `trigger` and `phrase` for the macro currently being edited or created.
    *   **`useEffect` Hook**:
        *   Synchronizes the internal `macros` state with `initialMacroPhrases` prop. It ensures all items are consistently formatted as objects (using `parseMacroString` for backward compatibility if items are strings). It also resets the editor if the selected macro becomes invalid due to prop updates.
    *   **Internal Functions:**
        *   [`handleNewMacroClick()`](my-vite-react-app/src/components/MacroPhrasesTab.jsx:50): Sets up the UI state for creating a new macro (clears selection, sets `isCreatingNew` to true, resets `editForm`).
        *   [`handleMacroSelect(index)`](my-vite-react-app/src/components/MacroPhrasesTab.jsx:56): Sets the selected macro for editing based on its index in the list and populates `editForm`.
        *   [`handleInputChange(event)`](my-vite-react-app/src/components/MacroPhrasesTab.jsx:63): Updates the `editForm` state as the user types in the trigger or phrase TextFields.
        *   [`handleSave()`](my-vite-react-app/src/components/MacroPhrasesTab.jsx:68): Saves the macro currently in `editForm`. If `isCreatingNew` is true, it adds a new macro to the `macros` list; otherwise, it updates the macro at `selectedMacroIndex`. It then calls `saveMacroPhrases` with the updated list. Validates that the trigger is not empty.
        *   [`handleDelete()`](my-vite-react-app/src/components/MacroPhrasesTab.jsx:99): Deletes the macro at `selectedMacroIndex` (if one is selected and not in "create new" mode). It updates the `macros` state and calls `saveMacroPhrases`. Resets the editor state.
    *   **Rendered UI:**
        *   Displays a loading message if `settingsLoading` is true.
        *   Otherwise, uses a Material-UI `Grid` for a two-column layout:
            *   **Left Column (List of Macros):**
                *   A "New Macro" button.
                *   A scrollable `List` of `ListItemButton`s, each representing a macro. Displays the macro's trigger and a snippet of its phrase. Clicking a macro selects it for editing.
                *   Shows a message if no macros are defined.
            *   **Right Column (Editor Area):**
                *   If `showEditor` (i.e., `isCreatingNew` is true or a macro is selected) is true:
                    *   Displays a title ("Create New Macro" or "Edit Macro").
                    *   Two `TextField` components for editing the `trigger` and `phrase`.
                    *   "Delete" and "Save Changes"/"Create Macro" buttons. The delete button is disabled if no macro is selected for editing or if creating a new one. The save button is disabled if the trigger is empty.
                *   If `showEditor` is false (no macro selected and not creating new):
                    *   Displays a placeholder message prompting the user to select a macro or create a new one.

**Major Dependencies:**
*   **Internal:** None.
*   **External:**
    *   `react` (hooks: `useState`, `useEffect`).
    *   `@mui/material` (numerous components like `Box`, `Button`, `List`, `ListItem`, `Grid`, `TextField`, `Typography`, `Paper`, etc.): For UI layout and elements.
    *   `@mui/icons-material` (`AddIcon`, `DeleteIcon`): For button icons.

### my-vite-react-app/src/components/NarrativeTemplatesTab.jsx

**Summary:** This React component provides a UI for users to browse pre-defined narrative templates categorized by medical specialty. Users can select a template, view its sample narrative and LLM instructions, configure associated Deepgram transcription options (like smart formatting, diarization), and then save this configuration as a new "Transcription Profile" via a callback function.

**Key Definitions:**
*   **`medicalSpecialties` (constant array)**: A predefined list of medical specialty strings (e.g., 'Ortho Spine', 'Pain Management').
*   **`templatesBySpecialty` (constant object)**: A hardcoded object mapping each medical specialty to an array of template objects. Each template object contains an `id`, `name`, `llmInstructions` (string), and `sampleNarrative` (string).
*   **[`NarrativeTemplatesTab({ addTranscriptionProfile, settingsLoading })`](my-vite-react-app/src/components/NarrativeTemplatesTab.jsx:55) (React Functional Component)**:
    *   **Props:**
        *   `addTranscriptionProfile` (function): A callback function (likely from `UserSettingsContext`) used to add the newly configured template as a transcription profile to the user's settings.
        *   `settingsLoading` (boolean): Indicates if user settings are currently being loaded, used to disable UI elements.
    *   **State:**
        *   `selectedSpecialty` (string): Stores the currently selected medical specialty.
        *   `selectedTemplate` (object | null): Stores the template object selected by the user from `templatesBySpecialty`.
        *   `saveButtonState` (object): Manages the appearance (text, icon, color) and disabled state of the "Save to Transcription Profile" button, providing visual feedback during the save operation.
        *   `isSavingProfile` (boolean): A flag to indicate if a save operation is currently in progress.
        *   Deepgram options state: `smartFormat` (boolean), `diarize` (boolean), `numSpeakers` (number), `utterances` (boolean) – these control the Deepgram settings for the profile being created.
    *   **`useEffect` Hooks**:
        *   One hook manages the `saveButtonState` based on `selectedSpecialty`, `selectedTemplate`, `settingsLoading`, and `isSavingProfile` to enable/disable the save button and reset its appearance.
        *   Another hook resets the Deepgram options (smartFormat, diarize, etc.) to their defaults whenever a new `selectedTemplate` is chosen.
    *   **Internal Functions:**
        *   [`handleSpecialtyChange(event)`](my-vite-react-app/src/components/NarrativeTemplatesTab.jsx:100): Updates `selectedSpecialty` based on user selection from the dropdown and resets `selectedTemplate`.
        *   [`handleTemplateSelect(template)`](my-vite-react-app/src/components/NarrativeTemplatesTab.jsx:105): Sets the `selectedTemplate` when a user clicks on a template button.
        *   [`handleSaveProfile = async ()`](my-vite-react-app/src/components/NarrativeTemplatesTab.jsx:109):
            *   Sets `isSavingProfile` to true and updates `saveButtonState` to "Saving...".
            *   Constructs a `profileToSave` object containing a generated ID, name (derived from specialty and template name), the `llmInstructions` from the selected template, and the current Deepgram options state.
            *   Calls the `addTranscriptionProfile` prop function.
            *   Based on the success, duplicate, or error status returned, updates the `saveButtonState` to "Saved!", "Already Saved!", or "Save Failed" with corresponding icons and colors.
            *   After a timeout, resets `isSavingProfile` and the `saveButtonState` to its default.
    *   **Rendered UI:**
        *   A Material-UI `Select` dropdown to choose a "Medical Specialty" from `medicalSpecialties`.
        *   If a specialty is selected, it dynamically renders `Button`s for each template available in `templatesBySpecialty[selectedSpecialty]`.
        *   If a template is selected (`selectedTemplate` is not null):
            *   Displays the `sampleNarrative` and `llmInstructions` of the selected template.
            *   Shows a section with Material-UI `Switch` controls for "Enable Smart Formatting", "Enable Speaker Diarization", "Enable Word-Level Timestamps", and a `TextField` for "Number of Speakers" (visible if diarization is enabled).
            *   A "Save to Transcription Profile" `Button` whose appearance and state are managed by `saveButtonState`.

**Major Dependencies:**
*   **Internal:** None explicitly imported, but relies on the structure of data passed via `addTranscriptionProfile` prop (likely related to models in [`backend/core_models.py`](backend/core_models.py:0) or [`backend/main.py`](backend/main.py:0)).
*   **External:**
    *   `react` (hooks: `useState`, `useEffect`).
    *   `@mui/material` (various components like `Box`, `Typography`, `FormControl`, `InputLabel`, `Select`, `MenuItem`, `Button`, `Paper`, `Grid`, `FormControlLabel`, `Switch`, `TextField`, `CircularProgress`): For UI construction.
    *   `@mui/icons-material` (`CheckCircleOutlineIcon`, `WarningAmberIcon`, `ErrorOutlineIcon`): For visual feedback on the save button.

### my-vite-react-app/src/components/NoteStructureTab.jsx

**Summary:** This React component provides a UI tab within the application settings for users to configure their preferred note structure and output format for generated medical notes. It allows selection from predefined structures (SOAP, DAP, etc.), choice of output format (paragraph or bullet points), an option to include diagnosis suggestions, and a field for custom LLM instructions. It uses context for macro phrases and custom vocabulary, and includes a feature to view sample notes based on current selections. The save functionality currently alerts and logs the generated LLM instructions and template object, with a TODO to send it to the backend.

**Key Definitions:**
*   **`modalStyle` (constant object)**: Defines MUI styling for a sample view modal.
*   **[`NoteStructureTab()`](my-vite-react-app/src/components/NoteStructureTab.jsx:23) (React Functional Component)**:
    *   **Props:** None (it's a self-contained settings tab).
    *   **State:**
        *   `structure` (string): Selected note structure (e.g., 'SOAP').
        *   `customInstructions` (string): User-entered custom LLM instructions.
        *   `showDiagnoses` (boolean): Whether to include diagnosis suggestions.
        *   `outputFormat` (string): Selected output format ('paragraph' or 'bullet_points').
        *   `sampleModalOpen` (boolean): Controls visibility of the sample note modal.
        *   `currentSampleText` (string): The text content of the sample note being viewed.
        *   `currentSampleTitle` (string): The title for the sample note modal.
    *   **Context Usage:**
        *   `useTemplate()`: Retrieves `macroPhrases` and `customVocabulary` from [`TemplateContext`](my-vite-react-app/src/contexts/TemplateContext.jsx:0).
    *   **Internal Functions:**
        *   [`handleSave()`](my-vite-react-app/src/components/NoteStructureTab.jsx:34): Collects all current settings into a `template` object, generates LLM instructions using [`generateLLMInstructions`](my-vite-react-app/src/utils/generateLLMInstructions.js:0), displays an alert, and logs the instructions and template. Contains a TODO for backend integration.
        *   [`handleOutputFormatChange(event, newFormat)`](my-vite-react-app/src/components/NoteStructureTab.jsx:50): Updates the `outputFormat` state.
        *   [`handleViewSample(selectedStructure)`](my-vite-react-app/src/components/NoteStructureTab.jsx:56): Gets a sample note using [`getNoteSample`](my-vite-react-app/src/utils/getNoteSample.js:0) based on the selected structure and current output format, then opens the sample modal with the content.
        *   [`handleCloseSampleModal()`](my-vite-react-app/src/components/NoteStructureTab.jsx:63): Closes the sample note modal and clears its content.
        *   [`renderStructureOption(value, label)`](my-vite-react-app/src/components/NoteStructureTab.jsx:69): A helper function to render a `FormControlLabel` containing a `Radio` button for a note structure option, along with a "View Sample" `IconButton`.
    *   **Rendered UI:**
        *   Uses a Material-UI `Card` as the main container.
        *   A `RadioGroup` for selecting the "Template Structure" (SOAP, DAP, etc.), using `renderStructureOption` to display each option with a view sample button.
        *   A `ToggleButtonGroup` for choosing "Output Format" (Paragraph/Bullet Points).
        *   A `Switch` to toggle "Show visit diagnoses suggestions".
        *   A `TextField` for "Custom Instructions".
        *   A "Save to Template" `Button` that triggers `handleSave`.
        *   A Material-UI `Dialog` (modal) for displaying sample notes, controlled by `sampleModalOpen`.

**Major Dependencies:**
*   **Internal:**
    *   `../contexts/TemplateContext` ([`useTemplate`](my-vite-react-app/src/contexts/TemplateContext.jsx:5)): For accessing global macro phrases and custom vocabulary.
    *   `../utils/generateLLMInstructions` ([`generateLLMInstructions`](my-vite-react-app/src/utils/generateLLMInstructions.js:0)): To create LLM prompts from the configured template.
    *   `../utils/getNoteSample` ([`getNoteSample`](my-vite-react-app/src/utils/getNoteSample.js:0)): To fetch sample note text based on structure and format.
*   **External:**
    *   `react` (specifically `useState` hook).
    *   `@mui/material` (various components like `Box`, `FormControl`, `Radio`, `RadioGroup`, `TextField`, `Button`, `Card`, `Switch`, `ToggleButton`, `ToggleButtonGroup`, `Typography`, `Modal`, `IconButton`, `Dialog`, etc.): For UI elements.
    *   `@mui/icons-material` (`VisibilityIcon`): For the "view sample" button.

### my-vite-react-app/src/components/OfficeInformationTab.jsx

**Summary:** This React component provides a tab interface within the application's settings page for managing a list of office locations. Users can add new office location strings (which can be multi-line) and delete existing ones from a list. It receives the current list of office locations and a function to save changes via props, likely from `UserSettingsContext`.

**Key Definitions:**
*   **[`OfficeInformationTab({ officeInformation, saveOfficeInformation, settingsLoading })`](my-vite-react-app/src/components/OfficeInformationTab.jsx:5) (React Functional Component)**:
    *   **Props:**
        *   `officeInformation` (array of strings): The current list of office location strings.
        *   `saveOfficeInformation` (function): A callback function to save the updated list of office locations.
        *   `settingsLoading` (boolean): Indicates if settings are currently loading, used to display a loading message and disable inputs.
    *   **State:**
        *   `newOfficeText` (string, managed by `useState`): Stores the text entered by the user for a new office location.
    *   **Internal Functions:**
        *   [`handleInputChange(e)`](my-vite-react-app/src/components/OfficeInformationTab.jsx:8): Updates `newOfficeText` as the user types in the TextField.
        *   [`handleAddOffice()`](my-vite-react-app/src/components/OfficeInformationTab.jsx:12): If `newOfficeText` is not empty, it adds the trimmed string to the existing `officeInformation` list and calls `saveOfficeInformation` with the updated list. Resets `newOfficeText`.
        *   [`handleDeleteOffice(indexToDelete)`](my-vite-react-app/src/components/OfficeInformationTab.jsx:22): Removes the office location string at the specified index from the `officeInformation` list and calls `saveOfficeInformation`.
    *   **Rendered UI:**
        *   Displays a loading message if `settingsLoading` is true.
        *   Otherwise, renders:
            *   A title "Manage Office Locations".
            *   A `Paper` component containing a multi-line `TextField` for entering a "New Office Location" and an "Add" `Button`.
            *   A section titled "Current Office Locations".
            *   A Material-UI `List` displaying the current office locations. Each `ListItem` shows the office location string and has a `DeleteIcon` button to trigger `handleDeleteOffice`.
            *   A message indicating "No office locations added yet" if the list is empty.

**Major Dependencies:**
*   **Internal:** None.
*   **External:**
    *   `react` (specifically `useState` hook).
    *   `@mui/material` (`Box`, `Typography`, `TextField`, `Button`, `List`, `ListItem`, `ListItemText`, `IconButton`, `Paper`): Material-UI components for the UI.
    *   `@mui/icons-material` (`DeleteIcon`): Material-UI icon for the delete button.

### my-vite-react-app/src/components/pdfUtils.js

**Summary:** This JavaScript module provides a utility function for generating PDF documents from text content using the `jspdf` library. It allows customization of font size, line height, page margins, and can optionally include a location string at the top-left of the PDF. The generated PDF is then automatically downloaded by the browser.

**Key Definitions:**
*   **[`generatePdfFromText = (textContent, fileName = "document.pdf", location = "", options = {}) => { ... }`](my-vite-react-app/src/components/pdfUtils.js:12)**:
    *   **Parameters:**
        *   `textContent` (string): The main text content to be included in the PDF.
        *   `fileName` (string, optional): The desired filename for the downloaded PDF (defaults to "document.pdf").
        *   `location` (string, optional): An optional string to display at the top-left of the PDF.
        *   `options` (object, optional): An object for configuring PDF generation, including:
            *   `fontSize` (number, default: 10): Font size for the main text.
            *   `locationFontSize` (number, default: 8): Font size for the location text.
            *   `lineHeightFactor` (number, default: 1.2): Line height multiplier.
            *   `pageMargins` (object, default: `{ top: 20, right: 20, bottom: 20, left: 20 }`): Page margins in mm.
            *   `maxWidth` (number, default: page width - horizontal margins): Maximum width for text lines.
    *   **Functionality:**
        *   Validates that `textContent` is provided and is a string; otherwise, it shows an alert and returns.
        *   Initializes a `jsPDF` document.
        *   If a `location` string is provided, it's rendered at the top of the first page (and subsequent pages if the main content flows over) using `locationFontSize`.
        *   Sets the font size for the main `textContent`.
        *   Splits the `textContent` into lines that fit within the `maxWidth`.
        *   Iterates through the lines, adding them to the PDF page by page. It handles page breaks automatically, ensuring text does not overflow the bottom margin. If a new page is added and a `location` was provided, the location text is re-added at the top of the new page.
        *   Finally, it attempts to save the generated PDF with the specified `fileName`, catching and logging any errors.

**Major Dependencies:**
*   **Internal:** None.
*   **External:**
    *   `jspdf` (specifically the `jsPDF` class): The core library used for PDF generation.

### my-vite-react-app/src/components/RecentRecordingItem.jsx

**Summary:** This React component is responsible for rendering a single item in a list of recent recordings. It displays the recording's name, status (e.g., pending, saving, saved, failed) with corresponding icons, and provides functionality to select the recording for detailed viewing (via context) or to delete it. A tooltip shows more detailed information about the recording on hover, especially for saved or failed items.

**Key Definitions:**
*   **`TooltipCompatibleWrapper` (React ForwardRef Component)**:
    *   A simple wrapper component created using `React.forwardRef`. It's designed to be a direct child of a Material-UI `Tooltip` to ensure refs and props are correctly forwarded, which can be necessary for custom components used within Tooltips.
*   **[`RecentRecordingItem({ recording, onDelete })`](my-vite-react-app/src/components/RecentRecordingItem.jsx:19) (React Functional Component)**:
    *   **Props:**
        *   `recording` (object): An object containing the details of the recording to display (e.g., `id`, `name`, `status`, `date`, `error`, S3 paths, etc.).
        *   `onDelete` (function): A callback function invoked when the delete icon for this item is clicked, passing the `recording.id`.
    *   **Context Usage:**
        *   `useRecordings()`: Retrieves `selectRecording` (function to set the currently viewed recording ID) and `selectedRecordingId` (the ID of the currently selected recording for detailed view) from [`RecordingsContext`](my-vite-react-app/src/contexts/RecordingsContext.jsx:0).
    *   **Internal Functions:**
        *   [`handleClick()`](my-vite-react-app/src/components/RecentRecordingItem.jsx:22): Called when the list item is clicked. It calls `selectRecording(recording.id)` to set this recording as the active one for detailed viewing in other parts of the application (e.g., in `AudioRecorder.jsx`).
        *   [`handleDelete(e)`](my-vite-react-app/src/components/RecentRecordingItem.jsx:26): Called when the delete icon is clicked. It stops event propagation (to prevent `handleClick`) and calls the `onDelete` prop with the `recording.id`.
        *   [`formatDate(isoString)`](my-vite-react-app/src/components/RecentRecordingItem.jsx:35): A utility function to format an ISO date string into a more readable locale string (e.g., "May 20, 2025, 11:30 AM").
    *   **Rendered UI:**
        *   Uses a Material-UI `Tooltip` to show detailed information on hover. The content of the tooltip varies based on the recording status, showing S3 paths, context, etc., for saved items, and error details for failed items.
        *   The main list item is a Material-UI `ListItem` component, styled as a button.
        *   It visually indicates if it's the `selectedRecordingId` using MUI's `selected` prop and custom styling.
        *   Displays the `primaryText` (recording name or a default session ID snippet).
        *   Displays `secondaryDisplay` which includes a status icon (`HourglassEmptyIcon`, `CloudSyncIcon`, `CheckCircleOutlineIcon`, `ErrorOutlineIcon`, or `SaveIcon`) and status text (e.g., "Pending...", "Saving to cloud...", "Saved: [date]", "Failed: [error]").
        *   Includes a `ListItemSecondaryAction` with a `DeleteIcon` button to trigger deletion.
        *   Has a left border whose color changes based on the recording's status (orange for pending, blue for saving, red for failed).

**Major Dependencies:**
*   **Internal:**
    *   `../contexts/RecordingsContext` ([`useRecordings`](my-vite-react-app/src/contexts/RecordingsContext.jsx:6)): For selecting a recording and checking if the current item is selected.
*   **External:**
    *   `react`.
    *   `@mui/material` (`ListItem`, `ListItemText`, `Tooltip`, `Typography`, `Box`, `ListItemSecondaryAction`, `IconButton`): Material-UI components for layout and display.
    *   `@mui/icons-material` (`HourglassEmptyIcon`, `SaveIcon`, `CheckCircleOutlineIcon`, `ErrorOutlineIcon`, `CloudSyncIcon`, `DeleteIcon`): Material-UI icons.

### my-vite-react-app/src/components/SettingsTabs.jsx

**Summary:** This React component acts as a container or router for displaying different settings-related tabs. Based on the `tabValue` prop it receives, it conditionally renders one of several imported tab components (e.g., [`NoteStructureTab`](my-vite-react-app/src/components/NoteStructureTab.jsx:0), [`NarrativeTemplatesTab`](my-vite-react-app/src/components/NarrativeTemplatesTab.jsx:0), etc.). It passes down relevant props (like user settings data, save functions, and loading state) to the active tab component.

**Key Definitions:**
*   **[`SettingsTabs({ ...props... })`](my-vite-react-app/src/components/SettingsTabs.jsx:8) (React Functional Component)**:
    *   **Props:**
        *   `tabValue` (number): An integer indicating which tab content to display (0 for Note Structure, 1 for Narrative Templates, etc.).
        *   `transcriptionProfiles` (array): List of transcription profiles.
        *   `addTranscriptionProfile` (function): Callback to add a new transcription profile.
        *   `deleteTranscriptionProfile` (function): Callback to delete a transcription profile.
        *   `macroPhrases` (array): List of macro phrases.
        *   `saveMacroPhrases` (function): Callback to save macro phrases.
        *   `customVocabulary` (array): List of custom vocabulary items.
        *   `saveCustomVocabulary` (function): Callback to save custom vocabulary.
        *   `officeInformation` (array): List of office locations.
        *   `saveOfficeInformation` (function): Callback to save office information.
        *   `settingsLoading` (boolean): Indicates if settings data is currently being loaded.
    *   **Rendered UI:**
        *   Conditionally renders one of the following components based on `tabValue`, passing down the necessary props:
            *   `tabValue === 0`: [`NoteStructureTab`](my-vite-react-app/src/components/NoteStructureTab.jsx:0)
            *   `tabValue === 1`: [`NarrativeTemplatesTab`](my-vite-react-app/src/components/NarrativeTemplatesTab.jsx:0)
            *   `tabValue === 2`: [`MacroPhrasesTab`](my-vite-react-app/src/components/MacroPhrasesTab.jsx:0)
            *   `tabValue === 3`: [`CustomVocabularyTab`](my-vite-react-app/src/components/CustomVocabularyTab.jsx:0)
            *   `tabValue === 4`: [`OfficeInformationTab`](my-vite-react-app/src/components/OfficeInformationTab.jsx:0)
            *   `tabValue === 5`: [`TranscriptionProfilesTab`](my-vite-react-app/src/components/TranscriptionProfilesTab.jsx:0)

**Major Dependencies:**
*   **Internal:**
    *   `./NoteStructureTab.jsx`
    *   `./NarrativeTemplatesTab.jsx`
    *   `./MacroPhrasesTab.jsx`
    *   `./CustomVocabularyTab.jsx`
    *   `./TranscriptionProfilesTab.jsx`
    *   `./OfficeInformationTab.jsx`
*   **External:**
    *   `react` (implicitly, as it's a JSX file).

### my-vite-react-app/src/components/Sidebar.jsx

**Summary:** This React component renders the main sidebar for the application. It provides navigation controls, including a "New Recording" button that clears any selected recording and navigates to the main recording interface, a list of recent recordings (each rendered by [`RecentRecordingItem`](my-vite-react-app/src/components/RecentRecordingItem.jsx:0)), and buttons for "Settings", "Log In", or "Log Out" (conditionally displayed based on authentication state). It uses context for recordings data and Auth0 for authentication status.

**Key Definitions:**
*   **[`Sidebar()`](my-vite-react-app/src/components/Sidebar.jsx:11) (React Functional Component)**:
    *   **Props:** None.
    *   **Context Usage:**
        *   `useRecordings()`: Retrieves `recordings` list, `deletePersistedRecording` function, `isFetchingRecordings` flag, and `selectRecording` function from [`RecordingsContext`](my-vite-react-app/src/contexts/RecordingsContext.jsx:0).
        *   `useAuth0()`: Retrieves `isAuthenticated`, `isLoading` (auth loading state), and `user` object from Auth0 context.
    *   **Routing:**
        *   `useNavigate()`: From `react-router-dom` to handle navigation to settings or the root page.
    *   **Internal Functions:**
        *   [`handleGoToSettings()`](my-vite-react-app/src/components/Sidebar.jsx:28): Navigates to the `/settings` page.
        *   [`handleNewRecordingClick()`](my-vite-react-app/src/components/Sidebar.jsx:32): Calls `selectRecording(null)` to clear any active recording selection and navigates to the root path (`/`) to show the `AudioRecorder` for a new session.
        *   [`handleDeleteRecording(recordingId)`](my-vite-react-app/src/components/Sidebar.jsx:37): Asynchronously calls `deletePersistedRecording(recordingId)` from the context if the user is authenticated.
    *   **Data Processing:**
        *   `processedRecordings`: Filters the `recordings` list to potentially remove 'pending' entries if a 'saved' or 'failed' entry with the same ID exists (though the current logic seems to favor keeping 'pending' or replacing it, which might need review based on intended behavior).
        *   `sortedRecordings`: Sorts the `processedRecordings` by date in descending order.
    *   **Rendered UI:**
        *   Uses Material-UI `Drawer` for a permanent sidebar.
        *   Displays the application title "Dictation App".
        *   A "New Recording" `Button` (disabled if auth is loading or user not authenticated).
        *   A "Recent Recordings" section:
            *   Displays a loading message if `isFetchingRecordings` is true and no recordings are present.
            *   Displays "No recent recordings found" if authenticated and no recordings.
            *   Displays "Login to see recordings" if not authenticated.
            *   Maps over `sortedRecordings` to render a [`RecentRecordingItem`](my-vite-react-app/src/components/RecentRecordingItem.jsx:0) for each, passing the `recording` data and `handleDeleteRecording` as props.
        *   At the bottom:
            *   A `Divider`.
            *   Conditionally displays user email and `LogoutButton` if authenticated, or `LoginButton` if not. Shows a loading message if auth state is loading.
            *   A "Settings" `Button` (disabled if auth is loading or user not authenticated).

**Major Dependencies:**
*   **Internal:**
    *   `./RecentRecordingItem.jsx`: Component for displaying individual recording entries.
    *   `../contexts/RecordingsContext`: For accessing and managing recording data.
    *   `./LoginButton.jsx`: Component for the login button.
    *   `./LogoutButton.jsx`: Component for the logout button.
*   **External:**
    *   `react`.
    *   `@mui/material` (`Drawer`, `Box`, `Button`, `Typography`, `List`, `Divider`, `ListItemText`): For UI elements.
    *   `@mui/icons-material` (`AddIcon`, `SettingsIcon`): For button icons.
    *   `react-router-dom` (`useNavigate`): For programmatic navigation.
    *   `@auth0/auth0-react` ([`useAuth0`](my-vite-react-app/src/components/AuthLoading.jsx:0)): For authentication status and user details.

### my-vite-react-app/src/components/TranscriptionProfilesTab.jsx

**Summary:** This React component provides a tab interface within the application's settings for managing saved transcription profiles. It displays a list of existing profiles, showing their name and associated LLM instructions. Each profile in the list has a delete button to remove it. The component receives the list of profiles and deletion/loading state functionalities via props.

**Key Definitions:**
*   **[`TranscriptionProfilesTab({ transcriptionProfiles, deleteTranscriptionProfile, settingsLoading })`](my-vite-react-app/src/components/TranscriptionProfilesTab.jsx:5) (React Functional Component)**:
    *   **Props:**
        *   `transcriptionProfiles` (array): The list of transcription profile objects (each likely containing `id`, `name`, `llmInstructions`, etc.).
        *   `deleteTranscriptionProfile` (function): A callback function to delete a transcription profile by its ID.
        *   `settingsLoading` (boolean): Indicates if settings (including profiles) are currently being loaded.
    *   **Rendered UI:**
        *   Displays a loading message if `settingsLoading` is true.
        *   Otherwise, renders:
            *   A title "Transcription Profiles Management".
            *   If `transcriptionProfiles` exist, it maps through them to display each profile within a Material-UI `Paper` component.
                *   Each item shows an `IconButton` with a `DeleteIcon` to trigger `deleteTranscriptionProfile(profile.id)`.
                *   It displays the `profile.name` as primary text and `profile.llmInstructions` as secondary text using `ListItemText`.
            *   If no profiles exist, it displays a message prompting the user to save templates from the 'Narrative Templates' tab.

**Major Dependencies:**
*   **Internal:** None.
*   **External:**
    *   `react`.
    *   `@mui/material` (`Box`, `Typography`, `List`, `ListItemText`, `Paper`, `IconButton`): Material-UI components for layout and display.
    *   `@mui/icons-material` (`DeleteIcon`): Material-UI icon for the delete button.

### my-vite-react-app/src/contexts/RecordingsContext.jsx

**Summary:** This file defines the `RecordingsContext` and its provider component, `RecordingsProvider`. This context is central to managing the state related to audio recordings throughout the application. It handles fetching existing recordings from the backend, managing a local list of recordings (including their status like pending, saving, saved, failed), selecting a recording for detailed view, and fetching/displaying its original and polished transcripts from S3. It also provides functions to add, update, and delete recordings both locally and on the server.

**Key Definitions:**
*   **`RecordingsContext = createContext()`**: Initializes the React context.
*   **[`RecordingsProvider({ children })`](my-vite-react-app/src/contexts/RecordingsContext.jsx:6) (React Component)**:
    *   **Props:**
        *   `children`: The child components that will have access to this context.
    *   **Context Usage (Auth0):**
        *   `useAuth0()`: To get authentication status (`isAuthenticated`, `isLoading`), user information (`user`), and `getAccessTokenSilently` for making authenticated API calls.
    *   **State:**
        *   `recordings` (array): Stores the list of recording objects. Initialized from user-specific localStorage if available, then merged with fetched recordings.
        *   `isFetchingRecordings` (boolean): Flag indicating if recordings are currently being fetched from the backend.
        *   `selectedRecordingId` (string | null): The ID of the recording currently selected for detailed viewing.
        *   `originalTranscriptContent` (string | null): Stores the fetched content of the original transcript for the selected recording.
        *   `polishedTranscriptContent` (string | null): Stores the fetched content of the polished transcript for the selected recording (or locally edited version).
        *   `isLoadingSelectedTranscript` (boolean): Flag indicating if the transcripts for the selected recording are being fetched.
        *   `selectedTranscriptError` (string | null): Stores any error message related to fetching selected transcripts.
    *   **`useEffect` Hooks:**
        *   One hook persists the `recordings` state to user-specific localStorage whenever it changes and the user is authenticated. Clears localStorage if the user logs out.
        *   Another hook (`fetchUserRecordings`) is a `useCallback` that fetches the list of saved recordings for the authenticated user from the `/api/v1/user_recordings/{user_id}` backend endpoint. It merges these fetched recordings with any non-'saved' local recordings.
        *   A main `useEffect` hook triggers loading recordings from localStorage and then calls `fetchUserRecordings` when the user becomes authenticated. It clears local recordings if the user is not authenticated.
        *   Another `useEffect` hook is responsible for fetching the original and polished transcript content when `selectedRecordingId` changes. It calls `fetchTranscriptContent` for the S3 paths stored in the selected recording object. It prioritizes locally edited `polishedTranscript` if available on the recording object.
    *   **Callback Functions (exposed via context value):**
        *   [`startPendingRecording(sessionId)`](my-vite-react-app/src/contexts/RecordingsContext.jsx:99): Adds a new recording object with 'pending' status to the local `recordings` list.
        *   [`updateRecording(sessionId, updates)`](my-vite-react-app/src/contexts/RecordingsContext.jsx:112): Updates an existing recording in the `recordings` list with the provided `updates`.
        *   [`removeRecording(sessionId)`](my-vite-react-app/src/contexts/RecordingsContext.jsx:120): Removes a recording from the local `recordings` list.
        *   [`deletePersistedRecording(sessionId)`](my-vite-react-app/src/contexts/RecordingsContext.jsx:124): Makes an authenticated DELETE request to the `/api/v1/recordings/{user_id}/{session_id}` backend endpoint to delete a recording and its associated S3 files. On success, it also calls `removeRecording` to update the local state.
        *   [`addRecording(recording)`](my-vite-react-app/src/contexts/RecordingsContext.jsx:151): Adds a new recording object to the list and sorts the list.
        *   [`fetchTranscriptContent(s3Key, type)`](my-vite-react-app/src/contexts/RecordingsContext.jsx:157): An internal `useCallback` that fetches the content of a text object from S3 via the backend endpoint `/api/v1/s3_object_content`. Used for original and polished transcripts.
        *   [`selectRecording(recordingId)`](my-vite-react-app/src/contexts/RecordingsContext.jsx:177): Sets the `selectedRecordingId`. If `null` is passed, it clears the selection and transcript content.
    *   **Provider Value:** Exposes the `recordings` state, loading flags, selected recording data/state, and the action functions listed above to consuming components.
*   **[`useRecordings = () => useContext(RecordingsContext)`](my-vite-react-app/src/contexts/RecordingsContext.jsx:266)**: Custom hook to easily consume the `RecordingsContext`.

**Major Dependencies:**
*   **Internal:** None.
*   **External:**
    *   `react` (hooks: `createContext`, `useContext`, `useState`, `useEffect`, `useCallback`).
    *   `@auth0/auth0-react` ([`useAuth0`](my-vite-react-app/src/components/AuthLoading.jsx:0)): For authentication status and user details.

### my-vite-react-app/src/contexts/TemplateContext.jsx

**Summary:** This file defines the `TemplateContext` and its provider component, `TemplateProvider`. This context is used to manage and persist user-defined template-related data, specifically `macroPhrases` and `customVocabulary`, across the application. It initializes this data from `localStorage` and saves it back to `localStorage` whenever it changes.

**Key Definitions:**
*   **`TemplateContext = createContext()`**: Initializes the React context.
*   **[`TemplateProvider({ children })`](my-vite-react-app/src/contexts/TemplateContext.jsx:5) (React Component)**:
    *   **Props:**
        *   `children`: The child components that will have access to this context.
    *   **State:**
        *   `macroPhrases` (array): Stores the list of user-defined macro phrases. Initialized from `localStorage.getItem('macroPhrases')` or an empty array.
        *   `customVocabulary` (array): Stores the list of user-defined custom vocabulary items. Initialized from `localStorage.getItem('customVocabulary')` or an empty array.
    *   **`useEffect` Hook**:
        *   Persists both `macroPhrases` and `customVocabulary` to their respective `localStorage` keys (`'macroPhrases'`, `'customVocabulary'`) whenever either state variable changes.
    *   **Provider Value:** Exposes `macroPhrases`, `setMacroPhrases` (the state setter for macro phrases), `customVocabulary`, and `setCustomVocabulary` (the state setter for custom vocabulary) to consuming components.
*   **[`useTemplate = () => useContext(TemplateContext)`](my-vite-react-app/src/contexts/TemplateContext.jsx:27)**: Custom hook to easily consume the `TemplateContext`.

**Major Dependencies:**
*   **Internal:** None.
*   **External:**
    *   `react` (hooks: `createContext`, `useContext`, `useState`, `useEffect`).
    *   Browser `localStorage` API: For persisting and retrieving macro phrases and custom vocabulary.

### my-vite-react-app/src/contexts/UserSettingsContext.jsx

**Summary:** This file defines the `UserSettingsContext` and its provider, `UserSettingsProvider`. This context is responsible for fetching, managing, and saving user-specific settings from/to the backend API. Settings include macro phrases, custom vocabulary, office information, and transcription profiles. It uses Auth0 for user authentication and to obtain access tokens for API calls.

**Key Definitions:**
*   **`UserSettingsContext = createContext()`**: Initializes the React context.
*   **[`useUserSettings = () => useContext(UserSettingsContext)`](my-vite-react-app/src/contexts/UserSettingsContext.jsx:6)**: Custom hook for easy consumption of this context.
*   **[`UserSettingsProvider = ({ children }) => { ... }`](my-vite-react-app/src/contexts/UserSettingsContext.jsx:8) (React Component)**:
    *   **Props:**
        *   `children`: Child components that will have access to this context.
    *   **Context Usage (Auth0):**
        *   `useAuth0()`: To get authentication status (`isAuthenticated`), user information (`user`), and `getAccessTokenSilently` for API calls.
    *   **State:**
        *   `userSettings` (object): Stores the fetched user settings. Initialized with empty arrays for `macroPhrases`, `customVocabulary`, `officeInformation`, and `transcriptionProfiles`.
        *   `settingsLoading` (boolean): Flag indicating if settings are currently being fetched or saved.
        *   `settingsError` (string | null): Stores any error message related to fetching or saving settings.
    *   **Constants:**
        *   `API_BASE_URL`: The base URL for the backend API, read from Vite environment variables (`VITE_API_BASE_URL`) or defaults to `http://localhost:8000`.
    *   **Async Functions (exposed via context value or used internally):**
        *   [`fetchUserSettings = async ()`](my-vite-react-app/src/contexts/UserSettingsContext.jsx:21): Fetches user settings from `/api/v1/user_settings/{user_id}`. Requires authentication. Updates `userSettings`, `settingsLoading`, and `settingsError` states. If settings are not found (404), it uses the initial default empty state.
        *   [`saveUserSettings = async (newSettings)`](my-vite-react-app/src/contexts/UserSettingsContext.jsx:66): Saves the provided `newSettings` object to the backend via a POST request to `/api/v1/user_settings`. Requires authentication. Updates `userSettings` with the saved data on success. Throws an error on failure.
    *   **`useEffect` Hook**:
        *   Calls `fetchUserSettings` when `isAuthenticated` and `user` become available (i.e., after login or on initial load if already authenticated).
    *   **Convenience Updater Functions (exposed via context value):** These functions update a specific part of `userSettings` and then call `saveUserSettings` internally.
        *   `updateOfficeInformation(newOfficeInfo)`
        *   `updateTranscriptionProfiles(newProfiles)`
        *   `updateCustomVocabulary(newVocab)`
        *   `updateMacroPhrases(newMacros)`
    *   **Provider Value:** Exposes `userSettings`, `settingsLoading`, `settingsError`, `fetchUserSettings`, `saveUserSettings`, and the specific updater functions to consuming components.

**Major Dependencies:**
*   **Internal:** None.
*   **External:**
    *   `react` (hooks: `createContext`, `useContext`, `useState`, `useEffect`).
    *   `@auth0/auth0-react` ([`useAuth0`](my-vite-react-app/src/components/AuthLoading.jsx:0)): For authentication details and access tokens.
    *   Browser `fetch` API: For making HTTP requests to the backend.

### my-vite-react-app/src/pages/SettingsPage.jsx

**Summary:** This React component renders the main "Settings" page of the application. It uses Material-UI `Tabs` to organize different categories of settings. The actual content for each tab is delegated to the [`SettingsTabs`](my-vite-react-app/src/components/SettingsTabs.jsx:0) component. This page fetches user settings via the `useUserSettings` context and provides handler functions for adding and deleting transcription profiles, which in turn call the update functions from the context. It also handles loading and error states for authentication and settings fetching.

**Key Definitions:**
*   **[`SettingsPage()`](my-vite-react-app/src/pages/SettingsPage.jsx:7) (React Functional Component)**:
    *   **Props:** None.
    *   **State:**
        *   `tabValue` (number, managed by `useState`): Stores the index of the currently active tab (default: 0).
    *   **Context Usage:**
        *   `useAuth0()`: Retrieves `isAuthenticated` and `isLoading` (auth loading state).
        *   `useUserSettings()`: Retrieves `userSettings`, `settingsLoading`, `settingsError`, and various update functions like `updateOfficeInformation`, `updateTranscriptionProfiles`, `updateCustomVocabulary`, `updateMacroPhrases`.
    *   **Internal Functions:**
        *   [`handleTabChange(event, newValue)`](my-vite-react-app/src/pages/SettingsPage.jsx:21): Updates `tabValue` when the user clicks on a different tab.
        *   [`addTranscriptionProfile(newProfile)`](my-vite-react-app/src/pages/SettingsPage.jsx:25): An async function that takes a `newProfile` object. It checks for duplicate profile IDs. If not a duplicate, it adds the new profile to the existing list from `userSettings.transcriptionProfiles` and calls `updateTranscriptionProfiles` (from context) to save the changes. Returns a status string ('success', 'duplicate', 'error').
        *   [`deleteTranscriptionProfile(profileIdToDelete)`](my-vite-react-app/src/pages/SettingsPage.jsx:47): An async function that filters out the profile with the given ID from `userSettings.transcriptionProfiles` and calls `updateTranscriptionProfiles` (from context) to save the changes.
    *   **Rendered UI:**
        *   Displays loading messages if `authLoading` or `settingsLoading` is true.
        *   Displays an error message if `settingsError` is present.
        *   Prompts the user to log in if `isAuthenticated` is false.
        *   If authenticated and no errors, it renders:
            *   A "Settings" title (`Typography`).
            *   Material-UI `Tabs` component with labels for "Standard Templates", "Narrative Templates", "Macro Phrases", "Custom Vocabulary", "Office Information", and "Transcription Profiles".
            *   The [`SettingsTabs`](my-vite-react-app/src/components/SettingsTabs.jsx:0) component, passing down `tabValue`, the relevant pieces of `userSettings`, the `addTranscriptionProfile` and `deleteTranscriptionProfile` handlers, other update functions from `UserSettingsContext` (aliased as save functions for specific tabs), and `settingsLoading` state.

**Major Dependencies:**
*   **Internal:**
    *   `../components/SettingsTabs.jsx`: The component that renders the content for each selected tab.
    *   `../contexts/UserSettingsContext` ([`useUserSettings`](my-vite-react-app/src/contexts/UserSettingsContext.jsx:6)): For accessing and updating all user-specific settings.
*   **External:**
    *   `react` (specifically `useState` hook).
    *   `@mui/material` (`Tabs`, `Tab`, `Box`, `Typography`): For UI layout and tab navigation.
    *   `@auth0/auth0-react` ([`useAuth0`](my-vite-react-app/src/components/AuthLoading.jsx:0)): For authentication status.

### my-vite-react-app/src/utils/generateLLMInstructions.js

**Summary:** This JavaScript module exports a single function, `generateLLMInstructions`, which dynamically creates a detailed prompt for a Large Language Model (LLM) based on a provided template object. The template object specifies the desired note structure (e.g., SOAP, DAP), output format (paragraph, bullet points), custom instructions, and can include macro phrases and custom vocabulary. The generated instructions guide the LLM in formatting and populating a medical note.

**Key Definitions:**
*   **[`generateLLMInstructions(template)`](my-vite-react-app/src/utils/generateLLMInstructions.js:1) (Function)**:
    *   **Parameter:**
        *   `template` (object): An object containing various configuration options for generating the LLM prompt. Expected properties include:
            *   `structure` (string): The desired note structure (e.g., 'SOAP', 'DAP', 'BIRP').
            *   `outputFormat` (string): 'bullet_points' or 'paragraph'.
            *   `showDiagnoses` (boolean): Whether to instruct the LLM to include diagnoses.
            *   `customInstructions` (string, optional): Any additional free-text instructions from the user.
            *   `macroPhrases` (array, optional): A list of macro phrases. Each item can be a string or an object like `{ trigger: "...", phrase: "..." }`.
            *   `customVocabulary` (array, optional): A list of custom vocabulary items. Each item can be a string or an object like `{ word: "...", sounds_like: [...] }`.
    *   **Functionality:**
        1.  Initializes a `basePrompt` string based on the `template.structure` (SOAP, SOAP_Combined, DAP, BIRP, or a generic fallback).
        2.  Appends instructions regarding the `template.outputFormat` (bullet points or paragraphs).
        3.  Appends instructions regarding `template.showDiagnoses` if true.
        4.  Appends `template.customInstructions` if provided.
        5.  If `template.macroPhrases` are provided, it iterates through them and appends instructions for the LLM to consider or expand these macros.
        6.  If `template.customVocabulary` is provided, it iterates through them and appends instructions for the LLM to pay attention to these terms, including potential phonetic misinterpretations.
        7.  Appends general guidelines for the LLM (clinical accuracy, conciseness, professionalism).
        8.  Returns the fully constructed `finalInstructions` string.

**Major Dependencies:**
*   **Internal:** None. This is a standalone utility function.
*   **External:** None. (Standard JavaScript operations).

### my-vite-react-app/src/utils/getNoteSample.js

**Summary:** This JavaScript module exports a single function, `getNoteSample`, which returns a pre-defined sample medical note string. The sample returned depends on the specified `templateStructure` (e.g., SOAP, DAP) and `outputFormat` (paragraph or bullet points). It contains hardcoded sample texts for various combinations.

**Key Definitions:**
*   **[`getNoteSample(templateStructure, outputFormat)`](my-vite-react-app/src/utils/getNoteSample.js:1) (Function)**:
    *   **Parameters:**
        *   `templateStructure` (string): The desired note structure (e.g., 'SOAP', 'DAP', 'BIRP', 'SOAP_Combined').
        *   `outputFormat` (string): The desired output format, typically 'bullet_points' or 'paragraph'.
    *   **Internal Data:**
        *   `paragraphSamples` (object): An object where keys are template structure strings (e.g., 'SOAP') and values are sample note strings formatted as paragraphs.
        *   `bulletSamples` (object): An object similar to `paragraphSamples`, but values are sample note strings formatted with bullet points.
    *   **Functionality:**
        1.  Checks the `outputFormat`.
        2.  If `outputFormat` is 'bullet_points', it attempts to retrieve the sample from `bulletSamples` using `templateStructure` as the key.
        3.  Otherwise (for paragraph or any other format), it attempts to retrieve the sample from `paragraphSamples`.
        4.  If a specific sample isn't found for the given combination, it returns a fallback message indicating that no sample is available.
        5.  Returns the retrieved sample string or the fallback message.

**Major Dependencies:**
*   **Internal:** None. This is a standalone utility function with hardcoded data.
*   **External:** None. (Standard JavaScript operations).