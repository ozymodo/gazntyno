"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import FreeroamButton from "@/components/games/FreeroamButton";
import { useSceneTransition } from "@/components/scene/scene-context";

const MICROBYTE_ACCENT = "52, 199, 110";

function isPlainLeftClick(e: MouseEvent) {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

export default function GamesContent() {
  const { diveTo } = useSceneTransition();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 px-6 py-24">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-3xl font-semibold tracking-[0.15em] text-white/90 sm:text-4xl">GAMES</h1>
        <p className="text-sm text-white/40">Playable worlds, built from scratch.</p>
      </div>

      <Link
        href="/games/microbyte"
        data-particle-target
        data-accent={MICROBYTE_ACCENT}
        onClick={(e) => {
          if (!isPlainLeftClick(e)) return;
          e.preventDefault();
          diveTo("/games/microbyte", e.currentTarget);
        }}
        className="group relative block w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-8 text-left backdrop-blur-md transition-transform duration-300 hover:scale-[1.02]"
        style={{ "--orb-glow": `rgba(${MICROBYTE_ACCENT}, 0.3)` } as React.CSSProperties}
      >
        <span
          className="pointer-events-none absolute inset-0 opacity-40 blur-2xl transition-opacity duration-300 group-hover:opacity-70"
          style={{
            background: `radial-gradient(circle at 30% 20%, rgba(${MICROBYTE_ACCENT}, 0.35), transparent 60%)`,
          }}
        />
        <div className="relative flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold tracking-wide text-white">Microbyte</h2>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs uppercase tracking-widest text-emerald-300">
              Indie
            </span>
          </div>
          <p className="text-sm leading-relaxed text-white/60">
           play as a tiny organism in a microscopic world. survive, hunt, and multiply in a dynamic ecosystem teeming with life. 
           microbyte is a unique blend of rougelite, simulation, and stategy. 
          </p>
          <span className="text-sm font-medium text-emerald-300 transition-colors group-hover:text-emerald-200">
            Play in browser →
          </span>
        </div>
      </Link>

      <FreeroamButton />
    </div>
  );
}
