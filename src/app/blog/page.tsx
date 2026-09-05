import type { Metadata } from "next";
import BlogContent from "@/components/blog/BlogContent";

export const metadata: Metadata = {
  title: "Blog — gazntyno",
  description: "Writing from gazntyno.",
};

export default function BlogPage() {
  return <BlogContent />;
}
