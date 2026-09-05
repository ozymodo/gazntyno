"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { awardMicrobyteMinute } from "@/lib/account";

const ACCENT = "52, 199, 110";
const PLAYTIME_TICK_MS = 60_000;

export default function MicrobytePlayer() {
  const [loaded, setLoaded] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);

  // Counts "on this page with the game loaded" as played time - there's no
  // reach into the iframe's own state across the boundary, but XP ticks are
  // rate-limited to one per minute anyway, so this is a reasonable proxy.
  useEffect(() => {
    if (!loaded) return;
    const interval = setInterval(awardMicrobyteMinute, PLAYTIME_TICK_MS);
    return () => clearInterval(interval);
  }, [loaded]);

  // The iframe ships with no `src` in the server-rendered markup and gets
  // one assigned here instead. If `src` were set from the first render, the
  // browser (same-origin, fast local asset) can finish loading and fire the
  // iframe's one-shot `load` event before React finishes hydrating and
  // attaches the onLoad listener below — silently losing that event forever.
  // Assigning `.src` imperatively, after mount, guarantees the listener is
  // already attached before the navigation it's supposed to catch can start.
  useEffect(() => {
    if (frameRef.current) {
      // Next's basePath rewriting only reaches next/link, next/navigation,
      // and its own bundled asset URLs - not a plain string assigned to an
      // iframe's src, so the GitHub Pages subpath has to be prefixed by hand.
      frameRef.current.src = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/games/microbyte/index.html`;
    }
  }, []);

  return (
    <div className="relative flex min-h-screen flex-col items-center gap-8 px-6 py-24">
      <div
        className="pointer-events-none absolute top-24 h-72 w-72 rounded-full opacity-25 blur-3xl"
        style={{ background: `radial-gradient(circle, rgba(${ACCENT}, 0.5), transparent 70%)` }}
      />
      <div className="relative flex w-full max-w-4xl items-center justify-between">
        <Link href="/games" className="text-sm text-white/40 transition-colors hover:text-white/80">
          ← Back to Games
        </Link>
        <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs uppercase tracking-widest text-emerald-300">
          Indie
        </span>
      </div>

      <div className="relative flex flex-col items-center gap-3 text-center">
        <h1 className="text-4xl font-semibold tracking-wide text-white">Microbyte</h1>
        <p className="max-w-xl text-sm leading-relaxed text-white/60">
          A tiny organism wakes up inside a dying machine and has to grow, adapt, and spread
          before the system purges it. Guide it through decaying circuitry, out-compete rival
          strains, and find a way to survive.
        </p>
      </div>

      <div className="relative flex aspect-video w-full max-w-4xl items-center justify-center overflow-hidden rounded-2xl border border-emerald-400/20 bg-black">
        {!loaded && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400/20 border-t-emerald-400" />
            <p className="text-sm text-white/40">Loading Microbyte…</p>
          </div>
        )}
        <iframe
          ref={frameRef}
          title="Microbyte"
          className="h-full w-full border-0"
          allow="autoplay; fullscreen; gamepad"
          onLoad={() => setLoaded(true)}
        />
        <button
          type="button"
          onClick={() => frameRef.current?.requestFullscreen()}
          className="absolute right-3 top-3 z-10 rounded-full border border-white/15 bg-black/50 px-3 py-1 text-xs text-white/70 backdrop-blur-sm transition-colors hover:border-emerald-400/30 hover:text-white"
        >
          Fullscreen
        </button>
      </div>
    </div>
  );
}
