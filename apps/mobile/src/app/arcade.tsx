import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Text } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';
import { backChevron, fwdChevron, t } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { brand } from '@/lib/theme';

// Must match public.wheel_segments() order (labels only — odds live on the server)
const SEGMENTS = ['+10 XP', '+25 XP', '+15 XP', '+100 XP', '+20 XP', 'Freeze ❄️', '+50 XP', '+30 XP'];
const SEG = 360 / SEGMENTS.length;
const COLORS = ['#FFFFFF', '#FF3EA5', '#FFFFFF', '#7B2FF7', '#FFFFFF', '#2F80FF', '#FFFFFF', '#FF7A59'];
const GOLD = '#FFD25A';
const TOUR_KEY = 'perkly.arcadeTour';
const FONT = Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui, sans-serif' });

function wedge(i: number, r: number) {
  const a0 = ((i * SEG - 90) * Math.PI) / 180;
  const a1 = (((i + 1) * SEG - 90) * Math.PI) / 180;
  return `M0 0 L${r * Math.cos(a0)} ${r * Math.sin(a0)} A${r} ${r} 0 0 1 ${r * Math.cos(a1)} ${r * Math.sin(a1)} Z`;
}

function Wheel({ size }: { size: number }) {
  const r = size / 2 - 8;
  return (
    <Svg width={size} height={size} viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`}>
      <Circle r={r + 6} fill={GOLD} />
      {SEGMENTS.map((label, i) => {
        const mid = i * SEG + SEG / 2;
        const dark = COLORS[i] !== '#FFFFFF';
        return (
          <G key={label}>
            <Path d={wedge(i, r)} fill={COLORS[i]} stroke="#E9E3F5" strokeWidth={1} />
            <G rotation={mid} origin="0, 0">
              <SvgText x={0} y={-r * 0.62} fill={dark ? '#fff' : brand.ink} fontSize={size * 0.055} fontWeight="900" fontFamily={FONT} textAnchor="middle">{label.startsWith('Freeze') ? `${t('Freeze')} ❄️` : label}</SvgText>
            </G>
          </G>
        );
      })}
      <Circle r={size * 0.09} fill={GOLD} stroke="#fff" strokeWidth={4} />
      <SvgText y={size * 0.025} fontSize={size * 0.07} textAnchor="middle">⚡</SvgText>
    </Svg>
  );
}

const TOUR = [
  { text: 'Tickets let you spin. You get one for your first redemption each day and one for every quest you finish.', top: 150 },
  { text: 'Every spin wins something — XP or a streak freeze that protects your 🔥.', top: 300 },
  { text: 'Tap SPIN to use a ticket. Prizes land on your account instantly.', top: 470 },
  { text: 'More games are coming — check the Missions shelf.', top: 520 },
];

type SpinResult = { ok: true; segment: number; label: string; reward_type: 'xp' | 'freeze'; amount: number; tickets_left: number } | { ok: false; error: string };

export default function Arcade() {
  const { stats, refreshProfile, feature } = useSession();
  const [tickets, setTickets] = useState(stats?.spin_tickets ?? 0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [tab, setTab] = useState<'missions' | 'prizes'>('missions');
  const [tour, setTour] = useState(-1);
  const rotation = useRef(new Animated.Value(0)).current;
  const total = useRef(0);
  const { width, height } = useWindowDimensions();
  // Fits small phones (SE / mini) and short screens
  const size = Math.max(220, Math.min(300, width - 72, height * 0.38));

  useEffect(() => { setTickets(stats?.spin_tickets ?? 0); }, [stats?.spin_tickets]);
  useEffect(() => { AsyncStorage.getItem(TOUR_KEY).then((v) => { if (!v) setTour(0); }); }, []);

  const endTour = () => { setTour(-1); AsyncStorage.setItem(TOUR_KEY, '1').catch(() => {}); };

  async function spin() {
    if (spinning) return;
    if (tickets < 1) { setResult({ ok: false, error: 'no_tickets' }); return; }
    setSpinning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    const { data, error } = await supabase.rpc('spin_wheel');
    const res = (error ? { ok: false, error: 'network' } : data) as SpinResult;
    if (!res.ok) { setSpinning(false); setResult(res); return; }
    // Land the chosen segment under the top pointer
    const current = total.current % 360;
    const target = 360 - (res.segment * SEG + SEG / 2);
    total.current += 360 * 6 + ((target - current + 360) % 360);
    Animated.timing(rotation, { toValue: total.current, duration: 4200, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setTickets(res.tickets_left);
      setSpinning(false);
      setResult(res);
      refreshProfile();
    });
  }

  const rotate = rotation.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] });
  const stars = useMemo(() => Array.from({ length: 40 }, (_, i) => ({ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`, s: (i % 3) + 1 })), []);
  // Switched off by the Perkly team (e.g. a notification link opened it)
  useEffect(() => { if (!feature('arcade')) router.back(); }, [feature]);

  return (
    <LinearGradient colors={['#1B0B3A', '#3A1078', '#5B1FA8']} style={{ flex: 1 }}>
      {stars.map((st, i) => <View key={i} style={{ position: 'absolute', left: st.left as `${number}%`, top: st.top as `${number}%`, width: st.s, height: st.s, borderRadius: 2, backgroundColor: '#fff', opacity: 0.6 }} />)}
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
          {/* Marquee sign */}
          <LinearGradient colors={[brand.pink, '#C2188B']} style={{ borderRadius: 18, borderWidth: 3, borderColor: GOLD, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
            <Pressable onPress={() => router.back()} hitSlop={12} style={{ paddingHorizontal: 16 }}><Text style={{ color: GOLD, fontSize: 28, fontWeight: '900' }}>{backChevron()}</Text></Pressable>
            <Text style={{ flex: 1, textAlign: 'center', color: GOLD, fontSize: 30, fontWeight: '900', letterSpacing: 2, marginEnd: 44 }} numberOfLines={1} adjustsFontSizeToFit>{t('ARCADE')}</Text>
          </LinearGradient>

          {/* Screen */}
          <View style={{ borderRadius: 24, borderWidth: 3, borderColor: '#8B5CF6', backgroundColor: '#140A2Ecc', padding: 16, gap: 12, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flexDirection: 'row', gap: 6, backgroundColor: '#ffffff1f', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text>🎟️</Text><Text style={{ color: '#fff', fontWeight: '900' }}>{tickets}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 6, backgroundColor: '#ffffff1f', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text>⚡</Text><Text style={{ color: '#fff', fontWeight: '900' }}>{stats?.total_xp ?? 0}</Text>
              </View>
              <View style={{ flex: 1 }} />
              <Pressable onPress={() => setTour(0)}><Text style={{ color: '#fff', fontWeight: '800' }}>{t('How It Works')}</Text></Pressable>
            </View>
            <Text style={{ color: '#fff', fontSize: 26, fontWeight: '900', lineHeight: 30 }}>{t('SPIN\nTHE WHEEL')}</Text>
            <Text style={{ color: '#ffffffcc', fontWeight: '600' }}>{t('Every Spin Wins · 1 🎟️ per Spin')}</Text>

            <View style={{ alignItems: 'center', marginTop: 8 }}>
              <View style={{ position: 'absolute', top: -4, zIndex: 2, width: 0, height: 0, borderLeftWidth: 16, borderRightWidth: 16, borderTopWidth: 28,
                borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: brand.danger }} />
              <Animated.View style={{ transform: [{ rotate }] }}><Wheel size={size} /></Animated.View>
            </View>

            <Pressable onPress={spin} disabled={spinning} style={({ pressed }) => ({ alignSelf: 'center', marginTop: 8, transform: [{ scale: pressed ? 0.96 : 1 }] })}>
              <LinearGradient colors={tickets > 0 ? [GOLD, '#FF9F1C'] : ['#6B6680', '#4B4560']} style={{ borderRadius: 999, paddingHorizontal: 56, paddingVertical: 14 }}>
                <Text style={{ color: brand.ink, fontWeight: '900', fontSize: 22, letterSpacing: 2 }}>{spinning ? t('SPINNING…') : t('SPIN')}</Text>
              </LinearGradient>
            </Pressable>
          </View>

          {/* Shelf */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {(['missions', 'prizes'] as const).map((k) => (
              <Pressable key={k} onPress={() => setTab(k)} style={{ borderRadius: 14, borderWidth: 2, borderColor: tab === k ? GOLD : '#8B5CF6', backgroundColor: tab === k ? brand.pink : '#ffffff14', paddingHorizontal: 18, paddingVertical: 10 }}>
                <Text style={{ color: GOLD, fontWeight: '900', fontSize: 18, letterSpacing: 1 }}>{t(k === 'missions' ? 'MISSIONS' : 'PRIZES')}</Text>
              </Pressable>
            ))}
          </View>
          {tab === 'missions' ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              {[{ e: '🎡', name: 'Spin the Wheel', live: true }, { e: '🃏', name: 'Flip the Cards', live: false }, { e: '🕹️', name: 'Claw Machine', live: false }].map((m) => (
                <View key={m.name} style={{ width: 130, height: 150, borderRadius: 18, backgroundColor: '#ffffff1a', borderWidth: 2, borderColor: m.live ? GOLD : '#ffffff33', padding: 12, justifyContent: 'space-between', opacity: m.live ? 1 : 0.6 }}>
                  <Text style={{ fontSize: 44 }}>{m.e}</Text>
                  <Text style={{ color: '#fff', fontWeight: '900' }}>{t(m.name)}</Text>
                  <Text style={{ color: m.live ? GOLD : '#ffffffaa', fontWeight: '800', fontSize: 12 }}>{m.live ? t('Playing Now') : t('Coming Soon')}</Text>
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={{ gap: 8 }}>
              {[['⚡', 'XP boosts', '+10 to +100 XP added to your level instantly'], ['❄️', 'Streak freeze', 'Miss a day without losing your streak (max 3)'], ['🎁', 'Partner prizes', 'Free drinks & merch from campus partners — coming soon']].map(([e, name, d]) => (
                <View key={name} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#ffffff14', borderRadius: 16, padding: 14 }}>
                  <Text style={{ fontSize: 28 }}>{e}</Text>
                  <View style={{ flex: 1 }}><Text style={{ color: '#fff', fontWeight: '900' }}>{t(name)}</Text><Text style={{ color: '#ffffffbb', fontWeight: '600' }}>{t(d)}</Text></View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Coach-mark tour */}
      <Modal visible={tour >= 0} transparent animationType="fade" onRequestClose={endTour}>
        <View style={{ flex: 1, backgroundColor: '#000a' }}>
          {tour >= 0 && (
            <View style={{ position: 'absolute', left: 20, right: 20, top: Math.min(TOUR[tour].top, height - 280), backgroundColor: '#fff', borderRadius: 20, padding: 18, gap: 12 }}>
              <Text style={{ fontWeight: '900', color: brand.ink }}>{tour + 1}/{TOUR.length}</Text>
              <Text style={{ fontWeight: '800', fontSize: 16, color: brand.ink }}>{t(TOUR[tour].text)}</Text>
              <Pressable onPress={() => (tour < TOUR.length - 1 ? setTour(tour + 1) : endTour())} style={{ alignSelf: 'flex-end' }}>
                <Text style={{ color: brand.purple, fontWeight: '900', fontSize: 16 }}>{tour < TOUR.length - 1 ? `${t('Next')} ${fwdChevron()}` : `${t('Let’s Play')} ${fwdChevron()}`}</Text>
              </Pressable>
            </View>
          )}
          <Pressable onPress={endTour} style={{ position: 'absolute', right: 20, bottom: 50, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 22, paddingVertical: 12 }}>
            <Text style={{ color: brand.purple, fontWeight: '900' }}>{t('Skip')} {fwdChevron()}</Text>
          </Pressable>
        </View>
      </Modal>

      {/* Result */}
      <Modal visible={!!result} transparent animationType="fade" onRequestClose={() => setResult(null)}>
        <Pressable onPress={() => setResult(null)} style={{ flex: 1, backgroundColor: '#000a', alignItems: 'center', justifyContent: 'center', padding: 30 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 28, padding: 24, alignItems: 'center', gap: 10, width: '100%' }}>
            {result?.ok ? (
              <>
                <Text style={{ fontSize: 60 }}>{result.reward_type === 'freeze' ? '❄️' : '🎉'}</Text>
                <Text style={{ fontSize: 28, fontWeight: '900', color: brand.ink }}>{result.reward_type === 'freeze' ? t('Streak freeze!') : `+${result.amount} XP`}</Text>
                <Text style={{ color: '#6B6680', fontWeight: '600', textAlign: 'center' }}>
                  {result.reward_type === 'freeze' ? t('Your streak is safe if you miss a day.') : t('Added to your level. Keep going!')} {t('{n} Ticket(s) Left', { n: result.tickets_left })}
                </Text>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 60 }}>🎟️</Text>
                <Text style={{ fontSize: 24, fontWeight: '900', color: brand.ink }}>{result?.error === 'no_tickets' ? t('Out of Tickets 😭') : t('Oops!')}</Text>
                <Text style={{ color: '#6B6680', fontWeight: '600', textAlign: 'center' }}>
                  {result?.error === 'no_tickets' ? t('Redeem a perk today or finish a quest to earn another spin.') : t('Wi-Fi acting up? Try again in a sec 💜')}
                </Text>
              </>
            )}
            <Text style={{ color: brand.purple, fontWeight: '900', marginTop: 8 }}>{t('Tap to Close')}</Text>
          </View>
        </Pressable>
      </Modal>
    </LinearGradient>
  );
}
