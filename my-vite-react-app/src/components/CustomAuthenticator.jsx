import React from 'react';
import { Authenticator, ThemeProvider } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import './CustomAuthenticator.css';

const authenticatorTheme = {
  name: 'medical-dictation-theme',
  tokens: {
    colors: {
      background: {
        primary: {
          value: '#f8f9fa',
        },
        secondary: {
          value: '#ffffff',
        },
      },
      font: {
        interactive: {
          value: '#2c3e50',
        },
      },
      brand: {
        primary: {
          10: { value: '#f0f4f8' },
          20: { value: '#dfe7ed' },
          40: { value: '#8fa3b8' },
          60: { value: '#5f7a94' },
          80: { value: '#2c3e50' },
          90: { value: '#1a252f' },
          100: { value: '#0f171e' },
        },
      },
    },
    components: {
      authenticator: {
        router: {
          borderWidth: { value: '0' },
          backgroundColor: { value: '#ffffff' },
          boxShadow: { value: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' },
        },
      },
      button: {
        primary: {
          backgroundColor: { value: '#2c3e50' },
          color: { value: '#ffffff' },
          borderColor: { value: '#2c3e50' },
          _hover: {
            backgroundColor: { value: '#1a252f' },
            borderColor: { value: '#1a252f' },
          },
          _focus: {
            backgroundColor: { value: '#1a252f' },
            borderColor: { value: '#1a252f' },
          },
          _active: {
            backgroundColor: { value: '#0f171e' },
            borderColor: { value: '#0f171e' },
          },
        },
        link: {
          color: { value: '#2c3e50' },
          _hover: {
            color: { value: '#1a252f' },
          },
        },
      },
      tabs: {
        item: {
          _active: {
            color: { value: '#2c3e50' },
            borderColor: { value: '#2c3e50' },
          },
          _hover: {
            color: { value: '#1a252f' },
          },
        },
      },
      fieldcontrol: {
        borderColor: { value: '#dfe7ed' },
        _focus: {
          borderColor: { value: '#2c3e50' },
        },
      },
    },
    radii: {
      small: { value: '4px' },
      medium: { value: '8px' },
      large: { value: '16px' },
    },
    space: {
      small: { value: '1rem' },
      medium: { value: '1.5rem' },
      large: { value: '2rem' },
    },
    fontSizes: {
      small: { value: '0.875rem' },
      medium: { value: '1rem' },
      large: { value: '1.125rem' },
    },
  },
};

const CustomAuthenticator = ({ children }) => {
  return (
    <ThemeProvider theme={authenticatorTheme}>
      <Authenticator
          signUpAttributes={['email']}
          socialProviders={[]}
          formFields={{
            signUp: {
              email: {
                order: 1,
                required: true,
                label: 'Email',
                placeholder: 'Enter your email',
                inputType: 'email'
              },
              password: {
                order: 2,
                required: true,
                label: 'Password',
                placeholder: 'Enter your password',
                inputType: 'password'
              },
              confirm_password: {
                order: 3,
                required: true,
                label: 'Confirm Password',
                placeholder: 'Confirm your password',
                inputType: 'password'
              }
            }
          }}
          components={{
            Header() {
              return (
                <div className="auth-header">
                  <div className="auth-logo">
                    <span className="material-icons">mic</span>
                  </div>
                  <h1 className="auth-title">Medlegaldoc</h1>
                  <p className="auth-subtitle">Professional AI Transcription</p>
                </div>
              );
            },
            Footer() {
              return (
                <div className="auth-footer">
                  <p>Secure, HIPAA-compliant medical transcription</p>
                </div>
              );
            }
          }}
        >
          {({ signOut, user }) => (
            user ? (
              children({ signOut, user })
            ) : (
              <div className="auth-container" />
            )
          )}
        </Authenticator>
    </ThemeProvider>
  );
};

export default CustomAuthenticator;