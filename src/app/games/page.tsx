import type { Metadata } from "next";
import GamesContent from "@/components/games/GamesContent";

export const metadata: Metadata = {
  title: "Games — gazntyno",
  description: "Indie games built by gazntyno, playable right in your browser.",
};

export default function GamesPage() {
  return <GamesContent />;
}
