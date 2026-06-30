import { 
  collection, 
  getDocs, 
  getDoc, 
  doc, 
  query, 
  Query, 
  DocumentReference,
  DocumentData,
  QuerySnapshot
} from 'firebase/firestore';

const CACHE_KEY_PREFIX = 'fs_cache_';
const CACHE_TTL = 1000 * 60 * 15; // 15 minutes default

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export async function getCachedDoc(docRef: DocumentReference): Promise<DocumentData | null> {
  const cacheKey = `${CACHE_KEY_PREFIX}doc_${docRef.path}`;
  const cached = sessionStorage.getItem(cacheKey);
  
  if (cached) {
    const entry: CacheEntry<any> = JSON.parse(cached);
    if (Date.now() - entry.timestamp < CACHE_TTL) {
      return entry.data;
    }
  }

  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      sessionStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
      return data;
    }
    return null;
  } catch (err) {
    // If it fails (e.g. quota), try returning expired cache if it exists
    if (cached) {
      const entry: CacheEntry<any> = JSON.parse(cached);
      return entry.data;
    }
    console.warn(`Firestore getCachedDoc failed for path: ${docRef.path}. Returning null to prevent app crash.`, err);
    return null;
  }
}

export async function getCachedDocs(q: Query, cacheId: string): Promise<any[]> {
  const cacheKey = `${CACHE_KEY_PREFIX}query_${cacheId}`;
  const cached = sessionStorage.getItem(cacheKey);

  if (cached) {
    const entry: CacheEntry<any[]> = JSON.parse(cached);
    if (Date.now() - entry.timestamp < CACHE_TTL) {
      return entry.data;
    }
  }

  try {
    const snap = await getDocs(q);
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    sessionStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
    return data;
  } catch (err) {
    if (cached) {
      const entry: CacheEntry<any[]> = JSON.parse(cached);
      return entry.data;
    }
    console.warn(`Firestore getCachedDocs failed for cacheId: ${cacheId}. Returning empty array to prevent app crash.`, err);
    return [];
  }
}

export function clearFsCache() {
  Object.keys(sessionStorage).forEach(key => {
    if (key.startsWith(CACHE_KEY_PREFIX)) {
      sessionStorage.removeItem(key);
    }
  });
}
