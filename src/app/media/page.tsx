import type { Metadata } from "next";
import MediaContent from "@/components/media/MediaContent";

export const metadata: Metadata = {
  title: "media — zyme",
  description: "photos and video from zyme.",
};

export default function MediaPage() {
  return <MediaContent />;
}
