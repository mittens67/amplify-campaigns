import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { formatMoney } from '@amplify/domain';
import { PAYMENT_STATUS } from '@/features/campaign/paymentStatus';
import { longDate } from '@/lib/format';
import { useContribution } from '@/lib/queries';
import { Button, colors, Divider, ErrorState, Estimate, Notice, Pill, radius, Row, ScreenHeader, Skeleton, space, Text } from '@/ui';

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <Text variant={strong ? 'bodyStrong' : 'label'} color={strong ? colors.ink : colors.textMuted}>{label}</Text>
      <Text variant={strong ? 'bodyStrong' : 'label'} color={colors.ink} style={{ fontVariant: ['tabular-nums'] }}>{value}</Text>
    </Row>
  );
}

export default function ReceiptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const q = useContribution(id, true);
  const c = q.data;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Receipt" />
      {q.isPending ? (
        <View style={{ padding: space.lg }}><Skeleton height={320} radius={20} /></View>
      ) : q.isError || !c ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxxl }}>
          <View style={styles.receipt}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="overline">Amplify · Receipt</Text>
              <Pill label={PAYMENT_STATUS[c.status].label} tone={PAYMENT_STATUS[c.status].tone} />
            </Row>
            <Text variant="cardTitle">{c.campaignTitle}</Text>
            <Text variant="caption">{c.receiptNo} · {longDate(c.createdAt)}</Text>
            <Divider />
            <Line label="Contribution" value={formatMoney(c.amountCents, { cents: true })} />
            <Line label="  of which ad budget (80%)" value={formatMoney(c.adBudgetCents, { cents: true })} />
            <Line label="  of which platform fee (20%)" value={formatMoney(c.platformFeeCents, { cents: true })} />
            <Line label="Card processing" value={formatMoney(c.processingCents, { cents: true })} />
            <Divider />
            <Line label="Total charged" value={c.status === 'succeeded' || c.status.startsWith('refund') ? formatMoney(c.totalCents, { cents: true }) : '$0.00'} strong />
            {c.refundCents > 0 ? <Line label={c.status === 'refunded' ? 'Refunded' : 'Refund pending'} value={`− ${formatMoney(c.refundCents, { cents: true })}`} /> : null}
            <Divider />
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="label">Estimated reach at purchase</Text>
              <Estimate value={c.estReach} variant="label" compact={false} />
            </Row>
            <Text variant="caption">Name shown publicly: {c.publicName ?? 'No (anonymous)'}</Text>
            <Text variant="caption">Payment method: simulated test card (no real charge). This contribution funds distribution of a campaign message and is not a charitable donation.</Text>
          </View>
          {c.failureReason ? <Notice tone="neutral">{c.failureReason}</Notice> : null}
          <Button label="View campaign" variant="secondary" onPress={() => router.push({ pathname: '/campaign/[id]', params: { id: c.campaignId } })} full />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  receipt: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: space.xl, gap: space.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
});
