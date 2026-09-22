import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';

const app = initializeApp({ projectId: 'test' });
try {
  initializeFirestore(app, { experimentalForceLongPolling: true });
  console.log('Success');
} catch (e) {
  console.error(e);
}
