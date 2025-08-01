import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Firebase configuration using environment variables
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

// Validate that all required config values are present
const requiredConfigKeys = ['apiKey', 'authDomain', 'projectId', 'appId'];
const missingKeys = requiredConfigKeys.filter(key => !firebaseConfig[key as keyof typeof firebaseConfig]);

if (missingKeys.length > 0) {
  console.error('Missing Firebase configuration keys:', missingKeys);
  console.error('Please check your .env file and ensure all REACT_APP_FIREBASE_* variables are set');
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Disable reCAPTCHA Enterprise in development
if (process.env.NODE_ENV === 'development') {
  console.log('Development mode: Disabling reCAPTCHA Enterprise');
  // This will prevent Firebase from trying to load reCAPTCHA Enterprise scripts
  (window as any).__FIREBASE_DISABLE_RECAPTCHA_ENTERPRISE__ = true;
  
  // Also try to disable Enterprise mode in Firebase Auth
  if (typeof window !== 'undefined') {
    (window as any).__FIREBASE_AUTH_EMULATOR_HOST__ = 'localhost:9099';
  }
}

export default app; 