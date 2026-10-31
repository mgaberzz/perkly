import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { ProfileForm } from '@/components/profile-form';
import { Screen, T } from '@/components/ui';

export default function Details() {
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['top', 'bottom']}>
        <View style={{ gap: 8, marginTop: 12 }}>
          <T v="label">Step 1 of 2</T>
          <T v="h1">Complete your profile</T>
          <T v="muted">So we can show perks near your campus and keep your account safe.</T>
        </View>
        <ProfileForm submitLabel="Continue" showInvite onDone={() => router.replace('/consent')} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
