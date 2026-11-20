import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { TextInput } from '@/components/text';
import { supabase } from '@/lib/supabase';
import { brand, useTheme } from '@/lib/theme';
import type { Campus } from '@/lib/types';
import { Sheet } from './sheet';
import { T } from './ui';
import { campusCity, campusName, t } from '@/lib/i18n';

let cache: Campus[] | null = null;
export function useCampuses() {
  const [campuses, setCampuses] = useState<Campus[]>(cache ?? []);
  useEffect(() => {
    if (cache) return;
    supabase.from('campuses').select('*').eq('is_active', true).order('name').returns<Campus[]>()
      // "Other university or institute" (no location) goes last
      .then(({ data }) => { cache = [...(data ?? [])].sort((a, b) => Number(a.lat == null) - Number(b.lat == null) || campusName(a).localeCompare(campusName(b))); setCampuses(cache); });
  }, []);
  return campuses;
}

export function CampusPicker({ visible, onClose, onPick, selectedId }: {
  visible: boolean; onClose: () => void; onPick: (c: Campus) => void; selectedId?: string | null;
}) {
  const { c } = useTheme();
  const campuses = useCampuses();
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? campuses.filter((x) => `${x.name} ${x.name_ar ?? ''} ${x.short_name ?? ''} ${x.city} ${x.city_ar ?? ''}`.toLowerCase().includes(s)) : campuses;
  }, [campuses, q]);
  return (
    <Sheet visible={visible} onClose={onClose} title={t('Pick Your Campus')}>
      <TextInput value={q} onChangeText={setQ} placeholder={`🔍  ${t('University, school or area')}`} placeholderTextColor={c.textMuted}
        style={{ backgroundColor: c.bg, borderRadius: 16, padding: 14, fontSize: 16, fontWeight: '600', color: c.text }} />
      <ScrollView style={{ flexGrow: 0 }} keyboardShouldPersistTaps="handled">
        {list.map((x) => (
          <Pressable key={x.id} onPress={() => { onPick(x); onClose(); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border }}>
            <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: x.id === selectedId ? brand.purple : c.chip, alignItems: 'center', justifyContent: 'center' }}>
              <T v="small" color={x.id === selectedId ? '#fff' : c.text}>{x.short_name ?? x.name.slice(0, 3)}</T>
            </View>
            <View style={{ flex: 1 }}>
              <T v="h3" numberOfLines={1}>{campusName(x)}</T>
              <T v="small">{campusCity(x)}</T>
            </View>
            {x.id === selectedId && <T color={brand.purple} style={{ fontWeight: '900' }}>✓</T>}
          </Pressable>
        ))}
        {list.length === 0 && <T v="muted" style={{ padding: 12 }}>{t('No match — pick the closest one, more campuses are coming 💜')}</T>}
      </ScrollView>
    </Sheet>
  );
}
