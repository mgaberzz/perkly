// Shared Sentry settings for the portal. Reports carry the error, the page and the user's internal ID only:
// no cookies, headers, request bodies, query strings, database values or local variables (which could hold
// student or payment data).
import type * as Sentry from "@sentry/nextjs";

export function sentryOptions(environment: string | undefined): Parameters<typeof Sentry.init>[0] {
  return {
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
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
