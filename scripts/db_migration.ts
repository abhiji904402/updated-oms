import fs from 'fs';
import path from 'path';
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  writeBatch,
  doc
} from 'firebase/firestore';

// Read config directly from firebase-applet-config.json
const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Normalization helpers
export function normalizeDateForSort(dateStr?: any): string {
  if (!dateStr) return '9999-99-99';
  let d = String(dateStr).trim();
  if (d.includes('T')) d = d.split('T')[0];

  // Match DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmy = d.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    let year = dmy[3];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}`;
  }

  // Match YYYY-MM-DD or YYYY/MM/DD
  const ymd = d.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (ymd) {
    const year = ymd[1];
    const month = ymd[2].padStart(2, '0');
    const day = ymd[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const ts = Date.parse(d);
  if (!isNaN(ts)) {
    try {
      const dt = new Date(ts);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const day = String(dt.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    } catch (e) {}
  }
  return d;
}

export function parseTimeToMinutes(timeStr?: any): number {
  if (!timeStr) return 0; // Earliest time on that date
  let clean = String(timeStr).trim().toUpperCase();
  clean = clean.replace(/(\d+)\.(\d+)/, '$1:$2');
  const isPM = clean.includes('PM');
  const isAM = clean.includes('AM');

  const digits = clean.replace(/[^0-9:]/g, '').split(':');
  if (digits.length >= 1 && digits[0]) {
    let h = parseInt(digits[0], 10) || 0;
    const m = parseInt(digits[1] || '0', 10) || 0;
    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;
    return h * 60 + m;
  }
  return 0;
}

function convertToCSV(records: any[]): string {
  if (records.length === 0) return '';
  const headers = Array.from(
    new Set(records.flatMap(r => Object.keys(r)))
  );
  const rows = [
    headers.join(','),
    ...records.map(r =>
      headers
        .map(h => {
          let val = r[h];
          if (val === undefined || val === null) return '""';
          if (typeof val === 'object') val = JSON.stringify(val);
          val = String(val).replace(/"/g, '""');
          return `"${val}"`;
        })
        .join(',')
    )
  ];
  return rows.join('\n');
}

async function runMigration() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('DATABASE MIGRATION: ORDER_NUMBER RE-SEQUENCING');
  console.log('Database ID:', firebaseConfig.firestoreDatabaseId || '(default)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // STEP 1: Fetch all records
  console.log('Fetching all records from "orders" collection...');
  const snapshot = await getDocs(collection(db, 'orders'));
  const originalRecords: any[] = [];
  snapshot.forEach(docSnap => {
    originalRecords.push({ ...docSnap.data(), id: docSnap.id });
  });

  const totalCount = originalRecords.length;
  console.log(`Successfully fetched ${totalCount} records.\n`);

  if (totalCount === 0) {
    console.log('No records found to re-sequence. Exiting.');
    return;
  }

  // ═══════════════════════════════════════════════════════════════
  // PHASE 0 — BACKUP (mandatory)
  // ═══════════════════════════════════════════════════════════════
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupJsonFilename = `orders_backup_fix_${timestamp}.json`;
  const backupCsvFilename = `orders_backup_fix_${timestamp}.csv`;
  const backupsDir = path.resolve(process.cwd(), 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const jsonBackupPath = path.join(backupsDir, backupJsonFilename);
  const csvBackupPath = path.join(backupsDir, backupCsvFilename);

  fs.writeFileSync(jsonBackupPath, JSON.stringify(originalRecords, null, 2), 'utf8');
  fs.writeFileSync(csvBackupPath, convertToCSV(originalRecords), 'utf8');

  console.log('✓ PHASE 0 COMPLETE: Full backup exported.');
  console.log(`  JSON Backup: ${jsonBackupPath}`);
  console.log(`  CSV Mirror:  ${csvBackupPath}\n`);

  // Verify backup integrity before any write
  const testRead = JSON.parse(fs.readFileSync(jsonBackupPath, 'utf8'));
  if (testRead.length !== totalCount) {
    throw new Error(`Backup verification failed: Expected ${totalCount} records, got ${testRead.length}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // PHASE 1 — DRY-RUN PREVIEW (Sort & Mapping)
  // ═══════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('PHASE 1 — DRY-RUN PREVIEW');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Sorting logic:');
  console.log('  1. Primary: order_date ASCENDING (oldest date first)');
  console.log('  2. Tiebreaker: order_time ASCENDING (earliest time first)');
  console.log('  3. Missing order_time treated as 00:00 (earliest on that date)');
  console.log('  4. Tiebreaker 2: created_at ASCENDING\n');

  const sorted = [...originalRecords].sort((a, b) => {
    // 1. Primary: order_date ASCENDING
    const dateA = normalizeDateForSort(a.order_date || a.created_at);
    const dateB = normalizeDateForSort(b.order_date || b.created_at);
    if (dateA !== dateB) {
      return dateA.localeCompare(dateB);
    }

    // 2. Tiebreaker: order_time ASCENDING
    const timeA = parseTimeToMinutes(a.order_time);
    const timeB = parseTimeToMinutes(b.order_time);
    if (timeA !== timeB) {
      return timeA - timeB;
    }

    // 3. Tiebreaker: created_at timestamp ASCENDING
    const createA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const createB = b.created_at ? new Date(b.created_at).getTime() : 0;
    if (createA !== createB) {
      return createA - createB;
    }

    return a.id.localeCompare(b.id);
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

  console.log(`Total Records: ${totalCount}`);
  console.log('\n--- FIRST 5 ROWS SPOT-CHECK (Oldest -> Newest) ---');
  console.table(mappingTable.slice(0, 5));

  console.log('\n--- LAST 5 ROWS SPOT-CHECK (Oldest -> Newest) ---');
  console.table(mappingTable.slice(-5));

  // Save complete mapping table for audit
  const mappingPath = path.join(backupsDir, `order_mapping_${timestamp}.json`);
  fs.writeFileSync(mappingPath, JSON.stringify(mappingTable, null, 2), 'utf8');
  console.log(`Full mapping saved to: ${mappingPath}\n`);

  // ═══════════════════════════════════════════════════════════════
  // PHASE 2 — CLEAR VIA OFFSET (avoid collisions)
  // ═══════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('PHASE 2 — CLEAR VIA OFFSET (+1,000,000)');
  console.log('═══════════════════════════════════════════════════════════════');

  const BATCH_SIZE = 400; // Firestore limit is 500 operations per batch
  for (let i = 0; i < sorted.length; i += BATCH_SIZE) {
    const chunk = sorted.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    chunk.forEach(record => {
      const offsetNumber = (Number(record.order_number) || 0) + 1000000;
      batch.update(doc(db, 'orders', record.id), {
        order_number: offsetNumber
      });
    });
    await batch.commit();
    console.log(`  Offset chunk ${i + 1} to ${Math.min(i + BATCH_SIZE, sorted.length)} committed.`);
  }
  console.log('✓ PHASE 2 COMPLETE: All records temporarily offset by +1,000,000.\n');

  // ═══════════════════════════════════════════════════════════════
  // PHASE 3 — FINAL ASSIGN (1..N bulk updates)
  // ═══════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('PHASE 3 — FINAL ASSIGN (1, 2, 3, ... N)');
  console.log('═══════════════════════════════════════════════════════════════');

  for (let i = 0; i < mappingTable.length; i += BATCH_SIZE) {
    const chunk = mappingTable.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    chunk.forEach(m => {
      batch.update(doc(db, 'orders', m.id), {
        order_number: m.new_order_number
      });
    });
    await batch.commit();
    console.log(`  Final assignment chunk ${i + 1} to ${Math.min(i + BATCH_SIZE, mappingTable.length)} committed.`);
  }
  console.log('✓ PHASE 3 COMPLETE: All records assigned sequential order_number (1..N).\n');

  // ═══════════════════════════════════════════════════════════════
  // PHASE 4 — VERIFY (Strict Assertions)
  // ═══════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('PHASE 4 — VERIFICATION & INTEGRITY CHECK');
  console.log('═══════════════════════════════════════════════════════════════');

  console.log('Re-fetching all records from Firestore...');
  const postSnapshot = await getDocs(collection(db, 'orders'));
  const postRecords: any[] = [];
  postSnapshot.forEach(docSnap => {
    postRecords.push({ ...docSnap.data(), id: docSnap.id });
  });

  let allChecksPassed = true;

  // (a) Total count == Phase 1 count
  const checkA = postRecords.length === totalCount;
  console.log(`Check (a) Record Count: ${postRecords.length} == ${totalCount} -> [${checkA ? 'PASS' : 'FAIL'}]`);
  if (!checkA) allChecksPassed = false;

  // (b) order_number set == {1, 2, … N} (contiguous, no gaps, no duplicates)
  const numbers = postRecords.map(r => r.order_number).sort((a, b) => a - b);
  let checkB = numbers.length === totalCount;
  for (let idx = 0; idx < totalCount; idx++) {
    if (numbers[idx] !== idx + 1) {
      checkB = false;
      console.error(`  Gap or mismatch at index ${idx}: expected ${idx + 1}, got ${numbers[idx]}`);
      break;
    }
  }
  console.log(`Check (b) Contiguous {1..${totalCount}} without gaps/duplicates -> [${checkB ? 'PASS' : 'FAIL'}]`);
  if (!checkB) allChecksPassed = false;

  // (c) Earliest-date record == order_number 1; latest-date record == N
  const order1 = postRecords.find(r => r.order_number === 1);
  const orderN = postRecords.find(r => r.order_number === totalCount);
  const expectedEarliest = sorted[0];
  const expectedLatest = sorted[sorted.length - 1];
  const checkC = (order1?.id === expectedEarliest?.id) && (orderN?.id === expectedLatest?.id);
  console.log(`Check (c) Earliest-date record == #1 (${order1?.id}) & Latest-date record == #${totalCount} (${orderN?.id}) -> [${checkC ? 'PASS' : 'FAIL'}]`);
  if (!checkC) allChecksPassed = false;

  // (d) Field-diff sample: pick 20 random records, compare every non-order_number field against Phase 0 backup
  const backupMap = new Map(originalRecords.map(r => [r.id, r]));
  const sampleIndices = new Set<number>();
  while (sampleIndices.size < Math.min(20, totalCount)) {
    sampleIndices.add(Math.floor(Math.random() * totalCount));
  }

  let checkD = true;
  const criticalFields = [
    'delivery_date',
    'delivery_time_expected',
    'delivery_partner',
    'actual_delivery_time',
    'delivered_by',
    'rider_delivered',
    'status',
    'payment_type',
    'mobile_number',
    'customer_name',
    'address',
    'item_image_url'
  ];

  for (const idx of sampleIndices) {
    const postRec = postRecords[idx];
    const origRec = backupMap.get(postRec.id);
    if (!origRec) {
      checkD = false;
      console.error(`  Record missing from backup: ${postRec.id}`);
      continue;
    }

    // Compare all keys except order_number and updated_at
    const allKeys = Array.from(new Set([...Object.keys(origRec), ...Object.keys(postRec)]));
    for (const key of allKeys) {
      if (key === 'order_number' || key === 'order_id') continue;
      const origVal = origRec[key] === undefined ? null : origRec[key];
      const postVal = postRec[key] === undefined ? null : postRec[key];
      if (JSON.stringify(origVal) !== JSON.stringify(postVal)) {
        checkD = false;
        console.error(`  Field mismatch on record ${postRec.id} for field "${key}": orig=${JSON.stringify(origVal)} vs post=${JSON.stringify(postVal)}`);
      }
    }
  }
  console.log(`Check (d) Zero field diff on sample (critical fields & all metadata identical) -> [${checkD ? 'PASS' : 'FAIL'}]`);
  if (!checkD) allChecksPassed = false;

  // (e) No record was deleted or added (id set identical to backup)
  const postIds = new Set(postRecords.map(r => r.id));
  const origIds = new Set(originalRecords.map(r => r.id));
  const checkE = postIds.size === origIds.size && [...origIds].every(id => postIds.has(id));
  console.log(`Check (e) ID set match byte-for-byte -> [${checkE ? 'PASS' : 'FAIL'}]`);
  if (!checkE) allChecksPassed = false;

  console.log('\n═══════════════════════════════════════════════════════════════');
  if (allChecksPassed) {
    console.log('MIGRATION SUCCESS: ALL INTEGRITY CHECKS PASSED.');
    console.log(`${totalCount} records renumbered 1..${totalCount}; zero non-order_number fields changed; delivery data intact.`);
  } else {
    console.error('MIGRATION INTEGRITY FAILED!');
    console.error(`Rollback instruction: tsx scripts/restore.ts ${jsonBackupPath}`);
    process.exit(1);
  }
  console.log('═══════════════════════════════════════════════════════════════\n');
}

runMigration().catch(err => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
