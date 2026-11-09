"use client";
// Last-resort error screen for the whole portal; reports the error to Sentry.
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error); }, [error]);
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#fafafa", margin: 0 }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
          <div>
            <h1 style={{ fontSize: 22, margin: 0 }}>Something went wrong</h1>
            <p style={{ color: "#71717a", marginTop: 8 }}>The Perkly team has been notified. حدث خطأ، وتم إبلاغ فريق Perkly.</p>
            <button onClick={reset} style={{ marginTop: 16, padding: "10px 18px", borderRadius: 12, border: 0, background: "#7B2FF7", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Try again</button>
          </div>
        </main>
      </body>
    </html>
  );
}
