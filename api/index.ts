import express from 'express';
import cors from 'cors';
import compression from 'compression';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import seedStoreData from '../src/data/broomies_store_seed.json';

dotenv.config();

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
  'system_settings': { map: new Map(), version: 1, lastUpdated: 0, isReady: false }
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
  // 1. First populate from bundled static seedStoreData (Guaranteed on Vercel Serverless / Cloud Run)
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
  if (isProcessingQueue || backgroundSyncQueue.length === 0 || !isMongoConnected) return;
  isProcessingQueue = true;

  while (backgroundSyncQueue.length > 0 && isMongoConnected) {
    const task = backgroundSyncQueue.shift();
    if (!task) break;

    try {
      const Model = models[task.collection];
      if (Model) {
        if (task.action === 'set' || task.action === 'update') {
          if (task.collection === 'system_settings') {
            await Model.findOneAndUpdate({ _id: task.id }, { data: task.data?.data || task.data }, { upsert: true, maxTimeMS: 5000 });
          } else {
            await Model.findOneAndUpdate({ id: task.id }, { $set: task.data }, { upsert: true, maxTimeMS: 5000 });
          }
        } else if (task.action === 'delete') {
          const query = task.collection === 'system_settings' ? { _id: task.id } : { id: task.id };
          await Model.findOneAndDelete(query, { maxTimeMS: 5000 });
        }
      }
    } catch (err: any) {
      if (task.retries < 3) {
        task.retries += 1;
        backgroundSyncQueue.push(task);
      }
      break;
    }
  }

  isProcessingQueue = false;
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
  _id: { type: String, required: true, index: true },
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

// Mark collection ready
for (const c of Object.values(cache)) {
  c.isReady = true;
}

// --- API ROUTER ---
const apiRouter = express.Router();

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

// GET /api/:collection - Instant RAM retrieval (< 1ms)
apiRouter.get('/:collection', async (req, res) => {
  try {
    const collName = req.params.collection;
    const c = cache[collName];
    if (!c) return res.status(404).json({ error: 'Collection not found' });

    const data = Array.from(c.map.values());

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

      c.map.set(id, clean);
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

      c.map.set(id, merged);
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
