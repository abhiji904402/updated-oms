import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase, ref, onValue, set, update, remove, get as rtdbGet, goOffline, goOnline } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyATinl1Ghif41oJfTgens7enNxa3AOytMI",
  authDomain: "broms-734a5.firebaseapp.com",
  databaseURL: "https://broms-734a5-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "broms-734a5",
  storageBucket: "broms-734a5.firebasestorage.app",
  messagingSenderId: "42279120393",
  appId: "1:42279120393:web:8d93964dcbb57a7cc412d8",
  measurementId: "G-J22Z8PHE4D"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);

export const disableNetwork = async () => { goOffline(db); };

// Custom implementations mimicking Firestore API but backed by RTDB

export const collection = (dbInstance: any, path: string) => {
  return path;
};

export const doc = (dbInstance: any, path: string, ...segments: string[]) => {
  if (segments.length > 0) {
    return [path, ...segments].join('/');
  }
  return path;
};

export const query = (colRef: any, ...constraints: any[]) => {
  return {
    isCustomQuery: true,
    path: colRef,
    constraints: constraints
  };
};

export const where = (field: string, op: string, value: any) => {
  return { field, op, value };
};

const filterData = (data: any, constraints: any[]) => {
  if (!data) return false;
  if (!constraints || constraints.length === 0) return true;
  for (const c of constraints) {
    const val = data[c.field];
    if (c.op === '==') {
      if (val !== c.value) return false;
    } else if (c.op === 'in') {
      if (!Array.isArray(c.value) || !c.value.includes(val)) return false;
    }
  }
  return true;
};

export const onSnapshot = (queryObj: any, onNext: (snap: any) => void, onError?: (err: any) => void) => {
  let path = typeof queryObj === 'string' ? queryObj : queryObj.path;
  const constraints = queryObj.constraints || [];
  
  const dbRef = ref(db, path);
  const unsubscribe = onValue(dbRef, (snapshot) => {
    const isDoc = path.split('/').length % 2 === 0;
    
    if (isDoc) {
      onNext({
        exists: () => snapshot.exists(),
        id: snapshot.key,
        data: () => snapshot.val()
      });
    } else {
      const docs: any[] = [];
      snapshot.forEach((childSnap) => {
        const val = childSnap.val();
        if (filterData(val, constraints)) {
          docs.push({
            id: childSnap.key,
            data: () => val,
            ref: `${path}/${childSnap.key}`
          });
        }
      });
      onNext({
        empty: docs.length === 0,
        docs: docs,
        forEach: (cb: any) => docs.forEach(cb),
        metadata: { fromCache: false }
      });
    }
  }, (error) => {
    if (onError) onError(error);
  });
  return unsubscribe;
};

export const setDoc = async (docPath: string, data: any, options?: { merge?: boolean }) => {
  const finalPath = typeof docPath === 'string' ? docPath : (docPath as any).path || String(docPath);
  const dbRef = ref(db, finalPath);
  if (options?.merge) {
    return update(dbRef, data);
  } else {
    return set(dbRef, data);
  }
};

export const deleteDoc = async (docPath: string) => {
  const finalPath = typeof docPath === 'string' ? docPath : (docPath as any).path || String(docPath);
  const dbRef = ref(db, finalPath);
  return remove(dbRef);
};

export const getDocs = async (queryObj: any) => {
  let path = typeof queryObj === 'string' ? queryObj : queryObj.path;
  const constraints = queryObj.constraints || [];
  
  const dbRef = ref(db, path);
  const snapshot = await rtdbGet(dbRef);
  const docs: any[] = [];
  snapshot.forEach((childSnap) => {
    const val = childSnap.val();
    if (filterData(val, constraints)) {
      docs.push({
        id: childSnap.key,
        data: () => val,
        ref: `${path}/${childSnap.key}`
      });
    }
  });
  return {
    empty: docs.length === 0,
    docs: docs,
    forEach: (cb: any) => docs.forEach(cb)
  };
};

export const writeBatch = (dbInstance: any) => {
  const promises: Promise<any>[] = [];
  return {
    set: (docPath: any, data: any, options?: { merge?: boolean }) => {
      const finalPath = typeof docPath === 'string' ? docPath : docPath.ref || String(docPath);
      const dbRef = ref(db, finalPath);
      if (options?.merge) {
        promises.push(update(dbRef, data));
      } else {
        promises.push(set(dbRef, data));
      }
    },
    delete: (docPath: any) => {
      const finalPath = typeof docPath === 'string' ? docPath : docPath.ref || String(docPath);
      const dbRef = ref(db, finalPath);
      promises.push(remove(dbRef));
    },
    commit: async () => {
      await Promise.all(promises);
    }
  };
};
