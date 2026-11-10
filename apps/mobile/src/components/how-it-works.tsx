import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, View, useWindowDimensions } from 'react-native';
import { Text } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from './ui';
import { brand, gradient, useTheme } from '@/lib/theme';
import { backChevron, fwdChevron, t } from '@/lib/i18n';

const KEY = 'perkly.seenHowItWorks';
const STEP_MS = 5000;

/** Illustrations drawn with views (no image assets needed). */
function StepArt({ step }: { step: number }) {
  const phone = (children: React.ReactNode) => (
    <View style={{ width: 170, height: 250, borderRadius: 28, backgroundColor: '#fff', borderWidth: 6, borderColor: brand.ink, overflow: 'hidden' }}>{children}</View>
  );
  return (
    <View style={{ width: 280, height: 280, borderRadius: 140, backgroundColor: '#FF3EA522', alignItems: 'center', justifyContent: 'center' }}>
      {step === 0 && (
        <View style={{ alignItems: 'center' }}>
          <LinearGradient colors={gradient} style={{ width: 130, height: 150, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <View style={{ width: 80, height: 80, backgroundColor: '#fff', borderRadius: 10, padding: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
              {Array.from({ length: 9 }).map((_, i) => <View key={i} style={{ width: 18, height: 18, borderRadius: 3, backgroundColor: i % 2 ? brand.ink : '#fff', borderWidth: 2, borderColor: brand.ink }} />)}
            </View>
            <Text style={{ color: '#fff', fontWeight: '900' }}>Perkly</Text>
          </LinearGradient>
          <View style={{ width: 200, height: 14, borderRadius: 6, backgroundColor: '#C9C3D6', marginTop: -4 }} />
          <Text style={{ position: 'absolute', right: -40, top: 20, fontSize: 64 }}>📱</Text>
        </View>
      )}
      {step === 1 && phone(
        <View>
          <LinearGradient colors={gradient} style={{ padding: 10, paddingTop: 16 }}>
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>☕ Brown Nose</Text>
            <Text style={{ color: '#ffffffcc', fontSize: 9 }}>AUC Gate 4 · 80 m</Text>
          </LinearGradient>
          <View style={{ padding: 10, gap: 6 }}>
            <Text style={{ fontSize: 9, color: '#6B6680' }}>{t('How much are you paying?')}</Text>
            <Text style={{ fontSize: 26, fontWeight: '900', color: brand.ink, textAlign: 'right' }}>180.00</Text>
            <Text style={{ fontSize: 10, fontWeight: '800', color: brand.success }}>{t('You Save {amount} 🎉', { amount: `27 ${t('EGP')}` })}</Text>
            <LinearGradient colors={gradient} style={{ borderRadius: 10, padding: 8, marginTop: 20 }}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 11, textAlign: 'center' }}>{t('Redeem Now')}</Text>
            </LinearGradient>
          </View>
        </View>,
      )}
      {step === 2 && phone(
        <LinearGradient colors={[brand.success, '#0E9F6E']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 10 }}>
          <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: brand.success, fontSize: 30, fontWeight: '900' }}>✓</Text>
          </View>
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>{t('{n}% OFF', { n: 15 })}</Text>
          <View style={{ backgroundColor: brand.ink, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ color: '#fff', fontWeight: '900', letterSpacing: 3 }}>7F3A</Text>
          </View>
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>+45 XP ⚡</Text>
        </LinearGradient>,
      )}
    </View>
  );
}

const STEPS = [
  { title: 'Scan the QR', body: 'Find the Perkly QR on the cashier table and scan it from the Scan tab.' },
  { title: 'Pick Your Perk & Enter the Bill', body: 'Choose the perk, type what you’re paying and see your savings instantly.' },
  { title: 'Show the Green Screen', body: 'The cashier checks the live screen and applies your discount. You earn XP! 🎉' },
];

export function HowItWorks({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { c } = useTheme();
  const { width: winW, height: winH } = useWindowDimensions();
  const artScale = Math.min(1, (winW - 60) / 280, (winH * 0.36) / 280);
  const [step, setStep] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    progress.setValue(0);
    const anim = Animated.timing(progress, { toValue: 1, duration: STEP_MS, easing: Easing.linear, useNativeDriver: false });
    anim.start(({ finished }) => { if (finished && step < STEPS.length - 1) setStep((s) => s + 1); });
    return () => anim.stop();
  }, [step, visible, progress]);

  useEffect(() => { if (visible) setStep(0); }, [visible]);

  const close = () => { AsyncStorage.setItem(KEY, '1').catch(() => {}); onClose(); };
  const last = step === STEPS.length - 1;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingTop: 8 }}>
          {STEPS.map((_, i) => (
            <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: c.border, overflow: 'hidden' }}>
              <Animated.View style={{ height: '100%', backgroundColor: brand.pink,
                width: i < step ? '100%' : i > step ? '0%' : progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16 }}>
          <Pressable onPress={() => (step ? setStep(step - 1) : close())} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 22, color: c.text }}>{step ? backChevron() : '✕'}</Text>
          </Pressable>
          {!last && <Pressable onPress={close}><Text style={{ color: brand.purple, fontWeight: '800', padding: 10 }}>{t('Skip')}</Text></Pressable>}
        </View>
        <Pressable style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 28 }} onPress={() => !last && setStep(step + 1)}>
          <View style={{ transform: [{ scale: artScale }] , height: 280 * artScale, justifyContent: 'center' }}><StepArt step={step} /></View>
          <Text style={{ color: c.textMuted, fontWeight: '700', marginTop: 16 }}>{t('Step {n}', { n: step + 1 })}</Text>
          <Text style={{ color: c.text, fontSize: winW < 360 ? 22 : 28, fontWeight: '900', textAlign: 'center' }}>{t(STEPS[step].title)}</Text>
          <Text style={{ color: c.textMuted, fontSize: 16, textAlign: 'center', fontWeight: '500' }}>{t(STEPS[step].body)}</Text>
        </Pressable>
        <View style={{ padding: 20 }}>
          {last ? <Button title={t('Got it!')} onPress={close} /> : <Button variant="secondary" title={`${t('Next')} ${fwdChevron()}`} onPress={() => setStep(step + 1)} />}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

export async function hasSeenHowItWorks() {
  return (await AsyncStorage.getItem(KEY)) === '1';
}
