import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { firebaseEnabled, getFirebaseAuth, OWNER_UID } from "@/lib/firebase";

export type CreatorAuthState = {
  uid: string | null;
  email: string | null;
  /** True once Firebase has reported an initial auth state - lets the UI hold off rendering a sign-in form until it knows there isn't already a session. */
  ready: boolean;
};

const NOT_SIGNED_IN: CreatorAuthState = { uid: null, email: null, ready: false };

// Same tiny external-store shape as account.ts/settings.ts, fed by Firebase's
// own onAuthStateChanged instead of localStorage.
let cache: CreatorAuthState = NOT_SIGNED_IN;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

if (typeof window !== "undefined" && firebaseEnabled) {
  const auth = getFirebaseAuth();
  if (auth) {
    onAuthStateChanged(auth, (user: User | null) => {
      cache = { uid: user?.uid ?? null, email: user?.email ?? null, ready: true };
      emit();
    });
  }
}

export function subscribeCreatorAuth(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCreatorAuthSnapshot(): CreatorAuthState {
  return cache;
}

export function getServerCreatorAuthSnapshot(): CreatorAuthState {
  return NOT_SIGNED_IN;
}

/** Whether the given uid is the one account firestore.rules/storage.rules let write to the shared feed. */
export function isOwnerUid(uid: string | null): boolean {
  return uid !== null && uid === OWNER_UID;
}

export async function signInCreator(email: string, password: string): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error("Sign-in isn't set up on this deploy.");
  await signInWithEmailAndPassword(auth, email, password);
}

export async function signOutCreator(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) return;
  await signOut(auth);
}
