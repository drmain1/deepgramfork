import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import './styles.css';
import CustomAuthenticator from './components/CustomAuthenticator.jsx';
import { Amplify } from 'aws-amplify';
import { amplifyConfig } from './amplifyconfigure.js';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { UserSettingsProvider } from './contexts/UserSettingsContext.jsx'; 

// Configure Amplify
Amplify.configure(amplifyConfig);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <CustomAuthenticator>
      {({ signOut, user }) => (
        <AuthProvider>
          <UserSettingsProvider>
            <App />
          </UserSettingsProvider>
        </AuthProvider>
      )}
    </CustomAuthenticator>
  </React.StrictMode>
);
