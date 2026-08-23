import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Mongoose Connection Cache for Serverless
const MONGODB_URI = process.env.MONGODB_URI;
let cachedDb: typeof mongoose | null = null;

const connectDB = async () => {
  if (cachedDb) return cachedDb;
  if (!MONGODB_URI) {
    throw new Error('No MONGODB_URI found in environment variables.');
  }
  if (mongoose.connection.readyState === 1) {
    cachedDb = mongoose;
    return cachedDb;
  }
  try {
    cachedDb = await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('Connected to MongoDB via Vercel Serverless');
    return cachedDb;
  } catch (err) {
    console.error('MongoDB connection error:', err);
    throw err;
  }
};

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

// --- API ROUTES ---
const apiRouter = express.Router();

apiRouter.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error: any) {
    return res.status(503).json({ error: 'Database connection failed: ' + error.message });
  }
});

apiRouter.get('/:collection', async (req, res) => {
  try {
    const Model = models[req.params.collection];
    if (!Model) return res.status(404).json({ error: 'Collection not found' });
    const data = await Model.find({}).lean();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

apiRouter.get('/:collection/:id', async (req, res) => {
  try {
    const Model = models[req.params.collection];
    if (!Model) return res.status(404).json({ error: 'Collection not found' });
    const query = req.params.collection === 'system_settings'
      ? { _id: req.params.id }
      : { id: req.params.id };
    const doc = await Model.findOne(query).lean();
    if (!doc) return res.status(404).json({});
    if (req.params.collection === 'system_settings') {
      res.json(doc.data || doc);
    } else {
      res.json(doc);
    }
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

apiRouter.post('/:collection/:id', async (req, res) => {
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

apiRouter.put('/:collection/:id', async (req, res) => {
  try {
    const Model = models[req.params.collection];
    if (!Model) return res.status(404).json({ error: 'Collection not found' });
    if (req.params.collection === 'system_settings') {
      const existing = await Model.findOne({ _id: req.params.id }).lean();
      const newData = { ...(existing?.data || {}), ...req.body };
      await Model.findOneAndUpdate({ _id: req.params.id }, { data: newData }, { upsert: true });
    } else {
      const existing = await Model.findOne({ id: req.params.id }).lean();
      const newData = { ...(existing || {}), ...req.body };
      delete newData._id;
      delete newData.__v;
      await Model.findOneAndUpdate({ id: req.params.id }, { $set: newData }, { upsert: true });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

apiRouter.delete('/:collection', async (req, res) => {
  try {
    const Model = models[req.params.collection];
    if (!Model) return res.status(404).json({ error: 'Collection not found' });
    await Model.deleteMany({});
    res.json({ success: true, message: 'All documents deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.delete('/:collection/:id', async (req, res) => {
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

apiRouter.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// REMOVED app.use('/', apiRouter) which was causing static files to return 404
app.use('/api', apiRouter);

// Support Vercel serverless where the route is passed without /api sometimes
// but ONLY if the route looks like a database call (orders, delivery_partners, etc.)
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
