import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.PLAYWRIGHT_E2E === "1"
    ? { distDir: ".next-playwright" }
    : {}),
  async rewrites() {
    return [
      // Many mobile browsers and crawlers request /favicon.ico explicitly; app/icon is served at /icon.
      { source: "/favicon.ico", destination: "/icon" },
    ]
  },
};

export default nextConfig;
