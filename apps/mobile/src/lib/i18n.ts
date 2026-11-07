import AsyncStorage from '@react-native-async-storage/async-storage';
import { DevSettings, I18nManager, Platform } from 'react-native';
import { reloadAppAsync } from 'expo';
import { AR } from './i18n-ar';

export type Lang = 'en' | 'ar';
const KEY = 'perkly.lang';

/**
 * The app's language follows the native layout direction: Arabic = right-to-left.
 * Switching language flips the direction and reloads the app once (React Native requires a restart for RTL).
 */
let current: Lang = Platform.OS !== 'web' && I18nManager.isRTL ? 'ar' : 'en';
if (Platform.OS === 'web') {
  try { if (globalThis.localStorage?.getItem(KEY) === 'ar') current = 'ar'; } catch {}
  try { if (current === 'ar' && globalThis.document) globalThis.document.documentElement.dir = 'rtl'; } catch {}
}
export const lang = () => current;
export const isRTL = () => current === 'ar';

type Vars = Record<string, string | number | null | undefined>;
export function t(s: string, vars?: Vars) {
  let out = current === 'ar' ? AR[s] ?? s : s;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v ?? ''));
  return out;
}

export async function setLanguage(next: Lang) {
  await AsyncStorage.setItem(KEY, next);
  if (Platform.OS === 'web') {
    try { globalThis.localStorage?.setItem(KEY, next); } catch {}
    globalThis.location?.reload();
    return;
  }
  I18nManager.allowRTL(next === 'ar');
  I18nManager.forceRTL(next === 'ar');
  try { await reloadAppAsync('language'); } catch { DevSettings.reload(); }
}

/** Back chevron that points the right way in both directions */
export const backChevron = () => (current === 'ar' ? '›' : '‹');
export const fwdChevron = () => (current === 'ar' ? '‹' : '›');
/** Locale for dates and numbers */
export const locale = () => (current === 'ar' ? 'ar-EG' : 'en-GB');
