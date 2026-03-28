import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Many mobile browsers and crawlers request /favicon.ico explicitly; app/icon is served at /icon.
      { source: "/favicon.ico", destination: "/icon" },
    ]
  },
};

export default nextConfig;
