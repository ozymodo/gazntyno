"use client";

import { createContext, useContext } from "react";

export type SceneContextValue = {
  diveTo: (href: string, originEl?: HTMLElement | null) => void;
};

export const SceneContext = createContext<SceneContextValue | null>(null);

export function useSceneTransition() {
  const ctx = useContext(SceneContext);
  if (!ctx) throw new Error("useSceneTransition must be used within SceneProvider");
  return ctx;
}
