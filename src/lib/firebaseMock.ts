const API_BASE = '/api';

export const db = {};

export function doc(db: any, collection: string, id: string) {
  return { collection, id };
}

export function collection(db: any, name: string) {
  return { collection: name };
}

// In-Memory Client Collection Cache for Instant 0ms Sync
const clientStore: Record<string, Map<string, any>> = {
  'orders': new Map(),
  'delivery_partners': new Map(),
  'outlet_locations': new Map(),
  'system_settings': new Map()
};

// Registered onSnapshot listeners
type SnapshotListener = {
  id: string;
  ref: { collection: string; id?: string };
  callback: (snapshot: any) => void;
  onError?: (err: any) => void;
};

const listeners = new Set<SnapshotListener>();

// Debounced collection notification to avoid UI jitter/flicker during rapid stream updates
const pendingNotificationTimers: Record<string, any> = {};

function notifyListenersForCollection(collName: string, immediate = false) {
  const fireNotification = () => {
    delete pendingNotificationTimers[collName];
    const collMap = clientStore[collName] || new Map();
    const items = Array.from(collMap.values());
    const docs = items.map((d: any) => ({
      id: d.id || d._id,
      ref: { collection: collName, id: d.id || d._id },
      data: () => d
    }));

    const snapshot = {
      docs,
      size: docs.length,
      empty: docs.length === 0,
      metadata: { fromCache: false },
      forEach: (cb: any) => docs.forEach(cb)
    };

    for (const l of listeners) {
      if (l.ref.collection === collName && !l.ref.id) {
        try {
          l.callback(snapshot);
        } catch (err) {
          console.error('Error in onSnapshot collection listener:', err);
        }
      }
    }
  };

  if (immediate) {
    if (pendingNotificationTimers[collName]) {
      clearTimeout(pendingNotificationTimers[collName]);
      delete pendingNotificationTimers[collName];
    }
    fireNotification();
  } else {
    if (!pendingNotificationTimers[collName]) {
      pendingNotificationTimers[collName] = setTimeout(fireNotification, 50);
    }
  }
}

function notifyListenersForDoc(collName: string, docId: string) {
  const collMap = clientStore[collName] || new Map();
  const docData = collMap.get(docId);

  const snapshot = {
    id: docId,
    exists: () => (docData && Object.keys(docData).length > 0),
    data: () => docData || {}
  };

  for (const l of listeners) {
    if (l.ref.collection === collName && l.ref.id === docId) {
      try {
        l.callback(snapshot);
      } catch (err) {
        console.error('Error in onSnapshot doc listener:', err);
      }
    }
  }
}

// Cross-tab Synchronization Broadcast Channel (0ms cross-tab latency on same device)
let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel('broomies_live_channel');
    broadcastChannel.onmessage = (event) => {
      if (event.data && event.data.type === 'mutation') {
        handleIncomingMutation(event.data.mutation, false);
      }
    };
  }
} catch (e) {
  console.warn('BroadcastChannel not supported:', e);
}

function handleIncomingMutation(
  mutation: { collection: string; action: 'set' | 'update' | 'delete' | 'clear'; id?: string; data?: any },
  broadcastToOtherTabs = true
) {
  const { collection, action, id, data } = mutation;
  if (!clientStore[collection]) {
    clientStore[collection] = new Map();
  }
  const store = clientStore[collection];

  if (action === 'clear') {
    store.clear();
    notifyListenersForCollection(collection, true);
  } else if (action === 'delete' && id) {
    store.delete(id);
    notifyListenersForDoc(collection, id);
    notifyListenersForCollection(collection);
  } else if ((action === 'set' || action === 'update') && id && data) {
    const existing = store.get(id) || {};
    const merged = action === 'update' ? { ...existing, ...data } : data;
    store.set(id, merged);
    notifyListenersForDoc(collection, id);
    notifyListenersForCollection(collection);
  }

  if (broadcastToOtherTabs && broadcastChannel) {
    try {
      broadcastChannel.postMessage({ type: 'mutation', mutation });
    } catch {}
  }
}

// =========================================================================
// REAL-TIME SERVER-SENT EVENTS (SSE) ENGINE
// =========================================================================

let eventSource: EventSource | null = null;
let isConnectingSSE = false;
let sseReconnectTimer: any = null;
let lastSSEActivityTime = Date.now();

export function refreshCollectionFromServer(collName: string) {
  if (typeof window === 'undefined') return;
  fetch(`${API_BASE}/${collName}`)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((data) => {
      const items = Array.isArray(data) ? data : [];
      if (items.length === 0) return; // Never wipe out data with empty responses

      if (!clientStore[collName]) {
        clientStore[collName] = new Map();
      }
      const store = clientStore[collName];
      // Atomic swap to prevent empty flashes
      const newMap = new Map<string, any>();
      items.forEach((item: any) => {
        const key = String(item.id || item._id);
        if (key) newMap.set(key, item);
      });
      clientStore[collName] = newMap;
      notifyListenersForCollection(collName, true);
    })
    .catch((err) => {
      console.warn(`[Sync] Background refresh for ${collName} skipped:`, err.message);
    });
}

function initSSE() {
  if (typeof window === 'undefined' || !('EventSource' in window)) return;
  if (eventSource && (eventSource.readyState === EventSource.OPEN || eventSource.readyState === EventSource.CONNECTING)) {
    return;
  }
  if (isConnectingSSE) return;

  isConnectingSSE = true;

  try {
    if (eventSource) {
      try { eventSource.close(); } catch {}
      eventSource = null;
    }

    eventSource = new EventSource(`${API_BASE}/events`);

    eventSource.addEventListener('connected', () => {
      isConnectingSSE = false;
      lastSSEActivityTime = Date.now();
    });

    eventSource.addEventListener('heartbeat', () => {
      lastSSEActivityTime = Date.now();
    });

    eventSource.addEventListener('mutation', (e) => {
      lastSSEActivityTime = Date.now();
      try {
        const mutation = JSON.parse(e.data);
        handleIncomingMutation(mutation, true);
      } catch (err) {
        console.error('Error parsing SSE mutation:', err);
      }
    });

    eventSource.onopen = () => {
      isConnectingSSE = false;
      lastSSEActivityTime = Date.now();
    };

    eventSource.onerror = () => {
      isConnectingSSE = false;
      if (eventSource) {
        try { eventSource.close(); } catch {}
        eventSource = null;
      }
      if (!sseReconnectTimer) {
        sseReconnectTimer = setTimeout(() => {
          sseReconnectTimer = null;
          initSSE();
        }, 3000);
      }
    };
  } catch (err) {
    isConnectingSSE = false;
    if (!sseReconnectTimer) {
      sseReconnectTimer = setTimeout(() => {
        sseReconnectTimer = null;
        initSSE();
      }, 5000);
    }
  }
}

// Lifecycle listeners for Mobile / Multi-Tab Wakeup
if (typeof window !== 'undefined') {
  initSSE();

  // Instant recovery when user switches back to tab or unlocks phone
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      initSSE();
    }
  });

  window.addEventListener('focus', () => {
    initSSE();
  });

  window.addEventListener('online', () => {
    initSSE();
    refreshCollectionFromServer('orders');
  });

  // Watchdog timer: only re-establishes SSE if connection was genuinely dead for over 45s
  setInterval(() => {
    const isDead = Date.now() - lastSSEActivityTime > 45000;
    if (isDead || !eventSource || eventSource.readyState === EventSource.CLOSED) {
      initSSE();
    }
  }, 15000);
}

export async function setDoc(docRef: { collection: string; id: string }, data: any, options?: any) {
  const method = options?.merge ? 'PUT' : 'POST';
  const url = `${API_BASE}/${docRef.collection}/${docRef.id}`;

  // Optimistic 0ms local mutation on current device
  handleIncomingMutation({
    collection: docRef.collection,
    action: options?.merge ? 'update' : 'set',
    id: docRef.id,
    data
  }, true);

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

export async function deleteDoc(docRef: { collection: string; id: string }) {
  // Optimistic 0ms local deletion
  handleIncomingMutation({
    collection: docRef.collection,
    action: 'delete',
    id: docRef.id
  }, true);

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
  const list = Array.isArray(data) ? data : [];

  // Update client collection cache atomically
  const newMap = new Map<string, any>();
  list.forEach((item: any) => {
    const key = String(item.id || item._id);
    if (key) newMap.set(key, item);
  });
  clientStore[collRef.collection] = newMap;

  const docs = list.map((d: any) => ({
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
      const chunks: any[][] = [];
      for (let i = 0; i < operations.length; i += 25) {
        chunks.push(operations.slice(i, i + 25));
      }

      for (const chunk of chunks) {
        await Promise.allSettled(
          chunk.map((op) => {
            if (op.action === 'set') {
              return setDoc({ collection: op.collection, id: op.id }, op.data, op.options);
            } else if (op.action === 'delete') {
              return deleteDoc({ collection: op.collection, id: op.id });
            }
            return Promise.resolve();
          })
        );
      }
    }
  };
}

export function disableNetwork() {
  return Promise.resolve();
}

export function onSnapshot(ref: any, callback: any, onError?: any) {
  const listener: SnapshotListener = {
    id: `listener-${Date.now()}-${Math.random()}`,
    ref,
    callback,
    onError
  };
  listeners.add(listener);

  // Make sure SSE is alive
  initSSE();

  const collName = ref.collection;
  const collStore = clientStore[collName] || (clientStore[collName] = new Map());

  if (ref.id) {
    const existing = collStore.get(ref.id);
    if (existing) {
      callback({
        id: ref.id,
        exists: () => true,
        data: () => existing
      });
    }

    fetch(`${API_BASE}/${collName}/${ref.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && (data.id || data._id)) {
          collStore.set(ref.id, data);
          callback({
            id: ref.id,
            exists: () => true,
            data: () => data
          });
        }
      })
      .catch((err) => {
        if (onError) onError(err);
      });
  } else {
    // If we already have items in client RAM, give instant 0ms snapshot
    if (collStore.size > 0) {
      const items = Array.from(collStore.values());
      const docs = items.map((d: any) => ({
        id: d.id || d._id,
        ref: { collection: collName, id: d.id || d._id },
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

    // Fetch initial dataset from server
    fetch(`${API_BASE}/${collName}`)
      .then((res) => res.json())
      .then((data) => {
        const items = Array.isArray(data) ? data : [];
        if (items.length > 0) {
          const newMap = new Map<string, any>();
          items.forEach((item: any) => {
            const key = String(item.id || item._id);
            if (key) newMap.set(key, item);
          });
          clientStore[collName] = newMap;

          const docs = items.map((d: any) => ({
            id: d.id || d._id,
            ref: { collection: collName, id: d.id || d._id },
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
      })
      .catch((err) => {
        if (onError) onError(err);
      });
  }

  // Return unsubscribe function
  return () => {
    listeners.delete(listener);
  };
}
