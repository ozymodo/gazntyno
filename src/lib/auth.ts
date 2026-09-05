import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { firebaseEnabled, getFirebaseAuth, OWNER_UID } from "@/lib/firebase";

export type AuthState = {
  uid: string | null;
  email: string | null;
  displayName: string | null;
  /** True once Firebase has reported an initial auth state - lets the UI hold off rendering a sign-in form until it knows there isn't already a session. */
  ready: boolean;
};

const SIGNED_OUT: AuthState = { uid: null, email: null, displayName: null, ready: false };

// Same tiny external-store shape as account.ts/settings.ts, fed by Firebase's
// own onAuthStateChanged instead of localStorage.
let cache: AuthState = SIGNED_OUT;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

if (typeof window !== "undefined" && firebaseEnabled) {
  const auth = getFirebaseAuth();
  if (auth) {
    onAuthStateChanged(auth, (user: User | null) => {
      cache = user
        ? { uid: user.uid, email: user.email, displayName: user.displayName, ready: true }
        : { uid: null, email: null, displayName: null, ready: true };
      emit();
    });
  }
}

export function subscribeAuth(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAuthSnapshot(): AuthState {
  return cache;
}

export function getServerAuthSnapshot(): AuthState {
  return SIGNED_OUT;
}

/** Whether the given uid is the one account firestore.rules/storage.rules let write to the shared feed. */
export function isOwnerUid(uid: string | null): boolean {
  return uid !== null && uid === OWNER_UID;
}

export async function signUpWithEmail(email: string, password: string): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error("Sign-in isn't set up on this deploy.");
  await createUserWithEmailAndPassword(auth, email, password);
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error("Sign-in isn't set up on this deploy.");
  await signInWithEmailAndPassword(auth, email, password);
}

export async function signInWithGoogle(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error("Sign-in isn't set up on this deploy.");
  await signInWithPopup(auth, new GoogleAuthProvider());
}

export async function signOutUser(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) return;
  await signOut(auth);
}
