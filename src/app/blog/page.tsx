import type { Metadata } from "next";
import BlogContent from "@/components/blog/BlogContent";

export const metadata: Metadata = {
  title: "Blog — Technature",
  description: "Writing from Technature.",
};

export default function BlogPage() {
  return <BlogContent />;
}
