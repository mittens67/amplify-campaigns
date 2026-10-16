import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Img as Image } from '@/ui/Img';
import { useRouter } from 'expo-router';
import { HandCoins } from 'lucide-react-native';
import { formatMoney, nextStepCopy, type ContributionDTO } from '@amplify/domain';
import { useMyContributions } from '@/lib/queries';
import { colors, EmptyState, ErrorState, Estimate, JourneyRail, Measured, radius, Row, ScreenHeader, Skeleton, space, StatusPill, Text } from '@/ui';

/** One row per campaign, summing a backer's successful contributions. */
function group(list: ContributionDTO[]) {
  const map = new Map<string, { c: ContributionDTO; total: number; est: number; attributed: number | null }>();
  for (const k of list.filter((x) => ['succeeded', 'refund_pending', 'refunded'].includes(x.status))) {
    const g = map.get(k.campaignId);
    if (g) {
      g.total += k.amountCents;
      g.est += k.estReach;
      g.attributed = k.attributedReach != null ? (g.attributed ?? 0) + k.attributedReach : g.attributed;
    } else map.set(k.campaignId, { c: k, total: k.amountCents, est: k.estReach, attributed: k.attributedReach });
  }
  return [...map.values()];
}

export default function Backed() {
  const router = useRouter();
  const q = useMyContributions();
  const items = group(q.data ?? []);
  const totalReached = items.reduce((s, g) => s + (g.attributed ?? 0), 0);
  const totalGiven = items.reduce((s, g) => s + g.total, 0);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Backed campaigns" />
      {q.isPending ? (
        <View style={{ padding: space.lg, gap: space.md }}>
          <Skeleton height={100} radius={20} />
          <Skeleton height={140} radius={20} />
        </View>
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(g) => g.c.campaignId}
          contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxxl }}
          ListHeaderComponent={
            items.length ? (
              <View style={styles.summary}>
                <Text variant="overline" color={colors.accentText}>Your impact</Text>
                <Row gap={space.xl}>
                  <View>
                    <Text variant="number">{formatMoney(totalGiven)}</Text>
                    <Text variant="caption">contributed to distribution</Text>
                  </View>
                  <View>
                    <Text variant="number">{totalReached.toLocaleString()}</Text>
                    <Text variant="caption">people reached on your behalf</Text>
                  </View>
                </Row>
                <Text variant="caption">“Reached on your behalf” is your share of each campaign’s measured reach, based on how much you contributed.</Text>
              </View>
            ) : undefined
          }
          renderItem={({ item: g }) => (
            <Pressable onPress={() => router.push({ pathname: '/campaign/[id]', params: { id: g.c.campaignId } })} style={styles.card} accessibilityRole="button">
              <Row gap={space.md} align="flex-start">
                <Image source={g.c.campaignCoverUrl} style={styles.thumb} contentFit="cover" />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text variant="bodyStrong" numberOfLines={2}>{g.c.campaignTitle}</Text>
                  <StatusPill status={g.c.campaignStatus} />
                </View>
              </Row>
              <JourneyRail status={g.c.campaignStatus} dense />
              <Row style={{ justifyContent: 'space-between' }}>
                <Text variant="label">You contributed <Text variant="label" weight="semi" color={colors.ink}>{formatMoney(g.total)}</Text></Text>
                {g.attributed != null ? <Measured value={g.attributed} variant="label" /> : <Estimate value={g.est} variant="label" />}
              </Row>
              <Text variant="caption">{g.c.status === 'refund_pending' ? 'Refund in progress' : g.c.status === 'refunded' ? 'Refunded' : nextStepCopy(g.c.campaignStatus)}</Text>
            </Pressable>
          )}
          ListEmptyComponent={<EmptyState icon={HandCoins} title="You haven’t backed a campaign yet" body="When you do, you’ll follow its progress here — from funding to the final report." action="Explore campaigns" onAction={() => router.push('/explore')} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { backgroundColor: colors.accentSoft, borderRadius: radius.xl, padding: space.lg, gap: space.md, marginBottom: space.xs },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: space.lg, gap: space.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
});
