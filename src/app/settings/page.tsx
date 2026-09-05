import type { Metadata } from "next";
import SettingsContent from "@/components/settings/SettingsContent";

export const metadata: Metadata = {
  title: "Settings — gazntyno",
  description: "Customize colors, motion, and typography for gazntyno.",
};

export default function SettingsPage() {
  return <SettingsContent />;
}
