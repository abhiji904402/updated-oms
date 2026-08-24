import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, disableNetwork, writeBatch, doc, collection, onSnapshot, setDoc, deleteDoc, getDocs, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, query, where } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()})
}, (firebaseConfig as any).firestoreDatabaseId);
export const auth = getAuth(app);

export {
  disableNetwork,
  writeBatch,
  doc,
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  getDocs,
  query,
  where
};
