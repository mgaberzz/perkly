import type { ComponentProps } from 'react';
import { Text as RNText, TextInput as RNTextInput } from 'react-native';

/**
 * App-wide Text/TextInput: caps how far the phone's "Larger Text" setting can grow fonts, so screens still
 * fit on small phones (iPhone SE / mini) while staying accessible.
 */
export const MAX_FONT_SCALE = 1.25;

export function Text(props: ComponentProps<typeof RNText>) {
  return <RNText maxFontSizeMultiplier={MAX_FONT_SCALE} {...props} />;
}

export function TextInput(props: ComponentProps<typeof RNTextInput>) {
  return <RNTextInput maxFontSizeMultiplier={MAX_FONT_SCALE} {...props} />;
}
