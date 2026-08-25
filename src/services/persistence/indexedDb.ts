const DATABASE_NAME = 'pixavelo-local';
const DATABASE_VERSION = 1;

export const STORE_NAMES = {
  recentJobs: 'recent-jobs',
  presets: 'presets'
} as const;

export type StoreName = (typeof STORE_NAMES)[keyof typeof STORE_NAMES];

let databasePromise: Promise<IDBDatabase> | undefined;

export function openPixaveloDatabase(): Promise<IDBDatabase> {
  databasePromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE_NAMES.recentJobs)) {
        database.createObjectStore(STORE_NAMES.recentJobs, { keyPath: 'id' });
      }

      if (!database.objectStoreNames.contains(STORE_NAMES.presets)) {
        database.createObjectStore(STORE_NAMES.presets, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open local storage.'));
    request.onblocked = () => reject(new Error('Local storage upgrade is blocked by another tab.'));
  });

  return databasePromise;
}

export async function putLocalRecord(storeName: StoreName, record: unknown): Promise<void> {
  const database = await openPixaveloDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).put(record);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Local write failed.'));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('Local write was cancelled.'));
  });
}

export async function getAllLocalRecords<T>(storeName: StoreName): Promise<T[]> {
  const database = await openPixaveloDatabase();

  return new Promise<T[]>((resolve, reject) => {
    const request = database.transaction(storeName, 'readonly').objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error ?? new Error('Local read failed.'));
  });
}
