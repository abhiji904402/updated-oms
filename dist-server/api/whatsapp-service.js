import makeWASocket, { DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, Browsers } from '@whiskeysockets/baileys';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pino from 'pino';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authPath = path.join(process.cwd(), '.data', 'wa_session');
// Ensure data directory exists
if (!fs.existsSync(authPath)) {
    fs.mkdirSync(authPath, { recursive: true });
}
let sock = null;
let qr = null;
let connectionState = 'disconnected';
let phoneNumber = null;
let userName = null;
const logger = pino({ level: 'silent' });
export async function initWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const { version } = await fetchLatestBaileysVersion();
    sock = makeWASocket({
        version,
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        browser: Browsers.macOS('Desktop'),
        syncFullHistory: false,
        shouldIgnoreJid: (jid) => jid.includes('status@broadcast') || jid.includes('newsletter'),
        logger
    });
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr: newQr } = update;
        if (newQr) {
            qr = newQr;
            connectionState = 'qr';
        }
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);
            connectionState = 'disconnected';
            qr = null;
            if (shouldReconnect) {
                initWhatsApp();
            }
        }
        else if (connection === 'open') {
            console.log('opened connection');
            connectionState = 'connected';
            qr = null;
            phoneNumber = sock.user?.id?.split(':')[0] || null;
            userName = sock.user?.name || null;
        }
    });
    sock.ev.on('creds.update', saveCreds);
    return sock;
}
export async function getWhatsAppStatus() {
    // Real check: if we think we are connected, verify with a simple call
    if (connectionState === 'connected' && sock) {
        try {
            if (!sock.user?.id) {
                throw new Error('No user ID in session');
            }
            // Just check if we can get our own profile to ensure the session is actually valid
            await sock.onWhatsApp(sock.user.id);
        }
        catch (e) {
            console.log('Session verification failed, marking as disconnected:', e.message);
            connectionState = 'disconnected';
            qr = null;
        }
    }
    return {
        success: true,
        connected: connectionState === 'connected' && !!sock?.user?.id,
        sessionState: connectionState,
        qrCode: qr,
        phoneNumber: sock?.user?.id?.split(':')[0] || phoneNumber,
        userName: sock?.user?.name || userName,
        lastSync: new Date().toISOString()
    };
}
export async function logoutWhatsApp() {
    if (sock) {
        await sock.logout();
        sock = null;
        connectionState = 'disconnected';
        qr = null;
        phoneNumber = null;
        userName = null;
        // Clear session data
        if (fs.existsSync(authPath)) {
            fs.rmSync(authPath, { recursive: true, force: true });
        }
        // Restart to get a new QR
        setTimeout(() => initWhatsApp(), 2000);
    }
}
export async function sendWhatsAppMessage(phone, message) {
    if (connectionState !== 'connected' || !sock) {
        return { success: false, error: 'WhatsApp not connected' };
    }
    try {
        // Format phone: remove +, spaces, ensure it has @s.whatsapp.net
        let formattedPhone = phone.replace(/\D/g, '');
        if (!formattedPhone.endsWith('@s.whatsapp.net')) {
            formattedPhone += '@s.whatsapp.net';
        }
        await sock.sendMessage(formattedPhone, { text: message });
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
}
