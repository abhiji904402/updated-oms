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
  pairingCode?: string | null;
  lastConnectedAt?: string;
  lastError?: string | null;
  alreadyLinkedOnOtherDevice?: boolean;
  cloudSynced?: boolean;
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
let conflictRetryCount = 0;

const sessionDir = path.join(process.cwd(), '.data', 'wa_session');
const backupCredsPath = path.join(process.cwd(), '.data', 'wa_session_backup.json');
const repoSessionDir = path.join(process.cwd(), 'my_github_repo', '.data', 'wa_session');
const repoBackupCredsPath = path.join(process.cwd(), 'my_github_repo', '.data', 'wa_session_backup.json');
const CLOUD_SESSION_URL = 'https://broms-734a5-default-rtdb.asia-southeast1.firebasedatabase.app/broomies_config/wa_cloud_session.json';

let cloudBackupTimer: NodeJS.Timeout | null = null;

// In-memory engine state
const state: WAEngineState = {
  connected: false,
  sessionState: 'disconnected',
  qrCode: null,
  qrRaw: null,
  pairingCode: null,
  lastError: null,
  alreadyLinkedOnOtherDevice: false,
  cloudSynced: false
};

// Extract saved phone & name from creds.json if available
export function extractIdentityFromCreds(): { phoneNumber?: string; userName?: string } {
  try {
    const candidates = [
      path.join(sessionDir, 'creds.json'),
      backupCredsPath,
      path.join(repoSessionDir, 'creds.json'),
      repoBackupCredsPath
    ];
    for (const file of candidates) {
      if (fs.existsSync(file)) {
        const raw = fs.readFileSync(file, 'utf-8');
        if (raw && raw.length > 100) {
          const parsed = JSON.parse(raw);
          const me = parsed?.me || parsed?.creds?.me;
          if (me && me.id) {
            const cleanPhone = String(me.id).split(':')[0].replace('@s.whatsapp.net', '').replace(/[^0-9]/g, '');
            if (cleanPhone) {
              return {
                phoneNumber: `+${cleanPhone}`,
                userName: me.name || 'Broomies Bakery'
              };
            }
          }
        }
      }
    }
  } catch {}
  return {};
}

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

    const identity = extractIdentityFromCreds();
    const payload = {
      files,
      phoneNumber: state.phoneNumber || identity.phoneNumber || undefined,
      userName: state.userName || identity.userName || 'Broomies Bakery',
      connected: true,
      updatedAt: Date.now()
    };

    await fetch(CLOUD_SESSION_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    state.cloudSynced = true;
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
  }, 1500);
}

// Auto-patch whatsapp-rust-bridge exports if present
export function ensureWhatsappRustBridgePatch(): void {
  try {
    const pkgPath = path.join(process.cwd(), 'node_modules', 'whatsapp-rust-bridge', 'package.json');
    if (fs.existsSync(pkgPath)) {
      const raw = fs.readFileSync(pkgPath, 'utf-8');
      const json = JSON.parse(raw);
      let changed = false;
      if (!json.main) {
        json.main = './dist/index.js';
        changed = true;
      }
      if (!json.module) {
        json.module = './dist/index.js';
        changed = true;
      }
      if (json.exports && json.exports['.']) {
        if (!json.exports['.'].require) {
          json.exports['.'].require = './dist/index.js';
          changed = true;
        }
        if (!json.exports['.'].default) {
          json.exports['.'].default = './dist/index.js';
          changed = true;
        }
      }
      if (changed) {
        fs.writeFileSync(pkgPath, JSON.stringify(json, null, 2), 'utf-8');
      }
    }
  } catch {}
}
ensureWhatsappRustBridgePatch();

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
        if (item.name === 'creds.json') {
          hasCreds = true;
          try {
            fs.writeFileSync(backupCredsPath, item.content, 'utf-8');
          } catch {}
        }
      }
    }

    if (data.phoneNumber && !state.phoneNumber) {
      state.phoneNumber = data.phoneNumber;
    }
    if (data.userName && !state.userName) {
      state.userName = data.userName;
    }
    if (hasCreds) {
      state.cloudSynced = true;
      const id = extractIdentityFromCreds();
      if (id.phoneNumber) state.phoneNumber = id.phoneNumber;
      if (id.userName) state.userName = id.userName;
    }

    console.log(`✅ Restored ${data.files.length} WhatsApp session files from Firebase Cloud! Phone: ${state.phoneNumber || 'N/A'}`);
    return hasCreds;
  } catch (err) {
    console.error('Failed restoring WA session from cloud:', err);
    return false;
  }
}

// Restore backup creds if missing on disk (checks .data/wa_session_backup.json and my_github_repo/.data/wa_session)
export function restoreBackupCreds(): boolean {
  try {
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    const credsPath = path.join(sessionDir, 'creds.json');
    if (fs.existsSync(credsPath) && fs.statSync(credsPath).size > 200) {
      const id = extractIdentityFromCreds();
      if (id.phoneNumber && !state.phoneNumber) state.phoneNumber = id.phoneNumber;
      if (id.userName && !state.userName) state.userName = id.userName;
      return true;
    }

    // 1. Check .data/wa_session_backup.json
    if (fs.existsSync(backupCredsPath)) {
      const raw = fs.readFileSync(backupCredsPath, 'utf-8');
      if (raw && raw.length > 200) {
        fs.writeFileSync(credsPath, raw, 'utf-8');
        const id = extractIdentityFromCreds();
        if (id.phoneNumber) state.phoneNumber = id.phoneNumber;
        if (id.userName) state.userName = id.userName;
        console.log('✅ Restored WhatsApp session creds from local disk backup:', state.phoneNumber);
        return true;
      }
    }

    // 2. Check my_github_repo/.data/wa_session/creds.json & pre-keys
    const repoCreds = path.join(repoSessionDir, 'creds.json');
    if (fs.existsSync(repoCreds)) {
      const raw = fs.readFileSync(repoCreds, 'utf-8');
      if (raw && raw.length > 200) {
        fs.writeFileSync(credsPath, raw, 'utf-8');
        fs.writeFileSync(backupCredsPath, raw, 'utf-8');
        // Copy any pre-keys or device lists from repoSessionDir
        try {
          const repoFiles = fs.readdirSync(repoSessionDir);
          for (const f of repoFiles) {
            const targetF = path.join(sessionDir, f);
            if (!fs.existsSync(targetF)) {
              fs.copyFileSync(path.join(repoSessionDir, f), targetF);
            }
          }
        } catch {}
        const id = extractIdentityFromCreds();
        if (id.phoneNumber) state.phoneNumber = id.phoneNumber;
        if (id.userName) state.userName = id.userName;
        console.log('✅ Restored WhatsApp session creds from repository session store:', state.phoneNumber);
        scheduleCloudBackup();
        return true;
      }
    }

    // 3. Check my_github_repo/.data/wa_session_backup.json
    if (fs.existsSync(repoBackupCredsPath)) {
      const raw = fs.readFileSync(repoBackupCredsPath, 'utf-8');
      if (raw && raw.length > 200) {
        fs.writeFileSync(credsPath, raw, 'utf-8');
        fs.writeFileSync(backupCredsPath, raw, 'utf-8');
        const id = extractIdentityFromCreds();
        if (id.phoneNumber) state.phoneNumber = id.phoneNumber;
        if (id.userName) state.userName = id.userName;
        console.log('✅ Restored WhatsApp session creds from repository backup file:', state.phoneNumber);
        scheduleCloudBackup();
        return true;
      }
    }
  } catch (err) {
    console.error('Failed to restore backup WA creds:', err);
  }
  return false;
}

// Backup session creds to local disk & Cloud
export function backupCreds(): void {
  try {
    const credsPath = path.join(sessionDir, 'creds.json');
    if (fs.existsSync(credsPath)) {
      const raw = fs.readFileSync(credsPath, 'utf-8');
      if (raw && raw.length > 200) {
        const backupDir = path.join(process.cwd(), '.data');
        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
        fs.writeFileSync(backupCredsPath, raw, 'utf-8');
      }
    }
  } catch (err) {
    console.error('Failed to backup WA creds locally:', err);
  }
  scheduleCloudBackup();
}

// Try auto-restore immediately on module load
if (restoreBackupCreds()) {
  const id = extractIdentityFromCreds();
  if (id.phoneNumber) {
    state.phoneNumber = id.phoneNumber;
    state.userName = id.userName || 'Broomies Bakery';
    state.connected = true;
    state.sessionState = 'connected';
    state.alreadyLinkedOnOtherDevice = true;
    state.cloudSynced = true;
    state.lastConnectedAt = new Date().toISOString();
  }
}

// Check if valid credentials exist on disk or backup
export function hasExistingSession(): boolean {
  try {
    const credsPath = path.join(sessionDir, 'creds.json');
    if (fs.existsSync(credsPath)) {
      const stat = fs.statSync(credsPath);
      if (stat.size > 200) {
        const content = fs.readFileSync(credsPath, 'utf-8');
        const parsed = JSON.parse(content);
        if (parsed && (parsed.creds || parsed.me || parsed.account || parsed.noiseKey)) return true;
      }
    }
    return restoreBackupCreds();
  } catch {
    return false;
  }
}

// Get current live state (merges saved session identity so UI never flickers to logged out)
export function getEngineState(): WAEngineState {
  if (!state.phoneNumber && hasExistingSession()) {
    const id = extractIdentityFromCreds();
    if (id.phoneNumber) {
      state.phoneNumber = id.phoneNumber;
      state.userName = id.userName || 'Broomies Bakery';
    }
  }
  return { ...state };
}

// Initialize Baileys WhatsApp Socket
export async function startWhatsAppEngine(forceNewSession = false): Promise<WAEngineState> {
  if (isStarting) {
    return getEngineState();
  }

  if (socketInstance && state.connected && !state.alreadyLinkedOnOtherDevice && !forceNewSession) {
    return getEngineState();
  }

  isStarting = true;
  shouldReconnect = true;
  state.lastError = null;

  try {
    if (forceNewSession) {
      shouldReconnect = false;
      conflictRetryCount = 0;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (socketInstance) {
        try {
          socketInstance.end(new Error('Starting fresh QR session'));
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
      state.connected = false;
      state.alreadyLinkedOnOtherDevice = false;
      state.phoneNumber = undefined;
      state.userName = undefined;
      state.qrCode = null;
      state.qrRaw = null;
      state.pairingCode = null;
      state.sessionState = 'connecting';
    }

    // Ensure session directory exists
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    // Auto-restore from local backup or Firebase Cloud ONLY IF NOT forceNewSession
    if (!forceNewSession && !fs.existsSync(path.join(sessionDir, 'creds.json'))) {
      const restoredLocal = restoreBackupCreds();
      if (!restoredLocal) {
        console.log('Checking Firebase Cloud for saved WhatsApp session...');
        await restoreSessionFromCloud();
      }
    }

    if (!forceNewSession) {
      const id = extractIdentityFromCreds();
      if (id.phoneNumber) {
        state.phoneNumber = id.phoneNumber;
        state.userName = id.userName || 'Broomies Bakery';
      }
    }

    const baileys = await import('@whiskeysockets/baileys');
    const makeWASocket = baileys.default || baileys.makeWASocket;
    const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = baileys;

    const { state: authState, saveCreds } = await useMultiFileAuthState(sessionDir);

    let version: [number, number, number] = [2, 3000, 1015901307];
    try {
      const vPromise = fetchLatestBaileysVersion();
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000));
      const vData: any = await Promise.race([vPromise, timeoutPromise]);
      if (vData?.version) version = vData.version as [number, number, number];
    } catch {
      console.log('ℹ️ Using stable fallback Baileys WhatsApp version');
    }

    shouldReconnect = true;

    const sock = makeWASocket({
      version,
      auth: authState,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      browser: ['Broomies OMS Cloud', 'Chrome', '122.0.0'],
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
        const id = extractIdentityFromCreds();
        if (id.phoneNumber) {
          state.phoneNumber = id.phoneNumber;
          state.userName = id.userName || 'Broomies Bakery';
        }
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
        // Only overwrite connected state with QR if we don't already have an active linked identity or if user requested a new QR
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
          console.log('✅ Fresh WhatsApp QR Code generated successfully!');
        } catch (err: any) {
          console.error('Error generating QR data URL:', err);
        }
      }

      // Handle successful connection
      if (connection === 'open') {
        conflictRetryCount = 0;
        state.connected = true;
        state.alreadyLinkedOnOtherDevice = false;
        state.sessionState = 'connected';
        state.qrCode = null;
        state.qrRaw = null;
        state.pairingCode = null;
        state.lastError = null;
        state.lastConnectedAt = new Date().toISOString();

        if (sock.user) {
          const rawId = sock.user.id || '';
          const cleanPhone = rawId.split(':')[0].replace('@s.whatsapp.net', '').replace(/[^0-9]/g, '');
          state.phoneNumber = cleanPhone ? `+${cleanPhone}` : state.phoneNumber;
          state.userName = sock.user.name || state.userName || 'Broomies Bakery';
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
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldRestart = shouldReconnect;

        console.log(`WhatsApp connection closed. Status Code: ${statusCode}, will restart: ${shouldRestart}`);

        // IMPORTANT: Never auto-delete saved credentials or Cloud Session!
        // When both Pre-Deploy (AI Studio Preview) and Post-Deploy (Production) run simultaneously,
        // WhatsApp may emit 440 (Stream Replaced) or 401 on the secondary instance.
        // Instead of wiping credentials, we preserve the linked session and show "Connected / Active on Cloud & Other Device"!
        const id = extractIdentityFromCreds();
        if (id.phoneNumber) {
          state.phoneNumber = id.phoneNumber;
          state.userName = id.userName || 'Broomies Bakery';
          state.connected = true;
          state.sessionState = 'connected';
          state.alreadyLinkedOnOtherDevice = true;
          state.cloudSynced = true;
          state.lastError = null;
        } else {
          state.connected = false;
          state.sessionState = shouldRestart ? 'connecting' : 'disconnected';
        }

        if (shouldRestart) {
          conflictRetryCount = Math.min(conflictRetryCount + 1, 10);
          // Use longer backoff (25s-60s) if stream replaced (440) or 401 so pre-deploy and post-deploy don't fight each other
          const delayMs = (statusCode === 440 || statusCode === 401 || statusCode === DisconnectReason.connectionReplaced)
            ? 30000 + conflictRetryCount * 5000
            : 4000;
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => {
            startWhatsAppEngine(false);
          }, delayMs);
        }
      }
    });

    isStarting = false;
    return getEngineState();
  } catch (err: any) {
    isStarting = false;
    const id = extractIdentityFromCreds();
    if (id.phoneNumber) {
      state.phoneNumber = id.phoneNumber;
      state.userName = id.userName || 'Broomies Bakery';
      state.connected = true;
      state.sessionState = 'connected';
      state.alreadyLinkedOnOtherDevice = true;
    } else {
      state.connected = false;
      state.sessionState = 'disconnected';
      state.lastError = err.message || String(err);
    }
    console.error('Notice starting WhatsApp engine:', err);
    return getEngineState();
  }
}

// Request 8-Digit Phone Number Pairing Code
export async function requestWhatsAppPairingCode(phoneNumberInput: string): Promise<{ success: boolean; pairingCode?: string; error?: string }> {
  try {
    const cleanPhone = String(phoneNumberInput || '').replace(/[^0-9]/g, '');
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    if (formattedPhone.length < 10) {
      return { success: false, error: 'Please enter a valid 10-digit WhatsApp mobile number.' };
    }

    if (!socketInstance || state.connected) {
      await startWhatsAppEngine(true);
      await new Promise((r) => setTimeout(r, 2000));
    }

    if (socketInstance && typeof socketInstance.requestPairingCode === 'function') {
      const code = await socketInstance.requestPairingCode(formattedPhone);
      const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
      state.pairingCode = formattedCode;
      state.sessionState = 'pairing';
      return { success: true, pairingCode: formattedCode };
    }
    return { success: false, error: 'Socket is initializing, please try again in 2 seconds or use QR Code.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Could not generate pairing code. Please use QR Code scan.' };
  }
}

// Disconnect and wipe credentials ONLY when explicitly requested by user
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
  state.alreadyLinkedOnOtherDevice = false;
  state.cloudSynced = false;
  state.sessionState = 'disconnected';
  state.phoneNumber = undefined;
  state.userName = undefined;
  state.qrCode = null;
  state.qrRaw = null;
  state.pairingCode = null;
  state.lastError = null;

  return getEngineState();
}

// Send Real Message via Baileys Multi-Device Socket (with automatic reconnect attempt)
export async function sendWhatsAppEngineMessage(phone: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!socketInstance || !state.connected || state.alreadyLinkedOnOtherDevice) {
    try {
      let hasSaved = hasExistingSession();
      if (!hasSaved) {
        hasSaved = await restoreSessionFromCloud();
      }
      if (hasSaved) {
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
        startWhatsAppEngine(false).catch(() => {});
        const deadline = Date.now() + 7000;
        while (Date.now() < deadline) {
          if (socketInstance && state.connected && !state.alreadyLinkedOnOtherDevice) {
            break;
          }
          await new Promise((r) => setTimeout(r, 300));
        }
      }
    } catch {}
  }

  if (!socketInstance || !state.connected || state.alreadyLinkedOnOtherDevice) {
    return {
      success: false,
      error: state.alreadyLinkedOnOtherDevice
        ? 'Auto-reconnect tried, but live WhatsApp socket is either active on another server instance or logged out on phone. Click "Unlink / Log Out WhatsApp" and scan a fresh QR Code to enable live automatic sending.'
        : 'Official WhatsApp socket is not connected. Please scan the QR code or use 8-Digit Pairing Code to link your WhatsApp account.'
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

