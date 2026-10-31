import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Share, Text, View } from 'react-native';
import { Mascot } from '@/components/mascot';
import { MerchantRow } from '@/components/merchant-card';
import { Card, GradientCard, Screen, SectionHeader, T } from '@/components/ui';
import { egp, levelProgress } from '@/lib/format';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { brand, useTheme } from '@/lib/theme';

type Recent = { id: string; created_at: string; merchant_name: string; perk_title: string; discount_amount: number | null; xp_awarded: number };

export default function Me() {
  const { c } = useTheme();
  const { session, profile, stats, campus, merchants, favorites, refreshProfile } = useSession();
  const [recent, setRecent] = useState<Recent[]>([]);

  useFocusEffect(useCallback(() => {
    refreshProfile();
    if (!session) return;
    supabase.from('my_redemptions').select('id, created_at, merchant_name, perk_title, discount_amount, xp_awarded')
      .order('created_at', { ascending: false }).limit(3).then(({ data }) => setRecent((data ?? []) as Recent[]));
  }, [session, refreshProfile]));

  const { cur } = levelProgress(stats?.total_xp ?? 0);
  const favMerchants = merchants.filter((m) => favorites.has(m.id));

  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Pressable onPress={() => router.push('/settings')} hitSlop={12} style={{ position: 'absolute', right: 0, top: 0 }}>
          <Text style={{ fontSize: 26 }}>⚙️</Text>
        </Pressable>
        <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: '#FF3EA51A', alignItems: 'center', justifyContent: 'center' }}><Mascot size={80} /></View>
        <T v="h2">{profile?.full_name ?? 'Student'}</T>
        <T v="muted">🎓 {campus?.short_name ?? campus?.name ?? 'No campus'} · Lv {cur.level} {cur.name}</T>
        <Pressable onPress={() => router.push('/edit-profile')}><T color={brand.pink} style={{ fontWeight: '900', fontSize: 16 }}>Edit profile</T></Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Card style={{ flex: 1 }}><T v="label">Saved</T><T v="h2" color={brand.success}>{egp(stats?.total_saved ?? 0)}</T></Card>
        <Card style={{ flex: 1 }}><T v="label">Redemptions</T><T v="h2">{stats?.total_redemptions ?? 0}</T></Card>
        <Card style={{ flex: 1 }} onPress={() => router.push('/arcade')}><T v="label">Spins</T><T v="h2">🎟️ {stats?.spin_tickets ?? 0}</T></Card>
      </View>

      <SectionHeader title="🧾 My redemptions" action="View all ›" onAction={() => router.push('/history')} />
      <Card style={{ gap: 0, paddingVertical: recent.length ? 4 : 24 }}>
        {recent.length === 0 ? (
          <T v="muted" style={{ textAlign: 'center' }}>You haven’t redeemed a perk yet — scan your first QR 💜</T>
        ) : recent.map((r, i) => (
          <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: i < recent.length - 1 ? 1 : 0, borderBottomColor: c.border }}>
            <View style={{ flex: 1 }}>
              <T v="h3" numberOfLines={1}>{r.merchant_name}</T>
              <T v="small" numberOfLines={1}>{r.perk_title} · {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</T>
            </View>
            <T color={brand.success} style={{ fontWeight: '900' }}>{r.discount_amount != null ? `−${egp(r.discount_amount)}` : `+${r.xp_awarded} XP`}</T>
          </View>
        ))}
      </Card>

      <GradientCard style={{ gap: 10 }}>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900' }}>Invite & Earn XP 💜</Text>
        <Text style={{ color: '#ffffffdd', fontWeight: '600' }}>You get +50 XP when a friend redeems their first perk.</Text>
        <Pressable onPress={() => Share.share({ message: `Bestie… why are you paying full price? 😭 Get student perks on Perkly — use my code ${profile?.referral_code} 💜` })}
          style={{ backgroundColor: '#fff', borderRadius: 16, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontWeight: '900', fontSize: 18, letterSpacing: 2, color: brand.ink }}>{profile?.referral_code}</Text>
          <Text style={{ fontWeight: '900', color: brand.purple }}>Share ↗</Text>
        </Pressable>
      </GradientCard>

      <SectionHeader title="♥ My faves" />
      {favMerchants.length ? favMerchants.map((m) => <MerchantRow key={m.id} m={m} />)
        : <Card style={{ paddingVertical: 24 }}><T v="muted" style={{ textAlign: 'center' }}>Tap ♡ on any perk to save the place here.</T></Card>}
    </Screen>
  );
}
