import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { Text, TextInput } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Empty, MerchantLogo, Screen, T } from '@/components/ui';
import { friendlyError } from '@/lib/errors';
import { discountLabel, distanceLabel, distanceM, egp } from '@/lib/format';
import { backChevron, t } from '@/lib/i18n';
import { setLastRedemption } from '@/lib/redemption-store';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { brand, gradient, useTheme } from '@/lib/theme';
import type { Perk, RedeemResult, RpcError } from '@/lib/types';

type Lookup =
  | { ok: true; merchant: { id: string; name: string; logo_url: string | null; category: string }; branch: { id: string; name: string }; perks: Perk[]; payments_mode?: string }
  | RpcError;
type PayMethod = 'merchant' | 'in_app';

export default function Redeem() {
  const { c } = useTheme();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { refreshLocation, refreshProfile, coords, merchants } = useSession();
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [perkId, setPerkId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [pay, setPay] = useState<PayMethod>('merchant');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsVerify, setNeedsVerify] = useState(false);

  // Look the code up once per scanned code (guards against re-renders/remounts re-firing it)
  const lookedUp = useRef<string | null>(null);
  useEffect(() => {
    if (!code || lookedUp.current === code) return;
    lookedUp.current = code;
    let active = true;
    supabase.rpc('lookup_qr', { p_code: code }).then(({ data, error: err }) => {
      if (!active) return;
      if (err) return setLookup({ ok: false, error: 'network' });
      const res = data as Lookup;
      setLookup(res);
      if (res.ok && res.perks.length) setPerkId(res.perks[0].id);
    });
    return () => { active = false; };
  }, [code]);

  const perk = useMemo(() => (lookup?.ok ? lookup.perks.find((p) => p.id === perkId) : undefined), [lookup, perkId]);
  const bill = Number(amount.replace(/[^\d.]/g, '')) || 0;
  const saving = useMemo(() => {
    if (!perk || !bill) return null;
    let d = perk.discount_type === 'percentage' ? (bill * Number(perk.discount_value)) / 100
      : perk.discount_type === 'amount' ? Math.min(Number(perk.discount_value), bill) : null;
    if (d != null && perk.max_discount_amount != null) d = Math.min(d, Number(perk.max_discount_amount));
    return d == null ? null : Math.round(d * 100) / 100;
  }, [perk, bill]);
  const toPay = bill ? Math.round((bill - (saving ?? 0)) * 100) / 100 : 0;

  // Distance to this branch for the header (from the cached merchant list)
  const distance = useMemo(() => {
    if (!lookup?.ok || !coords) return null;
    const b = merchants.find((m) => m.id === lookup.merchant.id)?.branches.find((x) => x.id === lookup.branch.id);
    return b?.lat != null && b.lng != null ? distanceM(coords, { lat: b.lat, lng: b.lng }) : null;
  }, [lookup, coords, merchants]);

  const payMode = lookup?.ok ? lookup.payments_mode ?? 'off' : 'off';
  const canPayInApp = payMode === 'test' || payMode === 'live';
  const inApp = pay === 'in_app' && canPayInApp;
  const needsAmount = (!!perk && Number(perk.min_spend) > 0) || inApp;
  const belowMin = !!perk && bill > 0 && bill < Number(perk.min_spend);

  async function redeem() {
    if (!perk) return;
    if (inApp && !bill) return setError(t('Enter your bill to pay in the app.'));
    if (needsAmount && !bill) return setError(t('Enter your bill — this perk needs a minimum of {amount}.', { amount: egp(perk.min_spend) }));
    if (belowMin) return setError(t('Minimum spend is {amount}.', { amount: egp(perk.min_spend) }));
    setSubmitting(true); setError(null);
    const here = await refreshLocation(true);
    const { data, error: err } = await supabase.rpc('redeem_perk', {
      p_code: code, p_perk_id: perk.id, p_original_amount: bill || null, p_lat: here?.lat ?? null, p_lng: here?.lng ?? null,
      p_payment_method: inApp ? 'in_app' : 'merchant',
    });
    setSubmitting(false);
    const res = data as RedeemResult | RpcError | null;
    if (err || !res) return setError(friendlyError('network'));
    if (!res.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setNeedsVerify(res.error === 'verification_required');
      return setError(friendlyError(res.error));
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setLastRedemption(res);
    refreshProfile();
    router.dismissAll();
    router.replace('/success');
  }

  if (!lookup) return <Screen scroll={false} edges={[]} style={{ alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={brand.purple} /></Screen>;

  if (!lookup.ok) {
    return (
      <Screen edges={[]}>
        <Empty emoji="🫣" title={t('Oops! Try again 🔄')} subtitle={friendlyError(lookup.error)} />
        <Button title={t('Scan again')} onPress={() => router.back()} />
      </Screen>
    );
  }

  const PayOption = ({ value, icon, title, sub }: { value: PayMethod; icon: string; title: string; sub: string }) => {
    const on = pay === value;
    return (
      <Pressable onPress={() => setPay(value)} style={{ flex: 1, minWidth: 140, padding: 12, borderRadius: 16, gap: 2,
        borderWidth: on ? 2 : 1, borderColor: on ? brand.purple : c.border, backgroundColor: on ? '#7B2FF70D' : 'transparent' }}>
        <Text style={{ fontSize: 20 }}>{icon}</Text>
        <T v="h3" style={{ fontSize: 15 }}>{title}</T>
        <T v="small">{sub}</T>
      </Pressable>
    );
  };

  const cta = inApp
    ? (bill ? t('Pay {amount} in app', { amount: egp(toPay) }) : t('Pay in app'))
    : saving != null ? t('Redeem • save {amount}', { amount: egp(saving) }) : t('Redeem now');

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingBottom: 40 }}>
        <SafeAreaView edges={['top']} style={{ paddingHorizontal: 20, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable onPress={() => router.back()} hitSlop={12}><Text style={{ color: '#fff', fontSize: 28 }}>{backChevron()}</Text></Pressable>
            <Text style={{ flex: 1, textAlign: 'center', color: '#ffffffcc', fontWeight: '700', marginRight: 16 }}>Perkly Pay</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <MerchantLogo name={lookup.merchant.name} category={lookup.merchant.category} uri={lookup.merchant.logo_url} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }} numberOfLines={2}>{lookup.merchant.name}</Text>
              <Text style={{ color: '#ffffffcc', fontWeight: '600' }} numberOfLines={1}>{lookup.branch.name}{distance != null ? ` (${distanceLabel(distance)})` : ''}</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView style={{ marginTop: -24 }} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ backgroundColor: c.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 16, minHeight: 500 }}>
          <T v="muted">{t('How much are you paying?')}</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: belowMin ? brand.danger : c.border, paddingBottom: 6 }}>
            <Text style={{ fontSize: 22, fontWeight: '600', color: c.textMuted }}>{t('EGP')}</Text>
            <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={c.textMuted} autoFocus
              style={[{ flex: 1, minWidth: 0, textAlign: 'right', fontSize: 36, fontWeight: '900', color: c.text, paddingVertical: 6, writingDirection: 'ltr' },
                Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]} />
          </View>
          {saving != null ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 6, backgroundColor: '#12B76A14', borderRadius: 14, padding: 12 }}>
              <T color={brand.success} style={{ fontWeight: '800' }}>{t('You save {amount} 🎉', { amount: egp(saving) })}</T>
              <T style={{ fontWeight: '800' }}>{t('Pay {amount}', { amount: egp(toPay) })}</T>
            </View>
          ) : (
            <T v="small">{needsAmount ? (inApp ? t('Enter your bill to pay in the app.') : t('Minimum spend {amount}', { amount: egp(perk?.min_spend) })) : t('Optional — add it to track your savings')}</T>
          )}

          <T v="label" style={{ marginTop: 6 }}>{t('Your perk')}</T>
          {lookup.perks.length === 0 && <Empty emoji="😴" title={t('No perks running right now')} subtitle={t('Check back later today.')} />}
          {lookup.perks.map((p) => {
            const on = p.id === perkId;
            return (
              <Pressable key={p.id} onPress={() => setPerkId(p.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18,
                borderWidth: on ? 2 : 1, borderColor: on ? brand.purple : c.border, backgroundColor: on ? '#7B2FF70D' : 'transparent' }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: on ? brand.purple : c.border, alignItems: 'center', justifyContent: 'center' }}>
                  {on && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: brand.purple }} />}
                </View>
                <View style={{ flex: 1 }}>
                  <T v="h3">{p.title}</T>
                  <T v="small">{Number(p.min_spend) > 0 ? t('Min {amount}', { amount: egp(p.min_spend) }) : t('No minimum')}{p.max_discount_amount ? ` · ${t('max {amount} off', { amount: egp(p.max_discount_amount) })}` : ''}</T>
                </View>
                <Text style={{ color: p.is_flash ? brand.pink : brand.purple, fontWeight: '900', flexShrink: 1 }}>{p.is_flash ? '⚡' : ''}{discountLabel(p)}</Text>
              </Pressable>
            );
          })}

          {canPayInApp && (
            <>
              <T v="label" style={{ marginTop: 6 }}>{t('How do you want to pay?')}</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                <PayOption value="merchant" icon="🧾" title={t('At the cashier')} sub={t('Cash or card, as usual')} />
                <PayOption value="in_app" icon="📲" title={t('In the app')} sub={payMode === 'test' ? t('Test mode — no real charge') : t('Pay now with Perkly')} />
              </View>
            </>
          )}

          {error && <View style={{ backgroundColor: '#F044381A', borderRadius: 14, padding: 12 }}><T color={brand.danger}>{error}</T></View>}
          {needsVerify && <Button title={t('Verify my student ID')} icon="🎓" variant="secondary" onPress={() => { router.back(); router.push('/student-verification'); }} />}
          <Button title={cta} icon={inApp ? '💳' : '✨'} onPress={redeem} loading={submitting} disabled={!perk} />
          <T v="small" style={{ textAlign: 'center' }}>
            {inApp ? t('You pay now in the app — then show the green screen so the cashier knows it is paid.') : t('Tap when you’re paying — then show the green screen to the cashier.')}
          </T>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
