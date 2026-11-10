import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Share, View } from 'react-native';
import { Text } from '@/components/text';
import { EditableAvatar } from '@/components/avatar';
import { MerchantRow } from '@/components/merchant-card';
import { Card, GradientCard, Screen, SectionHeader, T } from '@/components/ui';
import { egp, levelProgress, shortDate } from '@/lib/format';
import { fwdChevron, t } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { brand, useTheme } from '@/lib/theme';

type Recent = { id: string; created_at: string; merchant_name: string; perk_title: string; discount_amount: number | null; xp_awarded: number };

export default function Me() {
  const { c } = useTheme();
  const { session, profile, stats, campus, merchants, favorites, refreshProfile } = useSession();
  const [recent, setRecent] = useState<Recent[]>([]);
  const [unread, setUnread] = useState(0);

  useFocusEffect(useCallback(() => {
    refreshProfile();
    if (!session) return;
    supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null).then(({ count }) => setUnread(count ?? 0));
    supabase.from('my_redemptions').select('id, created_at, merchant_name, perk_title, discount_amount, xp_awarded')
      .order('created_at', { ascending: false }).limit(3).then(({ data }) => setRecent((data ?? []) as Recent[]));
  }, [session, refreshProfile]));

  const { cur } = levelProgress(stats?.total_xp ?? 0);
  const favMerchants = merchants.filter((m) => favorites.has(m.id));

  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Pressable onPress={() => router.push('/settings')} hitSlop={12} style={{ position: 'absolute', end: 0, top: 0 }}>
          <Text style={{ fontSize: 26 }}>⚙️</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/notifications')} hitSlop={12} style={{ position: 'absolute', start: 0, top: 0 }}>
          <Text style={{ fontSize: 26 }}>🔔</Text>
          {unread > 0 && <View style={{ position: 'absolute', top: -2, end: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: brand.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}><Text style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>{unread > 9 ? '9+' : unread}</Text></View>}
        </Pressable>
        <EditableAvatar size={96} />
        <T v="h2" style={{ textAlign: 'center' }}>{profile?.full_name ?? t('Student')}</T>
        <Pressable onPress={() => router.push({ pathname: '/explain', params: { metric: 'xp' } })}><T v="muted" style={{ textAlign: 'center' }}>🎓 {campus?.short_name ?? campus?.name ?? t('No campus')} · {t('Lv {n} · {name}', { n: cur.level, name: cur.name })}</T></Pressable>
      </View>

      {/* Student ID card */}
      <GradientCard style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text style={{ fontSize: 30 }}>🪪</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#ffffffcc', fontWeight: '800', fontSize: 12, letterSpacing: 1 }}>{profile?.student_code ? t('STUDENT ID') : t('USER ID')}</Text>
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 22, letterSpacing: 2, writingDirection: 'ltr' }}>{profile?.student_code ?? profile?.user_code ?? '—'}</Text>
        </View>
        {profile?.student_code ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: '#ffffffaa', fontWeight: '800', fontSize: 10, letterSpacing: 1 }}>{t('USER ID')}</Text>
            <Text style={{ color: '#ffffffcc', fontWeight: '700', fontSize: 12, writingDirection: 'ltr' }}>{profile?.user_code}</Text>
          </View>
        ) : null}
      </GradientCard>
      {profile?.role === 'student' && profile.verification_status !== 'verified' && (
        <Card onPress={() => router.push('/student-verification')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderColor: profile.verification_status === 'rejected' ? brand.danger : brand.purple }}>
          <Text style={{ fontSize: 26 }}>{profile.verification_status === 'pending' ? '⏳' : profile.verification_status === 'rejected' ? '❌' : '🎓'}</Text>
          <View style={{ flex: 1 }}>
            <T style={{ fontWeight: '800' }}>{profile.verification_status === 'pending' ? t('We’re checking your student ID') : profile.verification_status === 'rejected' ? t('Your ID wasn’t approved') : t('Verify you’re a student')}</T>
            <T v="small">{profile.verification_status === 'pending' ? t('Usually less than a day') : profile.verification_status === 'rejected' ? t('Tap to see why and send a new photo') : t('Snap your student ID. Takes a minute.')}</T>
          </View>
          <T v="muted">{fwdChevron()}</T>
        </Card>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Card style={{ flex: 1, minWidth: 100 }} onPress={() => router.push({ pathname: '/explain', params: { metric: 'saved' } })}><T v="label">{t('Saved')}</T><T v="h2" color={brand.success}>{egp(stats?.total_saved ?? 0)}</T></Card>
        <Card style={{ flex: 1, minWidth: 100 }} onPress={() => router.push({ pathname: '/explain', params: { metric: 'redemptions' } })}><T v="label">{t('Redemptions')}</T><T v="h2">{stats?.total_redemptions ?? 0}</T></Card>
        <Card style={{ flex: 1, minWidth: 100 }} onPress={() => router.push('/arcade')}><T v="label">{t('Spins')}</T><T v="h2">🎟️ {stats?.spin_tickets ?? 0}</T></Card>
      </View>

      {(Number(stats?.cashback_balance ?? 0) > 0 || Number(stats?.cashback_pending ?? 0) > 0) && (
        <Card onPress={() => router.push({ pathname: '/explain', params: { metric: 'cashback' } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ fontSize: 28 }}>💸</Text>
          <View style={{ flex: 1 }}>
            <T v="label">{t('Cashback')}</T>
            <T v="h2" color={brand.success}>{egp(stats?.cashback_balance ?? 0)}</T>
          </View>
          {Number(stats?.cashback_pending ?? 0) > 0 && <T v="small">{t('{amount} pending', { amount: egp(stats?.cashback_pending) })}</T>}
        </Card>
      )}

      <SectionHeader title={`🧾 ${t('My redemptions')}`} action={`${t('View all')} ${fwdChevron()}`} onAction={() => router.push('/history')} />
      <Card style={{ gap: 0, paddingVertical: recent.length ? 4 : 24 }}>
        {recent.length === 0 ? (
          <T v="muted" style={{ textAlign: 'center' }}>{t('No perks used yet. Scan your first QR and start saving 💜')}</T>
        ) : recent.map((r, i) => (
          <Pressable key={r.id} onPress={() => router.push({ pathname: '/explain', params: { metric: 'redemption', id: r.id } })} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: i < recent.length - 1 ? 1 : 0, borderBottomColor: c.border }}>
            <View style={{ flex: 1 }}>
              <T v="h3" numberOfLines={1}>{r.merchant_name}</T>
              <T v="small" numberOfLines={1}>{r.perk_title} · {shortDate(r.created_at)}</T>
            </View>
            <T color={brand.success} style={{ fontWeight: '900' }}>{r.discount_amount != null ? `−${egp(r.discount_amount)}` : `+${r.xp_awarded} XP`}</T>
          </Pressable>
        ))}
      </Card>

      <GradientCard style={{ gap: 10 }}>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900' }}>{t('Invite & earn XP 💜')}</Text>
        <Text style={{ color: '#ffffffdd', fontWeight: '600' }}>{t('You get +50 XP when a friend redeems their first perk.')}</Text>
        <Pressable onPress={() => Share.share({ message: t('Bestie… why are you paying full price? 😭 Get student perks on Perkly — use my code {code} 💜', { code: profile?.referral_code }) })}
          style={{ backgroundColor: '#fff', borderRadius: 16, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontWeight: '900', fontSize: 18, letterSpacing: 2, color: brand.ink }}>{profile?.referral_code}</Text>
          <Text style={{ fontWeight: '900', color: brand.purple }}>{t('Share')} ↗</Text>
        </Pressable>
      </GradientCard>

      <SectionHeader title={`♥ ${t('My faves')}`} />
      {favMerchants.length ? favMerchants.map((m) => <MerchantRow key={m.id} m={m} />)
        : <Card style={{ paddingVertical: 24 }}><T v="muted" style={{ textAlign: 'center' }}>{t('Tap ♡ on any perk to save your fave spots here.')}</T></Card>}
    </Screen>
  );
}
