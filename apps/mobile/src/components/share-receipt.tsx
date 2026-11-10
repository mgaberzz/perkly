import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as Sharing from 'expo-sharing';
import { useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Modal, Pressable, Share, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { Text } from '@/components/text';
import { egp } from '@/lib/format';
import { locale, t } from '@/lib/i18n';
import { brand, gradient } from '@/lib/theme';

export type ReceiptData = {
  tx_code?: string | null; created_at: string; merchant_name: string; branch_name?: string | null; perk_title: string;
  original_amount: number | null; discount_amount: number | null; final_amount: number | null; payment_method: string;
  xp_awarded?: number | null; status?: string;
};

/** "Share receipt" button + preview sheet. Shares a branded image (falls back to text). */
export function ShareReceiptButton({ data, variant = 'solid', label }: { data: ReceiptData; variant?: 'solid' | 'light' | 'outline'; label?: string }) {
  const [open, setOpen] = useState(false);
  const bg = variant === 'solid' ? brand.purple : variant === 'light' ? '#ffffff' : 'transparent';
  const fg = variant === 'solid' ? '#fff' : brand.purple;
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button"
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: bg, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16,
          borderWidth: variant === 'outline' ? 1.5 : 0, borderColor: brand.purple, opacity: pressed ? 0.85 : 1 })}>
        <Text style={{ fontSize: 15 }}>📤</Text>
        <Text style={{ color: fg, fontWeight: '900' }}>{label ?? t('Share Receipt')}</Text>
      </Pressable>
      {open && <ShareSheet data={data} onClose={() => setOpen(false)} />}
    </>
  );
}

function ShareSheet({ data, onClose }: { data: ReceiptData; onClose: () => void }) {
  const shot = useRef<ComponentRef<typeof View>>(null);
  const [busy, setBusy] = useState(false);

  const text = () => [
    `🧾 ${t('Perkly Receipt')} ${data.tx_code ?? ''}`.trim(),
    `${data.merchant_name} · ${data.perk_title}`,
    `${t('Bill')}: ${egp(data.original_amount)}`,
    data.discount_amount != null ? `${t('Perkly Discount')}: −${egp(data.discount_amount)}` : '',
    `${t('You Paid')}: ${egp(data.final_amount ?? data.original_amount)}`,
    new Date(data.created_at).toLocaleString(locale(), { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }),
    '',
    t('Students Save More with Perkly 💜'),
  ].filter((x) => x !== '').join('\n');

  async function share() {
    setBusy(true);
    try {
      const uri = shot.current ? await captureRef(shot.current as unknown as number, { format: 'png', quality: 1, result: 'tmpfile' }) : null;
      if (uri && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: t('Share Receipt'), UTI: 'public.png' });
      } else {
        await Share.share({ message: text() });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      await Share.share({ message: text() }).catch(() => {});
    } finally { setBusy(false); }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: '#F7F5FB', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10, paddingBottom: 34, paddingHorizontal: 20, gap: 16, alignItems: 'center' }}>
          <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: '#D4CFE0' }} />
          <View ref={shot} collapsable={false} style={{ backgroundColor: '#F7F5FB', padding: 4 }}>
            <ReceiptCard data={data} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10, alignSelf: 'stretch' }}>
            <Pressable onPress={onClose} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ECE8F3' }}>
              <Text style={{ fontWeight: '800', color: brand.ink }}>{t('Close')}</Text>
            </Pressable>
            <Pressable onPress={share} disabled={busy} style={{ flex: 2, borderRadius: 14, overflow: 'hidden' }}>
              <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 }}>
                {busy ? <ActivityIndicator color="#fff" /> : <><Text style={{ fontSize: 15 }}>📤</Text><Text style={{ color: '#fff', fontWeight: '900' }}>{t('Share')}</Text></>}
              </LinearGradient>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** The image that gets shared: a plain, simple receipt */
export function ReceiptCard({ data }: { data: ReceiptData }) {
  const rows: [string, string, boolean?][] = [
    [t('Bill'), egp(data.original_amount)],
    [t('Perkly Discount'), data.discount_amount != null ? `−${egp(data.discount_amount)}` : t('Applied by Cashier'), true],
    [t('Payment'), data.payment_method === 'in_app' ? t('Paid in App') : t('At the Cashier')],
  ];
  const line = <View style={{ height: 1, backgroundColor: '#ECE8F3' }} />;
  return (
    <View style={{ width: 300, borderRadius: 18, backgroundColor: '#fff', padding: 20, gap: 12, borderWidth: 1, borderColor: '#ECE8F3' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <LinearGradient colors={gradient} style={{ width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13 }}>P</Text>
          </LinearGradient>
          <Text style={{ color: brand.ink, fontWeight: '900', fontSize: 16 }}>Perkly</Text>
        </View>
        <Text style={{ color: '#6B6680', fontWeight: '700', fontSize: 12 }}>{t('Receipt')}</Text>
      </View>
      {line}
      <View style={{ gap: 2 }}>
        <Text style={{ fontWeight: '900', fontSize: 17, color: brand.ink }} numberOfLines={1}>{data.merchant_name}</Text>
        <Text style={{ color: '#6B6680', fontSize: 13 }} numberOfLines={2}>
          {data.perk_title}{data.branch_name ? ` · ${data.branch_name === 'Online' ? t('Online') : data.branch_name}` : ''}
        </Text>
        <Text style={{ color: '#6B6680', fontSize: 12 }}>
          {new Date(data.created_at).toLocaleString(locale(), { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
        </Text>
      </View>
      {line}
      {rows.map(([k, v, green]) => (
        <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: '#6B6680' }}>{k}</Text>
          <Text style={{ fontWeight: '800', color: green ? brand.success : brand.ink }}>{v}</Text>
        </View>
      ))}
      {line}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontWeight: '900', fontSize: 16, color: brand.ink }}>{t('Total Paid')}</Text>
        <Text style={{ fontWeight: '900', fontSize: 16, color: brand.ink }}>{egp(data.final_amount ?? data.original_amount)}</Text>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: '#6B6680', fontSize: 12 }}>{t('Transaction ID')}</Text>
        <Text style={{ fontWeight: '800', fontSize: 12, color: brand.ink, writingDirection: 'ltr' }}>{data.tx_code ?? '—'}</Text>
      </View>
      {data.status === 'reversed' && <Text style={{ color: '#EF4444', fontWeight: '800', textAlign: 'center' }}>{t('This Transaction Was Reversed')}</Text>}
      <Text style={{ color: '#9A94AB', fontSize: 11, textAlign: 'center' }}>{t('Proof of purchase · not a discount voucher')}</Text>
    </View>
  );
}
