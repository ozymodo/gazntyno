"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { useSceneTransition } from "@/components/scene/scene-context";

type NavOrb = {
  label: string;
  href: string;
  accent: string;
  delay: string;
  duration: string;
};

// Forest/natural palette: emerald (growth), moss teal (water/shade), amber (sunlight through canopy).
const NAV_ORBS: NavOrb[] = [
  { label: "Games", href: "/games", accent: "52, 199, 110", delay: "0s", duration: "6.5s" },
  { label: "Blog", href: "/blog", accent: "45, 158, 138", delay: "-2.1s", duration: "7.2s" },
  { label: "Media", href: "/media", accent: "214, 168, 68", delay: "-4.4s", duration: "5.8s" },
];

function isPlainLeftClick(e: MouseEvent) {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

export default function HomeContent() {
  const { diveTo } = useSceneTransition();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-16 px-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <h1 className="animate-breathe-slow bg-gradient-to-b from-white to-emerald-200/40 bg-clip-text text-5xl font-semibold tracking-[0.2em] text-transparent drop-shadow-[0_0_25px_rgba(80,200,120,0.35)] sm:text-7xl">
          TECHNATURE
        </h1>
        <p className="max-w-md text-balance text-sm text-white/50 sm:text-base">
          An evolving space for games, stories, and everything in between.
        </p>
      </div>

      <nav className="flex flex-wrap items-center justify-center gap-10 sm:gap-16">
        {NAV_ORBS.map((orb) => (
          <Link
            key={orb.label}
            href={orb.href}
            data-particle-target
            data-accent={orb.accent}
            onClick={(e) => {
              if (!isPlainLeftClick(e)) return;
              e.preventDefault();
              diveTo(orb.href, e.currentTarget);
            }}
            className="animate-breathe group relative flex h-32 w-32 items-center justify-center rounded-full border border-white/15 bg-white/5 text-sm font-medium tracking-wide text-white/80 backdrop-blur-md transition-transform duration-300 hover:scale-110 hover:text-white sm:h-36 sm:w-36"
            style={
              {
                animationDelay: orb.delay,
                animationDuration: orb.duration,
                "--orb-glow": `rgba(${orb.accent}, 0.35)`,
              } as React.CSSProperties
            }
          >
            <span
              className="absolute inset-0 rounded-full opacity-60 blur-xl transition-opacity duration-300 group-hover:opacity-100"
              style={{ background: `radial-gradient(circle, rgba(${orb.accent}, 0.35), transparent 70%)` }}
            />
            <span className="relative">{orb.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
