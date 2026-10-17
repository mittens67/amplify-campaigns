import { useState } from 'react';
import { Alert, Platform, ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, CreditCard, RotateCcw } from 'lucide-react-native';
import { useDrafts } from '@/features/create/draftStore';
import { api, errorMessage } from '@/lib/api';
import { longDate } from '@/lib/format';
import { keys, queryClient } from '@/lib/queries';
import { Button, Card, colors, ErrorState, Notice, Row, ScreenHeader, Skeleton, space, Text, toast } from '@/ui';

export default function DemoControls() {
  const state = useQuery({ queryKey: keys.demo, queryFn: () => api<{ clockOffsetDays: number; now: string; pendingPayments: number }>('/demo/state') });
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (label: string, path: string, body?: unknown, msg?: string, timeoutMs?: number) => {
    setBusy(label);
    try {
      await api(path, { method: 'POST', body, timeoutMs });
      await queryClient.invalidateQueries();
      toast.success(msg ?? 'Done');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };
  const doReset = async () => {
    // Re-seeding takes up to a minute against the hosted database.
    await run('reset', '/demo/reset', undefined, 'Demo data reset', 150_000);
    useDrafts.setState({ drafts: {} });
  };
  const title = 'Reset demo data?';
  const message = 'All campaigns, contributions and notifications return to the starting demo state. Demo accounts are kept. This takes up to a minute.';
  const reset = () => {
    // Alert.alert is a no-op on web, so use the browser's confirm dialog there.
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}

${message}`)) void doReset();
      return;
    }
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => void doReset() },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Demo controls" />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <Notice tone="warning" title="For demonstrations only">These controls simulate the passage of time and payment providers so the whole campaign lifecycle can be shown in minutes.</Notice>
        {state.isPending ? (
          <Skeleton height={80} radius={20} />
        ) : state.isError ? (
          <ErrorState error={state.error} onRetry={state.refetch} compact />
        ) : (
          <Card>
            <Text variant="caption">Demo clock</Text>
            <Text variant="heading">{longDate(state.data.now)}</Text>
            <Text variant="caption">{state.data.clockOffsetDays ? `${state.data.clockOffsetDays} day(s) ahead of real time` : 'Real time'} · {state.data.pendingPayments} pending payment(s)</Text>
          </Card>
        )}
        <Card style={{ gap: space.md }}>
          <Row gap={space.sm}>
            <CalendarClock size={18} color={colors.accent} />
            <Text variant="heading">Advance time</Text>
          </Row>
          <Text variant="label">Moves funding deadlines, “closing soon” alerts, refunds and daily ad delivery forward.</Text>
          <Row gap={space.sm}>
            <Button label="+1 day" variant="secondary" onPress={() => run('1', '/demo/advance', { days: 1 }, 'Advanced 1 day')} loading={busy === '1'} style={{ flex: 1 }} />
            <Button label="+7 days" variant="secondary" onPress={() => run('7', '/demo/advance', { days: 7 }, 'Advanced 7 days')} loading={busy === '7'} style={{ flex: 1 }} />
            <Button label="+21 days" variant="secondary" onPress={() => run('21', '/demo/advance', { days: 21 }, 'Advanced 21 days')} loading={busy === '21'} style={{ flex: 1 }} />
          </Row>
        </Card>
        <Card style={{ gap: space.md }}>
          <Row gap={space.sm}>
            <CreditCard size={18} color={colors.accent} />
            <Text variant="heading">Settle pending payments</Text>
          </Row>
          <Text variant="label">Completes any “needs verification” checkouts immediately.</Text>
          <Button label="Settle now" variant="secondary" onPress={() => run('settle', '/demo/settle', undefined, 'Pending payments settled')} loading={busy === 'settle'} />
        </Card>
        <Card style={{ gap: space.md }}>
          <Row gap={space.sm}>
            <RotateCcw size={18} color={colors.danger} />
            <Text variant="heading">Reset demo data</Text>
          </Row>
          <Text variant="label">Restores every seeded campaign and clears changes made during a demo. Takes up to a minute.</Text>
          <Button label="Reset everything" variant="danger" onPress={reset} loading={busy === 'reset'} />
        </Card>
      </ScrollView>
    </View>
  );
}
