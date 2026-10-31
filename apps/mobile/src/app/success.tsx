import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Linking, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { discountLabel, egp } from '@/lib/format';
import { getLastRedemption } from '@/lib/redemption-store';
import { brand } from '@/lib/theme';

const CONFETTI = ['🎉', '✨', '💜', '🎊', '⭐', '💸'];

/**
 * The cashier checks THIS screen before applying the discount.
 * Anti-screenshot: live ticking clock, pulsing ring and a moving shimmer — a photo looks frozen.
 */
export default function Success() {
  const r = getLastRedemption();
  const [now, setNow] = useState(() => new Date());
  const pulse = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const xp = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    Animated.spring(pop, { toValue: 1, friction: 4, useNativeDriver: true }).start();
    Animated.timing(xp, { toValue: 1, duration: 1400, delay: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    const p = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]));
    const s = Animated.loop(Animated.timing(shimmer, { toValue: 1, duration: 2200, easing: Easing.linear, useNativeDriver: true }));
    p.start(); s.start();
    return () => { clearInterval(t); p.stop(); s.stop(); };
  }, [pop, pulse, xp, shimmer]);

  if (!r) return <Redirect href="/" />;

  const age = Math.floor((now.getTime() - new Date(r.created_at).getTime()) / 1000);
  const stale = age > 15 * 60; // after 15 minutes the screen is no longer valid for a discount
  const ring = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const shimmerX = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-300, 300] });

  return (
    <LinearGradient colors={stale ? ['#6B6680', '#3A3446'] : [brand.success, '#0E9F6E']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 24, gap: 18, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {CONFETTI.map((e, i) => (
              <Animated.Text key={i} style={{ fontSize: 26, transform: [{ scale: pop }, { translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [30, i % 2 ? -6 : 6] }) }] }}>{e}</Animated.Text>
            ))}
          </View>

          <Animated.View style={{ width: 132, height: 132, borderRadius: 66, backgroundColor: '#ffffff33', alignItems: 'center', justifyContent: 'center', transform: [{ scale: ring }] }}>
            <View style={{ width: 104, height: 104, borderRadius: 52, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 56, color: stale ? '#6B6680' : brand.success, fontWeight: '900' }}>{stale ? '⌛' : '✓'}</Text>
            </View>
          </Animated.View>

          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>
            {stale ? 'Expired — redeem again' : 'Valid Perkly discount'}
          </Text>
          <Text style={{ color: '#fff', fontSize: 34, fontWeight: '900', textAlign: 'center' }}>{r.merchant_name}</Text>
          <Text style={{ color: '#ffffffdd', fontSize: 15, fontWeight: '600', marginTop: -12 }}>{r.branch_name}</Text>

          {/* Cashier box */}
          <View style={{ width: '100%', backgroundColor: '#fff', borderRadius: 28, padding: 20, alignItems: 'center', gap: 6, overflow: 'hidden' }}>
            <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, width: 80, backgroundColor: '#12B76A14', transform: [{ translateX: shimmerX }, { skewX: '-20deg' }] }} />
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#6B6680', letterSpacing: 1 }}>SHOW THIS TO THE CASHIER 💜</Text>
            <Text style={{ fontSize: 40, fontWeight: '900', color: brand.ink }}>{discountLabel(r)}</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: brand.ink, textAlign: 'center' }}>{r.perk_title}</Text>
            {r.discount_amount != null && (
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#6B6680' }}>
                Bill {egp(r.original_amount)} − {egp(r.discount_amount)} = <Text style={{ color: brand.ink, fontWeight: '900' }}>{egp(r.final_amount)}</Text>
              </Text>
            )}
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 10, alignItems: 'center' }}>
              <View style={{ backgroundColor: brand.ink, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 6 }}>
                <Text style={{ color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: 6, fontVariant: ['tabular-nums'] }}>{r.verification_code}</Text>
              </View>
              <Text style={{ fontSize: 22, fontWeight: '900', color: brand.ink, fontVariant: ['tabular-nums'] }}>
                {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </Text>
            </View>
            <Text style={{ fontSize: 11, color: '#6B6680', fontWeight: '600' }}>Live clock · code matches the merchant&apos;s Perkly dashboard</Text>
          </View>

          {/* Receipt */}
          <View style={{ width: '100%', backgroundColor: '#ffffff', borderRadius: 24, padding: 18, gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontWeight: '900', fontSize: 18, color: brand.ink }}>Receipt</Text>
              <View style={{ backgroundColor: '#12B76A1A', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ color: brand.success, fontWeight: '800', fontSize: 12 }}>ID {r.redemption_id.slice(0, 4).toUpperCase()}-{r.verification_code}</Text>
              </View>
            </View>
            <Text style={{ color: '#6B6680', fontWeight: '600' }}>
              Redeemed on {new Date(r.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
            </Text>
            {[
              ['Perk', r.perk_title],
              ['Bill', egp(r.original_amount)],
              ['Perkly discount', r.discount_amount != null ? `− ${egp(r.discount_amount)}` : 'Applied by cashier'],
              ['XP earned', `+${r.xp_awarded} XP`],
            ].map(([k, v]) => (
              <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <Text style={{ color: '#6B6680', fontWeight: '600' }}>{k}</Text>
                <Text style={{ color: brand.ink, fontWeight: '800', flexShrink: 1, textAlign: 'right' }}>{v}</Text>
              </View>
            ))}
            <View style={{ height: 1, backgroundColor: '#ECE8F3' }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: brand.ink, fontWeight: '900', fontSize: 18 }}>Total</Text>
              <Text style={{ color: brand.ink, fontWeight: '900', fontSize: 18 }}>{r.final_amount != null ? egp(r.final_amount) : '—'}</Text>
            </View>
            <Text style={{ color: '#6B6680', fontSize: 12, textAlign: 'center', marginTop: 4 }}>
              <Text style={{ color: brand.pink, fontWeight: '800' }} onPress={() => Linking.openURL('https://wa.me/')}>Need help</Text> with this redemption? Tell us within 24 hours.
            </Text>
          </View>

          {/* Rewards */}
          <Animated.View style={{ width: '100%', gap: 10, opacity: xp, transform: [{ translateY: xp.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }}>
            {r.discount_amount != null && (
              <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900', textAlign: 'center' }}>Success! You saved {egp(r.discount_amount)} 🎉</Text>
            )}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pill big={`+${r.xp_awarded} XP ⚡`} small={r.leveled_up ? `Level up! ${r.level_name}` : `Lv ${r.level} · ${r.level_name}`} />
              <Pill big={`${r.streak} 🔥`} small={r.used_freeze_token ? 'Streak saved by freeze ❄️' : 'day streak'} />
            </View>
            {r.first_time_at_merchant && <Pill big="New spot unlocked 🧭" small="+25 XP for trying somewhere new" />}
            {r.quests_completed.map((q) => <Pill key={q.title} big={`${q.emoji} ${q.title}`} small={`Quest complete · +${q.xp_reward} XP`} />)}
            {r.badges_unlocked.map((b) => <Pill key={b.code} big={`${b.emoji} ${b.name}`} small="New badge unlocked!" />)}
          </Animated.View>

          <Button variant="white" title="Done" onPress={() => router.replace('/')} style={{ alignSelf: 'stretch', marginTop: 8 }} />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function Pill({ big, small }: { big: string; small: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff26', borderRadius: 20, padding: 14, gap: 2 }}>
      <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>{big}</Text>
      <Text style={{ color: '#ffffffdd', fontSize: 12, fontWeight: '700' }}>{small}</Text>
    </View>
  );
}
