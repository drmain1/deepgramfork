import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/FirebaseAuthContext';

const EmailVerificationBanner = () => {
  const { currentUser, checkEmailVerification, resendVerificationEmail } = useAuth();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('');

  // Don't show banner if email is already verified or in development
  if (!currentUser || currentUser.emailVerified || import.meta.env.DEV) {
    return null;
  }

  const handleCheckVerification = async () => {
    setChecking(true);
    setMessage('');
    
    try {
      const isVerified = await checkEmailVerification();
      if (isVerified) {
        setMessage('Email verified! Refreshing...');
        // Reload the page to apply the new token
        setTimeout(() => window.location.reload(), 1000);
      } else {
        setMessage('Email not verified yet. Please check your inbox.');
      }
    } catch (error) {
      setMessage('Error checking verification status.');
    } finally {
      setChecking(false);
    }
  };

  const handleResendEmail = async () => {
    setMessage('');
    try {
      await resendVerificationEmail();
      setMessage('Verification email sent! Check your inbox.');
    } catch (error) {
      setMessage('Error sending verification email. Please try again.');
    }
  };

  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <p className="text-sm text-yellow-700">
            Please verify your email address to access all features.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={handleCheckVerification}
              disabled={checking}
              className="text-sm bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700 disabled:opacity-50"
            >
              {checking ? 'Checking...' : "I've Verified My Email"}
            </button>
            <button
              onClick={handleResendEmail}
              className="text-sm bg-white text-yellow-700 px-3 py-1 rounded border border-yellow-700 hover:bg-yellow-50"
            >
              Resend Verification Email
            </button>
          </div>
          {message && (
            <p className="mt-2 text-sm text-yellow-700">{message}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationBanner;