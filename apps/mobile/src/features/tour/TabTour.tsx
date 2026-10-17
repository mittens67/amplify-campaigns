import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, Compass, Home, Plus, Sparkles, UserRound, X, type LucideIcon } from 'lucide-react-native';
import { haptic } from '@/lib/haptics';
import { useTour } from '@/lib/tour';
import { Button, colors, IconButton, radius, Row, shadow, space, Text } from '@/ui';

/** Must match the tab bar in app/(tabs)/_layout.tsx. */
export const TAB_BAR_BASE_HEIGHT = 66;

const STEPS: { tab: number; href: string; icon: LucideIcon; title: string; body: string }[] = [
  { tab: 0, href: '/', icon: Home, title: 'Home', body: 'Start here. See what a contribution can reach, how Create → Review → Amplify works, and featured campaigns.' },
  { tab: 1, href: '/explore', icon: Compass, title: 'Explore', body: 'Search every reviewed campaign. Filter by topic, by stage (funding, ads running, completed) or by who’s behind it.' },
  { tab: 2, href: '/create', icon: Plus, title: 'Create', body: 'Turn a message into a campaign in 5 steps — type it or talk it through. Drafts save automatically, so you can stop any time.' },
  { tab: 3, href: '/activity', icon: Bell, title: 'Activity', body: 'Review decisions, funding milestones, when ads go live and final reports — for campaigns you back and ones you create.' },
  { tab: 4, href: '/profile', icon: UserRound, title: 'Profile', body: 'Your campaigns, backed campaigns and receipts. Try the demo accounts here to see the creator, backer and reviewer sides.' },
];

export function TabTour() {
  const { tourOpen, tourReason, endTour, showChecklist } = useTour();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (tourOpen) setStep(0);
  }, [tourOpen]);
  // Switch to the tab being explained, so what's behind the spotlight matches the words.
  useEffect(() => {
    if (tourOpen && step < STEPS.length) router.navigate(STEPS[step].href as any);
  }, [tourOpen, step, router]);

  if (!tourOpen) return null;
  const last = STEPS.length; // final summary card
  const go = (n: number) => {
    haptic('select');
    setStep(Math.max(0, Math.min(last, n)));
  };
  const finish = (toChecklist: boolean) => {
    endTour();
    if (toChecklist) {
      showChecklist();
      router.navigate('/');
    }
  };

  // Spotlight rectangle around the current tab.
  const barH = TAB_BAR_BASE_HEIGHT + insets.bottom;
  const tabW = width / 5;
  const contentTop = height - barH + 6;
  const contentBottom = height - insets.bottom - 4;
  const hole = { x: step * tabW + 4, y: contentTop - 2, w: tabW - 8, h: contentBottom - contentTop + 4 };
  const isSummary = step === last;
  const s = STEPS[Math.min(step, STEPS.length - 1)];
  const arrowX = Math.min(Math.max(hole.x + hole.w / 2 - 8, space.lg + 12), width - space.lg - 28);

  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Dimmed backdrop with a cut-out for the highlighted tab */}
      {isSummary ? (
        <Pressable style={[StyleSheet.absoluteFill, styles.dim]} onPress={() => undefined} accessible={false} />
      ) : (
        <>
          <View style={[styles.dim, { position: 'absolute', left: 0, right: 0, top: 0, height: hole.y }]} />
          <View style={[styles.dim, { position: 'absolute', left: 0, right: 0, top: hole.y + hole.h, bottom: 0 }]} />
          <View style={[styles.dim, { position: 'absolute', left: 0, width: hole.x, top: hole.y, height: hole.h }]} />
          <View style={[styles.dim, { position: 'absolute', left: hole.x + hole.w, right: 0, top: hole.y, height: hole.h }]} />
          <View pointerEvents="none" style={[styles.ring, { left: hole.x, top: hole.y, width: hole.w, height: hole.h }]} />
        </>
      )}

      {isSummary ? (
        <Animated.View key="summary" entering={FadeIn.duration(220)} style={[styles.card, styles.center, { top: height * 0.22 }]} accessibilityViewIsModal>
          <View style={styles.badge}>
            <Sparkles size={22} color={colors.accent} />
          </View>
          <Text variant="title">You’re ready</Text>
          <Text variant="body" color={colors.textMuted}>
            One thing to remember: backing a campaign pays for ads that carry a reviewed message to new people. It isn’t a donation to the cause, and you can always see where every dollar goes.
          </Text>
          <Text variant="label">The Get started checklist on Home walks you through each part by doing it. You can replay this tour from Profile → Help any time.</Text>
          <View style={{ gap: space.sm, marginTop: space.xs }}>
            <Button label="Show me the checklist" onPress={() => finish(true)} full />
            <Button label="I’ll explore on my own" variant="ghost" onPress={() => finish(false)} full />
          </View>
        </Animated.View>
      ) : (
        <Animated.View key={step} entering={FadeIn.duration(180)} style={[styles.card, { left: space.lg, right: space.lg, bottom: barH + 18 }]} accessibilityViewIsModal accessibilityLiveRegion="polite">
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="overline" color={colors.accentText}>
              {tourReason === 'returning' && step === 0 ? 'Welcome back · ' : ''}Tour · {step + 1} of {STEPS.length}
            </Text>
            <IconButton icon={<X size={18} color={colors.textMuted} />} label="Close tour" size={32} onPress={() => finish(false)} />
          </Row>
          <Row gap={space.sm}>
            <s.icon size={20} color={colors.ink} />
            <Text variant="title">{s.title}</Text>
          </Row>
          <Text variant="body" color={colors.text}>{s.body}</Text>
          <Row gap={space.sm} style={{ marginTop: space.xs }}>
            {step > 0 ? <Button label="Back" variant="secondary" onPress={() => go(step - 1)} style={{ flex: 1 }} /> : <Button label="Skip tour" variant="ghost" onPress={() => finish(false)} style={{ flex: 1 }} />}
            <Button label={step === STEPS.length - 1 ? 'Finish' : 'Next'} onPress={() => go(step + 1)} style={{ flex: 1 }} />
          </Row>
          <View style={[styles.arrow, { left: arrowX - space.lg }]} />
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dim: { backgroundColor: 'rgba(15, 23, 42, 0.62)' },
  ring: { position: 'absolute', borderRadius: radius.lg, borderWidth: 2, borderColor: colors.white },
  card: { position: 'absolute', backgroundColor: colors.surface, borderRadius: radius.xl, padding: space.lg, gap: space.sm, ...shadow.raised },
  center: { left: space.lg, right: space.lg },
  badge: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  arrow: { position: 'absolute', bottom: -8, width: 16, height: 16, backgroundColor: colors.surface, transform: [{ rotate: '45deg' }] },
});
