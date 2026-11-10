import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { TextInput } from '@/components/text';
import { Button, Screen, T } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { brand, useTheme } from '@/lib/theme';
import { t } from '@/lib/i18n';

export default function Verify() {
  const { c } = useTheme();
  const { mode, target } = useLocalSearchParams<{ mode: 'phone' | 'email'; target: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(30);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function verify(token = code) {
    if (token.length < 6) return;
    setLoading(true); setError(null);
    const { error: err } = mode === 'phone'
      ? await supabase.auth.verifyOtp({ phone: target, token, type: 'sms' })
      : await supabase.auth.verifyOtp({ email: target, token, type: 'email' });
    setLoading(false);
    if (err) {
      const msg = err.message.toLowerCase();
      setError(msg.includes('expired') ? t('That code expired. Send a new one.') : msg.includes('rate') ? t('Too many attempts. Wait a minute and try again.') : t('Invalid code. Check and try again.'));
      return;
    }
    router.replace('/');
  }

  async function resend() {
    setCooldown(30); setError(null);
    const { error: err } = mode === 'phone' ? await supabase.auth.signInWithOtp({ phone: target }) : await supabase.auth.signInWithOtp({ email: target });
    if (err) setError(err.message);
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ gap: 8, marginTop: 24 }}>
        <T v="h1">{t('Enter Your Code')}</T>
        <T v="muted">{t('Sent to {target}', { target })}</T>
      </View>
      <TextInput
        value={code}
        // 6-digit codes: Supabase → Auth → Email (and Phone) OTP length must be set to 6
        onChangeText={(txt) => { const v = txt.replace(/\D/g, '').slice(0, 6); setCode(v); if (v.length === 6) verify(v); }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        autoFocus
        maxLength={6}
        placeholder="••••••"
        placeholderTextColor={c.textMuted}
        style={{ backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 18, fontSize: 32, letterSpacing: 12, textAlign: 'center', writingDirection: 'ltr', fontWeight: '900', color: c.text }}
      />
      {error && <T v="small" color={brand.danger}>{error}</T>}
      <Button title={t('Verify')} onPress={() => verify()} loading={loading} disabled={code.length < 6} />
      <Button variant="ghost" title={cooldown > 0 ? t('Resend in {n}s', { n: cooldown }) : t('Resend Code')} disabled={cooldown > 0} onPress={resend} />
    </Screen>
  );
}
