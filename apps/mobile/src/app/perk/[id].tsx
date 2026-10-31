import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HowItWorks } from '@/components/how-it-works';
import { Heart } from '@/components/perk-card';
import { Sheet } from '@/components/sheet';
import { Button, Empty, T } from '@/components/ui';
import { DAYS } from '@/lib/days';
import { discountLabel, distanceLabel, distanceM, egp, timeLeft } from '@/lib/format';
import { usePerkItems } from '@/lib/perks';
import { useSession } from '@/lib/session';
import { brand, CATEGORY_EMOJI, gradient, useTheme } from '@/lib/theme';

export default function PerkDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const { origin } = useSession();
  const item = usePerkItems().find((x) => x.perk.id === id);
  const [branchesOpen, setBranchesOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const [moreTerms, setMoreTerms] = useState(false);
  const [moreAbout, setMoreAbout] = useState(false);

  const branches = useMemo(() => {
    if (!item) return [];
    const list = item.perk.branch_id ? item.merchant.branches.filter((b) => b.id === item.perk.branch_id) : item.merchant.branches;
    return list.map((b) => ({ ...b, d: origin && b.lat != null && b.lng != null ? distanceM(origin, { lat: b.lat, lng: b.lng }) : null }))
      .sort((a, z) => (a.d ?? 1e12) - (z.d ?? 1e12));
  }, [item, origin]);

  if (!item) return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center' }}><Empty emoji="🫥" title="This perk isn't available anymore" /></SafeAreaView>;
  const { perk, merchant } = item;

  const fine = [
    Number(perk.min_spend) > 0 ? `Minimum spend of ${egp(perk.min_spend)} on one bill.` : 'No minimum spend.',
    perk.max_discount_amount ? `Discount capped at ${egp(perk.max_discount_amount)} per visit.` : null,
    'Scan the Perkly QR at the cashier and show the live green screen before paying.',
    'Up to 2 Perkly redemptions per place per day, and one every 15 minutes.',
    'Screenshots of the success screen are not accepted.',
    perk.terms,
  ].filter(Boolean) as string[];

  const validity = perk.end_at
    ? `Valid until ${new Date(perk.end_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}${perk.is_flash ? ` · ⏳ ${timeLeft(perk.end_at)}` : ''}`
    : 'Valid every day, no expiry';

  const Row = ({ icon, text, onPress }: { icon: string; text: string; onPress?: () => void }) => (
    <Pressable onPress={onPress} disabled={!onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: c.border }}>
      <Text style={{ fontSize: 20 }}>{icon}</Text>
      <T style={{ flex: 1 }}>{text}</T>
      {onPress && <Text style={{ fontSize: 22, color: c.text }}>›</Text>}
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 260, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}>
          <SafeAreaView edges={['top']} style={{ flex: 1, paddingHorizontal: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {[{ t: '‹', f: () => router.back() }, { t: '↗', f: () => Share.share({ message: `${perk.title} at ${merchant.name} — on Perkly 💜` }) }].map((b) => (
                <Pressable key={b.t} onPress={b.f} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#0005', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>{b.t}</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 96 }}>{CATEGORY_EMOJI[merchant.category] ?? '✨'}</Text></View>
          </SafeAreaView>
        </LinearGradient>

        <View style={{ paddingHorizontal: 20, paddingTop: 20, gap: 6 }}>
          <Pressable onPress={() => router.push(`/merchant/${merchant.id}`)}><T v="small" color={brand.purple}>{merchant.name} · {merchant.subcategory ?? merchant.category} ›</T></Pressable>
          <T v="h1" style={{ fontSize: 26 }}>{perk.title}</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 18, backgroundColor: c.card, borderWidth: 1, borderColor: c.border }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: brand.pink }} />
            <T v="h3" style={{ flex: 1 }}>{Number(perk.min_spend) > 0 ? `MIN ${egp(perk.min_spend)}` : 'NO MIN SPEND'}</T>
            <View style={{ width: 1, height: 20, backgroundColor: c.border }} />
            <T v="h3" color={brand.pink}>{discountLabel(perk)}</T>
          </View>
          {item.redeemed > 0 && <T v="small" color={brand.pink} style={{ marginTop: 4 }}>🔥 {item.redeemed} students redeemed this month</T>}

          <View style={{ marginTop: 8 }}>
            <Row icon="⏰" text={validity} />
            <Row icon="🏬" text={branches.length === 1 ? `Use at ${branches[0].name}${branches[0].d != null ? ` (${distanceLabel(branches[0].d)})` : ''}` : `You can use this at ${branches.length} branches`} onPress={() => setBranchesOpen(true)} />
            <Row icon="📅" text={perk.valid_days ? `Only on ${perk.valid_days.map((d) => DAYS[d]).join(', ')}` : 'Every day of the week'} />
          </View>

          <T v="h2" style={{ marginTop: 20 }}>Fine print</T>
          {(moreTerms ? fine : fine.slice(0, 3)).map((f) => (
            <View key={f} style={{ flexDirection: 'row', gap: 10, paddingRight: 8 }}><T>•</T><T style={{ flex: 1 }}>{f}</T></View>
          ))}
          {fine.length > 3 && <Pressable onPress={() => setMoreTerms(!moreTerms)}><T color={brand.pink} style={{ fontWeight: '800', marginTop: 4 }}>{moreTerms ? 'See less' : 'See more'}</T></Pressable>}

          <Row icon="💡" text="How does Perkly work?" onPress={() => setHowOpen(true)} />

          <T v="h2" style={{ marginTop: 20 }}>About {merchant.name}</T>
          <T v="muted" numberOfLines={moreAbout ? undefined : 3}>{merchant.description ?? `${merchant.name} gives students instant discounts with Perkly.`}</T>
          {(merchant.description?.length ?? 0) > 140 && <Pressable onPress={() => setMoreAbout(!moreAbout)}><T color={brand.pink} style={{ fontWeight: '800' }}>{moreAbout ? 'Show less' : 'Show more'}</T></Pressable>}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}><T v="muted">Type</T><T>{merchant.subcategory ?? merchant.category}</T></View>
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: c.card, borderTopWidth: 1, borderTopColor: c.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
          <View style={{ width: 52, height: 52, borderRadius: 16, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
            <Heart merchantId={merchant.id} size={26} />
          </View>
          <Button title={`Scan to redeem • ${discountLabel(perk)}`} onPress={() => router.push('/scan')} style={{ flex: 1 }} />
        </View>
      </SafeAreaView>

      <Sheet visible={branchesOpen} onClose={() => setBranchesOpen(false)} title="Where to use it">
        <ScrollView style={{ flexGrow: 0 }}>
          {branches.map((b) => (
            <Pressable key={b.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border }}
              onPress={() => b.lat != null && Linking.openURL(Platform.OS === 'ios' ? `maps:0,0?q=${encodeURIComponent(merchant.name)}@${b.lat},${b.lng}` : `https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lng}`)}>
              <Text style={{ fontSize: 20 }}>📍</Text>
              <View style={{ flex: 1 }}><T v="h3">{b.name}</T>{b.address ? <T v="small">{b.address}</T> : null}</View>
              {b.d != null && <T v="small">{distanceLabel(b.d)}</T>}
            </Pressable>
          ))}
        </ScrollView>
      </Sheet>
      <HowItWorks visible={howOpen} onClose={() => setHowOpen(false)} />
    </View>
  );
}
