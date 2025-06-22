import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import './styles.css';
import { AuthProvider } from './contexts/FirebaseAuthContext.jsx';
import { UserSettingsProvider } from './contexts/UserSettingsContext.jsx';
import FirebaseAuthenticator from './components/FirebaseAuthenticator.jsx';
import { useAuth } from './contexts/FirebaseAuthContext.jsx';

function AuthenticatedApp() {
  const { currentUser, loading } = useAuth();

  // Debug logging
  console.log('AuthenticatedApp render:', { currentUser, loading });

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!currentUser) {
    console.log('No current user, showing login screen');
    return <FirebaseAuthenticator />;
  }

  console.log('User authenticated, showing app');
  return (
    <UserSettingsProvider>
      <App />
    </UserSettingsProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  </React.StrictMode>
);
