import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";

if (typeof window !== 'undefined') {
  window.getIdToken = async () => {
    const user = getAuth().currentUser;
    return user ? user.getIdToken(true) : null;
  };
}
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

// Connect to Auth Emulator locally
if (typeof window !== 'undefined') {
  const host = window.location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  if (isLocal) {
    // Prefer 127.0.0.1 to align with emulator and reCAPTCHA domain policy
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    console.log('[Auth] Connected to Firebase Auth Emulator at 127.0.0.1:9099');
  }
}

export default app; 