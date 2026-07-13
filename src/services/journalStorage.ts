import type { JournalEntry, SmartRoute } from '../types/route';

const DB = 'chuyou-journal';
const STORE = 'photos';
const META = 'chuyou-journal-entries';
const ROUTE_META = 'chuyou-last-smart-route';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function savePhoto(file: Blob) {
  const id = `${Date.now()}-${crypto.randomUUID()}`;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(file, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return id;
}

export async function compressPhoto(file: File, onProgress?: (progress: number) => void): Promise<Blob> {
  if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name} 超过 10MB 原图上限。`);
  onProgress?.(10);
  const bitmap = await createImageBitmap(file);
  onProgress?.(35);
  const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('浏览器无法创建图片压缩画布。');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  onProgress?.(70);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82));
  if (!blob) throw new Error('图片压缩失败。');
  onProgress?.(100);
  return blob;
}

export async function loadPhoto(id: string) {
  const db = await openDb();
  const result = await new Promise<Blob | undefined>((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return result;
}

export async function deletePhoto(id: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export function readEntries(): JournalEntry[] {
  try { return JSON.parse(localStorage.getItem(META) ?? '[]'); } catch { return []; }
}

export function writeEntries(entries: JournalEntry[]) {
  localStorage.setItem(META, JSON.stringify(entries));
  window.dispatchEvent(new Event('journal-change'));
}

export function readLastRoute(): SmartRoute | null {
  try { return JSON.parse(localStorage.getItem(ROUTE_META) ?? 'null'); } catch { return null; }
}

export function writeLastRoute(route: SmartRoute) {
  localStorage.setItem(ROUTE_META, JSON.stringify(route));
}

export async function clearJournal(entries: JournalEntry[]) {
  await Promise.all(entries.flatMap((entry) => entry.photoIds).map(deletePhoto));
  writeEntries([]);
}
