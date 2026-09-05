"use client";

import { createContext, useContext } from "react";

export type SceneContextValue = {
  diveTo: (href: string, originEl?: HTMLElement | null) => void;
  /** Bursts a scatter of particles from a screen point — the same dissolve
   *  language as page dives, for other entities (opening a post, uploading
   *  media) to share. */
  burstAt: (clientX: number, clientY: number, count?: number) => void;
  /** Live cursor position in screen space (null when off-window), read
   *  imperatively — not reactive state — so callers can poll it from their
   *  own rAF loop without triggering re-renders on every mouse move. */
  getPointer: () => { x: number; y: number } | null;
  /** Emits a few of the same tiny drifting motes as the cursor's own trail
   *  from a screen point — for other elements (a hovered letter) to borrow
   *  that exact subtle look instead of inventing a separate effect. */
  emitDust: (clientX: number, clientY: number, count?: number) => void;
  /** Dissolves every page element and hands the camera to WASD/mouse flight
   *  through the particle field, until Escape brings the page back. */
  enterFreeroam: () => void;
  /** Shows/hides the persistent Utility button - pages call this with
   *  `false` while a full-screen panel (a post/media viewer or editor) is
   *  open over their content, so it doesn't float on top of/overlap that
   *  panel, and `true` (or unmount) to bring it back. */
  setUtilityVisible: (visible: boolean) => void;
};

export const SceneContext = createContext<SceneContextValue | null>(null);

export function useSceneTransition() {
  const ctx = useContext(SceneContext);
  if (!ctx) throw new Error("useSceneTransition must be used within SceneProvider");
  return ctx;
}
