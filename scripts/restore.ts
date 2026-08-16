import fs from 'fs';
import path from 'path';
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  writeBatch,
  doc
} from 'firebase/firestore';

const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

async function restore() {
  const backupFile = process.argv[2];
  if (!backupFile) {
    console.error('Usage: tsx scripts/restore.ts <path_to_backup.json>');
    process.exit(1);
  }

  const filePath = path.resolve(backupFile);
  if (!fs.existsSync(filePath)) {
    console.error(`Backup file not found at ${filePath}`);
    process.exit(1);
  }

  const records = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  console.log(`Restoring ${records.length} records from ${filePath}...`);

  const BATCH_SIZE = 400;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const chunk = records.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((record: any) => {
      batch.set(doc(db, 'orders', record.id), record, { merge: false });
    });
    await batch.commit();
    console.log(`Restored batch ${i + 1} to ${Math.min(i + BATCH_SIZE, records.length)}`);
  }

  console.log('Restore complete.');
}

restore().catch(err => {
  console.error('Restore failed:', err);
  process.exit(1);
});
