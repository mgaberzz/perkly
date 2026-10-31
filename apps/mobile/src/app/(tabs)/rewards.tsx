import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { Card, Chip, GradientCard, Screen, SectionHeader, StreakFlame, T, XPBar } from '@/components/ui';
import { levelProgress } from '@/lib/format';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { brand, useTheme } from '@/lib/theme';

type Quest = { id: string; title: string; description: string | null; emoji: string | null; quest_type: 'daily' | 'weekly' | 'monthly'; target: number; xp_reward: number };
type UserQuest = { quest_id: string; period_start: string; progress: number; completed_at: string | null };
type Badge = { id: string; code: string; name: string; description: string | null; emoji: string };
type Leader = { rank: number; user_id: string; display_name: string; campus_name: string | null; xp: number; is_me: boolean };

/** Current period start (Cairo) for a quest type, as YYYY-MM-DD. Matches the SQL date_trunc logic. */
function periodStart(type: Quest['quest_type']) {
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (type === 'weekly') d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  if (type === 'monthly') d.setDate(1);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const STREAK_MILESTONES = [3, 5, 7, 14, 30];

export default function Rewards() {
  const { c } = useTheme();
  const { session, stats, refreshProfile } = useSession();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [progress, setProgress] = useState<UserQuest[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [scope, setScope] = useState<'campus' | 'all'>('campus');
  const [leaders, setLeaders] = useState<Leader[]>([]);

  const load = useCallback(async () => {
    if (!session) return;
    const [q, uq, b, ub, lb] = await Promise.all([
      supabase.from('quests').select('*').eq('is_active', true).order('xp_reward'),
      supabase.from('user_quests').select('quest_id, period_start, progress, completed_at').eq('user_id', session.user.id),
      supabase.from('badges').select('*').order('name'),
      supabase.from('user_badges').select('badge_id').eq('user_id', session.user.id),
      supabase.rpc('get_leaderboard', { p_scope: scope, p_limit: 20 }),
    ]);
    setQuests((q.data ?? []) as Quest[]);
    setProgress((uq.data ?? []) as UserQuest[]);
    setBadges((b.data ?? []) as Badge[]);
    setMine(new Set((ub.data ?? []).map((x: { badge_id: string }) => x.badge_id)));
    setLeaders((lb.data ?? []) as Leader[]);
  }, [session, scope]);

  useFocusEffect(useCallback(() => { load(); refreshProfile(); }, [load, refreshProfile]));

  const streak = stats?.current_streak ?? 0;
  const nextMilestone = STREAK_MILESTONES.find((m) => m > streak);
  const { cur } = levelProgress(stats?.total_xp ?? 0);

  return (
    <Screen>
      <T v="h1">Rewards 🏆</T>

      <GradientCard style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ color: '#ffffffcc', fontWeight: '800', fontSize: 12, letterSpacing: 1 }}>LEVEL {cur.level}</Text>
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 26 }}>{cur.name}</Text>
            <Text style={{ color: '#ffffffdd', fontWeight: '700' }}>{stats?.total_xp ?? 0} XP total</Text>
          </View>
          <View style={{ backgroundColor: '#ffffff26', borderRadius: 20, padding: 12, alignItems: 'center' }}>
            <StreakFlame days={streak} size={34} />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 11 }}>day streak</Text>
          </View>
        </View>
        <View style={{ backgroundColor: '#ffffff', borderRadius: 16, padding: 12 }}><XPBar totalXp={stats?.total_xp ?? 0} /></View>
        <Text style={{ color: '#fff', fontWeight: '700' }}>
          {streak === 0 ? 'Redeem a perk today to start a streak 🔥'
            : nextMilestone ? `${nextMilestone - streak} more day${nextMilestone - streak === 1 ? '' : 's'} to your ${nextMilestone}-day bonus!`
              : 'Legendary streak. Keep it alive 👑'}
          {stats?.freeze_tokens ? `  ·  ❄️ ${stats.freeze_tokens} freeze` : ''}
        </Text>
      </GradientCard>

      <Card onPress={() => router.push('/arcade')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderColor: '#FFD25A', borderWidth: 2 }}>
        <Text style={{ fontSize: 40 }}>🎡</Text>
        <View style={{ flex: 1 }}>
          <T v="h3">Arcade · Spin the wheel</T>
          <T v="small">{stats?.spin_tickets ?? 0} ticket{stats?.spin_tickets === 1 ? '' : 's'} · every spin wins XP or a streak freeze</T>
        </View>
        <T v="h3" color={brand.purple}>Play ›</T>
      </Card>

      <SectionHeader title="Quests 🎯" />
      {(['daily', 'weekly', 'monthly'] as const).map((type) => {
        const list = quests.filter((q) => q.quest_type === type);
        if (!list.length) return null;
        return (
          <View key={type} style={{ gap: 10 }}>
            <T v="label">{type}</T>
            {list.map((q) => {
              const p = progress.find((x) => x.quest_id === q.id && x.period_start === periodStart(type));
              const done = !!p?.completed_at;
              const pct = Math.min(1, (p?.progress ?? 0) / q.target);
              return (
                <Card key={q.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: done ? 0.7 : 1 }}>
                  <Text style={{ fontSize: 28 }}>{done ? '✅' : q.emoji ?? '🎯'}</Text>
                  <View style={{ flex: 1, gap: 6 }}>
                    <T v="h3">{q.title}</T>
                    {q.description ? <T v="small">{q.description}</T> : null}
                    <View style={{ height: 8, borderRadius: 999, backgroundColor: c.chip, overflow: 'hidden' }}>
                      <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: done ? brand.success : brand.purple }} />
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <T v="h3" color={brand.purple}>+{q.xp_reward}</T>
                    <T v="small">{Math.min(p?.progress ?? 0, q.target)}/{q.target}</T>
                  </View>
                </Card>
              );
            })}
          </View>
        );
      })}

      <SectionHeader title="Badges 🏅" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {badges.map((b) => {
          const got = mine.has(b.id);
          return (
            <View key={b.id} style={{ width: '31%', borderRadius: 20, padding: 12, alignItems: 'center', gap: 4, backgroundColor: c.card, borderWidth: 1, borderColor: got ? brand.purple : c.border, opacity: got ? 1 : 0.45 }}>
              <Text style={{ fontSize: 30 }}>{got ? b.emoji : '🔒'}</Text>
              <T v="small" style={{ textAlign: 'center' }} color={c.text}>{b.name}</T>
            </View>
          );
        })}
      </View>

      <SectionHeader title="This week's leaderboard 🥇" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip label="My campus" active={scope === 'campus'} onPress={() => setScope('campus')} />
        <Chip label="Nationwide" active={scope === 'all'} onPress={() => setScope('all')} />
      </View>
      <Card style={{ gap: 0, paddingVertical: 4 }}>
        {leaders.length === 0 && <T v="muted" style={{ padding: 12 }}>No XP earned this week yet — be #1 👀</T>}
        {leaders.map((l) => (
          <View key={l.user_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: l.is_me ? '#7B2FF712' : undefined, borderRadius: 12, paddingHorizontal: 6 }}>
            <T v="h3" style={{ width: 32 }}>{l.rank <= 3 ? ['🥇', '🥈', '🥉'][l.rank - 1] : `#${l.rank}`}</T>
            <View style={{ flex: 1 }}>
              <T v="h3">{l.display_name}{l.is_me ? ' (you)' : ''}</T>
              {scope === 'all' && l.campus_name ? <T v="small">{l.campus_name}</T> : null}
            </View>
            <T v="h3" color={brand.purple}>{l.xp} XP</T>
          </View>
        ))}
      </Card>
      <T v="small" style={{ textAlign: 'center' }}>Leaderboards reset every Monday.</T>
    </Screen>
  );
}
