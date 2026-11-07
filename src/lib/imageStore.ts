/**
 * Kvitteringsbilleder gemmes i IndexedDB (localStorage er for lille til billeder).
 * Falder tilbage til hukommelsen, hvis IndexedDB ikke er tilgængeligt.
 */

const DB_NAME = 'kroner-billeder';
const STORE = 'billeder';
const memory = new Map<string, string>();
let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
  return dbPromise;
}

export async function saveImage(id: string, dataUrl: string): Promise<void> {
  memory.set(id, dataUrl);
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(dataUrl, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  }).catch(() => undefined);
}

export async function getImage(id: string): Promise<string | undefined> {
  if (memory.has(id)) return memory.get(id);
  const db = await openDb();
  if (!db) return undefined;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get(id);
    request.onsuccess = () => {
      const value = request.result as string | undefined;
      if (value) memory.set(id, value);
      resolve(value);
    };
    request.onerror = () => resolve(undefined);
  });
}

export async function deleteImage(id: string): Promise<void> {
  memory.delete(id);
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  }).catch(() => undefined);
}

export async function clearImages(): Promise<void> {
  memory.clear();
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  }).catch(() => undefined);
}
