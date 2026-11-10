import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Linking, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { ShareReceiptButton } from '@/components/share-receipt';
import { ReceiptRefInput } from '@/components/receipt-ref-input';
import { discountLabel, egp } from '@/lib/format';
import { getLastRedemption } from '@/lib/redemption-store';
import { supabase } from '@/lib/supabase';
import { brand } from '@/lib/theme';
import { locale, t } from '@/lib/i18n';

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
  const [txCode, setTxCode] = useState<string | null>(null);
  const rid = r?.redemption_id;
  useEffect(() => {
    if (!rid) return;
    let live = true;
    supabase.from('my_redemptions').select('tx_code').eq('id', rid).maybeSingle()
      .then(({ data }) => { if (live && data?.tx_code) setTxCode(data.tx_code as string); });
    return () => { live = false; };
  }, [rid]);

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
            {stale ? t('Expired — redeem again') : r.channel === 'online' ? t('Online Order Confirmed') : t('Valid Perkly Discount')}
          </Text>
          <Text style={{ color: '#fff', fontSize: 30, fontWeight: '900', textAlign: 'center' }} numberOfLines={2} adjustsFontSizeToFit>{r.merchant_name}</Text>
          <Text style={{ color: '#ffffffdd', fontSize: 15, fontWeight: '600', marginTop: -12 }}>{r.branch_name === 'Online' ? t('Online') : r.branch_name}</Text>

          {r.payment_method === 'in_app' && (
            <View style={{ width: '100%', backgroundColor: brand.ink, borderRadius: 20, padding: 14, alignItems: 'center', gap: 2 }}>
              <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900' }}>💳 {t('PAID IN APP')}{r.payment_mode === 'test' ? ` · ${t('TEST')}` : ''}</Text>
              <Text style={{ color: '#ffffffcc', fontWeight: '700', textAlign: 'center' }}>{t('Cashier: do not charge this bill again.')}</Text>
            </View>
          )}

          {/* Cashier box */}
          <View style={{ width: '100%', backgroundColor: '#fff', borderRadius: 28, padding: 20, alignItems: 'center', gap: 6, overflow: 'hidden' }}>
            <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, width: 80, backgroundColor: '#12B76A14', transform: [{ translateX: shimmerX }, { skewX: '-20deg' }] }} />
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#6B6680', letterSpacing: 1 }}>{t('SHOW THIS TO THE CASHIER 💜')}</Text>
            <Text style={{ fontSize: 36, fontWeight: '900', color: brand.ink, textAlign: 'center' }} numberOfLines={1} adjustsFontSizeToFit>{discountLabel(r)}</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: brand.ink, textAlign: 'center' }}>{r.perk_title}</Text>
            {r.discount_amount != null && (
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#6B6680' }}>
                {t('Bill')} {egp(r.original_amount)} − {egp(r.discount_amount)} = <Text style={{ color: brand.ink, fontWeight: '900' }}>{egp(r.final_amount)}</Text>
              </Text>
            )}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 10, alignItems: 'center' }}>
              <View style={{ backgroundColor: brand.ink, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 6 }}>
                <Text style={{ color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: 6, fontVariant: ['tabular-nums'] }}>{r.verification_code}</Text>
              </View>
              <Text style={{ fontSize: 22, fontWeight: '900', color: brand.ink, fontVariant: ['tabular-nums'] }}>
                {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </Text>
            </View>
            <Text style={{ fontSize: 11, color: '#6B6680', fontWeight: '600' }}>{t("Live clock · code matches the merchant's Perkly dashboard")}</Text>
          </View>

          {/* Receipt */}
          <View style={{ width: '100%', backgroundColor: '#ffffff', borderRadius: 24, padding: 18, gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontWeight: '900', fontSize: 18, color: brand.ink }}>{t('Receipt')}</Text>
              <View style={{ backgroundColor: '#12B76A1A', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ color: brand.success, fontWeight: '800', fontSize: 12 }}>{txCode ?? `ID ${r.redemption_id.slice(0, 4).toUpperCase()}-${r.verification_code}`}</Text>
              </View>
            </View>
            <Text style={{ color: '#6B6680', fontWeight: '600' }}>
              {t('Redeemed on {date}', { date: new Date(r.created_at).toLocaleString(locale(), { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) })}
            </Text>
            {[
              [t('Perk'), r.perk_title],
              [t('Bill'), egp(r.original_amount)],
              [t('Perkly Discount'), r.discount_amount != null ? `− ${egp(r.discount_amount)}` : t('Applied by Cashier')],
              [t('Payment'), r.payment_method === 'in_app' ? `${t('Paid in App')}${r.payment_ref ? ` · ${r.payment_ref}` : ''}` : t('At the Cashier')],
              [t('XP Earned'), `+${r.xp_awarded} XP`],
            ].map(([k, v]) => (
              <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <Text style={{ color: '#6B6680', fontWeight: '600' }}>{k}</Text>
                <Text style={{ color: brand.ink, fontWeight: '800', flexShrink: 1, textAlign: 'right' }} numberOfLines={2}>{v}</Text>
              </View>
            ))}
            <View style={{ height: 1, backgroundColor: '#ECE8F3' }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: brand.ink, fontWeight: '900', fontSize: 18 }}>{t('Total')}</Text>
              <Text style={{ color: brand.ink, fontWeight: '900', fontSize: 18 }}>{r.final_amount != null ? egp(r.final_amount) : '—'}</Text>
            </View>
            <Text style={{ color: '#6B6680', fontSize: 12, textAlign: 'center', marginTop: 4 }}>
              <Text style={{ color: brand.pink, fontWeight: '800' }} onPress={() => Linking.openURL('https://wa.me/')}>{t('Need Help')}</Text> {t('with this redemption? Tell us within 24 hours.')}
            </Text>
          </View>

          {/* Rewards */}
          <Animated.View style={{ width: '100%', gap: 10, opacity: xp, transform: [{ translateY: xp.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }}>
            {r.discount_amount != null && (
              <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900', textAlign: 'center' }}>{t('Slay! You saved {amount} 🎉', { amount: egp(r.discount_amount) })}</Text>
            )}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <Pill onPress={() => router.push({ pathname: '/explain', params: { metric: 'redemption', id: r.redemption_id } })} big={`+${r.xp_awarded} XP ⚡`} small={r.leveled_up ? t('Level up! You’re {name} now 🚀', { name: t(r.level_name) }) : t('Lv {n} · {name}', { n: r.level, name: t(r.level_name) })} />
              <Pill onPress={() => router.push({ pathname: '/explain', params: { metric: 'streak' } })} big={`${r.streak} 🔥`} small={r.used_freeze_token ? t('Streak Saved by Freeze ❄️') : t('Day Streak')} />
            </View>
            {r.first_time_at_merchant && <Pill big={t('New Spot Unlocked 🧭')} small={t('+25 XP for Trying Somewhere New')} />}
            {r.quests_completed.map((q) => <Pill key={q.title} big={`${q.emoji} ${t(q.title)}`} small={t('Quest Complete · +{n} XP', { n: q.xp_reward })} />)}
            {r.badges_unlocked.map((b) => <Pill key={b.code} big={`${b.emoji} ${t(b.name)}`} small={t('New badge unlocked! 🏆')} />)}
          </Animated.View>

          <View style={{ alignSelf: 'stretch', marginTop: 8, gap: 10 }}>
            <ReceiptRefInput redemptionId={r.redemption_id} />
            <ShareReceiptButton variant="light" data={{ ...r, tx_code: txCode }} />
            <Button variant="white" title={t('Done')} onPress={() => router.replace('/')} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function Pill({ big, small, onPress }: { big: string; small: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={{ flex: 1, minWidth: 140, backgroundColor: '#ffffff26', borderRadius: 20, padding: 14, gap: 2 }}>
      <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>{big}</Text>
      <Text style={{ color: '#ffffffdd', fontSize: 12, fontWeight: '700' }}>{small}</Text>
    </Pressable>
  );
}
