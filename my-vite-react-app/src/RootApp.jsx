import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/FirebaseAuthContext';
import { UserSettingsProvider } from './contexts/UserSettingsContext';
import FirebaseAuthenticator from './components/FirebaseAuthenticator';
import EmailActionHandler from './pages/EmailActionHandler';
import App from './App';

function AuthenticatedApp() {
  const { currentUser, loading, checkEmailVerification } = useAuth();
  const [checkingVerification, setCheckingVerification] = React.useState(false);

  // Debug logging
  console.log('AuthenticatedApp render:', { currentUser, loading, emailVerified: currentUser?.emailVerified });

  // Check for email verification periodically when user is logged in but not verified
  React.useEffect(() => {
    if (currentUser && !currentUser.emailVerified && !checkingVerification) {
      const checkInterval = setInterval(async () => {
        setCheckingVerification(true);
        const isVerified = await checkEmailVerification();
        if (isVerified) {
          clearInterval(checkInterval);
          // Force a refresh to show the app
          window.location.reload();
        }
        setCheckingVerification(false);
      }, 3000); // Check every 3 seconds

      return () => clearInterval(checkInterval);
    }
  }, [currentUser, checkEmailVerification, checkingVerification]);

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!currentUser || !currentUser.emailVerified) {
    console.log('User not authenticated or email not verified, showing login screen', { 
      hasUser: !!currentUser, 
      emailVerified: currentUser?.emailVerified 
    });
    return <FirebaseAuthenticator />;
  }

  console.log('User authenticated and email verified, showing app');
  return (
    <UserSettingsProvider>
      <App />
    </UserSettingsProvider>
  );
}

function RootApp() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Email action handler route - handles verification links */}
          <Route path="/__/auth/action" element={<EmailActionHandler />} />
          
          {/* Main app */}
          <Route path="/*" element={<AuthenticatedApp />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default RootApp;