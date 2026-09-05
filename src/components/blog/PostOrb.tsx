"use client";

import { motion } from "framer-motion";
import type { MouseEvent } from "react";
import type { BlogPost } from "@/lib/blog";
import { driftParams, gridPosition, hashSeed } from "@/lib/orbLayout";
import { useSceneTransition } from "@/components/scene/scene-context";

const ACCENT = "56, 145, 255";

export function orbLayout(post: BlogPost, index: number, total: number) {
  const seed = hashSeed(post.id);
  const { left, top } = gridPosition(seed, index, total);
  const size = Math.min(136, Math.max(88, 84 + Math.min(post.body.length, 800) / 16));
  const { driftX, driftY, duration, delay } = driftParams(seed);
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
  const { burstAt } = useSceneTransition();

  const handleOpen = (e: MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    burstAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
    onOpen();
  };

  return (
    <motion.button
      layoutId={`post-${post.id}`}
      onClick={handleOpen}
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
