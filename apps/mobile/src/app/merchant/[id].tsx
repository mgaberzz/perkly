import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Card, DiscountBadge, Empty, MerchantLogo, T } from '@/components/ui';
import { bestPerk, distanceLabel, distanceM, egp, timeLeft } from '@/lib/format';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { brand, CATEGORY_EMOJI, gradient, useTheme } from '@/lib/theme';

export default function MerchantScreen() {
  const { c } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { merchants, origin: coords, favorites, toggleFavorite, campus } = useSession();
  const m = merchants.find((x) => x.id === id);
  const [weekCount, setWeekCount] = useState<number | null>(null);

  useEffect(() => {
    supabase.rpc('merchant_week_redemptions', { p_merchant_id: id }).then(({ data }) => setWeekCount(typeof data === 'number' ? data : null));
  }, [id]);

  const branches = useMemo(() => (m?.branches ?? [])
    .map((b) => ({ ...b, d: coords && b.lat != null && b.lng != null ? distanceM(coords, { lat: b.lat, lng: b.lng }) : null }))
    .sort((a, b) => (a.d ?? 1e12) - (b.d ?? 1e12)), [m, coords]);

  if (!m) return <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center' }}><Empty emoji="🫥" title="This place isn't on Perkly right now" /></View>;

  const best = bestPerk(m.perks);
  const fav = favorites.has(m.id);
  const onCampus = m.branches.some((b) => b.campus_id === campus?.id);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        {m.cover_url ? (
          <Image source={{ uri: m.cover_url }} style={{ height: 240 }} contentFit="cover" />
        ) : (
          <LinearGradient colors={gradient} style={{ height: 240, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 96 }}>{CATEGORY_EMOJI[m.category] ?? '✨'}</Text>
          </LinearGradient>
        )}
        <View style={{ padding: 20, gap: 16, marginTop: -40 }}>
          <Card style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <MerchantLogo name={m.name} category={m.category} uri={m.logo_url} size={60} />
              <View style={{ flex: 1 }}>
                <T v="h2">{m.name}</T>
                <T v="muted">{CATEGORY_EMOJI[m.category]} {m.subcategory ?? m.category}</T>
              </View>
            </View>
            {best && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><T v="h3">Save up to</T><DiscountBadge perk={best} size="lg" /></View>}
            {m.description ? <T v="muted">{m.description}</T> : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {weekCount != null && weekCount > 0 && <Tag text={`🔥 ${weekCount} students redeemed this week`} />}
              {onCampus && <Tag text={`🎓 Near ${campus?.short_name ?? 'your campus'}`} />}
            </View>
          </Card>

          <T v="label">Perks</T>
          {m.perks.map((p) => (
            <Card key={p.id} onPress={() => router.push(`/perk/${p.id}`)}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <T v="h3" style={{ flex: 1 }}>{p.title}</T>
                <DiscountBadge perk={p} size="sm" />
              </View>
              {p.description ? <T v="muted">{p.description}</T> : null}
              <T v="small">
                {[
                  Number(p.min_spend) > 0 ? `Min spend ${egp(p.min_spend)}` : null,
                  p.max_discount_amount ? `Max ${egp(p.max_discount_amount)} off` : null,
                  p.end_at ? `⏳ ${timeLeft(p.end_at)}` : null,
                  p.branch_id ? `Only at ${m.branches.find((b) => b.id === p.branch_id)?.name ?? 'one branch'}` : null,
                ].filter(Boolean).join(' · ') || 'Valid at all branches'}
              </T>
              {p.terms ? <T v="small">ℹ️ {p.terms}</T> : null}
            </Card>
          ))}

          <T v="label">Branches</T>
          {branches.map((b) => (
            <Card key={b.id} onPress={() => {
              if (b.lat == null || b.lng == null) return;
              const url = Platform.select({
                ios: `maps:0,0?q=${encodeURIComponent(m.name)}@${b.lat},${b.lng}`,
                default: `https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lng}`,
              });
              Linking.openURL(url!);
            }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 22 }}>📍</Text>
              <View style={{ flex: 1 }}>
                <T v="h3" numberOfLines={1}>{b.name}</T>
                {b.address ? <T v="small" numberOfLines={1}>{b.address}</T> : null}
              </View>
              {b.d != null && <T v="small">{distanceLabel(b.d)}</T>}
            </Card>
          ))}
        </View>
      </ScrollView>
      <Pressable onPress={() => toggleFavorite(m.id)} hitSlop={12}
        style={{ position: 'absolute', right: 16, top: insets.top + 8, backgroundColor: '#ffffffdd', borderRadius: 20, padding: 8 }}>
        <Text style={{ fontSize: 20 }}>{fav ? '❤️' : '🤍'}</Text>
      </Pressable>
      <View style={{ position: 'absolute', left: 20, right: 20, bottom: 30 }}>
        <Button title="Scan to Redeem" icon="📷" onPress={() => router.push('/scan')} />
      </View>
    </View>
  );
}

function Tag({ text }: { text: string }) {
  return <View style={{ backgroundColor: '#7B2FF71A', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}><Text style={{ color: brand.purple, fontWeight: '800', fontSize: 12 }}>{text}</Text></View>;
}
