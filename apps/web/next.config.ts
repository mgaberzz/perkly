import { withSentryConfig } from "@sentry/nextjs/config";
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

// Readable stack traces: source maps are uploaded at build time when SENTRY_AUTH_TOKEN,
// SENTRY_ORG and SENTRY_PROJECT are set on Vercel; without them the build just skips the upload.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  telemetry: false,
  tunnelRoute: "/monitoring", // sends browser reports through the portal so ad blockers don't drop them
});
