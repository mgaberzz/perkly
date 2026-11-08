import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, Switch, View } from 'react-native';
import { Card, Screen, T } from '@/components/ui';
import { Avatar } from '@/components/avatar';
import { biometricAvailable, biometricEnabled, faceIdLimitedHere, setBiometricEnabled } from '@/lib/biometric';
import { fwdChevron, lang, setLanguage, t } from '@/lib/i18n';
import { legalUrl } from '@/lib/links';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { brand, useTheme } from '@/lib/theme';

export default function Settings() {
  const { c } = useTheme();
  const { session, profile, refreshProfile, signOut } = useSession();
  const [drops, setDrops] = useState(profile?.marketing_opt_in ?? false);
  const [bio, setBio] = useState<{ ok: boolean; label: string; on: boolean }>({ ok: false, label: '', on: false });

  useEffect(() => {
    Promise.all([biometricAvailable(), biometricEnabled()]).then(([a, on]) => setBio({ ...a, on })).catch(() => {});
  }, []);

  async function toggleDrops(v: boolean) {
    setDrops(v);
    if (session) await supabase.from('profiles').update({ marketing_opt_in: v }).eq('id', session.user.id);
    refreshProfile();
  }
  async function toggleBio(v: boolean) {
    const ok = await setBiometricEnabled(v);
    if (ok) setBio((b) => ({ ...b, on: v }));
  }
  function switchLanguage() {
    const next = lang() === 'ar' ? 'en' : 'ar';
    const go = () => setLanguage(next);
    if (Platform.OS === 'web') return go();
    Alert.alert(next === 'ar' ? 'العربية' : 'English', t('Perkly will restart to switch the language.'), [
      { text: t('Cancel'), style: 'cancel' }, { text: t('Switch'), onPress: go },
    ]);
  }
  function logout() {
    if (Platform.OS === 'web') { signOut({ keepQuickLogin: false }); return; }
    if (bio.on) {
      Alert.alert(t('Log out?'), t('Next time, log back in with {method} — no code needed.', { method: bio.label }), [
        { text: t('Cancel'), style: 'cancel' },
        { text: t('Log out'), onPress: () => signOut() },
        { text: t('Log out & forget this phone'), style: 'destructive', onPress: () => signOut({ keepQuickLogin: false }) },
      ]);
      return;
    }
    Alert.alert(t('Log out?'), t('You can log back in any time.'), [{ text: t('Cancel'), style: 'cancel' }, { text: t('Log out'), style: 'destructive', onPress: () => signOut({ keepQuickLogin: false }) }]);
  }

  const Row = ({ label, onPress, right }: { label: string; onPress?: () => void; right?: React.ReactNode }) => (
    <Pressable onPress={onPress} disabled={!onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: c.border }}>
      <T style={{ flex: 1 }}>{label}</T>{right ?? (onPress ? <T v="muted">{fwdChevron()}</T> : null)}
    </Pressable>
  );

  return (
    <Screen edges={[]}>
      {/* Profile: picture, name, and the way into Edit profile */}
      <Card onPress={() => router.push('/edit-profile')} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Avatar profile={profile} size={58} />
        <View style={{ flex: 1 }}>
          <T v="h3" numberOfLines={1}>{profile?.full_name ?? t('Student')}</T>
          <T v="small" color={brand.purple} style={{ fontWeight: '800' }}>{t('Edit profile')} {fwdChevron()}</T>
        </View>
      </Card>
      <T v="label">{t('Account')}</T>
      <Card style={{ gap: 0, paddingVertical: 0 }}>
        <Row label={`👤 ${t('Edit profile & campus')}`} onPress={() => router.push('/edit-profile')} />
        <Row label={`🧾 ${t('Savings history')}`} onPress={() => router.push('/history')} />
        {profile?.student_code ? <Row label={`🎓 ${t('Student ID')}`} right={<T v="small" style={{ writingDirection: 'ltr', fontWeight: '800' }}>{profile.student_code}</T>} /> : null}
        <Row label={`🆔 ${t('User ID')}`} right={<T v="small" style={{ writingDirection: 'ltr', fontWeight: '800' }}>{profile?.user_code}</T>} />
        <Row label={`📱 ${t('Signed in as')}`} right={<T v="small" numberOfLines={1} style={{ maxWidth: 180 }}>{profile?.phone ?? profile?.email ?? session?.user.email}</T>} />
      </Card>
      <T v="label">{t('Security & language')}</T>
      <Card style={{ gap: 0, paddingVertical: 0 }}>
        {bio.ok
          ? <Row label={`🔐 ${t('Log in with {method}', { method: bio.label })}`} right={<Switch value={bio.on} onValueChange={toggleBio} trackColor={{ true: brand.purple }} />} />
          : <Row label={`🔐 ${t('Biometric login')}`} right={<T v="small">{Platform.OS === 'web' ? t('Phone only') : t('Set up Face ID / fingerprint on your phone first')}</T>} />}
        {bio.ok && faceIdLimitedHere && <T v="small" style={{ paddingVertical: 10 }}>{t('Testing in Expo Go: iPhone asks for your passcode instead of Face ID. Face ID works in the real Perkly app.')}</T>}
        <Row label={`🌐 ${t('Language')}`} onPress={switchLanguage} right={<T v="small" color={brand.purple}>{lang() === 'ar' ? 'العربية ⇄ English' : 'English ⇄ العربية'}</T>} />
      </Card>
      <T v="label">{t('Notifications')}</T>
      <Card style={{ gap: 0, paddingVertical: 0 }}>
        <Row label={`🔥 ${t('Perk drops & flash deals')}`} right={<Switch value={drops} onValueChange={toggleDrops} trackColor={{ true: brand.purple }} />} />
        <Row label={`🔔 ${t('Phone permissions')}`} onPress={() => Linking.openSettings()} />
      </Card>
      <T v="label">{t('Help')}</T>
      <Card style={{ gap: 0, paddingVertical: 0 }}>
        <Row label={`💬 ${t('Support chat')}`} onPress={() => Linking.openURL('https://wa.me/')} />
        <Row label={`📄 ${t('Terms of Use')}`} onPress={() => Linking.openURL(legalUrl('terms'))} />
        <Row label={`🔒 ${t('Privacy Policy')}`} onPress={() => Linking.openURL(legalUrl('privacy'))} />
      </Card>
      <Pressable onPress={logout} style={{ padding: 16 }}><T color={brand.danger} style={{ textAlign: 'center', fontWeight: '900' }}>{t('Log out')}</T></Pressable>
      <View style={{ alignItems: 'center' }}><T v="small">Perkly · {t('Unlock Perks. Live Smart.')}</T></View>
    </Screen>
  );
}
