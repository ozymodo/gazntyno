"use client";

import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { type MouseEvent, useState, useSyncExternalStore } from "react";
import { awardMediaUploadXp, awardMediaViewXp } from "@/lib/account";
import {
  addMedia,
  deleteMedia,
  getMediaSnapshot,
  getServerMediaSnapshot,
  type MediaItem,
  subscribeMedia,
  updateCaption,
} from "@/lib/media";
import MediaEditor from "@/components/media/MediaEditor";
import MediaOrb from "@/components/media/MediaOrb";
import MediaViewer from "@/components/media/MediaViewer";
import { useSceneTransition } from "@/components/scene/scene-context";

const ACCENT = "214, 168, 68";
const NEW_MEDIA_LAYOUT_ID = "new-media-button";

type Overlay = { type: "new" } | { type: "edit"; item: MediaItem } | { type: "view"; item: MediaItem };

export default function MediaContent() {
  const items = useSyncExternalStore(subscribeMedia, getMediaSnapshot, getServerMediaSnapshot);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const { burstAt } = useSceneTransition();

  const handleNew = (e: MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    burstAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
    setOverlay({ type: "new" });
  };

  const handleCreate = async (file: File, caption: string) => {
    await addMedia(file, caption);
    awardMediaUploadXp();
    setOverlay(null);
  };

  const handleSave = (id: string) => async (caption: string) => {
    await updateCaption(id, caption);
    setOverlay(null);
  };

  const handleDelete = async (id: string) => {
    await deleteMedia(id);
    setOverlay(null);
  };

  return (
    <LayoutGroup>
      <div className="flex min-h-screen flex-col px-6 py-16">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-3xl font-semibold tracking-[0.15em] text-white/90 sm:text-4xl">MEDIA</h1>
          <p className="text-sm text-white/40">Snapshots drift here — click one to open it.</p>
        </div>

        <div className="relative mt-4 min-h-[65vh] flex-1">
          {items.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="max-w-xs text-center text-sm text-white/30">
                Nothing here yet. Click the <span className="text-white/50">+</span> to add a photo or video.
              </p>
            </div>
          )}

          {items.map((item, index) => {
            const hidden = (overlay?.type === "edit" || overlay?.type === "view") && overlay.item.id === item.id;
            if (hidden) return null;
            return (
              <MediaOrb
                key={item.id}
                item={item}
                index={index}
                total={items.length}
                onOpen={() => {
                  awardMediaViewXp(item.id);
                  setOverlay({ type: "view", item });
                }}
              />
            );
          })}
        </div>
      </div>

      {(!overlay || overlay.type !== "new") && (
        <motion.button
          layoutId={NEW_MEDIA_LAYOUT_ID}
          onClick={handleNew}
          data-particle-target
          data-accent={ACCENT}
          aria-label="Add a photo or video"
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
          <MediaEditor
            key="new"
            mode="new"
            layoutId={NEW_MEDIA_LAYOUT_ID}
            onCancel={() => setOverlay(null)}
            onSubmit={handleCreate}
          />
        )}
        {overlay?.type === "edit" && (
          <MediaEditor
            key={overlay.item.id}
            mode="edit"
            item={overlay.item}
            layoutId={`media-${overlay.item.id}`}
            onCancel={() => setOverlay({ type: "view", item: overlay.item })}
            onSubmit={handleSave(overlay.item.id)}
          />
        )}
        {overlay?.type === "view" && (
          <MediaViewer
            key={overlay.item.id}
            item={overlay.item}
            layoutId={`media-${overlay.item.id}`}
            onClose={() => setOverlay(null)}
            onEdit={() => setOverlay({ type: "edit", item: overlay.item })}
            onDelete={() => handleDelete(overlay.item.id)}
          />
        )}
      </AnimatePresence>
    </LayoutGroup>
  );
}
