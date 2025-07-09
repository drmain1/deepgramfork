# Enterprise-Grade Clock Skew Solution for Firebase Token Validation

## Problem Summary
The intermittent 401 error "Token used too early, 1751464256 < 1751464257" occurs when there's a clock synchronization issue between the client issuing the token and the server validating it. This 1-second difference causes Firebase Admin SDK to reject the token.

### Update (January 2025)
Firebase has updated their error message format to include additional help text: `"Token used too early, 1752034385 < 1752034386. Check that your computer's clock is set correctly"`. The parsing logic in `gcp_auth_middleware.py` has been updated to handle both old and new formats correctly.

## Solution Implementation

### 1. **Intelligent Retry Mechanism**
- Automatically retries token validation when clock skew is detected
- Extracts the time difference from the error message
- Waits for the exact time needed (plus 1-second buffer, max 5 seconds)
- Configurable retry attempts (default: 3)

### 2. **Configurable Clock Skew Tolerance**
- `FIREBASE_CLOCK_SKEW_SECONDS`: Maximum acceptable clock difference (default: 60 seconds)
- `FIREBASE_TOKEN_RETRY_ATTEMPTS`: Number of retry attempts (default: 3)
- Can be adjusted based on your infrastructure needs

### 3. **Enhanced Logging**
- Logs clock skew detection with severity levels
- Tracks retry attempts for monitoring
- Provides clear error messages to users

### 4. **Monitoring Script**
- `scripts/monitor_clock_skew.py`: Analyzes logs for clock skew patterns
- Generates alerts when thresholds are exceeded
- Provides recommendations for resolution

### 5. **Comprehensive Testing**
- `test_clock_skew_handling.py`: Unit tests for all scenarios
- Tests successful retries, max retries, and various error types
- Includes integration test simulating real timing issues

## How It Works

1. **Detection**: When `verify_id_token()` fails with "Token used too early", the error is caught
2. **Analysis**: The time difference is extracted from the error message
   - Handles both old format: `"Token used too early, 1751464256 < 1751464257."`
   - And new format: `"Token used too early, 1751464256 < 1751464257. Check that your computer's clock is set correctly"`
   - Extracts only numeric portions to avoid parsing errors
3. **Decision**: If the skew is within tolerance and retries remain, wait and retry
4. **Retry**: Sleep for the calculated time, then attempt validation again
5. **Success/Failure**: Either succeeds on retry or fails with user-friendly message

## Configuration Examples

### Development Environment
```bash
export FIREBASE_CLOCK_SKEW_SECONDS=60
export FIREBASE_TOKEN_RETRY_ATTEMPTS=3
```

### Production Environment (More Tolerant)
```bash
export FIREBASE_CLOCK_SKEW_SECONDS=300
export FIREBASE_TOKEN_RETRY_ATTEMPTS=5
```

## Monitoring and Alerts

Run the monitoring script periodically:
```bash
python scripts/monitor_clock_skew.py --hours 24 --output json
```

Set up alerts for:
- More than 10 clock skew events per hour
- Any "exhausted retries" errors
- Maximum skew exceeding 60 seconds

## Long-Term Solutions

1. **NTP Synchronization**: Ensure all servers use NTP
2. **Infrastructure Review**: Check timezone configurations
3. **Client-Side**: Consider token refresh on clock skew errors
4. **Firebase PR**: Monitor for official clock_skew_seconds parameter support

## Testing

Run the test suite to verify the implementation:
```bash
cd backend
python test_clock_skew_handling.py
```

### Parsing Fix Verification (January 2025)

The error message parsing logic has been tested against multiple formats:
- Original format: `"Token used too early, 1752034385 < 1752034386."`
- New format with help text: `"Token used too early, 1752034385 < 1752034386. Check that your computer's clock is set correctly"`
- Various edge cases with different time differences

The implementation correctly extracts timestamp values from both formats by:
1. Splitting on the comma to isolate the timestamp portion
2. Splitting on the `<` to separate server and token times
3. Extracting only numeric characters from the token time to handle trailing text
4. Gracefully handling parsing errors by logging and rethrowing

This solution provides enterprise-grade resilience against clock synchronization issues while maintaining security and providing excellent observability.