import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme';
import { T } from './ui';

/** Bottom sheet with a grab handle (dependency-free, built on Modal). */
export function Sheet({ visible, onClose, title, children, height = '80%' }: {
  visible: boolean; onClose: () => void; title?: string; children: ReactNode; height?: `${number}%` | number;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: '#0006' }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: height }}>
        <View style={{ backgroundColor: c.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10, paddingBottom: insets.bottom + 16, paddingHorizontal: 20, gap: 12, flexShrink: 1 }}>
          <View style={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: c.border }} />
          {title && <T v="h2" style={{ textAlign: 'center' }}>{title}</T>}
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
