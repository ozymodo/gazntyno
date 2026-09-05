"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { useEffect, useRef } from "react";
import { useSceneTransition } from "@/components/scene/scene-context";

const WORD = "TECHNATURE";
const LETTERS = WORD.split("");

const BOX_WIDTH = 260;
const BOX_HEIGHT = 64;
const LETTER_BOX = 22;
const LETTER_RADIUS = 11;
const HOME_GAP = 20;
const MAX_SPEED = 30;
const HOVER_IN_RATE = 6; // 1/seconds — converging into the word reads fast/deliberate
const HOVER_OUT_RATE = 0.8; // releasing back to floaty is a slow, gradual shuffle

// Deterministic pseudo-random per index, so server and client compute the
// same initial layout and hydration never mismatches.
function seeded(i: number, salt: number) {
  const x = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function isPlainLeftClick(e: MouseEvent) {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

type Body = { x: number; y: number; vx: number; vy: number };

function separate(a: Body, b: Body) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 0.001;
  const minDist = LETTER_RADIUS * 2;
  if (dist >= minDist) return;
  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = minDist - dist;
  a.x -= nx * overlap * 0.5;
  a.y -= ny * overlap * 0.5;
  b.x += nx * overlap * 0.5;
  b.y += ny * overlap * 0.5;
}

function bounceOffEachOther(a: Body, b: Body) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 0.001;
  const minDist = LETTER_RADIUS * 2;
  if (dist >= minDist) return;
  const nx = dx / dist;
  const ny = dy / dist;
  separate(a, b);
  const relVx = b.vx - a.vx;
  const relVy = b.vy - a.vy;
  const closingSpeed = relVx * nx + relVy * ny;
  if (closingSpeed > 0) return; // already moving apart
  const restitution = 0.9;
  const impulse = (-(1 + restitution) * closingSpeed) / 2;
  a.vx -= impulse * nx;
  a.vy -= impulse * ny;
  b.vx += impulse * nx;
  b.vy += impulse * ny;
}

// A gentle random nudge given to every letter's underlying body the moment
// hover ends, so the slow release reads as "waking up and shuffling off"
// rather than a static position just fading back into view.
function shuffleAwake(bodies: Body[]) {
  for (const b of bodies) {
    b.vx += (Math.random() - 0.5) * 16;
    b.vy += (Math.random() - 0.5) * 12;
  }
}

export default function HomeButton() {
  const { diveTo } = useSceneTransition();
  const linkRef = useRef<HTMLAnchorElement>(null);
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const bodiesRef = useRef<Body[]>([]);
  const homeXRef = useRef<number[]>([]);
  const hoverAmountRef = useRef(0);
  const hoveredRef = useRef(false);

  useEffect(() => {
    const totalWidth = (LETTERS.length - 1) * HOME_GAP;
    const startX = BOX_WIDTH / 2 - totalWidth / 2;
    homeXRef.current = LETTERS.map((_, i) => startX + i * HOME_GAP);

    bodiesRef.current = LETTERS.map((_, i) => ({
      x: LETTER_RADIUS + seeded(i, 0) * (BOX_WIDTH - LETTER_RADIUS * 2),
      y: LETTER_RADIUS + seeded(i, 1) * (BOX_HEIGHT - LETTER_RADIUS * 2),
      vx: (seeded(i, 2) - 0.5) * 20,
      vy: (seeded(i, 3) - 0.5) * 16,
    }));

    for (let pass = 0; pass < 8; pass++) {
      for (let i = 0; i < bodiesRef.current.length; i++) {
        for (let j = i + 1; j < bodiesRef.current.length; j++) {
          separate(bodiesRef.current[i], bodiesRef.current[j]);
        }
      }
    }

    let rafId = 0;
    let last = performance.now();
    const homeY = BOX_HEIGHT / 2;

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;

      const hoverRate = hoveredRef.current ? HOVER_IN_RATE : HOVER_OUT_RATE;
      hoverAmountRef.current +=
        ((hoveredRef.current ? 1 : 0) - hoverAmountRef.current) * (1 - Math.exp(-hoverRate * dt));
      const hoverT = hoverAmountRef.current;

      const bodies = bodiesRef.current;
      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        const wanderPhase = Math.floor(now / 900) + i * 7;
        b.vx += (seeded(wanderPhase, 40) - 0.5) * 8 * dt;
        b.vy += (seeded(wanderPhase, 50) - 0.5) * 8 * dt;
        const speed = Math.hypot(b.vx, b.vy);
        if (speed > MAX_SPEED) {
          b.vx = (b.vx / speed) * MAX_SPEED;
          b.vy = (b.vy / speed) * MAX_SPEED;
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt;

        if (b.x < LETTER_RADIUS) {
          b.x = LETTER_RADIUS;
          b.vx = Math.abs(b.vx);
        }
        if (b.x > BOX_WIDTH - LETTER_RADIUS) {
          b.x = BOX_WIDTH - LETTER_RADIUS;
          b.vx = -Math.abs(b.vx);
        }
        if (b.y < LETTER_RADIUS) {
          b.y = LETTER_RADIUS;
          b.vy = Math.abs(b.vy);
        }
        if (b.y > BOX_HEIGHT - LETTER_RADIUS) {
          b.y = BOX_HEIGHT - LETTER_RADIUS;
          b.vy = -Math.abs(b.vy);
        }
      }

      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
          bounceOffEachOther(bodies[i], bodies[j]);
        }
      }

      for (let i = 0; i < LETTERS.length; i++) {
        const el = letterRefs.current[i];
        if (!el) continue;
        const b = bodies[i];
        const fx = b.x + (homeXRef.current[i] - b.x) * hoverT;
        const fy = b.y + (homeY - b.y) * hoverT;
        const half = LETTER_BOX / 2;
        el.style.transform = `translate(${(fx - half).toFixed(1)}px, ${(fy - half).toFixed(1)}px)`;

        const r = Math.round(255 + (234 - 255) * hoverT);
        const g = 255;
        const bch = Math.round(255 + (240 - 255) * hoverT);
        const alpha = (0.7 + 0.3 * hoverT).toFixed(2);
        el.style.color = `rgba(${r}, ${g}, ${bch}, ${alpha})`;
        el.style.textShadow =
          hoverT > 0.01
            ? `0 0 ${(10 * hoverT).toFixed(1)}px rgba(120, 255, 150, ${(0.85 * hoverT).toFixed(2)}), 0 0 ${(24 * hoverT).toFixed(1)}px rgba(80, 220, 120, ${(0.5 * hoverT).toFixed(2)})`
            : "none";
      }

      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <Link
      ref={linkRef}
      href="/"
      data-particle-target
      data-accent="140, 220, 150"
      aria-label="Technature home"
      onClick={(e) => {
        if (!isPlainLeftClick(e)) return;
        e.preventDefault();
        diveTo("/", e.currentTarget);
      }}
      onMouseEnter={() => {
        hoveredRef.current = true;
      }}
      onMouseLeave={() => {
        hoveredRef.current = false;
        shuffleAwake(bodiesRef.current);
      }}
      onFocus={() => {
        hoveredRef.current = true;
      }}
      onBlur={() => {
        hoveredRef.current = false;
        shuffleAwake(bodiesRef.current);
      }}
      className="fixed left-6 top-6 z-20 block font-semibold sm:text-base"
      style={{ width: BOX_WIDTH, height: BOX_HEIGHT }}
    >
      <span className="relative block h-full w-full">
        {LETTERS.map((letter, i) => (
          <span
            key={i}
            ref={(el) => {
              letterRefs.current[i] = el;
            }}
            className="absolute flex items-center justify-center text-sm text-white/70 sm:text-base"
            style={{ width: LETTER_BOX, height: LETTER_BOX }}
          >
            {letter}
          </span>
        ))}
      </span>
    </Link>
  );
}
