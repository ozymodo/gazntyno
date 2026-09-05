"use client";

import { useSyncExternalStore } from "react";
import { useSceneTransition } from "@/components/scene/scene-context";

// Matches the Games page's own accent (GamesContent/MicrobytePlayer).
const ACCENT = "52, 199, 110";
const FINE_POINTER_QUERY = "(pointer: fine)";

function subscribeFinePointer(callback: () => void) {
  const mql = window.matchMedia(FINE_POINTER_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getFinePointerSnapshot() {
  return window.matchMedia(FINE_POINTER_QUERY).matches;
}

// SSR (and a touch-only client) render nothing - keeps this in step with
// the server markup instead of flashing in on mount.
function getServerFinePointerSnapshot() {
  return false;
}

export default function FreeroamButton() {
  const { enterFreeroam } = useSceneTransition();
  // Freeroam is WASD + mouse-look via Pointer Lock, with Escape as the only
  // way out - none of that exists on a touch-only device, so the button
  // would just strand someone with a camera they can't move or escape.
  const canFreeroam = useSyncExternalStore(subscribeFinePointer, getFinePointerSnapshot, getServerFinePointerSnapshot);

  if (!canFreeroam) return null;

  return (
    <button
      type="button"
      onClick={() => enterFreeroam()}
      data-particle-target
      data-accent={ACCENT}
      className="fixed bottom-8 right-8 z-20 flex h-14 items-center gap-2.5 rounded-full border border-white/15 bg-white/5 px-6 text-sm font-medium tracking-wide text-white/80 backdrop-blur-md transition-transform duration-300 hover:scale-105 hover:text-white"
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: `rgb(${ACCENT})`, boxShadow: `0 0 8px rgba(${ACCENT}, 0.8)` }}
      />
      Freeroam
    </button>
  );
}
