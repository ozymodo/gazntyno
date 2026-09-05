export type MediaKind = "image" | "video";

export type MediaItem = {
  id: string;
  kind: MediaKind;
  caption: string;
  createdAt: number;
  updatedAt: number;
  /** Still image for the orb thumbnail — the media itself for images, a captured frame for videos. */
  posterUrl: string;
  /** Full media to show once expanded — same as posterUrl for images. */
  url: string;
};

type MediaRecord = {
  id: string;
  kind: MediaKind;
  caption: string;
  createdAt: number;
  updatedAt: number;
  blob: Blob;
  posterBlob: Blob;
};

const DB_NAME = "technature-media";
const STORE = "items";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = run(tx.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAllRecords(): Promise<MediaRecord[]> {
  return withStore("readonly", (store) => store.getAll());
}

function getRecord(id: string): Promise<MediaRecord | undefined> {
  return withStore("readonly", (store) => store.get(id));
}

function putRecord(record: MediaRecord): Promise<void> {
  return withStore("readwrite", (store) => store.put(record)).then(() => undefined);
}

function deleteRecord(id: string): Promise<void> {
  return withStore("readwrite", (store) => store.delete(id)).then(() => undefined);
}

// Captures a frame partway into the video as a JPEG blob, so video orbs get
// a still thumbnail instead of every clip auto-playing at once in the field.
function generateVideoPoster(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;

    const cleanup = () => URL.revokeObjectURL(objectUrl);

    video.addEventListener("loadeddata", () => {
      video.currentTime = Math.min(0.5, (video.duration || 1) / 4);
    });
    video.addEventListener("seeked", () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 320;
      canvas.height = video.videoHeight || 180;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        cleanup();
        reject(new Error("This browser can't generate a video preview."));
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          cleanup();
          if (blob) resolve(blob);
          else reject(new Error("Couldn't capture a preview frame from that video."));
        },
        "image/jpeg",
        0.82,
      );
    });
    video.addEventListener("error", () => {
      cleanup();
      reject(new Error("Couldn't read that video file."));
    });
  });
}

// Media lives in IndexedDB (blobs, not base64 — cheaper and roomier than
// localStorage), mirrored through a tiny external-store cache so components
// read it with useSyncExternalStore. The cache holds object URLs, which is
// why every mutation goes through here rather than touching the DB directly.
let cache: MediaItem[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function sortItems(items: MediaItem[]) {
  return [...items].sort((a, b) => b.createdAt - a.createdAt);
}

function toItem(record: MediaRecord): MediaItem {
  const posterUrl = URL.createObjectURL(record.posterBlob);
  const url = record.kind === "image" ? posterUrl : URL.createObjectURL(record.blob);
  return {
    id: record.id,
    kind: record.kind,
    caption: record.caption,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    posterUrl,
    url,
  };
}

function revokeItem(item: MediaItem) {
  URL.revokeObjectURL(item.posterUrl);
  if (item.url !== item.posterUrl) URL.revokeObjectURL(item.url);
}

async function loadAll() {
  try {
    const records = await getAllRecords();
    cache = sortItems(records.map(toItem));
  } catch {
    cache = [];
  }
  emit();
}

if (typeof window !== "undefined" && "indexedDB" in window) {
  loadAll();
}

export function subscribeMedia(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getMediaSnapshot(): MediaItem[] {
  return cache;
}

const EMPTY: MediaItem[] = [];
export function getServerMediaSnapshot(): MediaItem[] {
  return EMPTY;
}

export async function addMedia(file: File, caption: string): Promise<MediaItem> {
  if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
    throw new Error("Choose an image or video file.");
  }
  const kind: MediaKind = file.type.startsWith("video/") ? "video" : "image";
  const posterBlob = kind === "video" ? await generateVideoPoster(file) : file;
  const now = Date.now();
  const record: MediaRecord = {
    id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    caption: caption.trim(),
    createdAt: now,
    updatedAt: now,
    blob: file,
    posterBlob,
  };
  await putRecord(record);
  const item = toItem(record);
  cache = sortItems([...cache, item]);
  emit();
  return item;
}

export async function updateCaption(id: string, caption: string): Promise<void> {
  const record = await getRecord(id);
  if (!record) return;
  const updated: MediaRecord = { ...record, caption: caption.trim(), updatedAt: Date.now() };
  await putRecord(updated);
  cache = cache.map((item) =>
    item.id === id ? { ...item, caption: updated.caption, updatedAt: updated.updatedAt } : item,
  );
  emit();
}

export async function deleteMedia(id: string): Promise<void> {
  await deleteRecord(id);
  const item = cache.find((i) => i.id === id);
  if (item) revokeItem(item);
  cache = cache.filter((i) => i.id !== id);
  emit();
}
