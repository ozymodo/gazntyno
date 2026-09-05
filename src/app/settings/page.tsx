import type { Metadata } from "next";
import SettingsContent from "@/components/settings/SettingsContent";

export const metadata: Metadata = {
  title: "Settings — Technature",
  description: "Customize colors, motion, and typography for Technature.",
};

export default function SettingsPage() {
  return <SettingsContent />;
}
