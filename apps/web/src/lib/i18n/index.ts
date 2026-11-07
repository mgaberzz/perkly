import { AR } from "./ar";

export type Lang = "en" | "ar";
export const LANG_COOKIE = "perkly_lang";
export type Vars = Record<string, string | number | null | undefined>;
export type TFn = (s: string, vars?: Vars) => string;

/** English text is the key; Arabic falls back to English when a phrase has no translation yet. */
export function translate(lang: Lang, s: string, vars?: Vars) {
  let out = lang === "ar" ? AR[s] ?? s : s;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v ?? ""));
  return out;
}

export const makeT = (lang: Lang): TFn => (s, vars) => translate(lang, s, vars);
