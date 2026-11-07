import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from '@/lib/session';
import { brand } from '@/lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootStack() {
  const { ready } = useSession();
  useEffect(() => { if (ready) SplashScreen.hideAsync().catch(() => {}); }, [ready]);
  if (!ready) return null;
  return (
    <Stack screenOptions={{ headerShown: false, headerTintColor: brand.purple, headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="merchant/[id]" options={{ headerShown: true, headerTransparent: true, title: '' }} />
      <Stack.Screen name="redeem/[code]" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="success" options={{ gestureEnabled: false, animation: 'fade' }} />
      <Stack.Screen name="history" options={{ headerShown: true, title: 'Savings history' }} />
      <Stack.Screen name="perk/[id]" />
      <Stack.Screen name="category/[name]" />
      <Stack.Screen name="collection/[key]" />
      <Stack.Screen name="arcade" options={{ animation: 'fade_from_bottom' }} />
      <Stack.Screen name="settings" options={{ headerShown: true, title: 'Settings' }} />
      <Stack.Screen name="edit-profile" options={{ headerShown: true, title: 'Edit profile' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const scheme = useColorScheme();
  return (
    <SafeAreaProvider>
      <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
        <SessionProvider>
          <StatusBar style="auto" />
          <RootStack />
        </SessionProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
