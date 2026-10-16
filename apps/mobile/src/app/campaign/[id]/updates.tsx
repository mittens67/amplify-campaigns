import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Flag, Megaphone, Newspaper } from 'lucide-react-native';
import { STATUS_LABEL } from '@amplify/domain';
import { longDate } from '@/lib/format';
import { useCampaign } from '@/lib/queries';
import { colors, EmptyState, ErrorState, radius, ScreenHeader, Skeleton, space, Text } from '@/ui';

export default function UpdatesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useCampaign(id);
  const c = q.data;
  // Merge creator/milestone updates with public lifecycle events into one timeline.
  const items = c
    ? [
        ...c.updates.map((u) => ({ id: u.id, at: u.at, title: u.title, body: u.body, kind: u.kind as string })),
        ...c.timeline
          .filter((e) => ['open_funding', 'launch', 'complete', 'period_ended', 'prepare'].includes(e.event))
          .map((e) => ({ id: e.id, at: e.at, title: STATUS_LABEL[e.to], body: e.event === 'launch' ? 'Ads started running.' : e.event === 'open_funding' ? 'Passed review and opened for backing.' : '', kind: 'status' })),
      ].sort((a, b) => b.at.localeCompare(a.at))
    : [];
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Updates" subtitle={c?.title} />
      {q.isPending ? (
        <View style={{ padding: space.lg, gap: space.md }}>
          <Skeleton height={80} radius={16} />
          <Skeleton height={80} radius={16} />
        </View>
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : items.length === 0 ? (
        <EmptyState icon={Newspaper} title="No updates yet" body="Creators post updates here, and we add milestones as funding and distribution progress." />
      ) : (
        <ScrollView contentContainerStyle={{ padding: space.lg, gap: 0 }}>
          {items.map((u, i) => {
            const Icon = u.kind === 'creator' ? Newspaper : u.kind === 'milestone' ? Flag : Megaphone;
            return (
              <View key={u.id} style={styles.item}>
                <View style={styles.rail}>
                  <View style={[styles.icon, u.kind === 'creator' && { backgroundColor: colors.accent }]}>
                    <Icon size={14} color={u.kind === 'creator' ? colors.white : colors.accent} />
                  </View>
                  {i < items.length - 1 ? <View style={styles.line} /> : null}
                </View>
                <View style={styles.card}>
                  <Text variant="caption">{longDate(u.at)}{u.kind === 'creator' ? ' · From the creator' : ''}</Text>
                  <Text variant="bodyStrong" style={{ marginTop: 2 }}>{u.title}</Text>
                  {u.body ? <Text variant="label" color={colors.text} style={{ marginTop: 4 }}>{u.body}</Text> : null}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', gap: space.md },
  rail: { alignItems: 'center', width: 28 },
  icon: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 4 },
  card: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, marginBottom: space.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
});
