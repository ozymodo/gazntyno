import type { ReactNode } from "react";

// Shared "glass panel" building blocks for the Settings and Account pages,
// so both read as the same minimal, translucent-card theme.

export function Row({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-4 text-left">
      <div>
        <p className="text-sm font-medium text-white/85">{title}</p>
        {description && <p className="mt-0.5 max-w-xs text-xs text-white/40">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="w-full max-w-xl text-left">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/40">{title}</h2>
      <div className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.03] px-5 backdrop-blur-md">
        {children}
      </div>
    </section>
  );
}
