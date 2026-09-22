import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';

const app = initializeApp({ projectId: 'test' });
try {
  initializeFirestore(app, { experimentalForceLongPolling: true }, 'database-id');
  console.log('Success');
} catch (e) {
  console.error(e);
}
