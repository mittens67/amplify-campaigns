import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Flag, Gauge, Inbox } from 'lucide-react-native';
import { formatMoney, nextStepCopy } from '@amplify/domain';
import { api, errorMessage } from '@/lib/api';
import { relativeTime } from '@/lib/format';
import { queryClient, useReviewCounts, useReviewQueue } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { Button, Chip, colors, EmptyState, ErrorState, IconButton, Pill, radius, Row, ScreenHeader, Skeleton, space, StatusPill, Text, toast } from '@/ui';

const TABS = [
  { key: 'submitted', label: 'Awaiting review' },
  { key: 'funded', label: 'Ready to launch' },
  { key: 'live', label: 'Live' },
  { key: 'changes', label: 'With creator' },
  { key: 'closed', label: 'Closed' },
  { key: 'reports', label: 'Reports' },
];

export default function ReviewQueue() {
  const router = useRouter();
  const user = useSession((s) => s.user);
  const [tab, setTab] = useState('submitted');
  const q = useReviewQueue(tab);
  const counts = useReviewCounts();

  if (user?.role !== 'reviewer') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenHeader title="Review" />
        <EmptyState icon={Inbox} title="Reviewer access only" body="Sign in with the reviewer demo account to see the review console." action="Switch account" onAction={() => router.push('/sign-in')} />
      </View>
    );
  }

  const resolve = async (id: string) => {
    try {
      await api(`/review/reports/${id}/resolve`, { method: 'POST' });
      void queryClient.invalidateQueries({ queryKey: ['review'] });
      toast.success('Report resolved');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Review console" right={<IconButton icon={<Gauge size={20} color={colors.ink} />} label="Demo controls" onPress={() => router.push('/review/demo')} />} />
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: space.lg, gap: space.sm }}>
          {TABS.map((t) => (
            <Chip key={t.key} label={t.label} count={counts.data?.[t.key] || undefined} selected={tab === t.key} onPress={() => setTab(t.key)} />
          ))}
        </ScrollView>
      </View>
      {q.isPending ? (
        <View style={{ paddingHorizontal: space.lg, gap: space.md }}>
          <Skeleton height={96} radius={16} />
          <Skeleton height={96} radius={16} />
        </View>
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : (
        <FlatList
          data={q.data}
          keyExtractor={(x) => x.id}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxxl, gap: space.sm }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { void q.refetch(); void counts.refetch(); }} tintColor={colors.accent} colors={[colors.accent]} />}
          renderItem={({ item }) =>
            tab === 'reports' ? (
              <View style={styles.row}>
                <Flag size={18} color={item.resolved ? colors.textSubtle : colors.danger} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="label" weight="semi" color={colors.ink} numberOfLines={1}>{item.campaignTitle}</Text>
                  <Text variant="caption">{item.reason} · {relativeTime(item.at)}</Text>
                  {item.details ? <Text variant="caption" color={colors.text}>“{item.details}”</Text> : null}
                  <Row gap={space.sm} style={{ marginTop: 4 }}>
                    <Button label="Open campaign" size="sm" variant="secondary" onPress={() => router.push({ pathname: '/review/[id]', params: { id: item.campaignId } })} />
                    {!item.resolved ? <Button label="Resolve" size="sm" variant="ghost" onPress={() => resolve(item.id)} /> : <Pill label="Resolved" />}
                  </Row>
                </View>
              </View>
            ) : (
              <Pressable onPress={() => router.push({ pathname: '/review/[id]', params: { id: item.id } })} style={styles.row} accessibilityRole="button">
                <Image source={item.coverUrl} style={styles.thumb} contentFit="cover" />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text variant="label" weight="semi" color={colors.ink} numberOfLines={2}>{item.title}</Text>
                  <Text variant="caption" numberOfLines={1}>{item.creatorName} · goal {formatMoney(item.goalCents)}</Text>
                  <Row gap={space.sm}>
                    <StatusPill status={item.status} />
                    {item.reportCount ? <Pill label={`${item.reportCount} report${item.reportCount > 1 ? 's' : ''}`} tone="danger" /> : null}
                  </Row>
                  <Text variant="caption">{item.submittedAt && tab === 'submitted' ? `Submitted ${relativeTime(item.submittedAt)}` : nextStepCopy(item.status)}</Text>
                </View>
              </Pressable>
            )
          }
          ListEmptyComponent={<EmptyState icon={Inbox} title="Queue is clear" body="Nothing needs attention in this view. Try Demo controls to reset the demo data." />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start', backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  thumb: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
});

