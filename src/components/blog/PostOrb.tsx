"use client";

import { motion } from "framer-motion";
import { type BlogPost, hashSeed, seeded } from "@/lib/blog";

const ACCENT = "45, 158, 138";

export function orbLayout(post: BlogPost, index: number, total: number) {
  const seed = hashSeed(post.id);
  const cols = Math.max(1, Math.ceil(Math.sqrt(total)));
  const rows = Math.max(1, Math.ceil(total / cols));
  const col = index % cols;
  const row = Math.floor(index / cols);
  const cellW = 100 / cols;
  const cellH = 100 / rows;
  const jitterX = (seeded(seed, 5) - 0.5) * cellW * 0.7;
  const jitterY = (seeded(seed, 6) - 0.5) * cellH * 0.7;
  const left = Math.min(92, Math.max(8, cellW * (col + 0.5) + jitterX));
  const top = Math.min(88, Math.max(12, cellH * (row + 0.5) + jitterY));
  const size = Math.min(136, Math.max(88, 84 + Math.min(post.body.length, 800) / 16));
  const driftX = 14 + seeded(seed, 7) * 16;
  const driftY = 10 + seeded(seed, 8) * 14;
  const duration = 7 + seeded(seed, 9) * 5;
  const delay = -seeded(seed, 10) * duration;
  return { left, top, size, driftX, driftY, duration, delay };
}

export default function PostOrb({
  post,
  index,
  total,
  onOpen,
}: {
  post: BlogPost;
  index: number;
  total: number;
  onOpen: () => void;
}) {
  const { left, top, size, driftX, driftY, duration, delay } = orbLayout(post, index, total);

  return (
    <motion.button
      layoutId={`post-${post.id}`}
      onClick={onOpen}
      data-particle-target
      data-accent={ACCENT}
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.4 }}
      transition={{ type: "spring", stiffness: 220, damping: 22 }}
      className="animate-orb group absolute flex items-center justify-center rounded-full border border-white/15 bg-white/5 p-3 text-center backdrop-blur-md transition-[border-color] duration-300 hover:border-white/30"
      style={
        {
          left: `${left}%`,
          top: `${top}%`,
          width: size,
          height: size,
          translate: "-50% -50%",
          "--orb-glow": `rgba(${ACCENT}, 0.3)`,
          "--orb-breathe-duration": `${duration}s`,
          "--orb-drift-duration": `${duration * 1.4}s`,
          "--orb-breathe-delay": `${delay}s`,
          "--orb-drift-delay": `${delay}s`,
          "--drift-x": `${driftX}px`,
          "--drift-y": `${driftY}px`,
        } as React.CSSProperties
      }
    >
      <span
        className="pointer-events-none absolute inset-0 rounded-full opacity-50 blur-xl transition-opacity duration-300 group-hover:opacity-90"
        style={{ background: `radial-gradient(circle, rgba(${ACCENT}, 0.35), transparent 70%)` }}
      />
      <span className="relative line-clamp-3 text-xs font-medium leading-snug text-white/80 sm:text-sm">
        {post.title}
      </span>
    </motion.button>
  );
}
