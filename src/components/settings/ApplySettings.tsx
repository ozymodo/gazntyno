"use client";

import { useEffect } from "react";
import { useSyncExternalStore } from "react";
import { FONT_FAMILY_VAR, getServerSettingsSnapshot, getSettingsSnapshot, subscribeSettings } from "@/lib/settings";

// Renders nothing - just keeps the <html> element's font and reduced-motion
// attributes in sync with the settings store, for globals.css to key off of.
export default function ApplySettings() {
  const settings = useSyncExternalStore(subscribeSettings, getSettingsSnapshot, getServerSettingsSnapshot);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--font-active", FONT_FAMILY_VAR[settings.font]);
    root.dataset.reducedMotion = String(settings.reducedMotion);
    root.style.setProperty("--wordmark-scale", String(settings.wordmarkSize));
    root.style.setProperty("--background", `rgb(${settings.backgroundColor})`);
  }, [settings.font, settings.reducedMotion, settings.wordmarkSize, settings.backgroundColor]);

  return null;
}
