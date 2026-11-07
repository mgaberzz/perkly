import { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { Card, Empty, MerchantLogo, T } from '@/components/ui';
import { egp, shortDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { brand, useTheme } from '@/lib/theme';

type Row = {
  id: string; created_at: string; merchant_name: string; logo_url: string | null; branch_name: string; perk_title: string;
  discount_amount: number | null; final_amount: number | null; xp_awarded: number; status: string;
  channel: string; payment_method: string;
};

export default function History() {
  const { c } = useTheme();
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    supabase.from('my_redemptions').select('*').order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => setRows((data ?? []) as Row[]));
  }, []);
  return (
    <FlatList
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={{ padding: 20, gap: 10 }}
      data={rows ?? []}
      keyExtractor={(r) => r.id}
      ListEmptyComponent={rows ? <Empty emoji="🧾" title={t('No redemptions yet')} subtitle={t('Scan a Perkly QR at the cashier to start saving.')} /> : undefined}
      renderItem={({ item: r }) => (
        <Card style={{ flexDirection: 'row', gap: 12, alignItems: 'center', opacity: r.status === 'reversed' ? 0.5 : 1 }}>
          <MerchantLogo name={r.merchant_name} category="" uri={r.logo_url} size={44} />
          <View style={{ flex: 1 }}>
            <T v="h3" numberOfLines={1}>{r.merchant_name}</T>
            <T v="small" numberOfLines={1}>{r.perk_title} · {shortDate(r.created_at)}{r.channel === 'online' ? ` · 🌐 ${t('Online')}` : ''}{r.payment_method === 'in_app' ? ` · 💳 ${t('Paid in app')}` : ''}</T>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <T v="h3" color={brand.success}>{r.discount_amount != null ? `−${egp(r.discount_amount)}` : '✓'}</T>
            <T v="small">{r.status === 'reversed' ? t('reversed') : `+${r.xp_awarded} XP`}</T>
          </View>
        </Card>
      )}
    />
  );
}
