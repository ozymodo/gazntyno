import type { Metadata } from "next";
import BlogContent from "@/components/blog/BlogContent";

export const metadata: Metadata = {
  title: "blog — zyme",
  description: "writing from zyme.",
};

export default function BlogPage() {
  return <BlogContent />;
}
