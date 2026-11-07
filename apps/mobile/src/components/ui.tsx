import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useEffect, useRef, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, View, type PressableProps, type ScrollViewProps, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from 'react-native';
import { Text } from '@/components/text';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { brand, CATEGORY_EMOJI, gradient, useTheme } from '@/lib/theme';
import { discountLabel, levelProgress } from '@/lib/format';
import type { Perk } from '@/lib/types';
import { t } from '@/lib/i18n';

// ───────── Layout ─────────
export function Screen({ children, scroll = true, edges = ['top'], style, ...rest }: {
  children: ReactNode; scroll?: boolean; edges?: Edge[]; style?: StyleProp<ViewStyle>;
} & ScrollViewProps) {
  const { c } = useTheme();
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: c.bg }}>
      {scroll ? (
        <ScrollView contentContainerStyle={[{ padding: 20, paddingBottom: 120, gap: 20 }, style]} showsVerticalScrollIndicator={false} {...rest}>
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1, padding: 20 }, style]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

// ───────── Text ─────────
type Variant = 'h1' | 'h2' | 'h3' | 'body' | 'muted' | 'small' | 'label';
const TEXT: Record<Variant, TextStyle> = {
  h1: { fontSize: 30, fontWeight: '900', letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  h3: { fontSize: 17, fontWeight: '800' },
  body: { fontSize: 15, fontWeight: '500' },
  muted: { fontSize: 14, fontWeight: '500' },
  small: { fontSize: 12, fontWeight: '600' },
  label: { fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
};
export function T({ v = 'body', style, color, ...rest }: TextProps & { v?: Variant; color?: string }) {
  const { c } = useTheme();
  const muted = v === 'muted' || v === 'small' || v === 'label';
  return <Text {...rest} style={[TEXT[v], { color: color ?? (muted ? c.textMuted : c.text) }, style]} />;
}

// ───────── Buttons ─────────
export function Button({ title, onPress, variant = 'primary', loading, disabled, icon, style }: {
  title: string; onPress?: PressableProps['onPress']; variant?: 'primary' | 'secondary' | 'ghost' | 'white';
  loading?: boolean; disabled?: boolean; icon?: string; style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const inner = (
    <View style={styles.btnInner}>
      {loading ? <ActivityIndicator color={variant === 'primary' ? '#fff' : brand.purple} /> : (
        <Text style={[styles.btnText, { color: variant === 'primary' ? '#fff' : variant === 'white' ? brand.purple : c.text }]}>
          {icon ? `${icon}  ` : ''}{title}
        </Text>
      )}
    </View>
  );
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [{ opacity: disabled ? 0.5 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }, style]}
    >
      {variant === 'primary' ? (
        <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btn}>{inner}</LinearGradient>
      ) : (
        <View style={[styles.btn, variant === 'secondary' && { backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
          variant === 'white' && { backgroundColor: '#fff' }]}>{inner}</View>
      )}
    </Pressable>
  );
}

// ───────── Surfaces ─────────
export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const { c } = useTheme();
  const body = <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }, style]}>{children}</View>;
  return onPress ? <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>{body}</Pressable> : body;
}

export function GradientCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.card, { borderWidth: 0 }, style]}>{children}</LinearGradient>;
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.chip, { backgroundColor: active ? brand.purple : c.chip }]}>
      <Text style={{ color: active ? '#fff' : c.text, fontWeight: '700', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <T v="h3">{title}</T>
      {action && <Pressable onPress={onAction}><T v="small" color={brand.purple}>{action}</T></Pressable>}
    </View>
  );
}

export function Empty({ emoji = '💜', title, subtitle }: { emoji?: string; title: string; subtitle?: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 32, gap: 6 }}>
      <Text style={{ fontSize: 40 }}>{emoji}</Text>
      <T v="h3" style={{ textAlign: 'center' }}>{title}</T>
      {subtitle && <T v="muted" style={{ textAlign: 'center' }}>{subtitle}</T>}
    </View>
  );
}

// ───────── Perkly bits ─────────
export function DiscountBadge({ perk, size = 'md' }: { perk: Pick<Perk, 'discount_type' | 'discount_value' | 'is_flash'>; size?: 'sm' | 'md' | 'lg' }) {
  const fs = size === 'lg' ? 22 : size === 'sm' ? 11 : 13;
  return (
    <LinearGradient colors={perk.is_flash ? [brand.pink, '#FF7A59'] : gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{ borderRadius: 999, paddingHorizontal: size === 'lg' ? 16 : 10, paddingVertical: size === 'lg' ? 8 : 4, alignSelf: 'flex-start' }}>
      <Text style={{ color: '#fff', fontWeight: '900', fontSize: fs }}>{perk.is_flash ? '⚡ ' : ''}{discountLabel(perk)}</Text>
    </LinearGradient>
  );
}

export function MerchantLogo({ name, category, uri, size = 48 }: { name: string; category: string; uri?: string | null; size?: number }) {
  const { c } = useTheme();
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 3.5 }} contentFit="cover" />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 3.5, backgroundColor: c.chip, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.45 }}>{CATEGORY_EMOJI[category] ?? name[0]}</Text>
    </View>
  );
}

export function XPBar({ totalXp, compact }: { totalXp: number; compact?: boolean }) {
  const { c } = useTheme();
  const { cur, next, pct, toNext } = levelProgress(totalXp);
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: pct, duration: 700, useNativeDriver: false }).start();
  }, [pct, anim]);
  return (
    <View style={{ gap: 6 }}>
      {!compact && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T v="small">{t('Lv {n} · {name}', { n: cur.level, name: cur.name })}</T>
          <T v="small">{next ? t('{n} XP to {name}', { n: toNext, name: next.name }) : t('Max level 👑')}</T>
        </View>
      )}
      <View style={{ height: 10, borderRadius: 999, backgroundColor: c.chip, overflow: 'hidden' }}>
        <Animated.View style={{ height: '100%', width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }}>
          <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
        </Animated.View>
      </View>
    </View>
  );
}

/** Streak flame wiggles every 6s and turns hot pink at 7+ days (UX spec §4). */
export function StreakFlame({ days, size = 28 }: { days: number; size?: number }) {
  const wiggle = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(6000),
      Animated.timing(wiggle, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(wiggle, { toValue: -1, duration: 120, useNativeDriver: true }),
      Animated.timing(wiggle, { toValue: 0, duration: 120, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [wiggle]);
  const rotate = wiggle.interpolate({ inputRange: [-1, 1], outputRange: ['-12deg', '12deg'] });
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Animated.Text style={{ fontSize: size, transform: [{ rotate }] }}>{days >= 7 ? '💖' : '🔥'}</Animated.Text>
      <Text style={{ fontSize: size * 0.7, fontWeight: '900', color: days >= 7 ? brand.pink : '#FF7A1A' }}>{days}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: { borderRadius: 18, paddingVertical: 16, paddingHorizontal: 20 },
  btnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 22 },
  btnText: { fontSize: 16, fontWeight: '800' },
  card: { borderRadius: 22, padding: 16, borderWidth: 1, gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
});
