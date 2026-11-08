import type { Session } from '@supabase/supabase-js';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { biometricEnabled, unlock } from './biometric';
import { supabase } from './supabase';
import type { Campus, Merchant, Profile, Stats } from './types';
import { lang, t } from './i18n';
import { registerPush, unregisterPush } from './push';

type Coords = { lat: number; lng: number } | null;
/** Where the student is browsing: around their GPS position, or a chosen campus/area. */
export type Area = { kind: 'nearby' } | { kind: 'campus'; campus: Campus };

type Ctx = {
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  stats: Stats | null;
  campus: Campus | null;
  merchants: Merchant[];
  coords: Coords;
  favorites: Set<string>;
  /** Browsing area + derived origin for distances */
  area: Area;
  setArea: (a: Area) => void;
  origin: Coords;
  areaLabel: string;
  recentAreas: Campus[];
  clearRecentAreas: () => void;
  /** Redemptions in the last 30 days, by perk id */
  popularity: Record<string, number>;
  refreshProfile: () => Promise<void>;
  refreshMerchants: () => Promise<void>;
  refreshLocation: (ask?: boolean) => Promise<Coords>;
  toggleFavorite: (merchantId: string) => Promise<void>;
  /** Log out. With biometric login on (and keepQuickLogin), the session stays parked on this phone for "Log in with Face ID". */
  signOut: (opts?: { keepQuickLogin?: boolean }) => Promise<void>;
  /** A parked session exists → the login screen offers "Log in with Face ID" */
  quickLogin: { available: boolean; email: string | null };
  biometricLogin: () => Promise<{ ok: boolean; error?: string }>;
};

const SessionContext = createContext<Ctx | null>(null);
const PARKED_KEY = 'perkly.parkedSession';

const MERCHANT_SELECT =
  'id, name, category, subcategory, description, logo_url, cover_url, channel, website_url, affiliate_url, ' +
  'perks(id, title, description, terms, discount_type, discount_value, max_discount_amount, min_spend, is_flash, end_at, branch_id, priority_score, valid_days), ' +
  'branches:merchant_branches(id, name, address, lat, lng, campus_id)';

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authSession, setSession] = useState<Session | null>(null);
  // Parked = logged out in the app, but the session is kept on this phone for biometric login
  const [parked, setParked] = useState(false);
  const session = parked ? null : authSession;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [campus, setCampus] = useState<Campus | null>(null);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [coords, setCoords] = useState<Coords>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [area, setAreaState] = useState<Area>({ kind: 'nearby' });
  const [recentAreas, setRecentAreas] = useState<Campus[]>([]);
  const [popularity, setPopularity] = useState<Record<string, number>>({});

  useEffect(() => {
    AsyncStorage.getItem('perkly.recentAreas').then((v) => { if (v) setRecentAreas(JSON.parse(v)); }).catch(() => {});
  }, []);

  const setArea = useCallback((a: Area) => {
    setAreaState(a);
    if (a.kind === 'campus') {
      setRecentAreas((prev) => {
        const next = [a.campus, ...prev.filter((x) => x.id !== a.campus.id)].slice(0, 4);
        AsyncStorage.setItem('perkly.recentAreas', JSON.stringify(next)).catch(() => {});
        return next;
      });
    }
  }, []);
  const clearRecentAreas = useCallback(() => {
    setRecentAreas([]);
    AsyncStorage.removeItem('perkly.recentAreas').catch(() => {});
  }, []);

  const userId = session?.user.id;

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    const [{ data: p }, { data: s }, { data: f }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, phone, email, campus_id, referral_code, status, role, birth_date, marketing_opt_in, terms_accepted_at, referred_by, user_code, student_code, avatar_path, avatar_config, avatar_kind, verification_status, verified_until, lang').eq('id', userId).single<Profile>(),
      supabase.from('user_stats').select('*').eq('user_id', userId).single<Stats>(),
      supabase.from('favorites').select('merchant_id').eq('user_id', userId),
    ]);
    setProfile(p ?? null);
    setStats(s ?? null);
    // Messages from Perkly arrive in the language the app is in
    if (p && (p as Profile & { lang?: string }).lang !== lang()) supabase.from('profiles').update({ lang: lang() }).eq('id', p.id).then(() => {});
    setFavorites(new Set((f ?? []).map((x: { merchant_id: string }) => x.merchant_id)));
    if (p?.campus_id) {
      const { data: c } = await supabase.from('campuses').select('*').eq('id', p.campus_id).single<Campus>();
      setCampus(c ?? null);
    } else setCampus(null);
  }, [userId]);

  useEffect(() => { if (userId) registerPush(false); }, [userId]);

  const refreshMerchants = useCallback(async () => {
    const [{ data }, { data: pop }] = await Promise.all([
      supabase.from('merchants').select(MERCHANT_SELECT).eq('status', 'live').order('name').returns<Merchant[]>(),
      supabase.rpc('perk_popularity'),
    ]);
    setPopularity(Object.fromEntries(((pop ?? []) as { perk_id: string; redemptions_30d: number }[]).map((r) => [r.perk_id, Number(r.redemptions_30d)])));
    const now = Date.now();
    setMerchants(
      (data ?? [])
        .map((m) => ({ ...m, perks: m.perks.filter((p) => !p.end_at || new Date(p.end_at).getTime() > now) }))
        .filter((m) => m.perks.length > 0),
    );
  }, []);

  const refreshLocation = useCallback(async (ask = false): Promise<Coords> => {
    try {
      let perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted && ask && perm.canAskAgain) perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return null;
      const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 });
      const pos = last ?? (await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
      ]));
      if (!pos) return null;
      const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setCoords(c);
      return c;
    } catch {
      return null;
    }
  }, []);

  const toggleFavorite = useCallback(async (merchantId: string) => {
    if (!userId) return;
    const isFav = favorites.has(merchantId);
    setFavorites((prev) => {
      const next = new Set(prev);
      if (isFav) next.delete(merchantId); else next.add(merchantId);
      return next;
    });
    if (isFav) await supabase.from('favorites').delete().eq('user_id', userId).eq('merchant_id', merchantId);
    else await supabase.from('favorites').insert({ user_id: userId, merchant_id: merchantId });
  }, [favorites, userId]);

  const signOut = useCallback(async (opts?: { keepQuickLogin?: boolean }) => {
    if (opts?.keepQuickLogin !== false && (await biometricEnabled())) {
      await AsyncStorage.setItem(PARKED_KEY, '1');
      setParked(true);
      return;
    }
    // Full sign-out: stop pushes to this phone, then clear the session on this device right away
    await Promise.race([unregisterPush(), new Promise((r) => setTimeout(r, 2500))]);
    await AsyncStorage.removeItem(PARKED_KEY).catch(() => {});
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    setParked(false);
    setSession(null);
  }, []);

  const biometricLogin = useCallback(async () => {
    const ok = await unlock().catch(() => false);
    if (!ok) return { ok: false };
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      // Session expired on the server → normal login needed
      await AsyncStorage.removeItem(PARKED_KEY).catch(() => {});
      setParked(false);
      return { ok: false, error: 'expired' };
    }
    await AsyncStorage.removeItem(PARKED_KEY).catch(() => {});
    setSession(data.session);
    setParked(false);
    return { ok: true };
  }, []);

  useEffect(() => {
    Promise.all([supabase.auth.getSession(), AsyncStorage.getItem(PARKED_KEY).catch(() => null)]).then(([{ data }, p]) => {
      setSession(data.session);
      setParked(Boolean(data.session) && p === '1');
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      // A fresh sign-in (code, password, Google, Apple) replaces any parked session
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') { setParked(false); AsyncStorage.removeItem(PARKED_KEY).catch(() => {}); }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) {
      setProfile(null); setStats(null); setCampus(null);
      return;
    }
    refreshProfile();
    refreshMerchants();
    refreshLocation(false);
    // +5 XP for opening the app today (no-op if already claimed)
    supabase.rpc('daily_checkin').then(() => refreshProfile());
  }, [userId, refreshProfile, refreshMerchants, refreshLocation]);

  const origin: Coords = useMemo(() => {
    if (area.kind === 'campus') return area.campus.lat != null && area.campus.lng != null ? { lat: area.campus.lat, lng: area.campus.lng } : null;
    if (coords) return coords;
    return campus?.lat != null && campus?.lng != null ? { lat: campus.lat, lng: campus.lng } : null;
  }, [area, coords, campus]);
  const areaLabel = area.kind === 'campus' ? area.campus.name : coords ? t('Near you') : campus ? t('Around {place}', { place: campus.short_name ?? campus.name }) : t('Egypt');

  const quickLogin = useMemo(() => ({ available: parked && Boolean(authSession), email: authSession?.user.email ?? authSession?.user.phone ?? null }), [parked, authSession]);

  const value = useMemo<Ctx>(() => ({
    ready, session, quickLogin, biometricLogin, profile, stats, campus, merchants, coords, favorites,
    area, setArea, origin, areaLabel, recentAreas, clearRecentAreas, popularity,
    refreshProfile, refreshMerchants, refreshLocation, toggleFavorite, signOut,
  }), [ready, session, profile, stats, campus, merchants, coords, favorites, area, setArea, origin, areaLabel, recentAreas, clearRecentAreas, popularity,
    refreshProfile, refreshMerchants, refreshLocation, toggleFavorite, signOut, quickLogin, biometricLogin]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}

/** Where a signed-in student still needs to go before using the app. */
export function onboardingStep(profile: Profile | null): '/details' | '/consent' | null {
  if (!profile) return null;
  if (!profile.full_name || !profile.campus_id) return '/details';
  if (!profile.terms_accepted_at) return '/consent';
  return null;
}
