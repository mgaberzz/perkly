"use client";
import { useState, useTransition } from "react";
import { Icon } from "./icons";
import { useT } from "./i18n";

type Res = { ok?: string; error?: string; value?: string };

/** One key card, like Paymob's API Keys page: Copy · View · Recreate. */
export function ApiKeyCard({ title, description, masked, value, reveal, recreate, live = true, meta }: {
  title: string; description: string; masked: string; value?: string; meta?: string; live?: boolean;
  reveal?: () => Promise<Res>; recreate: () => Promise<Res>;
}) {
  const t = useT();
  const [shown, setShown] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const get = async () => {
    if (value) return value;
    if (shown) return shown;
    const r = await reveal?.();
    if (r?.error) { setMsg({ tone: "error", text: t(r.error) }); return null; }
    return r?.value ?? null;
  };
  const copy = () => start(async () => {
    const v = await get(); if (!v) return;
    try { await navigator.clipboard.writeText(v); setMsg({ tone: "ok", text: t("Copied") }); } catch { setShown(v); setMsg({ tone: "error", text: t("Couldn't copy. Select the key and copy it by hand.") }); }
  });
  const view = () => start(async () => { if (shown) { setShown(null); return; } const v = await get(); if (v) setShown(v); });
  const again = () => {
    if (!confirm(t("Create a new {key}? The current one stops working immediately.", { key: title.toLowerCase() }))) return;
    start(async () => { const r = await recreate(); setShown(null); setMsg(r.error ? { tone: "error", text: t(r.error) } : { tone: "ok", text: t(r.ok ?? "Done") }); });
  };
  const btn = "flex-1 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50 disabled:opacity-50";
  return (
    <section className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold">{title}</h2>
        {live && <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">{t("Live")}</span>}
      </div>
      <p className="mt-2 text-sm text-zinc-500">{description}</p>
      <code dir="ltr" className="mt-4 block break-all rounded-xl bg-zinc-50 px-3 py-2.5 font-mono text-xs text-zinc-700">{shown ?? masked}</code>
      {meta && <p className="mt-2 text-xs text-zinc-400">{meta}</p>}
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={copy} disabled={pending} className={btn}><Icon name="copy" size={14} className="me-1.5 inline-block align-[-2px]" />{t("Copy")}</button>
        <button type="button" onClick={view} disabled={pending} className={btn}><Icon name="eye" size={14} className="me-1.5 inline-block align-[-2px]" />{shown ? t("Hide") : t("View")}</button>
        <button type="button" onClick={again} disabled={pending} className={btn}><Icon name="refresh" size={14} className="me-1.5 inline-block align-[-2px]" />{t("Recreate")}</button>
      </div>
      {msg && <p className={`mt-3 text-sm font-medium ${msg.tone === "ok" ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>}
    </section>
  );
}

export function CreateKeysButton({ create }: { create: () => Promise<Res> }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <button type="button" disabled={pending} onClick={() => start(async () => { const r = await create(); if (r.error) setErr(t(r.error)); })}
        className="perk-gradient rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{pending ? "…" : t("Create API keys")}</button>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
    </div>
  );
}
