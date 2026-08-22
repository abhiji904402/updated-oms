// Broomies OMS Indestructible Local Storage & Vault System
// Multi-tiered storage with structured local namespaces, automated snapshots, and zero data loss.

import { Order } from '../types';
import { idbGet, idbSet, idbDelete, idbGetAllKeys } from './idb';

export interface StorageSnapshot {
  id: string;
  timestamp: string;
  label: string;
  orderCount: number;
  data: Order[];
}

// Namespaced "Folder-like" Storage Keys
export const LOCAL_VAULT_KEYS = {
  ACTIVE_ORDERS: 'broomies_vault/orders/active_v8',
  BACKUP_DAILY: 'broomies_vault/orders/daily_backup',
  BACKUP_WEEKLY: 'broomies_vault/orders/weekly_backup',
  SNAPSHOT_PREFIX: 'broomies_vault/snapshots/',
  METADATA: 'broomies_vault/metadata',
  PARTNERS: 'broomies_vault/partners/active',
  OUTLETS: 'broomies_vault/outlets/active',
  SETTINGS: 'broomies_vault/settings/config'
};

const MAX_SNAPSHOTS = 10;

/**
 * Saves orders to the primary fast local storage layers:
 * 1. Synchronous LocalStorage (for instant 0ms app boot)
 * 2. Asynchronous IndexedDB (unlimited quota, binary safe)
 * 3. Automatic rotating snapshot vault
 */
export async function persistToLocalVault(orders: Order[], reason = 'Auto-Save'): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    // 1. IndexedDB unlimited local disk persistence
    await idbSet(LOCAL_VAULT_KEYS.ACTIVE_ORDERS, orders);

    // 2. Synchronous LocalStorage fallback (stripping heavy images if needed)
    try {
      localStorage.setItem(LOCAL_VAULT_KEYS.ACTIVE_ORDERS, JSON.stringify(orders));
    } catch (quotaErr) {
      console.warn('LocalStorage limit reached, saving clean lightweight orders copy:', quotaErr);
      const cleanCopy = orders.map(o => ({
        ...o,
        item_image_url: (o.item_image_url && o.item_image_url.length > 250) ? '' : o.item_image_url,
        delivery_photo_url: (o.delivery_photo_url && o.delivery_photo_url.length > 250) ? '' : o.delivery_photo_url
      }));
      try {
        localStorage.setItem(LOCAL_VAULT_KEYS.ACTIVE_ORDERS, JSON.stringify(cleanCopy));
      } catch (e2) {
        console.warn('LocalStorage fully saturated; IndexedDB remains primary authority.');
      }
    }

    // 3. Update vault metadata
    const metadata = {
      lastSaved: new Date().toISOString(),
      orderCount: orders.length,
      status: 'healthy',
      totalRevenue: orders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0)
    };
    await idbSet(LOCAL_VAULT_KEYS.METADATA, metadata);
    try {
      localStorage.setItem(LOCAL_VAULT_KEYS.METADATA, JSON.stringify(metadata));
    } catch (_) {}

  } catch (err) {
    console.error('Error persisting to local vault:', err);
  }
}

/**
 * Creates a timestamped local snapshot for zero-data-loss rollback.
 */
export async function createLocalSnapshot(orders: Order[], label: string): Promise<StorageSnapshot> {
  const snapshotId = `snap_${Date.now()}`;
  const snapshot: StorageSnapshot = {
    id: snapshotId,
    timestamp: new Date().toISOString(),
    label: label || `Snapshot (${orders.length} orders)`,
    orderCount: orders.length,
    data: orders
  };

  const key = `${LOCAL_VAULT_KEYS.SNAPSHOT_PREFIX}${snapshotId}`;
  await idbSet(key, snapshot);

  // Manage rolling snapshots to keep latest 10
  try {
    const allKeys = await idbGetAllKeys();
    const snapKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith(LOCAL_VAULT_KEYS.SNAPSHOT_PREFIX));
    if (snapKeys.length > MAX_SNAPSHOTS) {
      // Sort oldest first
      snapKeys.sort();
      const toDelete = snapKeys.slice(0, snapKeys.length - MAX_SNAPSHOTS);
      for (const k of toDelete) {
        await idbDelete(k as string);
      }
    }
  } catch (e) {
    console.warn('Failed to prune old snapshots', e);
  }

  return snapshot;
}

/**
 * Fetches all available local snapshots.
 */
export async function getAvailableSnapshots(): Promise<StorageSnapshot[]> {
  try {
    const allKeys = await idbGetAllKeys();
    const snapKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith(LOCAL_VAULT_KEYS.SNAPSHOT_PREFIX));
    const snapshots: StorageSnapshot[] = [];

    for (const key of snapKeys) {
      const snap = await idbGet<StorageSnapshot>(key as string);
      if (snap && snap.data) {
        snapshots.push(snap);
      }
    }

    // Sort descending by timestamp
    return snapshots.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (err) {
    console.error('Failed to get snapshots:', err);
    return [];
  }
}

/**
 * Restores orders from a specific snapshot ID.
 */
export async function restoreSnapshot(snapshotId: string): Promise<Order[] | null> {
  const key = `${LOCAL_VAULT_KEYS.SNAPSHOT_PREFIX}${snapshotId}`;
  const snap = await idbGet<StorageSnapshot>(key);
  if (snap && Array.isArray(snap.data)) {
    await persistToLocalVault(snap.data, `Restored from ${snap.label}`);
    return snap.data;
  }
  return null;
}

/**
 * Downloads a complete, indestructible JSON backup of the entire local vault directly to the user's computer.
 */
export function exportVaultToDisk(orders: Order[], fileNamePrefix = 'Broomies_OMS_Local_Backup'): void {
  const payload = {
    app: 'Broomies OMS',
    version: '8.0',
    exportDate: new Date().toISOString(),
    orderCount: orders.length,
    orders: orders
  };

  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
  const downloadAnchor = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `${fileNamePrefix}_${dateStr}_${orders.length}_Orders.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

/**
 * Reads and parses a local JSON vault backup file.
 */
export async function importVaultFromDisk(file: File): Promise<{ success: boolean; orders: Order[]; message: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        let extractedOrders: Order[] = [];
        if (Array.isArray(parsed)) {
          extractedOrders = parsed;
        } else if (parsed && Array.isArray(parsed.orders)) {
          extractedOrders = parsed.orders;
        } else {
          resolve({ success: false, orders: [], message: 'Invalid file format: No order array found.' });
          return;
        }

        if (extractedOrders.length === 0) {
          resolve({ success: false, orders: [], message: 'The backup file is empty (0 orders).' });
          return;
        }

        // Validate basic structure
        const validated = extractedOrders.filter(o => o && (o.id || o.order_number || o.customer_name));
        resolve({
          success: true,
          orders: validated,
          message: `Successfully loaded ${validated.length} orders from backup!`
        });
      } catch (err: any) {
        resolve({
          success: false,
          orders: [],
          message: `Failed to read JSON backup file: ${err.message || 'Corrupted file'}`
        });
      }
    };
    reader.onerror = () => {
      resolve({ success: false, orders: [], message: 'File read error.' });
    };
    reader.readAsText(file);
  });
}
