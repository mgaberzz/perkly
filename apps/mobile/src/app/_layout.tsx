import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BiometricGate } from '@/components/biometric-gate';
import { OfflineBar } from '@/components/offline-bar';
import { biometricAvailable, biometricEnabled, setBiometricEnabled } from '@/lib/biometric';
import { initLanguage, t } from '@/lib/i18n';
import { useNotificationTaps } from '@/lib/push';
import { Sentry } from '@/lib/sentry';
import { SessionProvider, useSession } from '@/lib/session';
import { brand } from '@/lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootStack() {
  const { ready, session, profile, quickLogin, signOut } = useSession();
  const segments = useSegments();
  useNotificationTaps(ready && !!session);
  useEffect(() => { if (ready) SplashScreen.hideAsync().catch(() => {}); }, [ready]);

  // Signed out anywhere (logout from Settings, expired session…) → back to the welcome screen
  const inAuth = segments[0] === '(auth)';
  useEffect(() => {
    if (!ready || session || inAuth) return;
    if (router.canDismiss()) router.dismissAll();
    router.replace(quickLogin.available ? '/login' : '/welcome');
  }, [ready, session, inAuth, quickLogin.available]);

  // After the first login on this phone, offer Face ID / fingerprint once
  const onboarded = !!profile?.terms_accepted_at;
  useEffect(() => {
    if (!session || !onboarded) return;
    (async () => {
      if ((await AsyncStorage.getItem('perkly.biometricAsked')) || (await biometricEnabled())) return;
      const bio = await biometricAvailable().catch(() => ({ ok: false, label: '' }));
      if (!bio.ok) return;
      await AsyncStorage.setItem('perkly.biometricAsked', '1');
      Alert.alert(t('Log in faster?'), t('Use {method} to open Perkly — you stay signed in, no codes or passwords.', { method: bio.label }), [
        { text: t('Not now'), style: 'cancel' },
        { text: t('Turn on'), onPress: () => { setBiometricEnabled(true).catch(() => {}); } },
      ]);
    })();
  }, [session, onboarded]);
  if (!ready) return null;
  return (
    <BiometricGate active={!!session} onUsePassword={() => signOut()}>
    <Stack screenOptions={{ headerShown: false, headerTintColor: brand.purple, headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="merchant/[id]" options={{ headerShown: true, headerTransparent: true, title: '' }} />
      <Stack.Screen name="redeem/[code]" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="success" options={{ gestureEnabled: false, animation: 'fade' }} />
      <Stack.Screen name="history" options={{ headerShown: true, title: t('Savings history') }} />
      <Stack.Screen name="perk/[id]" />
      <Stack.Screen name="category/[name]" />
      <Stack.Screen name="collection/[key]" />
      <Stack.Screen name="explain" />
      <Stack.Screen name="arcade" options={{ animation: 'fade_from_bottom' }} />
      <Stack.Screen name="notifications" options={{ headerShown: true, title: t('Notifications') }} />
      <Stack.Screen name="student-verification" options={{ headerShown: true, title: t('Student verification') }} />
      <Stack.Screen name="settings" options={{ headerShown: true, title: t('Settings') }} />
      <Stack.Screen name="avatar" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="edit-profile" options={{ headerShown: true, title: t('Edit profile') }} />
    </Stack>
    </BiometricGate>
  );
}

function RootLayout() {
  const scheme = useColorScheme();
  // Load the saved language before anything renders, so every screen starts in the right language
  const [langReady, setLangReady] = useState(false);
  useEffect(() => { initLanguage().finally(() => setLangReady(true)); }, []);
  if (!langReady) return null;
  return (
    <SafeAreaProvider>
      <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
        <SessionProvider>
          <StatusBar style="auto" />
          <RootStack />
          <OfflineBar />
        </SessionProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

// Sentry.wrap reports crashes that happen while rendering any screen
export default Sentry.wrap(RootLayout);
