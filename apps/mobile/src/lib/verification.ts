import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected' | 'expired';
export type Verification = {
  required: boolean; free_redemptions: number; used: number; status: VerificationStatus;
  verified_until: string | null; reject_reason: string | null; submitted_at: string | null; can_redeem: boolean;
};

export async function getMyVerification(): Promise<Verification | null> {
  const { data } = await supabase.rpc('my_verification');
  return (data as Verification | null) ?? null;
}

export type PickedPhoto = { uri: string; mimeType?: string };

/** Photo of the student ID card from the camera or the photo library (no crop, so the whole card stays readable). */
export async function pickIdCard(source: 'camera' | 'library'): Promise<PickedPhoto | 'permission' | null> {
  const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return 'permission';
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6 };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.[0]) return null;
  return { uri: res.assets[0].uri, mimeType: res.assets[0].mimeType };
}

/** Uploads the photo to the private "student-ids" bucket (own folder) and sends it for review. */
export async function submitIdCard(userId: string, photo: PickedPhoto, studentNumber: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const type = photo.mimeType && /png|webp/.test(photo.mimeType) ? photo.mimeType : 'image/jpeg';
  const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${userId}/id-${Date.now()}.${ext}`;
  const body = await (await fetch(photo.uri)).arrayBuffer();
  if (body.byteLength > 5 * 1024 * 1024) return { ok: false, error: 'too_big' };
  const up = await supabase.storage.from('student-ids').upload(path, body, { contentType: type, upsert: false });
  if (up.error) return { ok: false, error: up.error.message };
  const { data, error } = await supabase.rpc('submit_student_verification', { p_id_card_path: path, p_student_number: studentNumber.trim() || null });
  const res = data as { ok: boolean; error?: string } | null;
  if (error || !res?.ok) {
    await supabase.storage.from('student-ids').remove([path]);
    return { ok: false, error: error?.message ?? res?.error ?? 'unknown' };
  }
  return { ok: true };
}
