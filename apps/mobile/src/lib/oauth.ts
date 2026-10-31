import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

/**
 * Google / Apple sign-in through Supabase OAuth (PKCE) in the system browser.
 * Enable the providers in Supabase → Auth → Providers and add the redirect URL
 * (perkly://auth-callback, plus the Expo Go URL in development) to the allow list.
 */
export async function signInWithProvider(provider: 'google' | 'apple') {
  const redirectTo = Linking.createURL('auth-callback');
  const { data, error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo, skipBrowserRedirect: true } });
  if (error || !data.url) return { error: error?.message ?? 'Could not start sign-in' };
  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (res.type !== 'success') return { error: null, cancelled: true };
  const url = new URL(res.url);
  const code = url.searchParams.get('code');
  const errDesc = url.searchParams.get('error_description');
  if (errDesc) return { error: errDesc };
  if (!code) return { error: 'Sign-in was not completed' };
  const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
  return { error: exErr?.message ?? null };
}
