import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, LayoutAnimation, Pressable, TextInput, View } from 'react-native';
import { Text } from '@/components/text';
import { Empty, MerchantLogo, T } from '@/components/ui';
import { ShareReceiptButton } from '@/components/share-receipt';
import { egp, shortDate } from '@/lib/format';
import { fwdChevron, locale, t } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { brand, useTheme } from '@/lib/theme';

type Row = {
  id: string; created_at: string; merchant_name: string; logo_url: string | null; branch_name: string; perk_title: string;
  original_amount: number | null; discount_amount: number | null; final_amount: number | null; xp_awarded: number; status: string;
  channel: string; payment_method: string; verification_code: string; tx_code: string | null; receipt_ref?: string | null;
};
type Filters = { period: string; payment: string; channel: string; status: string };
const NONE: Filters = { period: '', payment: '', channel: '', status: '' };

/** Same look as the portal: search, a Filters dropdown with removable chips, and cards that drop down their details. */
export default function History() {
  const { c } = useTheme();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState('');
  const [f, setF] = useState<Filters>(NONE);
  const [panel, setPanel] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('my_redemptions').select('*').order('created_at', { ascending: false }).limit(500)
      .then(({ data }) => setRows((data ?? []) as Row[]));
  }, []);

  const OPTIONS: { key: keyof Filters; label: string; options: [string, string][] }[] = [
    { key: 'period', label: t('Period'), options: [['7', t('Last 7 Days')], ['30', t('Last 30 Days')], ['90', t('Last 90 Days')]] },
    { key: 'payment', label: t('Payment'), options: [['merchant', t('At the Cashier')], ['in_app', t('Paid in App')]] },
    { key: 'channel', label: t('Where'), options: [['in_store', t('In-Store')], ['online', t('Online')]] },
    { key: 'status', label: t('Status'), options: [['success', t('Success')], ['reversed', t('Reversed')]] },
  ];
  const active = OPTIONS.filter((o) => f[o.key]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const since = f.period ? Date.now() - Number(f.period) * 86400000 : 0;
    return (rows ?? []).filter((r) =>
      (!s || [r.tx_code, r.verification_code, r.receipt_ref, r.merchant_name, r.perk_title].some((x) => x?.toLowerCase().includes(s))) &&
      (!since || new Date(r.created_at).getTime() >= since) &&
      (!f.payment || r.payment_method === f.payment) && (!f.channel || r.channel === f.channel) && (!f.status || r.status === f.status));
  }, [rows, q, f]);
  const saved = list.filter((r) => r.status !== 'reversed').reduce((a, r) => a + Number(r.discount_amount ?? 0), 0);

  const animate = () => LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  const set = (k: keyof Filters, v: string) => { animate(); setF((x) => ({ ...x, [k]: x[k] === v ? '' : v })); };

  const header = (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingHorizontal: 12, height: 46 }}>
          <Text style={{ fontSize: 15, color: c.textMuted }}>🔍</Text>
          <TextInput value={q} onChangeText={setQ} placeholder={t('Search transaction ID, place or perk')} placeholderTextColor={c.textMuted}
            autoCapitalize="none" autoCorrect={false} returnKeyType="search" style={{ flex: 1, color: c.text, fontSize: 15 }} />
          {q ? <Pressable onPress={() => setQ('')} hitSlop={10}><Text style={{ color: c.textMuted, fontWeight: '800' }}>✕</Text></Pressable> : null}
        </View>
        <Pressable onPress={() => { animate(); setPanel((p) => !p); }} accessibilityRole="button"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 46, borderRadius: 14, borderWidth: 1,
            borderColor: panel || active.length ? brand.purple : c.border, backgroundColor: panel || active.length ? '#7B2FF712' : c.card }}>
          <Text style={{ fontWeight: '800', color: panel || active.length ? brand.purple : c.text }}>{t('Filters')}</Text>
          {active.length > 0 && <View style={{ backgroundColor: brand.purple, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}><Text style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>{active.length}</Text></View>}
          <Text style={{ color: panel || active.length ? brand.purple : c.textMuted, fontSize: 11 }}>{panel ? '▲' : '▼'}</Text>
        </Pressable>
      </View>

      {panel && (
        <View style={{ backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 14, gap: 12 }}>
          {OPTIONS.map((o) => (
            <View key={o.key} style={{ gap: 6 }}>
              <T v="label">{o.label}</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {o.options.map(([v, label]) => {
                  const on = f[o.key] === v;
                  return (
                    <Pressable key={v} onPress={() => set(o.key, v)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: on ? brand.purple : c.chip }}>
                      <Text style={{ color: on ? '#fff' : c.text, fontWeight: '700', fontSize: 13 }}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10 }}>
            <Pressable onPress={() => { animate(); setF(NONE); }} hitSlop={8}><T v="small" style={{ fontWeight: '800' }}>{t('Clear All')}</T></Pressable>
            <Pressable onPress={() => { animate(); setPanel(false); }} style={{ backgroundColor: brand.purple, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 9 }}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>{t('Show {n} Results', { n: list.length })}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {active.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {active.map((o) => (
            <Pressable key={o.key} onPress={() => set(o.key, f[o.key])} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#7B2FF71A', borderRadius: 999, paddingStart: 12, paddingEnd: 8, paddingVertical: 6 }}>
              <Text style={{ color: brand.purple, fontWeight: '700', fontSize: 12 }}>{o.options.find(([v]) => v === f[o.key])?.[1]}</Text>
              <Text style={{ color: brand.purple, fontSize: 11, fontWeight: '900' }}>✕</Text>
            </Pressable>
          ))}
        </View>
      )}

      {rows && rows.length > 0 && (
        <T v="small">{t('{n} transactions · you saved {amount}', { n: list.length, amount: egp(saved) })}</T>
      )}
    </View>
  );

  return (
    <FlatList
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      data={list}
      keyExtractor={(r) => r.id}
      ListHeaderComponent={header}
      keyboardShouldPersistTaps="handled"
      ListEmptyComponent={rows ? (rows.length
        ? <Empty emoji="🔎" title={t('No matches, bestie')} subtitle={t('Try another search or clear the filters.')} />
        : <Empty emoji="🧾" title={t('No Redemptions Yet')} subtitle={t('Scan a Perkly QR at the cashier to start saving.')} />) : undefined}
      renderItem={({ item: r }) => {
        const isOpen = open === r.id;
        const reversed = r.status === 'reversed';
        const rowsOf: [string, string][] = [
          [t('Transaction ID'), r.tx_code ?? '—'],
          [t('Code'), r.verification_code],
          ...(r.receipt_ref ? [[t('Shop receipt / order no.'), r.receipt_ref] as [string, string]] : []),
          [t('Date'), new Date(r.created_at).toLocaleString(locale(), { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })],
          [t('Branch'), r.branch_name === 'Online' ? t('Online') : r.branch_name],
          [t('Bill'), egp(r.original_amount)],
          [t('Perkly Discount'), r.discount_amount != null ? `−${egp(r.discount_amount)}` : t('Applied by Cashier')],
          [t('You Paid'), egp(r.final_amount ?? r.original_amount)],
          [t('Payment'), r.payment_method === 'in_app' ? t('Paid in App') : t('At the Cashier')],
          [t('XP Earned'), `+${r.xp_awarded} XP`],
        ];
        return (
          <View style={{ backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: isOpen ? '#7B2FF755' : c.border, overflow: 'hidden',
            shadowColor: '#000', shadowOpacity: isOpen ? 0.08 : 0.03, shadowRadius: isOpen ? 12 : 4, shadowOffset: { width: 0, height: 2 }, elevation: isOpen ? 3 : 1 }}>
            {reversed && <View style={{ position: 'absolute', start: 0, top: 0, bottom: 0, width: 4, backgroundColor: '#EF4444' }} />}
            <Pressable onPress={() => { animate(); setOpen(isOpen ? null : r.id); }} style={({ pressed }) => ({ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14, opacity: pressed ? 0.85 : 1 })}>
              <MerchantLogo name={r.merchant_name} category="" uri={r.logo_url} size={46} />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <T v="h3" numberOfLines={1} style={{ flex: 1 }}>{r.merchant_name}</T>
                  <T v="h3" color={reversed ? c.textMuted : brand.success} style={reversed ? { textDecorationLine: 'line-through' } : undefined}>
                    {r.discount_amount != null ? `−${egp(r.discount_amount)}` : '✓'}
                  </T>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <T v="small" numberOfLines={1} style={{ flex: 1 }}>
                    <Text style={{ color: brand.purple, fontWeight: '800', writingDirection: 'ltr' }}>{r.tx_code ?? r.verification_code}</Text> · {shortDate(r.created_at)}
                  </T>
                  <T v="small">{reversed ? t('Reversed') : `+${r.xp_awarded} XP`}</T>
                </View>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                  <Tag label={r.perk_title} />
                  {r.payment_method === 'in_app' && <Tag label={`💳 ${t('Paid in App')}`} tone="green" />}
                  {r.channel === 'online' && <Tag label={`🌐 ${t('Online')}`} />}
                </View>
              </View>
              <Text style={{ color: c.textMuted, fontSize: 12 }}>{isOpen ? '▲' : '▼'}</Text>
            </Pressable>
            {isOpen && (
              <View style={{ borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.bg, paddingHorizontal: 16, paddingVertical: 6 }}>
                {rowsOf.map(([k, v], i) => (
                  <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 9, borderBottomWidth: i < rowsOf.length - 1 ? 1 : 0, borderBottomColor: c.border }}>
                    <T v="small">{k}</T>
                    <T style={{ fontWeight: '800', flexShrink: 1, textAlign: 'right', color: i === 0 ? brand.purple : c.text }}>{v}</T>
                  </View>
                ))}
                <View style={{ flexDirection: 'row', gap: 8, marginVertical: 10 }}>
                  <View style={{ flex: 1 }}><ShareReceiptButton data={r} variant="outline" label={t('Share')} /></View>
                  <Pressable onPress={() => router.push({ pathname: '/explain', params: { metric: 'redemption', id: r.id } })}
                    style={{ flex: 1.4, borderRadius: 14, backgroundColor: brand.purple, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '800' }}>{t('Full Breakdown')} {fwdChevron()}</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        );
      }}
    />
  );
}

function Tag({ label, tone }: { label: string; tone?: 'green' }) {
  const { c } = useTheme();
  return (
    <View style={{ backgroundColor: tone === 'green' ? '#12B76A1A' : c.chip, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, maxWidth: 200 }}>
      <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '700', color: tone === 'green' ? brand.success : c.textMuted }}>{label}</Text>
    </View>
  );
}
