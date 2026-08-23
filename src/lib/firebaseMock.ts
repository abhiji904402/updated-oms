const API_BASE = '/api';

export const db = {};

// Simple latency compensation cache
const pendingWrites = new Map<string, { timestamp: number, data: any | null }>();

export function doc(db: any, collection: string, id: string) {
  return { collection, id };
}

export function collection(db: any, name: string) {
  return { collection: name };
}

export async function setDoc(docRef: { collection: string, id: string }, data: any, options?: any) {
  const method = options?.merge ? 'PUT' : 'POST';
  const url = `${API_BASE}/${docRef.collection}/${docRef.id}`;
  
  const cacheKey = `${docRef.collection}/${docRef.id}`;
  pendingWrites.set(cacheKey, { data, timestamp: Date.now() });

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    setTimeout(() => {
      pendingWrites.delete(cacheKey);
    }, 30000);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`API error ${res.status}: ${res.statusText} - ${text}`);
    }
  } catch (e) {
    pendingWrites.delete(cacheKey);
    throw e;
  }
}

export async function deleteDoc(docRef: { collection: string, id: string }) {
  const cacheKey = `${docRef.collection}/${docRef.id}`;
  pendingWrites.set(cacheKey, { data: null, timestamp: Date.now() });

  try {
    const res = await fetch(`${API_BASE}/${docRef.collection}/${docRef.id}`, { method: 'DELETE' });
    
    setTimeout(() => {
      pendingWrites.delete(cacheKey);
    }, 30000);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`API error ${res.status}: ${res.statusText} - ${text}`);
    }
  } catch (e) {
    pendingWrites.delete(cacheKey);
    throw e;
  }
}

export async function getDocs(collRef: { collection: string }) {
  const res = await fetch(`${API_BASE}/${collRef.collection}`);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${res.statusText} - ${text}`);
  }
  const data = await res.json();
  const docs = data.map((d: any) => ({
    id: d.id || d._id,
    ref: { collection: collRef.collection, id: d.id || d._id },
    data: () => d
  }));
  return {
    docs,
    size: docs.length,
    empty: docs.length === 0,
    forEach: (cb: any) => docs.forEach(cb)
  };
}

export function writeBatch(db: any) {
  const operations: any[] = [];
  return {
    set: (docRef: any, data: any, options?: any) => {
      operations.push({ action: 'set', collection: docRef.collection, id: docRef.id, data, options });
    },
    delete: (docRef: any) => {
      operations.push({ action: 'delete', collection: docRef.collection, id: docRef.id });
    },
    commit: async () => {
      const promises = operations.map(op => {
         if (op.action === 'set') {
           return setDoc({collection: op.collection, id: op.id}, op.data, op.options).catch(e => console.error(e));
         }
         else if (op.action === 'delete') {
           return deleteDoc({collection: op.collection, id: op.id}).catch(e => console.error(e));
         }
         return Promise.resolve();
      });
      await Promise.all(promises);
    }
  };
}

export function disableNetwork() {
  return Promise.resolve();
}

export function onSnapshot(ref: any, callback: any, onError?: any) {
  let isCancelled = false;
  
  const poll = async () => {
    if (isCancelled) return;
    try {
      const timestamp = new Date().getTime();
      if (ref.id) {
         const res = await fetch(`${API_BASE}/${ref.collection}/${ref.id}?t=${timestamp}`, {
           headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
         });
         if (res.ok) {
           let data = await res.json();
           const cacheKey = `${ref.collection}/${ref.id}`;
           const pending = pendingWrites.get(cacheKey);
           if (pending) {
             if (pending.data === null) {
               data = null;
             } else {
               data = { ...data, ...pending.data };
             }
           }
           callback({ id: ref.id, exists: () => (data && Object.keys(data).length > 0), data: () => data });
         }
      } else {
         const res = await fetch(`${API_BASE}/${ref.collection}?t=${timestamp}`, {
           headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
         });
         if (res.ok) {
           const data = await res.json();
           
           // Latency compensation
           const mergedData = data.filter((d: any) => {
               const cacheKey = `${ref.collection}/${d.id || d._id}`;
               const pending = pendingWrites.get(cacheKey);
               return !(pending && pending.data === null);
           }).map((d: any) => {
               const cacheKey = `${ref.collection}/${d.id || d._id}`;
               const pending = pendingWrites.get(cacheKey);
               return pending ? { ...d, ...pending.data } : d;
           });

           const serverIds = new Set(mergedData.map((d: any) => d.id || d._id));
           for (const [key, pending] of pendingWrites.entries()) {
               if (key.startsWith(`${ref.collection}/`) && pending.data !== null) {
                   const id = key.split('/')[1];
                   if (!serverIds.has(id)) {
                       mergedData.push(pending.data);
                   }
               }
           }

           const docs = mergedData.map((d: any) => ({
             id: d.id || d._id,
             ref: { collection: ref.collection, id: d.id || d._id },
             data: () => d
           }));
           
           callback({
             docs,
             size: docs.length,
             empty: docs.length === 0,
             metadata: { fromCache: false },
             forEach: (cb: any) => docs.forEach(cb)
           });
         }
      }
    } catch(e: any) {
      if (e.message !== 'Failed to fetch') {
         console.warn("Polling error:", e);
      }
      if (onError) onError(e);
    }
    if (!isCancelled) setTimeout(poll, 1500);
  };
  poll();
  return () => { isCancelled = true; };
}
