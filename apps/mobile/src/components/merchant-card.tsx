import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Card, DiscountBadge, MerchantLogo, T } from './ui';
import { bestPerk, distanceLabel, timeLeft } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import { t } from '@/lib/i18n';
import type { Merchant } from '@/lib/types';

/** Row card for lists */
export function MerchantRow({ m, distance }: { m: Merchant; distance?: number | null }) {
  const perk = bestPerk(m.perks);
  return (
    <Card onPress={() => router.push(`/merchant/${m.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <MerchantLogo name={m.name} category={m.category} uri={m.logo_url} />
      <View style={{ flex: 1, gap: 2 }}>
        <T v="h3" numberOfLines={1}>{m.name}</T>
        <T v="small" numberOfLines={1}>{m.subcategory ?? t(m.category)}{m.channel === 'online' ? ` · 🌐 ${t('Online')}` : ''}{distance != null ? ` · ${distanceLabel(distance)}` : ''}</T>
      </View>
      {perk && <DiscountBadge perk={perk} size="sm" />}
    </Card>
  );
}

/** Tall card for horizontal carousels */
export function MerchantTile({ m, distance, flash }: { m: Merchant; distance?: number | null; flash?: boolean }) {
  const { c } = useTheme();
  const perk = flash ? m.perks.find((p) => p.is_flash) ?? bestPerk(m.perks) : bestPerk(m.perks);
  return (
    <Pressable onPress={() => router.push(`/merchant/${m.id}`)} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })}>
      <View style={{ width: 168, borderRadius: 22, padding: 14, gap: 10, backgroundColor: c.card, borderWidth: 1, borderColor: c.border }}>
        <MerchantLogo name={m.name} category={m.category} uri={m.logo_url} size={56} />
        <T v="h3" numberOfLines={1}>{m.name}</T>
        {perk && <DiscountBadge perk={perk} size="sm" />}
        <T v="small" numberOfLines={1}>
          {flash && perk?.end_at ? `⏳ ${timeLeft(perk.end_at)}` : distance != null ? `📍 ${distanceLabel(distance)}` : m.subcategory ?? t(m.category)}
        </T>
      </View>
    </Pressable>
  );
}
