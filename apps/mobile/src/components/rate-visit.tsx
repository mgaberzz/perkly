import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text, TextInput } from '@/components/text';
import { t } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { brand } from '@/lib/theme';

/**
 * "Rate your visit": tap 1–5 stars (saved at once), then optionally add a short comment.
 * `onDark` is for the purple success screen; the default suits a white card.
 */
export function RateVisit({ redemptionId, onDark }: { redemptionId: string; onDark?: boolean }) {
  const { feature, refreshMerchants } = useSession();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'sent' | 'error'>('idle');
  const [hasComment, setHasComment] = useState(false);

  useEffect(() => {
    supabase.from('ratings').select('stars, comment').eq('redemption_id', redemptionId).maybeSingle<{ stars: number; comment: string | null }>()
      .then(({ data }) => { if (data) { setStars(data.stars); setHasComment(Boolean(data.comment)); } });
  }, [redemptionId]);

  if (!feature('ratings')) return null;
  const fg = onDark ? '#fff' : brand.ink, muted = onDark ? '#ffffffcc' : '#6B6680';

  async function save(n: number, text?: string) {
    setStars(n); setState('saving');
    const { data, error } = await supabase.rpc('rate_visit', { p_redemption_id: redemptionId, p_stars: n, p_comment: text?.trim() || null });
    const ok = !error && (data as { ok?: boolean } | null)?.ok;
    setState(ok ? (text ? 'sent' : 'idle') : 'error');
    if (ok && text) setHasComment(true);
    if (ok) refreshMerchants();
  }

  return (
    <View style={{ gap: 8, alignItems: 'center' }}>
      <Text style={{ color: muted, fontSize: 12, fontWeight: '700' }}>{stars ? t('Your Rating') : t('Rate Your Visit')}</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => save(n)} hitSlop={6} accessibilityRole="button" accessibilityLabel={t('{n} Stars', { n })}>
            <Text style={{ fontSize: 34, color: n <= stars ? '#FFC53D' : onDark ? '#ffffff55' : '#D9D5E3' }}>★</Text>
          </Pressable>
        ))}
      </View>
      {stars > 0 && !hasComment && state !== 'sent' && (
        <View style={{ flexDirection: 'row', gap: 8, alignSelf: 'stretch' }}>
          <TextInput value={comment} onChangeText={setComment} maxLength={300} placeholder={stars <= 3 ? t('What went wrong? (optional)') : t('What did you like? (optional)')}
            placeholderTextColor={onDark ? '#ffffff88' : '#9A94AB'}
            style={{ flex: 1, backgroundColor: onDark ? '#ffffff22' : '#F4F2F8', color: fg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }} />
          <Pressable onPress={() => save(stars, comment)} disabled={!comment.trim() || state === 'saving'}
            style={{ backgroundColor: onDark ? '#fff' : brand.purple, borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center', opacity: comment.trim() ? 1 : 0.5 }}>
            <Text style={{ color: onDark ? brand.purple : '#fff', fontWeight: '800' }}>{t('Send')}</Text>
          </Pressable>
        </View>
      )}
      {(state === 'sent' || (stars > 0 && hasComment)) && <Text style={{ color: muted, fontSize: 12 }}>{t('Thanks! The shop sees this without your name 💜')}</Text>}
      {state === 'error' && <Text style={{ color: onDark ? '#fff' : brand.danger, fontSize: 12 }}>{t('Couldn’t save your rating. Try again.')}</Text>}
    </View>
  );
}

/** "⭐ 4.6 (23)" once a shop has at least 3 ratings; otherwise nothing. */
export function ratingText(m: { rating_avg?: number | null; rating_count?: number | null }) {
  const n = Number(m.rating_count ?? 0);
  return n >= 3 && m.rating_avg != null ? `⭐ ${Number(m.rating_avg).toFixed(1)} (${n})` : '';
}
