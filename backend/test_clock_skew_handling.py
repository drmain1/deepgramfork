#!/usr/bin/env python3
"""
Test script to verify clock skew handling in Firebase token validation.
This simulates the "Token used too early" error and verifies the retry mechanism.
"""

import os
import sys
import time
import unittest
from unittest.mock import patch, MagicMock
from datetime import datetime

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import after path is set
from gcp_auth_middleware import validate_firebase_token
from firebase_admin import auth as firebase_auth
from fastapi import HTTPException

class TestClockSkewHandling(unittest.TestCase):
    """Test cases for clock skew handling in Firebase token validation."""
    
    def setUp(self):
        """Set up test environment."""
        # Save original values
        self.original_max_retry = os.environ.get('FIREBASE_TOKEN_RETRY_ATTEMPTS')
        self.original_clock_skew = os.environ.get('FIREBASE_CLOCK_SKEW_SECONDS')
        
        # Set test values
        os.environ['FIREBASE_TOKEN_RETRY_ATTEMPTS'] = '3'
        os.environ['FIREBASE_CLOCK_SKEW_SECONDS'] = '60'
    
    def tearDown(self):
        """Clean up test environment."""
        # Restore original values
        if self.original_max_retry:
            os.environ['FIREBASE_TOKEN_RETRY_ATTEMPTS'] = self.original_max_retry
        else:
            os.environ.pop('FIREBASE_TOKEN_RETRY_ATTEMPTS', None)
            
        if self.original_clock_skew:
            os.environ['FIREBASE_CLOCK_SKEW_SECONDS'] = self.original_clock_skew
        else:
            os.environ.pop('FIREBASE_CLOCK_SKEW_SECONDS', None)
    
    @patch('gcp_auth_middleware.firebase_auth.verify_id_token')
    def test_successful_retry_on_clock_skew(self, mock_verify):
        """Test that token validation succeeds after retry on clock skew error."""
        # First call raises clock skew error
        mock_verify.side_effect = [
            firebase_auth.InvalidIdTokenError("Token used too early, 1000 < 1001. Check that your computer's clock is set correctly."),
            {'uid': 'test_user_123', 'email_verified': True}  # Second call succeeds
        ]
        
        # Should succeed after retry
        result = validate_firebase_token('test_token')
        self.assertEqual(result, 'test_user_123')
        self.assertEqual(mock_verify.call_count, 2)
    
    @patch('gcp_auth_middleware.firebase_auth.verify_id_token')
    @patch('time.sleep')
    def test_retry_with_appropriate_delay(self, mock_sleep, mock_verify):
        """Test that retry uses appropriate delay based on clock skew."""
        # Simulate 3-second clock skew
        mock_verify.side_effect = [
            firebase_auth.InvalidIdTokenError("Token used too early, 1000 < 1003. Check that your computer's clock is set correctly."),
            {'uid': 'test_user_123', 'email_verified': True}
        ]
        
        result = validate_firebase_token('test_token')
        
        # Should sleep for skew + 1 second (capped at 5)
        mock_sleep.assert_called_once_with(4)  # 3 + 1 = 4 seconds
        self.assertEqual(result, 'test_user_123')
    
    @patch('gcp_auth_middleware.firebase_auth.verify_id_token')
    def test_max_retries_exceeded(self, mock_verify):
        """Test that validation fails after max retries."""
        # All calls fail with clock skew
        mock_verify.side_effect = [
            firebase_auth.InvalidIdTokenError("Token used too early, 1000 < 1001."),
            firebase_auth.InvalidIdTokenError("Token used too early, 1001 < 1002."),
            firebase_auth.InvalidIdTokenError("Token used too early, 1002 < 1003.")
        ]
        
        with self.assertRaises(HTTPException) as context:
            validate_firebase_token('test_token')
        
        self.assertEqual(context.exception.status_code, 401)
        self.assertIn('clock synchronization', context.exception.detail)
        self.assertEqual(mock_verify.call_count, 3)
    
    @patch('gcp_auth_middleware.firebase_auth.verify_id_token')
    def test_large_clock_skew_exceeds_tolerance(self, mock_verify):
        """Test that large clock skew exceeding tolerance fails immediately."""
        # 70-second skew exceeds 60-second tolerance
        mock_verify.side_effect = firebase_auth.InvalidIdTokenError(
            "Token used too early, 1000 < 1070."
        )
        
        with self.assertRaises(HTTPException) as context:
            validate_firebase_token('test_token')
        
        self.assertEqual(context.exception.status_code, 401)
        self.assertEqual(mock_verify.call_count, 1)  # No retry for large skew
    
    @patch('gcp_auth_middleware.firebase_auth.verify_id_token')
    def test_other_token_errors_no_retry(self, mock_verify):
        """Test that non-clock-skew errors don't trigger retry."""
        mock_verify.side_effect = firebase_auth.InvalidIdTokenError("Invalid token signature")
        
        with self.assertRaises(HTTPException) as context:
            validate_firebase_token('test_token')
        
        self.assertEqual(context.exception.status_code, 401)
        self.assertEqual(context.exception.detail, "Invalid Firebase token")
        self.assertEqual(mock_verify.call_count, 1)  # No retry
    
    @patch('gcp_auth_middleware.firebase_auth.verify_id_token')
    def test_expired_token_no_retry(self, mock_verify):
        """Test that expired tokens don't trigger retry."""
        mock_verify.side_effect = firebase_auth.ExpiredIdTokenError("Token has expired")
        
        with self.assertRaises(HTTPException) as context:
            validate_firebase_token('test_token')
        
        self.assertEqual(context.exception.status_code, 401)
        self.assertEqual(context.exception.detail, "Firebase token expired")
        self.assertEqual(mock_verify.call_count, 1)  # No retry

def run_integration_test():
    """Run a simulated integration test with actual timing."""
    print("\n=== Running Integration Test ===")
    print("This test simulates a real clock skew scenario...")
    
    # Mock the Firebase auth module
    with patch('gcp_auth_middleware.firebase_auth.verify_id_token') as mock_verify:
        # Simulate clock skew that resolves after 2 seconds
        call_count = 0
        def side_effect(token):
            nonlocal call_count
            call_count += 1
            current_time = int(time.time())
            
            if call_count == 1:
                # First call: token is 2 seconds in the future
                raise firebase_auth.InvalidIdTokenError(
                    f"Token used too early, {current_time} < {current_time + 2}."
                )
            else:
                # Second call: success
                return {'uid': 'test_user_123', 'email_verified': True}
        
        mock_verify.side_effect = side_effect
        
        print(f"Starting validation at {datetime.now().isoformat()}")
        start_time = time.time()
        
        try:
            result = validate_firebase_token('test_token')
            elapsed = time.time() - start_time
            
            print(f"✓ Validation succeeded after {elapsed:.2f} seconds")
            print(f"✓ User ID: {result}")
            print(f"✓ Total attempts: {call_count}")
            
        except Exception as e:
            print(f"✗ Validation failed: {e}")

if __name__ == '__main__':
    # Run unit tests
    print("Running unit tests...")
    unittest.main(argv=[''], exit=False, verbosity=2)
    
    # Run integration test
    run_integration_test()