import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/text';
import { Card, Empty, MerchantLogo, T } from '@/components/ui';
import { egp, levelProgress, shortDate } from '@/lib/format';
import { backChevron, fwdChevron, locale, t } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { brand, gradient, useTheme } from '@/lib/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { ShareReceiptButton } from '@/components/share-receipt';

type Red = {
  id: string; created_at: string; merchant_name: string; logo_url: string | null; branch_name: string; perk_title: string;
  original_amount: number | null; discount_amount: number | null; final_amount: number | null; xp_awarded: number;
  status: string; verification_code: string; tx_code?: string | null; channel: string; payment_method: string;
};
type Xp = { id: number; amount: number; reason: string; created_at: string; context: Record<string, string> };
type Order = { id: string; order_ref: string; amount: number; cashback_amount: number; status: string; created_at: string; merchant: { name: string } | null };

const REASON: Record<string, string> = {
  redemption: 'Redeeming a perk', new_merchant: 'Trying a new place', streak: 'Streak bonus', streak_milestone: 'Streak milestone',
  quest: 'Quest completed', referral: 'Friend joined with your code', daily_open: 'Opening the app', admin: 'Bonus from Perkly',
  spin: 'Spin the wheel', online_order: 'Online order',
};
const ICON: Record<string, string> = { redemption: '🧾', new_merchant: '🧭', streak: '🔥', streak_milestone: '🏅', quest: '🎯', referral: '💜', daily_open: '☀️', admin: '🎁', spin: '🎡', online_order: '🌐' };

/**
 * "Why is this number what it is?" — every number in the app opens this screen:
 * saved · redemptions · xp · streak · cashback · redemption (one receipt)
 */
export default function Explain() {
  const { c } = useTheme();
  const { metric = 'saved', id } = useLocalSearchParams<{ metric?: string; id?: string }>();
  const { session, stats } = useSession();
  const [reds, setReds] = useState<Red[] | null>(null);
  const [xp, setXp] = useState<Xp[] | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    if (!session) return;
    if (['saved', 'redemptions', 'streak', 'redemption'].includes(metric)) {
      supabase.from('my_redemptions').select('*').order('created_at', { ascending: false }).limit(500)
        .then(({ data }) => setReds((data ?? []) as Red[]));
    }
    if (metric === 'xp' || metric === 'redemption') {
      supabase.from('xp_events').select('id, amount, reason, created_at, context').eq('user_id', session.user.id)
        .order('created_at', { ascending: false }).limit(500).then(({ data }) => setXp((data ?? []) as Xp[]));
    }
    if (metric === 'cashback') {
      supabase.from('online_orders').select('id, order_ref, amount, cashback_amount, status, created_at, merchant:merchants(name)')
        .eq('user_id', session.user.id).order('created_at', { ascending: false }).then(({ data }) => setOrders((data ?? []) as unknown as Order[]));
    }
  }, [metric, session]);

  const ok = (reds ?? []).filter((r) => r.status !== 'reversed');
  const open = (r: Red) => router.push({ pathname: '/explain', params: { metric: 'redemption', id: r.id } });

  const Row = ({ label, value, sign, strong, onPress }: { label: string; value: string; sign?: string; strong?: boolean; onPress?: () => void }) => (
    <Pressable onPress={onPress} disabled={!onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14,
      backgroundColor: strong ? '#7B2FF714' : 'transparent' }}>
      <Text style={{ width: 16, color: c.textMuted, textAlign: 'center' }}>{sign ?? ''}</Text>
      <T style={{ flex: 1, fontWeight: strong ? '900' : '600' }}>{label}</T>
      <T style={{ fontWeight: '900' }} color={strong ? brand.purple : c.text}>{value}</T>
      {onPress && <T v="muted">{fwdChevron()}</T>}
    </Pressable>
  );

  const RedRow = ({ r }: { r: Red }) => (
    <Pressable onPress={() => open(r)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border, opacity: r.status === 'reversed' ? 0.5 : 1 }}>
      <MerchantLogo name={r.merchant_name} category="" uri={r.logo_url} size={40} />
      <View style={{ flex: 1 }}>
        <T v="h3" numberOfLines={1}>{r.merchant_name}</T>
        <T v="small" numberOfLines={1}>{r.perk_title} · {shortDate(r.created_at)}</T>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <T style={{ fontWeight: '900' }} color={brand.success}>{r.discount_amount != null ? `−${egp(r.discount_amount)}` : '✓'}</T>
        <T v="small">+{r.xp_awarded} XP</T>
      </View>
    </Pressable>
  );

  // ── Build the content for each metric ──
  const view = useMemo(() => {
    if (metric === 'saved' || metric === 'redemptions') {
      if (!reds) return null;
      const bills = ok.reduce((a, r) => a + Number(r.original_amount ?? 0), 0);
      const paid = ok.reduce((a, r) => a + Number(r.final_amount ?? r.original_amount ?? 0), 0);
      const saved = ok.reduce((a, r) => a + Number(r.discount_amount ?? 0), 0);
      const places = new Map<string, { n: number; saved: number }>();
      for (const r of ok) { const p = places.get(r.merchant_name) ?? { n: 0, saved: 0 }; p.n++; p.saved += Number(r.discount_amount ?? 0); places.set(r.merchant_name, p); }
      const top = [...places.entries()].sort((a, b) => (metric === 'saved' ? b[1].saved - a[1].saved : b[1].n - a[1].n)).slice(0, 8);
      return {
        title: metric === 'saved' ? t('Saved') : t('Redemptions'),
        big: metric === 'saved' ? egp(stats?.total_saved ?? saved) : String(stats?.total_redemptions ?? ok.length),
        lines: metric === 'saved'
          ? [<Row key="b" label={t('Your bills')} value={egp(bills)} />, <Row key="p" sign="−" label={t('You paid')} value={egp(paid)} />, <Row key="s" sign="=" strong label={t('You saved')} value={egp(saved)} />]
          : [<Row key="a" strong label={t('Perks used')} value={String(ok.length)} />, <Row key="p" label={t('Different places')} value={String(places.size)} />,
             <Row key="s" label={t('You saved')} value={egp(saved)} onPress={() => router.setParams({ metric: 'saved' })} />],
        extra: top.length > 0 && (
          <Card style={{ gap: 4 }}>
            <T v="label">{metric === 'saved' ? t('Where you saved the most') : t('Your fave spots')}</T>
            {top.map(([name, p]) => <Row key={name} label={name} value={metric === 'saved' ? egp(p.saved) : t('{n}×', { n: p.n })} />)}
          </Card>
        ),
        list: reds.length ? reds.map((r) => <RedRow key={r.id} r={r} />) : <Empty emoji="🧾" title={t('No redemptions yet')} subtitle={t('Scan a Perkly QR at the cashier to start saving.')} />,
      };
    }
    if (metric === 'xp') {
      if (!xp) return null;
      const by = new Map<string, number>();
      for (const e of xp) by.set(e.reason, (by.get(e.reason) ?? 0) + e.amount);
      const total = stats?.total_xp ?? xp.reduce((a, e) => a + e.amount, 0);
      const { cur, next, toNext } = levelProgress(total);
      return {
        title: t('XP'), big: `${total.toLocaleString()} XP`,
        lines: [
          ...[...by.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => <Row key={k} sign="+" label={`${ICON[k] ?? '⚡'} ${t(REASON[k] ?? k)}`} value={`${v} XP`} />),
          <Row key="t" sign="=" strong label={t('Lv {n} · {name}', { n: cur.level, name: cur.name })} value={`${total} XP`} />,
          ...(next ? [<Row key="n" label={t('{n} XP to {name}', { n: toNext, name: next.name })} value="" />] : []),
        ],
        extra: null,
        list: xp.length ? xp.map((e) => (
          <Pressable key={e.id} disabled={!e.context?.redemption_id}
            onPress={() => router.push({ pathname: '/explain', params: { metric: 'redemption', id: e.context.redemption_id } })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border }}>
            <Text style={{ fontSize: 22 }}>{ICON[e.reason] ?? '⚡'}</Text>
            <View style={{ flex: 1 }}><T style={{ fontWeight: '700' }}>{t(REASON[e.reason] ?? e.reason)}</T><T v="small">{new Date(e.created_at).toLocaleString(locale(), { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</T></View>
            <T style={{ fontWeight: '900' }} color={brand.purple}>+{e.amount}</T>
          </Pressable>
        )) : <Empty emoji="⚡" title={t('No XP yet')} subtitle={t('Redeem a perk to earn your first XP.')} />,
      };
    }
    if (metric === 'streak') {
      if (!reds) return null;
      const days = [...new Set(ok.map((r) => new Date(r.created_at).toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' })))].slice(0, 30);
      return {
        title: t('Streak'), big: t('{n} days', { n: stats?.current_streak ?? 0 }),
        lines: [
          <Row key="c" strong label={t('Current streak')} value={t('{n} days', { n: stats?.current_streak ?? 0 })} />,
          <Row key="l" label={t('Longest streak')} value={t('{n} days', { n: stats?.longest_streak ?? 0 })} />,
          <Row key="f" label={`❄️ ${t('Streak freezes')}`} value={String(stats?.freeze_tokens ?? 0)} onPress={() => router.push('/arcade')} />,
          <Row key="h" label={t('Redeem at least once a day to keep it going. A freeze saves one missed day.')} value="" />,
        ],
        extra: null,
        list: days.length ? days.map((d) => {
          const that = ok.filter((r) => new Date(r.created_at).toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }) === d);
          return (
            <Pressable key={d} onPress={() => open(that[0])} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border }}>
              <Text style={{ fontSize: 22 }}>🔥</Text>
              <View style={{ flex: 1 }}><T style={{ fontWeight: '700' }}>{shortDate(d, { weekday: 'short', day: 'numeric', month: 'short' })}</T><T v="small" numberOfLines={1}>{that.map((r) => r.merchant_name).join(' · ')}</T></View>
              <T v="small">{t('{n}×', { n: that.length })}</T>
            </Pressable>
          );
        }) : <Empty emoji="🔥" title={t('No streak yet')} subtitle={t('Use a perk today to start your streak 🔥')} />,
      };
    }
    if (metric === 'cashback') {
      if (!orders) return null;
      return {
        title: t('Cashback'), big: egp(stats?.cashback_balance ?? 0),
        lines: [
          <Row key="b" strong label={t('Available')} value={egp(stats?.cashback_balance ?? 0)} />,
          <Row key="p" label={t('Waiting for the shop to confirm')} value={egp(stats?.cashback_pending ?? 0)} />,
        ],
        extra: null,
        list: orders.length ? orders.map((o) => (
          <View key={o.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border }}>
            <Text style={{ fontSize: 22 }}>🌐</Text>
            <View style={{ flex: 1 }}><T style={{ fontWeight: '700' }}>{o.merchant?.name}</T><T v="small">{t('Order {ref}', { ref: o.order_ref })} · {egp(o.amount)} · {shortDate(o.created_at)}</T></View>
            <View style={{ alignItems: 'flex-end' }}><T style={{ fontWeight: '900' }} color={o.status === 'rejected' ? c.textMuted : brand.success}>+{egp(o.cashback_amount)}</T><T v="small">{t(o.status)}</T></View>
          </View>
        )) : <Empty emoji="💸" title={t('No cashback yet')} subtitle={t('Shop online through Perkly to earn cashback.')} />,
      };
    }
    if (metric === 'redemption') {
      const r = (reds ?? []).find((x) => x.id === id);
      if (!reds) return null;
      if (!r) return { title: t('Receipt'), big: '—', lines: [], extra: null, list: <Empty emoji="🫥" title={t('Not found')} /> };
      const events = (xp ?? []).filter((e) => e.context?.redemption_id === r.id);
      return {
        title: r.merchant_name, big: r.discount_amount != null ? `−${egp(r.discount_amount)}` : t('Applied by cashier'),
        lines: [
          <Row key="b" label={t('Bill')} value={egp(r.original_amount)} />,
          <Row key="d" sign="−" label={t('Perkly discount')} value={r.discount_amount != null ? egp(r.discount_amount) : t('Applied by cashier')} />,
          <Row key="p" sign="=" strong label={t('You paid')} value={egp(r.final_amount ?? r.original_amount)} />,
          <Row key="m" label={t('Payment')} value={r.payment_method === 'in_app' ? t('Paid in app') : t('At the cashier')} />,
          ...events.map((e) => <Row key={e.id} sign="+" label={`${ICON[e.reason] ?? '⚡'} ${t(REASON[e.reason] ?? e.reason)}`} value={`${e.amount} XP`} onPress={() => router.setParams({ metric: 'xp', id: undefined })} />),
          <Row key="x" sign="=" strong label={t('XP earned')} value={`+${r.xp_awarded} XP`} onPress={() => router.setParams({ metric: 'xp', id: undefined })} />,
        ],
        extra: (
          <Card style={{ gap: 4 }}>
            <T v="small">{r.perk_title}</T>
            <T v="small">{r.branch_name === 'Online' ? t('Online') : r.branch_name} · {new Date(r.created_at).toLocaleString(locale(), { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</T>
            {r.tx_code ? <T v="small">{t('Transaction ID')}: <Text style={{ fontWeight: '900' }}>{r.tx_code}</Text></T> : null}
            <T v="small">{t('Code')}: <Text style={{ fontWeight: '900', letterSpacing: 2 }}>{r.verification_code}</Text>{r.status === 'reversed' ? ` · ${t('reversed')}` : ''}</T>
            <View style={{ marginTop: 10 }}><ShareReceiptButton data={r} /></View>
          </Card>
        ),
        list: null,
      };
    }
    return null;
  }, [metric, id, reds, xp, orders, stats, c]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']} style={{ paddingHorizontal: 20, paddingBottom: 22, gap: 6 }}>
          <Pressable onPress={() => router.back()} hitSlop={12}><Text style={{ color: '#fff', fontSize: 28 }}>{backChevron()}</Text></Pressable>
          <Text style={{ color: '#ffffffcc', fontWeight: '800', letterSpacing: 1 }}>{view?.title ?? ''}</Text>
          <Text style={{ color: '#fff', fontSize: 34, fontWeight: '900' }} numberOfLines={1} adjustsFontSizeToFit>{view?.big ?? ''}</Text>
        </SafeAreaView>
      </LinearGradient>
      {!view ? <ActivityIndicator style={{ marginTop: 40 }} color={brand.purple} /> : (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 60 }}>
          {view.lines.length > 0 && <Card style={{ gap: 0, paddingHorizontal: 4 }}>{view.lines}</Card>}
          {view.extra}
          {view.list && <View><T v="label" style={{ marginBottom: 4 }}>{t('Details')}</T>{view.list}</View>}
        </ScrollView>
      )}
    </View>
  );
}
