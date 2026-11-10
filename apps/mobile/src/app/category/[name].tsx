import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import { Text, TextInput } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AreaSheet } from '@/components/area';
import { FilterSortSheet } from '@/components/filter-sheet';
import { CollectionCard, PerkCard, PerkRow, UnderlineTabs } from '@/components/perk-card';
import { Chip, Empty, SectionHeader, T } from '@/components/ui';
import { applySortFilter, COLLECTIONS, NO_FILTERS, usePerkItems, type Filters, type SortKey } from '@/lib/perks';
import { backChevron, fwdChevron, t } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { brand, CATEGORY_EMOJI, useTheme } from '@/lib/theme';

const MODES = ['Perks', 'Flash', 'Places'] as const;

export default function CategoryScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const { c } = useTheme();
  const { areaLabel } = useSession();
  const all = usePerkItems();
  const [mode, setMode] = useState<(typeof MODES)[number]>('Perks');
  const [sub, setSub] = useState('All');
  const [q, setQ] = useState('');
  const [areaOpen, setAreaOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sort, setSort] = useState<SortKey>('nearest');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);

  const inCat = useMemo(() => all.filter((x) => name === 'All' || x.merchant.category === name), [all, name]);
  const subs = useMemo(() => ['All', ...Array.from(new Set(inCat.map((x) => x.merchant.subcategory).filter(Boolean) as string[])).sort()], [inCat]);
  const scoped = useMemo(() => {
    const s = q.trim().toLowerCase();
    return inCat.filter((x) => (sub === 'All' || x.merchant.subcategory === sub)
      && (mode !== 'Flash' || x.perk.is_flash)
      && (!s || `${x.merchant.name} ${x.perk.title} ${x.merchant.subcategory ?? ''}`.toLowerCase().includes(s)));
  }, [inCat, sub, mode, q]);
  const list = useMemo(() => applySortFilter(scoped, sort, filters), [scoped, sort, filters]);
  const trending = useMemo(() => applySortFilter(scoped, 'popular', NO_FILTERS).slice(0, 8), [scoped]);
  const collections = COLLECTIONS.filter((col) => scoped.some(col.match));
  const filtered = filters.flashOnly || filters.noMinSpend || filters.big;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <FlatList
        data={mode === 'Perks' ? [] : list}
        keyExtractor={(x) => x.perk.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
        ListHeaderComponent={
          <View style={{ gap: 16 }}>
            <Pressable onPress={() => router.back()} hitSlop={12}><Text style={{ fontSize: 28, color: c.text }}>{backChevron()}</Text></Pressable>
            <T v="h1">{CATEGORY_EMOJI[name] ?? '✨'} {t(name)}</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 999, borderWidth: 1, borderColor: c.border, paddingStart: 16 }}>
              <Text style={{ fontSize: 16, color: brand.pink }}>🔍</Text>
              <TextInput value={q} onChangeText={setQ} placeholder={t('Search in {place}', { place: areaLabel })} placeholderTextColor={c.textMuted}
                style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 10, fontSize: 15, color: c.text }} />
              <View style={{ width: 1, height: 24, backgroundColor: c.border }} />
              <Pressable onPress={() => setAreaOpen(true)} style={{ paddingHorizontal: 16 }}><Text style={{ fontSize: 18 }}>📍</Text></Pressable>
            </View>
            <UnderlineTabs big tabs={[...MODES]} value={mode} onChange={(m) => setMode(m as (typeof MODES)[number])} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <UnderlineTabs tabs={subs} value={sub} onChange={setSub} />
            </ScrollView>

            {mode === 'Perks' && (
              <View style={{ gap: 20 }}>
                {collections.length > 0 && (
                  <View style={{ gap: 12 }}>
                    <SectionHeader title={t('Collections')} />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                      {collections.map((col) => (
                        <CollectionCard key={col.key} title={t(col.title)} emoji={col.emoji} tag={t(col.tag)} colors={col.colors}
                          onPress={() => router.push({ pathname: '/collection/[key]', params: { key: col.key, category: name } })} />
                      ))}
                    </ScrollView>
                  </View>
                )}
                <View style={{ gap: 4 }}>
                  <SectionHeader title={t('Trending Perks')} action={`${t('See All')} ${fwdChevron()}`} onAction={() => setMode('Places')} />
                  <T v="muted">{t('Most Redeemed by Students This Month')}</T>
                </View>
                {trending.length ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                    {trending.map((x) => <PerkCard key={x.perk.id} item={x} />)}
                  </ScrollView>
                ) : <Empty emoji="🔍" title={t('No Perks Here Yet')} subtitle={t('Try another subcategory or area.')} />}
              </View>
            )}
            {mode !== 'Perks' && <T v="label">{t('{n} Result(s)', { n: list.length })}</T>}
          </View>
        }
        renderItem={({ item }) => <PerkRow item={item} />}
        ListEmptyComponent={mode !== 'Perks' ? <Empty emoji="😴" title={mode === 'Flash' ? t('No Flash Perks rn ⚡') : t('No matches, bestie')} subtitle={t('New perks drop every week. Stay tuned 👀')} /> : undefined}
        ListFooterComponent={mode === 'Places' ? (
          <View style={{ gap: 10, marginTop: 20 }}>
            <T v="h3">{t('Try these filters:')}</T>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <Chip label={t('Nearest')} active={sort === 'nearest'} onPress={() => setSort('nearest')} />
              <Chip label={t('Most Redeemed')} active={sort === 'popular'} onPress={() => setSort('popular')} />
              <Chip label={t('Biggest Discount')} active={sort === 'discount'} onPress={() => setSort('discount')} />
              <Chip label={t('No Min Spend')} active={filters.noMinSpend} onPress={() => setFilters({ ...filters, noMinSpend: !filters.noMinSpend })} />
            </ScrollView>
          </View>
        ) : undefined}
      />
      {mode !== 'Perks' && (
        <Pressable onPress={() => setFilterOpen(true)} style={{ position: 'absolute', bottom: 36, alignSelf: 'center', backgroundColor: brand.pink, borderRadius: 999, paddingHorizontal: 24, paddingVertical: 14, flexDirection: 'row', gap: 8,
          shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}>
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>{t('Filter & Sort')}{filtered ? ' •' : ''}</Text>
          <Text style={{ color: '#fff', fontSize: 16 }}>⏷</Text>
        </Pressable>
      )}
      <AreaSheet visible={areaOpen} onClose={() => setAreaOpen(false)} />
      <FilterSortSheet visible={filterOpen} onClose={() => setFilterOpen(false)} sort={sort} filters={filters}
        onApply={(s, f) => { setSort(s); setFilters(f); }} />
    </SafeAreaView>
  );
}
