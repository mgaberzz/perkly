import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, View } from 'react-native';
import { TextField } from '@/components/form';
import { Button, Card, Chip, Empty, Screen, T } from '@/components/ui';
import { egp, shortDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { brand } from '@/lib/theme';

type Tx = { id: string; merchant_name: string; perk_title: string; created_at: string; final_amount: number | null; original_amount: number | null;
  status: string; payment_method: string; tx_code: string | null };
type Refund = { refund_code: string; amount: number; paid_in_app: boolean; reason: string; note: string | null; status: 'pending' | 'approved' | 'rejected';
  decision_note: string | null; decided_at: string | null; payout_status: 'na' | 'by_merchant' | 'due' | 'paid'; paid_at: string | null; created_at: string };

const REASONS: [string, string][] = [
  ['wrong_amount', 'Wrong Amount Entered'], ['order_cancelled', 'Order Cancelled'], ['returned', 'Item Returned'],
  ['charged_twice', 'Charged Twice'], ['no_discount', 'Discount Wasn’t Applied'], ['other', 'Other'],
];
const ERRORS: Record<string, string> = {
  too_late: 'Refunds can only be requested within {days} days of the purchase.',
  already_requested: 'You already asked for a refund on this transaction.',
  already_reversed: 'This transaction was already cancelled.',
  note_required: 'Tell the shop what happened.',
  refunds_off: 'Refund requests are closed right now. Contact Perkly support.',
  no_amount: 'This transaction has no amount to refund.',
};

/** Ask for a refund on one transaction, then follow it: Sent → Shop decides → Money back. */
export default function RefundScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { refreshProfile, feature } = useSession();
  const [tx, setTx] = useState<Tx | null>(null);
  const [refund, setRefund] = useState<Refund | null>(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    Promise.all([
      supabase.from('my_redemptions').select('id, merchant_name, perk_title, created_at, final_amount, original_amount, status, payment_method, tx_code').eq('id', id).maybeSingle<Tx>(),
      supabase.from('refund_requests').select('refund_code, amount, paid_in_app, reason, note, status, decision_note, decided_at, payout_status, paid_at, created_at').eq('redemption_id', id).maybeSingle<Refund>(),
    ]).then(([a, b]) => { setTx(a.data ?? null); setRefund(b.data ?? null); setLoading(false); });
  }, [id]);
  useFocusEffect(load);

  async function send() {
    setError(null);
    if (!reason) return setError(t('Pick a reason.'));
    if (reason === 'other' && !note.trim()) return setError(t(ERRORS.note_required));
    setSending(true);
    const { data, error: err } = await supabase.rpc('request_refund', { p_redemption_id: id, p_reason: reason, p_note: note.trim() || null });
    setSending(false);
    const res = data as { ok: boolean; error?: string; days?: number } | null;
    if (err || !res) return setError(t('Wi-Fi acting up? Try again in a sec 💜'));
    if (!res.ok) return setError(t(ERRORS[res.error ?? ''] ?? 'Something went wrong. Try again.', { days: res.days }));
    load();
  }

  if (loading) return <Screen edges={[]}><ActivityIndicator style={{ marginTop: 40 }} color={brand.purple} /></Screen>;
  if (!tx) return <Screen edges={[]}><Empty emoji="🫥" title={t('Not Found')} /></Screen>;

  const summary = (
    <Card style={{ gap: 4 }}>
      <T v="h3">{tx.merchant_name}</T>
      <T v="small">{tx.perk_title} · {shortDate(tx.created_at)}</T>
      {tx.tx_code ? <T v="small">{t('Transaction ID')}: {tx.tx_code}</T> : null}
      <T v="h2" style={{ marginTop: 6 }}>{egp(refund?.amount ?? tx.final_amount ?? tx.original_amount)}</T>
      <T v="small">{tx.payment_method === 'in_app' ? t('Paid in App') : t('At the Cashier')}</T>
    </Card>
  );

  if (refund) {
    const approved = refund.status === 'approved', rejected = refund.status === 'rejected';
    const steps: { done: boolean; bad?: boolean; title: string; sub?: string }[] = [
      { done: true, title: t('Request Sent'), sub: shortDate(refund.created_at) },
      { done: approved || rejected, bad: rejected, title: rejected ? t('Not Approved') : approved ? t('Approved by the Shop') : t('Waiting for the Shop'),
        sub: rejected || approved ? refund.decision_note ?? (refund.decided_at ? shortDate(refund.decided_at) : undefined) : t('Shops usually answer within 3 days.') },
      ...(rejected ? [] : [{
        done: refund.payout_status === 'paid' || refund.payout_status === 'by_merchant',
        title: refund.paid_in_app ? (refund.payout_status === 'paid' ? t('Money Sent Back 💸') : t('Money Back from Perkly')) : t('Collect Your Money at the Cashier'),
        sub: !approved ? undefined : refund.paid_in_app
          ? (refund.payout_status === 'paid' ? shortDate(refund.paid_at ?? '') : t('Usually within a few days.'))
          : t('Show this screen to the cashier.'),
      }]),
    ];
    return (
      <Screen edges={[]}>
        {summary}
        <Card style={{ gap: 14 }}>
          <T v="label">{t('Refund ID')} · {refund.refund_code}</T>
          {steps.map((s, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', opacity: s.done ? 1 : 0.55 }}>
              <T style={{ fontSize: 20 }}>{s.bad ? '❌' : s.done ? '✅' : '⏳'}</T>
              <View style={{ flex: 1 }}>
                <T style={{ fontWeight: '800' }}>{s.title}</T>
                {s.sub ? <T v="small">{s.sub}</T> : null}
              </View>
            </View>
          ))}
        </Card>
        {rejected && <T v="small" style={{ textAlign: 'center' }}>{t('Think this is wrong? Contact Perkly support from Settings.')}</T>}
        <Button title={t('Done')} variant="secondary" onPress={() => { refreshProfile(); router.back(); }} />
      </Screen>
    );
  }

  if (tx.status === 'reversed') return <Screen edges={[]}>{summary}<Empty emoji="↩️" title={t('This Transaction Was Reversed')} /></Screen>;
  if (!feature('refunds')) return <Screen edges={[]}>{summary}<Empty emoji="💬" title={t('Need Help')} subtitle={t(ERRORS.refunds_off)} /></Screen>;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={[]}>
        {summary}
        <T v="label">{t('What Happened?')}</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {REASONS.map(([k, label]) => <Chip key={k} label={t(label)} active={reason === k} onPress={() => setReason(k)} />)}
        </View>
        <TextField label={t('Details')} value={note} onChangeText={setNote} multiline maxLength={500} placeholder={t('Tell the shop what happened')}
          hint={reason === 'other' ? undefined : t('Optional — helps the shop decide faster.')} />
        <T v="small">{tx.payment_method === 'in_app'
          ? t('The shop checks your request. If they approve, Perkly sends your money back.')
          : t('The shop checks your request. If they approve, you collect your money at the cashier.')} {t('The XP from this purchase is removed.')}</T>
        {error ? <T v="small" color={brand.danger}>{error}</T> : null}
        <Button title={t('Send Refund Request')} onPress={send} loading={sending} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
