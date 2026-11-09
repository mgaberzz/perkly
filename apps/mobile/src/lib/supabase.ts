import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

// Public values (safe to ship in the app). A .env file can point the app at another project;
// placeholders or a missing .env fall back to Perkly's live project so `npx expo start` just works.
const LIVE_URL = 'https://qnvzkjojuumtzpkvjlja.supabase.co';
const LIVE_KEY = 'sb_publishable_acSp196d89a1J3Thuoutng_RDfhfQ4u';
const envUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const envKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const real = (v: string) => Boolean(v) && !/YOUR-PROJECT|your-anon-key/.test(v);
const url = real(envUrl) ? envUrl : LIVE_URL;
const anonKey = real(envKey) ? envKey : LIVE_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

/** Gives up on a request that hangs (weak connection) so screens can show "try again" instead of spinning forever. */
const fetchWithTimeout: typeof fetch = (input, init) => {
  if (init?.signal) return fetch(input, init);
  const target = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
  const ms = target.includes('/storage/') ? 60_000 : 15_000; // photo uploads get longer
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer));
};

export const supabase = createClient(url || 'http://localhost:54321', anonKey || 'missing-key', {
  global: { fetch: fetchWithTimeout },
  auth: {
    storage: Platform.OS === 'web' && typeof window === 'undefined' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce', // needed for Google/Apple sign-in via the system browser
  },
});

// Refresh tokens only while the app is in the foreground (Supabase RN recommendation)
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
