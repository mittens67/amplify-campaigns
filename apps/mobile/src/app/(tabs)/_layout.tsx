import { useEffect } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, Compass, Home, Plus, UserRound } from 'lucide-react-native';
import { TabTour, TAB_BAR_BASE_HEIGHT } from '@/features/tour/TabTour';
import { useActivity } from '@/lib/queries';
import { useTour } from '@/lib/tour';
import { useSession } from '@/lib/session';
import { haptic } from '@/lib/haptics';
import { colors, fonts, shadow } from '@/ui';

export default function TabLayout() {
  const onboarded = useSession((s) => s.onboarded);
  const { data: activity } = useActivity();
  const unread = activity?.filter((n) => !n.read).length ?? 0;
  const insets = useSafeAreaInsets();
  const tourHydrated = useTour((s) => s.hydrated);
  // Offer a refresher tour to people returning after a long break.
  useEffect(() => {
    if (!tourHydrated) return;
    useTour.getState().checkIn();
    const sub = AppState.addEventListener('change', (state) => state === 'active' && useTour.getState().checkIn());
    return () => sub.remove();
  }, [tourHydrated]);
  if (!onboarded) return <Redirect href="/onboarding" />;

  return (
    <View style={{ flex: 1 }}>
    <Tabs
      screenListeners={{ tabPress: () => haptic('select') }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarLabelStyle: { fontFamily: fonts.sansMedium, fontSize: 11, marginTop: 2 },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: TAB_BAR_BASE_HEIGHT + insets.bottom, paddingTop: 6, paddingBottom: insets.bottom + 4 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color, focused }) => <Home size={22} color={color} strokeWidth={focused ? 2.4 : 1.8} /> }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore', tabBarIcon: ({ color, focused }) => <Compass size={22} color={color} strokeWidth={focused ? 2.4 : 1.8} /> }} />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Create',
          tabBarAccessibilityLabel: 'Create a campaign',
          tabBarIcon: ({ focused }) => (
            <View style={[styles.create, focused && { backgroundColor: colors.accentPressed }]}>
              <Plus size={22} color={colors.white} strokeWidth={2.6} />
            </View>
          ),
          tabBarLabel: () => null,
          tabBarButton: (props) => <Pressable {...(props as any)} style={[props.style, { alignItems: 'center', justifyContent: 'center' }]} />,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          tabBarBadge: unread > 0 ? (unread > 9 ? '9+' : unread) : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.accent, fontFamily: fonts.sansSemi, fontSize: 10 },
          tabBarIcon: ({ color, focused }) => <Bell size={22} color={color} strokeWidth={focused ? 2.4 : 1.8} />,
        }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, focused }) => <UserRound size={22} color={color} strokeWidth={focused ? 2.4 : 1.8} /> }} />
    </Tabs>
      <TabTour />
    </View>
  );
}

const styles = StyleSheet.create({
  create: { width: 48, height: 40, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginTop: 8, ...shadow.card },
});
