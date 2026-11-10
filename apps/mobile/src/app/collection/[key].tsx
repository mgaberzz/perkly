import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { Text } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PerkRow } from '@/components/perk-card';
import { Empty } from '@/components/ui';
import { applySortFilter, COLLECTIONS, NO_FILTERS, usePerkItems } from '@/lib/perks';
import { useTheme } from '@/lib/theme';
import { backChevron, t } from '@/lib/i18n';

export default function CollectionScreen() {
  const { key, category } = useLocalSearchParams<{ key: string; category?: string }>();
  const { c } = useTheme();
  const items = usePerkItems();
  const col = COLLECTIONS.find((x) => x.key === key) ?? COLLECTIONS[0];
  const list = useMemo(() => applySortFilter(
    items.filter((x) => col.match(x) && (!category || category === 'All' || x.merchant.category === category)),
    key === 'flash' ? 'ending' : 'popular', NO_FILTERS), [items, col, key, category]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <LinearGradient colors={col.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingBottom: 24 }}>
        <SafeAreaView edges={['top']} style={{ paddingHorizontal: 20, gap: 8 }}>
          <Pressable onPress={() => router.back()} hitSlop={12}><Text style={{ fontSize: 28, color: '#fff' }}>{backChevron()}</Text></Pressable>
          <Text style={{ fontSize: 56 }}>{col.emoji}</Text>
          <Text style={{ color: '#fff', fontSize: 30, fontWeight: '900' }}>{t(col.title)}</Text>
          <Text style={{ color: '#ffffffdd', fontWeight: '700' }}>{t('{n} perks', { n: list.length })}{category && category !== 'All' ? ` · ${t(category)}` : ''}</Text>
        </SafeAreaView>
      </LinearGradient>
      <FlatList data={list} keyExtractor={(x) => x.perk.id} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }}
        renderItem={({ item }) => <PerkRow item={item} />} ListEmptyComponent={<Empty emoji="😴" title={t('Nothing here yet 👀')} />} />
    </View>
  );
}
