"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useT } from "./i18n";

const supported = () => typeof window !== "undefined" && "PublicKeyCredential" in window;
const noop = () => () => {};
/** false on the server, real answer in the browser (no hydration mismatch) */
const useSupported = () => useSyncExternalStore(noop, supported, () => false);

function message(t: (s: string) => string, e: { code?: string; message?: string; name?: string } | null, signIn = false) {
  const code = e?.code ?? "";
  const text = `${code} ${e?.name ?? ""} ${e?.message ?? ""}`;
  // Browser gives the same "timed out or not allowed" error when the user cancels AND when no passkey exists on this device
  if (signIn && /NotAllowed|not allowed|timed out|abort|cancel/i.test(text))
    return t("No Face ID / fingerprint found for Perkly on this device (or it was cancelled). First time? Sign in with your password, then open 🔐 Face ID / fingerprint in the menu and tap \"Set up\".");
  if (code === "passkey_disabled") return t("Face ID / fingerprint login isn't switched on for Perkly yet. Ask an admin.");
  if (code === "webauthn_credential_not_found") return t("This device has no Perkly passkey yet. Sign in with your password, then set it up under Security.");
  if (code === "webauthn_credential_exists") return t("This device is already set up.");
  if (/abort|cancel|NotAllowed|not allowed|timed out/i.test(text)) return t("Cancelled or timed out. Try again.");
  return e?.message ?? t("Something went wrong. Try again.");
}

/** Login page: one tap with Face ID / Touch ID / Windows Hello / fingerprint. */
export function PasskeySignIn({ next }: { next?: string }) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ok = useSupported();
  if (!ok) return null;
  async function go() {
    setBusy(true); setError(null);
    const { error: e } = await createClient().auth.signInWithPasskey();
    setBusy(false);
    if (e) return setError(message(t, e as { code?: string; message?: string; name?: string }, true));
    router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
    router.refresh();
  }
  return (
    <div className="mb-6">
      <button onClick={go} disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-perk-ink px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
        🔐 {busy ? t("Waiting for your device…") : t("Sign in with Face ID / fingerprint")}
      </button>
      {error && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
      <div className="mt-6 flex items-center gap-3 text-xs text-zinc-400"><span className="h-px flex-1 bg-zinc-200" />{t("or with your password")}<span className="h-px flex-1 bg-zinc-200" /></div>
    </div>
  );
}

type Passkey = { id: string; friendly_name?: string | null; created_at: string; last_used_at?: string | null };

/** Security page: add this device, list and remove passkeys. */
export function PasskeyManager() {
  const t = useT();
  const [list, setList] = useState<Passkey[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [version, setVersion] = useState(0);
  const load = () => setVersion((v) => v + 1);
  useEffect(() => {
    let live = true;
    createClient().auth.passkey.list().then(({ data, error: e }) => {
      if (!live) return;
      if (e) { setError(message(t, e as { code?: string; message?: string })); setList([]); return; }
      setList((data ?? []) as Passkey[]);
    });
    return () => { live = false; };
  }, [version, t]);
  const ok2 = useSupported();

  async function add() {
    setBusy(true); setError(null); setOk(null);
    const { error: e } = await createClient().auth.registerPasskey();
    setBusy(false);
    if (e) return setError(message(t, e as { code?: string; message?: string }));
    setOk(t("Done! Next time, sign in with Face ID / fingerprint."));
    load();
  }
  async function remove(id: string) {
    if (!confirm(t("Remove this device? It won't be able to sign in with Face ID / fingerprint anymore."))) return;
    await createClient().auth.passkey.delete({ passkeyId: id });
    load();
  }

  if (!ok2) return <p className="text-sm text-zinc-500">{t("This browser doesn't support Face ID / fingerprint sign-in.")}</p>;
  return (
    <div className="space-y-4">
      <button onClick={add} disabled={busy} className="perk-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
        + {busy ? t("Waiting for your device…") : t("Set up Face ID / fingerprint on this device")}
      </button>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
      {ok && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">{ok}</p>}
      <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200">
        {(list ?? []).map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <div>
              <div className="font-semibold">🔑 {p.friendly_name || t("Passkey")}</div>
              <div className="text-xs text-zinc-500">
                {t("Added {date}", { date: new Date(p.created_at).toLocaleDateString() })}
                {p.last_used_at && ` · ${t("last used {date}", { date: new Date(p.last_used_at).toLocaleDateString() })}`}
              </div>
            </div>
            <button onClick={() => remove(p.id)} className="text-xs font-semibold text-red-600 hover:underline">{t("Remove")}</button>
          </li>
        ))}
        {list && list.length === 0 && <li className="px-4 py-6 text-center text-sm text-zinc-500">{t("No devices set up yet.")}</li>}
        {!list && <li className="px-4 py-6 text-center text-sm text-zinc-400">…</li>}
      </ul>
    </div>
  );
}
