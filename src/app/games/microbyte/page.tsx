import type { Metadata } from "next";
import MicrobytePlayer from "@/components/games/MicrobytePlayer";

export const metadata: Metadata = {
  title: "Microbyte — gazntyno",
  description: "Play Microbyte, an indie survival-strategy game, right in your browser.",
};

export default function MicrobytePage() {
  return <MicrobytePlayer />;
}
