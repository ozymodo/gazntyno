import type { Metadata } from "next";
import ComingSoon from "@/components/common/ComingSoon";

export const metadata: Metadata = {
  title: "Blog — Technature",
  description: "Writing from Technature, coming soon.",
};

export default function BlogPage() {
  return (
    <ComingSoon
      title="BLOG"
      tagline="Posts are still taking root. Check back soon."
      accent="45, 158, 138"
    />
  );
}
