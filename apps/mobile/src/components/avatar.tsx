import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { Text } from '@/components/text';
import { Mascot } from '@/components/mascot';
import { avatarUrl, changeAvatar, removeAvatar } from '@/lib/avatar';
import { t } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { brand } from '@/lib/theme';

/** The student's photo (or the Perkly mascot if none). */
export function Avatar({ path, size = 40 }: { path?: string | null; size?: number }) {
  const uri = avatarUrl(path);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#FF3EA51A', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {uri ? <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" transition={150} /> : <Mascot size={size * 0.82} />}
    </View>
  );
}

/** Tap to take a photo, pick one from the library, or remove it. */
export function EditableAvatar({ size = 96 }: { size?: number }) {
  const { session, profile, refreshProfile } = useSession();
  const [busy, setBusy] = useState(false);
  const path = profile?.avatar_path ?? null;
  const uid = session?.user.id;

  async function run(job: () => ReturnType<typeof changeAvatar>) {
    setBusy(true);
    const r = await job();
    setBusy(false);
    if (r.ok) { await refreshProfile(); return; }
    if ('cancelled' in r) return;
    Alert.alert(t('Photo not changed'),
      r.error === 'permission' ? t('Allow Perkly to use your camera or photos in your phone settings.')
        : r.error === 'too_big' ? t('That photo is too big. Try another one.') : t('Something went wrong. Try again.'));
  }
  function open() {
    if (!uid || busy) return;
    Alert.alert(t('Profile photo'), undefined, [
      { text: t('Take photo'), onPress: () => run(() => changeAvatar(uid, 'camera', path)) },
      { text: t('Choose from photos'), onPress: () => run(() => changeAvatar(uid, 'library', path)) },
      ...(path ? [{ text: t('Remove photo'), style: 'destructive' as const, onPress: () => run(() => removeAvatar(uid, path)) }] : []),
      { text: t('Cancel'), style: 'cancel' as const },
    ]);
  }
  return (
    <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={t('Change profile photo')} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
      <View style={{ borderRadius: size / 2, padding: 3, backgroundColor: brand.pink }}>
        <View style={{ borderRadius: size / 2, padding: 2, backgroundColor: '#fff' }}>
          <Avatar path={path} size={size} />
        </View>
      </View>
      {busy && <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: size, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0006' }}><ActivityIndicator color="#fff" /></View>}
      <View style={{ position: 'absolute', end: 0, bottom: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: brand.ink, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 15 }}>📷</Text>
      </View>
    </Pressable>
  );
}
