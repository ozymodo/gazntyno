import type { Metadata } from "next";
import MediaContent from "@/components/media/MediaContent";

export const metadata: Metadata = {
  title: "Media — Technature",
  description: "Photos and video from Technature.",
};

export default function MediaPage() {
  return <MediaContent />;
}
