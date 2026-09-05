import type { Metadata } from "next";
import ComingSoon from "@/components/common/ComingSoon";

export const metadata: Metadata = {
  title: "Media — Technature",
  description: "Video and media from Technature, coming soon.",
};

export default function MediaPage() {
  return (
    <ComingSoon
      title="MEDIA"
      tagline="Video and media are still being edited. Check back soon."
      accent="214, 168, 68"
    />
  );
}
