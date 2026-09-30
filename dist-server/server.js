import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import compression from 'compression';
import cors from 'cors';
import { initWhatsApp, getWhatsAppStatus, logoutWhatsApp, sendWhatsAppMessage } from './api/whatsapp-service';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const server = createServer(app);
const port = 3000;
// @ts-ignore
app.use(cors());
// @ts-ignore
app.use(compression());
// @ts-ignore
app.use(express.json({ limit: '50mb' }));
// API Routes
app.get('/api/whatsapp/status', async (req, res) => {
    try {
        const status = await getWhatsAppStatus();
        res.json(status);
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/api/whatsapp/logout', async (req, res) => {
    try {
        await logoutWhatsApp();
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/api/whatsapp/send', async (req, res) => {
    try {
        const { phone, message } = req.body;
        const result = await sendWhatsAppMessage(phone, message);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Serve static files from the Vite build
// @ts-ignore
app.use(express.static(path.join(__dirname, 'dist')));
// Fallback to index.html for SPA
// @ts-ignore
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});
// Initialize WhatsApp
initWhatsApp().catch(console.error);
server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
