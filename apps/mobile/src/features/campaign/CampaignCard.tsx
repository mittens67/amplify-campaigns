import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { CREATOR_TYPES, formatMoney, nextStepCopy, percentFunded, type CampaignSummaryDTO } from '@amplify/domain';
import { timeLeft } from '@/lib/format';
import { Button, categoryTint, colors, DemoTag, Estimate, ProgressBar, radius, Row, shadow, space, StatusPill, Text } from '@/ui';

export const creatorTypeLabel = (k: string | null) => CREATOR_TYPES.find((c) => c.key === k)?.label ?? '';

function FundingLine({ c }: { c: CampaignSummaryDTO }) {
  const p = percentFunded(c.raisedCents, c.goalCents);
  return (
    <View style={{ gap: 6 }}>
      <ProgressBar value={p} height={6} color={c.status === 'available_for_funding' ? colors.accent : colors.success} />
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="label" color={colors.text}>
          <Text variant="label" weight="semi" color={colors.ink}>{formatMoney(c.raisedCents)}</Text> of {formatMoney(c.goalCents)} · {p}%
        </Text>
        {c.status === 'available_for_funding' ? (
          <Text variant="caption">{timeLeft(c.fundingEndsAt)}</Text>
        ) : null}
      </Row>
    </View>
  );
}

/** The one campaign card used across Home and Explore. */
export const CampaignCard = memo(function CampaignCard({ c, variant = 'full' }: { c: CampaignSummaryDTO; variant?: 'full' | 'compact' }) {
  const router = useRouter();
  const open = () => router.push({ pathname: '/campaign/[id]', params: { id: c.id } });
  const backable = c.status === 'available_for_funding';

  if (variant === 'compact') {
    return (
      <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={c.title} style={({ pressed }) => [styles.compact, pressed && styles.pressed]}>
        <Image source={c.coverUrl} style={styles.compactImg} contentFit="cover" transition={200} accessibilityIgnoresInvertColors />
        <View style={{ padding: space.md, gap: 6, flex: 1 }}>
          <Text variant="overline">{c.category}</Text>
          <Text variant="cardTitle" numberOfLines={2} style={{ fontSize: 17, lineHeight: 22 }}>{c.title}</Text>
          <View style={{ flex: 1 }} />
          <FundingLine c={c} />
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={`${c.title}, by ${c.creatorName}`} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View>
        <Image source={c.coverUrl} style={styles.cover} contentFit="cover" transition={200} accessibilityIgnoresInvertColors />
        <View style={styles.coverBadges}>
          <View style={[styles.category, { backgroundColor: categoryTint[c.category ?? 'Other'] ?? colors.surfaceAlt }]}>
            <Text variant="caption" weight="semi" color={colors.ink}>{c.category}</Text>
          </View>
        </View>
      </View>
      <View style={styles.body}>
        <Text variant="cardTitle" numberOfLines={2}>{c.title}</Text>
        <Row gap={6}>
          <Text variant="label" color={colors.text} weight="medium" numberOfLines={1} style={{ flexShrink: 1 }}>{c.creatorName}</Text>
          {c.creatorType ? <Text variant="caption">· {creatorTypeLabel(c.creatorType)}</Text> : null}
        </Row>
        {c.summary ? <Text variant="body" color={colors.textMuted} numberOfLines={2}>{c.summary}</Text> : null}
        <FundingLine c={c} />
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={6}>
            <Text variant="caption">At goal</Text>
            <Estimate value={c.estReachAtGoal} variant="caption" glossary={null} />
          </Row>
          {c.isDemo ? <DemoTag /> : null}
        </Row>
        {backable ? (
          <Button
            label="Back this campaign"
            onPress={() => router.push({ pathname: '/back/[id]', params: { id: c.id } })}
            full
            style={{ marginTop: space.xs }}
          />
        ) : (
          <View style={styles.statusRow}>
            <StatusPill status={c.status} />
            <Text variant="caption" style={{ flex: 1 }} numberOfLines={1}>{nextStepCopy(c.status)}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...shadow.card },
  pressed: { opacity: 0.95, transform: [{ scale: 0.99 }] },
  cover: { width: '100%', aspectRatio: 16 / 10, backgroundColor: colors.surfaceAlt },
  coverBadges: { position: 'absolute', top: space.md, left: space.md, flexDirection: 'row', gap: space.xs },
  category: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  body: { padding: space.lg, gap: space.sm + 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  compact: { width: 260, height: 300, backgroundColor: colors.surface, borderRadius: radius.xl, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...shadow.card },
  compactImg: { width: '100%', height: 130, backgroundColor: colors.surfaceAlt },
});
