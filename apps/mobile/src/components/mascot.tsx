import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Stop } from 'react-native-svg';
import { brand } from '@/lib/theme';

/** "Perky" — the Perkly mascot: a happy blob with sleepy-smile eyes and blush. */
export function Mascot({ size = 96 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="mg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={brand.purple} />
          <Stop offset="1" stopColor={brand.pink} />
        </LinearGradient>
      </Defs>
      <Circle cx="50" cy="50" r="46" fill="url(#mg)" />
      <Circle cx="50" cy="50" r="34" fill="#fff" />
      <Path d="M34 47 q5 -6 10 0" stroke={brand.ink} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <Path d="M56 47 q5 -6 10 0" stroke={brand.ink} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <Path d="M44 57 q6 6 12 0" stroke={brand.pink} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <Ellipse cx="33" cy="56" rx="5" ry="3" fill={brand.pink} opacity={0.35} />
      <Ellipse cx="67" cy="56" rx="5" ry="3" fill={brand.pink} opacity={0.35} />
    </Svg>
  );
}

/** Map pin with Perky inside — used on the location permission screen. */
export function MascotPin({ size = 160 }: { size?: number }) {
  return (
    <Svg width={size} height={size * 1.2} viewBox="0 0 100 120">
      <Defs>
        <LinearGradient id="pg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={brand.purple} />
          <Stop offset="1" stopColor={brand.pink} />
        </LinearGradient>
      </Defs>
      <Path d="M50 4 C25 4 8 22 8 45 C8 72 50 112 50 112 C50 112 92 72 92 45 C92 22 75 4 50 4 Z" fill="url(#pg)" />
      <Circle cx="50" cy="45" r="27" fill="#fff" />
      <Path d="M37 43 q4 -5 8 0" stroke={brand.ink} strokeWidth="3" fill="none" strokeLinecap="round" />
      <Path d="M55 43 q4 -5 8 0" stroke={brand.ink} strokeWidth="3" fill="none" strokeLinecap="round" />
      <Path d="M45 51 q5 5 10 0" stroke={brand.pink} strokeWidth="3" fill="none" strokeLinecap="round" />
      <Ellipse cx="36" cy="51" rx="4" ry="2.5" fill={brand.pink} opacity={0.35} />
      <Ellipse cx="64" cy="51" rx="4" ry="2.5" fill={brand.pink} opacity={0.35} />
      <Ellipse cx="50" cy="117" rx="16" ry="3" fill={brand.ink} opacity={0.08} />
    </Svg>
  );
}
