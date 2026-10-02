import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDMtEySzYbpJ1IhgWMteBEjOlvq3_io3vM",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "compiler-13c02.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "compiler-13c02",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "compiler-13c02.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "700194471567",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:700194471567:web:e8276ec0abd8a6ba97bafa",
};

let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

let _authInstance: Auth | null = null;
let _dbInstance: Firestore | null = null;

export const getFirebaseAuth = (): Auth => {
  if (!_authInstance) {
    _authInstance = getAuth(app);
  }
  return _authInstance;
};

export const getFirebaseDb = (): Firestore => {
  if (!_dbInstance) {
    _dbInstance = getFirestore(app);
  }
  return _dbInstance;
};

export { app };
