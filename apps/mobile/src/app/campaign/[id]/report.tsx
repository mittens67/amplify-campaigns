import { ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { BarChart3 } from 'lucide-react-native';
import { estimateReach, normalizeContent, reachModel } from '@amplify/domain';
import { ReportBody } from '@/features/campaign/ReportBody';
import { longDate } from '@/lib/format';
import { useCampaign } from '@/lib/queries';
import { colors, EmptyState, ErrorState, ScreenHeader, Skeleton, space, Text } from '@/ui';

export default function ReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useCampaign(id);
  const c = q.data;
  const final = c?.status === 'completed';
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={final ? 'Final report' : 'Delivery report'} subtitle={c?.title} />
      {q.isPending ? (
        <View style={{ padding: space.lg, gap: space.md }}>
          <Skeleton height={180} radius={20} />
          <Skeleton height={220} radius={20} />
        </View>
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : !c?.delivery ? (
        <EmptyState icon={BarChart3} title="No delivery yet" body="Reports appear once ads start running. You’ll be notified when there’s data." />
      ) : (
        <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxxl }}>
          <Text variant="label">
            {final ? 'Ad run complete' : 'Ad run in progress'}
            {c.publishedAt ? ` · Published ${longDate(c.publishedAt)}` : ''}
          </Text>
          <ReportBody
            final={final}
            n={{
              raisedCents: c.raisedCents,
              spentCents: c.delivery.spendCents,
              impressions: c.delivery.impressions,
              reach: c.delivery.reach,
              clicks: c.delivery.clicks,
              estReach: estimateReach(c.raisedCents, reachModel(c.reachModelVersion)),
              days: c.delivery.days,
              durationDays: normalizeContent(c.content).reach.durationDays,
              contributedCents: c.viewer.contributedCents,
              backerCount: c.backerCount,
            }}
          />
        </ScrollView>
      )}
    </View>
  );
}
