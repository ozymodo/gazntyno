import type { Metadata } from "next";
import SettingsContent from "@/components/settings/SettingsContent";

export const metadata: Metadata = {
  title: "settings — zyme",
  description: "customize colors, motion, and typography for zyme.",
};

export default function SettingsPage() {
  return <SettingsContent />;
}
