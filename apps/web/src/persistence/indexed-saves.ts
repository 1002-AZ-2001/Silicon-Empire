import { decodeSave } from './save-data';
import type { SaveRecord } from './save-data';

const DATABASE = 'silicon-empire';
const STORE = 'workshops';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    let blocked = false;

    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      blocked = true;
      reject(new Error('IndexedDB est bloqué par un autre onglet.'));
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      if (blocked) db.close();
      else resolve(db);
    };
  });
}

async function runTransaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = operation(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error ?? new Error('Transaction IndexedDB annulée.'));
    });
  } finally {
    db.close();
  }
}

export async function listSaves(): Promise<{ saves: SaveRecord[]; unreadable: number }> {
  const records: unknown[] = await runTransaction('readonly', store => store.getAll());
  const saves = records.map(decodeSave).filter(record => record !== null);
  saves.sort((first, second) => second.savedAt - first.savedAt || first.id.localeCompare(second.id));
  return { saves, unreadable: records.length - saves.length };
}

export async function loadSave(id: string): Promise<SaveRecord | null> {
  const data: unknown = await runTransaction('readonly', store => store.get(id));
  return decodeSave(data);
}

export async function writeSave(record: SaveRecord): Promise<void> {
  const data = decodeSave(record);
  if (!data) throw new Error('Sauvegarde invalide.');
  await runTransaction('readwrite', store => store.put(data));
}

export async function removeSave(id: string): Promise<void> {
  await runTransaction('readwrite', store => store.delete(id));
}
