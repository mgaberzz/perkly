import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, View } from 'react-native';
import { Text } from '@/components/text';
import { TextField } from '@/components/form';
import { Button, Card, Screen, T } from '@/components/ui';
import { shortDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { brand, useTheme } from '@/lib/theme';
import { registerPush } from '@/lib/push';
import { getMyVerification, pickIdCard, submitIdCard, type PickedPhoto, type Verification } from '@/lib/verification';

const ERRORS: Record<string, string> = {
  too_big: 'That photo is too big. Try again with a smaller photo.',
  already_pending: 'Your ID is already being checked.',
  already_verified: "You're already verified.",
};

export default function StudentVerification() {
  const { c } = useTheme();
  const { session, refreshProfile } = useSession();
  const [v, setV] = useState<Verification | null>(null);
  const [loading, setLoading] = useState(true);
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [number, setNumber] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getMyVerification().then((r) => { setV(r); setLoading(false); });
  }, []);
  useFocusEffect(load);

  async function pick(source: 'camera' | 'library') {
    setError(null);
    const r = await pickIdCard(source);
    if (r === 'permission') {
      const msg = source === 'camera' ? t('Allow camera access in Settings to take a photo.') : t('Allow photo access in Settings to choose a photo.');
      if (Platform.OS === 'web') return setError(msg);
      return Alert.alert(t('Permission needed'), msg, [{ text: t('Cancel'), style: 'cancel' }, { text: t('Open Settings'), onPress: () => Linking.openSettings() }]);
    }
    if (r) setPhoto(r);
  }

  async function send() {
    if (!session || !photo) return;
    setSending(true); setError(null);
    const r = await submitIdCard(session.user.id, photo, number);
    setSending(false);
    if (!r.ok) return setError(t(ERRORS[r.error] ?? 'Could not send your photo. Check your connection and try again.'));
    setPhoto(null); setNumber('');
    registerPush(true); // so the result can reach them
    refreshProfile();
    load();
  }

  if (loading) return <Screen edges={[]}><ActivityIndicator color={brand.purple} style={{ marginTop: 40 }} /></Screen>;

  const status = v?.status ?? 'unverified';
  const verifiedLong = status === 'verified' && v?.verified_until && new Date(v.verified_until).getTime() - Date.now() > 30 * 86400000;
  const canSend = status !== 'pending' && !verifiedLong;
  const freeLeft = v ? Math.max(0, v.free_redemptions - v.used) : 0;

  const banner = {
    verified: { icon: '✅', title: t("You're a verified student"), body: t('Valid until {date}.', { date: v?.verified_until ? shortDate(v.verified_until, { day: 'numeric', month: 'short', year: 'numeric' }) : '—' }), tone: brand.success },
    pending: { icon: '⏳', title: t('We’re checking your student ID'), body: t('This usually takes less than a day. You’ll see the result here.'), tone: '#B54708' },
    rejected: { icon: '❌', title: t('Your ID wasn’t approved'), body: v?.reject_reason ? t(v.reject_reason) : t('Please send a clearer photo.'), tone: brand.danger },
    expired: { icon: '📅', title: t('Your verification has expired'), body: t('Send a photo of this year’s student ID to keep your perks.'), tone: brand.danger },
    unverified: {
      icon: '🎓', title: t('Verify you’re a student'),
      body: v?.required
        ? (freeLeft > 0 ? t('You have {n} free uses left. Verify to keep using Perkly after that.', { n: freeLeft }) : t('Perks are for verified students. It only takes a minute.'))
        : t('Get verified once and you’re set for the whole year.'),
      tone: brand.purple,
    },
  }[status];

  return (
    <Screen edges={[]}>
      <Card style={{ gap: 6, alignItems: 'center', paddingVertical: 22 }}>
        <Text style={{ fontSize: 44 }}>{banner.icon}</Text>
        <T v="h2" style={{ textAlign: 'center' }} color={banner.tone}>{banner.title}</T>
        <T v="muted" style={{ textAlign: 'center' }}>{banner.body}</T>
      </Card>

      {canSend && (
        <>
          <T v="label">{status === 'rejected' || status === 'expired' ? t('Send a new photo') : t('How it works')}</T>
          <Card style={{ gap: 8 }}>
            <T>1. {t('Take a clear photo of the front of your student ID card (كارنيه).')}</T>
            <T>2. {t('Make sure your name, university and academic year are easy to read.')}</T>
            <T>3. {t('The Perkly team checks it, usually within a day.')}</T>
          </Card>

          {photo ? (
            <View style={{ gap: 8 }}>
              <Image source={{ uri: photo.uri }} contentFit="contain" style={{ width: '100%', height: 220, borderRadius: 16, backgroundColor: c.chip }} />
              <Button title={t('Retake photo')} variant="ghost" icon="🔄" onPress={() => pick(Platform.OS === 'web' ? 'library' : 'camera')} />
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {Platform.OS !== 'web' && <Button title={t('Take a photo of my ID')} icon="📷" onPress={() => pick('camera')} />}
              <Button title={t('Choose from my photos')} icon="🖼️" variant={Platform.OS === 'web' ? 'primary' : 'secondary'} onPress={() => pick('library')} />
            </View>
          )}

          <TextField label={t('Student number (optional)')} value={number} onChangeText={setNumber} maxLength={40} autoCapitalize="characters" placeholder="e.g. 20231234" />
          {error && <View style={{ backgroundColor: '#F044381A', borderRadius: 14, padding: 12 }}><T color={brand.danger}>{error}</T></View>}
          <Button title={t('Send for review')} icon="✨" onPress={send} loading={sending} disabled={!photo} />
        </>
      )}

      <T v="small" style={{ textAlign: 'center', paddingHorizontal: 8 }}>
        🔒 {t('Only the Perkly team sees this photo. It’s used only to confirm you’re a student, and it’s deleted if you delete your account.')}
      </T>
    </Screen>
  );
}
