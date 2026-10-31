import { useColorScheme } from 'react-native';

/** Perkly brand palette — placeholder HEX values (Notion names the colors, not the codes). */
export const brand = {
  purple: '#7B2FF7',
  purpleDark: '#5A17C9',
  pink: '#FF3EA5',
  blue: '#2F80FF',
  ink: '#16131F',
  mint: '#3DDC97',
  peach: '#FFB38A',
  yellow: '#FFE14D',
  success: '#12B76A',
  danger: '#F04438',
} as const;

const light = {
  bg: '#F7F5FB', card: '#FFFFFF', text: brand.ink, textMuted: '#6B6680', border: '#ECE8F3', chip: '#F0EBFA',
};
const dark = {
  bg: '#0E0B14', card: '#1A1623', text: '#F5F3FA', textMuted: '#A49FB5', border: '#2A2436', chip: '#251F31',
};
export type Palette = typeof light;

export function useTheme() {
  const scheme = useColorScheme();
  return { c: scheme === 'dark' ? dark : light, dark: scheme === 'dark' };
}

export const gradient = [brand.purple, brand.pink] as const;

export const CATEGORY_EMOJI: Record<string, string> = {
  Food: '🍔', Coffee: '☕', Fashion: '👟', Beauty: '💄', Fitness: '💪',
  Entertainment: '🎮', Electronics: '📱', Transport: '🛴', Services: '🛠️',
};
export const CATEGORIES = Object.keys(CATEGORY_EMOJI);
