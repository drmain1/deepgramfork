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
      
      // Send email verification
      await sendEmailVerification(user);
      
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
      
      // Check if email is verified
      if (!user.emailVerified) {
        await signOut(auth);
        throw new Error('Please verify your email before logging in. Check your inbox for the verification link.');
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

  // Get ID token for API calls
  const getToken = async () => {
    if (!currentUser) {
      throw new Error('No authenticated user');
    }
    
    try {
      const token = await currentUser.getIdToken();
      return token;
    } catch (error) {
      console.error('Error getting ID token:', error);
      throw error;
    }
  };

  // Resend verification email
  const resendVerificationEmail = async () => {
    if (!currentUser) {
      throw new Error('No authenticated user');
    }
    
    try {
      await sendEmailVerification(currentUser);
    } catch (error) {
      setError(error.message);
      throw error;
    }
  };

  // Monitor auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
      
      // Log authentication events
      if (user) {
        console.log('User authenticated:', user.uid);
      } else {
        console.log('User signed out');
      }
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
    resendVerificationEmail,
    getUserAttributes,
    loading,
    error,
    // AWS Amplify compatibility
    user: currentUser,
    signIn: login,
    signUp: signup,
    signOut: logout,
    isAuthenticated: !!currentUser && currentUser.emailVerified
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export default AuthContext;