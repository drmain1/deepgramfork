import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile
} from 'firebase/auth';
import { auth } from '../firebaseConfig';

const AuthContext = createContext({});

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Sign up function
  const signup = async (email, password, displayName) => {
    try {
      setError('');
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update display name
      if (displayName) {
        await updateProfile(user, { displayName });
      }
      
      // Send email verification with custom action URL
      try {
        const actionCodeSettings = {
          url: window.location.origin, // Redirect back to the app after verification
          handleCodeInApp: true,
        };
        await sendEmailVerification(user, actionCodeSettings);
        console.log('Verification email sent successfully to:', user.email);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        // Still return user but note the email issue
        setError('Account created but verification email failed. Please try resending.');
      }
      
      return user;
    } catch (error) {
      setError(error.message);
      throw error;
    }
  };

  // Login function
  const login = async (email, password) => {
    try {
      setError('');
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      
      // Force token refresh to get latest email verification status
      await user.reload();
      const idTokenResult = await user.getIdTokenResult(true); // Force refresh
      
      // Check if email is verified (always enforce for HIPAA compliance)
      if (!user.emailVerified) {
        // Don't sign out here - let the user stay logged in to receive the verification
        throw new Error('Please verify your email before logging in. Check your inbox for the verification link.');
      }
      
      console.log('Login successful, email verified:', user.emailVerified);
      console.log('Token claims:', idTokenResult.claims);
      
      // Call backend login endpoint to create Firestore session
      try {
        const token = await user.getIdToken();
        const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const response = await fetch(`${API_BASE_URL}/api/v1/login`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          console.error('Backend login failed:', response.status);
        } else {
          const data = await response.json();
          console.log('Backend session created successfully:', data);
        }
      } catch (backendError) {
        console.error('Error calling backend login:', backendError);
        // Continue even if backend fails - Firebase auth is primary
      }
      
      return user;
    } catch (error) {
      setError(error.message);
      throw error;
    }
  };

  // Logout function
  const logout = async () => {
    try {
      setError('');
      
      // First, call backend logout endpoint to clear Firestore session
      if (currentUser) {
        try {
          const token = await currentUser.getIdToken();
          const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
          const response = await fetch(`${API_BASE_URL}/api/v1/logout`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (!response.ok) {
            console.error('Backend logout failed:', response.status);
          } else {
            console.log('Backend session cleared successfully');
          }
        } catch (backendError) {
          console.error('Error calling backend logout:', backendError);
          // Continue with Firebase logout even if backend fails
        }
      }
      
      // Then sign out from Firebase
      await signOut(auth);
    } catch (error) {
      setError(error.message);
      throw error;
    }
  };

  // Reset password
  const resetPassword = async (email) => {
    try {
      setError('');
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      setError(error.message);
      throw error;
    }
  };

  // Check email verification status and refresh token
  const checkEmailVerification = async () => {
    try {
      if (currentUser) {
        // Reload user to get latest email verification status
        await currentUser.reload();
        
        // Force token refresh if email is now verified
        if (currentUser.emailVerified) {
          const idTokenResult = await currentUser.getIdTokenResult(true);
          console.log('Email verified! Token refreshed with claims:', idTokenResult.claims);
          return true;
        }
        return false;
      }
    } catch (error) {
      console.error('Error checking email verification:', error);
      return false;
    }
  };

  // Resend verification email
  const resendVerificationEmail = async () => {
    try {
      if (currentUser && !currentUser.emailVerified) {
        await sendEmailVerification(currentUser);
        return true;
      }
      return false;
    } catch (error) {
      setError(error.message);
      throw error;
    }
  };

  // Get ID token for API calls
  const getToken = async () => {
    if (!currentUser) {
      throw new Error('No authenticated user');
    }
    
    try {
      // Force refresh to ensure latest email verification status
      const token = await currentUser.getIdToken(true);
      return token;
    } catch (error) {
      console.error('Error getting ID token:', error);
      throw error;
    }
  };

  // Refresh session to prevent timeout
  const refreshSession = async () => {
    try {
      if (!currentUser) {
        throw new Error('No authenticated user');
      }
      
      // Refresh the ID token
      const token = await currentUser.getIdToken(true);
      
      // Call backend to refresh session
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await fetch(`${API_BASE_URL}/api/v1/refresh-session`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to refresh session');
      }
      
      console.log('Session refreshed successfully');
      return true;
    } catch (error) {
      console.error('Error refreshing session:', error);
      throw error;
    }
  };

  // Monitor auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('Auth state changed:', user ? {
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified
      } : 'No user');
      
      // If user exists, reload to get latest email verification status
      if (user) {
        try {
          await user.reload();
          // Get fresh ID token to ensure backend has latest verification status
          if (user.emailVerified) {
            const token = await user.getIdToken(true);
            
            // Create backend session if email is verified
            try {
              const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
              const response = await fetch(`${API_BASE_URL}/api/v1/login`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              });
              
              if (!response.ok) {
                console.error('Backend session creation failed:', response.status);
              } else {
                console.log('Backend session created/verified on auth state change');
              }
            } catch (backendError) {
              console.error('Error creating backend session:', backendError);
            }
          }
          console.log('User authenticated:', user.uid, 'Email verified:', user.emailVerified);
        } catch (error) {
          console.error('Error reloading user:', error);
        }
      } else {
        console.log('User signed out');
      }
      
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Get user attributes for AWS compatibility
  const getUserAttributes = () => {
    if (!currentUser) return null;
    
    return {
      email: currentUser.email,
      email_verified: currentUser.emailVerified,
      name: currentUser.displayName,
      sub: currentUser.uid,
      // Add any custom attributes here
    };
  };

  const value = {
    currentUser,
    login,
    signup,
    logout,
    resetPassword,
    getToken,
    refreshSession,
    checkEmailVerification,
    resendVerificationEmail,
    getUserAttributes,
    loading,
    error,
    // AWS Amplify compatibility
    user: currentUser,
    signIn: login,
    signUp: signup,
    signOut: logout,
    isAuthenticated: !!currentUser && currentUser.emailVerified,
    isLoading: loading  // Add isLoading for compatibility
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export default AuthContext;