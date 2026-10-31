import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Dimensions, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { brand } from '@/lib/theme';

const { width } = Dimensions.get('window');
const SLIDES = [
  { emoji: '💸', title: 'Save money on everything you love.', body: 'Coffee, food, fashion, gyms — student perks around your campus.' },
  { emoji: '📲', title: 'Find perks → Scan → Save instantly', body: 'Scan the Perkly QR on the cashier table, show the green screen, done.' },
  { emoji: '🔥', title: 'Earn XP, streaks & badges', body: 'Every redemption levels you up. Keep your streak alive!' },
];

export default function Welcome() {
  const [i, setI] = useState(0);
  const list = useRef<FlatList>(null);
  const last = i === SLIDES.length - 1;
  return (
    <LinearGradient colors={[brand.purple, brand.pink]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <Text style={{ color: '#fff', fontSize: 28, fontWeight: '900', textAlign: 'center', marginTop: 24 }}>Perkly</Text>
        <Text style={{ color: '#ffffffcc', textAlign: 'center', fontWeight: '600' }}>Unlock Perks. Live Smart.</Text>
        <FlatList
          ref={list}
          data={SLIDES}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setI(Math.round(e.nativeEvent.contentOffset.x / width))}
          keyExtractor={(s) => s.title}
          renderItem={({ item }) => (
            <View style={{ width, padding: 32, justifyContent: 'center', alignItems: 'center', gap: 16 }}>
              <Text style={{ fontSize: 96 }}>{item.emoji}</Text>
              <Text style={{ color: '#fff', fontSize: 30, fontWeight: '900', textAlign: 'center' }}>{item.title}</Text>
              <Text style={{ color: '#ffffffdd', fontSize: 16, textAlign: 'center', fontWeight: '500' }}>{item.body}</Text>
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
            title={last ? 'Get Started' : 'Next'}
            onPress={() => {
              if (last) router.push('/login');
              else { list.current?.scrollToIndex({ index: i + 1 }); setI(i + 1); }
            }}
          />
          {!last && (
            <Pressable onPress={() => router.push('/login')} style={{ padding: 12 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16, textAlign: 'center' }}>Skip</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
