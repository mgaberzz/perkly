// Sentry in the browser.
import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/sentry-options";

// Does nothing until NEXT_PUBLIC_SENTRY_DSN is set (Vercel → Environment Variables).
if (process.env.NEXT_PUBLIC_SENTRY_DSN) Sentry.init(sentryOptions(process.env.NEXT_PUBLIC_VERCEL_ENV));

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
