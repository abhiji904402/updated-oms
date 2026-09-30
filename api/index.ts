import express from 'express';
import cors from 'cors';
import compression from 'compression';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import https from 'https';
import QRCode from 'qrcode';
import {
  startWhatsAppEngine,
  disconnectWhatsAppEngine,
  sendWhatsAppEngineMessage,
  getEngineState,
  hasExistingSession,
  restoreSessionFromCloud,
  registerOnConnectedListener
} from './whatsapp-service.ts';

dotenv.config();

// Auto-reconnect existing WhatsApp session (checks local disk + persistent Firebase Cloud)
(async () => {
  try {
    let hasSaved = hasExistingSession();
    if (!hasSaved) {
      console.log('🔍 Checking Firebase Cloud for saved WhatsApp session backup...');
      const restored = await restoreSessionFromCloud();
      if (restored) hasSaved = true;
    }
    if (hasSaved) {
      console.log('🚀 Found WhatsApp session (disk or cloud backup), auto-reconnecting in-house engine...');
      await startWhatsAppEngine(false);
    } else {
      console.log('ℹ️ No prior WhatsApp session found in cloud or disk. Ready for QR scan.');
    }
  } catch (err) {
    console.error('Failed auto-reconnecting WA session on boot:', err);
  }
})();


const originalConsoleError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && (args[0].includes('RESOURCE_EXHAUSTED') || args[0].includes('Quota limit exceeded'))) {
    return;
  }
  originalConsoleError(...args);
};

const app = express();

app.use(cors());
app.use(compression({ level: 6, threshold: 512 }));
app.use(express.json({ limit: '50mb' }));

const MONGODB_URI = process.env.MONGODB_URI;

// =========================================================================
// BROOMIES REALTIME DATABASE ENGINE (BRDB)
// In-Memory RAM + Write-Ahead Log + Disk Snapshot + Double Confirmation Queue
// =========================================================================

const DATA_DIR = path.join(process.cwd(), '.data');
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch {}
}

const DB_FILE = path.join(DATA_DIR, 'broomies_store.json');
const WAL_FILE = path.join(DATA_DIR, 'broomies_wal.log');

interface CollectionCache {
  map: Map<string, any>;
  version: number;
  lastUpdated: number;
  isReady: boolean;
}

const cache: Record<string, CollectionCache> = {
  'orders': { map: new Map(), version: 1, lastUpdated: 0, isReady: false },
  'delivery_partners': { map: new Map(), version: 1, lastUpdated: 0, isReady: false },
  'outlet_locations': { map: new Map(), version: 1, lastUpdated: 0, isReady: false },
  'system_settings': { map: new Map(), version: 1, lastUpdated: 0, isReady: false },
  'whatsapp_logs': { map: new Map(), version: 1, lastUpdated: 0, isReady: false },
  'whatsapp_pending_queue': { map: new Map(), version: 1, lastUpdated: 0, isReady: false }
};

// Double-confirmation background sync queue
interface SyncTask {
  collection: string;
  action: 'set' | 'update' | 'delete';
  id: string;
  data?: any;
  timestamp: number;
  retries: number;
}
const backgroundSyncQueue: SyncTask[] = [];
let isProcessingQueue = false;

// Append to Write-Ahead Log (WAL)
function appendWAL(task: { collection: string; action: string; id: string; data?: any }) {
  try {
    const entry = JSON.stringify({ ...task, t: Date.now() }) + '\n';
    fs.appendFileSync(WAL_FILE, entry, 'utf-8');
  } catch {}
}

// Load initial disk snapshot or fallback seed instantly (< 1ms)
function loadFromDisk() {
  // 1. First populate from bundled static seedStoreData if exists
  try {
    const seedPath = path.join(process.cwd(), 'public', 'broomies_store_seed.json');
    if (fs.existsSync(seedPath)) {
      const raw = fs.readFileSync(seedPath, 'utf-8');
      const seedStoreData = JSON.parse(raw);
      if (seedStoreData && typeof seedStoreData === 'object') {
        for (const coll of Object.keys(cache)) {
          const collData = (seedStoreData as any)[coll];
          if (collData && typeof collData === 'object') {
            const c = cache[coll];
            for (const [k, v] of Object.entries(collData)) {
              c.map.set(String(k), v);
            }
            c.isReady = true;
            c.lastUpdated = Date.now();
          }
        }
      }
    }
  } catch (seedErr) {
    console.warn('[Realtime DB] Seed data load skipped:', seedErr);
  }

  // 2. Overlay disk snapshot if exists
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      for (const coll of Object.keys(cache)) {
        if (parsed[coll] && typeof parsed[coll] === 'object') {
          const c = cache[coll];
          for (const [k, v] of Object.entries(parsed[coll])) {
            c.map.set(String(k), v);
          }
          c.isReady = true;
          c.lastUpdated = Date.now();
        }
      }
    }
  } catch (err) {
    console.warn('[Realtime DB] Could not read DB_FILE:', err);
  }

  console.log(`[Realtime DB Engine] Ready with ${cache['orders'].map.size} total orders.`);
}

// Debounced disk snapshot persistence
let diskSaveTimer: NodeJS.Timeout | null = null;
function persistToDisk() {
  if (diskSaveTimer) clearTimeout(diskSaveTimer);
  diskSaveTimer = setTimeout(() => {
    try {
      const exportObj: Record<string, Record<string, any>> = {};
      for (const [coll, c] of Object.entries(cache)) {
        exportObj[coll] = {};
        for (const [k, v] of c.map.entries()) {
          exportObj[coll][k] = v;
        }
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(exportObj), 'utf-8');
    } catch (err) {
      console.warn('[Realtime DB] Error persisting snapshot to disk:', err);
    }
  }, 200);
}

loadFromDisk();

// Double confirmation background sync worker
async function processBackgroundSyncQueue() {
  if (isProcessingQueue || backgroundSyncQueue.length === 0) return;
  if (!isMongoConnected && !isFirestoreConnected) return;
  isProcessingQueue = true;

  try {
    let firestoreModule = null;
    if (isFirestoreConnected) {
      firestoreModule = await import('firebase/firestore');
    }

    while (backgroundSyncQueue.length > 0) {
      const chunk = backgroundSyncQueue.splice(0, 400);

      const batch = (isFirestoreConnected && firestoreDb && firestoreModule) ? firestoreModule.writeBatch(firestoreDb) : null;
      let hasFirestoreOps = false;

      for (const task of chunk) {
        // Sync to Mongo if connected
        if (isMongoConnected) {
          try {
            const Model = models[task.collection];
            if (Model) {
              if (task.action === 'set' || task.action === 'update') {
                if (task.collection === 'system_settings') {
                  await Model.findOneAndUpdate({ _id: task.id }, { data: task.data?.data || task.data }, { upsert: true, maxTimeMS: 5000 });
                } else {
                  if (task.collection === 'orders' && task.data?.order_number) {
                    const num = Number(task.data.order_number);
                    if (num > 0) {
                      await Model.updateMany({ order_number: num }, { $set: task.data }, { maxTimeMS: 5000 }).catch(() => {});
                    }
                  }
                  await Model.findOneAndUpdate({ id: task.id }, { $set: task.data }, { upsert: true, maxTimeMS: 5000 });
                }
              } else if (task.action === 'delete') {
                const query = task.collection === 'system_settings' ? { _id: task.id } : { id: task.id };
                await Model.findOneAndDelete(query, { maxTimeMS: 5000 });
              }
            }
          } catch (err: any) {
             console.warn('Mongo bulk sync error:', err.message);
          }
        }

        // Prepare Firestore batch
        if (batch && firestoreDb && firestoreModule) {
          const docRef = firestoreModule.doc(firestoreDb, task.collection, String(task.id));
          if (task.action === 'set' || task.action === 'update') {
            batch.set(docRef, task.data?.data || task.data, { merge: true });
            hasFirestoreOps = true;
          } else if (task.action === 'delete') {
            batch.delete(docRef);
            hasFirestoreOps = true;
          }
        }
      }

      if (batch && hasFirestoreOps) {
        try {
          await batch.commit();
        } catch (err: any) {
          if (err.message && err.message.includes('RESOURCE_EXHAUSTED')) {
            console.warn('Firestore quota exceeded. Pausing Firestore sync for 10 minutes.');
            // Stop syncing to Firestore temporarily to stop the SDK from spamming logs
            isFirestoreConnected = false;
            setTimeout(() => {
              isFirestoreConnected = true;
            }, 10 * 60 * 1000);
          } else {
             console.warn('Firestore batch commit error:', err.message);
          }
        }
      }
    }
  } finally {
    isProcessingQueue = false;
  }
}

setInterval(processBackgroundSyncQueue, 1500);

// Schemas & MongoDB Setup
const OrderSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  order_number: { type: mongoose.Schema.Types.Mixed, index: true },
  outlet: { type: String, index: true },
  customer_name: String,
  customer_phone: String,
  delivery_address: String,
  items: String,
  item_image_url: String,
  quantity: mongoose.Schema.Types.Mixed,
  total_amount: mongoose.Schema.Types.Mixed,
  advance_amount: mongoose.Schema.Types.Mixed,
  remaining_balance: mongoose.Schema.Types.Mixed,
  due_amount: mongoose.Schema.Types.Mixed,
  payment_type: String,
  status: { type: String, index: true },
  delivery_partner: String,
  scheduled_time: String,
  delivery_photo_url: String,
  otp: String,
  actual_delivery_time: String,
  delivered_by: String,
  payment_changed_by: String,
  payment_changed_at: String,
  rider_delivered: Boolean,
  delivery_confirmation_pending: Boolean,
  notes: String,
  delivery_date: { type: String, index: true },
  order_date: { type: String, index: true },
  created_at: { type: String, index: true },
  updated_at: { type: String, index: true }
}, { _id: false, strict: false });

const PartnerSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: String,
  phone: String,
  vehicle_type: String,
  status: String,
  total_deliveries: Number,
  rating: Number,
  is_tracking_active: Boolean,
  location: {
    latitude: Number,
    longitude: Number,
    timestamp: String
  }
}, { _id: false, strict: false });

const OutletLocationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  latitude: Number,
  longitude: Number,
  address: String,
  updated_at: String
}, { _id: false, strict: false });

const SystemSettingsSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { strict: false });

const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
const Partner = mongoose.models.DeliveryPartner || mongoose.model('DeliveryPartner', PartnerSchema);
const OutletLocation = mongoose.models.OutletLocation || mongoose.model('OutletLocation', OutletLocationSchema);
const SystemSettings = mongoose.models.SystemSettings || mongoose.model('SystemSettings', SystemSettingsSchema);

const models: Record<string, mongoose.Model<any>> = {
  'orders': Order,
  'delivery_partners': Partner,
  'outlet_locations': OutletLocation,
  'system_settings': SystemSettings
};

// Background Mongo Sync if configured
let isMongoConnected = false;
async function tryConnectMongo() {
  if (!MONGODB_URI || MONGODB_URI.includes('<username>')) return;
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10
    });
    isMongoConnected = true;
    console.log('✅ MongoDB connected in background.');

    // Reconcile collections from Mongo without wiping local in-memory RAM
    for (const [collName, Model] of Object.entries(models)) {
      const c = cache[collName];
      if (c) {
        const docs = await Model.find({}).lean();
        if (docs.length > 0) {
          docs.forEach((d: any) => {
            const key = collName === 'system_settings' ? (d._id || d.id) : (d.id || d._id);
            if (key) {
              const clean = { ...d };
              delete clean.__v;
              if (collName !== 'system_settings') delete clean._id;
              // If local RAM doesn't have it yet, add it
              if (!c.map.has(String(key))) {
                c.map.set(String(key), clean);
              }
            }
          });
          c.isReady = true;
          c.lastUpdated = Date.now();
          c.version += 1;
        }

        // Back-sync any local records to Mongo if Mongo was missing them
        for (const [k, localDoc] of c.map.entries()) {
          backgroundSyncQueue.push({
            collection: collName,
            action: 'set',
            id: k,
            data: localDoc,
            timestamp: Date.now(),
            retries: 0
          });
        }
        processBackgroundSyncQueue().catch(() => {});
      }
    }
    persistToDisk();
    console.log(`[Realtime DB] Synced & reconciled ${cache['orders'].map.size} total orders.`);
  } catch (err: any) {
    console.warn('[Realtime DB Notice]: Operating on ultra-fast RAM + Disk engine:', err.message);
  }
}
tryConnectMongo();

// =========================================================================
// AUTHORITATIVE SERVER FIRESTORE BRIDGE
// Connects to Firestore 'broomies-v2' on high-speed server network.
// Keeps in-memory cache synchronized with Firestore in real-time.
// =========================================================================
let firestoreDb: any = null;
let isFirestoreConnected = false;

async function tryConnectFirestore() {
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (!fs.existsSync(configPath)) return;
    const raw = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw);
    const { initializeApp, getApps } = await import('firebase/app');
    const { getFirestore, initializeFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, setLogLevel } = await import('firebase/firestore');
    setLogLevel('silent'); // Prevent RESOURCE_EXHAUSTED logs from spamming

    const app = getApps().length > 0 ? getApps()[0] : initializeApp(config, 'backend-server');
    try {
      firestoreDb = initializeFirestore(app, { experimentalForceLongPolling: true }, config.firestoreDatabaseId || undefined);
    } catch (err) {
      firestoreDb = getFirestore(app, config.firestoreDatabaseId || undefined);
    }
    isFirestoreConnected = true;
    console.log(`✅ [Firestore Server Bridge] Connected to database: ${config.firestoreDatabaseId || 'default'}`);

    // Real-time listener for orders on high-speed server connection
    onSnapshot(collection(firestoreDb, 'orders'), (snapshot) => {
      const c = cache['orders'];
      let changesCount = 0;
      snapshot.docChanges().forEach((change) => {
        const id = change.doc.id;
        if (change.type === 'removed') {
          c.map.delete(id);
          broadcastMutation({ collection: 'orders', action: 'delete', id });
          changesCount++;
        } else {
          const item: any = { ...change.doc.data(), id };
          const existing: any = c.map.get(id);
          if (existing) {
            const existingTime = new Date(existing.updated_at || existing.created_at || 0).getTime();
            const incomingTime = new Date(item.updated_at || item.created_at || 0).getTime();
            // Stale protection: if RAM has newer data, ignore stale Firestore snapshot
            if (existingTime > incomingTime) {
              return;
            }
            // Delivered protection: do not revert delivered order to pending unless explicitly cancelled
            if (existing.status === 'delivered' && item.status !== 'delivered' && item.status !== 'cancelled') {
              return;
            }
          }
          c.map.set(id, item);
          changesCount++;
          if (change.type === 'modified' || (change.type === 'added' && c.isReady)) {
            broadcastMutation({ collection: 'orders', action: 'update', id, data: item });
          }
        }
      });
      if (changesCount > 0) {
        c.isReady = true;
        c.lastUpdated = Date.now();
        c.version += 1;
        persistToDisk();
      }
    }, (err) => {
      console.warn('[Firestore Server Bridge] Orders snapshot warning:', err.message);
    });

    // Real-time listener for delivery_partners
    onSnapshot(collection(firestoreDb, 'delivery_partners'), (snapshot) => {
      const c = cache['delivery_partners'];
      snapshot.docChanges().forEach((change) => {
        const id = change.doc.id;
        if (change.type === 'removed') {
          c.map.delete(id);
          broadcastMutation({ collection: 'delivery_partners', action: 'delete', id });
        } else {
          const item = { ...change.doc.data(), id };
          c.map.set(id, item);
          broadcastMutation({ collection: 'delivery_partners', action: 'set', id, data: item });
        }
      });
      c.isReady = true;
      c.lastUpdated = Date.now();
      persistToDisk();
    }, () => {});

    // Real-time listener for outlet_locations
    onSnapshot(collection(firestoreDb, 'outlet_locations'), (snapshot) => {
      const c = cache['outlet_locations'];
      snapshot.docChanges().forEach((change) => {
        const id = change.doc.id;
        if (change.type === 'removed') {
          c.map.delete(id);
          broadcastMutation({ collection: 'outlet_locations', action: 'delete', id });
        } else {
          const item = { ...change.doc.data(), id };
          c.map.set(id, item);
          broadcastMutation({ collection: 'outlet_locations', action: 'set', id, data: item });
        }
      });
      c.isReady = true;
      c.lastUpdated = Date.now();
      persistToDisk();
    }, () => {});

    // Real-time listener for system_settings
    onSnapshot(collection(firestoreDb, 'system_settings'), (snapshot) => {
      const c = cache['system_settings'];
      snapshot.docChanges().forEach((change) => {
        const id = change.doc.id;
        if (change.type === 'removed') {
          c.map.delete(id);
          broadcastMutation({ collection: 'system_settings', action: 'delete', id });
        } else {
          const item = { _id: id, id, data: change.doc.data() };
          c.map.set(id, item);
          broadcastMutation({ collection: 'system_settings', action: 'set', id, data: item });
        }
      });
      c.isReady = true;
      c.lastUpdated = Date.now();
      persistToDisk();
    }, () => {});

  } catch (err: any) {
    console.warn('[Firestore Server Bridge] Initialization notice:', err.message);
  }
}
tryConnectFirestore();

// Active SSE client connections
const sseClients = new Set<express.Response>();

export function broadcastMutation(mutation: {
  collection: string;
  action: 'set' | 'update' | 'delete' | 'clear';
  id?: string;
  data?: any;
}) {
  const payload = `event: mutation\ndata: ${JSON.stringify(mutation)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

// =========================================================================
// AUTHORITATIVE LIVE DATABASE BRIDGE (Firebase Realtime Database)
// Syncs additions, edits, deletions, and deliveries live bidirectionally!
// =========================================================================
const RTDB_BASE = 'https://broms-734a5-default-rtdb.asia-southeast1.firebasedatabase.app';

export async function syncMutationToRTDB(
  collectionName: string,
  action: 'set' | 'update' | 'delete' | 'clear',
  id?: string,
  data?: any
) {
  try {
    if (action === 'clear') {
      await fetch(`${RTDB_BASE}/${collectionName}.json`, { method: 'DELETE' });
      return;
    }
    if (!id) return;

    if (action === 'delete') {
      await fetch(`${RTDB_BASE}/${collectionName}/${id}.json`, { method: 'DELETE' });
      // If deleting an order, also delete any duplicates with same order_number
      if (collectionName === 'orders') {
        const c = cache['orders'];
        const existing = c?.map.get(id);
        const targetNum = Number(data?.order_number || existing?.order_number) || 0;
        if (targetNum > 0 && c) {
          for (const [otherId, ord] of c.map.entries()) {
            if (otherId !== id && Number(ord.order_number) === targetNum) {
              fetch(`${RTDB_BASE}/${collectionName}/${otherId}.json`, { method: 'DELETE' }).catch(() => {});
            }
          }
        }
      }
      return;
    }

    if (action === 'set') {
      await fetch(`${RTDB_BASE}/${collectionName}/${id}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } else if (action === 'update') {
      await fetch(`${RTDB_BASE}/${collectionName}/${id}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    }

    // If order, sync duplicate documents with same order_number in RTDB as well
    if (collectionName === 'orders' && data && data.order_number) {
      const num = Number(data.order_number);
      if (num > 0) {
        const c = cache['orders'];
        if (c) {
          for (const [otherId, ord] of c.map.entries()) {
            if (otherId !== id && Number(ord.order_number) === num) {
              const dupPayload = { ...ord, ...data, id: otherId };
              fetch(`${RTDB_BASE}/${collectionName}/${otherId}.json`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dupPayload)
              }).catch(() => {});
            }
          }
        }
      }
    }
  } catch (err: any) {
    console.warn(`[RTDB Sync Error] ${action} on ${collectionName}/${id}:`, err.message);
  }
}

// Periodic lightweight background sync from live RTDB
setTimeout(() => {
  async function periodicSyncRTDB() {
    try {
      const res = await fetch(`${RTDB_BASE}/orders.json`).catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object') {
          const c = cache['orders'];
          if (c) {
            let changes = 0;
            for (const [id, ord] of Object.entries(data as Record<string, any>)) {
              if (!ord || !id) continue;
              const existing = c.map.get(id);
              if (existing) {
                if (ord.status === 'delivered' && existing.status !== 'delivered') {
                  c.map.set(id, { ...existing, ...ord, id });
                  changes++;
                }
              }
            }
            if (changes > 0) {
              c.version += 1;
              c.lastUpdated = Date.now();
              persistToDisk();
            }
          }
        }
      }
    } catch (err: any) {
      console.warn('[RTDB Poller] Notice:', err.message);
    }
    setTimeout(periodicSyncRTDB, 60000);
  }
  periodicSyncRTDB();
}, 10000);

// --- API ROUTER ---
const APP_VERSION = Date.now();
const apiRouter = express.Router();

apiRouter.get('/version', (req, res) => {
  res.json({ version: APP_VERSION });
});

apiRouter.get('/health', async (req, res) => {
  res.json({
    status: 'ok',
    orders_count: cache['orders']?.map?.size || 0,
    orders_ready: true,
    active_sse_clients: sseClients.size,
    mongo_connected: isMongoConnected,
    timestamp: new Date().toISOString()
  });
});

// GET /api/events - Real-Time Server-Sent Events (SSE) Stream (< 10ms real-time push)
apiRouter.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send initial connection ACK
  res.write(`event: connected\ndata: {"status":"connected","timestamp":"${new Date().toISOString()}"}\n\n`);

  sseClients.add(res);

  // Keep-alive heartbeat ping every 15s with named event
  const interval = setInterval(() => {
    try {
      res.write(`event: heartbeat\ndata: {"time":${Date.now()}}\n\n`);
    } catch {
      clearInterval(interval);
      sseClients.delete(res);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(interval);
    sseClients.delete(res);
  });
});

// =========================================================================
// WHATSAPP REAL AUTOMATION & GATEWAY ENGINE
// =========================================================================

const DEFAULT_WA_CONFIG = {
  id: 'whatsapp_config',
  connected: false,
  phoneNumber: '',
  businessName: 'Broomies Bakery',
  sessionState: 'disconnected',
  gatewayType: 'none',
  gatewayConfig: {
    ultraMsgInstanceId: '',
    ultraMsgToken: '',
    greenApiInstanceId: '',
    greenApiToken: '',
    metaPhoneNumberId: '',
    metaAccessToken: '',
    customWebhookUrl: '',
    customWebhookKey: ''
  },
  autoConfirmOnCreate: false,
  autoDispatchOnRider: false,
  autoDeliveryComplete: false,
  autoPaymentReminder: false,
  throttleDelaySeconds: 5,
  antiBanProtection: true,
  workingHoursOnly: false,
  templates: {
    confirm: `Thank you so much for your recent order from Broomies! Your order number is ({order_number}).\n\nWe're thrilled to have the opportunity to serve you and hope you enjoy every delicious bite.\n\nOrder Details:\nItem: {items}\nTotal Amount: ₹{total_amount}\nAdvance Paid: ₹{advance_amount}\nRemaining Balance: ₹{remaining_balance}\nDelivery Date: {delivery_date}\nDelivery Time: {delivery_time}\n\nIf you have any queries or need further assistance, please feel free to get in touch with us at:\n9266424088\n\nIf still query not solved call 9971860845\n\nBest wishes,\nThe Broomies Team`,
    dispatch: `Hi {customer_name},\n\nYour order #{order_number} is out for delivery with rider {rider_name}.\n\nOTP for verification: {otp}\n\nThank you!\nBroomies Team`,
    delivered: `Hi {customer_name},\n\nYour Broomies Bakery order #{order_number} has been delivered successfully! Thank you for choosing Broomies Bakery. Have a sweet day!\n\nBest wishes,\nThe Broomies Team`,
    reminder: `Hi {customer_name},\n\nFriendly reminder for your Broomies Bakery order #{order_number}.\n\nRemaining due amount: ₹{remaining_balance}\n\nPlease pay via UPI/Cash on delivery.\n\nThank you!\nBroomies Team`
  }
};

function getWhatsAppConfig() {
  let existing = cache['system_settings']?.map.get('whatsapp_config');
  if (existing) {
    if (existing.data && typeof existing.data === 'object') {
      existing = { ...existing.data, ...existing, ...existing.data };
    }
    const engine = getEngineState();
    if (engine.connected && engine.phoneNumber) {
      existing.connected = true;
      existing.sessionState = 'connected';
      existing.gatewayType = 'in_house_qr';
      existing.phoneNumber = engine.phoneNumber;
      if (engine.userName) existing.userName = engine.userName;
      existing.alreadyLinkedOnOtherDevice = false;
    } else {
      existing.connected = false;
      existing.sessionState = (engine.sessionState === 'connecting' || engine.sessionState === 'pairing') ? engine.sessionState : 'disconnected';
      existing.alreadyLinkedOnOtherDevice = false;
      existing.phoneNumber = '';
    }
    return existing;
  }
  cache['system_settings']?.map.set('whatsapp_config', DEFAULT_WA_CONFIG);
  return DEFAULT_WA_CONFIG;
}

// =========================================================================
// WHATSAPP OFFLINE OUTBOX QUEUE MANAGER
// Automatically queues messages when WhatsApp is unlinked or disconnected,
// and auto-dispatches them the instant WhatsApp is re-linked or connected!
// =========================================================================

interface WhatsAppPendingItem {
  id: string;
  orderNumber?: number;
  orderId?: string;
  customerName: string;
  recipientPhone: string;
  message: string;
  type: string;
  createdAt: string;
  attempts: number;
  lastAttemptAt?: string;
  lastError?: string;
  directWebUrl?: string;
}

function enqueueWhatsAppMessage(params: {
  phone: string;
  message: string;
  orderNumber?: number;
  orderId?: string;
  customerName?: string;
  type?: string;
  directWebUrl?: string;
}): WhatsAppPendingItem {
  const queueMap = cache['whatsapp_pending_queue']?.map;
  const cleanPhone = String(params.phone).replace(/[^0-9]/g, '');
  const recipientPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const ordNum = Number(params.orderNumber) || 0;
  const msgType = params.type || 'custom';

  // Find if an identical message for this order + type is already queued to prevent spam
  let existingId: string | null = null;
  if (queueMap && ordNum > 0) {
    for (const [key, val] of queueMap.entries()) {
      if (val.orderNumber === ordNum && val.type === msgType) {
        existingId = key;
        break;
      }
    }
  }

  const queueId = existingId || `waq-${ordNum || 'c'}-${msgType}-${Date.now()}`;
  const queueItem: WhatsAppPendingItem = {
    id: queueId,
    orderNumber: ordNum > 0 ? ordNum : undefined,
    orderId: params.orderId || undefined,
    customerName: params.customerName || 'Customer',
    recipientPhone,
    message: String(params.message),
    type: msgType,
    createdAt: new Date().toISOString(),
    attempts: 0,
    directWebUrl: params.directWebUrl
  };

  queueMap?.set(queueId, queueItem);

  // Also log into whatsapp_logs with 'queued' status
  const logId = `walog-q-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const logEntry = {
    id: logId,
    timestamp: new Date().toISOString(),
    recipient_phone: `+${recipientPhone}`,
    customer_name: params.customerName || 'Customer',
    order_number: ordNum > 0 ? ordNum : undefined,
    order_id: params.orderId || undefined,
    type: msgType,
    status: 'queued',
    message: String(params.message),
    error: 'WhatsApp unlinked/offline. Safely queued in Outbox; will auto-send the moment WhatsApp is re-linked.',
    direct_url: params.directWebUrl
  };
  cache['whatsapp_logs']?.map.set(logId, logEntry);

  persistToDisk();
  console.log(`📦 [WhatsApp Outbox] Queued ${msgType} message for Order #${ordNum || 'Custom'} (${recipientPhone}). Total pending: ${queueMap?.size || 0}`);
  return queueItem;
}

let isFlushingWhatsAppQueue = false;

async function processPendingWhatsAppQueue(): Promise<{
  processedCount: number;
  successCount: number;
  failedCount: number;
  remainingCount: number;
}> {
  const engine = getEngineState();
  const queueMap = cache['whatsapp_pending_queue']?.map;
  const currentCount = queueMap?.size || 0;

  if (!engine.connected || !engine.phoneNumber) {
    console.log('[WhatsApp Outbox] Cannot flush: WhatsApp is not connected.');
    return { processedCount: 0, successCount: 0, failedCount: 0, remainingCount: currentCount };
  }

  if (isFlushingWhatsAppQueue) {
    console.log('[WhatsApp Outbox] Queue flush already in progress, skipping overlapping call.');
    return { processedCount: 0, successCount: 0, failedCount: 0, remainingCount: currentCount };
  }

  if (!queueMap || queueMap.size === 0) {
    return { processedCount: 0, successCount: 0, failedCount: 0, remainingCount: 0 };
  }

  isFlushingWhatsAppQueue = true;
  let processed = 0;
  let successCount = 0;
  let failedCount = 0;

  try {
    const items: WhatsAppPendingItem[] = Array.from(queueMap.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    console.log(`🚀 [WhatsApp Outbox] Auto-dispatching ${items.length} pending messages via connected phone ${engine.phoneNumber}...`);

    for (const item of items) {
      // Re-check live connection before sending each message
      const liveState = getEngineState();
      if (!liveState.connected || !liveState.phoneNumber) {
        console.warn('⚠️ [WhatsApp Outbox] Connection lost during queue processing. Halting flush until reconnected.');
        break;
      }

      processed++;
      const sendRes = await sendWhatsAppEngineMessage(item.recipientPhone, item.message);

      if (sendRes.success) {
        successCount++;
        queueMap.delete(item.id);

        const logId = `walog-sent-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const logEntry = {
          id: logId,
          timestamp: new Date().toISOString(),
          recipient_phone: `+${item.recipientPhone}`,
          customer_name: item.customerName || 'Customer',
          order_number: item.orderNumber,
          order_id: item.orderId,
          type: item.type,
          status: 'delivered',
          sent_via: `Official WhatsApp (Auto-Dispatched on Reconnect: ${liveState.phoneNumber})`,
          message: item.message,
          direct_url: item.directWebUrl
        };
        cache['whatsapp_logs']?.map.set(logId, logEntry);
        console.log(`✅ [WhatsApp Outbox] Auto-sent Order #${item.orderNumber || ''} (${item.type}) to +${item.recipientPhone}`);
      } else {
        item.attempts = (item.attempts || 0) + 1;
        item.lastAttemptAt = new Date().toISOString();
        item.lastError = sendRes.error;
        console.warn(`⚠️ [WhatsApp Outbox] Attempt ${item.attempts} failed for Order #${item.orderNumber}: ${sendRes.error}`);

        if (item.attempts >= 4) {
          failedCount++;
          queueMap.delete(item.id);
          const logId = `walog-fail-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          cache['whatsapp_logs']?.map.set(logId, {
            id: logId,
            timestamp: new Date().toISOString(),
            recipient_phone: `+${item.recipientPhone}`,
            customer_name: item.customerName,
            order_number: item.orderNumber,
            order_id: item.orderId,
            type: item.type,
            status: 'failed',
            error: `Max retries exceeded: ${sendRes.error}`,
            message: item.message,
            direct_url: item.directWebUrl
          });
        }
      }

      persistToDisk();
      // Anti-spam delay between queued messages (2.5 seconds)
      await new Promise(r => setTimeout(r, 2500));
    }
  } catch (err) {
    console.error('❌ [WhatsApp Outbox] Error while flushing queue:', err);
  } finally {
    isFlushingWhatsAppQueue = false;
  }

  const remaining = cache['whatsapp_pending_queue']?.map.size || 0;
  console.log(`🏁 [WhatsApp Outbox] Flush finished. Processed: ${processed}, Sent: ${successCount}, Failed: ${failedCount}, Remaining: ${remaining}`);
  return { processedCount: processed, successCount, failedCount, remainingCount: remaining };
}

// Auto-register queue flush on WhatsApp connection
registerOnConnectedListener(async (phone) => {
  console.log(`🎉 [WhatsApp Engine] Connected callback fired for +${phone}! Triggering pending Outbox auto-dispatch...`);
  setTimeout(() => {
    processPendingWhatsAppQueue().catch((err) => console.error('Error auto-flushing queue on connect:', err));
  }, 1500);
});

// 1. GET /api/whatsapp/status
apiRouter.get('/whatsapp/status', async (req, res) => {
  const cfg = getWhatsAppConfig();
  const engine = getEngineState();
  const isTrulyConnected = Boolean(engine.connected && engine.phoneNumber);
  const pendingQueueCount = cache['whatsapp_pending_queue']?.map.size || 0;

  // If connected and has pending messages in outbox, trigger background auto-flush!
  if (isTrulyConnected && pendingQueueCount > 0 && !isFlushingWhatsAppQueue) {
    processPendingWhatsAppQueue().catch(() => {});
  }

  if (isTrulyConnected) {
    cfg.connected = true;
    cfg.sessionState = 'connected';
    cfg.gatewayType = 'in_house_qr';
    cfg.phoneNumber = engine.phoneNumber;
    cfg.userName = engine.userName || 'Broomies Official';
    cfg.lastSync = engine.lastConnectedAt || cfg.lastSync || new Date().toISOString();
    cfg.qrCode = null;
    cfg.alreadyLinkedOnOtherDevice = false;
  } else if (engine.sessionState === 'pairing' && engine.qrCode) {
    cfg.connected = false;
    cfg.sessionState = 'pairing';
    cfg.qrCode = engine.qrCode;
    cfg.qrExpiresAt = engine.qrExpiresAt;
    cfg.gatewayType = 'in_house_qr';
    cfg.alreadyLinkedOnOtherDevice = false;
    cfg.phoneNumber = '';
  } else {
    cfg.connected = false;
    cfg.sessionState = engine.sessionState === 'connecting' ? 'connecting' : 'disconnected';
    cfg.qrCode = engine.qrCode || null;
    cfg.alreadyLinkedOnOtherDevice = false;
    cfg.phoneNumber = '';
  }

  res.json({
    success: true,
    ...cfg,
    connected: isTrulyConnected,
    alreadyLinkedOnOtherDevice: false,
    hasExistingSession: false,
    pendingQueueCount,
    isFlushingQueue: isFlushingWhatsAppQueue,
    inHouseEngine: {
      connected: isTrulyConnected,
      sessionState: isTrulyConnected ? 'connected' : engine.sessionState,
      phoneNumber: isTrulyConnected ? (engine.phoneNumber || '') : '',
      userName: isTrulyConnected ? (engine.userName || '') : '',
      qrCode: engine.qrCode,
      qrExpiresAt: engine.qrExpiresAt,
      lastError: engine.lastError
    }
  });
});

// 1C. GET /api/whatsapp/queue - Get all pending messages waiting in Outbox
apiRouter.get('/whatsapp/queue', (req, res) => {
  const queueMap = cache['whatsapp_pending_queue']?.map;
  const items = queueMap ? Array.from(queueMap.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  ) : [];
  res.json({
    success: true,
    count: items.length,
    items,
    isProcessing: isFlushingWhatsAppQueue
  });
});

// 1D. POST /api/whatsapp/process-queue - Manually trigger immediate queue dispatch
apiRouter.post('/whatsapp/process-queue', async (req, res) => {
  try {
    const result = await processPendingWhatsAppQueue();
    res.json({
      success: true,
      message: `Processed ${result.processedCount} messages (${result.successCount} sent, ${result.remainingCount} remaining).`,
      ...result
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

// 1E. POST /api/whatsapp/clear-queue - Clear pending outbox messages
apiRouter.post('/whatsapp/clear-queue', (req, res) => {
  const queueMap = cache['whatsapp_pending_queue']?.map;
  const count = queueMap?.size || 0;
  queueMap?.clear();
  persistToDisk();
  res.json({ success: true, message: `Cleared ${count} pending messages from Outbox.` });
});

// 1B. POST /api/whatsapp/generate-qr - Generate Real Official WhatsApp Web QR Code (Baileys Multi-Device)
apiRouter.post('/whatsapp/generate-qr', async (req, res) => {
  try {
    const { forceRelink = false } = req.body || {};
    const existing = getEngineState();

    if (existing.connected && existing.phoneNumber && !forceRelink) {
      return res.json({
        success: true,
        connected: true,
        alreadyLinked: true,
        phoneNumber: existing.phoneNumber,
        sessionState: 'connected',
        message: 'WhatsApp is already connected & linked!'
      });
    }

    // Always start fresh engine when generating QR
    await startWhatsAppEngine(true);

    // Wait up to 12 seconds for QR code to generate
    let attempts = 0;
    while (attempts < 50) {
      const state = getEngineState();
      if (state.qrCode) {
        return res.json({
          success: true,
          qrCode: state.qrCode,
          expiresAt: state.qrExpiresAt,
          sessionState: state.sessionState
        });
      }
      if (state.connected && state.phoneNumber) {
        return res.json({
          success: true,
          connected: true,
          alreadyLinked: true,
          phoneNumber: state.phoneNumber,
          sessionState: 'connected'
        });
      }
      await new Promise(r => setTimeout(r, 250));
      attempts++;
    }

    const state = getEngineState();
    return res.json({
      success: true,
      qrCode: state.qrCode || null,
      sessionState: state.sessionState || 'connecting',
      message: 'Initializing WhatsApp Web session. Please wait a moment.'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

// 2. POST /api/whatsapp/test-gateway - Real validation of external WhatsApp gateway credentials
apiRouter.post('/whatsapp/test-gateway', async (req, res) => {
  try {
    const { gatewayType, gatewayConfig } = req.body || {};
    if (!gatewayType || gatewayType === 'none') {
      return res.status(400).json({ success: false, error: 'Please select a valid gateway provider.' });
    }

    if (gatewayType === 'ultramsg') {
      const { ultraMsgInstanceId, ultraMsgToken } = gatewayConfig || {};
      if (!ultraMsgInstanceId || !ultraMsgToken) {
        return res.status(400).json({ success: false, error: 'Instance ID and Token are required for UltraMsg.' });
      }
      const testRes = await fetch(`https://api.ultramsg.com/${ultraMsgInstanceId.trim()}/instance/status?token=${ultraMsgToken.trim()}`);
      const testData = await testRes.json();
      if (testData?.status?.account_status === 'authenticated' || testData?.status?.account_status === 'connected') {
        return res.json({
          success: true,
          message: 'UltraMsg connected successfully!',
          connected: true,
          phone: testData?.status?.phone || '',
          details: testData?.status
        });
      } else {
        return res.status(400).json({
          success: false,
          error: testData?.error || testData?.message || 'UltraMsg instance is not authenticated. Please scan the QR code on your UltraMsg dashboard first.',
          raw: testData
        });
      }
    } else if (gatewayType === 'greenapi') {
      const { greenApiInstanceId, greenApiToken } = gatewayConfig || {};
      if (!greenApiInstanceId || !greenApiToken) {
        return res.status(400).json({ success: false, error: 'Instance ID and Token are required for GreenAPI.' });
      }
      const testRes = await fetch(`https://api.green-api.com/waInstance${greenApiInstanceId.trim()}/getStateInstance/${greenApiToken.trim()}`);
      const testData = await testRes.json();
      if (testData?.stateInstance === 'authorized') {
        return res.json({
          success: true,
          message: 'GreenAPI connected and authorized!',
          connected: true,
          details: testData
        });
      } else {
        return res.status(400).json({
          success: false,
          error: `GreenAPI state: ${testData?.stateInstance || 'unauthorized'}. Please scan QR on GreenAPI dashboard.`,
          raw: testData
        });
      }
    } else if (gatewayType === 'meta') {
      const { metaPhoneNumberId, metaAccessToken } = gatewayConfig || {};
      if (!metaPhoneNumberId || !metaAccessToken) {
        return res.status(400).json({ success: false, error: 'Phone Number ID and Access Token are required for Meta Cloud API.' });
      }
      const testRes = await fetch(`https://graph.facebook.com/v19.0/${metaPhoneNumberId.trim()}?access_token=${metaAccessToken.trim()}`);
      const testData = await testRes.json();
      if (testData?.id) {
        return res.json({
          success: true,
          message: 'Meta WhatsApp Cloud API verified successfully!',
          connected: true,
          phone: testData.display_phone_number || '',
          businessName: testData.verified_name || '',
          details: testData
        });
      } else {
        return res.status(400).json({
          success: false,
          error: testData?.error?.message || 'Meta Cloud API validation failed.',
          raw: testData
        });
      }
    } else if (gatewayType === 'custom_webhook') {
      const { customWebhookUrl, customWebhookKey } = gatewayConfig || {};
      if (!customWebhookUrl) {
        return res.status(400).json({ success: false, error: 'Custom Webhook URL is required.' });
      }
      const testRes = await fetch(customWebhookUrl.trim(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(customWebhookKey ? { 'Authorization': `Bearer ${customWebhookKey.trim()}` } : {})
        },
        body: JSON.stringify({ type: 'health_check', timestamp: new Date().toISOString() })
      });
      if (testRes.ok) {
        return res.json({ success: true, message: 'Custom Webhook responded with 200 OK!' });
      } else {
        return res.status(400).json({ success: false, error: `Webhook returned HTTP status ${testRes.status}` });
      }
    }

    return res.status(400).json({ success: false, error: 'Unsupported gateway type' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

// 3. POST /api/whatsapp/connect-gateway - Save real gateway connection
apiRouter.post('/whatsapp/connect-gateway', (req, res) => {
  try {
    const { gatewayType, gatewayConfig, phoneNumber, businessName } = req.body || {};
    const cfg = getWhatsAppConfig();
    cfg.connected = true;
    cfg.sessionState = 'connected';
    cfg.gatewayType = gatewayType || 'ultramsg';
    cfg.gatewayConfig = {
      ...(cfg.gatewayConfig || {}),
      ...(gatewayConfig || {})
    };
    if (phoneNumber) cfg.phoneNumber = phoneNumber;
    if (businessName) cfg.businessName = businessName;
    cfg.lastSync = new Date().toISOString();

    cache['system_settings']?.map.set('whatsapp_config', cfg);
    persistToDisk();

    res.json({
      success: true,
      message: 'WhatsApp Gateway connected successfully!',
      config: cfg
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

// 4. POST /api/whatsapp/disconnect - Disconnect session
apiRouter.post('/whatsapp/disconnect', async (req, res) => {
  try {
    await disconnectWhatsAppEngine();
    const cfg = getWhatsAppConfig();
    cfg.connected = false;
    cfg.sessionState = 'disconnected';
    cfg.phoneNumber = '';
    cfg.gatewayType = 'none';
    cfg.qrCode = null;
    cfg.battery = undefined;
    cfg.lastSync = undefined;
    cache['system_settings']?.map.set('whatsapp_config', cfg);
    persistToDisk();

    res.json({
      success: true,
      message: 'WhatsApp session unlinked successfully',
      config: cfg
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

// 5. GET /api/whatsapp/config
apiRouter.get('/whatsapp/config', (req, res) => {
  res.json({
    success: true,
    config: getWhatsAppConfig()
  });
});

// 6. POST /api/whatsapp/config
apiRouter.post('/whatsapp/config', (req, res) => {
  try {
    const updates = req.body || {};
    const current = getWhatsAppConfig();
    const updated = {
      ...current,
      ...updates,
      templates: {
        ...current.templates,
        ...(updates.templates || {})
      },
      gatewayConfig: {
        ...current.gatewayConfig,
        ...(updates.gatewayConfig || {})
      },
      updatedAt: new Date().toISOString()
    };
    cache['system_settings']?.map.set('whatsapp_config', updated);
    persistToDisk();

    res.json({
      success: true,
      message: 'Configuration updated',
      config: updated
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

// 7. POST /api/whatsapp/send - Real send via in-house QR engine, gateway, or 1-click WhatsApp Web
apiRouter.post('/whatsapp/send', async (req, res) => {
  try {
    const { phone, message, orderId, orderNumber, customerName, type = 'custom' } = req.body || {};
    if (!phone || !message) {
      return res.status(400).json({ success: false, error: 'Phone and message are required' });
    }

    const cfg = getWhatsAppConfig();
    const engine = getEngineState();
    const cleanPhone = String(phone).replace(/[^0-9]/g, '');
    const recipientPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const directWebUrl = `https://wa.me/${recipientPhone}?text=${encodeURIComponent(message)}`;

    // Check if either in-house engine is connected OR an external gateway is configured
    const isInHouseConnected = Boolean(engine.connected && engine.phoneNumber);
    const isGatewayConfigured = cfg.connected && cfg.gatewayType && cfg.gatewayType !== 'none';

    if (!isInHouseConnected && !isGatewayConfigured) {
      const queuedItem = enqueueWhatsAppMessage({
        phone: recipientPhone,
        message: String(message),
        orderNumber: Number(orderNumber) || undefined,
        orderId: orderId || undefined,
        customerName: customerName || 'Customer',
        type,
        directWebUrl
      });

      return res.json({
        success: true,
        queued: true,
        isLinked: false,
        message: 'WhatsApp is currently unlinked. Message safely stored in Outbox and will auto-send the instant WhatsApp is re-linked.',
        directWebUrl,
        queuedItem
      });
    }

    let realDeliverySuccess = false;
    let gatewayResponse: any = null;
    let sendError: string | null = null;
    let sentVia = 'Unknown';

    // Priority 1: In-House Official WhatsApp Web Socket (Zero external API, authentic delivery)
    if (isInHouseConnected) {
      sentVia = `Official WhatsApp (${engine.phoneNumber || 'Linked Device'})`;
      const engineRes = await sendWhatsAppEngineMessage(recipientPhone, message);
      if (engineRes.success) {
        realDeliverySuccess = true;
      } else {
        sendError = engineRes.error || 'Failed to dispatch via official WhatsApp socket';
        // Enqueue to Outbox so it auto-retries as soon as connection heals
        enqueueWhatsAppMessage({
          phone: recipientPhone,
          message: String(message),
          orderNumber: Number(orderNumber) || undefined,
          orderId: orderId || undefined,
          customerName: customerName || 'Customer',
          type,
          directWebUrl
        });
      }
    }
    // Priority 2: UltraMsg Real HTTP Dispatch
    else if (cfg.gatewayType === 'ultramsg') {
      sentVia = 'UltraMsg Gateway';
      const { ultraMsgInstanceId, ultraMsgToken } = cfg.gatewayConfig || {};
      if (!ultraMsgInstanceId || !ultraMsgToken) {
        throw new Error('UltraMsg Instance ID and Token are required.');
      }
      const gwRes = await fetch(`https://api.ultramsg.com/${ultraMsgInstanceId.trim()}/messages/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          token: ultraMsgToken.trim(),
          to: `+${recipientPhone}`,
          body: message
        })
      });
      gatewayResponse = await gwRes.json();
      if (gatewayResponse?.sent === 'true' || gatewayResponse?.id) {
        realDeliverySuccess = true;
      } else {
        sendError = gatewayResponse?.message || gatewayResponse?.error || 'UltraMsg dispatch failed';
      }
    }
    // Priority 3: GreenAPI Real HTTP Dispatch
    else if (cfg.gatewayType === 'greenapi') {
      sentVia = 'GreenAPI Gateway';
      const { greenApiInstanceId, greenApiToken } = cfg.gatewayConfig || {};
      const gwRes = await fetch(`https://api.green-api.com/waInstance${greenApiInstanceId?.trim()}/sendMessage/${greenApiToken?.trim()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: `${recipientPhone}@c.us`,
          message
        })
      });
      gatewayResponse = await gwRes.json();
      if (gatewayResponse?.idMessage) {
        realDeliverySuccess = true;
      } else {
        sendError = gatewayResponse?.message || 'GreenAPI dispatch failed';
      }
    }
    // Priority 4: Meta Cloud API Real HTTP Dispatch
    else if (cfg.gatewayType === 'meta') {
      sentVia = 'Meta Cloud API';
      const { metaPhoneNumberId, metaAccessToken } = cfg.gatewayConfig || {};
      const gwRes = await fetch(`https://graph.facebook.com/v19.0/${metaPhoneNumberId?.trim()}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${metaAccessToken?.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: recipientPhone,
          type: 'text',
          text: { preview_url: false, body: message }
        })
      });
      gatewayResponse = await gwRes.json();
      if (gatewayResponse?.messages?.[0]?.id) {
        realDeliverySuccess = true;
      } else {
        sendError = gatewayResponse?.error?.message || 'Meta Cloud API dispatch failed';
      }
    }
    // Priority 5: Custom Webhook
    else if (cfg.gatewayType === 'custom_webhook') {
      sentVia = 'Custom Webhook';
      const { customWebhookUrl, customWebhookKey } = cfg.gatewayConfig || {};
      const gwRes = await fetch(customWebhookUrl?.trim() || '', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(customWebhookKey ? { 'Authorization': `Bearer ${customWebhookKey.trim()}` } : {})
        },
        body: JSON.stringify({
          to: recipientPhone,
          message,
          orderId,
          orderNumber,
          customerName,
          type
        })
      });
      gatewayResponse = await gwRes.json().catch(() => ({}));
      if (gwRes.ok) {
        realDeliverySuccess = true;
      } else {
        sendError = `Webhook returned HTTP ${gwRes.status}`;
      }
    }

    const logId = `walog-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const logEntry = {
      id: logId,
      timestamp: new Date().toISOString(),
      recipient_phone: `+${recipientPhone}`,
      customer_name: customerName || 'Customer',
      order_number: Number(orderNumber) || undefined,
      order_id: orderId || undefined,
      type,
      status: realDeliverySuccess ? 'delivered' : 'failed',
      error: sendError || undefined,
      message: String(message),
      sent_via: sentVia,
      device_number: engine.phoneNumber || cfg.phoneNumber || undefined,
      direct_url: directWebUrl
    };

    cache['whatsapp_logs']?.map.set(logId, logEntry);
    persistToDisk();

    if (!realDeliverySuccess) {
      return res.json({
        success: true,
        queued: true,
        message: sendError ? `Delivery postponed: ${sendError}. Saved to Outbox for automatic delivery upon reconnection.` : 'Saved to Outbox.',
        directWebUrl,
        log: logEntry
      });
    }

    res.json({
      success: true,
      messageId: logId,
      status: 'delivered',
      log: logEntry,
      directWebUrl
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

// 8. GET /api/whatsapp/logs
apiRouter.get('/whatsapp/logs', (req, res) => {
  try {
    const logs = Array.from(cache['whatsapp_logs']?.map.values() || [])
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 100);
    res.json({ success: true, logs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

// 9. POST /api/whatsapp/clear-logs
apiRouter.post('/whatsapp/clear-logs', (req, res) => {
  try {
    cache['whatsapp_logs']?.map.clear();
    persistToDisk();
    res.json({ success: true, message: 'Logs cleared' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

// GET /api/:collection - Instant RAM retrieval (< 1ms)
apiRouter.get('/:collection', async (req, res) => {
  try {
    const collName = req.params.collection;
    const c = cache[collName];
    if (!c) return res.status(404).json({ error: 'Collection not found' });

    let data = Array.from(c.map.values());

    if (collName === 'orders') {
      const orderMap = new Map<number, any>();
      for (const ord of data) {
        const num = Number(ord.order_number);
        if (!num) continue;
        const existing = orderMap.get(num);
        if (!existing) {
          orderMap.set(num, ord);
        } else {
          const tExisting = new Date(existing.updated_at || existing.created_at || 0).getTime();
          const tIncoming = new Date(ord.updated_at || ord.created_at || 0).getTime();
          
          if (ord.status === 'delivered' && existing.status !== 'delivered') {
            const isConfPending = ord.delivery_confirmation_pending !== undefined ? Boolean(ord.delivery_confirmation_pending) : (existing.delivery_confirmation_pending !== undefined ? Boolean(existing.delivery_confirmation_pending) : false);
            orderMap.set(num, { ...existing, ...ord, status: 'delivered', rider_delivered: true, delivery_confirmation_pending: isConfPending });
          } else if (existing.status === 'delivered' && ord.status !== 'delivered') {
            if (ord.status === 'cancelled') {
              orderMap.set(num, { ...existing, ...ord, status: 'cancelled' });
            } else {
              const isConfPending = ord.delivery_confirmation_pending !== undefined ? Boolean(ord.delivery_confirmation_pending) : (existing.delivery_confirmation_pending !== undefined ? Boolean(existing.delivery_confirmation_pending) : false);
              orderMap.set(num, { ...ord, ...existing, status: 'delivered', rider_delivered: true, delivery_confirmation_pending: isConfPending });
            }
          } else if (tIncoming >= tExisting) {
            orderMap.set(num, ord);
          }
        }
      }
      data = Array.from(orderMap.values());

      if (req.query.active === 'true') {
        data = data.filter((o: any) => o.status !== 'delivered' && o.status !== 'cancelled');
      }
      data.sort((a: any, b: any) => (Number(b.order_number) || 0) - (Number(a.order_number) || 0));
      if (req.query.limit) {
        const lim = parseInt(String(req.query.limit), 10);
        if (!isNaN(lim) && lim > 0) {
          data = data.slice(0, lim);
        }
      }
    }

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.json(data);
  } catch (error: any) {
    console.error(`Error in GET /api/${req.params.collection}:`, error);
    res.status(500).json({ error: error.message || String(error) });
  }
});

// GET /api/:collection/:id
apiRouter.get('/:collection/:id', async (req, res) => {
  try {
    const collName = req.params.collection;
    const c = cache[collName];
    if (!c) return res.status(404).json({ error: 'Collection not found' });

    const doc = c.map.get(String(req.params.id));

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    if (!doc) return res.status(404).json({});

    if (collName === 'system_settings') {
      res.json(doc.data || doc);
    } else {
      res.json(doc);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || String(error) });
  }
});

// POST /api/:collection/:id - Ultra-fast write to RAM, disk snapshot & instant SSE broadcast
apiRouter.post('/:collection/:id', async (req, res) => {
  try {
    const collName = req.params.collection;
    const c = cache[collName];
    if (!c) return res.status(404).json({ error: 'Collection not found' });

    const id = String(req.params.id);
    const data = req.body;
    let payloadToBroadcast: any = data;

    if (collName === 'system_settings') {
      c.map.set(id, { _id: id, data });
      c.version += 1;
      c.lastUpdated = Date.now();
      payloadToBroadcast = { _id: id, data };
    } else {
      const clean = { ...data };
      delete clean._id;
      delete clean.__v;
      clean.id = id;
      if (!clean.updated_at) {
        clean.updated_at = new Date().toISOString();
      }
      if (clean.status === 'delivered') {
        if (clean.delivery_confirmation_pending === undefined) {
          clean.delivery_confirmation_pending = false;
        } else {
          clean.delivery_confirmation_pending = Boolean(clean.delivery_confirmation_pending);
        }
        clean.rider_delivered = true;
        if (!clean.actual_delivery_time) {
          clean.actual_delivery_time = new Date().toISOString();
        }
      }

      c.map.set(id, clean);

      // Synchronize duplicates with same order_number in memory
      if (collName === 'orders' && clean.order_number) {
        const num = Number(clean.order_number);
        if (num > 0) {
          for (const [otherId, ord] of c.map.entries()) {
            if (otherId !== id && Number(ord.order_number) === num) {
              const synced = { ...ord, ...clean, id: otherId };
              c.map.set(otherId, synced);
            }
          }
        }
      }

      c.version += 1;
      c.lastUpdated = Date.now();
      payloadToBroadcast = clean;
    }

    persistToDisk();
    appendWAL({ collection: collName, action: 'set', id, data: payloadToBroadcast });

    // Instant SSE Real-time Broadcast to all connected clients (< 5ms)
    broadcastMutation({
      collection: collName,
      action: 'set',
      id,
      data: payloadToBroadcast
    });

    // Sync directly to Live Firebase Realtime Database
    syncMutationToRTDB(collName, 'set', id, payloadToBroadcast).catch(() => {});

    // Enqueue double-confirmation write to MongoDB (non-blocking)
    backgroundSyncQueue.push({
      collection: collName,
      action: 'set',
      id,
      data: payloadToBroadcast,
      timestamp: Date.now(),
      retries: 0
    });
    processBackgroundSyncQueue().catch(() => {});

    res.json({ success: true, engine: 'broomies_realtime_db' });
  } catch (error: any) {
    console.error(`Error in POST /api/${req.params.collection}/${req.params.id}:`, error);
    res.status(500).json({ error: error.message || String(error) });
  }
});

// PUT /api/:collection/:id - Merge updates to RAM, disk snapshot & instant SSE broadcast
apiRouter.put('/:collection/:id', async (req, res) => {
  try {
    const collName = req.params.collection;
    const c = cache[collName];
    if (!c) return res.status(404).json({ error: 'Collection not found' });

    const id = String(req.params.id);
    const data = req.body;
    const existing = c.map.get(id) || {};
    let payloadToBroadcast: any = data;

    if (collName === 'system_settings') {
      const mergedData = { ...(existing?.data || existing || {}), ...data };
      c.map.set(id, { _id: id, data: mergedData });
      c.version += 1;
      c.lastUpdated = Date.now();
      payloadToBroadcast = { _id: id, data: mergedData };
    } else {
      const clean = { ...data };
      delete clean._id;
      delete clean.__v;
      const merged = { ...existing, ...clean, id };
      if (!merged.updated_at) {
        merged.updated_at = new Date().toISOString();
      }
      if (merged.status === 'delivered') {
        if (clean.delivery_confirmation_pending !== undefined) {
          merged.delivery_confirmation_pending = Boolean(clean.delivery_confirmation_pending);
        } else if (existing && existing.delivery_confirmation_pending !== undefined) {
          merged.delivery_confirmation_pending = Boolean(existing.delivery_confirmation_pending);
        } else {
          merged.delivery_confirmation_pending = false;
        }
        merged.rider_delivered = true;
        if (!merged.actual_delivery_time) {
          merged.actual_delivery_time = new Date().toISOString();
        }
      }

      c.map.set(id, merged);

      // Synchronize duplicates with same order_number in memory
      if (collName === 'orders' && merged.order_number) {
        const num = Number(merged.order_number);
        if (num > 0) {
          for (const [otherId, ord] of c.map.entries()) {
            if (otherId !== id && Number(ord.order_number) === num) {
              const synced = { ...ord, ...merged, id: otherId };
              c.map.set(otherId, synced);
            }
          }
        }
      }

      c.version += 1;
      c.lastUpdated = Date.now();
      payloadToBroadcast = merged;
    }

    persistToDisk();
    appendWAL({ collection: collName, action: 'update', id, data: payloadToBroadcast });

    // Instant SSE Real-time Broadcast (< 5ms)
    broadcastMutation({
      collection: collName,
      action: 'update',
      id,
      data: payloadToBroadcast
    });

    // Sync directly to Live Firebase Realtime Database
    syncMutationToRTDB(collName, 'update', id, payloadToBroadcast).catch(() => {});

    // Enqueue double-confirmation write to MongoDB (non-blocking)
    backgroundSyncQueue.push({
      collection: collName,
      action: 'update',
      id,
      data: payloadToBroadcast,
      timestamp: Date.now(),
      retries: 0
    });
    processBackgroundSyncQueue().catch(() => {});

    res.json({ success: true, engine: 'broomies_realtime_db' });
  } catch (error: any) {
    console.error(`Error in PUT /api/${req.params.collection}/${req.params.id}:`, error);
    res.status(500).json({ error: error.message || String(error) });
  }
});

// DELETE /api/:collection - Delete all documents
apiRouter.delete('/:collection', async (req, res) => {
  try {
    const collName = req.params.collection;
    const c = cache[collName];
    if (!c) return res.status(404).json({ error: 'Collection not found' });

    c.map.clear();
    c.version += 1;
    c.lastUpdated = Date.now();

    persistToDisk();
    appendWAL({ collection: collName, action: 'clear', id: '*' });

    broadcastMutation({
      collection: collName,
      action: 'clear'
    });

    // Sync directly to Live Firebase Realtime Database
    syncMutationToRTDB(collName, 'clear').catch(() => {});

    if (isMongoConnected) {
      const Model = models[collName];
      if (Model) Model.deleteMany({}).catch(() => {});
    }

    res.json({ success: true, message: 'All documents deleted', engine: 'broomies_realtime_db' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || String(error) });
  }
});

// DELETE /api/:collection/:id
apiRouter.delete('/:collection/:id', async (req, res) => {
  try {
    const collName = req.params.collection;
    const c = cache[collName];
    if (!c) return res.status(404).json({ error: 'Collection not found' });

    const id = String(req.params.id);
    const existing = c.map.get(id);
    c.map.delete(id);
    c.version += 1;
    c.lastUpdated = Date.now();

    persistToDisk();
    appendWAL({ collection: collName, action: 'delete', id });

    broadcastMutation({
      collection: collName,
      action: 'delete',
      id
    });

    // Sync directly to Live Firebase Realtime Database
    syncMutationToRTDB(collName, 'delete', id, existing).catch(() => {});

    backgroundSyncQueue.push({
      collection: collName,
      action: 'delete',
      id,
      timestamp: Date.now(),
      retries: 0
    });
    processBackgroundSyncQueue().catch(() => {});

    res.json({ success: true, engine: 'broomies_realtime_db' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || String(error) });
  }
});

app.use('/api', apiRouter);

export default app;
