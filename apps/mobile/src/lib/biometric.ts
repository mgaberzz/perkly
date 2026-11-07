import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';
import { t } from './i18n';

const KEY = 'perkly.biometricLock';

/** iPhone + Expo Go: Apple doesn't let Expo Go use Face ID, so iOS asks for the passcode instead (works in the real app). */
export const faceIdLimitedHere = Platform.OS === 'ios' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export async function biometricAvailable() {
  if (Platform.OS === 'web') return { ok: false, label: '' };
  const [hw, enrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync(), LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  const face = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
  return { ok: hw && enrolled, label: face ? (Platform.OS === 'ios' ? 'Face ID' : t('Face unlock')) : Platform.OS === 'ios' ? 'Touch ID' : t('Fingerprint') };
}

export const biometricEnabled = async () => (await AsyncStorage.getItem(KEY)) === '1';

export async function setBiometricEnabled(on: boolean) {
  if (on) {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: t('Confirm to turn on biometric login'), cancelLabel: t('Cancel') });
    if (!r.success) return false;
  }
  await AsyncStorage.setItem(KEY, on ? '1' : '0');
  return true;
}

export async function unlock() {
  const r = await LocalAuthentication.authenticateAsync({
    promptMessage: t('Unlock Perkly'), cancelLabel: t('Cancel'), fallbackLabel: t('Use passcode'), disableDeviceFallback: false,
  });
  return r.success;
}
