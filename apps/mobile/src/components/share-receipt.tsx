import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as Sharing from 'expo-sharing';
import { useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Modal, Pressable, Share, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { Avatar } from '@/components/avatar';
import { Text } from '@/components/text';
import { egp, firstName } from '@/lib/format';
import { locale, t } from '@/lib/i18n';
import { useSession } from '@/lib/session';
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
        <Text style={{ color: fg, fontWeight: '900' }}>{label ?? t('Share receipt')}</Text>
      </Pressable>
      {open && <ShareSheet data={data} onClose={() => setOpen(false)} />}
    </>
  );
}

function ShareSheet({ data, onClose }: { data: ReceiptData; onClose: () => void }) {
  const shot = useRef<ComponentRef<typeof View>>(null);
  const [busy, setBusy] = useState(false);

  const text = () => [
    `🧾 ${t('Perkly receipt')} ${data.tx_code ?? ''}`.trim(),
    `${data.merchant_name} · ${data.perk_title}`,
    `${t('Bill')}: ${egp(data.original_amount)}`,
    data.discount_amount != null ? `${t('Perkly discount')}: −${egp(data.discount_amount)}` : '',
    `${t('You paid')}: ${egp(data.final_amount ?? data.original_amount)}`,
    new Date(data.created_at).toLocaleString(locale(), { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }),
    '',
    t('Students save more with Perkly 💜'),
  ].filter((x) => x !== '').join('\n');

  async function share() {
    setBusy(true);
    try {
      const uri = shot.current ? await captureRef(shot.current as unknown as number, { format: 'png', quality: 1, result: 'tmpfile' }) : null;
      if (uri && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: t('Share receipt'), UTI: 'public.png' });
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

/** The image that gets shared */
export function ReceiptCard({ data }: { data: ReceiptData }) {
  const { profile } = useSession();
  const saved = Number(data.discount_amount ?? 0);
  const rows: [string, string, boolean?][] = [
    [t('Bill'), egp(data.original_amount)],
    [t('Perkly discount'), data.discount_amount != null ? `−${egp(data.discount_amount)}` : t('Applied by cashier'), true],
    [t('You paid'), egp(data.final_amount ?? data.original_amount)],
    [t('Payment'), data.payment_method === 'in_app' ? t('Paid in app') : t('At the cashier')],
  ];
  return (
    <View style={{ width: 320, borderRadius: 26, backgroundColor: '#fff', overflow: 'hidden', shadowColor: brand.purple, shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } }}>
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 18, paddingBottom: 46 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: brand.purple, fontWeight: '900', fontSize: 16 }}>P</Text></View>
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>Perkly</Text>
          </View>
          <Text style={{ color: '#ffffffd9', fontWeight: '800', fontSize: 12, letterSpacing: 1 }}>{t('RECEIPT')}</Text>
        </View>
        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 26, marginTop: 14 }}>{saved > 0 ? t('Saved {amount} 🎉', { amount: egp(saved) }) : t('Perk redeemed 🎉')}</Text>
        <Text style={{ color: '#ffffffd9', fontWeight: '700', marginTop: 2 }}>{t('{name} at {place}', { name: firstName(profile?.full_name), place: data.merchant_name })}</Text>
      </LinearGradient>
      <View style={{ position: 'absolute', top: 104, end: 18, borderRadius: 40, borderWidth: 4, borderColor: '#fff' }}>
        <Avatar profile={profile} size={64} />
      </View>
      <View style={{ padding: 18, paddingTop: 26, gap: 10 }}>
        <View>
          <Text style={{ fontWeight: '900', fontSize: 17, color: brand.ink }} numberOfLines={1}>{data.merchant_name}</Text>
          <Text style={{ color: '#6B6680', fontWeight: '600', fontSize: 13 }} numberOfLines={2}>
            {data.perk_title}{data.branch_name ? ` · ${data.branch_name === 'Online' ? t('Online') : data.branch_name}` : ''}
          </Text>
          <Text style={{ color: '#6B6680', fontSize: 12, marginTop: 2 }}>
            {new Date(data.created_at).toLocaleString(locale(), { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </Text>
        </View>
        <View style={{ borderTopWidth: 1, borderStyle: 'dashed', borderColor: '#DDD6EA' }} />
        {rows.map(([k, v, green]) => (
          <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: '#6B6680', fontWeight: '600' }}>{k}</Text>
            <Text style={{ fontWeight: '900', color: green ? brand.success : brand.ink }}>{v}</Text>
          </View>
        ))}
        <View style={{ borderTopWidth: 1, borderStyle: 'dashed', borderColor: '#DDD6EA' }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: '#6B6680', fontWeight: '600', fontSize: 12 }}>{t('Transaction ID')}</Text>
          <Text style={{ fontWeight: '900', color: brand.purple, letterSpacing: 0.5, writingDirection: 'ltr' }}>{data.tx_code ?? '—'}</Text>
        </View>
        {data.status === 'reversed' && <Text style={{ color: '#EF4444', fontWeight: '800', textAlign: 'center' }}>{t('This transaction was reversed')}</Text>}
        <View style={{ backgroundColor: '#7B2FF712', borderRadius: 12, padding: 10, alignItems: 'center', gap: 2 }}>
          <Text style={{ color: brand.purple, fontWeight: '900' }}>{t('Students save more with Perkly 💜')}</Text>
          <Text style={{ color: '#6B6680', fontSize: 10 }}>{t('Proof of purchase · not a discount voucher')}</Text>
        </View>
      </View>
    </View>
  );
}
