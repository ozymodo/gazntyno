"use client";

import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { useState, useSyncExternalStore } from "react";
import {
  type BlogPost,
  deletePost,
  getPostsSnapshot,
  getServerPostsSnapshot,
  savePost,
  subscribePosts,
} from "@/lib/blog";
import PostEditor from "@/components/blog/PostEditor";
import PostOrb from "@/components/blog/PostOrb";
import PostViewer from "@/components/blog/PostViewer";

const ACCENT = "45, 158, 138";
const NEW_POST_LAYOUT_ID = "new-post-button";

type Overlay = { type: "new" } | { type: "edit"; post: BlogPost } | { type: "view"; post: BlogPost };

export default function BlogContent() {
  const posts = useSyncExternalStore(subscribePosts, getPostsSnapshot, getServerPostsSnapshot);
  const [overlay, setOverlay] = useState<Overlay | null>(null);

  const handleCreate = (title: string, body: string) => {
    savePost({ title, body });
    setOverlay(null);
  };

  const handleUpdate = (id: string) => (title: string, body: string) => {
    savePost({ id, title, body });
    setOverlay(null);
  };

  const handleDelete = (id: string) => {
    deletePost(id);
    setOverlay(null);
  };

  return (
    <LayoutGroup>
      <div className="flex min-h-screen flex-col px-6 py-16">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-3xl font-semibold tracking-[0.15em] text-white/90 sm:text-4xl">BLOG</h1>
          <p className="text-sm text-white/40">Posts drift here — click one to open it.</p>
        </div>

        <div className="relative mt-4 min-h-[65vh] flex-1">
          {posts.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="max-w-xs text-center text-sm text-white/30">
                No posts yet. Click the <span className="text-white/50">+</span> to plant one.
              </p>
            </div>
          )}

          {posts.map((post, index) => {
            const hidden = (overlay?.type === "edit" || overlay?.type === "view") && overlay.post.id === post.id;
            if (hidden) return null;
            return (
              <PostOrb
                key={post.id}
                post={post}
                index={index}
                total={posts.length}
                onOpen={() => setOverlay({ type: "view", post })}
              />
            );
          })}
        </div>
      </div>

      {(!overlay || overlay.type !== "new") && (
        <motion.button
          layoutId={NEW_POST_LAYOUT_ID}
          onClick={() => setOverlay({ type: "new" })}
          data-particle-target
          data-accent={ACCENT}
          aria-label="Write a new post"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="animate-breathe fixed bottom-8 right-8 z-20 flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-white/5 text-3xl font-light text-white/80 backdrop-blur-md transition-transform duration-300 hover:scale-110 hover:text-white"
          style={{ "--orb-glow": `rgba(${ACCENT}, 0.4)` } as React.CSSProperties}
        >
          <span
            className="pointer-events-none absolute inset-0 rounded-full opacity-60 blur-xl"
            style={{ background: `radial-gradient(circle, rgba(${ACCENT}, 0.4), transparent 70%)` }}
          />
          <span className="relative -mt-0.5">+</span>
        </motion.button>
      )}

      <AnimatePresence>
        {overlay?.type === "new" && (
          <PostEditor key="new" mode="new" layoutId={NEW_POST_LAYOUT_ID} onCancel={() => setOverlay(null)} onSubmit={handleCreate} />
        )}
        {overlay?.type === "edit" && (
          <PostEditor
            key={overlay.post.id}
            mode="edit"
            post={overlay.post}
            layoutId={`post-${overlay.post.id}`}
            onCancel={() => setOverlay({ type: "view", post: overlay.post })}
            onSubmit={handleUpdate(overlay.post.id)}
          />
        )}
        {overlay?.type === "view" && (
          <PostViewer
            key={overlay.post.id}
            post={overlay.post}
            layoutId={`post-${overlay.post.id}`}
            onClose={() => setOverlay(null)}
            onEdit={() => setOverlay({ type: "edit", post: overlay.post })}
            onDelete={() => handleDelete(overlay.post.id)}
          />
        )}
      </AnimatePresence>
    </LayoutGroup>
  );
}
