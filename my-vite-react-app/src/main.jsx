import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import './styles.css';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { Amplify } from 'aws-amplify';
import { amplifyConfig } from './amplifyconfigure.js';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { UserSettingsProvider } from './contexts/UserSettingsContext.jsx'; 

// Configure Amplify
Amplify.configure(amplifyConfig);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Authenticator signUpAttributes={['email']}>
      {({ signOut, user }) => (
        <AuthProvider>
          <UserSettingsProvider>
            <App />
          </UserSettingsProvider>
        </AuthProvider>
      )}
    </Authenticator>
  </React.StrictMode>
);
