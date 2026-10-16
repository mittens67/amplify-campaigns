import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Img as Image } from '@/ui/Img';
import { useRouter } from 'expo-router';
import { FolderOpen, MessageSquareWarning } from 'lucide-react-native';
import { formatMoney, nextStepCopy, percentFunded, type CampaignStatus } from '@amplify/domain';
import { timeLeft } from '@/lib/format';
import { useMyCampaigns, type MyCampaign } from '@/lib/queries';
import { Button, Chip, colors, EmptyState, ErrorState, Estimate, JourneyRail, ProgressBar, radius, Row, ScreenHeader, shadow, Skeleton, space, StatusPill, Text } from '@/ui';

const FILTERS: { key: string; label: string; statuses: CampaignStatus[] }[] = [
  { key: 'all', label: 'All', statuses: [] },
  { key: 'drafts', label: 'Drafts', statuses: ['draft'] },
  { key: 'action', label: 'Requires action', statuses: ['changes_requested'] },
  { key: 'review', label: 'Under review', statuses: ['submitted'] },
  { key: 'funding', label: 'Funding', statuses: ['approved', 'available_for_funding', 'goal_reached', 'funding_ended', 'distribution_preparation'] },
  { key: 'promoting', label: 'Promoting', statuses: ['promoting'] },
  { key: 'completed', label: 'Completed', statuses: ['completed', 'rejected', 'failed', 'refund_pending', 'refunded', 'cancelled'] },
];

function Row_({ c }: { c: MyCampaign }) {
  const router = useRouter();
  const open = () =>
    ['draft', 'changes_requested'].includes(c.status)
      ? router.push({ pathname: '/create/[id]', params: { id: c.id } })
      : router.push({ pathname: '/me/campaign/[id]', params: { id: c.id } });
  const p = percentFunded(c.raisedCents, c.goalCents);
  return (
    <Pressable onPress={open} style={({ pressed }) => [styles.card, pressed && { opacity: 0.94 }]} accessibilityRole="button" accessibilityLabel={c.title}>
      <Row gap={space.md} align="flex-start">
        {c.coverUrl ? <Image source={c.coverUrl} style={styles.thumb} contentFit="cover" /> : <View style={[styles.thumb, { backgroundColor: colors.surfaceAlt }]} />}
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="bodyStrong" numberOfLines={2}>{c.title}</Text>
          <StatusPill status={c.status} />
        </View>
      </Row>
      {c.status === 'changes_requested' ? (
        <View style={styles.action}>
          <MessageSquareWarning size={16} color={colors.warning} />
          <Text variant="label" color={colors.text} style={{ flex: 1 }} numberOfLines={2}>{c.reviewerMessage ?? 'Reviewers requested changes.'}</Text>
        </View>
      ) : null}
      {c.status !== 'draft' ? <JourneyRail status={c.status} dense /> : null}
      {c.goalCents > 0 && !['draft', 'submitted', 'changes_requested'].includes(c.status) ? (
        <View style={{ gap: 6 }}>
          <ProgressBar value={p} height={6} />
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="caption" color={colors.text}>{formatMoney(c.raisedCents)} of {formatMoney(c.goalCents)} · {p}%</Text>
            {c.status === 'available_for_funding' ? <Text variant="caption">{timeLeft(c.fundingEndsAt)}</Text> : <Estimate value={c.estReachAtGoal} variant="caption" glossary={null} />}
          </Row>
        </View>
      ) : null}
      <Text variant="caption" color={colors.textMuted}>{nextStepCopy(c.status)}</Text>
    </Pressable>
  );
}

export default function MyCampaigns() {
  const router = useRouter();
  const q = useMyCampaigns();
  const [filter, setFilter] = useState('all');
  const items = q.data ?? [];
  const f = FILTERS.find((x) => x.key === filter)!;
  const shown = f.statuses.length ? items.filter((c) => f.statuses.includes(c.status)) : items;
  const count = (k: string) => {
    const s = FILTERS.find((x) => x.key === k)!.statuses;
    return s.length ? items.filter((c) => s.includes(c.status)).length : items.length;
  };
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Your campaigns" right={<Button label="New" size="sm" variant="ghost" onPress={() => router.push('/create')} />} />
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: space.lg, gap: space.sm }}>
          {FILTERS.map((x) => (
            <Chip key={x.key} label={x.label} count={count(x.key) || undefined} selected={filter === x.key} onPress={() => setFilter(x.key)} />
          ))}
        </ScrollView>
      </View>
      {q.isPending ? (
        <View style={{ paddingHorizontal: space.lg, gap: space.md }}>
          <Skeleton height={150} radius={20} />
          <Skeleton height={150} radius={20} />
        </View>
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxxl, gap: space.md }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.accent} colors={[colors.accent]} />}
          renderItem={({ item }) => <Row_ c={item} />}
          ListEmptyComponent={
            <EmptyState
              icon={FolderOpen}
              title={items.length ? 'Nothing in this view' : 'No campaigns yet'}
              body={items.length ? 'Try another filter.' : 'Campaigns you create — drafts, reviews, funding and reports — live here.'}
              action={items.length ? 'Show all' : 'Start a campaign'}
              onAction={() => (items.length ? setFilter('all') : router.push('/create'))}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: space.lg, gap: space.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...shadow.card },
  thumb: { width: 64, height: 64, borderRadius: radius.md },
  action: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start', backgroundColor: colors.warningSoft, padding: space.md, borderRadius: radius.md },
});
