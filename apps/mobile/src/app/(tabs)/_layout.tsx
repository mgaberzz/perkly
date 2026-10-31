import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';
import { onboardingStep, useSession } from '@/lib/session';
import { brand, gradient, useTheme } from '@/lib/theme';

const icon = (emoji: string) => ({ focused }: { focused: boolean }) => (
  <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.55 }}>{emoji}</Text>
);

export default function TabsLayout() {
  const { session, profile } = useSession();
  const { c } = useTheme();
  if (!session) return <Redirect href="/welcome" />;
  const step = onboardingStep(profile);
  if (step) return <Redirect href={step} />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: brand.purple,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { backgroundColor: c.card, borderTopColor: c.border, height: 84, paddingTop: 6 },
        tabBarLabelStyle: { fontWeight: '700', fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('🏠') }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore', tabBarIcon: icon('🧭') }} />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan & Save',
          tabBarIcon: () => (
            <LinearGradient colors={gradient} style={{ width: 58, height: 58, borderRadius: 29, marginTop: -26, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: c.card }}>
              <View><Text style={{ fontSize: 24 }}>📷</Text></View>
            </LinearGradient>
          ),
          tabBarLabelStyle: { fontWeight: '900', fontSize: 11, color: brand.purple },
        }}
      />
      <Tabs.Screen name="rewards" options={{ title: 'Rewards', tabBarIcon: icon('🏆') }} />
      <Tabs.Screen name="profile" options={{ title: 'Me', tabBarIcon: icon('😎') }} />
    </Tabs>
  );
}
