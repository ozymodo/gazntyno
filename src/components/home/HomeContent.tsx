"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import type { MouseEvent } from "react";
import { useEffect, useRef } from "react";
import UtilityButton from "@/components/home/UtilityButton";
import { useSceneTransition } from "@/components/scene/scene-context";
import { getSettingsSnapshot } from "@/lib/settings";

type NavOrb = {
  label: string;
  href: string;
  accent: string;
  delay: string;
  duration: string;
};

// Matches HomeButton's LETTERS/layoutId scheme exactly, so framer-motion
// treats the hero title and the nav button as the same ten letters handed
// off between pages rather than two separate pieces of text.
const WORDMARK = "TECHNATURE".split("");
const LETTER_TRANSITION = { layout: { duration: 0.9, ease: [0.16, 1, 0.3, 1] as const } };
// The shared layoutId transition owns each letter's transform while it's
// mid-flight from the home button; the idle-float/cursor-repel loop below
// must not fight it, so it holds off until comfortably past that duration.
const FLOAT_ENTRY_DELAY_MS = 950;
const REPEL_REACH = 100;
const INFLUENCE_SMOOTHING_RATE = 9; // 1/seconds — a light spring-like lag rather than an instant snap
const DUST_THRESHOLD = 0.22;
const DUST_INTERVAL_MS = 90;

// Forest/natural palette: emerald (growth), moss teal (water/shade), amber (sunlight through canopy).
const NAV_ORBS: NavOrb[] = [
  { label: "Games", href: "/games", accent: "52, 199, 110", delay: "0s", duration: "6.5s" },
  { label: "Blog", href: "/blog", accent: "56, 145, 255", delay: "-2.1s", duration: "7.2s" },
  { label: "Media", href: "/media", accent: "214, 168, 68", delay: "-4.4s", duration: "5.8s" },
];

function isPlainLeftClick(e: MouseEvent) {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

// Deterministic pseudo-random per letter, so each one's idle drift has its
// own phase/speed without needing real randomness (keeps server/client
// markup identical).
function seeded(i: number, salt: number) {
  const x = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export default function HomeContent() {
  const { diveTo, getPointer, emitDust } = useSceneTransition();
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    let rafId = 0;
    let mountTime: number | null = null;
    let last = 0;
    let baseCenters: { x: number; y: number }[] = [];
    const influence = new Array(WORDMARK.length).fill(0);
    const lastDustAt = new Array(WORDMARK.length).fill(-Infinity);

    const measure = () => {
      baseCenters = letterRefs.current.map((el) => {
        if (!el) return { x: 0, y: 0 };
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
    };

    const tick = (now: number) => {
      if (mountTime === null) {
        mountTime = now;
        last = now;
      }
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      const settledIn = now - mountTime > FLOAT_ENTRY_DELAY_MS;

      if (settledIn) {
        if (baseCenters.length === 0) measure();
        const t = now / 1000;
        const pointer = getPointer();
        const { accent, reducedMotion } = getSettingsSnapshot();

        for (let i = 0; i < WORDMARK.length; i++) {
          const el = letterRefs.current[i];
          const base = baseCenters[i];
          if (!el || !base) continue;

          // Gentle ambient bob, out of phase per letter so the word drifts
          // like something adrift in liquid rather than pulsing in unison -
          // skipped under Settings > Reduced motion.
          const floatX = reducedMotion ? 0 : Math.sin(t * (0.45 + seeded(i, 1) * 0.35) + seeded(i, 2) * 10) * 3;
          const floatY = reducedMotion ? 0 : Math.cos(t * (0.35 + seeded(i, 3) * 0.35) + seeded(i, 4) * 10) * 4.5;

          let targetInfluence = 0;
          let nx = 0;
          let ny = 0;
          if (pointer) {
            const dx = base.x - pointer.x;
            const dy = base.y - pointer.y;
            const dist = Math.hypot(dx, dy) || 1;
            if (dist < REPEL_REACH) {
              const proximity = 1 - dist / REPEL_REACH;
              targetInfluence = proximity * proximity;
              nx = dx / dist;
              ny = dy / dist;
            }
          }
          // A light spring-like lag toward the target proximity, rather than
          // snapping — reads as the letter actually being nudged rather
          // than teleporting to a computed offset.
          influence[i] += (targetInfluence - influence[i]) * (1 - Math.exp(-INFLUENCE_SMOOTHING_RATE * dt));
          const glow = influence[i];
          const push = glow * 14;
          const repelX = nx * push;
          const repelY = ny * push;

          el.style.transform = `translate(${(floatX + repelX).toFixed(2)}px, ${(floatY + repelY).toFixed(2)}px) scale(${(1 + glow * 0.06).toFixed(3)})`;
          el.style.filter =
            glow > 0.02 ? `drop-shadow(0 0 ${(4 + glow * 9).toFixed(1)}px rgba(${accent}, ${(glow * 0.55).toFixed(2)}))` : "";
          el.dataset.accent = accent;

          if (glow > DUST_THRESHOLD && now - lastDustAt[i] > DUST_INTERVAL_MS) {
            lastDustAt[i] = now;
            emitDust(base.x + repelX, base.y + repelY, 1);
          }
        }
      }

      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    const onResize = () => {
      baseCenters = [];
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
    };
  }, [getPointer, emitDust]);

  return (
    <div className="flex min-h-screen flex-col items-center gap-14 px-6 pt-20 text-center sm:pt-28">
      <UtilityButton />
      <div className="flex flex-col items-center gap-4">
        <h1 className="flex items-baseline text-5xl font-semibold tracking-[0.2em] drop-shadow-[0_0_25px_rgba(80,200,120,0.35)] sm:text-7xl">
          {WORDMARK.map((letter, i) => (
            <motion.span
              key={i}
              ref={(el) => {
                letterRefs.current[i] = el;
              }}
              layoutId={`home-letter-${i}`}
              transition={LETTER_TRANSITION}
              data-particle-target
              data-accent="140, 220, 150"
              className="inline-block bg-gradient-to-b from-white to-emerald-200/40 bg-clip-text text-transparent"
            >
              {letter}
            </motion.span>
          ))}
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
