"use client";
// Admin Settings: sends one test error so you can check Sentry receives portal errors.
import * as Sentry from "@sentry/nextjs";
import { useState } from "react";
import { useT } from "./i18n";

export function SentryTest() {
  const t = useT();
  const [sent, setSent] = useState<string | null>(null);
  async function send() {
    const id = Sentry.captureException(new Error("Perkly portal test error (sent from Settings)"));
    await Sentry.flush(3000);
    setSent(id);
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={send} className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-zinc-50">
        {t("Send test error")}
      </button>
      {sent && <span className="text-sm text-emerald-700">{t("Sent. It appears in Sentry → perkly-portal → Issues within a minute.")}</span>}
    </div>
  );
}
