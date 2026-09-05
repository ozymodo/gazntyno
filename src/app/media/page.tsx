import type { Metadata } from "next";
import MediaContent from "@/components/media/MediaContent";

export const metadata: Metadata = {
  title: "Media — gazntyno",
  description: "Photos and video from gazntyno.",
};

export default function MediaPage() {
  return <MediaContent />;
}
