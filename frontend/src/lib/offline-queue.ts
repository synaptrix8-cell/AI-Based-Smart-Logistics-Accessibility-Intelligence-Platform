/**
 * IndexedDB Offline Report Queue & Store-and-Forward Engine
 * 
 * Automatically queues field reports when offline in remote NER mountain valleys.
 * Syncs with Supabase once network connectivity is restored.
 */

export interface QueuedReport {
  id: string; // client-generated local UUID
  category: "landslide" | "flood" | "road_damage" | "congestion" | "other";
  segment_id?: string;
  corridor_name?: string;
  lat: number;
  lng: number;
  severity: number; // 1 to 5
  description: string;
  encrypted_payload?: string;
  iv?: string;
  photo_base64?: string;
  created_at: string;
  synced?: boolean;
}

const DB_NAME = "setu_offline_db";
const STORE_NAME = "pending_reports";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB not supported"));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save a report into local IndexedDB
 */
export async function saveOfflineReport(report: QueuedReport): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(report);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("Falling back to localStorage for offline report:", err);
    if (typeof window !== "undefined") {
      const existing: QueuedReport[] = JSON.parse(
        localStorage.getItem("setu_fallback_reports") || "[]"
      );
      existing.push(report);
      localStorage.setItem("setu_fallback_reports", JSON.stringify(existing));
    }
  }
}

/**
 * Get all pending reports in the offline queue
 */
export async function getPendingReports(): Promise<QueuedReport[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("Reading from localStorage fallback:", err);
    if (typeof window !== "undefined") {
      return JSON.parse(localStorage.getItem("setu_fallback_reports") || "[]");
    }
    return [];
  }
}

/**
 * Remove a successfully synced report
 */
export async function removeOfflineReport(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    if (typeof window !== "undefined") {
      const existing: QueuedReport[] = JSON.parse(
        localStorage.getItem("setu_fallback_reports") || "[]"
      );
      const updated = existing.filter((r) => r.id !== id);
      localStorage.setItem("setu_fallback_reports", JSON.stringify(updated));
    }
  }
}

/**
 * Format a 160-character ultra-compact SMS payload for emergency low-connectivity transmission
 * Example: "SETU LANDSLIDE SH-5 25.298 91.582 SEV4 Boulders blocking corridor"
 */
export function formatReportSMS(report: QueuedReport): string {
  const cat = report.category.toUpperCase().slice(0, 9);
  const corridor = (report.corridor_name || "UNKNOWN").slice(0, 10);
  const lat = report.lat.toFixed(4);
  const lng = report.lng.toFixed(4);
  const sev = `SEV${report.severity}`;
  const desc = report.description.slice(0, 80).replace(/[^a-zA-Z0-9 ]/g, " ");

  return `SETU ${cat} ${corridor} ${lat} ${lng} ${sev} ${desc}`.trim();
}
