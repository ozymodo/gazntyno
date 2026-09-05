"use client";

import { useState, useSyncExternalStore } from "react";
import {
  getCreatorAuthSnapshot,
  getServerCreatorAuthSnapshot,
  isOwnerUid,
  signInCreator,
  signOutCreator,
  subscribeCreatorAuth,
} from "@/lib/creatorAuth";
import { firebaseEnabled } from "@/lib/firebase";
import { Row, Section } from "@/components/common/Panel";

const ACCENT = "210, 180, 220";

// Only ever renders for the one person who knows the creator account's
// credentials - everyone else who lands on /account never sees this
// section do anything but sit there as a sign-in form, and firestore.rules/
// storage.rules (not this component) are what actually stop them writing
// to the shared feed even if they did sign in as themselves.
export default function CreatorSignIn() {
  const auth = useSyncExternalStore(subscribeCreatorAuth, getCreatorAuthSnapshot, getServerCreatorAuthSnapshot);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!firebaseEnabled) return null;

  const handleSignIn = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await signInCreator(email, password);
      setPassword("");
    } catch {
      setError("That didn't work - check the email and password.");
    } finally {
      setSubmitting(false);
    }
  };

  const isOwner = isOwnerUid(auth.uid);

  return (
    <Section title="Creator">
      {auth.uid ? (
        <div className="flex flex-col gap-3 py-4 text-left">
          <Row title={isOwner ? "Signed in" : "Signed in (not the creator account)"} description={auth.email ?? undefined}>
            <button
              type="button"
              onClick={() => signOutCreator()}
              className="rounded-full border border-white/10 px-4 py-1.5 text-sm text-white/70 transition-colors hover:border-white/25 hover:text-white"
            >
              Sign out
            </button>
          </Row>
          {isOwner && (
            <p className="text-xs text-white/35">Posts and media you add on Blog and Media now go live to everyone.</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3 py-4 text-left">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            autoComplete="username"
            className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-white/85 outline-none placeholder:text-white/25 focus:border-white/25"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSignIn();
            }}
            placeholder="Password"
            type="password"
            autoComplete="current-password"
            className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-white/85 outline-none placeholder:text-white/25 focus:border-white/25"
          />
          {error && <p className="text-xs text-red-300/80">{error}</p>}
          <button
            type="button"
            onClick={handleSignIn}
            disabled={submitting || !email || !password}
            className="self-start rounded-full border px-5 py-1.5 text-sm font-medium tracking-wide transition hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-30"
            style={{
              borderColor: `rgba(${ACCENT}, 0.35)`,
              backgroundColor: `rgba(${ACCENT}, 0.12)`,
              color: `rgb(${ACCENT})`,
            }}
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </div>
      )}
    </Section>
  );
}
