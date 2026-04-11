import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Point Turbopack to the monorepo root to resolve workspace packages
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
  // Allow importing workspace packages
  transpilePackages: ["@fan-match/live-chat"],
};

export default nextConfig;
