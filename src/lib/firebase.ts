import { type FirebaseApp, getApps, initializeApp } from "firebase/app";
import { type Auth, getAuth } from "firebase/auth";
import { type Firestore, getFirestore } from "firebase/firestore";
import { type FirebaseStorage, getStorage } from "firebase/storage";

// All NEXT_PUBLIC_ - Firebase's web config is not a secret (it identifies the
// project, it doesn't authorize anything); access control lives entirely in
// firestore.rules/storage.rules, keyed off NEXT_PUBLIC_OWNER_UID below.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** The one account allowed to write to the shared/global posts + media - see firestore.rules and storage.rules. */
export const OWNER_UID = process.env.NEXT_PUBLIC_OWNER_UID ?? "";

// Only gated on the core config - sign-in and per-user Firestore data work
// for everyone regardless of whether an owner/creator account has been
// designated yet. OWNER_UID being unset just means nobody can post to the
// shared Blog/Media feed (see isOwnerUid in lib/auth.ts).
export const firebaseEnabled = Object.values(firebaseConfig).every(Boolean);

// Lazy + guarded: this module is imported from client components that render
// during `next build`'s static prerender (a Node environment with no
// `window`), and initializing Auth/Firestore/Storage there either fails
// outright or wastes work that's immediately thrown away. Every export below
// is null until something in an actual browser asks for it, and stays null
// forever if the env vars above were never filled in (e.g. local dev before
// Firebase is set up) - callers already treat the whole feature as optional.
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

function ensureApp(): FirebaseApp | null {
  if (typeof window === "undefined" || !firebaseEnabled) return null;
  if (!app) app = getApps()[0] ?? initializeApp(firebaseConfig);
  return app;
}

export function getFirebaseAuth(): Auth | null {
  const a = ensureApp();
  if (!a) return null;
  if (!auth) auth = getAuth(a);
  return auth;
}

export function getFirebaseDb(): Firestore | null {
  const a = ensureApp();
  if (!a) return null;
  if (!db) db = getFirestore(a);
  return db;
}

export function getFirebaseStorage(): FirebaseStorage | null {
  const a = ensureApp();
  if (!a) return null;
  if (!storage) storage = getStorage(a);
  return storage;
}
