// IndexedDB persistent storage utility for Broomies OMS
const DB_NAME = 'broomies_oms_idb';
const DB_VERSION = 1;
const STORE_NAME = 'oms_data';

let cachedDb: IDBDatabase | null = null;
let dbOpenPromise: Promise<IDBDatabase> | null = null;

function closeCachedDB() {
  if (cachedDb) {
    try {
      cachedDb.close();
    } catch {}
    cachedDb = null;
  }
  dbOpenPromise = null;
}

function openDB(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB not supported'));
  }

  // If already connected and not closed/closing, reuse connection
  if (cachedDb) {
    return Promise.resolve(cachedDb);
  }

  // If connection is in-flight, return the existing promise
  if (dbOpenPromise) {
    return dbOpenPromise;
  }

  dbOpenPromise = new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        cachedDb = db;
        dbOpenPromise = null;

        // Reset if closed by browser or version change
        db.onclose = () => {
          closeCachedDB();
        };
        db.onversionchange = () => {
          closeCachedDB();
        };

        resolve(db);
      };

      request.onerror = () => {
        dbOpenPromise = null;
        reject(request.error);
      };

      request.onblocked = () => {
        closeCachedDB();
      };
    } catch (err) {
      dbOpenPromise = null;
      reject(err);
    }
  });

  return dbOpenPromise;
}

// Safely execute an IDB operation with automatic retry on closed/closing database
async function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => Promise<T>,
  retry = true
): Promise<T | null> {
  try {
    const db = await openDB();
    return await new Promise<T>((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);

        tx.onabort = () => {
          reject(tx.error || new Error('Transaction aborted'));
        };
        tx.onerror = () => {
          reject(tx.error || new Error('Transaction error'));
        };

        operation(store)
          .then((res) => {
            resolve(res);
          })
          .catch(reject);
      } catch (txErr: any) {
        // If database was closing or invalid state, reset cached connection and retry once
        const msg = String(txErr?.message || txErr || '');
        if (
          retry &&
          (msg.includes('closing') || msg.includes('closed') || msg.includes('InvalidStateError'))
        ) {
          closeCachedDB();
          resolve(withStore(mode, operation, false) as any);
        } else {
          reject(txErr);
        }
      }
    });
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    if (
      retry &&
      (msg.includes('closing') || msg.includes('closed') || msg.includes('InvalidStateError'))
    ) {
      closeCachedDB();
      return withStore(mode, operation, false);
    }
    // Suppress expected closing/background warnings silently
    return null;
  }
}

export async function idbSet(key: string, value: any): Promise<void> {
  await withStore('readwrite', (store) => {
    return new Promise<void>((resolve, reject) => {
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
}

export async function idbGet<T = any>(key: string): Promise<T | null> {
  const result = await withStore('readonly', (store) => {
    return new Promise<T | null>((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result !== undefined ? req.result : null);
      req.onerror = () => reject(req.error);
    });
  });
  return result;
}

export async function idbDelete(key: string): Promise<void> {
  await withStore('readwrite', (store) => {
    return new Promise<void>((resolve, reject) => {
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
}

export async function idbGetAllKeys(): Promise<IDBValidKey[]> {
  const result = await withStore('readonly', (store) => {
    return new Promise<IDBValidKey[]>((resolve, reject) => {
      const req = store.getAllKeys();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  });
  return result || [];
}

export async function idbClear(): Promise<void> {
  await withStore('readwrite', (store) => {
    return new Promise<void>((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
}


