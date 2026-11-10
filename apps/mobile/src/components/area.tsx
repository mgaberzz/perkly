import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { TextInput } from '@/components/text';
import { useCampuses } from './campus-picker';
import { Sheet } from './sheet';
import { T } from './ui';
import { t } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { brand, useTheme } from '@/lib/theme';
import type { Campus } from '@/lib/types';

/** "📍 Near you      Change" — opens the area sheet. */
export function LocationBar() {
  const { areaLabel } = useSession();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <T style={{ fontSize: 18 }}>📍</T>
        <T v="h3" numberOfLines={1} style={{ flex: 1 }}>{areaLabel}</T>
        <T v="small" color={brand.pink} style={{ fontSize: 14, fontWeight: '800' }}>{t('Change')}</T>
      </Pressable>
      <AreaSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function AreaSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { c } = useTheme();
  const { setArea, refreshLocation, campus, recentAreas, clearRecentAreas } = useSession();
  const campuses = useCampuses();
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? campuses.filter((x) => `${x.name} ${x.short_name ?? ''} ${x.city}`.toLowerCase().includes(s)) : [];
  }, [q, campuses]);

  const pick = (x: Campus) => { setArea({ kind: 'campus', campus: x }); setQ(''); onClose(); };
  const Row = ({ x }: { x: Campus }) => (
    <Pressable onPress={() => pick(x)} style={{ paddingVertical: 14 }}>
      <T>{x.name}</T>
      <T v="small">{x.city}</T>
    </Pressable>
  );
  const Quick = ({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) => (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderColor: c.border }}>
      <T style={{ fontSize: 18 }}>{icon}</T><T v="h3">{label}</T>
    </Pressable>
  );

  return (
    <Sheet visible={visible} onClose={onClose} height="88%">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <T style={{ fontSize: 20 }}>📍</T>
        <TextInput value={q} onChangeText={setQ} placeholder={t('Where are you heading?')} placeholderTextColor={c.textMuted} autoFocus={false}
          style={{ flex: 1, fontSize: 18, fontWeight: '600', paddingVertical: 10, color: c.text }} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        <Quick icon="🧭" label={t('Nearby')} onPress={async () => { setArea({ kind: 'nearby' }); onClose(); await refreshLocation(true); }} />
        {campus && <Quick icon="🎓" label={campus.short_name ?? t('My Campus')} onPress={() => pick(campus)} />}
      </View>
      <ScrollView style={{ flexGrow: 0 }} keyboardShouldPersistTaps="handled">
        {q ? (
          results.length ? results.map((x) => <Row key={x.id} x={x} />) : <T v="muted" style={{ paddingVertical: 12 }}>{t('No places match “{q}”.', { q })}</T>
        ) : (
          <>
            {recentAreas.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <T v="h3">{t('Recent')}</T>
                  <Pressable onPress={clearRecentAreas}><T v="small" color={brand.pink} style={{ fontWeight: '800' }}>{t('Clear All')}</T></Pressable>
                </View>
                {recentAreas.map((x) => <Row key={x.id} x={x} />)}
                <View style={{ height: 1, backgroundColor: c.border, marginVertical: 8 }} />
              </View>
            )}
            <T v="h3" style={{ marginTop: 8 }}>{t('Popular Spots')}</T>
            {campuses.map((x) => <Row key={x.id} x={x} />)}
          </>
        )}
      </ScrollView>
    </Sheet>
  );
}
