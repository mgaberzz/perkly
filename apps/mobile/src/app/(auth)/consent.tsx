import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Checkbox } from '@/components/form';
import { Button, Card, Screen, T } from '@/components/ui';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { brand } from '@/lib/theme';

export default function Consent() {
  const { session, refreshProfile } = useSession();
  const [drops, setDrops] = useState(false);
  const [saving, setSaving] = useState<null | 'all' | 'basic'>(null);

  async function accept(marketing: boolean) {
    if (!session) return;
    setSaving(marketing ? 'all' : 'basic');
    await supabase.from('profiles').update({ terms_accepted_at: new Date().toISOString(), marketing_opt_in: marketing }).eq('id', session.user.id);
    await refreshProfile();
    setSaving(null);
    router.replace('/location');
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ gap: 8, marginTop: 12 }}>
        <T v="label">Step 2 of 2</T>
        <T v="h1">Almost there! 🎉</T>
      </View>
      <Card style={{ gap: 12 }}>
        <T v="h3">How we use your data</T>
        <T v="muted">
          Perkly keeps the minimum it needs to run your account: your phone or email, name, campus and the perks you redeem.
          Your location is used only to show nearby perks and to confirm you’re in-store when you redeem. We never sell your data.
        </T>
        <T v="h3">Perk drops</T>
        <T v="muted">Want a heads-up when new perks, flash deals and Boost Weeks drop on your campus? Tick the box below. You can switch it off any time in Settings.</T>
      </Card>
      <T v="muted">
        To use Perkly you need to agree to our{' '}
        <Text style={{ color: brand.purple, fontWeight: '800' }} onPress={() => Linking.openURL('https://perkly.app/terms')}>Terms of Use</Text> and{' '}
        <Text style={{ color: brand.purple, fontWeight: '800' }} onPress={() => Linking.openURL('https://perkly.app/privacy')}>Privacy Policy</Text>.
      </T>
      <Checkbox checked={drops} onChange={setDrops} label="Send me new perk drops 🔥" sub="Push notifications & emails — unsubscribe anytime" />
      <View style={{ gap: 6, marginTop: 8 }}>
        <Button title="Accept all & continue" onPress={() => accept(true)} loading={saving === 'all'} />
        {!drops && (
          <Pressable onPress={() => accept(false)} style={{ padding: 14 }} disabled={!!saving}>
            <T style={{ textAlign: 'center', fontWeight: '800' }} color={brand.purple}>{saving === 'basic' ? 'Saving…' : 'Continue without perk drops'}</T>
          </Pressable>
        )}
      </View>
    </Screen>
  );
}
