import type { ReactNode } from 'react';
import { Pressable, View, type TextInputProps } from 'react-native';
import { TextInput } from '@/components/text';
import { brand, useTheme } from '@/lib/theme';
import { T } from './ui';

export function FieldLabel({ children }: { children: ReactNode }) {
  return <T v="h3" style={{ fontSize: 14, marginBottom: 8 }}>{children}</T>;
}

/** Labeled input in a soft box (onboarding / profile forms). */
export function TextField({ label, error, hint, ...props }: TextInputProps & { label: string; error?: string | null; hint?: string }) {
  const { c } = useTheme();
  return (
    <View>
      <FieldLabel>{label}</FieldLabel>
      <TextInput
        placeholderTextColor={c.textMuted}
        {...props}
        style={[{ backgroundColor: c.card, borderRadius: 16, borderWidth: 1, borderColor: error ? brand.danger : c.border, paddingHorizontal: 16, paddingVertical: 16, fontSize: 17, fontWeight: '700', color: c.text },
          props.editable === false && { opacity: 0.6 }, props.style]}
      />
      {error ? <T v="small" color={brand.danger} style={{ marginTop: 6 }}>{error}</T> : hint ? <T v="small" style={{ marginTop: 6 }}>{hint}</T> : null}
    </View>
  );
}

/** Field that looks like an input but opens a picker. */
export function PickerField({ label, value, placeholder, onPress, icon }: { label: string; value?: string | null; placeholder: string; onPress: () => void; icon?: string }) {
  const { c } = useTheme();
  return (
    <View>
      <FieldLabel>{label}</FieldLabel>
      <Pressable onPress={onPress} style={{ backgroundColor: c.card, borderRadius: 16, borderWidth: 1, borderColor: c.border, paddingHorizontal: 16, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {icon ? <T style={{ fontSize: 18 }}>{icon}</T> : null}
        <T style={{ flex: 1, fontSize: 17, fontWeight: '700' }} color={value ? c.text : c.textMuted} numberOfLines={1}>{value || placeholder}</T>
        <T v="muted">⌄</T>
      </Pressable>
    </View>
  );
}

/** DD / MM / YYYY masked text → ISO date (or null if invalid). */
export function maskDob(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join(' / ');
}
export function dobToIso(masked: string): string | null {
  const m = masked.replace(/\s/g, '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.getUTCDate() !== +dd) return null;
  const age = (Date.now() - d.getTime()) / (365.25 * 86400000);
  return age >= 12 && age <= 80 ? `${yyyy}-${mm}-${dd}` : null;
}
export function isoToDob(iso: string | null | undefined) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d} / ${m} / ${y}`;
}

export function Checkbox({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={() => onChange(!checked)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
      <View style={{ flex: 1 }}>
        <T>{label}</T>
        {sub ? <T v="small">{sub}</T> : null}
      </View>
      <View style={{ width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: checked ? brand.purple : c.border, backgroundColor: checked ? brand.purple : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {checked ? <T color="#fff" style={{ fontWeight: '900' }}>✓</T> : null}
      </View>
    </Pressable>
  );
}
