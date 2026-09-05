import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import { firebaseEnabled, getFirebaseDb, OWNER_UID } from "@/lib/firebase";

export type GlobalBlogPost = {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
  authorUid: string;
};

const COLLECTION = "posts";

// Same external-store shape as blog.ts, fed by a live Firestore listener
// instead of localStorage - every visitor's tab that has this module loaded
// gets pushed new/edited/deleted posts the moment they land in Firestore,
// with no refresh and no polling.
let cache: GlobalBlogPost[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

if (typeof window !== "undefined" && firebaseEnabled) {
  const db = getFirebaseDb();
  if (db) {
    const q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
      cache = snapshot.docs.map((d) => d.data() as GlobalBlogPost);
      emit();
    });
  }
}

export function subscribeGlobalPosts(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getGlobalPostsSnapshot(): GlobalBlogPost[] {
  return cache;
}

const EMPTY: GlobalBlogPost[] = [];
export function getServerGlobalPostsSnapshot(): GlobalBlogPost[] {
  return EMPTY;
}

export async function saveGlobalPost(input: { id?: string; title: string; body: string }): Promise<GlobalBlogPost> {
  const db = getFirebaseDb();
  if (!db) throw new Error("The live feed isn't set up on this deploy.");
  const now = Date.now();
  const existing = input.id ? cache.find((p) => p.id === input.id) : undefined;
  const post: GlobalBlogPost = {
    id: input.id ?? `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    title: input.title.trim() || "Untitled",
    body: input.body,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    authorUid: OWNER_UID,
  };
  // firestore.rules rejects this write outright if the signed-in uid isn't
  // OWNER_UID - this just avoids a doomed round-trip for anyone else.
  await setDoc(doc(db, COLLECTION, post.id), post);
  return post;
}

export async function deleteGlobalPost(id: string): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;
  await deleteDoc(doc(db, COLLECTION, id));
}
