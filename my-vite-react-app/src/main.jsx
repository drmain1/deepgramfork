import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import { Auth0Provider, withAuthenticationRequired } from '@auth0/auth0-react';
import AuthLoading from './components/AuthLoading.jsx'; 

const domain = import.meta.env.VITE_AUTH0_DOMAIN;
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;

const ProtectedApp = withAuthenticationRequired(App, {
  onRedirecting: () => <AuthLoading />,
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: window.location.origin 
      }}
    >
      <ProtectedApp />
    </Auth0Provider>
  </React.StrictMode>
);
