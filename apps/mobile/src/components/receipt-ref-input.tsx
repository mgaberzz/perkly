import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text, TextInput } from '@/components/text';
import { t } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { brand } from '@/lib/theme';

/** Optional: the shop's own receipt / order number, so the transaction can be matched to their system. */
export function ReceiptRefInput({ redemptionId }: { redemptionId: string }) {
  const [value, setValue] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  async function save() {
    if (!value.trim()) return;
    setState('saving');
    const { data, error } = await supabase.rpc('set_receipt_ref', { p_redemption_id: redemptionId, p_ref: value.trim() });
    setState(!error && (data as { ok?: boolean } | null)?.ok ? 'saved' : 'error');
  }
  if (state === 'saved') {
    return <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center' }}>{t('Receipt no. saved: {ref}', { ref: value.trim() })}</Text>;
  }
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: '#ffffffcc', fontSize: 12, fontWeight: '700' }}>{t('Shop receipt / order no. (optional)')}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput value={value} onChangeText={(v) => { setValue(v); if (state === 'error') setState('idle'); }} maxLength={40} autoCapitalize="characters"
          placeholder={t('e.g. INV-0042')} placeholderTextColor="#ffffff88"
          style={{ flex: 1, backgroundColor: '#ffffff22', color: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontWeight: '700', writingDirection: 'ltr' }} />
        <Pressable onPress={save} disabled={!value.trim() || state === 'saving'} style={{ backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center', opacity: value.trim() ? 1 : 0.5 }}>
          <Text style={{ color: brand.purple, fontWeight: '800' }}>{state === 'saving' ? '…' : t('Save')}</Text>
        </Pressable>
      </View>
      {state === 'error' && <Text style={{ color: '#fff', fontSize: 12 }}>{t('Use up to 40 letters, numbers, spaces or # / . _ -')}</Text>}
    </View>
  );
}
