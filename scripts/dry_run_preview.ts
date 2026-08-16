import fs from 'fs';
import path from 'path';
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs
} from 'firebase/firestore';
import { normalizeDateForSort, parseTimeToMinutes } from './db_migration';

const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

async function preview() {
  console.log('Fetching all records from Firestore for Dry-Run Preview...');
  const snapshot = await getDocs(collection(db, 'orders'));
  const records: any[] = [];
  snapshot.forEach(docSnap => {
    records.push({ ...docSnap.data(), id: docSnap.id });
  });

  const totalCount = records.length;
  console.log(`Total Records: ${totalCount}`);

  // Sort ASCENDING: oldest date & time first
  const sorted = [...records].sort((a, b) => {
    const dateA = normalizeDateForSort(a.order_date || a.created_at);
    const dateB = normalizeDateForSort(b.order_date || b.created_at);
    if (dateA !== dateB) return dateA.localeCompare(dateB);

    const timeA = parseTimeToMinutes(a.order_time);
    const timeB = parseTimeToMinutes(b.order_time);
    if (timeA !== timeB) return timeA - timeB;

    const createA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const createB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return createA - createB;
  });

  const mappingTable = sorted.map((record, index) => ({
    id: record.id,
    customer_name: record.customer_name || 'N/A',
    order_date: record.order_date || 'N/A',
    order_time: record.order_time || 'N/A',
    delivery_date: record.delivery_date || 'N/A',
    old_order_number: record.order_number,
    new_order_number: index + 1
  }));

  console.log('\n--- FIRST 5 ROWS (Earliest / Oldest -> new_order_number = 1..5) ---');
  console.table(mappingTable.slice(0, 5));

  console.log('\n--- LAST 5 ROWS (Latest / Newest -> new_order_number = ...N) ---');
  console.table(mappingTable.slice(-5));
}

preview().catch(err => {
  console.error('Preview error:', err);
});
