import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Platform, Pressable, Switch, View } from 'react-native';
import { Card, Screen, T } from '@/components/ui';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { brand, useTheme } from '@/lib/theme';

export default function Settings() {
  const { c } = useTheme();
  const { session, profile, refreshProfile, signOut } = useSession();
  const [drops, setDrops] = useState(profile?.marketing_opt_in ?? false);

  async function toggleDrops(v: boolean) {
    setDrops(v);
    if (session) await supabase.from('profiles').update({ marketing_opt_in: v }).eq('id', session.user.id);
    refreshProfile();
  }
  function logout() {
    if (Platform.OS === 'web') { signOut(); return; }
    Alert.alert('Log out?', 'You can log back in any time.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Log out', style: 'destructive', onPress: signOut }]);
  }

  const Row = ({ label, onPress, right }: { label: string; onPress?: () => void; right?: React.ReactNode }) => (
    <Pressable onPress={onPress} disabled={!onPress} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: c.border }}>
      <T style={{ flex: 1 }}>{label}</T>{right ?? (onPress ? <T v="muted">›</T> : null)}
    </Pressable>
  );

  return (
    <Screen edges={[]}>
      <T v="label">Account</T>
      <Card style={{ gap: 0, paddingVertical: 0 }}>
        <Row label="👤 Edit profile & campus" onPress={() => router.push('/edit-profile')} />
        <Row label="🧾 Savings history" onPress={() => router.push('/history')} />
        <Row label="📱 Signed in as" right={<T v="small">{profile?.phone ?? profile?.email ?? session?.user.email}</T>} />
      </Card>
      <T v="label">Notifications</T>
      <Card style={{ gap: 0, paddingVertical: 0 }}>
        <Row label="🔥 Perk drops & flash deals" right={<Switch value={drops} onValueChange={toggleDrops} trackColor={{ true: brand.purple }} />} />
        <Row label="🔔 Phone permissions" onPress={() => Linking.openSettings()} />
      </Card>
      <T v="label">Help</T>
      <Card style={{ gap: 0, paddingVertical: 0 }}>
        <Row label="💬 Support chat" onPress={() => Linking.openURL('https://wa.me/')} />
        <Row label="📄 Terms of Use" onPress={() => Linking.openURL('https://perkly.app/terms')} />
        <Row label="🔒 Privacy Policy" onPress={() => Linking.openURL('https://perkly.app/privacy')} />
      </Card>
      <Pressable onPress={logout} style={{ padding: 16 }}><T color={brand.danger} style={{ textAlign: 'center', fontWeight: '900' }}>Log out</T></Pressable>
      <View style={{ alignItems: 'center' }}><T v="small">Perkly · Unlock Perks. Live Smart.</T></View>
    </Screen>
  );
}
