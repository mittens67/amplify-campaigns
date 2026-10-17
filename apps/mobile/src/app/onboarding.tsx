import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Megaphone, PenLine, ShieldCheck, type LucideIcon } from 'lucide-react-native';
import { CURRENT_REACH_MODEL, quote } from '@amplify/domain';
import { ReachRings } from '@/features/home/ReachRings';
import { haptic } from '@/lib/haptics';
import { useSession } from '@/lib/session';
import { Button, colors, MoneyFlow, radius, space, Text } from '@/ui';

const PAGES: { icon: LucideIcon; overline: string; title: string; body: string }[] = [
  {
    icon: PenLine,
    overline: '1 · Create',
    title: 'Important messages deserve to travel further',
    body: 'People, nonprofits and community groups write a campaign: a clear, sourced message they want more people to see.',
  },
  {
    icon: ShieldCheck,
    overline: '2 · Review',
    title: 'Every campaign is reviewed first',
    body: 'Reviewers check the facts, the framing and the ad creative before anything can be funded. Sources stay visible to everyone.',
  },
  {
    icon: Megaphone,
    overline: '3 · Amplify',
    title: 'Your contribution buys reach, not a donation',
    body: 'Backers pool money for ads that carry the message to people outside the creator’s network. You see where every dollar goes.',
  },
];

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const setOnboarded = useSession((s) => s.setOnboarded);
  const [page, setPage] = useState(0);
  const last = PAGES.length - 1;
  const finish = () => {
    setOnboarded();
    router.replace('/');
  };
  const go = (i: number) => {
    const next = Math.max(0, Math.min(last, i));
    if (next !== page) {
      haptic('select');
      setPage(next);
    }
  };
  const q = quote(1000, CURRENT_REACH_MODEL.peoplePerAdDollar);
  const item = PAGES[page];

  // Swipe left/right to change page. Works on touch screens and with a mouse on web.
  const swipe = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-25, 25])
    .runOnJS(true)
    .onEnd((e) => {
      if (e.translationX < -50 || e.velocityX < -500) go(page + 1);
      else if (e.translationX > 50 || e.velocityX > 500) go(page - 1);
    });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, space.lg) }}>
      <View style={styles.top}>
        {page > 0 ? <Button label="Back" variant="ghost" size="sm" onPress={() => go(page - 1)} /> : <Text variant="overline" color={colors.accentText}>Amplify</Text>}
        {page < last ? <Button label="Skip" variant="ghost" size="sm" onPress={finish} /> : <View style={{ height: 36 }} />}
      </View>
      <GestureDetector gesture={swipe}>
        <View style={{ flex: 1 }}>
          <Animated.View key={page} entering={FadeIn.duration(220)} style={styles.page} accessibilityLiveRegion="polite">
            <View style={styles.visual}>
              {page === 0 ? (
                <View style={styles.bigIcon}>
                  <item.icon size={44} color={colors.accent} strokeWidth={1.6} />
                </View>
              ) : page === 1 ? (
                <View style={{ gap: space.sm, width: '100%' }}>
                  {['Fact-Check', 'Communication Integrity', 'Shared Reality'].map((l) => (
                    <View key={l} style={styles.layer}>
                      <ShieldCheck size={18} color={colors.success} />
                      <Text variant="bodyStrong">{l}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={{ alignItems: 'center', gap: space.lg, width: '100%' }}>
                  <ReachRings dollars={60} />
                  <View style={{ width: '100%' }}>
                    <Text variant="label" style={{ marginBottom: space.sm }}>Where $10 goes</Text>
                    <MoneyFlow quote={q} compact />
                    <Text variant="caption" style={{ marginTop: space.sm }}>$8 buys ads · $2 platform fee · ≈{q.estReach} people (estimate)</Text>
                  </View>
                </View>
              )}
            </View>
            <Text variant="overline" color={colors.accentText}>{item.overline}</Text>
            <Text variant="display">{item.title}</Text>
            <Text variant="body" color={colors.textMuted} style={{ fontSize: 16, lineHeight: 24 }}>{item.body}</Text>
          </Animated.View>
        </View>
      </GestureDetector>
      <View style={styles.bottom}>
        <View style={styles.dots} accessibilityRole="tablist">
          {PAGES.map((p, i) => (
            <Pressable
              key={p.title}
              onPress={() => go(i)}
              hitSlop={10}
              accessibilityRole="tab"
              accessibilityLabel={`Page ${i + 1} of ${PAGES.length}`}
              accessibilityState={{ selected: i === page }}
            >
              <View style={[styles.dot, i === page && styles.dotOn]} />
            </Pressable>
          ))}
        </View>
        <Button label={page === last ? 'Start exploring' : 'Next'} onPress={() => (page === last ? finish() : go(page + 1))} full size="lg" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.xl, height: 52 },
  page: { flex: 1, paddingHorizontal: space.xl, justifyContent: 'center', gap: space.lg },
  visual: { height: 260, alignItems: 'center', justifyContent: 'center' },
  bigIcon: { width: 120, height: 120, borderRadius: 60, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  layer: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.successSoft },
  bottom: { paddingHorizontal: space.xl, gap: space.lg },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotOn: { width: 24, backgroundColor: colors.ink },
});
