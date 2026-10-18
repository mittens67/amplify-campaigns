import { useState } from 'react';
import { Alert, Platform, ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { CalendarClock, CreditCard, RotateCcw, UserRoundPlus } from 'lucide-react-native';
import { useDrafts } from '@/features/create/draftStore';
import { api, errorMessage } from '@/lib/api';
import { longDate } from '@/lib/format';
import { keys, queryClient } from '@/lib/queries';
import { resetDevice } from '@/lib/resetDevice';
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
  // Alert.alert is a no-op on web, so use the browser's confirm dialog there.
  const confirmThen = (t: string, m: string, action: string, fn: () => void) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`${t}

${m}`)) fn();
      return;
    }
    Alert.alert(t, m, [
      { text: 'Cancel', style: 'cancel' },
      { text: action, style: 'destructive', onPress: fn },
    ]);
  };
  const reset = () => confirmThen(title, message, 'Reset', () => void doReset());

  const router = useRouter();
  // Usability tests: fresh demo data AND a first-launch device (signed out, intro + tour again).
  const nextParticipant = () =>
    confirmThen(
      'Prepare for the next participant?',
      'Resets the demo data (up to a minute), signs this device out and shows the intro and tour again.',
      'Prepare',
      async () => {
        setBusy('next');
        try {
          await api('/demo/reset', { method: 'POST', timeoutMs: 150_000 });
          resetDevice();
          router.replace('/onboarding');
        } catch (e) {
          toast.error(errorMessage(e));
          setBusy(null);
        }
      },
    );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Demo controls" />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <Card style={{ gap: space.md }}>
          <Row gap={space.sm}>
            <UserRoundPlus size={18} color={colors.accent} />
            <Text variant="heading">Prepare for next participant</Text>
          </Row>
          <Text variant="label">For usability tests: resets the demo data, signs this device out and restarts the intro, tour and checklist. Takes up to a minute.</Text>
          <Button label={busy === 'next' ? 'Preparing… (up to a minute)' : 'Prepare for next participant'} onPress={nextParticipant} loading={busy === 'next'} disabled={!!busy} />
        </Card>
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
