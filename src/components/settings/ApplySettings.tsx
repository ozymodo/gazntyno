"use client";

import { useEffect } from "react";
import { useSyncExternalStore } from "react";
import { getServerSettingsSnapshot, getSettingsSnapshot, subscribeSettings, type FontChoice } from "@/lib/settings";

const FONT_VAR: Record<FontChoice, string> = {
  sans: "var(--font-geist-sans)",
  serif: "var(--font-source-serif)",
  mono: "var(--font-geist-mono)",
};

// Renders nothing - just keeps the <html> element's font and reduced-motion
// attributes in sync with the settings store, for globals.css to key off of.
export default function ApplySettings() {
  const settings = useSyncExternalStore(subscribeSettings, getSettingsSnapshot, getServerSettingsSnapshot);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--font-active", FONT_VAR[settings.font]);
    root.dataset.reducedMotion = String(settings.reducedMotion);
  }, [settings.font, settings.reducedMotion]);

  return null;
}
