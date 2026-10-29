/** Minimal promise wrapper over one IndexedDB object store. Values are structured-cloned (CryptoKey included). */
const DB_NAME = "dossierly-vault";
const STORE = "kv";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB unavailable"));
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const req = run(t.objectStore(STORE));
      t.oncomplete = () => resolve(req.result);
      t.onerror = () => reject(t.error ?? new Error("IndexedDB transaction failed"));
      t.onabort = () => reject(t.error ?? new Error("IndexedDB transaction aborted"));
    });
  } finally {
    db.close();
  }
}

export const idbGet = <T>(key: string) => tx<T | undefined>("readonly", (s) => s.get(key) as IDBRequest<T | undefined>);
export const idbSet = (key: string, value: unknown) => tx("readwrite", (s) => s.put(value, key));
export const idbDel = (key: string) => tx("readwrite", (s) => s.delete(key));

export function idbDestroy(): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
}
