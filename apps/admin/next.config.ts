import type { NextConfig } from "next";
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Monorepo root `.env` (same file as API + mobile dev). */
loadEnv({ path: path.resolve(__dirname, "../../.env") });

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /** Monorepo: trace deps from tripgent root (avoids wrong React resolution). */
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: ["@tripgent/api"],
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/health", destination: "/api/health" },
        { source: "/v1/:path*", destination: "/api/v1/:path*" },
      ],
    };
  },
};

export default nextConfig;
