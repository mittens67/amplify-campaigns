import { ScrollView, Switch, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { keys } from '@/lib/queries';
import { Card, colors, Divider, ErrorState, ListRow, Notice, ScreenHeader, Skeleton, space, Text } from '@/ui';

interface Pref {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
}

export default function NotificationPrefs() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: keys.prefs, queryFn: () => api<Pref[]>('/activity/prefs') });
  const set = useMutation({
    mutationFn: (v: { category: string; enabled: boolean }) => api<Pref[]>('/activity/prefs', { method: 'PUT', body: v }),
    onMutate: (v) => qc.setQueryData<Pref[]>(keys.prefs, (old) => old?.map((p) => (p.key === v.category ? { ...p, enabled: v.enabled } : p))),
    onSuccess: (data) => qc.setQueryData(keys.prefs, data),
  });
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Notifications" />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <Text variant="label">Choose what shows up in Activity. We group milestones and never send the same update twice.</Text>
        {q.isPending ? (
          <Skeleton height={240} radius={20} />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={q.refetch} />
        ) : (
          <Card padded={false} style={{ overflow: 'hidden' }}>
            {q.data.map((p, i) => (
              <View key={p.key}>
                {i > 0 ? <Divider inset={16} /> : null}
                <ListRow
                  title={p.label}
                  subtitle={p.description}
                  right={<Switch value={p.enabled} onValueChange={(enabled) => set.mutate({ category: p.key, enabled })} trackColor={{ true: colors.accent, false: colors.borderStrong }} thumbColor={colors.white} accessibilityLabel={p.label} />}
                />
              </View>
            ))}
            <Divider inset={16} />
            <ListRow title="Account & security" subtitle="New sign-ins and account changes — always on" right={<Switch value disabled trackColor={{ true: colors.accentBorder, false: colors.borderStrong }} thumbColor={colors.white} />} />
          </Card>
        )}
        <Notice tone="neutral">Push and email delivery are not enabled in this prototype; notifications appear in the Activity tab.</Notice>
      </ScrollView>
    </View>
  );
}
