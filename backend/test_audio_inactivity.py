#!/usr/bin/env python3
"""
Test script for audio inactivity detection feature.
This script helps verify that the WebSocket security monitoring is working correctly.
"""

import asyncio
import json
import logging
import os
import time
import websockets
from urllib.parse import urlencode

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class InactivityTester:
    def __init__(self, ws_url: str, auth_token: str):
        self.ws_url = ws_url
        self.auth_token = auth_token
        self.running = True
        self.warning_received = False
        self.disconnect_time = None
        
    async def test_no_audio(self):
        """Test 1: Connect but never send audio - should disconnect after timeout"""
        logger.info("=== Test 1: No Audio Test ===")
        logger.info("Connecting to WebSocket without sending any audio...")
        
        # Add token to URL
        url_with_token = f"{self.ws_url}?{urlencode({'token': self.auth_token})}"
        
        try:
            async with websockets.connect(url_with_token) as websocket:
                start_time = time.time()
                
                # Send initial metadata
                initial_msg = {
                    "type": "initial_metadata",
                    "user_id": "test_user",
                    "profile_id": "default",
                    "is_multilingual": False
                }
                await websocket.send(json.dumps(initial_msg))
                logger.info("Sent initial metadata")
                
                # Listen for messages without sending audio
                while True:
                    try:
                        message = await asyncio.wait_for(websocket.recv(), timeout=1.0)
                        data = json.loads(message)
                        
                        if data.get("type") == "inactivity_warning":
                            elapsed = time.time() - start_time
                            logger.warning(f"[{elapsed:.1f}s] Received inactivity warning: {data.get('message')}")
                            self.warning_received = True
                            
                        elif data.get("type") == "session_init":
                            logger.info(f"Session initialized: {data.get('session_id')}")
                            
                        else:
                            logger.info(f"Received: {data.get('type', 'unknown')}")
                            
                    except asyncio.TimeoutError:
                        # No message received, continue waiting
                        elapsed = time.time() - start_time
                        if elapsed % 5 == 0:  # Log every 5 seconds
                            logger.info(f"Waiting... {elapsed:.0f}s elapsed")
                        continue
                        
        except websockets.exceptions.ConnectionClosedError as e:
            elapsed = time.time() - start_time
            logger.info(f"[{elapsed:.1f}s] Connection closed: code={e.code}, reason={e.reason}")
            self.disconnect_time = elapsed
            
            # Verify expected behavior
            if self.warning_received:
                logger.info("✓ Warning was received before disconnect")
            else:
                logger.error("✗ No warning received before disconnect")
                
            if 14 <= elapsed <= 16:  # Expected around 15s
                logger.info(f"✓ Disconnect time correct: {elapsed:.1f}s")
            else:
                logger.error(f"✗ Unexpected disconnect time: {elapsed:.1f}s (expected ~15s)")
                
    async def test_with_audio_pause(self):
        """Test 2: Send audio, then stop - should warn then disconnect"""
        logger.info("\n=== Test 2: Audio Pause Test ===")
        logger.info("Sending audio for 5 seconds, then stopping...")
        
        url_with_token = f"{self.ws_url}?{urlencode({'token': self.auth_token})}"
        self.warning_received = False
        
        try:
            async with websockets.connect(url_with_token) as websocket:
                start_time = time.time()
                
                # Send initial metadata
                initial_msg = {
                    "type": "initial_metadata",
                    "user_id": "test_user",
                    "profile_id": "default",
                    "is_multilingual": False
                }
                await websocket.send(json.dumps(initial_msg))
                logger.info("Sent initial metadata")
                
                # Create tasks for sending and receiving
                send_task = asyncio.create_task(self.send_audio_loop(websocket, duration=5))
                receive_task = asyncio.create_task(self.receive_messages(websocket, start_time))
                
                # Wait for both tasks
                await asyncio.gather(send_task, receive_task)
                
        except websockets.exceptions.ConnectionClosedError as e:
            elapsed = time.time() - start_time
            logger.info(f"[{elapsed:.1f}s] Connection closed: code={e.code}, reason={e.reason}")
            
    async def send_audio_loop(self, websocket, duration: float):
        """Send dummy audio data for specified duration"""
        chunk_size = 320  # 10ms of 16kHz audio
        interval = 0.01   # Send every 10ms
        
        start = time.time()
        while time.time() - start < duration:
            # Send dummy audio bytes
            await websocket.send(b'\x00' * chunk_size)
            await asyncio.sleep(interval)
            
        logger.info(f"Stopped sending audio after {duration}s")
        
    async def receive_messages(self, websocket, start_time):
        """Receive and log messages"""
        audio_stop_time = None
        
        while True:
            try:
                message = await websocket.recv()
                if isinstance(message, str):
                    data = json.loads(message)
                    elapsed = time.time() - start_time
                    
                    if data.get("type") == "inactivity_warning":
                        logger.warning(f"[{elapsed:.1f}s] Received inactivity warning: {data.get('message')}")
                        self.warning_received = True
                        
                        if audio_stop_time:
                            warning_delay = elapsed - audio_stop_time
                            logger.info(f"Warning received {warning_delay:.1f}s after audio stopped")
                            
                    elif data.get("type") == "session_init":
                        logger.info(f"Session initialized: {data.get('session_id')}")
                        
            except websockets.exceptions.ConnectionClosedError:
                break
                
    async def test_audio_resume(self):
        """Test 3: Send audio, pause to trigger warning, then resume"""
        logger.info("\n=== Test 3: Audio Resume Test ===")
        logger.info("Testing warning recovery by resuming audio...")
        
        # Implementation similar to test 2 but resume audio after warning
        # This validates that warnings can be cleared
        pass

async def main():
    # Get configuration from environment or use defaults
    ws_host = os.getenv("WS_HOST", "localhost:8000")
    auth_token = os.getenv("AUTH_TOKEN", "")
    
    if not auth_token:
        logger.error("Please set AUTH_TOKEN environment variable with a valid Firebase token")
        logger.info("You can get a token by logging into the app and checking network requests")
        return
        
    # Set up test environment
    os.environ["WEBSOCKET_INACTIVITY_ENABLED"] = "true"
    os.environ["WEBSOCKET_INACTIVITY_WARNING"] = "8"
    os.environ["WEBSOCKET_INACTIVITY_TIMEOUT"] = "15"
    
    ws_url = f"ws://{ws_host}/stream"
    logger.info(f"Testing WebSocket at: {ws_url}")
    logger.info(f"Inactivity settings: warning=8s, timeout=15s")
    
    tester = InactivityTester(ws_url, auth_token)
    
    # Run tests
    await tester.test_no_audio()
    await asyncio.sleep(2)  # Pause between tests
    await tester.test_with_audio_pause()

if __name__ == "__main__":
    asyncio.run(main())