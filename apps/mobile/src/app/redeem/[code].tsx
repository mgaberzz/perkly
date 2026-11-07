import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Empty, MerchantLogo, Screen, T } from '@/components/ui';
import { friendlyError } from '@/lib/errors';
import { discountLabel, distanceLabel, distanceM, egp } from '@/lib/format';
import { setLastRedemption } from '@/lib/redemption-store';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { brand, gradient, useTheme } from '@/lib/theme';
import type { Perk, RedeemResult, RpcError } from '@/lib/types';

type Lookup =
  | { ok: true; merchant: { id: string; name: string; logo_url: string | null; category: string }; branch: { id: string; name: string }; perks: Perk[] }
  | RpcError;

export default function Redeem() {
  const { c } = useTheme();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { refreshLocation, refreshProfile, coords, merchants } = useSession();
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [perkId, setPerkId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Distance to this branch for the header (from the cached merchant list)
  const distance = useMemo(() => {
    if (!lookup?.ok || !coords) return null;
    const b = merchants.find((m) => m.id === lookup.merchant.id)?.branches.find((x) => x.id === lookup.branch.id);
    return b?.lat != null && b.lng != null ? distanceM(coords, { lat: b.lat, lng: b.lng }) : null;
  }, [lookup, coords, merchants]);

  const needsAmount = !!perk && Number(perk.min_spend) > 0;
  const belowMin = !!perk && bill > 0 && bill < Number(perk.min_spend);

  async function redeem() {
    if (!perk) return;
    if (needsAmount && !bill) return setError(`Enter your bill — this perk needs a minimum of ${egp(perk.min_spend)}.`);
    if (belowMin) return setError(`Minimum spend is ${egp(perk.min_spend)}.`);
    setSubmitting(true); setError(null);
    const here = await refreshLocation(true);
    const { data, error: err } = await supabase.rpc('redeem_perk', {
      p_code: code, p_perk_id: perk.id, p_original_amount: bill || null, p_lat: here?.lat ?? null, p_lng: here?.lng ?? null,
    });
    setSubmitting(false);
    const res = data as RedeemResult | RpcError | null;
    if (err || !res) return setError(friendlyError('network'));
    if (!res.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
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
        <Empty emoji="🫣" title="Oops! Try again 🔄" subtitle={friendlyError(lookup.error)} />
        <Button title="Scan again" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingBottom: 40 }}>
        <SafeAreaView edges={['top']} style={{ paddingHorizontal: 20, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable onPress={() => router.back()} hitSlop={12}><Text style={{ color: '#fff', fontSize: 28 }}>‹</Text></Pressable>
            <Text style={{ flex: 1, textAlign: 'center', color: '#ffffffcc', fontWeight: '700', marginRight: 16 }}>Perkly Pay</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <MerchantLogo name={lookup.merchant.name} category={lookup.merchant.category} uri={lookup.merchant.logo_url} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>{lookup.merchant.name}</Text>
              <Text style={{ color: '#ffffffcc', fontWeight: '600' }}>{lookup.branch.name}{distance != null ? ` (${distanceLabel(distance)})` : ''}</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView style={{ marginTop: -24 }} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ backgroundColor: c.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 16, minHeight: 500 }}>
          <T v="muted">How much are you paying?</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: belowMin ? brand.danger : c.border, paddingBottom: 6 }}>
            <Text style={{ fontSize: 26, fontWeight: '600', color: c.textMuted }}>EGP</Text>
            <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={c.textMuted} autoFocus
              style={[{ flex: 1, minWidth: 0, textAlign: 'right', fontSize: 40, fontWeight: '900', color: c.text, paddingVertical: 6 },
                Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]} />
          </View>
          {saving != null ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#12B76A14', borderRadius: 14, padding: 12 }}>
              <T color={brand.success} style={{ fontWeight: '800' }}>You save {egp(saving)} 🎉</T>
              <T style={{ fontWeight: '800' }}>Pay {egp(bill - saving)}</T>
            </View>
          ) : (
            <T v="small">{needsAmount ? `Minimum spend ${egp(perk?.min_spend)}` : 'Optional — add it to track your savings'}</T>
          )}

          <T v="label" style={{ marginTop: 6 }}>Your perk</T>
          {lookup.perks.length === 0 && <Empty emoji="😴" title="No perks running right now" subtitle="Check back later today." />}
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
                  <T v="small">{Number(p.min_spend) > 0 ? `Min ${egp(p.min_spend)}` : 'No minimum'}{p.max_discount_amount ? ` · max ${egp(p.max_discount_amount)} off` : ''}</T>
                </View>
                <Text style={{ color: p.is_flash ? brand.pink : brand.purple, fontWeight: '900' }}>{p.is_flash ? '⚡' : ''}{discountLabel(p)}</Text>
              </Pressable>
            );
          })}

          {error && <View style={{ backgroundColor: '#F044381A', borderRadius: 14, padding: 12 }}><T color={brand.danger}>{error}</T></View>}
          <Button title={saving != null ? `Redeem • save ${egp(saving)}` : 'Redeem now'} icon="✨" onPress={redeem} loading={submitting} disabled={!perk} />
          <T v="small" style={{ textAlign: 'center' }}>Tap when you’re paying — then show the green screen to the cashier.</T>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
