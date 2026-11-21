import Constants from 'expo-constants';
import { router } from 'expo-router';
import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, Switch, View } from 'react-native';
import { Card, Screen, T } from '@/components/ui';
import { Avatar } from '@/components/avatar';
import { LineIcon } from '@/components/line-icon';
import { deleteMyAccount } from '@/lib/account';
import { biometricAvailable, biometricEnabled, faceIdLimitedHere, setBiometricEnabled } from '@/lib/biometric';
import { fwdChevron, lang, setLanguage, t } from '@/lib/i18n';
import { legalUrl } from '@/lib/links';
import { lastPushError, registerPush, type PushResult } from '@/lib/push';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { brand, useTheme } from '@/lib/theme';

const VERIFY_LABEL: Record<string, string> = { unverified: 'Not verified', pending: 'Checking…', verified: 'Verified ✓', rejected: 'Try again' };

export default function Settings() {
  const { c } = useTheme();
  const { session, profile, refreshProfile, signOut, feature } = useSession();
  const [drops, setDrops] = useState(profile?.marketing_opt_in ?? false);
  const [reminders, setReminders] = useState(profile?.reminders_opt_in ?? true);
  const [deleting, setDeleting] = useState(false);
  const [push, setPush] = useState<PushResult | 'checking'>('checking');
  useEffect(() => { registerPush(false).then(setPush); }, []);
  const [bio, setBio] = useState<{ ok: boolean; label: string; on: boolean }>({ ok: false, label: '', on: false });

  useEffect(() => {
    Promise.all([biometricAvailable(), biometricEnabled()]).then(([a, on]) => setBio({ ...a, on })).catch(() => {});
  }, []);

  async function toggleDrops(v: boolean) {
    setDrops(v);
    if (session) await supabase.from('profiles').update({ marketing_opt_in: v }).eq('id', session.user.id);
    const r = v ? await registerPush(true) : null;
    if (r) setPush(r);
    if (r === 'blocked' && Platform.OS !== 'web') {
      Alert.alert(t('Notifications Are Off'), t('Turn on notifications for Perkly in your phone settings to get perk drops.'), [
        { text: t('Not Now'), style: 'cancel' }, { text: t('Open Settings'), onPress: () => Linking.openSettings() },
      ]);
    }
    refreshProfile();
  }
  async function toggleReminders(v: boolean) {
    setReminders(v);
    if (session) await supabase.from('profiles').update({ reminders_opt_in: v }).eq('id', session.user.id);
    if (v) registerPush(true).then(setPush);
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
        { text: t('Log Out'), onPress: () => signOut() },
        { text: t('Log Out & Forget This Phone'), style: 'destructive', onPress: () => signOut({ keepQuickLogin: false }) },
      ]);
      return;
    }
    Alert.alert(t('Log out?'), t('You can log back in any time.'), [{ text: t('Cancel'), style: 'cancel' }, { text: t('Log Out'), style: 'destructive', onPress: () => signOut({ keepQuickLogin: false }) }]);
  }

  async function doDelete() {
    if (!session) return;
    setDeleting(true);
    const r = await deleteMyAccount(session.user.id);
    setDeleting(false);
    if (!r.ok) {
      const msg = t('Your account could not be deleted. Please try again or contact support.');
      if (Platform.OS === 'web') window.alert(msg); else Alert.alert(t('Something Went Wrong'), msg);
      return;
    }
    await signOut({ keepQuickLogin: false });
  }
  function confirmDelete() {
    const title = t('Delete your account?');
    const body = t('This permanently erases your name, phone, email, birth date, photo, avatar and favourites, and signs you out on every device. Past transactions stay anonymously in merchants\' records, as the law requires. This can\'t be undone.');
    if (Platform.OS === 'web') { if (window.confirm(`${title}\n\n${body}`)) doDelete(); return; }
    Alert.alert(title, body, [
      { text: t('Cancel'), style: 'cancel' },
      { text: t('Delete Account'), style: 'destructive', onPress: doDelete },
    ]);
  }

  async function fixPush() {
    if (push === 'blocked') return Linking.openSettings();
    if (push === 'unsupported') {
      return Alert.alert(t('Notifications'), t('Notifications only work in the installed Perkly app on a real phone, not in Expo Go or a browser.'));
    }
    setPush('checking');
    const r = await registerPush(true);
    setPush(r);
    if (r === 'error') Alert.alert(t('Notifications'), `${t('Could not turn on notifications. Check your connection and try again.')}\n\n${lastPushError ?? ''}`);
  }
  const PUSH_LABEL: Record<PushResult | 'checking', { text: string; color: string }> = {
    checking: { text: t('Checking…'), color: c.textMuted },
    ok: { text: t('On ✓'), color: brand.success },
    denied: { text: t('Off · Tap to Allow'), color: brand.purple },
    blocked: { text: t('Off · Open Settings'), color: brand.danger },
    unsupported: { text: t('Installed App Only'), color: c.textMuted },
    no_project: { text: t('Not Set Up in This Build'), color: brand.danger },
    error: { text: t('Error · Tap to Retry'), color: brand.danger },
  };

  const Row = ({ icon, label, onPress, right, danger, sub, last }: { icon: string; label: string; onPress?: () => void; right?: React.ReactNode; danger?: boolean; sub?: string; last?: boolean }) => (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13,
      borderBottomWidth: last ? 0 : 1, borderBottomColor: c.border, opacity: pressed ? 0.6 : 1 })}>
      <View style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: danger ? '#F044381A' : '#7B2FF71A' }}>
        <LineIcon name={icon} size={18} color={danger ? brand.danger : brand.purple} />
      </View>
      <View style={{ flex: 1 }}>
        <T color={danger ? brand.danger : undefined} style={danger ? { fontWeight: '800' } : undefined}>{label}</T>
        {sub ? <T v="small" style={{ marginTop: 2 }}>{sub}</T> : null}
      </View>
      {right ?? (onPress && !danger ? <T v="muted">{fwdChevron()}</T> : null)}
    </Pressable>
  );
  const box = { gap: 0, paddingVertical: 0 } as const;

  return (
    <Screen edges={[]}>
      {/* Profile: picture, name, and the way into Edit profile */}
      <Card onPress={() => router.push('/edit-profile')} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Avatar profile={profile} size={58} />
        <View style={{ flex: 1 }}>
          <T v="h3" numberOfLines={1}>{profile?.full_name ?? t('Student')}</T>
          <T v="small" color={brand.purple} style={{ fontWeight: '800' }}>{t('Edit Profile')} {fwdChevron()}</T>
        </View>
      </Card>
      <T v="label">{t('Account')}</T>
      <Card style={box}>
        <Row icon="user" label={t('Edit Profile & Campus')} onPress={() => router.push('/edit-profile')} />
        <Row icon="receipt" label={t('Savings History')} onPress={() => router.push('/history')} />
        {profile?.student_code ? <Row icon="id" label={t('Student ID')} right={<T v="small" style={{ writingDirection: 'ltr', fontWeight: '800' }}>{profile.student_code}</T>} /> : null}
        {feature('verification') && <Row icon="school" label={t('Student Verification')} onPress={() => router.push('/student-verification')}
          right={<T v="small" color={profile?.verification_status === 'verified' ? brand.success : profile?.verification_status === 'rejected' ? brand.danger : brand.purple}>{t(VERIFY_LABEL[profile?.verification_status ?? 'unverified'])} {fwdChevron()}</T>} />}
        <Row icon="tag" label={t('User ID')} right={<T v="small" style={{ writingDirection: 'ltr', fontWeight: '800' }}>{profile?.user_code}</T>} />
        <Row icon="phone" label={t('Mobile Number')} onPress={() => router.push('/edit-profile')}
          right={<T v="small" style={{ writingDirection: 'ltr' }}>{profile?.phone ? profile.phone.replace(/^\+20/, '0') : t('Add')}</T>} />
        <Row icon="mail" label={t('Signed in As')} last right={<T v="small" numberOfLines={1} style={{ maxWidth: 180 }}>{session?.user.email || (session?.user.phone ? `+${session.user.phone.replace(/^\+/, '')}` : profile?.email)}</T>} />
      </Card>
      <T v="label">{t('Security & Language')}</T>
      <Card style={box}>
        {bio.ok
          ? <Row icon="fingerprint" label={t('Log In with {method}', { method: bio.label })} last={!feature('language')} right={<Switch value={bio.on} onValueChange={toggleBio} trackColor={{ true: brand.purple }} />} />
          : <Row icon="fingerprint" label={t('Biometric Login')} last={!feature('language')} right={<T v="small" style={{ maxWidth: 150, textAlign: 'right' }}>{Platform.OS === 'web' ? t('Phone Only') : t('Set up Face ID / fingerprint on your phone first')}</T>} />}
        {bio.ok && faceIdLimitedHere && <T v="small" style={{ paddingVertical: 10 }}>{t('Testing in Expo Go: iPhone asks for your passcode instead of Face ID. Face ID works in the real Perkly app.')}</T>}
        {feature('language') && <Row icon="globe" label={t('Language')} last onPress={switchLanguage} right={<T v="small" color={brand.purple}>{lang() === 'ar' ? 'العربية ⇄ English' : 'English ⇄ العربية'}</T>} />}
      </Card>
      <T v="label">{t('Notifications')}</T>
      <Card style={box}>
        <Row icon="flame" label={t('Perk Drops & Flash Deals')} right={<Switch value={drops} onValueChange={toggleDrops} trackColor={{ true: brand.purple }} />} />
        <Row icon="clock" label={t('Reminders (saved perks ending, levels)')} right={<Switch value={reminders} onValueChange={toggleReminders} trackColor={{ true: brand.purple }} />} />
        <Row icon="bell" label={t('Notifications on This Phone')} onPress={push === 'ok' || push === 'checking' ? undefined : fixPush}
          right={<T v="small" color={PUSH_LABEL[push].color}>{PUSH_LABEL[push].text}</T>} />
        <Row icon="inbox" label={t('Notifications')} onPress={() => router.push('/notifications')} />
        <Row icon="sliders" label={t('Phone Permissions')} last onPress={() => Linking.openSettings()} />
      </Card>
      <T v="label">{t('Help')}</T>
      <Card style={box}>
        <Row icon="chat" label={t('Support Chat')} onPress={() => Linking.openURL('https://wa.me/')} />
        <Row icon="doc" label={t('Terms of Use')} onPress={() => Linking.openURL(legalUrl('terms'))} />
        <Row icon="shield" label={t('Privacy Policy')} last onPress={() => Linking.openURL(legalUrl('privacy'))} />
      </Card>
      <Card style={[box, { marginTop: 4 }]}>
        <Row icon="logout" label={t('Log Out')} danger onPress={logout} />
        <Row icon="trash" label={deleting ? t('Deleting…') : t('Delete Account')} danger last onPress={deleting ? undefined : confirmDelete}
          sub={t('Permanently deletes your account, savings history and rewards.')}
          right={deleting ? <ActivityIndicator color={brand.danger} size="small" /> : undefined} />
      </Card>
      <View style={{ alignItems: 'center', gap: 2 }}>
        <T v="small">Perkly · {t('Unlock Perks. Live Smart.')}</T>
        <T v="small" style={{ opacity: 0.6, fontSize: 11 }}>{versionLabel()}</T>
      </View>
    </Screen>
  );
}

/** "Version 1.0.0 · Update 21 Nov, 14:05" (or "Built-in") — tells support which over-the-air update the phone runs. */
function versionLabel() {
  const v = Constants.expoConfig?.version ?? '';
  let u = t('Built-in');
  try {
    if (Updates.isEnabled && !Updates.isEmbeddedLaunch && Updates.createdAt) {
      u = `${t('Update')} ${Updates.createdAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${Updates.createdAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
    }
  } catch {}
  return `${t('Version')} ${v} · ${u}`;
}
