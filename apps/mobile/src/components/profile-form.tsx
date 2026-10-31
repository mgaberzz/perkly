import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { CampusPicker, useCampuses } from './campus-picker';
import { dobToIso, isoToDob, maskDob, PickerField, TextField } from './form';
import { Button, T } from './ui';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { brand } from '@/lib/theme';

/** Shared by onboarding ("Complete your profile") and Edit profile. */
export function ProfileForm({ submitLabel, onDone, showInvite }: { submitLabel: string; onDone: () => void; showInvite?: boolean }) {
  const { session, profile, refreshProfile } = useSession();
  const campuses = useCampuses();
  const [name, setName] = useState(profile?.full_name ?? '');
  const [email, setEmail] = useState(profile?.email ?? session?.user.email ?? '');
  const [dob, setDob] = useState(isoToDob(profile?.birth_date));
  const [campusId, setCampusId] = useState<string | null>(profile?.campus_id ?? null);
  const [invite, setInvite] = useState('');
  const [picker, setPicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setName((n) => n || profile.full_name || '');
    setCampusId((c) => c ?? profile.campus_id);
    setDob((d) => d || isoToDob(profile.birth_date));
  }, [profile]);

  const campus = campuses.find((c) => c.id === campusId);

  async function save() {
    const e: Record<string, string> = {};
    if (name.trim().split(/\s+/).length < 2) e.name = 'Add your first and last name.';
    const birth = dob ? dobToIso(dob) : null;
    if (dob && !birth) e.dob = 'Use DD / MM / YYYY (you must be 12+).';
    if (email && !/^\S+@\S+\.\S+$/.test(email.trim())) e.email = 'That email doesn’t look right.';
    if (!campusId) e.campus = 'Pick your campus.';
    setErrors(e);
    if (Object.keys(e).length || !session) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      full_name: name.trim(), campus_id: campusId, birth_date: birth, email: email.trim() || null,
    }).eq('id', session.user.id);
    if (error) { setSaving(false); setErrors({ form: error.message }); return; }
    if (invite.trim()) {
      const { data } = await supabase.rpc('apply_referral', { p_code: invite.trim() });
      const res = data as { ok: boolean; error?: string } | null;
      if (res && !res.ok && res.error === 'invalid_code') { setSaving(false); setErrors({ invite: 'That invite code doesn’t exist.' }); return; }
    }
    await refreshProfile();
    setSaving(false);
    onDone();
  }

  return (
    <View style={{ gap: 18 }}>
      <TextField label="Full name" value={name} onChangeText={setName} placeholder="First and last name" autoComplete="name" error={errors.name} />
      <TextField label="Email" value={email} onChangeText={setEmail} placeholder="you@university.edu.eg" keyboardType="email-address" autoCapitalize="none"
        editable={!session?.user.email} hint={session?.user.email ? 'From your sign-in account' : 'Optional — for receipts and account recovery'} error={errors.email} />
      <TextField label="Date of birth" value={dob} onChangeText={(t) => setDob(maskDob(t))} placeholder="DD / MM / YYYY" keyboardType="number-pad" maxLength={14}
        hint="Optional — unlocks birthday perks 🎂" error={errors.dob} />
      <View>
        <PickerField label="Campus" value={campus ? campus.name : null} placeholder="Choose your campus" icon="🎓" onPress={() => setPicker(true)} />
        {errors.campus ? <T v="small" color={brand.danger} style={{ marginTop: 6 }}>{errors.campus}</T> : null}
      </View>
      {showInvite && !profile?.referred_by && (
        <TextField label="Invite code (optional)" value={invite} onChangeText={setInvite} placeholder="FRIEND12" autoCapitalize="characters" error={errors.invite}
          hint="Your friend earns XP when you redeem your first perk" />
      )}
      {errors.form ? <T v="small" color={brand.danger}>{errors.form}</T> : null}
      <Button title={submitLabel} onPress={save} loading={saving} />
      <CampusPicker visible={picker} onClose={() => setPicker(false)} onPick={(c) => setCampusId(c.id)} selectedId={campusId} />
    </View>
  );
}
