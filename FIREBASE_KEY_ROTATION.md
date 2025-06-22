# Firebase API Key Rotation Guide

## Steps to Rotate Your Compromised Firebase API Key

### 1. Go to Firebase Console
1. Navigate to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `medlegaldoc-b31df`

### 2. Restrict the Current API Key (Immediate Security)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to "APIs & Services" → "Credentials"
4. Find your Firebase API key (ending in Wrr3Yjk7Zqk)
5. Click on it and add these restrictions:
   - **Application restrictions**: HTTP referrers
   - Add these referrers:
     - `http://localhost:5173/*`
     - `http://localhost:5174/*`
     - `https://medlegaldoc.com/*`
     - `https://www.medlegaldoc.com/*`
   - **API restrictions**: Restrict to these APIs:
     - Identity Toolkit API
     - Firebase Auth API
     - Firebase Realtime Database API
     - Cloud Storage API

### 3. Create a New API Key
1. In Google Cloud Console → "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "API key"
3. Immediately restrict the new key with the same restrictions as above
4. Copy the new API key

### 4. Update Your Application
1. Update your `.env` file with the new API key:
   ```
   VITE_FIREBASE_API_KEY=your-new-api-key-here
   ```

2. Restart your development server:
   ```bash
   npm run dev
   ```

### 5. Test Everything Works
1. Test login/logout functionality
2. Test file uploads
3. Test all Firebase features

### 6. Delete the Old API Key
1. Once confirmed everything works with the new key
2. Go back to Google Cloud Console → Credentials
3. Delete the old compromised API key

## Additional Security Measures

### 1. Enable App Check (Recommended)
App Check helps protect your backend resources from abuse:

```javascript
// In firebaseConfig.js, add:
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

// After initializing the app
const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('your-recaptcha-site-key'),
  isTokenAutoRefreshEnabled: true
});
```

### 2. Set Up Domain Verification
1. In Firebase Console → Authentication → Settings
2. Add your authorized domains:
   - `localhost`
   - `medlegaldoc.com`

### 3. Enable Security Rules for Firestore/Storage
Make sure your Firebase Storage rules are restrictive:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 4. Monitor API Key Usage
1. Set up alerts in Google Cloud Console
2. Monitor for unusual activity
3. Set quotas if needed

## Important Notes

1. **Firebase API keys are designed to be public** - they identify your project but don't grant access
2. **Security comes from**:
   - Firebase Security Rules
   - Authentication
   - API key restrictions
   - App Check
   - Domain restrictions

3. **Never commit sensitive keys like**:
   - Service account keys
   - Admin SDK credentials
   - OAuth client secrets

## Verification Checklist
- [ ] Old API key has restrictions applied
- [ ] New API key created and restricted
- [ ] .env file updated with new key
- [ ] Application tested and working
- [ ] Old API key deleted
- [ ] App Check implemented (optional but recommended)
- [ ] Domain verification completed
- [ ] Security rules reviewed and updated