import { Redirect, Stack, useSegments } from 'expo-router';
import { onboardingStep, useSession } from '@/lib/session';

const SIGNED_OUT_ONLY = ['welcome', 'login', 'verify'];

export default function AuthLayout() {
  const { session, profile } = useSession();
  const segments = useSegments();
  const screen = segments[segments.length - 1] ?? '';
  if (session && profile && SIGNED_OUT_ONLY.includes(screen)) {
    return <Redirect href={onboardingStep(profile) ?? '/'} />;
  }
  if (!session && !SIGNED_OUT_ONLY.includes(screen)) return <Redirect href="/welcome" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
