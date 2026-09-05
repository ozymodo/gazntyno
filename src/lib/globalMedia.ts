import { collection, deleteDoc, doc, onSnapshot, orderBy, query, setDoc } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { firebaseEnabled, getFirebaseDb, getFirebaseStorage, OWNER_UID } from "@/lib/firebase";
import { generateVideoPoster, type MediaKind } from "@/lib/media";

export type GlobalMediaItem = {
  id: string;
  kind: MediaKind;
  caption: string;
  createdAt: number;
  updatedAt: number;
  posterUrl: string;
  url: string;
  authorUid: string;
  /** Storage paths behind posterUrl/url, so deleteGlobalMedia can remove the exact objects instead of guessing extensions. Same path in both fields for an image (there's no separate poster upload). */
  originalPath: string;
  posterPath: string;
};

const COLLECTION = "media";
const STORAGE_ROOT = "media";

// Same external-store shape as globalBlog.ts - a live Firestore listener
// pushes every visitor the current state of the shared media feed.
let cache: GlobalMediaItem[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

if (typeof window !== "undefined" && firebaseEnabled) {
  const db = getFirebaseDb();
  if (db) {
    const q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
      cache = snapshot.docs.map((d) => d.data() as GlobalMediaItem);
      emit();
    });
  }
}

export function subscribeGlobalMedia(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getGlobalMediaSnapshot(): GlobalMediaItem[] {
  return cache;
}

const EMPTY: GlobalMediaItem[] = [];
export function getServerGlobalMediaSnapshot(): GlobalMediaItem[] {
  return EMPTY;
}

function extensionFor(file: Blob, fallback: string): string {
  const type = file.type.split("/")[1];
  return type ? type.split("+")[0] : fallback;
}

export async function addGlobalMedia(file: File, caption: string): Promise<GlobalMediaItem> {
  const db = getFirebaseDb();
  const storage = getFirebaseStorage();
  if (!db || !storage) throw new Error("The live feed isn't set up on this deploy.");
  if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
    throw new Error("Choose an image or video file.");
  }

  const kind: MediaKind = file.type.startsWith("video/") ? "video" : "image";
  const now = Date.now();
  const id = `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const originalPath = `${STORAGE_ROOT}/${id}/original.${extensionFor(file, "bin")}`;
  await uploadBytes(ref(storage, originalPath), file, { contentType: file.type });
  const url = await getDownloadURL(ref(storage, originalPath));

  let posterUrl = url;
  let posterPath = originalPath;
  if (kind === "video") {
    const posterBlob = await generateVideoPoster(file);
    posterPath = `${STORAGE_ROOT}/${id}/poster.jpg`;
    await uploadBytes(ref(storage, posterPath), posterBlob, { contentType: "image/jpeg" });
    posterUrl = await getDownloadURL(ref(storage, posterPath));
  }

  const item: GlobalMediaItem = {
    id,
    kind,
    caption: caption.trim(),
    createdAt: now,
    updatedAt: now,
    posterUrl,
    url,
    authorUid: OWNER_UID,
    originalPath,
    posterPath,
  };
  // firestore.rules rejects this outright if the signed-in uid isn't
  // OWNER_UID; the uploads above are similarly gated by storage.rules.
  await setDoc(doc(db, COLLECTION, id), item);
  return item;
}

export async function updateGlobalCaption(id: string, caption: string): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;
  const existing = cache.find((i) => i.id === id);
  if (!existing) return;
  await setDoc(doc(db, COLLECTION, id), { ...existing, caption: caption.trim(), updatedAt: Date.now() });
}

export async function deleteGlobalMedia(id: string): Promise<void> {
  const db = getFirebaseDb();
  const storage = getFirebaseStorage();
  if (!db) return;
  const existing = cache.find((i) => i.id === id);
  await deleteDoc(doc(db, COLLECTION, id));
  if (!storage || !existing) return;
  const paths = new Set([existing.originalPath, existing.posterPath]);
  await Promise.allSettled([...paths].map((path) => deleteObject(ref(storage, path))));
}
