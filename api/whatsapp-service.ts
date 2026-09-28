import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import pino from 'pino';

// Types for WhatsApp State
export interface WAEngineState {
  connected: boolean;
  sessionState: 'disconnected' | 'connecting' | 'pairing' | 'connected';
  phoneNumber?: string;
  userName?: string;
  qrCode?: string | null;
  qrRaw?: string | null;
  qrExpiresAt?: number;
  lastConnectedAt?: string;
  lastError?: string | null;
}

type ConnectionCallback = (phone?: string) => void;
const connectedListeners: ConnectionCallback[] = [];

export function registerOnConnectedListener(cb: ConnectionCallback) {
  connectedListeners.push(cb);
}

let socketInstance: any = null;
let isStarting = false;
let shouldReconnect = true;
let reconnectTimer: NodeJS.Timeout | null = null;

const sessionDir = path.join(process.cwd(), '.data', 'wa_session');
const backupCredsPath = path.join(process.cwd(), '.data', 'wa_session_backup.json');
const CLOUD_SESSION_URL = 'https://broms-734a5-default-rtdb.asia-southeast1.firebasedatabase.app/broomies_config/wa_cloud_session.json';

let cloudBackupTimer: NodeJS.Timeout | null = null;

// Backup all session json files to Firebase Realtime Database
export async function backupSessionToCloud(): Promise<void> {
  try {
    if (!fs.existsSync(sessionDir)) return;
    const fileNames = fs.readdirSync(sessionDir);
    const files: { name: string; content: string }[] = [];
    for (const name of fileNames) {
      if (name.endsWith('.json')) {
        try {
          const content = fs.readFileSync(path.join(sessionDir, name), 'utf-8');
          if (content && content.length > 5) {
            files.push({ name, content });
          }
        } catch {}
      }
    }
    if (files.length === 0) return;

    const payload = {
      files,
      phoneNumber: state.phoneNumber || undefined,
      userName: state.userName || undefined,
      updatedAt: Date.now()
    };

    await fetch(CLOUD_SESSION_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    console.log(`☁️ Synced ${files.length} WhatsApp session files to Firebase Cloud (Persistence Guaranteed).`);
  } catch (err) {
    console.error('Failed backing up WA session to cloud:', err);
  }
}

// Debounced cloud backup
export function scheduleCloudBackup(): void {
  if (cloudBackupTimer) clearTimeout(cloudBackupTimer);
  cloudBackupTimer = setTimeout(() => {
    backupSessionToCloud().catch(() => {});
  }, 1000);
}

// Restore session from Firebase Realtime Database
export async function restoreSessionFromCloud(): Promise<boolean> {
  try {
    const res = await fetch(CLOUD_SESSION_URL);
    if (!res.ok) return false;
    const data = await res.json();
    if (!data || !Array.isArray(data.files) || data.files.length === 0) return false;

    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    let hasCreds = false;
    for (const item of data.files) {
      if (item && item.name && item.content) {
        fs.writeFileSync(path.join(sessionDir, item.name), item.content, 'utf-8');
        if (item.name === 'creds.json') hasCreds = true;
      }
    }

    if (data.phoneNumber && !state.phoneNumber) {
      state.phoneNumber = data.phoneNumber;
    }
    if (data.userName && !state.userName) {
      state.userName = data.userName;
    }

    console.log(`✅ Restored ${data.files.length} WhatsApp session files from Firebase Cloud! Phone: ${data.phoneNumber || 'N/A'}`);
    return hasCreds;
  } catch (err) {
    console.error('Failed restoring WA session from cloud:', err);
    return false;
  }
}

// Restore backup creds if missing on disk (local disk fallback)
export function restoreBackupCreds(): boolean {
  try {
    const credsPath = path.join(sessionDir, 'creds.json');
    if (fs.existsSync(credsPath)) return true;
    if (fs.existsSync(backupCredsPath)) {
      const raw = fs.readFileSync(backupCredsPath, 'utf-8');
      if (raw && raw.length > 50) {
        if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
        fs.writeFileSync(credsPath, raw, 'utf-8');
        console.log('✅ Restored WhatsApp session creds from local disk backup');
        return true;
      }
    }
  } catch (err) {
    console.error('Failed to restore backup WA creds:', err);
  }
  return false;
}

// Backup session creds to local disk
export function backupCreds(): void {
  try {
    const credsPath = path.join(sessionDir, 'creds.json');
    if (fs.existsSync(credsPath)) {
      const raw = fs.readFileSync(credsPath, 'utf-8');
      const backupDir = path.join(process.cwd(), '.data');
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
      fs.writeFileSync(backupCredsPath, raw, 'utf-8');
    }
  } catch (err) {
    console.error('Failed to backup WA creds locally:', err);
  }
  scheduleCloudBackup();
}

// Try auto-restore immediately on load
restoreBackupCreds();

// In-memory engine state
const state: WAEngineState = {
  connected: false,
  sessionState: 'disconnected',
  qrCode: null,
  qrRaw: null,
  lastError: null
};

// Check if valid credentials exist on disk or cloud
export function hasExistingSession(): boolean {
  try {
    const credsPath = path.join(sessionDir, 'creds.json');
    if (fs.existsSync(credsPath)) {
      const stat = fs.statSync(credsPath);
      if (stat.size > 200) {
        const content = fs.readFileSync(credsPath, 'utf-8');
        const parsed = JSON.parse(content);
        if (parsed && (parsed.creds || parsed.me || parsed.account)) return true;
      }
    }
    return restoreBackupCreds();
  } catch {
    return false;
  }
}

// Get current live state
export function getEngineState(): WAEngineState {
  return { ...state };
}

// Initialize Baileys WhatsApp Socket
export async function startWhatsAppEngine(forceNewSession = false): Promise<WAEngineState> {
  if (isStarting) {
    return getEngineState();
  }

  if (socketInstance && state.connected && !forceNewSession) {
    return getEngineState();
  }

  isStarting = true;
  shouldReconnect = true;
  state.sessionState = 'connecting';
  state.lastError = null;

  try {
    if (forceNewSession) {
      if (socketInstance) {
        try {
          socketInstance.end(new Error('Starting new session'));
        } catch {}
        socketInstance = null;
      }
      try {
        if (fs.existsSync(sessionDir)) {
          fs.rmSync(sessionDir, { recursive: true, force: true });
        }
      } catch (e) {
        console.error('Error clearing session dir:', e);
      }
    }

    // Ensure session directory exists
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    // Auto-restore from Firebase Cloud if missing locally on disk
    if (!fs.existsSync(path.join(sessionDir, 'creds.json'))) {
      const restoredLocal = restoreBackupCreds();
      if (!restoredLocal) {
        console.log('Checking Firebase Cloud for saved WhatsApp session...');
        await restoreSessionFromCloud();
      }
    }

    const baileys = await import('@whiskeysockets/baileys');
    const makeWASocket = baileys.default || baileys.makeWASocket;
    const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = baileys;

    const { state: authState, saveCreds } = await useMultiFileAuthState(sessionDir);

    let version: [number, number, number] = [2, 3000, 1015901307];
    try {
      const vData = await fetchLatestBaileysVersion();
      if (vData?.version) version = vData.version as [number, number, number];
    } catch {}

    const sock = makeWASocket({
      version,
      auth: authState,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      browser: ['Broomies OMS', 'Chrome', '1.0.0'],
      syncFullHistory: false,
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: false,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 25000
    });

    socketInstance = sock;

    // Credentials update handler
    sock.ev.on('creds.update', async () => {
      try {
        await saveCreds();
        backupCreds();
      } catch (err) {
        console.error('Error saving creds:', err);
      }
    });

    // Connection update handler
    sock.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      // Handle QR Code receipt
      if (qr) {
        state.qrRaw = qr;
        state.sessionState = 'pairing';
        state.qrExpiresAt = Date.now() + 60000;
        try {
          state.qrCode = await QRCode.toDataURL(qr, {
            width: 340,
            margin: 2,
            color: {
              dark: '#0f172a',
              light: '#ffffff'
            }
          });
        } catch (err: any) {
          console.error('Error generating QR data URL:', err);
        }
      }

      // Handle successful connection
      if (connection === 'open') {
        state.connected = true;
        state.sessionState = 'connected';
        state.qrCode = null;
        state.qrRaw = null;
        state.lastError = null;
        state.lastConnectedAt = new Date().toISOString();

        if (sock.user) {
          const rawId = sock.user.id || '';
          const cleanPhone = rawId.split(':')[0].replace('@s.whatsapp.net', '');
          state.phoneNumber = cleanPhone ? `+${cleanPhone}` : undefined;
          state.userName = sock.user.name || 'Broomies Official';
        }
        backupCreds();
        scheduleCloudBackup();
        console.log('✅ WhatsApp Multi-Device Connected! Phone:', state.phoneNumber);

        // Notify all registered listeners (e.g. to flush offline outbox queue)
        for (const cb of connectedListeners) {
          try {
            cb(state.phoneNumber);
          } catch (e) {
            console.error('Error in onConnected listener:', e);
          }
        }
      }

      // Handle disconnection
      if (connection === 'close') {
        state.connected = false;
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldRestart = shouldReconnect;

        console.log(`WhatsApp connection closed. Status Code: ${statusCode}, will restart: ${shouldRestart}`);

        if (statusCode === DisconnectReason.loggedOut) {
          // Do NOT aggressively wipe session files on first 401 code!
          // WhatsApp servers can temporarily reject reconnection during token rotation.
          console.warn('⚠️ WhatsApp received loggedOut code, keeping session backup safe in case of reconnect.');
          state.sessionState = 'disconnected';
          state.lastError = 'Session disconnected. Reconnecting with saved session...';

          if (shouldRestart) {
            if (reconnectTimer) clearTimeout(reconnectTimer);
            reconnectTimer = setTimeout(() => {
              startWhatsAppEngine(false);
            }, 5000);
          }
        } else {
          // Keep state as 'connecting' with existing phoneNumber so clients know session is intact
          state.sessionState = 'connecting';
          if (shouldRestart) {
            if (reconnectTimer) clearTimeout(reconnectTimer);
            reconnectTimer = setTimeout(() => {
              startWhatsAppEngine(false);
            }, 2000);
          }
        }
      }
    });

    isStarting = false;
    return getEngineState();
  } catch (err: any) {
    isStarting = false;
    state.connected = false;
    state.sessionState = 'disconnected';
    state.lastError = err.message || String(err);
    console.error('Failed to start WhatsApp engine:', err);
    return getEngineState();
  }
}

// Disconnect and wipe credentials
export async function disconnectWhatsAppEngine(): Promise<WAEngineState> {
  shouldReconnect = false;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (socketInstance) {
    try {
      await socketInstance.logout();
    } catch {}
    try {
      socketInstance.end(new Error('User disconnected'));
    } catch {}
    socketInstance = null;
  }

  try {
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
  } catch (e) {
    console.error('Error removing session directory:', e);
  }
  try {
    if (fs.existsSync(backupCredsPath)) {
      fs.unlinkSync(backupCredsPath);
    }
  } catch {}

  // Delete cloud session on explicit user unlink
  try {
    fetch(CLOUD_SESSION_URL, { method: 'DELETE' }).catch(() => {});
  } catch {}

  state.connected = false;
  state.sessionState = 'disconnected';
  state.phoneNumber = undefined;
  state.userName = undefined;
  state.qrCode = null;
  state.qrRaw = null;
  state.lastError = null;

  return getEngineState();
}

// Send Real Message via Baileys Multi-Device Socket
export async function sendWhatsAppEngineMessage(phone: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!state.connected || !socketInstance) {
    return {
      success: false,
      error: 'Official WhatsApp is not connected. Please scan the QR code to link your WhatsApp account.'
    };
  }

  try {
    const cleanDigits = phone.replace(/[^0-9]/g, '');
    const recipient = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;
    const jid = `${recipient}@s.whatsapp.net`;

    const result = await socketInstance.sendMessage(jid, { text: message });
    return {
      success: true,
      messageId: result?.key?.id || `baileys-${Date.now()}`
    };
  } catch (err: any) {
    console.error('Baileys message send failed:', err);
    return {
      success: false,
      error: err.message || 'Failed to send WhatsApp message via socket'
    };
  }
}
