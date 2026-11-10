import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View, useWindowDimensions } from 'react-native';
import { MascotPin } from '@/components/mascot';
import { Button, Screen, T } from '@/components/ui';
import { useSession } from '@/lib/session';
import { brand } from '@/lib/theme';
import { t } from '@/lib/i18n';

export default function LocationPermission() {
  const { refreshLocation } = useSession();
  const { height } = useWindowDimensions();
  const [busy, setBusy] = useState(false);
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [bob]);

  async function enable() {
    setBusy(true);
    await refreshLocation(true);
    setBusy(false);
    router.replace('/');
  }

  return (
    <Screen scroll={false} edges={['top', 'bottom']} style={{ justifyContent: 'space-between' }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        <Animated.View style={{ transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -12] }) }] }}>
          <MascotPin size={Math.min(150, height * 0.2)} />
        </Animated.View>
        <T v="h1" style={{ textAlign: 'center' }}>{t('Find Perks Around You')}</T>
        <T v="muted" style={{ textAlign: 'center', paddingHorizontal: 12 }}>
          {t('Turn on location so we can show the closest deals and confirm you’re in-store when you redeem.')}
        </T>
      </View>
      <View style={{ gap: 6 }}>
        <Button title={t('Turn On Location')} icon="📍" onPress={enable} loading={busy} />
        <Pressable onPress={() => router.replace('/')} style={{ padding: 14 }}>
          <T style={{ textAlign: 'center', fontWeight: '800' }} color={brand.purple}>{t('Not Now')}</T>
        </Pressable>
      </View>
    </Screen>
  );
}
