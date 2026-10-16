import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { Megaphone, PenLine, ShieldCheck } from 'lucide-react-native';
import { CURRENT_REACH_MODEL, peoplePerContributedDollar, quote } from '@amplify/domain';
import { CampaignCard } from '@/features/campaign/CampaignCard';
import { ReachRings } from '@/features/home/ReachRings';
import { useFeed } from '@/lib/queries';
import { haptic } from '@/lib/haptics';
import { Button, CardSkeleton, colors, ErrorState, Estimate, MoneyFlow, openGlossary, radius, SectionHeader, shadow, space, Text } from '@/ui';

const STEPS = [
  { icon: PenLine, title: 'Create', body: 'A creator writes the message, cites sources and designs the ads.' },
  { icon: ShieldCheck, title: 'Review', body: 'Reviewers check facts, framing and fairness before anything is funded.' },
  { icon: Megaphone, title: 'Amplify', body: 'Backers fund ads that carry it to people outside the creator’s network.' },
];

function ReachExplainer() {
  const [dollars, setDollars] = useState(25);
  const q = quote(dollars * 100, CURRENT_REACH_MODEL.peoplePerAdDollar);
  return (
    <View style={styles.reachCard}>
      <Text variant="overline">What a contribution does</Text>
      <View style={styles.reachRow}>
        <ReachRings dollars={dollars} />
        <View style={{ flex: 1, gap: space.xs }}>
          <Text variant="label">If you back with</Text>
          <Text style={styles.reachAmount}>${dollars}</Text>
          <Text variant="label">it could reach</Text>
          <Estimate value={q.estReach} variant="heading" compact={false} />
          <Text variant="caption">people outside the creator’s network</Text>
        </View>
      </View>
      <Slider
        minimumValue={5}
        maximumValue={100}
        step={5}
        value={dollars}
        onValueChange={(v) => {
          if (v !== dollars) haptic('select');
          setDollars(v);
        }}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.accent}
        accessibilityLabel="Contribution amount"
        accessibilityValue={{ min: 5, max: 100, now: dollars, text: `$${dollars}` }}
      />
      <MoneyFlow quote={q} compact />
      <Pressable onPress={() => openGlossary('estimatedReach')} accessibilityRole="button">
        <Text variant="caption">
          {`$${q.adBudgetCents / 100} buys ads · $${q.platformFeeCents / 100} platform fee. Illustrative estimate (≈${peoplePerContributedDollar()} people per $1) — not a guarantee. `}
          <Text variant="caption" color={colors.accent} weight="semi">How estimates work</Text>
        </Text>
      </Pressable>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const featured = useFeed({ featured: true, limit: 6 });
  const feed = useFeed({ sort: 'trending', limit: 10 });
  const [refreshing, setRefreshing] = useState(false);
  const featuredItems = featured.data?.pages.flatMap((p) => p.items) ?? [];
  const feedItems = (feed.data?.pages.flatMap((p) => p.items) ?? []).filter((c) => !c.featured);

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([featured.refetch(), feed.refetch()]);
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingBottom: space.xxxl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} colors={[colors.accent]} />}
    >
      {/* Hero */}
      <View style={[styles.hero, { paddingTop: insets.top + space.lg }]}>
        <Text variant="overline" color={colors.accentText}>Community-funded reach</Text>
        <Text variant="display" style={styles.heroTitle} accessibilityRole="header">
          Help important messages reach people outside your bubble.
        </Text>
        <Text variant="body" color={colors.textMuted}>
          Creators share a reviewed, sourced message. Backers pool money for the ads that carry it further — it’s not a donation to the cause.
        </Text>
        <View style={styles.heroCtas}>
          <Button label="Explore campaigns" onPress={() => router.push('/explore')} style={{ flex: 1 }} />
          <Button label="Start a campaign" variant="secondary" onPress={() => router.push('/create')} style={{ flex: 1 }} />
        </View>
        <ReachExplainer />
      </View>

      {/* How it works */}
      <View style={styles.section}>
        <SectionHeader title="Create → Review → Amplify" action="How it works" onAction={() => router.push('/info/how-it-works')} />
        <View style={{ gap: space.sm }}>
          {STEPS.map((s, i) => (
            <Pressable key={s.title} onPress={() => router.push('/info/how-it-works')} style={styles.step} accessibilityRole="button">
              <View style={styles.stepNum}>
                <s.icon size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{`${i + 1}. ${s.title}`}</Text>
                <Text variant="label">{s.body}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Featured */}
      <View style={[styles.section, { paddingHorizontal: 0 }]}>
        <View style={{ paddingHorizontal: space.lg }}>
          <SectionHeader title="Featured" subtitle="Reviewed and open for backing" action="See all" onAction={() => router.push('/explore')} />
        </View>
        {featured.isPending ? (
          <View style={{ paddingHorizontal: space.lg }}>
            <CardSkeleton />
          </View>
        ) : featured.isError ? (
          <ErrorState error={featured.error} onRetry={featured.refetch} compact />
        ) : (
          <FlatList
            horizontal
            data={featuredItems}
            keyExtractor={(c) => c.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.md, paddingBottom: space.sm }}
            snapToInterval={260 + space.md}
            decelerationRate="fast"
            renderItem={({ item }) => <CampaignCard c={item} variant="compact" />}
          />
        )}
      </View>

      {/* Feed */}
      <View style={styles.section}>
        <SectionHeader title="Campaign feed" subtitle="From individuals, nonprofits and community groups" />
        {feed.isPending ? (
          <View style={{ gap: space.lg }}>
            <CardSkeleton />
            <CardSkeleton />
          </View>
        ) : feed.isError ? (
          <ErrorState error={feed.error} onRetry={feed.refetch} />
        ) : (
          <View style={{ gap: space.lg }}>
            {feedItems.map((c) => (
              <CampaignCard key={c.id} c={c} />
            ))}
            <Button label="Explore all campaigns" variant="secondary" onPress={() => router.push('/explore')} full />
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: space.lg, gap: space.md, paddingBottom: space.xl, backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  heroTitle: { fontSize: 32, lineHeight: 38 },
  heroCtas: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  reachCard: { marginTop: space.md, backgroundColor: colors.bg, borderRadius: radius.xl, padding: space.lg, gap: space.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  reachRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  reachAmount: { fontFamily: 'SourceSerif4_700Bold', fontSize: 36, lineHeight: 40, color: colors.ink },
  section: { paddingHorizontal: space.lg, paddingTop: space.xl },
  step: { flexDirection: 'row', gap: space.md, alignItems: 'center', backgroundColor: colors.surface, padding: space.md, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...shadow.card },
  stepNum: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
});
