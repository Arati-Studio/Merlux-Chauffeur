import { initializeApp } from 'firebase/app';
import { 
  initializeFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  limit, 
  writeBatch, 
  serverTimestamp, 
  Timestamp 
} from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

// Load config from firebase-applet-config.json
let config: any = {};
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
} catch (err) {
  console.error('[ClientDbAdapter] Error reading firebase-applet-config.json:', err);
}

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || config.apiKey,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || config.authDomain,
  projectId: config.projectId || process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: config.storageBucket || process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: config.messagingSenderId || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: config.appId || process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, config.firestoreDatabaseId || process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || undefined);

class DocRefWrapper {
  constructor(public rawDocRef: any) {
    this.ref = this;
  }
  get ref() { return this; }
  set ref(v) {}

  async get() {
    const snap = await getDoc(this.rawDocRef);
    return new DocSnapWrapper(snap);
  }

  async set(data: any) {
    const cleanData = replaceFieldValues(data);
    await setDoc(this.rawDocRef, cleanData);
  }

  async update(data: any) {
    const cleanData = replaceFieldValues(data);
    await updateDoc(this.rawDocRef, cleanData);
  }

  async delete() {
    await deleteDoc(this.rawDocRef);
  }
}

class DocSnapWrapper {
  constructor(private snap: any) {}
  get id() { return this.snap.id; }
  get exists() { return this.snap.exists(); }
  data() { return this.snap.data(); }
  get ref() { return new DocRefWrapper(this.snap.ref); }
}

class QuerySnapWrapper {
  constructor(private snap: any) {
    this.docs = snap.docs.map((d: any) => new DocSnapWrapper(d));
    this.size = snap.size;
    this.empty = snap.empty;
  }
  docs: DocSnapWrapper[];
  size: number;
  empty: boolean;

  forEach(callback: (doc: DocSnapWrapper) => void) {
    this.docs.forEach(callback);
  }
}

class QueryWrapper {
  constructor(private pathStr: string, private constraints: any[] = []) {}

  where(field: string, op: string, val: any) {
    return new QueryWrapper(this.pathStr, [...this.constraints, where(field, op as any, val)]);
  }

  limit(n: number) {
    return new QueryWrapper(this.pathStr, [...this.constraints, limit(n)]);
  }

  async get() {
    const collRef = collection(db, this.pathStr);
    const q = query(collRef, ...this.constraints);
    const snap = await getDocs(q);
    return new QuerySnapWrapper(snap);
  }

  doc(id: string) {
    if (this.constraints.length > 0) {
      throw new Error("Cannot call doc() on a query");
    }
    const docRef = doc(db, this.pathStr, id);
    return new DocRefWrapper(docRef);
  }
}

class BatchWrapper {
  private batch = writeBatch(db);

  delete(docRefWrapper: DocRefWrapper) {
    this.batch.delete(docRefWrapper.rawDocRef);
    return this;
  }

  set(docRefWrapper: DocRefWrapper, data: any) {
    this.batch.set(docRefWrapper.rawDocRef, replaceFieldValues(data));
    return this;
  }

  update(docRefWrapper: DocRefWrapper, data: any) {
    this.batch.update(docRefWrapper.rawDocRef, replaceFieldValues(data));
    return this;
  }

  async commit() {
    await this.batch.commit();
  }
}

function replaceFieldValues(obj: any): any {
  if (!obj) return obj;
  if (typeof obj !== 'object') return obj;
  
  if (obj._methodName === 'FieldValue.serverTimestamp' || (obj.constructor && obj.constructor.name === 'FieldValue')) {
    return serverTimestamp();
  }

  const result: any = Array.isArray(obj) ? [] : {};
  for (const [key, val] of Object.entries(obj)) {
    if (val && typeof val === 'object' && (val as any)._methodName === 'FieldValue.serverTimestamp') {
      result[key] = serverTimestamp();
    } else {
      result[key] = replaceFieldValues(val);
    }
  }
  return result;
}

export const dbAdminClient = {
  collection(path: string) {
    return new QueryWrapper(path);
  },
  batch() {
    return new BatchWrapper();
  }
};
