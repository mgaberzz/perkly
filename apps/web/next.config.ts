import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Portals are fully per-user (auth cookies + RLS), so pages render dynamically on each request.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
