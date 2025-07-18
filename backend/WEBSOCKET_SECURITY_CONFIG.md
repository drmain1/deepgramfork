# WebSocket Audio Inactivity Security Configuration

This document describes the audio inactivity detection feature for WebSocket connections.

## Overview

The WebSocket audio inactivity detection feature monitors live transcription sessions for periods where no audio data is received. This helps:

1. **Security**: Prevents zombie connections that consume resources
2. **User Experience**: Alerts users when their microphone may be muted or disconnected
3. **Resource Management**: Automatically closes idle connections
4. **HIPAA Compliance**: Ensures sessions don't remain open indefinitely

## Configuration

The feature is configured using environment variables:

### `WEBSOCKET_INACTIVITY_ENABLED`
- **Default**: `true`
- **Description**: Enable/disable the inactivity detection feature
- **Values**: `true` or `false`

### `WEBSOCKET_INACTIVITY_WARNING`
- **Default**: `8` (seconds)
- **Description**: Time in seconds before showing a warning to the user
- **Range**: Recommended 5-10 seconds

### `WEBSOCKET_INACTIVITY_TIMEOUT`
- **Default**: `15` (seconds)
- **Description**: Time in seconds before automatically disconnecting
- **Range**: Recommended 15-30 seconds
- **Note**: Must be greater than warning timeout

## Example Configuration

```bash
# Enable inactivity detection
export WEBSOCKET_INACTIVITY_ENABLED=true

# Warn after 8 seconds of no audio
export WEBSOCKET_INACTIVITY_WARNING=8

# Disconnect after 15 seconds of no audio
export WEBSOCKET_INACTIVITY_TIMEOUT=15
```

## How It Works

1. **Monitoring Start**: When a WebSocket connection is established and authenticated
2. **Audio Tracking**: Each audio data packet received resets the inactivity timer
3. **Warning Phase**: After `WEBSOCKET_INACTIVITY_WARNING` seconds, a warning is sent to the client
4. **Disconnection**: After `WEBSOCKET_INACTIVITY_TIMEOUT` seconds, the connection is closed

## Client Behavior

When the client receives an inactivity warning:

1. A visual warning appears in the UI (orange warning box)
2. The warning shows how many seconds until disconnection
3. If the user speaks, the warning disappears
4. If no audio is received, the connection closes with code `4008`

## Security Events

All inactivity events are logged:

- `monitoring_started`: Security monitoring began
- `inactivity_warning`: Warning threshold reached
- `inactivity_disconnect`: Connection closed due to inactivity
- `monitoring_stopped`: Security monitoring ended

## Audit Logging

Inactivity disconnections are logged to the HIPAA audit trail:

```json
{
  "user_id": "user123",
  "operation": "WEBSOCKET_TIMEOUT",
  "data_type": "audio_stream",
  "resource_id": "session123",
  "success": true,
  "details": {
    "reason": "audio_inactivity",
    "inactive_seconds": 15.2
  }
}
```

## Troubleshooting

### Warning appears too quickly
- Increase `WEBSOCKET_INACTIVITY_WARNING` value
- Check if microphone is properly connected
- Verify audio is being captured by the browser

### Connection closes during normal pauses
- Increase `WEBSOCKET_INACTIVITY_TIMEOUT` value
- Consider if users need longer pauses in their workflow

### Feature not working
- Verify `WEBSOCKET_INACTIVITY_ENABLED=true`
- Check Cloud Run logs for security event messages
- Ensure user is authenticated (feature only works for authenticated users)

## Best Practices

1. **Testing**: Test with your actual users to find optimal timeout values
2. **Documentation**: Inform users about the feature in your user guide
3. **Monitoring**: Review audit logs to understand usage patterns
4. **Adjustment**: Start with default values and adjust based on user feedback

## Implementation Details

- Backend: `websocket_security.py` - Core security monitoring
- Backend: `deepgram_utils.py` - Integration with WebSocket handler
- Frontend: `RecordingView.jsx` - UI warning display
- Frontend: `recordingConstants.js` - Message type definitions