import { setBiometricEnabled } from './biometric';
import { supabase } from './supabase';

/**
 * Deletes the signed-in student's account: removes their photos, then the database erases their
 * personal data and locks the login (past transactions stay, anonymised, for merchants' records).
 */
export async function deleteMyAccount(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: files } = await supabase.storage.from('avatars').list(userId);
  if (files?.length) await supabase.storage.from('avatars').remove(files.map((f) => `${userId}/${f.name}`));
  const { data: ids } = await supabase.storage.from('student-ids').list(userId);
  if (ids?.length) await supabase.storage.from('student-ids').remove(ids.map((f) => `${userId}/${f.name}`));
  const { error } = await supabase.rpc('delete_my_account');
  if (error) return { ok: false, error: error.message };
  await setBiometricEnabled(false).catch(() => false);
  return { ok: true };
}
