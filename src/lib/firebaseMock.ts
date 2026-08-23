const API_BASE = '/api';

export const db = {};

export function doc(db: any, collection: string, id: string) {
  return { collection, id };
}

export function collection(db: any, name: string) {
  return { collection: name };
}

export async function setDoc(docRef: { collection: string, id: string }, data: any, options?: any) {
  const method = options?.merge ? 'PUT' : 'POST';
  const url = `${API_BASE}/${docRef.collection}/${docRef.id}`;
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${res.statusText} - ${text}`);
  }
}

export async function deleteDoc(docRef: { collection: string, id: string }) {
  const res = await fetch(`${API_BASE}/${docRef.collection}/${docRef.id}`, { method: 'DELETE' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${res.statusText} - ${text}`);
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
           const data = await res.json();
           callback({ id: ref.id, exists: () => (data && Object.keys(data).length > 0), data: () => data });
         }
      } else {
         const res = await fetch(`${API_BASE}/${ref.collection}?t=${timestamp}`, {
           headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
         });
         if (res.ok) {
           const data = await res.json();
           const docs = data.map((d: any) => ({
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
      // Suppress network errors during polling (e.g., when dev server restarts)
      if (e.message !== 'Failed to fetch') {
         console.warn("Polling error:", e);
      }
      if (onError) onError(e);
    }
    if (!isCancelled) setTimeout(poll, 1500); // 1.5 seconds for near real-time sync without caching issues
  };
  poll();
  return () => { isCancelled = true; };
}
