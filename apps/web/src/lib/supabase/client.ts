"use client";
import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

export function createClient() {
  // Passkeys = Face ID / Touch ID / Windows Hello / fingerprint sign-in in the browser
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { experimental: { passkey: true } } });
}
