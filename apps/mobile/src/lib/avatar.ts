import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

/** Public URL of a profile photo stored in the "avatars" bucket */
export function avatarUrl(path?: string | null) {
  return path ? supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl : null;
}

export type AvatarResult = { ok: true; path: string | null } | { ok: false; error: string } | { ok: false; cancelled: true };

/** Pick (camera or photo library) → square crop → upload to <userId>/avatar-<time>.jpg → save on the profile. */
export async function changeAvatar(userId: string, source: 'camera' | 'library', oldPath?: string | null): Promise<AvatarResult> {
  const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { ok: false, error: 'permission' };
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.5 };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync({ ...opts, cameraType: ImagePicker.CameraType.front }) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.[0]) return { ok: false, cancelled: true };
  const asset = res.assets[0];
  const type = asset.mimeType && /png|webp/.test(asset.mimeType) ? asset.mimeType : 'image/jpeg';
  const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${userId}/avatar-${Date.now()}.${ext}`;
  const body = await (await fetch(asset.uri)).arrayBuffer();
  if (body.byteLength > 3 * 1024 * 1024) return { ok: false, error: 'too_big' };
  const up = await supabase.storage.from('avatars').upload(path, body, { contentType: type, upsert: false });
  if (up.error) return { ok: false, error: up.error.message };
  const { error } = await supabase.from('profiles').update({ avatar_path: path, avatar_kind: 'photo' }).eq('id', userId);
  if (error) { await supabase.storage.from('avatars').remove([path]); return { ok: false, error: error.message }; }
  if (oldPath) supabase.storage.from('avatars').remove([oldPath]); // tidy up the previous photo
  return { ok: true, path };
}

export async function removeAvatar(userId: string, oldPath?: string | null, hasCartoon = false): Promise<AvatarResult> {
  const { error } = await supabase.from('profiles').update({ avatar_path: null, avatar_kind: hasCartoon ? 'cartoon' : null }).eq('id', userId);
  if (error) return { ok: false, error: error.message };
  if (oldPath) await supabase.storage.from('avatars').remove([oldPath]);
  return { ok: true, path: null };
}

/** Save the cartoon avatar and show it on the profile */
export async function saveCartoon(userId: string, config: object) {
  return supabase.from('profiles').update({ avatar_config: config, avatar_kind: 'cartoon' }).eq('id', userId);
}

/** Switch which picture the profile shows (both are kept) */
export async function showAvatarKind(userId: string, kind: 'photo' | 'cartoon') {
  return supabase.from('profiles').update({ avatar_kind: kind }).eq('id', userId);
}

export async function removeCartoon(userId: string, hasPhoto: boolean) {
  return supabase.from('profiles').update({ avatar_config: null, avatar_kind: hasPhoto ? 'photo' : null }).eq('id', userId);
}
