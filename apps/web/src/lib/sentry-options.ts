// Shared Sentry settings for the portal. Reports carry the error, the page and the user's internal ID only:
// no cookies, headers, request bodies, query strings, database values or local variables (which could hold
// student or payment data).
import type * as Sentry from "@sentry/nextjs";

// The portal's Sentry project (perkly-portal). A DSN only allows sending reports, so it is safe to commit.
// NEXT_PUBLIC_SENTRY_DSN on Vercel overrides it. Reports are only sent from deployed builds, not local dev.
export const SENTRY_DSN =
  process.env.NODE_ENV === "production"
    ? process.env.NEXT_PUBLIC_SENTRY_DSN ?? "https://a9cfcd8a972923830082d011997badcf@o4512400955146240.ingest.de.sentry.io/4512400974217296"
    : process.env.NEXT_PUBLIC_SENTRY_DSN;

export function sentryOptions(environment: string | undefined): Parameters<typeof Sentry.init>[0] {
  return {
    dsn: SENTRY_DSN,
    environment: environment ?? "development",
    tracesSampleRate: 0.1, // performance data for 1 in 10 requests
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      stackFrameVariables: false,
    },
  };
}
