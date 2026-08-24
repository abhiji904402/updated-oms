import express from 'express';
import cors from 'cors';
import compression from 'compression';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(cors());
app.use(compression({ level: 6, threshold: 512 }));
app.use(express.json({ limit: '50mb' }));

const MONGODB_URI = process.env.MONGODB_URI;

// Schemas
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

// =========================================================================
// LIGHTNING-FAST IN-MEMORY RAM STORAGE LAYER WITH WRITE-THROUGH MONGO SYNC
// =========================================================================

interface CollectionStore {
  map: Map<string, any>;
  version: number;
  etag: string;
  isHydrated: boolean;
  lastHydratedAt: number;
}

const ramStore: Record<string, CollectionStore> = {
  'orders': { map: new Map(), version: 1, etag: '"v1-init"', isHydrated: false, lastHydratedAt: 0 },
  'delivery_partners': { map: new Map(), version: 1, etag: '"v1-init"', isHydrated: false, lastHydratedAt: 0 },
  'outlet_locations': { map: new Map(), version: 1, etag: '"v1-init"', isHydrated: false, lastHydratedAt: 0 },
  'system_settings': { map: new Map(), version: 1, etag: '"v1-init"', isHydrated: false, lastHydratedAt: 0 }
};

const updateStoreEtag = (collName: string) => {
  const store = ramStore[collName];
  if (!store) return;
  store.version += 1;
  store.etag = `"v${store.version}-${Date.now()}"`;
};

let isConnecting = false;
const connectAndHydrate = async () => {
  if (isConnecting) return;
  isConnecting = true;
  try {
    if (!MONGODB_URI) {
      console.warn('No MONGODB_URI found; operating in standalone RAM mode.');
      return;
    }
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 8000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
      });
      console.log('⚡ Connected to MongoDB Atlas. Hydrating RAM Store in background...');
    }

    // Hydrate all collections into RAM
    for (const [collName, Model] of Object.entries(models)) {
      try {
        const store = ramStore[collName];
        if (store) {
          const newMap = new Map<string, any>();
          const cursor = Model.find({}).batchSize(1000).cursor();
          for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
            const d = doc.toObject ? doc.toObject() : doc;
            const key = collName === 'system_settings' ? (d._id || d.id) : (d.id || d._id);
            if (key) {
              const clean = { ...d };
              delete clean.__v;
              if (collName !== 'system_settings') delete clean._id;
              newMap.set(String(key), clean);
            }
          }
          store.map = newMap;
          store.isHydrated = true;
          store.lastHydratedAt = Date.now();
          updateStoreEtag(collName);
          console.log(`🚀 [RAM Store Ready] Collection '${collName}' loaded with ${newMap.size} documents in RAM!`);
        }
      } catch (err) {
        console.error(`Failed to hydrate ${collName}:`, err);
      }
    }
  } catch (err) {
    console.error('Initial DB connect error:', err);
  } finally {
    isConnecting = false;
  }
};

// Immediate eager background hydration on startup
connectAndHydrate();

// Periodic background sync with Mongo every 45s (quiet background task)
setInterval(() => {
  if (mongoose.connection.readyState === 1) {
    for (const [collName, Model] of Object.entries(models)) {
      Model.find({}).lean().then((docs) => {
        const store = ramStore[collName];
        if (store && docs.length > 0) {
          let hasDiff = docs.length !== store.map.size;
          docs.forEach((d: any) => {
            const key = collName === 'system_settings' ? (d._id || d.id) : (d.id || d._id);
            if (key && !store.map.has(String(key))) {
              hasDiff = true;
            }
          });
          if (hasDiff) {
            docs.forEach((d: any) => {
              const key = collName === 'system_settings' ? (d._id || d.id) : (d.id || d._id);
              if (key) {
                const clean = { ...d };
                delete clean.__v;
                if (collName !== 'system_settings') delete clean._id;
                store.map.set(String(key), clean);
              }
            });
            updateStoreEtag(collName);
          }
        }
      }).catch(() => {});
    }
  } else {
    connectAndHydrate().catch(() => {});
  }
}, 45000);

// --- API ROUTER ---
const apiRouter = express.Router();

apiRouter.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    orders_in_ram: ramStore['orders']?.map?.size || 0,
    hydrated: ramStore['orders']?.isHydrated || false,
    timestamp: new Date().toISOString()
  });
});

// GET /api/:collection - ZERO-LATENCY RAM SERVE with ETag 304
apiRouter.get('/:collection', async (req, res) => {
  const collName = req.params.collection;
  const store = ramStore[collName];
  if (!store) {
    return res.status(404).json({ error: 'Collection not found' });
  }

  // If not yet hydrated and DB is connecting, trigger async check
  if (!store.isHydrated && mongoose.connection.readyState !== 1) {
    connectAndHydrate().catch(() => {});
  }

  // Fast ETag check
  const clientEtag = req.headers['if-none-match'];
  if (clientEtag && clientEtag === store.etag) {
    return res.status(304).end();
  }

  // Serve directly from RAM array in sub-millisecond
  const values = Array.from(store.map.values());
  res.set('ETag', store.etag);
  res.set('Cache-Control', 'private, no-cache');
  res.json(values);
});

// GET /api/:collection/:id
apiRouter.get('/:collection/:id', async (req, res) => {
  const collName = req.params.collection;
  const store = ramStore[collName];
  if (!store) return res.status(404).json({ error: 'Collection not found' });

  const doc = store.map.get(String(req.params.id));
  res.set('Cache-Control', 'private, no-cache');
  if (!doc) return res.status(404).json({});

  if (collName === 'system_settings') {
    res.json(doc.data || doc);
  } else {
    res.json(doc);
  }
});

// POST /api/:collection/:id - WRITE-THROUGH (INSTANT RAM UPDATE + ASYNC DB PERSIST)
apiRouter.post('/:collection/:id', async (req, res) => {
  const collName = req.params.collection;
  const store = ramStore[collName];
  const Model = models[collName];
  if (!store || !Model) return res.status(404).json({ error: 'Collection not found' });

  const id = String(req.params.id);
  const data = req.body;

  if (collName === 'system_settings') {
    store.map.set(id, { _id: id, data });
  } else {
    const clean = { ...data };
    delete clean._id;
    delete clean.__v;
    clean.id = id;
    store.map.set(id, clean);
  }

  updateStoreEtag(collName);
  res.json({ success: true });

  // Async Mongo write-through in background without blocking response
  setImmediate(async () => {
    try {
      if (mongoose.connection.readyState === 1) {
        if (collName === 'system_settings') {
          await Model.findOneAndUpdate({ _id: id }, { data }, { upsert: true });
        } else {
          const updateData = { ...data };
          delete updateData._id;
          delete updateData.__v;
          await Model.findOneAndUpdate({ id }, { $set: updateData }, { upsert: true });
        }
      }
    } catch (err) {
      console.error(`Background persist failed for ${collName}/${id}:`, err);
    }
  });
});

// PUT /api/:collection/:id - WRITE-THROUGH MERGE
apiRouter.put('/:collection/:id', async (req, res) => {
  const collName = req.params.collection;
  const store = ramStore[collName];
  const Model = models[collName];
  if (!store || !Model) return res.status(404).json({ error: 'Collection not found' });

  const id = String(req.params.id);
  const data = req.body;
  const existing = store.map.get(id) || {};

  if (collName === 'system_settings') {
    const mergedData = { ...(existing?.data || existing || {}), ...data };
    store.map.set(id, { _id: id, data: mergedData });
  } else {
    const merged = { ...existing, ...data };
    delete merged._id;
    delete merged.__v;
    merged.id = id;
    store.map.set(id, merged);
  }

  updateStoreEtag(collName);
  res.json({ success: true });

  // Async Mongo write-through in background
  setImmediate(async () => {
    try {
      if (mongoose.connection.readyState === 1) {
        if (collName === 'system_settings') {
          const dbDoc = await Model.findOne({ _id: id }).lean();
          const newData = { ...((dbDoc as any)?.data || {}), ...data };
          await Model.findOneAndUpdate({ _id: id }, { data: newData }, { upsert: true });
        } else {
          const updateData = { ...data };
          delete updateData._id;
          delete updateData.__v;
          await Model.findOneAndUpdate({ id }, { $set: updateData }, { upsert: true });
        }
      }
    } catch (err) {
      console.error(`Background persist update failed for ${collName}/${id}:`, err);
    }
  });
});

// DELETE /api/:collection - PURGE
apiRouter.delete('/:collection', async (req, res) => {
  const collName = req.params.collection;
  const store = ramStore[collName];
  const Model = models[collName];
  if (!store || !Model) return res.status(404).json({ error: 'Collection not found' });

  store.map.clear();
  updateStoreEtag(collName);
  res.json({ success: true, message: 'RAM collection cleared' });

  setImmediate(async () => {
    try {
      if (mongoose.connection.readyState === 1) {
        await Model.deleteMany({});
      }
    } catch (err) {
      console.error(`Background delete failed for ${collName}:`, err);
    }
  });
});

// DELETE /api/:collection/:id
apiRouter.delete('/:collection/:id', async (req, res) => {
  const collName = req.params.collection;
  const store = ramStore[collName];
  const Model = models[collName];
  if (!store || !Model) return res.status(404).json({ error: 'Collection not found' });

  const id = String(req.params.id);
  store.map.delete(id);
  updateStoreEtag(collName);
  res.json({ success: true });

  setImmediate(async () => {
    try {
      if (mongoose.connection.readyState === 1) {
        const query = collName === 'system_settings' ? { _id: id } : { id };
        await Model.findOneAndDelete(query);
      }
    } catch (err) {
      console.error(`Background delete failed for ${collName}/${id}:`, err);
    }
  });
});

app.use('/api', apiRouter);

// Support Vercel serverless routing
app.use((req, res, next) => {
  if (
    req.path.startsWith('/orders') || 
    req.path.startsWith('/delivery_partners') || 
    req.path.startsWith('/outlet_locations') || 
    req.path.startsWith('/system_settings')
  ) {
    apiRouter(req, res, next);
  } else {
    next();
  }
});

export default app;
