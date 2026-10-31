import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { T } from './ui';
import { discountLabel, distanceLabel, timeLeft } from '@/lib/format';
import type { PerkItem } from '@/lib/perks';
import { useSession } from '@/lib/session';
import { brand, CATEGORY_EMOJI, useTheme } from '@/lib/theme';

const ART: Record<string, readonly [string, string]> = {
  Food: ['#FFB38A', '#FF3EA5'], Coffee: ['#C4A484', '#7B2FF7'], Fashion: ['#2F80FF', '#7B2FF7'], Beauty: ['#FF8FC7', '#FF3EA5'],
  Fitness: ['#3DDC97', '#2F80FF'], Entertainment: ['#7B2FF7', '#2F80FF'], Electronics: ['#4B5563', '#7B2FF7'], Transport: ['#3DDC97', '#10B981'],
  Services: ['#F59E0B', '#FF3EA5'],
};

export function Heart({ merchantId, size = 22 }: { merchantId: string; size?: number }) {
  const { favorites, toggleFavorite } = useSession();
  const on = favorites.has(merchantId);
  return (
    <Pressable hitSlop={10} onPress={() => toggleFavorite(merchantId)}>
      <Text style={{ fontSize: size, color: brand.pink }}>{on ? '♥' : '♡'}</Text>
    </Pressable>
  );
}

/** Deal card for carousels: art + % OFF pill, merchant, perk title, branch & distance, redeemed count, heart. */
export function PerkCard({ item, width = 230 }: { item: PerkItem; width?: number | `${number}%` }) {
  const { c } = useTheme();
  const { perk, merchant } = item;
  return (
    <Pressable onPress={() => router.push(`/perk/${perk.id}`)} style={({ pressed }) => ({ width, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
      <View style={{ borderRadius: 22, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, overflow: 'hidden' }}>
        <LinearGradient colors={ART[merchant.category] ?? ['#7B2FF7', '#FF3EA5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ height: 120, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 56 }}>{CATEGORY_EMOJI[merchant.category] ?? '✨'}</Text>
          <View style={{ position: 'absolute', top: 10, left: 10, backgroundColor: perk.is_flash ? brand.pink : brand.purple, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>{perk.is_flash ? '⚡ ' : ''}{discountLabel(perk)}</Text>
          </View>
          {item.redeemed >= 5 && (
            <View style={{ position: 'absolute', top: 8, right: 10, width: 30, height: 30, borderRadius: 15, backgroundColor: '#FF7A1A', alignItems: 'center', justifyContent: 'center' }}>
              <Text>🔥</Text>
            </View>
          )}
        </LinearGradient>
        <View style={{ padding: 12, gap: 4 }}>
          <T v="small" numberOfLines={1}>{merchant.name}</T>
          <T v="h3" numberOfLines={2} style={{ minHeight: 44 }}>{perk.title}</T>
          <T v="small" numberOfLines={1}>📍 {item.branchName ?? merchant.name}{item.distance != null ? ` (${distanceLabel(item.distance)})` : ''}</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
            <View style={{ backgroundColor: '#FF3EA51A', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 }}>
              <Text style={{ color: brand.pink, fontWeight: '800', fontSize: 12 }}>
                {perk.is_flash && perk.end_at ? `⏳ ${timeLeft(perk.end_at)}` : item.redeemed ? `${item.redeemed} redeemed` : 'New ✨'}
              </Text>
            </View>
            <Heart merchantId={merchant.id} />
          </View>
          <View style={{ height: 1, backgroundColor: c.border, marginVertical: 6 }} />
          <T v="small">{Number(perk.min_spend) > 0 ? `Min spend ${Number(perk.min_spend)} EGP` : 'No minimum spend'}</T>
        </View>
      </View>
    </Pressable>
  );
}

/** List row (image left) for "Places" style lists. */
export function PerkRow({ item }: { item: PerkItem }) {
  const { c } = useTheme();
  const { perk, merchant } = item;
  return (
    <Pressable onPress={() => router.push(`/perk/${perk.id}`)} style={{ flexDirection: 'row', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border }}>
      <LinearGradient colors={ART[merchant.category] ?? ['#7B2FF7', '#FF3EA5']} style={{ width: 92, height: 92, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <Text style={{ fontSize: 40 }}>{CATEGORY_EMOJI[merchant.category] ?? '✨'}</Text>
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: perk.is_flash ? brand.pink : brand.purple, paddingVertical: 3 }}>
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 11, textAlign: 'center' }}>{discountLabel(perk)}</Text>
        </View>
      </LinearGradient>
      <View style={{ flex: 1, gap: 3 }}>
        <T v="small" numberOfLines={1}>{merchant.subcategory ?? merchant.category}</T>
        <T v="h3" numberOfLines={1}>{merchant.name}</T>
        <T v="muted" numberOfLines={1} style={{ fontSize: 13 }}>{perk.title}</T>
        <T v="small" numberOfLines={1}>📍 {item.branchName}{item.distance != null ? ` (${distanceLabel(item.distance)})` : ''}</T>
        {item.redeemed > 0 && <T v="small" color={brand.pink}>🔥 {item.redeemed} redeemed this month</T>}
      </View>
    </Pressable>
  );
}

export function CollectionCard({ title, emoji, tag, colors, onPress }: { title: string; emoji: string; tag: string; colors: readonly [string, string]; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 160, height: 170, borderRadius: 22, padding: 14, justifyContent: 'space-between', overflow: 'hidden' }}>
        <View style={{ alignSelf: 'flex-start', backgroundColor: '#ffffff33', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{tag}</Text>
        </View>
        <Text style={{ fontSize: 64, position: 'absolute', right: -6, top: 36, opacity: 0.9 }}>{emoji}</Text>
        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>{title}</Text>
      </LinearGradient>
    </Pressable>
  );
}

/** Underlined scrollable tabs (subcategories). */
export function UnderlineTabs({ tabs, value, onChange, big }: { tabs: string[]; value: string; onChange: (t: string) => void; big?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: c.border }}>
      <View style={{ flexDirection: 'row', gap: big ? 24 : 20 }}>
        {tabs.map((t) => {
          const on = t === value;
          return (
            <Pressable key={t} onPress={() => onChange(t)} style={{ paddingVertical: 10 }}>
              <Text style={{ fontSize: big ? 24 : 15, fontWeight: big ? '900' : '700', color: on ? c.text : c.textMuted, opacity: on ? 1 : big ? 0.45 : 1 }}>{t}</Text>
              {!big && <View style={{ height: 4, borderRadius: 2, marginTop: 6, backgroundColor: on ? brand.pink : 'transparent' }} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
