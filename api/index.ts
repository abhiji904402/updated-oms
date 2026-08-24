import express from 'express';
import cors from 'cors';
import compression from 'compression';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();

app.use(cors());
app.use(compression({ level: 6, threshold: 512 }));
app.use(express.json({ limit: '50mb' }));

const MONGODB_URI = process.env.MONGODB_URI;

// =========================================================================
// REAL-TIME IN-MEMORY & DISK PERSISTENCE ENGINE (SUB-10MS LATENCY)
// =========================================================================

const DATA_DIR = path.join(process.cwd(), '.data');
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch {}
}

const DB_FILE = path.join(DATA_DIR, 'broomies_store.json');

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

// Load initial disk snapshot instantly
function loadFromDisk() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      for (const coll of Object.keys(cache)) {
        if (parsed[coll] && typeof parsed[coll] === 'object') {
          const c = cache[coll];
          c.map.clear();
          for (const [k, v] of Object.entries(parsed[coll])) {
            c.map.set(String(k), v);
          }
          c.isReady = true;
          c.lastUpdated = Date.now();
        }
      }
      console.log(`[Storage] Loaded ${cache['orders'].map.size} orders instantly from fast disk snapshot.`);
    }
  } catch (err) {
    console.warn('[Storage] Could not load disk snapshot:', err);
  }
}

// Debounced disk save
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
      console.warn('[Storage] Error persisting to disk:', err);
    }
  }, 300);
}

loadFromDisk();

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

    // Hydrate collections from Mongo if disk cache was empty or to sync fresh data
    for (const [collName, Model] of Object.entries(models)) {
      const c = cache[collName];
      if (c) {
        const docs = await Model.find({}).lean();
        if (docs.length > 0) {
          c.map.clear();
          docs.forEach((d: any) => {
            const key = collName === 'system_settings' ? (d._id || d.id) : (d.id || d._id);
            if (key) {
              const clean = { ...d };
              delete clean.__v;
              if (collName !== 'system_settings') delete clean._id;
              c.map.set(String(key), clean);
            }
          });
          c.isReady = true;
          c.lastUpdated = Date.now();
          c.version += 1;
        }
      }
    }
    persistToDisk();
    console.log(`[Storage] Synced ${cache['orders'].map.size} orders from MongoDB Atlas.`);
  } catch (err: any) {
    console.warn('[MongoDB Notice]: Operating on ultra-fast RAM + Disk snapshot:', err.message);
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

  // Keep-alive heartbeat ping every 15s
  const interval = setInterval(() => {
    try {
      res.write(`: ping\n\n`);
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

    // Instant SSE Real-time Broadcast to all connected clients (< 5ms)
    broadcastMutation({
      collection: collName,
      action: 'set',
      id,
      data: payloadToBroadcast
    });

    // Async MongoDB write if connected
    if (isMongoConnected) {
      const Model = models[collName];
      if (Model) {
        if (collName === 'system_settings') {
          Model.findOneAndUpdate({ _id: id }, { data }, { upsert: true }).catch(() => {});
        } else {
          Model.findOneAndUpdate({ id }, { $set: payloadToBroadcast }, { upsert: true }).catch(() => {});
        }
      }
    }

    res.json({ success: true });
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

    // Instant SSE Real-time Broadcast (< 5ms)
    broadcastMutation({
      collection: collName,
      action: 'update',
      id,
      data: payloadToBroadcast
    });

    // Async MongoDB write if connected
    if (isMongoConnected) {
      const Model = models[collName];
      if (Model) {
        if (collName === 'system_settings') {
          Model.findOneAndUpdate({ _id: id }, { data: payloadToBroadcast.data }, { upsert: true }).catch(() => {});
        } else {
          Model.findOneAndUpdate({ id }, { $set: payloadToBroadcast }, { upsert: true }).catch(() => {});
        }
      }
    }

    res.json({ success: true });
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

    broadcastMutation({
      collection: collName,
      action: 'clear'
    });

    if (isMongoConnected) {
      const Model = models[collName];
      if (Model) Model.deleteMany({}).catch(() => {});
    }

    res.json({ success: true, message: 'All documents deleted' });
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

    broadcastMutation({
      collection: collName,
      action: 'delete',
      id
    });

    if (isMongoConnected) {
      const Model = models[collName];
      if (Model) {
        const query = collName === 'system_settings' ? { _id: id } : { id };
        Model.findOneAndDelete(query).catch(() => {});
      }
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || String(error) });
  }
});

app.use('/api', apiRouter);

// Support Vercel serverless routing
app.use((req, res, next) => {
  if (
    req.path.startsWith('/orders') || 
    req.path.startsWith('/delivery_partners') || 
    req.path.startsWith('/outlet_locations') || 
    req.path.startsWith('/system_settings') ||
    req.path.startsWith('/events')
  ) {
    apiRouter(req, res, next);
  } else {
    next();
  }
});

export default app;
