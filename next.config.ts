import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so a lockfile elsewhere on the machine cannot be
  // picked up during tracing.
  turbopack: { root: path.resolve(".") },
};

export default nextConfig;
