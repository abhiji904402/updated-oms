import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import bundledConfig from '../../firebase-applet-config.json';

const metaEnv = (import.meta as unknown as { env?: Record<string, string> })?.env || {};

// Robust Firebase configuration supporting direct bundling & Vercel deployment environments
const config = {
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || bundledConfig?.projectId || 'inductive-alliance-96tp2',
  appId: metaEnv.VITE_FIREBASE_APP_ID || bundledConfig?.appId || '1:441458916253:web:61091d170cb0e83dbfcd74',
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || bundledConfig?.apiKey || 'AIzaSyC2rXANXVaLwm6ZUkMgm5LJK-KDiXgwrrk',
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || bundledConfig?.authDomain || 'inductive-alliance-96tp2.firebaseapp.com',
  firestoreDatabaseId: metaEnv.VITE_FIREBASE_DATABASE_ID || bundledConfig?.firestoreDatabaseId || 'ai-studio-updatesbroomieso-fa7b0278-13cd-46d9-bc42-38295233e2c8',
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || bundledConfig?.storageBucket || 'inductive-alliance-96tp2.firebasestorage.app',
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || bundledConfig?.messagingSenderId || '441458916253',
};

const app = !getApps().length ? initializeApp(config) : getApp();

const dbId = config.firestoreDatabaseId && config.firestoreDatabaseId !== '(default)'
  ? config.firestoreDatabaseId
  : undefined;

let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(
    app,
    {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
      ignoreUndefinedProperties: true,
    },
    dbId
  );
} catch {
  try {
    firestoreInstance = dbId ? getFirestore(app, dbId) : getFirestore(app);
  } catch (err) {
    console.warn('Firestore fallback init:', err);
    firestoreInstance = getFirestore(app);
  }
}

export const db = firestoreInstance;




