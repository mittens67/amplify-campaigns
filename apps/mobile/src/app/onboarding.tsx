import { useRef, useState } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Megaphone, PenLine, ShieldCheck, type LucideIcon } from 'lucide-react-native';
import { CURRENT_REACH_MODEL, quote } from '@amplify/domain';
import { ReachRings } from '@/features/home/ReachRings';
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
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const setOnboarded = useSession((s) => s.setOnboarded);
  const list = useRef<FlatList>(null);
  const [page, setPage] = useState(0);
  const finish = () => {
    setOnboarded();
    router.replace('/');
  };
  const q = quote(1000, CURRENT_REACH_MODEL.peoplePerAdDollar);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, space.lg) }}>
      <View style={styles.top}>
        <Text variant="overline" color={colors.accentText}>Amplify</Text>
        {page < PAGES.length - 1 ? <Button label="Skip" variant="ghost" size="sm" onPress={finish} /> : <View style={{ height: 36 }} />}
      </View>
      <FlatList
        ref={list}
        data={PAGES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(p) => p.title}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item, index }) => (
          <View style={{ width, paddingHorizontal: space.xl, justifyContent: 'center', gap: space.lg }}>
            <View style={styles.visual}>
              {index === 0 ? (
                <View style={styles.bigIcon}>
                  <item.icon size={44} color={colors.accent} strokeWidth={1.6} />
                </View>
              ) : index === 1 ? (
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
          </View>
        )}
      />
      <View style={styles.bottom}>
        <View style={styles.dots}>
          {PAGES.map((p, i) => (
            <View key={p.title} style={[styles.dot, i === page && styles.dotOn]} />
          ))}
        </View>
        <Button
          label={page === PAGES.length - 1 ? 'Start exploring' : 'Next'}
          onPress={() => (page === PAGES.length - 1 ? finish() : list.current?.scrollToIndex({ index: page + 1 }))}
          full
          size="lg"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.xl, height: 52 },
  visual: { height: 260, alignItems: 'center', justifyContent: 'center' },
  bigIcon: { width: 120, height: 120, borderRadius: 60, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  layer: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.successSoft },
  bottom: { paddingHorizontal: space.xl, gap: space.lg },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotOn: { width: 24, backgroundColor: colors.ink },
});
