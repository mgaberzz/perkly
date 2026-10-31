import { CameraView, useCameraPermissions } from 'expo-camera';
import { useIsFocused } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HowItWorks, hasSeenHowItWorks } from '@/components/how-it-works';
import { Button, Card, T } from '@/components/ui';
import { extractCode } from '@/lib/redemption-store';
import { brand, useTheme } from '@/lib/theme';

export default function Scan() {
  const { c } = useTheme();
  const focused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState('');
  const [showManual, setShowManual] = useState(Platform.OS === 'web');
  const [guide, setGuide] = useState(false);
  useEffect(() => { if (focused) hasSeenHowItWorks().then((seen) => { if (!seen) setGuide(true); }); }, [focused]);
  const locked = useRef(false);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  useEffect(() => { if (focused) locked.current = false; }, [focused]);

  function open(raw: string) {
    if (locked.current || !raw.trim()) return;
    locked.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.push(`/redeem/${encodeURIComponent(extractCode(raw))}`);
  }

  const frameOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }} edges={['top']}>
      {permission?.granted && focused && !showManual ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => open(data)}
        />
      ) : null}
      <View style={{ flex: 1, padding: 24, justifyContent: 'space-between' }}>
        <View style={{ gap: 6 }}>
          <Text style={{ color: '#fff', fontSize: 28, fontWeight: '900' }}>Scan to save 💜</Text>
          <Text style={{ color: '#ffffffcc', fontWeight: '600' }}>Point your camera at the Perkly QR on the cashier table.</Text>
          <Text onPress={() => setGuide(true)} style={{ color: '#fff', fontWeight: '800', textDecorationLine: 'underline', marginTop: 4 }}>How it works?</Text>
        </View>

        {!showManual && permission?.granted && (
          <Animated.View style={{ alignSelf: 'center', width: 260, height: 260, borderRadius: 32, borderWidth: 4, borderColor: brand.purple, borderStyle: 'dashed', opacity: frameOpacity }} />
        )}

        {!showManual && permission && !permission.granted && (
          <Card style={{ gap: 12 }}>
            <T v="h3">Camera access needed 📷</T>
            <T v="muted">Perkly uses your camera only to scan the merchant's QR code.</T>
            <Button title={permission.canAskAgain ? 'Allow camera' : 'Open settings to allow'} onPress={requestPermission} />
          </Card>
        )}

        {showManual ? (
          <Card style={{ gap: 12 }}>
            <T v="h3">Type the code</T>
            <T v="muted">It's printed under the QR (starts with PK-).</T>
            <TextInput
              value={manual} onChangeText={setManual} autoCapitalize="characters" autoCorrect={false} placeholder="PK-XXXXXXXXXX"
              placeholderTextColor={c.textMuted}
              style={{ borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 14, fontSize: 18, fontWeight: '800', color: c.text, letterSpacing: 1 }}
            />
            <Button title="Continue" onPress={() => { locked.current = false; open(manual); }} disabled={manual.trim().length < 5} />
            {Platform.OS !== 'web' && <Button variant="ghost" title="Back to camera" onPress={() => setShowManual(false)} />}
          </Card>
        ) : (
          <Button variant="secondary" title="QR won't scan? Type the code" onPress={() => setShowManual(true)} />
        )}
      </View>
      <HowItWorks visible={guide} onClose={() => setGuide(false)} />
    </SafeAreaView>
  );
}
