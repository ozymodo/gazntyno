import type { Metadata } from "next";
import GamesContent from "@/components/games/GamesContent";

export const metadata: Metadata = {
  title: "Games — Technature",
  description: "Indie games built by Technature, playable right in your browser.",
};

export default function GamesPage() {
  return <GamesContent />;
}
