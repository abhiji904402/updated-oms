import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "inductive-alliance-96tp2",
  appId: "1:441458916253:web:61091d170cb0e83dbfcd74",
  apiKey: "AIzaSyC2rXANXVaLwm6ZUkMgm5LJK-KDiXgwrrk",
  authDomain: "inductive-alliance-96tp2.firebaseapp.com"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "ai-studio-updatesbroomieso-fa7b0278-13cd-46d9-bc42-38295233e2c8");

async function check() {
  const colRef = collection(db, "orders");
  const snap = await getDocs(colRef);
  console.log("Orders count in Firestore:", snap.size);
  process.exit(0);
}
check();
