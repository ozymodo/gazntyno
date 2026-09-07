import type { Metadata } from "next";
import GamesContent from "@/components/games/GamesContent";

export const metadata: Metadata = {
  title: "games — zyme",
  description: "indie games built by zyme, playable right in your browser.",
};

export default function GamesPage() {
  return <GamesContent />;
}
