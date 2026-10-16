import { StyleSheet, View } from 'react-native';
import { adBudget, attributedReach, formatCompact, formatMoney, platformFee } from '@amplify/domain';
import { colors, Estimate, Measured, openGlossary, Pill, radius, Row, space, Text } from '@/ui';

/** Dashed estimate behind a solid measured bar — estimates and measurements never blur together. */
export function GhostBar({ estimate, measured, label }: { estimate: number; measured: number; label: string }) {
  const max = Math.max(estimate, measured, 1);
  return (
    <View style={{ gap: space.sm }} accessibilityLabel={`${label}: measured ${measured}, estimated ${estimate}`}>
      <Text variant="label" weight="semi" color={colors.ink}>{label}</Text>
      <View style={styles.track}>
        <View style={[styles.ghost, { width: `${(estimate / max) * 100}%` }]} />
        <View style={[styles.solid, { width: `${(measured / max) * 100}%` }]} />
      </View>
      <Row style={{ justifyContent: 'space-between' }}>
        <Measured value={measured} variant="label" />
        <Estimate value={estimate} variant="caption" color={colors.textMuted} />
      </Row>
    </View>
  );
}

export interface ReportNumbers {
  raisedCents: number;
  spentCents: number;
  impressions: number;
  reach: number;
  clicks: number;
  estReach: number;
  days: number;
  durationDays: number;
  contributedCents?: number;
  backerCount?: number;
}

export function ReportBody({ n, final }: { n: ReportNumbers; final: boolean }) {
  const budget = adBudget(n.raisedCents);
  const fee = platformFee(n.raisedCents);
  const unspent = Math.max(0, budget - n.spentCents);
  const ctr = n.impressions ? (n.clicks / n.impressions) * 100 : 0;
  const cpm = n.impressions ? (n.spentCents / n.impressions) * 1000 : 0;
  const mine = n.contributedCents ? attributedReach(n.contributedCents, n.raisedCents, n.reach) : 0;
  return (
    <View style={{ gap: space.xl }}>
      {mine > 0 ? (
        <View style={styles.mine}>
          <Text variant="overline" color={colors.accentText}>Your share</Text>
          <Text variant="display" color={colors.accentText}>{mine.toLocaleString()} people</Text>
          <Text variant="label" color={colors.text}>
            reached on your behalf — your {formatMoney(n.contributedCents!)} as a share of {formatMoney(n.raisedCents)} raised, applied to measured reach.
          </Text>
        </View>
      ) : null}

      <View style={styles.block}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="heading">Money</Text>
          <Pill label="From payment records" tone="neutral" />
        </Row>
        <Line label="Funds raised" value={formatMoney(n.raisedCents)} sub={n.backerCount ? `${n.backerCount.toLocaleString()} backers` : undefined} />
        <Line label="Platform fee (20%)" value={`− ${formatMoney(fee)}`} onPress={() => openGlossary('platformFee')} />
        <Line label="Advertising budget" value={formatMoney(budget)} strong />
        <Line label="Ad spend" value={formatMoney(n.spentCents)} sub={`${n.days} of ${n.durationDays} days`} />
        {final ? <Line label="Unspent (refunded to backers)" value={formatMoney(unspent)} /> : null}
      </View>

      <View style={styles.block}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="heading">Delivery</Text>
          <Pill label="Simulated delivery" tone="neutral" />
        </Row>
        <GhostBar label="People reached vs. estimate" estimate={n.estReach} measured={n.reach} />
        <View style={styles.grid}>
          <Metric label="Impressions" value={formatCompact(n.impressions)} hint="Times the ad was shown" />
          <Metric label="Clicks" value={formatCompact(n.clicks)} hint="Taps through to the campaign" />
          <Metric label="CTR" value={`${ctr.toFixed(2)}%`} hint="Clicks ÷ impressions" />
          <Metric label="CPM" value={formatMoney(Math.round(cpm), { cents: true })} hint="Cost per 1,000 impressions" />
        </View>
        <Text variant="caption">
          Measured figures come from the (simulated) distribution partner. Estimates use the prototype’s demo assumptions. The two are always shown separately.
        </Text>
      </View>
    </View>
  );
}

function Line({ label, value, sub, strong, onPress }: { label: string; value: string; sub?: string; strong?: boolean; onPress?: () => void }) {
  return (
    <View style={styles.line}>
      <View style={{ flex: 1 }}>
        <Text variant={strong ? 'bodyStrong' : 'body'} color={colors.ink} onPress={onPress} style={onPress ? { textDecorationLine: 'underline', textDecorationStyle: 'dashed', textDecorationColor: colors.borderStrong } : undefined}>
          {label}
        </Text>
        {sub ? <Text variant="caption">{sub}</Text> : null}
      </View>
      <Text variant={strong ? 'bodyStrong' : 'body'} color={colors.ink} style={{ fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <View style={styles.metric}>
      <Text variant="caption">{label}</Text>
      <Text variant="number">{value}</Text>
      <Text variant="caption" style={{ fontSize: 11 }}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 14, borderRadius: 7, backgroundColor: colors.surfaceAlt, justifyContent: 'center' },
  ghost: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 7, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.accent, backgroundColor: colors.accentSoft },
  solid: { position: 'absolute', left: 0, top: 3, bottom: 3, borderRadius: 4, backgroundColor: colors.success, marginLeft: 3 },
  mine: { backgroundColor: colors.accentSoft, borderRadius: radius.xl, padding: space.lg, gap: space.xs },
  block: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: space.lg, gap: space.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  metric: { width: '48%', flexGrow: 1, backgroundColor: colors.bg, borderRadius: radius.md, padding: space.md, gap: 2 },
});
