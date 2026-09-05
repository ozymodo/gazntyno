import type { NextConfig } from "next";

// GitHub Pages serves this as a project site at <user>.github.io/<repo>/, so
// every route/asset needs that prefix baked in. The deploy workflow supplies
// it via actions/configure-pages' `base_path` output (empty for local/dev
// builds); NEXT_PUBLIC_ so MicrobytePlayer's imperative iframe `src` - the
// one path Next's own basePath rewriting can't reach - can prefix it too.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  output: "export",
  basePath,
};

export default nextConfig;
