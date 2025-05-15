1. Required SDK
The Deepgram Python SDK is the primary tool for interacting with Deepgram’s API, including the Nova-3 Medical model for streaming transcription.
SDK Name: deepgram-sdk

Version: The latest version as of my last update is sufficient (e.g., deepgram-sdk>=3.0.0). Always pin to a specific version for production stability (e.g., deepgram-sdk==3.7.2).

Installation:
bash

pip install deepgram-sdk

Ensure you install the SDK in your project’s virtual environment.

Purpose: The SDK supports both pre-recorded and live streaming transcription, including WebSocket-based real-time audio transcription required for streaming with the Nova-3 Medical model.

Source: Deepgram Python SDK documentation.

2. Additional Requirements
To set up streaming transcription with the Nova-3 Medical model using FastAPI and Uvicorn, you need the following dependencies and configurations:
Python Version
Requirement: Python 3.10 or higher is recommended, as Deepgram’s tutorials and examples (e.g., FastAPI streaming) use Python 3.10.

Check Version:
bash

python --version

Ensure your environment uses a compatible version.

FastAPI and Uvicorn
FastAPI: A modern, asynchronous Python web framework for building APIs and handling WebSocket connections.
Installation:
bash

pip install fastapi

Uvicorn: An ASGI server implementation for running FastAPI applications.
Installation:
bash

pip install uvicorn[standard]

The [standard] option includes dependencies like websockets for WebSocket support, which is critical for streaming audio to Deepgram.

Source: FastAPI streaming tutorial.

Other Dependencies
python-dotenv: For managing environment variables (e.g., storing the Deepgram API key).
Installation:
bash

pip install python-dotenv

aiohttp or httpx: For fetching or handling audio streams asynchronously (optional, depending on your audio source).
Installation:
bash

pip install aiohttp

or
bash

pip install httpx

Optional for Microphone Input:
If streaming audio from a microphone, you may need pyaudio or a similar library:
bash

pip install pyaudio

Note: pyaudio may require additional system dependencies (e.g., portaudio on Linux/macOS/Windows).

Source: Deepgram streaming examples and FastAPI integration.

Deepgram API Key
Requirement: A valid Deepgram API key is required to access the Nova-3 Medical model.

How to Obtain:
Sign up at Deepgram Console and generate a free API key.

Store the API key in an environment variable (e.g., in a .env file):
env

DEEPGRAM_API_KEY=your-api-key-here

Load the key in your Python code using python-dotenv:
python

from dotenv import load_dotenv
import os
load_dotenv()
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")

Source: Deepgram SDK setup.

System Requirements
Operating System: Compatible with Windows, macOS, or Linux.

Network: Stable internet connection for WebSocket communication with Deepgram’s API (wss://api.deepgram.com/v1/listen).

Audio Input: For streaming, you need an audio source (e.g., microphone, audio file, or stream). The audio must be in a supported format:
Encoding: linear16 (PCM 16-bit) is recommended for streaming.

Sample Rate: Typically 16000 Hz (default for Deepgram).

Channels: Usually 1 (mono) for medical transcription to simplify processing.

Nova-3 Medical Model Requirements
Model Specification: Use model=nova-3-medical in the SDK options to access the Nova-3 Medical model.

Supported Features:
Real-time multilingual transcription (supports 10 languages, including English).

Keyterm Prompting: Add up to 100 custom medical terms for improved recognition (e.g., drug names, medical procedures).

HIPAA-compliant architecture for secure handling of sensitive patient data.

Smart Formatting (smart_format=true): Enhances transcript readability for medical terms, numbers, and dates.

Redaction: Optional personal information redaction (e.g., PII like credit card numbers).

Streaming-Specific Notes:
The Nova-3 Medical model supports ultra-low latency for real-time transcription, ideal for telemedicine or clinical settings.

Use WebSocket streaming (wss://api.deepgram.com/v1/listen) for live audio.

The keyterms parameter (not keywords, which is unsupported for Nova-3) allows real-time customization of medical terminology.

3. Example Setup for Streaming with FastAPI and Uvicorn
Below is a minimal example of how to set up real-time streaming transcription with the Nova-3 Medical model using FastAPI, Uvicorn, and the Deepgram Python SDK.
Directory Structure

project/
├── main.py
├── templates/
│   └── index.html
├── .env
├── requirements.txt

requirements.txt
text

deepgram-sdk>=3.7.2
fastapi>=0.115.0
uvicorn[standard]>=0.30.6
python-dotenv>=1.0.1
aiohttp>=3.10.5
pyaudio>=0.2.14  # Optional for microphone input

Install dependencies:
bash

pip install -r requirements.txt

.env
env

DEEPGRAM_API_KEY=your-api-key-here

main.py
python

from fastapi import FastAPI, WebSocket
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from fastapi.requests import Request
from deepgram import DeepgramClient, LiveTranscriptionEvents, LiveOptions
import os
from dotenv import load_dotenv
import asyncio

# Initialize FastAPI app
app = FastAPI()
templates = Jinja2Templates(directory="templates")
load_dotenv()

# Initialize Deepgram client
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
deepgram = DeepgramClient(DEEPGRAM_API_KEY)

@app.get("/", response_class=HTMLResponse)
async def get(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.websocket("/listen")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    async def on_transcript(data, **kwargs):
        transcript = data.channel.alternatives[0].transcript
        if transcript:
            await websocket.send_text(transcript)

    async def on_error(error, **kwargs):
        await websocket.send_text(f"Error: {error}")
    
    try:
        # Create WebSocket connection to Deepgram
        dg_connection = deepgram.listen.websocket.v("1")
        dg_connection.on(LiveTranscriptionEvents.Transcript, on_transcript)
        dg_connection.on(LiveTranscriptionEvents.Error, on_error)

        # Configure Nova-3 Medical model options
        options = LiveOptions(
            model="nova-3-medical",
            language="en-US",
            smart_format=True,
            punctuate=True,
            interim_results=True,
            utterance_end_ms="1000",
            vad_events=True,
            keyterms=["cardiology", "oncology", "stethoscope"]  # Example medical terms
        )
        
        # Start Deepgram connection
        await dg_connection.start(options)

        # Receive audio from client and send to Deepgram
        while True:
            data = await websocket.receive_bytes()
            dg_connection.send(data)

    except Exception as e:
        await websocket.send_text(f"Error: {str(e)}")
    finally:
        dg_connection.finish()
        await websocket.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

templates/index.html
html

<!DOCTYPE html>
<html>
<head>
    <title>Live Medical Transcription</title>
</head>
<body>
    <h1>Transcribe Audio with FastAPI and Deepgram</h1>
    <p id="status">Connection status will go here</p>
    <p id="transcript"></p>

    <script>
        let ws = new WebSocket("ws://localhost:8000/listen");
        ws.onopen = () => {
            document.getElementById("status").innerText = "Connected to server";
            startMicrophone();
        };
        ws.onmessage = (event) => {
            document.getElementById("transcript").innerText += event.data + "\n";
        };
        ws.onerror = (error) => {
            document.getElementById("status").innerText = "Error: " + error;
        };
        ws.onclose = () => {
            document.getElementById("status").innerText = "Connection closed";
        };

        async function startMicrophone() {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
                    ws.send(event.data);
                }
            };
            mediaRecorder.start(100); // Send audio chunks every 100ms
        }
    </script>
</body>
</html>

Running the Application
Activate your virtual environment:
bash

source venv/bin/activate  # On macOS/Linux
venv\Scripts\activate     # On Windows

Start the FastAPI server with Uvicorn:
bash

uvicorn main:app --reload

Open a browser and navigate to http://127.0.0.1:8000/.

Allow microphone access when prompted. Speak, and the transcription will appear on the webpage in real-time.

Source: Adapted from Deepgram’s FastAPI streaming tutorial and SDK examples.

4. Configuration Notes for Nova-3 Medical
Model Parameter: Specify model="nova-3-medical" in the LiveOptions to use the medical-specific model.

Keyterm Prompting: Use the keyterms parameter to include up to 100 custom medical terms (e.g., ["metformin", "echocardiogram"]) to improve recognition accuracy for domain-specific terminology.

Audio Format:
Use encoding="linear16", sample_rate=16000, and channels=1 for optimal streaming performance.

Ensure the audio input is compatible (e.g., convert microphone input to PCM 16-bit if necessary).

HIPAA Compliance: The Nova-3 Medical model is HIPAA-compliant, ensuring secure handling of sensitive patient data. Use redaction features (redact=True) if needed to remove PII.

Smart Formatting: Enable smart_format=True to format medical terms, numbers, and dates correctly (e.g., “5 mg” instead of “five milligrams”).

KeepAlive: To maintain a stable WebSocket connection, set "keepalive": "true" in DeepgramClientOptions if there are pauses in audio input.

5. Known Issues and Workarounds
Month Transcription Bug: Some users reported that Nova-3 Medical (and Nova-2 Medical) with smart_format=True incorrectly transcribes months (e.g., “August” as “February”). If this occurs, test with smart_format=False or contact Deepgram support via their Discord community.

WebSocket Stability: Ensure a stable internet connection, as WebSocket connections are sensitive to network interruptions. Use the KeepAlive option to prevent connection drops during silence.

Microphone Access: Ensure browser permissions allow microphone access. Test with a simple audio stream first to verify setup.

6. Additional Recommendations
Virtual Environment: Use a virtual environment to isolate dependencies:
bash

python -m venv venv
source venv/bin/activate  # On macOS/Linux
venv\Scripts\activate     # On Windows

Testing: Test with a sample audio stream (e.g., a WAV file or microphone input) before deploying to production.

Documentation: Refer to Deepgram’s Live Streaming Audio Documentation and Nova-3 Medical Documentation for detailed options and troubleshooting.

Rate Limits: The Nova-3 Medical model supports high concurrency, but be aware of rate limits (e.g., 100 concurrent requests for paid plans). Monitor usage to avoid 504 Gateway Timeout errors.

Cost: Pricing starts at $0.0043 per minute for pre-recorded audio, with streaming costs typically similar. Check Deepgram’s pricing page for details.

7. Summary
SDK: deepgram-sdk>=3.7.2

Dependencies: fastapi, uvicorn[standard], python-dotenv, aiohttp (optional), pyaudio (optional for microphone).

Python: 3.10 or higher.

Deepgram API Key: Required, stored in .env.

Model: nova-3-medical with options like smart_format=True, keyterms, and punctuate=True.

Run: Use uvicorn main:app --reload to start the FastAPI server.

For further assistance, consult Deepgram’s developer documentation or join their Discord community for real-time support. If you encounter issues, provide detailed logs to Deepgram support, as noted in their GitHub discussions.

Let me know if you need help with specific code tweaks or debugging!

12 web pages

Nova-3 Medical features

HIPAA compliance details

