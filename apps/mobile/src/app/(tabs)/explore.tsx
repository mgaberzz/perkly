import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { MerchantRow } from '@/components/merchant-card';
import { Chip, Empty, Screen, T } from '@/components/ui';
import { useSession } from '@/lib/session';
import { CATEGORIES, CATEGORY_EMOJI, useTheme } from '@/lib/theme';
import { nearestBranch } from '@/lib/format';

type Sort = 'best' | 'near' | 'az';
const COLLECTIONS = [
  { key: 'flash', label: '⚡ Flash perks' },
  { key: 'big', label: '🤑 20%+ off' },
  { key: 'fav', label: '❤️ My favorites' },
];

export default function Explore() {
  const { c } = useTheme();
  const { merchants, origin: coords, favorites } = useSession();
  const { fav } = useLocalSearchParams<{ fav?: string }>();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [collection, setCollection] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>(coords ? 'near' : 'best');
  useEffect(() => { if (fav) setCollection('fav'); }, [fav]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    let rows = merchants.map((m) => ({ m, d: nearestBranch(m, coords) }));
    if (s) rows = rows.filter(({ m }) => `${m.name} ${m.category} ${m.subcategory ?? ''} ${m.perks.map((p) => p.title).join(' ')}`.toLowerCase().includes(s));
    if (cat) rows = rows.filter(({ m }) => m.category === cat);
    if (collection === 'flash') rows = rows.filter(({ m }) => m.perks.some((p) => p.is_flash));
    if (collection === 'big') rows = rows.filter(({ m }) => m.perks.some((p) => p.discount_type === 'percentage' && Number(p.discount_value) >= 20));
    if (collection === 'fav') rows = rows.filter(({ m }) => favorites.has(m.id));
    const best = (x: (typeof rows)[number]) => Math.max(...x.m.perks.map((p) => Number(p.discount_value)));
    if (sort === 'near') rows.sort((a, b) => (a.d ?? 1e12) - (b.d ?? 1e12));
    else if (sort === 'az') rows.sort((a, b) => a.m.name.localeCompare(b.m.name));
    else rows.sort((a, b) => best(b) - best(a));
    return rows;
  }, [merchants, coords, favorites, q, cat, collection, sort]);

  return (
    <Screen>
      <T v="h1">Explore 🧭</T>
      <TextInput
        value={q} onChangeText={setQ} placeholder="Search cafes, restaurants, fashion…" placeholderTextColor={c.textMuted}
        style={{ backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 16, fontSize: 16, fontWeight: '600', color: c.text }}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {CATEGORIES.map((k) => {
          const on = cat === k;
          return (
            <Pressable key={k} onPress={() => router.push({ pathname: '/category/[name]', params: { name: k } })} onLongPress={() => setCat(on ? null : k)}
              style={{ width: '31%', aspectRatio: 1.25, borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 4,
                backgroundColor: on ? '#7B2FF7' : c.card, borderWidth: 1, borderColor: on ? '#7B2FF7' : c.border }}>
              <T style={{ fontSize: 28 }}>{CATEGORY_EMOJI[k]}</T>
              <T v="small" color={on ? '#fff' : c.text}>{k}</T>
            </Pressable>
          );
        })}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {COLLECTIONS.map((x) => <Chip key={x.key} label={x.label} active={collection === x.key} onPress={() => setCollection(collection === x.key ? null : x.key)} />)}
        <View style={{ width: 8 }} />
        {coords && <Chip label="Nearest" active={sort === 'near'} onPress={() => setSort('near')} />}
        <Chip label="Best deal" active={sort === 'best'} onPress={() => setSort('best')} />
        <Chip label="A–Z" active={sort === 'az'} onPress={() => setSort('az')} />
      </ScrollView>
      <T v="label">{list.length} places</T>
      <View style={{ gap: 10 }}>
        {list.map(({ m, d }) => <MerchantRow key={m.id} m={m} distance={d} />)}
        {list.length === 0 && <Empty emoji="🔍" title="No perks here yet" subtitle="Want us to add some? Tell your ambassador 👇" />}
      </View>
    </Screen>
  );
}
