import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { Text } from './text';
import { Button } from './ui';
import { Mascot } from './mascot';
import { biometricEnabled, unlock } from '@/lib/biometric';
import { t } from '@/lib/i18n';
import { gradient } from '@/lib/theme';

const RELOCK_AFTER_MS = 30_000;

/** When biometric login is on, the app opens locked and re-locks after 30 s in the background. */
export function BiometricGate({ active, children }: { active: boolean; children: ReactNode }) {
  const [locked, setLocked] = useState(false);
  const [checked, setChecked] = useState(false);
  const away = useRef<number | null>(null);
  const prompting = useRef(false);

  const tryUnlock = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    const ok = await unlock().catch(() => false);
    prompting.current = false;
    if (ok) setLocked(false);
  }, []);

  // Cold start
  useEffect(() => {
    if (!active) { setLocked(false); setChecked(true); return; }
    biometricEnabled().then((on) => {
      setChecked(true);
      if (on) { setLocked(true); tryUnlock(); }
    });
  }, [active, tryUnlock]);

  // Background → foreground
  useEffect(() => {
    if (!active) return;
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'background') away.current = Date.now();
      if (state === 'active' && away.current && Date.now() - away.current > RELOCK_AFTER_MS && (await biometricEnabled())) {
        away.current = null;
        setLocked(true);
        tryUnlock();
      }
    });
    return () => sub.remove();
  }, [active, tryUnlock]);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {active && (!checked || locked) && (
        <LinearGradient colors={gradient} style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 18 }]}>
          <Mascot size={110} />
          <Text style={{ color: '#fff', fontSize: 26, fontWeight: '900' }}>{t('Perkly is locked')}</Text>
          <Text style={{ color: '#ffffffcc', fontWeight: '600', textAlign: 'center' }}>{t('Use Face ID, your fingerprint or your phone passcode to continue.')}</Text>
          {checked && <Button variant="white" icon="🔓" title={t('Unlock')} onPress={tryUnlock} style={{ alignSelf: 'stretch' }} />}
        </LinearGradient>
      )}
    </View>
  );
}
