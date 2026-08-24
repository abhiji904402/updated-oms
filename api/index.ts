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
// REAL-TIME IN-MEMORY CACHE WITH IMMEDIATE MONGODB SYNC
// =========================================================================

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

let dbPromise: Promise<typeof mongoose> | null = null;
const connectDB = async (): Promise<typeof mongoose> => {
  if (mongoose.connection.readyState === 1) return mongoose;
  if (!MONGODB_URI) {
    throw new Error('No MONGODB_URI found in environment variables.');
  }
  if (!dbPromise) {
    dbPromise = mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
    });
  }
  return dbPromise;
};

// Ensure collection is loaded in RAM
const ensureCollectionLoaded = async (collName: string): Promise<CollectionCache> => {
  const c = cache[collName];
  if (!c) throw new Error(`Collection ${collName} not found`);
  
  if (c.isReady) {
    return c;
  }

  await connectDB();
  const Model = models[collName];
  if (!Model) throw new Error(`Model for ${collName} not found`);

  const docs = await Model.find({}).lean();
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
  return c;
};

// Background pre-load on boot
(async () => {
  try {
    await connectDB();
    for (const coll of Object.keys(models)) {
      await ensureCollectionLoaded(coll);
    }
    console.log(`🚀 All collections fully loaded in memory! Ready for real-time traffic.`);
  } catch (err) {
    console.error('Initial DB warm-up error:', err);
  }
})();

// --- API ROUTER ---
const apiRouter = express.Router();

apiRouter.get('/health', async (req, res) => {
  res.json({
    status: 'ok',
    orders_count: cache['orders']?.map?.size || 0,
    orders_ready: cache['orders']?.isReady || false,
    timestamp: new Date().toISOString()
  });
});

// GET /api/:collection - High speed cached retrieval
apiRouter.get('/:collection', async (req, res) => {
  try {
    const collName = req.params.collection;
    const Model = models[collName];
    if (!Model) return res.status(404).json({ error: 'Collection not found' });

    const c = await ensureCollectionLoaded(collName);
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
    const Model = models[collName];
    if (!Model) return res.status(404).json({ error: 'Collection not found' });

    const c = await ensureCollectionLoaded(collName);
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

// POST /api/:collection/:id - Write to memory and DB synchronously
apiRouter.post('/:collection/:id', async (req, res) => {
  try {
    const collName = req.params.collection;
    const Model = models[collName];
    if (!Model) return res.status(404).json({ error: 'Collection not found' });

    await connectDB();
    const id = String(req.params.id);
    const data = req.body;

    const c = cache[collName];
    if (collName === 'system_settings') {
      await Model.findOneAndUpdate({ _id: id }, { data }, { upsert: true });
      if (c) {
        c.map.set(id, { _id: id, data });
        c.version += 1;
        c.lastUpdated = Date.now();
      }
    } else {
      const clean = { ...data };
      delete clean._id;
      delete clean.__v;
      clean.id = id;

      await Model.findOneAndUpdate({ id }, { $set: clean }, { upsert: true });
      if (c) {
        c.map.set(id, clean);
        c.version += 1;
        c.lastUpdated = Date.now();
      }
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error(`Error in POST /api/${req.params.collection}/${req.params.id}:`, error);
    res.status(500).json({ error: error.message || String(error) });
  }
});

// PUT /api/:collection/:id - Merge updates to memory and DB
apiRouter.put('/:collection/:id', async (req, res) => {
  try {
    const collName = req.params.collection;
    const Model = models[collName];
    if (!Model) return res.status(404).json({ error: 'Collection not found' });

    await connectDB();
    const id = String(req.params.id);
    const data = req.body;
    const c = cache[collName];
    const existing = c?.map?.get(id) || {};

    if (collName === 'system_settings') {
      const mergedData = { ...(existing?.data || existing || {}), ...data };
      await Model.findOneAndUpdate({ _id: id }, { data: mergedData }, { upsert: true });
      if (c) {
        c.map.set(id, { _id: id, data: mergedData });
        c.version += 1;
        c.lastUpdated = Date.now();
      }
    } else {
      const clean = { ...data };
      delete clean._id;
      delete clean.__v;
      const merged = { ...existing, ...clean, id };

      await Model.findOneAndUpdate({ id }, { $set: merged }, { upsert: true });
      if (c) {
        c.map.set(id, merged);
        c.version += 1;
        c.lastUpdated = Date.now();
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
    const Model = models[collName];
    if (!Model) return res.status(404).json({ error: 'Collection not found' });

    await connectDB();
    await Model.deleteMany({});
    const c = cache[collName];
    if (c) {
      c.map.clear();
      c.version += 1;
      c.lastUpdated = Date.now();
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
    const Model = models[collName];
    if (!Model) return res.status(404).json({ error: 'Collection not found' });

    await connectDB();
    const id = String(req.params.id);
    const query = collName === 'system_settings' ? { _id: id } : { id };
    await Model.findOneAndDelete(query);

    const c = cache[collName];
    if (c) {
      c.map.delete(id);
      c.version += 1;
      c.lastUpdated = Date.now();
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
    req.path.startsWith('/system_settings')
  ) {
    apiRouter(req, res, next);
  } else {
    next();
  }
});

export default app;
