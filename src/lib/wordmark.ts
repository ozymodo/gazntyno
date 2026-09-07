/**
 * The word the animated landing-page title (and the nav home button it hands
 * its letters off to) spells when an account has no custom wordmark set.
 *
 * One word is drawn at random per page load rather than being fixed, so the
 * site introduces itself a little differently each visit. All of them are
 * microbial-biology terms, kept to 6-8 letters so the letter physics and the
 * hero's spacing behave the same whichever one comes up.
 */
export const WORDMARK_WORDS = [
  "enzyme",
  "catalyst",
  "plasmid",
  "ribosome",
  "flagella",
  "symbiont",
  "culture",
  "mitosis",
  "protist",
  "biofilm",
] as const;

/**
 * The word rendered during server rendering and React's hydration pass.
 * Fixed (not random) so the server's HTML and the client's first render
 * agree; the random pick swaps in right after hydration - see
 * getDefaultWordmark. Also the placeholder in Account > Homepage text.
 */
export const DEFAULT_WORDMARK = WORDMARK_WORDS[0];

// Chosen once at module evaluation, so the hero title and the home button
// read the same word for the whole page load - they share framer-motion
// layoutIds per letter, and two different words would tear that handoff.
const sessionWordmark = typeof window === "undefined" ? DEFAULT_WORDMARK : WORDMARK_WORDS[Math.floor(Math.random() * WORDMARK_WORDS.length)];

// useSyncExternalStore shape, matching lib/account.ts and lib/settings.ts.
// The value never changes after module load, so there's nothing to notify:
// going through the store (rather than reading sessionWordmark directly in
// render) is purely so React uses the server value for the hydration pass
// and re-renders with the random one after, instead of flagging a mismatch.
export function subscribeDefaultWordmark(): () => void {
  return () => {};
}

export function getDefaultWordmark(): string {
  return sessionWordmark;
}

export function getServerDefaultWordmark(): string {
  return DEFAULT_WORDMARK;
}
