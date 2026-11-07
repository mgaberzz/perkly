import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, Pressable, View, useWindowDimensions } from 'react-native';
import { Text } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { brand } from '@/lib/theme';
import { lang, setLanguage, t } from '@/lib/i18n';

const SLIDES = [
  { emoji: '💸', title: 'Save money on everything you love.', body: 'Coffee, food, fashion, gyms — student perks around your campus.' },
  { emoji: '📲', title: 'Find perks → Scan → Save instantly', body: 'Scan the Perkly QR on the cashier table, show the green screen, done.' },
  { emoji: '🔥', title: 'Earn XP, streaks & badges', body: 'Every redemption levels you up. Keep your streak alive!' },
];

export default function Welcome() {
  const { width, height } = useWindowDimensions();
  const [i, setI] = useState(0);
  const list = useRef<FlatList>(null);
  const last = i === SLIDES.length - 1;
  return (
    <LinearGradient colors={[brand.purple, brand.pink]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <Pressable onPress={() => setLanguage(lang() === 'ar' ? 'en' : 'ar')} hitSlop={10}
          style={{ alignSelf: 'flex-end', marginEnd: 20, marginTop: 8, backgroundColor: '#ffffff26', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 }}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>🌐 {lang() === 'ar' ? 'English' : 'العربية'}</Text>
        </Pressable>
        <Text style={{ color: '#fff', fontSize: 28, fontWeight: '900', textAlign: 'center', marginTop: 8 }}>Perkly</Text>
        <Text style={{ color: '#ffffffcc', textAlign: 'center', fontWeight: '600' }}>{t('Unlock Perks. Live Smart.')}</Text>
        <FlatList
          ref={list}
          data={SLIDES}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setI(Math.round(e.nativeEvent.contentOffset.x / width))}
          keyExtractor={(s) => s.title}
          renderItem={({ item }) => (
            <View style={{ width, padding: width < 360 ? 20 : 32, justifyContent: 'center', alignItems: 'center', gap: 16 }}>
              <Text style={{ fontSize: Math.min(96, height * 0.11) }}>{item.emoji}</Text>
              <Text style={{ color: '#fff', fontSize: width < 360 ? 24 : 30, fontWeight: '900', textAlign: 'center' }}>{t(item.title)}</Text>
              <Text style={{ color: '#ffffffdd', fontSize: 16, textAlign: 'center', fontWeight: '500' }}>{t(item.body)}</Text>
            </View>
          )}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
          {SLIDES.map((s, idx) => (
            <View key={s.title} style={{ height: 8, width: idx === i ? 24 : 8, borderRadius: 4, backgroundColor: idx === i ? '#fff' : '#ffffff66' }} />
          ))}
        </View>
        <View style={{ paddingHorizontal: 24, paddingBottom: 24, gap: 12 }}>
          <Button
            variant="white"
            title={last ? t('Get Started') : t('Next')}
            onPress={() => {
              if (last) router.push('/login');
              else { list.current?.scrollToIndex({ index: i + 1 }); setI(i + 1); }
            }}
          />
          {!last && (
            <Pressable onPress={() => router.push('/login')} style={{ padding: 12 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16, textAlign: 'center' }}>{t('Skip')}</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
