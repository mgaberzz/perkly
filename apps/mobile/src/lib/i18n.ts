import AsyncStorage from '@react-native-async-storage/async-storage';
import { reloadAppAsync } from 'expo';
import { DevSettings, I18nManager, Platform } from 'react-native';
import { AR } from './i18n-ar';

export type Lang = 'en' | 'ar';
const KEY = 'perkly.lang';
const FLIP_KEY = 'perkly.rtlFlipTried';

/**
 * The saved choice (AsyncStorage) decides the language. The layout direction (RTL) follows it;
 * React Native needs one restart for the direction to flip, which initLanguage() does once.
 */
let current: Lang = Platform.OS !== 'web' && I18nManager.isRTL ? 'ar' : 'en';
export const lang = () => current;
export const isRTL = () => current === 'ar';

type Vars = Record<string, string | number | null | undefined>;
export function t(s: string, vars?: Vars) {
  let out = current === 'ar' ? AR[s] ?? s : s;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v ?? ''));
  return out;
}

async function restart() {
  try { await reloadAppAsync('language'); } catch { DevSettings.reload(); }
}

/** Call once before rendering the app. */
export async function initLanguage() {
  let saved: string | null = null;
  try { saved = await AsyncStorage.getItem(KEY); } catch {}
  if (Platform.OS === 'web') {
    try { saved = globalThis.localStorage?.getItem(KEY) ?? saved; } catch {}
    current = saved === 'ar' ? 'ar' : 'en';
    try { if (globalThis.document) globalThis.document.documentElement.dir = current === 'ar' ? 'rtl' : 'ltr'; } catch {}
    return;
  }
  current = saved === 'ar' ? 'ar' : saved === 'en' ? 'en' : current;
  const wantRTL = current === 'ar';
  if (I18nManager.isRTL === wantRTL) { AsyncStorage.removeItem(FLIP_KEY).catch(() => {}); return; }
  // Direction doesn't match the chosen language yet → flip it and restart once (never loop)
  I18nManager.allowRTL(wantRTL);
  I18nManager.forceRTL(wantRTL);
  const tried = await AsyncStorage.getItem(FLIP_KEY).catch(() => null);
  if (tried !== current) {
    await AsyncStorage.setItem(FLIP_KEY, current).catch(() => {});
    await restart();
  }
}

export async function setLanguage(next: Lang) {
  await AsyncStorage.setItem(KEY, next);
  await AsyncStorage.removeItem(FLIP_KEY).catch(() => {});
  if (Platform.OS === 'web') {
    try { globalThis.localStorage?.setItem(KEY, next); } catch {}
    globalThis.location?.reload();
    return;
  }
  current = next;
  I18nManager.allowRTL(next === 'ar');
  I18nManager.forceRTL(next === 'ar');
  await restart();
}

/** Back chevron that points the right way in both directions */
export const backChevron = () => (current === 'ar' ? '›' : '‹');
export const fwdChevron = () => (current === 'ar' ? '‹' : '›');
/** Locale for dates and numbers */
export const locale = () => (current === 'ar' ? 'ar-EG' : 'en-GB');
