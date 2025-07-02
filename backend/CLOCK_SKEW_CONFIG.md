# Firebase Token Clock Skew Configuration

## Overview
This document explains how to configure the Firebase token validation to handle clock synchronization issues between servers.

## Environment Variables

### `FIREBASE_CLOCK_SKEW_SECONDS`
- **Default**: 60 seconds
- **Description**: Maximum allowed clock difference between servers before rejecting a token
- **Recommended**: 60-300 seconds for production environments

### `FIREBASE_TOKEN_RETRY_ATTEMPTS`
- **Default**: 3
- **Description**: Number of retry attempts when encountering clock skew errors
- **Recommended**: 3-5 attempts

## Usage Example

```bash
# Development
export FIREBASE_CLOCK_SKEW_SECONDS=60
export FIREBASE_TOKEN_RETRY_ATTEMPTS=3

# Production (more tolerant)
export FIREBASE_CLOCK_SKEW_SECONDS=300
export FIREBASE_TOKEN_RETRY_ATTEMPTS=5
```

## Monitoring

The system logs clock skew events with the following format:
- `WARNING: Clock skew detected: X seconds (attempt Y/Z)`
- `ERROR: Clock skew issue persists after X attempts`

These logs should be monitored and alerted on if they occur frequently.

## Additional Recommendations

1. **NTP Synchronization**: Ensure all servers use NTP for time synchronization
2. **Cloud Run**: Google Cloud Run instances should automatically have synchronized time
3. **Monitoring**: Set up alerts for frequent clock skew errors (>10 per hour)
4. **Client-Side**: Consider refreshing tokens on the client if clock skew errors persist