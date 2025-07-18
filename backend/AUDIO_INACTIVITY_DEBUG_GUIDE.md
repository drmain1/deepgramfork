# Audio Inactivity Detection Debug Guide

## Quick Diagnostics

### 1. Check Authentication
Add logging to verify authenticated_user_id is present:
```python
# In deepgram_utils.py, after line 38
logger.info(f"Inactivity config: enabled={inactivity_config['enabled']}, user_id={authenticated_user_id}")
```

### 2. Verify Environment Variables
```bash
# Check if these are set in your deployment:
echo $WEBSOCKET_INACTIVITY_ENABLED
echo $WEBSOCKET_INACTIVITY_WARNING  
echo $WEBSOCKET_INACTIVITY_TIMEOUT
```

### 3. Add Debug Logging
In `websocket_security.py`, add logging to `record_audio_received()`:
```python
def record_audio_received(self, size_bytes: int = 0):
    """Record that audio data was received."""
    old_time = self._last_audio_time
    self._last_audio_time = time.time()
    self._warning_sent = False
    logger.debug(f"Audio received: {size_bytes} bytes, last_audio_time updated from {old_time} to {self._last_audio_time}")
```

### 4. Monitor WebSocket Messages
In `deepgram_utils.py`, add logging for all message types:
```python
# Around line 306
logger.info(f"WebSocket message received: type={message_data.keys()}")
```

## Common Issues and Solutions

### Issue 1: Feature Disabled for Unauthenticated Users
**Solution**: Ensure proper authentication flow or enable for all users:
```python
# Change line 39 in deepgram_utils.py to:
if inactivity_config["enabled"]:  # Remove authenticated_user_id check
```

### Issue 2: Audio Not Being Tracked
**Solution**: Verify audio data format and add comprehensive logging:
```python
# In websocket_message_handler, after line 310
if "bytes" in message_data:
    audio_data = message_data["bytes"]
    logger.debug(f"Audio bytes received: {len(audio_data)} bytes")
```

### Issue 3: Timer Not Starting
**Solution**: Log monitor lifecycle:
```python
# In _monitor_loop of websocket_security.py
logger.debug(f"Monitor check: last_activity={last_activity}, inactive_seconds={inactive_seconds}")
```

## Testing the Feature

### 1. Manual Test with Environment Variables
```bash
export WEBSOCKET_INACTIVITY_ENABLED=true
export WEBSOCKET_INACTIVITY_WARNING=5
export WEBSOCKET_INACTIVITY_TIMEOUT=10
python main.py
```

### 2. Test Without Audio
1. Connect to WebSocket
2. Send initial metadata
3. Don't send any audio data
4. Watch for warning at 5 seconds
5. Connection should close at 10 seconds

### 3. Test With Intermittent Audio
1. Connect and send audio
2. Stop sending audio for 6 seconds
3. Verify warning appears
4. Send audio again
5. Verify warning clears

## Production Deployment

For Cloud Run deployment, add environment variables:
```yaml
# In cloud-run-service.yaml
env:
  - name: WEBSOCKET_INACTIVITY_ENABLED
    value: "true"
  - name: WEBSOCKET_INACTIVITY_WARNING
    value: "8"
  - name: WEBSOCKET_INACTIVITY_TIMEOUT
    value: "15"
```

Or set via gcloud:
```bash
gcloud run services update your-service-name \
  --set-env-vars="WEBSOCKET_INACTIVITY_ENABLED=true,WEBSOCKET_INACTIVITY_WARNING=8,WEBSOCKET_INACTIVITY_TIMEOUT=15"
```