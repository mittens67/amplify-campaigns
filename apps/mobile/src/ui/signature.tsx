import { Fragment } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import {
  formatCompact,
  formatMoney,
  journeyPosition,
  JOURNEY_STAGES,
  type CampaignStatus,
  type GlossaryKey,
  type Quote,
} from '@amplify/domain';
import { openGlossary } from './overlays';
import { Text, type TextVariant } from './Text';
import { colors, radius, space, toneColors } from './theme';

/* ---------- Estimate vs Measured: no reach number renders without one of these ---------- */

export function Estimate({
  value,
  suffix = 'people',
  variant = 'label',
  color = colors.text,
  compact = true,
  glossary = 'estimatedReach',
}: {
  value: number;
  suffix?: string;
  variant?: TextVariant;
  color?: string;
  compact?: boolean;
  glossary?: GlossaryKey | null;
}) {
  const content = (
    <View style={styles.inline}>
      <Text variant={variant} color={color} weight="semi" style={glossary ? styles.dashed : undefined}>
        ≈ {compact ? formatCompact(value) : value.toLocaleString('en-US')}
        {suffix ? ` ${suffix}` : ''}
      </Text>
      <View style={styles.estTag}>
        <Text variant="caption" weight="bold" color={colors.textSubtle} style={{ fontSize: 10, lineHeight: 12 }}>EST.</Text>
      </View>
    </View>
  );
  if (!glossary) return content;
  return (
    <Pressable
      onPress={() => openGlossary(glossary)}
      accessibilityRole="button"
      accessibilityLabel={`Estimated ${value} ${suffix}. Tap to learn how estimates work.`}
      hitSlop={6}
    >
      {content}
    </Pressable>
  );
}

export function Measured({ value, suffix = 'people', variant = 'label', compact = true }: { value: number; suffix?: string; variant?: TextVariant; compact?: boolean }) {
  return (
    <Pressable onPress={() => openGlossary('measuredReach')} accessibilityRole="button" accessibilityLabel={`Measured ${value} ${suffix}`} hitSlop={6}>
      <View style={styles.inline}>
        <Text variant={variant} weight="semi" color={colors.ink}>
          {compact ? formatCompact(value) : value.toLocaleString('en-US')}
          {suffix ? ` ${suffix}` : ''}
        </Text>
        <View style={[styles.estTag, { borderStyle: 'solid', borderColor: '#A7F3D0', backgroundColor: colors.successSoft }]}>
          <Text variant="caption" weight="bold" color={colors.success} style={{ fontSize: 10, lineHeight: 12 }}>MEASURED</Text>
        </View>
      </View>
    </Pressable>
  );
}

/* ---------- Money Flow: where every dollar goes ---------- */

export function MoneyFlow({ quote, showTotal = true, compact = false }: { quote: Quote; showTotal?: boolean; compact?: boolean }) {
  const total = Math.max(1, quote.totalCents);
  const seg = (cents: number) => ({ flex: Math.max(cents / total, 0.015) });
  const rows: { color: string; label: string; cents: number; glossary: GlossaryKey; note: string }[] = [
    { color: colors.flowAds, label: 'Ad budget', cents: quote.adBudgetCents, glossary: 'distribution', note: 'Buys ads that show the message' },
    { color: colors.flowFee, label: 'Platform fee (20%)', cents: quote.platformFeeCents, glossary: 'platformFee', note: 'Review, ad operations, reporting' },
    { color: colors.flowProcessing, label: 'Card processing', cents: quote.processingCents, glossary: 'processingFee', note: 'Added on top · 2.9% + 30¢' },
  ];
  return (
    <View style={{ gap: space.md }} accessibilityLabel={`Of ${formatMoney(quote.amountCents)}, ${formatMoney(quote.adBudgetCents)} buys ads, ${formatMoney(quote.platformFeeCents)} is the platform fee, plus ${formatMoney(quote.processingCents)} processing.`}>
      <View style={styles.flowBar}>
        {rows.map((r, i) => (
          <View key={r.label} style={[seg(r.cents), { backgroundColor: r.color, marginLeft: i ? 2 : 0 }]} />
        ))}
      </View>
      {!compact ? (
        <View style={{ gap: space.sm }}>
          {rows.map((r) => (
            <Pressable key={r.label} onPress={() => openGlossary(r.glossary)} style={styles.flowRow} accessibilityRole="button" hitSlop={4}>
              <View style={[styles.dot, { backgroundColor: r.color }]} />
              <View style={{ flex: 1 }}>
                <Text variant="label" color={colors.text} weight="medium">{r.label}</Text>
                <Text variant="caption">{r.note}</Text>
              </View>
              <Text variant="label" weight="semi" color={colors.ink} style={{ fontVariant: ['tabular-nums'] }}>{formatMoney(r.cents, { cents: true })}</Text>
            </Pressable>
          ))}
          {showTotal ? (
            <View style={[styles.flowRow, styles.flowTotal]}>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">You pay</Text>
              </View>
              <Text variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>{formatMoney(quote.totalCents, { cents: true })}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/* ---------- Journey Rail: where the campaign is in its life, and what's next ---------- */

export function JourneyRail({ status, dense }: { status: CampaignStatus; dense?: boolean }) {
  const pos = journeyPosition(status);
  const current = pos.index;
  return (
    <View accessibilityLabel={`Campaign stage: ${current >= 0 ? JOURNEY_STAGES[current].label : 'Draft'}${pos.branch ? `, ${pos.branch.label}` : ''}`}>
      <View style={styles.rail}>
        {JOURNEY_STAGES.map((s, i) => {
          const done = i < current || (i === current && pos.done);
          const active = i === current && !pos.done;
          const branch = active && pos.branch;
          const t = branch ? toneColors[pos.branch!.tone] : null;
          return (
            <Fragment key={s.key}>
              {i > 0 ? <View style={[styles.railLine, { backgroundColor: i <= current ? colors.accent : colors.border }]} /> : null}
              <View
                style={[
                  styles.node,
                  done && { backgroundColor: colors.accent, borderColor: colors.accent },
                  active && !branch && { borderColor: colors.accent, borderWidth: 2, backgroundColor: colors.accentSoft },
                  branch && t && { borderColor: t.fg, borderWidth: 2, backgroundColor: t.bg },
                ]}
              >
                {done ? <Check size={11} color={colors.white} strokeWidth={3} /> : active ? <View style={[styles.nodeCore, branch && t ? { backgroundColor: t.fg } : null]} /> : null}
              </View>
            </Fragment>
          );
        })}
      </View>
      <View style={styles.railLabels}>
        {JOURNEY_STAGES.map((s, i) => (
          <Text
            key={s.key}
            variant="caption"
            weight={i === current ? 'semi' : 'regular'}
            color={i === current ? colors.ink : colors.textSubtle}
            style={[styles.railLabel, i === 0 && { textAlign: 'left' }, i === JOURNEY_STAGES.length - 1 && { textAlign: 'right' }]}
            numberOfLines={1}
          >
            {s.label}
          </Text>
        ))}
      </View>
      {!dense && current >= 0 ? (
        <Text variant="caption" style={{ marginTop: space.sm }}>
          {pos.branch ? `${pos.branch.label}. ` : ''}
          {JOURNEY_STAGES[Math.min(current, 4)].blurb}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dashed: { textDecorationLine: 'underline', textDecorationStyle: 'dashed', textDecorationColor: colors.borderStrong },
  estTag: { borderWidth: 1, borderColor: colors.borderStrong, borderStyle: 'dashed', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  flowBar: { flexDirection: 'row', height: 12, borderRadius: radius.pill, overflow: 'hidden', backgroundColor: colors.surfaceAlt },
  flowRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 36 },
  flowTotal: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingTop: space.md, marginTop: space.xs },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rail: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18 },
  railLine: { flex: 1, height: 2, borderRadius: 1 },
  node: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.borderStrong, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  nodeCore: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  railLabels: { flexDirection: 'row', marginTop: 6 },
  railLabel: { flex: 1, textAlign: 'center', fontSize: 11 },
});
