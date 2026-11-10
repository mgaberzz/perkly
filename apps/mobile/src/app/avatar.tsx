import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CartoonAvatar } from '@/components/avatar';
import { Text } from '@/components/text';
import { T } from '@/components/ui';
import { saveCartoon } from '@/lib/avatar';
import { BG_COLORS, cleanCartoon, DEFAULT_CARTOON, HAIR_COLORS, HIJAB_COLORS, OPTIONS, OUTFIT_COLORS, randomCartoon, SKIN, type CartoonConfig } from '@/lib/cartoon';
import { t } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { brand, useTheme } from '@/lib/theme';

type Tab = { key: string; label: string; emoji: string } & (
  | { kind: 'shape'; field: keyof CartoonConfig; options: readonly string[]; names?: Record<string, string> }
  | { kind: 'color'; field: keyof CartoonConfig; colors: readonly string[] });

/** Build-your-own cartoon avatar (Bitmoji-style). */
export default function AvatarBuilder() {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const { session, profile, refreshProfile } = useSession();
  const [cfg, setCfg] = useState<CartoonConfig>(() => (profile?.avatar_config ? cleanCartoon(profile.avatar_config) : DEFAULT_CARTOON));
  const [tab, setTab] = useState('skin');
  const [saving, setSaving] = useState(false);

  const TABS: Tab[] = useMemo(() => {
    const list: Tab[] = [
      { key: 'skin', label: t('Skin'), emoji: '✋', kind: 'color', field: 'skin', colors: SKIN },
      { key: 'face', label: t('Face'), emoji: '🙂', kind: 'shape', field: 'face', options: OPTIONS.face },
      { key: 'hair', label: t('Hair'), emoji: '💇', kind: 'shape', field: 'hair', options: OPTIONS.hair },
      { key: 'hairColor', label: t('Hair Colour'), emoji: '🎨', kind: 'color', field: 'hairColor', colors: HAIR_COLORS },
      { key: 'eyes', label: t('Eyes'), emoji: '👀', kind: 'shape', field: 'eyes', options: OPTIONS.eyes },
      { key: 'brows', label: t('Brows'), emoji: '🤨', kind: 'shape', field: 'brows', options: OPTIONS.brows },
      { key: 'mouth', label: t('Mouth'), emoji: '😁', kind: 'shape', field: 'mouth', options: OPTIONS.mouth },
      { key: 'facial', label: t('Beard'), emoji: '🧔', kind: 'shape', field: 'facial', options: OPTIONS.facial },
      { key: 'glasses', label: t('Glasses'), emoji: '👓', kind: 'shape', field: 'glasses', options: OPTIONS.glasses },
      { key: 'headwear', label: t('Head'), emoji: '🧕', kind: 'shape', field: 'headwear', options: OPTIONS.headwear },
    ];
    if (cfg.headwear === 'hijab') list.push({ key: 'hijabColor', label: t('Hijab Colour'), emoji: '🧣', kind: 'color', field: 'hijabColor', colors: HIJAB_COLORS });
    list.push(
      { key: 'outfit', label: t('Outfit'), emoji: '👕', kind: 'shape', field: 'outfit', options: OPTIONS.outfit },
      { key: 'outfitColor', label: t('Outfit Colour'), emoji: '🌈', kind: 'color', field: 'outfitColor', colors: OUTFIT_COLORS },
      { key: 'bg', label: t('Background'), emoji: '🖼️', kind: 'color', field: 'bg', colors: BG_COLORS },
      { key: 'blush', label: t('Blush'), emoji: '😊', kind: 'shape', field: 'blush', options: OPTIONS.blush },
    );
    return list;
  }, [cfg.headwear]);
  const current = TABS.find((x) => x.key === tab) ?? TABS[0];

  const set = (field: keyof CartoonConfig, v: string | number) => {
    Haptics.selectionAsync().catch(() => {});
    setCfg((x) => ({ ...x, [field]: v }));
  };
  async function save() {
    if (!session) return;
    setSaving(true);
    const { error } = await saveCartoon(session.user.id, cfg);
    setSaving(false);
    if (error) { Alert.alert(t('Something went wrong. Try again.')); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    await refreshProfile();
    router.back();
  }

  const tile = Math.floor((width - 16 * 2 - 10 * 2) / 3);
  const preview = Math.min(230, width * 0.58);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'bottom']}>
      {/* top bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 }}>
        <Pressable onPress={() => router.back()} hitSlop={10}><T style={{ fontWeight: '700' }}>{t('Cancel')}</T></Pressable>
        <T v="h3">{t('My Avatar')}</T>
        <Pressable onPress={save} disabled={saving} hitSlop={10} style={{ backgroundColor: brand.purple, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7, opacity: saving ? 0.6 : 1 }}>
          {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '900' }}>{t('Save')}</Text>}
        </Pressable>
      </View>

      {/* preview */}
      <View style={{ alignItems: 'center', paddingVertical: 6 }}>
        <View style={{ width: preview, height: preview, borderRadius: preview / 2, overflow: 'hidden', borderWidth: 4, borderColor: '#fff', shadowColor: brand.purple, shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 6 }}>
          <CartoonAvatar config={cfg} size={preview - 8} />
        </View>
        <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); setCfg(randomCartoon()); }}
          style={({ pressed }) => ({ marginTop: -22, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.card, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9, borderWidth: 1, borderColor: c.border, transform: [{ scale: pressed ? 0.95 : 1 }], shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 })}>
          <Text style={{ fontSize: 16 }}>🎲</Text><Text style={{ fontWeight: '800', color: c.text }}>{t('Shuffle')}</Text>
        </Pressable>
      </View>

      {/* category tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginTop: 8 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {TABS.map((x) => {
          const on = x.key === current.key;
          return (
            <Pressable key={x.key} onPress={() => setTab(x.key)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: on ? brand.ink : c.card, borderWidth: 1, borderColor: on ? brand.ink : c.border }}>
              <Text style={{ fontSize: 15 }}>{x.emoji}</Text>
              <Text style={{ fontWeight: '800', color: on ? '#fff' : c.text, fontSize: 13 }}>{x.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* options */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {current.kind === 'color'
          ? current.colors.map((col, i) => {
            const on = cfg[current.field] === i;
            return (
              <Pressable key={col} onPress={() => set(current.field, i)} accessibilityLabel={`${current.label} ${i + 1}`}
                style={{ width: (width - 32 - 10 * 4) / 5, aspectRatio: 1, borderRadius: 999, padding: 4, borderWidth: 3, borderColor: on ? brand.purple : 'transparent' }}>
                <View style={{ flex: 1, borderRadius: 999, backgroundColor: col, borderWidth: 1, borderColor: '#0000001A', alignItems: 'center', justifyContent: 'center' }}>
                  {on && <Text style={{ color: ['#FFFFFF', '#F5F0E8', '#E9D3A0', '#FFE0C7', '#F9D3B4', '#FFF1D6', '#EDE4FF', '#FFE1F0', '#DCEBFF', '#D7F5E8', '#FFE0DC', '#E9E9EF'].includes(col) ? brand.ink : '#fff', fontWeight: '900', fontSize: 16 }}>✓</Text>}
                </View>
              </Pressable>
            );
          })
          : current.options.map((o) => {
            const on = cfg[current.field] === o;
            return (
              <Pressable key={o} onPress={() => set(current.field, o)}
                style={({ pressed }) => ({ width: tile, borderRadius: 18, backgroundColor: c.card, borderWidth: 2.5, borderColor: on ? brand.purple : c.border, padding: 6, alignItems: 'center', gap: 2, transform: [{ scale: pressed ? 0.96 : 1 }] })}>
                <View style={{ width: tile - 16, height: tile - 16, borderRadius: 14, overflow: 'hidden' }}>
                  <CartoonAvatar config={{ ...cfg, [current.field]: o }} size={tile - 16} />
                </View>
                <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '700', color: on ? brand.purple : c.textMuted }}>{t(LABEL[o] ?? o)}</Text>
              </Pressable>
            );
          })}
      </ScrollView>
    </SafeAreaView>
  );
}

const LABEL: Record<string, string> = {
  oval: 'Oval', round: 'Round', long: 'Long', short: 'Short', side: 'Side part', buzz: 'Buzz', curly: 'Curly', quiff: 'Quiff', bob: 'Bob', bun: 'Bun',
  afro: 'Afro', ponytail: 'Ponytail', bald: 'Bald', normal: 'Normal', happy: 'Happy', wink: 'Wink', big: 'Big', sleepy: 'Sleepy', lashes: 'Lashes',
  natural: 'Natural', raised: 'Raised', thick: 'Thick', none: 'None', smile: 'Smile', grin: 'Grin', laugh: 'Laugh', neutral: 'Neutral', smirk: 'Smirk',
  tongue: 'Silly', stubble: 'Stubble', beard: 'Beard', mustache: 'Mustache', goatee: 'Goatee', square: 'Square', sunnies: 'Sunglasses', cateye: 'Cat-eye',
  hijab: 'Hijab', cap: 'Cap', beanie: 'Beanie', tee: 'T-shirt', hoodie: 'Hoodie', shirt: 'Shirt', sweater: 'Sweater', jacket: 'Jacket', on: 'On', off: 'Off',
};
