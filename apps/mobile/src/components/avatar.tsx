import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { Text } from '@/components/text';
import { Mascot } from '@/components/mascot';
import { avatarUrl, changeAvatar, removeAvatar, removeCartoon, showAvatarKind } from '@/lib/avatar';
import { cartoonSvg } from '@/lib/cartoon';
import { t } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { brand } from '@/lib/theme';
import type { Profile } from '@/lib/types';

type AvatarSource = Pick<Profile, 'avatar_path' | 'avatar_config' | 'avatar_kind'> | null | undefined;

/** Which picture a profile shows: the chosen kind if it exists, else whatever exists, else the mascot */
export function avatarKind(p: AvatarSource): 'photo' | 'cartoon' | null {
  if (!p) return null;
  if (p.avatar_kind === 'cartoon' && p.avatar_config) return 'cartoon';
  if (p.avatar_kind === 'photo' && p.avatar_path) return 'photo';
  return p.avatar_path ? 'photo' : p.avatar_config ? 'cartoon' : null;
}

export function CartoonAvatar({ config, size = 40 }: { config: unknown; size?: number }) {
  const xml = useMemo(() => cartoonSvg(config), [config]);
  return <SvgXml xml={xml} width={size} height={size} />;
}

/** The student's picture: photo, cartoon avatar, or the Perkly mascot. */
export function Avatar({ profile, size = 40 }: { profile: AvatarSource; size?: number }) {
  const kind = avatarKind(profile);
  const uri = kind === 'photo' ? avatarUrl(profile?.avatar_path) : null;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#FF3EA51A', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {kind === 'cartoon' ? <CartoonAvatar config={profile?.avatar_config} size={size} />
        : uri ? <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" transition={150} />
        : <Mascot size={size * 0.82} />}
    </View>
  );
}

/** Tap: create/edit the cartoon avatar, take or choose a photo, switch between them, or remove. */
export function EditableAvatar({ size = 96 }: { size?: number }) {
  const { session, profile, refreshProfile, feature } = useSession();
  const [busy, setBusy] = useState(false);
  const uid = session?.user.id;
  const path = profile?.avatar_path ?? null;
  const hasCartoon = !!profile?.avatar_config;
  const kind = avatarKind(profile);

  async function run(job: () => Promise<{ ok?: boolean; error?: unknown; cancelled?: boolean } | { error: unknown }>) {
    setBusy(true);
    const r = (await job()) as { ok?: boolean; error?: unknown; cancelled?: boolean };
    setBusy(false);
    if (r.cancelled) return;
    if (r.ok === false || (r.ok === undefined && r.error)) {
      Alert.alert(t('Photo Not Changed'),
        r.error === 'permission' ? t('Allow Perkly to use your camera or photos in your phone settings.')
          : r.error === 'too_big' ? t('That photo is too big. Try another one.') : t('Something went wrong. Try again.'));
      return;
    }
    await refreshProfile();
  }
  function open() {
    if (!uid || busy) return;
    Alert.alert(t('Profile Picture'), undefined, [
      ...(feature('avatar_builder') ? [{ text: hasCartoon ? `🧑‍🎨 ${t('Edit My Avatar')}` : `🧑‍🎨 ${t('Create My Avatar')}`, onPress: () => router.push('/avatar') }] : []),
      { text: `📷 ${t('Take Photo')}`, onPress: () => run(() => changeAvatar(uid, 'camera', path)) },
      { text: `🖼️ ${t('Choose from Photos')}`, onPress: () => run(() => changeAvatar(uid, 'library', path)) },
      ...(kind === 'cartoon' && path ? [{ text: t('Show My Photo Instead'), onPress: () => run(() => showAvatarKind(uid, 'photo')) }] : []),
      ...(kind === 'photo' && hasCartoon && feature('avatar_builder') ? [{ text: t('Show My Avatar Instead'), onPress: () => run(() => showAvatarKind(uid, 'cartoon')) }] : []),
      ...(kind === 'photo' ? [{ text: t('Remove Photo'), style: 'destructive' as const, onPress: () => run(() => removeAvatar(uid, path, hasCartoon)) }] : []),
      ...(kind === 'cartoon' ? [{ text: t('Remove Avatar'), style: 'destructive' as const, onPress: () => run(() => removeCartoon(uid, !!path)) }] : []),
      { text: t('Cancel'), style: 'cancel' as const },
    ]);
  }
  return (
    <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={t('Change Profile Picture')} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
      <View style={{ borderRadius: size / 2, padding: 3, backgroundColor: brand.pink }}>
        <View style={{ borderRadius: size / 2, padding: 2, backgroundColor: '#fff' }}>
          <Avatar profile={profile} size={size} />
        </View>
      </View>
      {busy && <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: size, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0006' }}><ActivityIndicator color="#fff" /></View>}
      <View style={{ position: 'absolute', end: 0, bottom: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: brand.ink, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 15 }}>✏️</Text>
      </View>
    </Pressable>
  );
}
