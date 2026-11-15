import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from '@/components/avatar';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, View, useWindowDimensions } from 'react-native';
import { Text } from '@/components/text';
import { LocationBar } from '@/components/area';
import { HowItWorks } from '@/components/how-it-works';
import { PerkCard } from '@/components/perk-card';
import { Card, Empty, Screen, SectionHeader, T, XPBar } from '@/components/ui';
import { egp, firstName } from '@/lib/format';
import { fwdChevron, t } from '@/lib/i18n';
import { applySortFilter, NO_FILTERS, usePerkItems } from '@/lib/perks';
import { useSession } from '@/lib/session';
import { brand, CATEGORY_EMOJI, useTheme } from '@/lib/theme';

const SHORTCUTS = ['Food', 'Coffee', 'Fashion', 'Beauty', 'Fitness', 'Entertainment', 'Electronics'] as const;

export default function Home() {
  const { c } = useTheme();
  const { width: W } = useWindowDimensions();
  const { profile, stats, campus, merchants, refreshMerchants, refreshProfile, refreshLocation, feature } = useSession();
  const items = usePerkItems();
  const [refreshing, setRefreshing] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const [banner, setBanner] = useState(0);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshMerchants(), refreshProfile(), refreshLocation(false)]);
    setRefreshing(false);
  }, [refreshMerchants, refreshProfile, refreshLocation]);

  const flash = useMemo(() => applySortFilter(items, 'ending', { ...NO_FILTERS, flashOnly: true }).slice(0, 10), [items]);
  const nearby = useMemo(() => {
    const seen = new Set<string>();
    return applySortFilter(items.filter((x) => x.distance != null && x.distance < 5000), 'nearest', NO_FILTERS)
      .filter((x) => (seen.has(x.merchant.id) ? false : (seen.add(x.merchant.id), true))).slice(0, 10);
  }, [items]);
  const trending = useMemo(() => applySortFilter(items.filter((x) => x.merchant.branches.some((b) => b.campus_id === campus?.id)), 'popular', NO_FILTERS).slice(0, 10), [items, campus]);

  const BANNERS = [
    feature('arcade') && { colors: ['#7B2FF7', '#FF3EA5'] as const, emoji: '🎡', title: t('Spin the Wheel'), body: t(stats?.spin_tickets === 1 ? '{n} Ticket Waiting · Win XP & Streak Freezes' : '{n} Tickets Waiting · Win XP & Streak Freezes', { n: stats?.spin_tickets ?? 0 }), onPress: () => router.push('/arcade') },
    { colors: ['#2F80FF', '#7B2FF7'] as const, emoji: '📷', title: t('How Perkly Works'), body: t('Scan the QR at the cashier → save instantly'), onPress: () => setHowOpen(true) },
    feature('invite') && { colors: ['#FF3EA5', '#FF7A59'] as const, emoji: '💜', title: t('Invite Friends, Earn XP'), body: t('Share Code {code} · +50 XP Each', { code: profile?.referral_code ?? '' }), onPress: () => router.push('/profile') },
  ].filter((b): b is Exclude<typeof b, false> => Boolean(b));

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} style={{ gap: 18 }}>
      <LocationBar />

      {/* Search pill with favorites + scan shortcuts */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.card, borderRadius: 999, borderWidth: 1, borderColor: c.border, paddingHorizontal: 16, paddingVertical: 12 }}>
        <Pressable onPress={() => router.push({ pathname: '/explore', params: { fav: '1' } })} hitSlop={8}><Text style={{ fontSize: 18, color: brand.pink }}>♥</Text></Pressable>
        <Pressable onPress={() => router.push('/explore')} style={{ flex: 1 }}><T v="muted" numberOfLines={1}>🔍  {t('Search cafés, burgers, gyms…')}</T></Pressable>
        <View style={{ width: 1, height: 22, backgroundColor: c.border }} />
        <Pressable onPress={() => router.push('/scan')} hitSlop={8}><Text style={{ fontSize: 18 }}>📷</Text></Pressable>
      </View>

      {/* Wallet-style stats strip */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 }}>
        {[
          { icon: '💸', value: egp(stats?.total_saved ?? 0), label: t('Saved'), to: { pathname: '/explain' as const, params: { metric: 'saved' } } },
          feature('streaks') && { icon: '🔥', value: t(stats?.current_streak === 1 ? '{n} Day' : '{n} Days', { n: stats?.current_streak ?? 0 }), label: t('Streak'), to: { pathname: '/explain' as const, params: { metric: 'streak' } } },
          feature('arcade') && { icon: '🎟️', value: `x${stats?.spin_tickets ?? 0}`, label: t('Spins'), to: { pathname: '/arcade' as const, params: {} } },
          { icon: '⚡', value: `${stats?.total_xp ?? 0}`, label: 'XP', to: { pathname: '/explain' as const, params: { metric: 'xp' } } },
        ].filter((s): s is Exclude<typeof s, false> => Boolean(s)).map((s) => (
          <Pressable key={s.label} onPress={() => router.push(s.to)} style={{ alignItems: 'flex-start' }}>
            <T v="h3" style={{ fontSize: 15 }}>{s.icon} {s.value}</T>
            <T v="small">{s.label}</T>
          </Pressable>
        ))}
      </View>

      {/* Category shortcuts */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 }}>
        {[...SHORTCUTS, 'More'].map((k) => (
          <Pressable key={k} onPress={() => router.push(k === 'More' ? '/explore' : { pathname: '/category/[name]', params: { name: k } })}
            style={{ width: '25%', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 54, height: 54, borderRadius: 18, backgroundColor: c.chip, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 26 }}>{k === 'More' ? '🧩' : CATEGORY_EMOJI[k]}</Text>
            </View>
            <T v="small" color={c.text} numberOfLines={1}>{t(k === 'Entertainment' ? 'Fun' : k)}</T>
          </Pressable>
        ))}
      </View>

      {/* Promo banners */}
      <View>
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }}
          onMomentumScrollEnd={(e) => setBanner(Math.round(e.nativeEvent.contentOffset.x / W))}>
          {BANNERS.map((b) => (
            <Pressable key={b.title} onPress={b.onPress} style={{ width: W, paddingHorizontal: 20 }}>
              <LinearGradient colors={b.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 130, borderRadius: 24, padding: 18, justifyContent: 'center', overflow: 'hidden' }}>
                <Text style={{ position: 'absolute', right: 10, bottom: -6, fontSize: Math.min(90, W * 0.22), opacity: 0.9 }}>{b.emoji}</Text>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 22, maxWidth: '70%' }} numberOfLines={2}>{b.title}</Text>
                <Text style={{ color: '#ffffffdd', fontWeight: '700', marginTop: 4, maxWidth: '68%' }} numberOfLines={2}>{b.body}</Text>
              </LinearGradient>
            </Pressable>
          ))}
        </ScrollView>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 }}>
          {BANNERS.map((b, i) => <View key={b.title} style={{ width: i === banner ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === banner ? brand.pink : c.border }} />)}
        </View>
      </View>

      <Card onPress={() => router.push('/rewards')}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable onPress={() => router.push('/profile')} hitSlop={8}><Avatar profile={profile} size={40} /></Pressable>
          <T v="h3" style={{ flex: 1 }}>{t('Hey {name} 👋 Let’s Level Up', { name: firstName(profile?.full_name) })}</T>
        </View>
        <XPBar totalXp={stats?.total_xp ?? 0} />
      </Card>

      {feature('flash_perks') && flash.length > 0 && (
        <View style={{ gap: 12 }}>
          <SectionHeader title={t('Ending Soon ⏳')} action={`${t('See All')} ${fwdChevron()}`} onAction={() => router.push({ pathname: '/collection/[key]', params: { key: 'flash' } })} />
          <FlatList horizontal data={flash} keyExtractor={(x) => x.perk.id} showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12 }} renderItem={({ item }) => <PerkCard item={item} />} />
        </View>
      )}

      <View style={{ gap: 12 }}>
        <SectionHeader title={t('Near You 📍')} action={`${t('See All')} ${fwdChevron()}`} onAction={() => router.push({ pathname: '/category/[name]', params: { name: 'All' } })} />
        {nearby.length ? (
          <FlatList horizontal data={nearby} keyExtractor={(x) => x.perk.id} showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12 }} renderItem={({ item }) => <PerkCard item={item} />} />
        ) : <Card><T v="muted">{t('Nothing within 5 km of this area yet — tap “Change” above to look somewhere else.')}</T></Card>}
      </View>

      <View style={{ gap: 12 }}>
        <View style={{ gap: 2 }}>
          <SectionHeader title={t('Trending at {place} 🔥', { place: campus?.short_name ?? t('your campus') })} />
          <T v="muted">{t('The Perks Everyone’s Obsessed with This Week')}</T>
        </View>
        {trending.length ? (
          <FlatList horizontal data={trending} keyExtractor={(x) => x.perk.id} showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12 }} renderItem={({ item }) => <PerkCard item={item} />} />
        ) : <Empty emoji="💜" title={t('New Perks Coming Tomorrow')} subtitle={t("We're adding merchants around your campus.")} />}
      </View>
      <T v="small" style={{ textAlign: 'center' }}>{t('{n} Places on Perkly', { n: merchants.length })}</T>
      <HowItWorks visible={howOpen} onClose={() => setHowOpen(false)} />
    </Screen>
  );
}
