import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import { Text, TextInput } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mascot } from '@/components/mascot';
import { Button, T } from '@/components/ui';
import { signInWithProvider } from '@/lib/oauth';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { brand, gradient, useTheme } from '@/lib/theme';
import { t } from '@/lib/i18n';

/** Normalize Egyptian mobile numbers to E.164 (+20…) */
function toE164(raw: string) {
  const d = raw.replace(/\D/g, '');
  if (d.startsWith('20')) return `+${d}`;
  if (d.startsWith('0')) return `+20${d.slice(1)}`;
  return `+20${d}`;
}

const TOASTS = ['You saved 22 EGP today 🎉', '+45 XP · 5-day streak 🔥', 'New perk near AUC ☕ 15% OFF'] as const;

/** Hero: floating perk cards + rotating notification toast */
function Hero() {
  const [i, setI] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const timer = setInterval(() => {
      Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setI((x) => (x + 1) % TOASTS.length);
        Animated.timing(fade, { toValue: 1, duration: 250, useNativeDriver: true }).start();
      });
    }, 2600);
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 1600, useNativeDriver: true }),
      Animated.timing(float, { toValue: 0, duration: 1600, useNativeDriver: true }),
    ]));
    loop.start();
    return () => { clearInterval(timer); loop.stop(); };
  }, [fade, float]);
  const y = float.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const Card = ({ emoji, title, badge, style }: { emoji: string; title: string; badge: string; style: object }) => (
    <Animated.View style={[{ position: 'absolute', backgroundColor: '#fff', borderRadius: 20, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10,
      shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4, transform: [{ translateY: y }] }, style]}>
      <Text style={{ fontSize: 26 }}>{emoji}</Text>
      <View><Text style={{ fontWeight: '900', color: brand.ink }}>{title}</Text>
        <Text style={{ fontWeight: '900', color: brand.pink, fontSize: 12 }}>{badge}</Text></View>
    </Animated.View>
  );
  return (
    <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 340, borderBottomLeftRadius: 36, borderBottomRightRadius: 36, overflow: 'hidden' }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 26, marginStart: 24, marginTop: 8 }}>Perkly</Text>
        <View style={{ flex: 1 }}>
          <View style={{ position: 'absolute', alignSelf: 'center', top: 62 }}><Mascot size={92} /></View>
          <Card emoji="☕" title={t('Coffee run')} badge={t('{n}% OFF', { n: 15 })} style={{ left: 20, top: 16 }} />
          <Card emoji="🍔" title={t('Burger night')} badge={t('{n}% OFF', { n: 20 })} style={{ right: 18, top: 150 }} />
          <Animated.View style={{ position: 'absolute', left: 24, right: 24, bottom: 18, opacity: fade, backgroundColor: '#ffffffee', borderRadius: 18, padding: 12, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: brand.purple, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontWeight: '900' }}>P</Text></View>
            <Text style={{ fontWeight: '800', color: brand.ink, flex: 1 }}>{t(TOASTS[i])}</Text>
          </Animated.View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

export default function Login() {
  const { c } = useTheme();
  const [mode, setMode] = useState<'phone' | 'email'>('phone');
  const [value, setValue] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState<null | 'otp' | 'google' | 'apple'>(null);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setError(null);
    const target = mode === 'phone' ? toE164(value) : value.trim().toLowerCase();
    if (mode === 'phone' && !/^\+201[0125]\d{8}$/.test(target)) return setError(t('That doesn’t look like an Egyptian mobile number. Try 01x xxxx xxxx.'));
    if (mode === 'email' && !/^\S+@\S+\.\S+$/.test(target)) return setError(t('Enter a valid email.'));
    setLoading('otp');
    // Email + password (accounts created in Supabase or via invite) — no code needed
    if (mode === 'email' && password) {
      const { error: pwErr } = await supabase.auth.signInWithPassword({ email: target, password });
      setLoading(null);
      if (pwErr) return setError(t('Wrong email or password.'));
      router.replace('/');
      return;
    }
    const { error: err } = mode === 'phone'
      ? await supabase.auth.signInWithOtp({ phone: target })
      : await supabase.auth.signInWithOtp({ email: target, options: { shouldCreateUser: true } });
    setLoading(null);
    if (err) return setError(err.message.toLowerCase().includes('rate') ? t('Too many tries. Wait a minute and try again.') : t('We couldn’t send a code to that number. Try again or use email.'));
    router.push({ pathname: '/verify', params: { mode, target } });
  }

  async function social(p: 'google' | 'apple') {
    setError(null); setLoading(p);
    const res = await signInWithProvider(p);
    setLoading(null);
    if (res.error) setError(t(res.error));
    else if (!('cancelled' in res)) router.replace('/');
  }

  const box = { backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: error ? brand.danger : c.border };
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Hero />
        <View style={{ padding: 24, gap: 16 }}>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <T v="h1" style={{ textAlign: 'center' }}>{t('Log in or sign up')}</T>
            <T v="muted" style={{ textAlign: 'center' }}>{t('Student perks at cafés, restaurants, gyms and stores around your campus.')}</T>
          </View>
          {!supabaseConfigured && <T v="small" color={brand.danger}>Supabase isn't configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.</T>}

          {mode === 'phone' ? (
            <View style={{ flexDirection: 'row', gap: 10, direction: 'ltr' }}>
              <View style={[box, { paddingHorizontal: 16, justifyContent: 'center' }]}>
                <T v="h3" numberOfLines={1}>🇪🇬  +20</T>
              </View>
              <TextInput value={value} onChangeText={setValue} placeholder="10 1234 5678" placeholderTextColor={c.textMuted}
                keyboardType="phone-pad" autoComplete="tel" maxLength={13}
                style={[box, { flex: 1, minWidth: 0, paddingHorizontal: 16, paddingVertical: 18, fontSize: 18, fontWeight: '700', color: c.text, textAlign: 'left' }]} />
            </View>
          ) : (
            <TextInput value={value} onChangeText={setValue} placeholder="you@university.edu.eg" placeholderTextColor={c.textMuted}
              keyboardType="email-address" autoCapitalize="none" autoComplete="email"
              style={[box, { paddingHorizontal: 16, paddingVertical: 18, fontSize: 18, fontWeight: '700', color: c.text }]} />
          )}
          {mode === 'email' && (
            <TextInput value={password} onChangeText={setPassword} placeholder={t('Password (optional)')} placeholderTextColor={c.textMuted}
              secureTextEntry autoCapitalize="none" autoComplete="password"
              style={[box, { paddingHorizontal: 16, paddingVertical: 18, fontSize: 18, fontWeight: '700', color: c.text }]} />
          )}
          {mode === 'email' && <T v="small">{t('Have a password? Enter it to sign in. Leave it empty and we’ll email you a code.')}</T>}
          {error && <T v="small" color={brand.danger}>{error}</T>}
          <Button title={mode === 'email' && password ? t('Sign in') : t('Continue')} onPress={send} loading={loading === 'otp'} disabled={!value.trim()} />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
            <T v="small">{t('or continue with')}</T>
            <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <SocialButton label="Google" icon="G" onPress={() => social('google')} loading={loading === 'google'} />
            {Platform.OS !== 'android' && <SocialButton label="Apple" icon={Platform.OS === 'ios' ? '\uF8FF' : '🍎'} dark onPress={() => social('apple')} loading={loading === 'apple'} />}
            <SocialButton label={mode === 'phone' ? t('Email') : t('Phone')} icon={mode === 'phone' ? '✉️' : '📱'}
              onPress={() => { setMode(mode === 'phone' ? 'email' : 'phone'); setValue(''); setPassword(''); setError(null); }} />
          </View>

          <T v="small" style={{ textAlign: 'center', marginTop: 8, lineHeight: 18 }}>
            {t('By continuing you agree to Perkly’s')}{' '}
            <Text style={{ color: brand.purple, fontWeight: '800' }} onPress={() => Linking.openURL('https://perkly.app/terms')}>{t('Terms')}</Text> {t('and')}{' '}
            <Text style={{ color: brand.purple, fontWeight: '800' }} onPress={() => Linking.openURL('https://perkly.app/privacy')}>{t('Privacy Policy')}</Text>.
          </T>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SocialButton({ label, icon, onPress, dark, loading }: { label: string; icon: string; onPress: () => void; dark?: boolean; loading?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={loading} style={({ pressed }) => ({
      flex: 1, minWidth: 96, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
      backgroundColor: dark ? '#000' : c.card, borderWidth: dark ? 0 : 1, borderColor: c.border, opacity: pressed || loading ? 0.7 : 1,
    })}>
      <Text style={{ fontSize: 18, fontWeight: '900', color: dark ? '#fff' : label === 'Google' ? '#4285F4' : c.text }}>{icon}</Text>
      <Text style={{ fontWeight: '800', color: dark ? '#fff' : c.text }}>{loading ? '…' : label}</Text>
    </Pressable>
  );
}
