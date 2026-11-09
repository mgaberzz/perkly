"use client";
// Tags Sentry reports with who hit the error (internal ID and role only, no name or email).
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export function SentryUser({ id, role }: { id: string; role: string }) {
  useEffect(() => {
    Sentry.setUser({ id });
    Sentry.setTag("role", role);
  }, [id, role]);
  return null;
}
