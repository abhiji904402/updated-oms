import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, limit, query } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function check() {
  try {
    const snap = await getDocs(collection(db, 'orders'));
    console.log(`Success! Fetched ${snap.size} orders.`);
  } catch (e) {
    console.error("Error reading Firestore:", e);
  }
  process.exit(0);
}
check();
