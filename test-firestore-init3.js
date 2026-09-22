import { initializeApp } from 'firebase/app';
import { getFirestore, initializeFirestore } from 'firebase/firestore';

const app = initializeApp({ projectId: 'test' });
getFirestore(app);
try {
  initializeFirestore(app, { experimentalForceLongPolling: true });
  console.log('Success');
} catch (e) {
  console.error(e.message);
}
