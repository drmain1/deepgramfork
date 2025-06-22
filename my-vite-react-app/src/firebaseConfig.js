import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  connectAuthEmulator,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Firebase configuration for HIPAA-compliant medical transcription app
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication with HIPAA compliance settings
const auth = getAuth(app);

// Initialize Firebase Storage
const storage = getStorage(app);

// Set persistence to LOCAL for HIPAA compliance (session persists even after browser close)
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Error setting persistence:", error);
});

// Connect to auth emulator in development
if (import.meta.env.DEV && import.meta.env.VITE_USE_AUTH_EMULATOR === 'true') {
  connectAuthEmulator(auth, 'http://localhost:9099');
}

// Session timeout for HIPAA compliance
let sessionTimer;
const SESSION_TIMEOUT = 25 * 60 * 1000; // 25 minutes

const resetSessionTimer = () => {
  if (sessionTimer) clearTimeout(sessionTimer);
  
  sessionTimer = setTimeout(() => {
    // Auto-logout after inactivity
    auth.signOut().then(() => {
      console.log('Session expired - user logged out');
      // Don't redirect, let the auth state change handle showing login screen
    });
  }, SESSION_TIMEOUT);
};

// Monitor user activity
if (typeof window !== 'undefined') {
  ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
    window.addEventListener(event, resetSessionTimer, true);
  });
  
  // Start timer on auth state change
  auth.onAuthStateChanged((user) => {
    if (user) {
      resetSessionTimer();
    } else if (sessionTimer) {
      clearTimeout(sessionTimer);
    }
  });
}

// HIPAA Compliance Notes:
// 1. Ensure you have a Business Associate Agreement (BAA) with Google for Firebase
// 2. Enable audit logging in Google Cloud Console
// 3. Configure Identity Platform with:
//    - Strong password requirements (min 8 chars, complexity)
//    - Multi-factor authentication (MFA) 
//    - Account lockout policies
//    - Session timeout policies
// 4. Use Identity-Aware Proxy (IAP) for additional application-level security
// 5. All data transmission must be encrypted (HTTPS only)
// 6. Implement proper access controls and user activity logging

export { app, auth, storage };