import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Text } from '@/components/text';
import { Card, Screen, T } from '@/components/ui';
import { t } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { brand, useTheme } from '@/lib/theme';

type Item = { id: string; kind: 'verification' | 'payment' | 'broadcast' | 'reminder'; title: string; body: string; data: { url?: string }; read_at: string | null; created_at: string };
const ICON: Record<Item['kind'], string> = { verification: '🎓', payment: '💳', broadcast: '🔥', reminder: '⏰' };

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return t('Now');
  if (m < 60) return t('{n}m', { n: m });
  if (m < 1440) return t('{n}h', { n: Math.round(m / 60) });
  return t('{n}d', { n: Math.round(m / 1440) });
}

export default function Inbox() {
  const { c } = useTheme();
  const [items, setItems] = useState<Item[] | null>(null);

  useFocusEffect(useCallback(() => {
    supabase.from('notifications').select('id, kind, title, body, data, read_at, created_at')
      .order('created_at', { ascending: false }).limit(50).returns<Item[]>()
      .then(({ data }) => {
        setItems(data ?? []);
        if ((data ?? []).some((n) => !n.read_at)) supabase.rpc('mark_notifications_read').then(() => {});
      });
  }, []));

  if (!items) return <Screen edges={[]}><ActivityIndicator color={brand.purple} style={{ marginTop: 40 }} /></Screen>;
  if (items.length === 0) {
    return (
      <Screen edges={[]}>
        <View style={{ alignItems: 'center', gap: 8, marginTop: 60 }}>
          <Text style={{ fontSize: 48 }}>📭</Text>
          <T v="h3">{t('No notifications yet')}</T>
          <T v="muted" style={{ textAlign: 'center' }}>{t('Perk drops, payment receipts and your student verification result show up here.')}</T>
        </View>
      </Screen>
    );
  }
  return (
    <Screen edges={[]}>
      {items.map((n) => (
        <Pressable key={n.id} disabled={!n.data?.url} onPress={() => n.data?.url?.startsWith('/') && router.push(n.data.url as Href)}>
          <Card style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', borderColor: n.read_at ? c.border : brand.purple }}>
            <Text style={{ fontSize: 24 }}>{ICON[n.kind] ?? '🔔'}</Text>
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <T style={{ flex: 1, fontWeight: '800' }} numberOfLines={2}>{n.title}</T>
                <T v="small">{ago(n.created_at)}</T>
              </View>
              <T v="muted">{n.body}</T>
            </View>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
