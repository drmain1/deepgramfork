import React, { createContext, useContext, useState, useEffect } from 'react';
import { Amplify } from 'aws-amplify';
import { signIn, signOut, signUp, confirmSignUp, fetchAuthSession, fetchUserAttributes, getCurrentUser } from 'aws-amplify/auth';
import { amplifyConfig } from '../amplifyconfigure';

// Configure Amplify
Amplify.configure(amplifyConfig);

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      const attributes = await fetchUserAttributes();
      setUser({
        sub: attributes.sub || currentUser.userId,
        email: attributes.email,
        ...attributes
      });
      setIsAuthenticated(true);
    } catch (error) {
      console.log('Not authenticated');
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithRedirect = async () => {
    // This won't be used with Amplify Authenticator UI
    console.log('Login is handled by Amplify Authenticator UI');
  };

  const logout = async (options = {}) => {
    try {
      await signOut();
      setUser(null);
      setIsAuthenticated(false);
      if (options.returnTo) {
        window.location.href = options.returnTo;
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const getAccessTokenSilently = async () => {
    try {
      const { tokens } = await fetchAuthSession();
      console.log('Auth tokens:', tokens);
      
      // In Amplify v6, we should use the idToken for API calls
      if (tokens?.idToken) {
        const idTokenString = tokens.idToken.toString();
        // Decode token to see its contents (for debugging)
        const tokenParts = idTokenString.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]));
          console.log('ID Token payload:', payload);
          console.log('Token audience (aud):', payload.aud);
          console.log('Token client_id:', payload.client_id);
        }
        return idTokenString;
      } else {
        throw new Error('No ID token available');
      }
    } catch (error) {
      console.error('Error getting token:', error);
      throw error;
    }
  };

  const value = {
    user,
    isAuthenticated,
    isLoading,
    loginWithRedirect,
    logout,
    getAccessTokenSilently
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// HOC to protect components
export const withAuthenticationRequired = (Component, options = {}) => {
  return (props) => {
    const { isAuthenticated, isLoading, loginWithRedirect } = useAuth();

    useEffect(() => {
      if (!isLoading && !isAuthenticated) {
        loginWithRedirect();
      }
    }, [isLoading, isAuthenticated]);

    if (isLoading) {
      return options.onRedirecting ? options.onRedirecting() : <div>Loading...</div>;
    }

    if (!isAuthenticated) {
      return null;
    }

    return <Component {...props} />;
  };
};