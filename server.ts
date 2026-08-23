import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const getDirname = () => {
  try { return __dirname; } catch { return path.dirname(fileURLToPath(import.meta.url)); }
};
const __dirname_resolved = getDirname();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Mongoose Connection
const MONGODB_URI = process.env.MONGODB_URI;

if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI).then(() => {
    console.log('Connected to MongoDB');
  }).catch(err => {
    console.error('MongoDB connection error:', err);
  });
} else {
  console.log('No MONGODB_URI found. Please configure it in .env');
}

// Schemas
const OrderSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  order_number: mongoose.Schema.Types.Mixed,
  outlet: String,
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
  status: String,
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
  created_at: String,
  updated_at: String
}, { _id: false, strict: false });

const PartnerSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
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
  id: { type: String, required: true, unique: true },
  latitude: Number,
  longitude: Number,
  address: String,
  updated_at: String
}, { _id: false, strict: false });

const SystemSettingsSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { strict: false });

const Order = mongoose.model('Order', OrderSchema);
const Partner = mongoose.model('DeliveryPartner', PartnerSchema);
const OutletLocation = mongoose.model('OutletLocation', OutletLocationSchema);
const SystemSettings = mongoose.model('SystemSettings', SystemSettingsSchema);

const models: Record<string, mongoose.Model<any>> = {
  'orders': Order,
  'delivery_partners': Partner,
  'outlet_locations': OutletLocation,
  'system_settings': SystemSettings
};

// --- API ROUTES ---

app.use('/api', (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database is not connected. Please configure MONGODB_URI.' });
  }
  next();
});

app.get('/api/:collection', async (req, res) => {
  try {
    const Model = models[req.params.collection];
    if (!Model) return res.status(404).json({ error: 'Collection not found' });
    const data = await Model.find({}).lean();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.get('/api/:collection/:id', async (req, res) => {
  try {
    const Model = models[req.params.collection];
    if (!Model) return res.status(404).json({ error: 'Collection not found' });
    
    // For SystemSettings we used _id, for others we use id
    const query = req.params.collection === 'system_settings' 
      ? { _id: req.params.id } 
      : { id: req.params.id };
      
    const doc = await Model.findOne(query).lean();
    if (!doc) return res.status(404).json({});
    
    // For system_settings, return the actual data object just like firestore
    if (req.params.collection === 'system_settings') {
       res.json(doc.data || doc);
    } else {
       res.json(doc);
    }
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.post('/api/:collection/:id', async (req, res) => {
  try {
    const Model = models[req.params.collection];
    if (!Model) return res.status(404).json({ error: 'Collection not found' });
    
    if (req.params.collection === 'system_settings') {
      await Model.findOneAndUpdate({ _id: req.params.id }, { data: req.body }, { upsert: true });
    } else {
      const updateData = { ...req.body };
      delete updateData._id;
      delete updateData.__v;
      await Model.findOneAndUpdate({ id: req.params.id }, { $set: updateData }, { upsert: true });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.put('/api/:collection/:id', async (req, res) => {
  try {
    const Model = models[req.params.collection];
    if (!Model) return res.status(404).json({ error: 'Collection not found' });
    
    if (req.params.collection === 'system_settings') {
      // Fetch existing
      const existing = await Model.findOne({ _id: req.params.id }).lean();
      const newData = { ...(existing?.data || {}), ...req.body };
      await Model.findOneAndUpdate({ _id: req.params.id }, { data: newData }, { upsert: true });
    } else {
      // Fetch existing and merge
      const existing = await Model.findOne({ id: req.params.id }).lean();
      const newData = { ...(existing || {}), ...req.body };
      delete newData._id; // NEVER try to update _id
      delete newData.__v; 
      await Model.findOneAndUpdate({ id: req.params.id }, { $set: newData }, { upsert: true });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.delete('/api/:collection', async (req, res) => {
  try {
    const Model = models[req.params.collection];
    if (!Model) return res.status(404).json({ error: 'Collection not found' });
    
    await Model.deleteMany({});
    res.json({ success: true, message: 'All documents deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/:collection/:id', async (req, res) => {
  try {
    const Model = models[req.params.collection];
    if (!Model) return res.status(404).json({ error: 'Collection not found' });
    
    const query = req.params.collection === 'system_settings' 
      ? { _id: req.params.id } 
      : { id: req.params.id };
      
    await Model.findOneAndDelete(query);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// --- INIT APP ---
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
