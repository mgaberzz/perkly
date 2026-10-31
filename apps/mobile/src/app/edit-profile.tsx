import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { ProfileForm } from '@/components/profile-form';
import { Screen } from '@/components/ui';

export default function EditProfile() {
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={[]}>
        <ProfileForm submitLabel="Save changes" onDone={() => router.back()} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
