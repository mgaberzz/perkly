import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { router } from 'expo-router';
import { Share, View } from 'react-native';
import { Text } from './text';
import { Button, Card, T } from './ui';
import { friendlyError } from '@/lib/errors';
import { t } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { brand } from '@/lib/theme';
import type { Merchant, Perk } from '@/lib/types';

type CodeRes = { ok: true; code: string; expires_at: string; website_url: string | null } | { ok: false; error: string };

/**
 * Online merchants: (1) a one-time Perkly code to type at checkout, (2) a tracked link — orders through it earn cashback.
 */
export function OnlineActions({ merchant, perk }: { merchant: Merchant; perk?: Perk }) {
  const [code, setCode] = useState<{ code: string; expires_at: string } | null>(null);
  const [busy, setBusy] = useState<'code' | 'link' | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (merchant.channel === 'in_store') return null;
  const hasLink = Boolean(merchant.affiliate_url ?? merchant.website_url);

  async function getCode() {
    if (!perk) return;
    setBusy('code'); setError(null);
    const { data, error: err } = await supabase.rpc('get_online_code', { p_perk_id: perk.id });
    setBusy(null);
    const r = data as CodeRes | null;
    if (err || !r) return setError(friendlyError('network'));
    if (!r.ok) {
      if (r.error === 'verification_required') router.push('/student-verification');
      return setError(friendlyError(r.error));
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setCode({ code: r.code, expires_at: r.expires_at });
  }

  async function openShop() {
    setBusy('link'); setError(null);
    const { data, error: err } = await supabase.rpc('track_link', { p_merchant_id: merchant.id, p_perk_id: perk?.id ?? null });
    setBusy(null);
    const r = data as { ok: boolean; url?: string; error?: string } | null;
    if (err || !r) return setError(friendlyError('network'));
    if (!r.ok || !r.url) return setError(friendlyError(r.error));
    await WebBrowser.openBrowserAsync(r.url);
  }

  const minutes = code ? Math.max(0, Math.round((new Date(code.expires_at).getTime() - Date.now()) / 60000)) : 0;

  return (
    <Card style={{ gap: 10 }}>
      <T v="h3">🌐 {t('Shop Online with Perkly')}</T>
      {perk && (
        code ? (
          <View style={{ alignItems: 'center', gap: 6, padding: 12, borderRadius: 16, backgroundColor: '#7B2FF70D', borderWidth: 1, borderColor: '#7B2FF733', borderStyle: 'dashed' }}>
            <T v="small">{t('Your One-Time Code')}</T>
            <Text selectable style={{ fontSize: 28, fontWeight: '900', letterSpacing: 3, color: brand.purple, writingDirection: 'ltr' }}>{code.code}</Text>
            <T v="small">{t('Type it at checkout · valid for {n} min · single use', { n: minutes })}</T>
            <Button variant="secondary" title={t('Share / Copy Code')} onPress={() => Share.share({ message: code.code })} style={{ alignSelf: 'stretch' }} />
          </View>
        ) : (
          <Button variant="secondary" icon="🔑" title={t('Get a One-Time Code')} onPress={getCode} loading={busy === 'code'} />
        )
      )}
      {hasLink && <Button icon="🛍️" title={t('Shop & Earn Cashback')} onPress={openShop} loading={busy === 'link'} />}
      {hasLink && <T v="small">{t('Orders made through this link earn you cashback once the shop confirms them.')}</T>}
      {error && <T color={brand.danger}>{error}</T>}
    </Card>
  );
}
