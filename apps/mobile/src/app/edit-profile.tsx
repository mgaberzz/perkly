import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { EditableAvatar } from '@/components/avatar';
import { ProfileForm } from '@/components/profile-form';
import { Screen, T } from '@/components/ui';
import { t } from '@/lib/i18n';

export default function EditProfile() {
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={[]}>
        <View style={{ alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <EditableAvatar size={104} />
          <T v="small">{t('Tap your photo to change it')}</T>
        </View>
        <ProfileForm submitLabel={t('Save changes')} onDone={() => router.back()} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
