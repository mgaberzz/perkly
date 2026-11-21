import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { CampusPicker, useCampuses } from './campus-picker';
import { dobToIso, isoToDob, maskDob, PickerField, TextField } from './form';
import { Button, T } from './ui';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { brand } from '@/lib/theme';
import { campusName, t } from '@/lib/i18n';

/** Shared by onboarding ("Complete your profile") and Edit profile. */
export function ProfileForm({ submitLabel, onDone, showInvite }: { submitLabel: string; onDone: () => void; showInvite?: boolean }) {
  const { session, profile, refreshProfile, feature } = useSession();
  const campuses = useCampuses();
  const [name, setName] = useState(profile?.full_name ?? '');
  const [email, setEmail] = useState(profile?.email ?? session?.user.email ?? '');
  const [phone, setPhone] = useState(toLocalPhone(profile?.phone));
  const [dob, setDob] = useState(isoToDob(profile?.birth_date));
  const [campusId, setCampusId] = useState<string | null>(profile?.campus_id ?? null);
  const [invite, setInvite] = useState('');
  const [picker, setPicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  // A new mobile number is saved only after the SMS code confirms it
  const [otpFor, setOtpFor] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setName((n) => n || profile.full_name || '');
    setCampusId((c) => c ?? profile.campus_id);
    setDob((d) => d || isoToDob(profile.birth_date));
    setPhone((p) => p || toLocalPhone(profile.phone));
  }, [profile]);

  const campus = campuses.find((c) => c.id === campusId);

  async function save() {
    const e: Record<string, string> = {};
    if (name.trim().split(/\s+/).length < 2) e.name = t('Add your first and last name.');
    const birth = dob ? dobToIso(dob) : null;
    if (dob && !birth) e.dob = t('Use DD / MM / YYYY (you must be 16+).');
    if (email && !/^\S+@\S+\.\S+$/.test(email.trim())) e.email = t('That email doesn’t look right.');
    const phoneIntl = phone.trim() ? toIntlPhone(phone) : null;
    if (phone.trim() && !phoneIntl) e.phone = t('That doesn’t look like an Egyptian mobile number. Try 01x xxxx xxxx.');
    if (!campusId) e.campus = t('Pick your campus.');
    setErrors(e);
    if (Object.keys(e).length || !session) return;
    setSaving(true);
    const digits = (x?: string | null) => (x ?? '').replace(/\D/g, '');
    const confirmed = !phoneIntl || phoneIntl === profile?.phone || digits(phoneIntl) === digits(session.user.phone);
    const fields: Record<string, unknown> = { full_name: name.trim(), campus_id: campusId, birth_date: birth, email: email.trim() || null };
    if (confirmed) fields.phone = phoneIntl;
    const { error } = await supabase.from('profiles').update(fields).eq('id', session.user.id);
    if (error) { setSaving(false); setErrors({ form: error.message }); return; }
    if (!confirmed && phoneIntl) {
      // everything else is saved; the number waits for its SMS code
      const sent = await sendCode(phoneIntl);
      setSaving(false);
      if (sent) setOtpFor(phoneIntl);
      return;
    }
    if (invite.trim()) {
      const { data } = await supabase.rpc('apply_referral', { p_code: invite.trim() });
      const res = data as { ok: boolean; error?: string } | null;
      if (res && !res.ok && res.error === 'invalid_code') { setSaving(false); setErrors({ invite: t('That invite code doesn’t exist.') }); return; }
    }
    await refreshProfile();
    setSaving(false);
    onDone();
  }

  async function sendCode(intl: string) {
    const { error } = await supabase.auth.updateUser({ phone: intl });
    if (error) { setErrors({ phone: smsError(error.message) }); return false; }
    setErrors({}); setCode('');
    return true;
  }
  async function verifyCode() {
    if (!otpFor || !session) return;
    if (!/^\d{6}$/.test(code.trim())) { setErrors({ code: t('Enter the 6-digit code from the SMS.') }); return; }
    setVerifying(true);
    const { error } = await supabase.auth.verifyOtp({ phone: otpFor, token: code.trim(), type: 'phone_change' });
    if (error) { setVerifying(false); setErrors({ code: smsError(error.message) }); return; }
    const { error: e2 } = await supabase.from('profiles').update({ phone: otpFor }).eq('id', session.user.id);
    setVerifying(false);
    if (e2) { setErrors({ code: e2.message }); return; }
    setOtpFor(null);
    await refreshProfile();
    onDone();
  }

  return (
    <View style={{ gap: 18 }}>
      <TextField label={t('Full Name')} value={name} onChangeText={setName} placeholder={t('First and Last Name')} autoComplete="name" error={errors.name} />
      <TextField label={t('Email')} value={email} onChangeText={setEmail} placeholder="you@university.edu.eg" keyboardType="email-address" autoCapitalize="none"
        editable={!session?.user.email} hint={session?.user.email ? t('From Your Sign-In Account') : t('Optional — for receipts and account recovery')} error={errors.email} />
      <TextField label={t('Mobile Number')} value={phone} onChangeText={(v) => { setPhone(v); setOtpFor(null); }} placeholder="01x xxxx xxxx" keyboardType="phone-pad" autoComplete="tel" maxLength={16}
        editable={!otpFor} hint={t('Optional. We send a code by SMS to confirm a new number before saving it.')} error={errors.phone} />
      {otpFor && (
        <View style={{ gap: 12, padding: 14, borderRadius: 16, backgroundColor: '#7B2FF712' }}>
          <T v="body">{t('We sent a 6-digit code to {phone}. Enter it to save your number.', { phone: toLocalPhone(otpFor) })}</T>
          <TextField label={t('SMS Code')} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} placeholder="123456"
            keyboardType="number-pad" autoComplete="sms-otp" textContentType="oneTimeCode" maxLength={6} error={errors.code} />
          <Button title={t('Confirm Number')} onPress={verifyCode} loading={verifying} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T v="small" color={brand.purple} style={{ fontWeight: '800' }} onPress={() => sendCode(otpFor)}>{t('Resend Code')}</T>
            <T v="small" color={brand.purple} style={{ fontWeight: '800' }} onPress={() => { setOtpFor(null); setErrors({}); }}>{t('Change Number')}</T>
          </View>
        </View>
      )}
      <TextField label={t('Date of Birth')} value={dob} onChangeText={(v) => setDob(maskDob(v))} placeholder={t('DD / MM / YYYY')} keyboardType="number-pad" maxLength={14}
        hint={t('Optional — unlocks birthday perks 🎂')} error={errors.dob} />
      <View>
        <PickerField label={t('Campus')} value={campus ? campusName(campus) : null} placeholder={t('Choose Your Campus')} icon="🎓" onPress={() => setPicker(true)} />
        {errors.campus ? <T v="small" color={brand.danger} style={{ marginTop: 6 }}>{errors.campus}</T> : null}
      </View>
      {showInvite && feature('invite') && !profile?.referred_by && (
        <TextField label={t('Invite Code (Optional)')} value={invite} onChangeText={setInvite} placeholder="FRIEND12" autoCapitalize="characters" error={errors.invite}
          hint={t('Your friend earns XP when you redeem your first perk')} />
      )}
      {errors.form ? <T v="small" color={brand.danger}>{errors.form}</T> : null}
      <Button title={submitLabel} onPress={save} loading={saving} />
      <CampusPicker visible={picker} onClose={() => setPicker(false)} onPick={(c) => setCampusId(c.id)} selectedId={campusId} />
    </View>
  );
}

/** Supabase SMS errors in plain words */
function smsError(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes('provider') || m.includes('sms') && m.includes('disabled') || m.includes('unsupported')) return t('SMS codes aren’t switched on yet, so a new number can’t be confirmed. Leave the number empty for now.');
  if (m.includes('expired') || m.includes('invalid')) return t('That code is wrong or has expired. Check the SMS or resend the code.');
  if (m.includes('already') || m.includes('registered') || m.includes('exists')) return t('This number is already used by another Perkly account.');
  if (m.includes('rate') || m.includes('seconds') || m.includes('too many')) return t('Please wait a minute before asking for another code.');
  return msg;
}

/** +201012345678 → 01012345678 (what Egyptians type) */
function toLocalPhone(p?: string | null) {
  if (!p) return '';
  const d = p.replace(/\D/g, '');
  return d.startsWith('20') && d.length === 12 ? `0${d.slice(2)}` : p;
}
/** 01012345678 / +20 10 1234 5678 / 201012345678 → +201012345678, or null if it isn't an Egyptian mobile */
export function toIntlPhone(input: string) {
  let d = input.replace(/\D/g, '');
  if (d.startsWith('0020')) d = d.slice(4);
  else if (d.startsWith('20')) d = d.slice(2);
  else if (d.startsWith('0')) d = d.slice(1);
  return /^1[0125]\d{8}$/.test(d) ? `+20${d}` : null;
}
