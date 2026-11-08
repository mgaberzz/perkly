"use client";
import { useState } from "react";
import { ActionForm } from "./action-form";
import { useT } from "./i18n";
import { Field, Input, Select, Textarea } from "./ui";
import type { ActionState } from "@/lib/types";

type Opt = { id: string; label: string };

export function BroadcastForm({ action, campuses, perks, audience }: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  campuses: (Opt & { count: number | null })[]; perks: Opt[]; audience: number;
}) {
  const t = useT();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [campus, setCampus] = useState("");
  const reach = campus ? campuses.find((c) => c.id === campus)?.count ?? 0 : audience;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <ActionForm action={action} resetOnSuccess className="space-y-4">
        <Field label={t("Title")} hint={`${title.length}/80`}><Input name="title" maxLength={80} required value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("e.g. Flash deal at Costa 🔥")} /></Field>
        <Field label={t("Message")} hint={`${body.length}/240`}><Textarea name="body" maxLength={240} rows={3} required value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("e.g. 30% off all drinks until 6 pm today.")} /></Field>
        <details className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm">
          <summary className="cursor-pointer font-semibold">{t("Arabic version (recommended)")}</summary>
          <p className="mt-1 text-xs text-zinc-500">{t("Students using the app in Arabic get this text. Without it they get the English text.")}</p>
          <div className="mt-3 space-y-3" dir="rtl">
            <Input name="title_ar" maxLength={80} placeholder="العنوان" />
            <Textarea name="body_ar" maxLength={240} rows={3} placeholder="الرسالة" />
          </div>
        </details>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("Who gets it")}>
            <Select name="campus_id" value={campus} onChange={(e) => setCampus(e.target.value)}>
              <option value="">{t("All campuses")}</option>
              {campuses.map((c) => <option key={c.id} value={c.id}>{c.label}{c.count != null ? ` (${c.count})` : ""}</option>)}
            </Select>
          </Field>
          <Field label={t("Opens when tapped")}>
            <Select name="perk_id" defaultValue="">
              <option value="">{t("Notifications inbox")}</option>
              {perks.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </Select>
          </Field>
        </div>
        <p className="text-sm text-zinc-600">{t("Reaches {n} students who turned on perk drops.", { n: reach })}</p>
        <button type="submit" disabled={reach === 0}
          onClick={(e) => { if (!confirm(t("Send this notification to {n} students now?", { n: reach }))) e.preventDefault(); }}
          className="perk-gradient inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40">
          {t("Send notification")}
        </button>
      </ActionForm>
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{t("Preview")}</div>
        <div className="rounded-[28px] bg-zinc-900 p-4 shadow-lg">
          <div className="rounded-2xl bg-white/95 p-3 shadow">
            <div className="flex items-center gap-2 text-[11px] text-zinc-500">
              <span className="perk-gradient grid h-5 w-5 place-items-center rounded-md text-[10px] font-bold text-white">P</span>
              <span className="font-semibold">PERKLY</span><span className="ms-auto">{t("now")}</span>
            </div>
            <div className="mt-1.5 text-sm font-semibold text-zinc-900">{title || t("Title")}</div>
            <div className="text-sm text-zinc-700">{body || t("Your message appears here.")}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
