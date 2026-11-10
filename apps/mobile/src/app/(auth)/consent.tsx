import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Text } from '@/components/text';
import { Checkbox } from '@/components/form';
import { Button, Card, Screen, T } from '@/components/ui';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { brand } from '@/lib/theme';
import { t } from '@/lib/i18n';
import { legalUrl } from '@/lib/links';
import { registerPush } from '@/lib/push';

export default function Consent() {
  const { session, refreshProfile } = useSession();
  const [drops, setDrops] = useState(false);
  const [saving, setSaving] = useState<null | 'all' | 'basic'>(null);

  async function accept(marketing: boolean) {
    if (!session) return;
    setSaving(marketing ? 'all' : 'basic');
    await supabase.from('profiles').update({ terms_accepted_at: new Date().toISOString(), marketing_opt_in: marketing }).eq('id', session.user.id);
    await refreshProfile();
    if (marketing) await registerPush(true);
    setSaving(null);
    router.replace('/location');
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ gap: 8, marginTop: 12 }}>
        <T v="label">{t('Step 2 of 2')}</T>
        <T v="h1">{t('Almost there! 🎉')}</T>
      </View>
      <Card style={{ gap: 12 }}>
        <T v="h3">{t('How we use your data')}</T>
        <T v="muted">
          {t('Perkly keeps the minimum it needs to run your account: your phone or email, name, campus and the perks you redeem. Your location is used only to show nearby perks and to confirm you’re in-store when you redeem. We never sell your data.')}
        </T>
        <T v="h3">{t('Perk drops')}</T>
        <T v="muted">{t('Wanna know first when new perks and flash deals drop on your campus? Tick the box below. You can turn it off anytime in Settings.')}</T>
      </Card>
      <T v="muted">
        {t('To use Perkly you need to agree to our')}{' '}
        <Text style={{ color: brand.purple, fontWeight: '800' }} onPress={() => Linking.openURL(legalUrl('terms'))}>{t('Terms of Use')}</Text> {t('and')}{' '}
        <Text style={{ color: brand.purple, fontWeight: '800' }} onPress={() => Linking.openURL(legalUrl('privacy'))}>{t('Privacy Policy')}</Text>.
      </T>
      <Checkbox checked={drops} onChange={setDrops} label={t('Send me new perk drops 🔥')} sub={t('Push notifications & emails — unsubscribe anytime')} />
      <View style={{ gap: 6, marginTop: 8 }}>
        <Button title={t('Accept all & continue')} onPress={() => accept(true)} loading={saving === 'all'} />
        {!drops && (
          <Pressable onPress={() => accept(false)} style={{ padding: 14 }} disabled={!!saving}>
            <T style={{ textAlign: 'center', fontWeight: '800' }} color={brand.purple}>{saving === 'basic' ? t('Saving…') : t('Continue without perk drops')}</T>
          </Pressable>
        )}
      </View>
    </Screen>
  );
}
