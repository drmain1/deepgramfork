import React from 'react';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

const AmplifyLogin = ({ children }) => {
  return (
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
    >
      {({ signOut, user }) => children}
    </Authenticator>
  );
};

export default AmplifyLogin;