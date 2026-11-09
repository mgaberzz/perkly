import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Sentry } from './sentry';
import { supabase } from './supabase';

const TOKEN_KEY = 'perkly.pushToken';

// Show notifications as banners even while the app is open
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

export type PushResult = 'ok' | 'denied' | 'blocked' | 'unsupported' | 'no_project' | 'error';

/** Why the last registration failed (shown in Settings, also sent to Sentry). */
export let lastPushError: string | null = null;

/**
 * Gets this phone's Expo push token and saves it on the signed-in account.
 * ask=false only registers when permission was already given (safe to call on every app start).
 * Needs an EAS project ID in app.json (run `npx eas-cli init` once) and a real phone.
 */
export async function registerPush(ask: boolean): Promise<PushResult> {
  lastPushError = null;
  try {
    if (Platform.OS === 'web' || !Device.isDevice) return 'unsupported';
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', { name: 'Perkly', importance: Notifications.AndroidImportance.HIGH });
    }
    let perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && ask && perm.canAskAgain) perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) return perm.canAskAgain ? 'denied' : 'blocked';
    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return 'no_project';
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    const { data, error } = await supabase.rpc('register_push_token', { p_token: token, p_platform: Platform.OS });
    if (error || !(data as { ok?: boolean } | null)?.ok) {
      lastPushError = error?.message ?? (data as { error?: string } | null)?.error ?? 'save_failed';
      Sentry.captureMessage(`Push token not saved: ${lastPushError}`);
      return 'error';
    }
    await AsyncStorage.setItem(TOKEN_KEY, token);
    return 'ok';
  } catch (e) {
    lastPushError = e instanceof Error ? e.message : String(e);
    Sentry.captureException(e);
    return 'error';
  }
}

/** Stops pushes to this phone for the account that is signing out (call while still signed in). */
export async function unregisterPush() {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return;
    await supabase.rpc('unregister_push_token', { p_token: token });
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch { /* offline: the token moves to the next account that signs in on this phone */ }
}

/** Opens the screen a notification points to when it's tapped (also when it launched the app). */
export function useNotificationTaps(enabled: boolean) {
  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;
    const open = (r: Notifications.NotificationResponse | null) => {
      const url = r?.notification.request.content.data?.url;
      const id = r?.notification.request.content.data?.notification_id;
      if (typeof id === 'string') supabase.rpc('mark_notifications_read', { p_ids: [id] }).then(() => {});
      if (typeof url === 'string' && url.startsWith('/')) router.push(url as Href);
    };
    Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [enabled]);
}
