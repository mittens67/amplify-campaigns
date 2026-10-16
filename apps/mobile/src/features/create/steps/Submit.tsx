import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { AlertCircle, Check, ChevronRight, Eye, Lock } from 'lucide-react-native';
import {
  adBudget,
  CHANNELS,
  estimateReachAtGoal,
  formatMoney,
  platformFee,
  stepOfField,
  STEPS,
  validateStep,
  MIN_GOAL_CENTS,
  FUNDING_WINDOW_DAYS,
  type StepKey,
} from '@amplify/domain';
import { Accordion, Button, colors, Estimate, fonts, Notice, openGlossary, radius, Row, space, Text } from '@/ui';
import { StepIntro, useField, useWizard } from '../WizardKit';

const LABELS: Record<string, string> = {
  'basics.title': 'Title',
  'basics.category': 'Category',
  'basics.creatorName': 'Creator name',
  'basics.creatorType': 'Who is behind it',
  'basics.summary': 'Summary',
  'basics.cover': 'Cover image',
  'story.intro': 'Introduction',
  'story.sources': 'Sources',
  'visuals.adImages': 'Ad images',
  'visuals.cta': 'Call to action',
  'reach.locations': 'Locations',
  'reach.channels': 'Channels',
  'reach.split': 'Budget split',
  'reach.durationDays': 'Ad run length',
};

function Checkbox({ checked, onPress, label, error }: { checked: boolean; onPress: () => void; label: string; error?: string | null }) {
  return (
    <Pressable onPress={onPress} style={styles.checkRow} accessibilityRole="checkbox" accessibilityState={{ checked }}>
      <View style={[styles.box, checked && styles.boxOn, error && !checked && { borderColor: colors.danger }]}>{checked ? <Check size={14} color={colors.white} strokeWidth={3} /> : null}</View>
      <Text variant="label" color={colors.text} style={{ flex: 1 }}>{label}</Text>
    </Pressable>
  );
}

export function SubmitStep({ onPreview }: { onPreview: () => void }) {
  const { content, update, goTo } = useWizard();
  const goalField = useField('submit.goalCents');
  const rules = useField('submit.acceptedRules');
  const funding = useField('submit.acceptedFunding');
  const goal = content.submit.goalCents ?? 0;
  const outstanding = (['basics', 'story', 'visuals', 'reach'] as StepKey[]).flatMap((s) =>
    Object.entries(validateStep(s, content)).map(([path, msg]) => ({ path, msg, step: stepOfField(path) })),
  );

  const summary: Record<StepKey, string> = {
    basics: [content.basics.title || 'No title', content.basics.category, content.basics.creatorName].filter(Boolean).join(' · '),
    story: `${content.story.blocks.length} sections · ${content.story.sources.length} sources · ${content.story.actions.filter(Boolean).length} actions`,
    visuals: `${content.basics.cover ? 'Cover ✓' : 'No cover'} · ${content.visuals.adImages.length} ad image${content.visuals.adImages.length === 1 ? '' : 's'}${content.visuals.video ? ' · video' : ''}`,
    reach: `${content.reach.locations.join(', ') || 'No locations'} · ${CHANNELS.filter((c) => content.reach.channels.includes(c.key)).map((c) => c.label).join(', ') || 'no channels'} · ${content.reach.durationDays} days`,
    submit: '',
  };

  return (
    <View style={{ gap: space.lg }}>
      <StepIntro title="Review and submit" body="Check everything, set your funding goal, and send it to our reviewers." />

      {outstanding.length ? (
        <Notice tone="warning" title={`${outstanding.length} thing${outstanding.length === 1 ? '' : 's'} to finish`} icon={<AlertCircle size={18} color={colors.warning} />}>
          <View style={{ gap: 2, marginTop: 4 }}>
            {outstanding.map((o) => (
              <Pressable key={o.path} onPress={() => goTo(o.step)} style={styles.todo} accessibilityRole="button" accessibilityLabel={`Fix ${LABELS[o.path] ?? o.path}`}>
                <Text variant="label" color={colors.text} style={{ flex: 1 }}>
                  <Text variant="label" weight="semi" color={colors.ink}>{LABELS[o.path] ?? 'Field'}: </Text>
                  {o.msg}
                </Text>
                <Text variant="caption" weight="semi" color={colors.accent}>Fix</Text>
                <ChevronRight size={14} color={colors.accent} />
              </Pressable>
            ))}
          </View>
        </Notice>
      ) : (
        <Notice tone="success" title="Every step is complete" icon={<Check size={18} color={colors.success} />}>
          Set your goal, confirm the policies and submit.
        </Notice>
      )}

      <View style={styles.card}>
        {STEPS.filter((s) => s.key !== 'submit').map((s, i) => (
          <Pressable key={s.key} onPress={() => goTo(s.key)} style={[styles.summaryRow, i > 0 && styles.summaryBorder]} accessibilityRole="button" accessibilityLabel={`Edit ${s.label}`}>
            <View style={{ flex: 1 }}>
              <Text variant="label" weight="semi" color={colors.ink}>{i + 1}. {s.label}</Text>
              <Text variant="caption" numberOfLines={2}>{summary[s.key]}</Text>
            </View>
            <Text variant="caption" weight="semi" color={colors.accent}>Edit</Text>
          </Pressable>
        ))}
        <Button label="Preview as the audience sees it" variant="secondary" icon={<Eye size={18} color={colors.ink} />} onPress={onPreview} full style={{ marginTop: space.sm }} />
      </View>

      <View style={styles.card}>
        <Text variant="heading">Funding goal</Text>
        <Text variant="label">How much should backers raise for distribution? Only you set this — it isn’t suggested by AI and won’t change unless you change it.</Text>
        <View style={[styles.goalBox, goalField.error && { borderColor: colors.danger }]}>
          <Text style={styles.dollar}>$</Text>
          <TextInput
            value={goal ? String(Math.round(goal / 100)) : ''}
            onChangeText={(t) => {
              const n = parseInt(t.replace(/[^0-9]/g, ''), 10);
              update((c) => void (c.submit.goalCents = Number.isFinite(n) ? n * 100 : undefined));
            }}
            keyboardType="number-pad"
            placeholder="5,000"
            placeholderTextColor={colors.placeholder}
            style={styles.goalInput}
            accessibilityLabel="Funding goal in dollars"
            maxLength={6}
          />
        </View>
        {goalField.error ? <Text variant="caption" color={colors.danger}>{goalField.error}</Text> : <Text variant="caption">Between {formatMoney(MIN_GOAL_CENTS)} and $100,000. Backers can fund for {FUNDING_WINDOW_DAYS} days after approval.</Text>}
        {goal >= MIN_GOAL_CENTS ? (
          <View style={styles.goalBreakdown}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="label" onPress={() => openGlossary('platformFee')}>Platform fee (20%)</Text>
              <Text variant="label" color={colors.ink}>{formatMoney(platformFee(goal))}</Text>
            </Row>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="label">Advertising budget</Text>
              <Text variant="label" weight="semi" color={colors.ink}>{formatMoney(adBudget(goal))}</Text>
            </Row>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="label">Estimated reach at goal</Text>
              <Estimate value={estimateReachAtGoal(goal)} variant="label" />
            </Row>
            <Text variant="caption">Card processing is paid by backers on top of their contribution. If funding ends below the goal, ads still run as long as the budget is at least $100.</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Row gap={space.sm}>
          <Lock size={16} color={colors.textMuted} />
          <Text variant="heading">Policies</Text>
        </Row>
        <Checkbox
          checked={content.submit.acceptedRules}
          onPress={() => update((c) => void (c.submit.acceptedRules = !c.submit.acceptedRules))}
          label="My campaign follows the Community Guidelines: claims are sourced, the framing is fair, and I have rights to every image."
          error={rules.error}
        />
        <Checkbox
          checked={content.submit.acceptedFunding}
          onPress={() => update((c) => void (c.submit.acceptedFunding = !c.submit.acceptedFunding))}
          label="I understand contributions fund ad distribution, not me or my organisation, and that unspent funds are refunded to backers."
          error={funding.error}
        />
        {(rules.error || funding.error) ? <Text variant="caption" color={colors.danger}>Please confirm both policies.</Text> : null}
        <Text variant="caption">
          After you submit, content is locked while reviewers check it. If they request changes, you’ll be able to edit and resubmit. Major changes after approval go back through review.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: space.lg, gap: space.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  todo: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  summaryBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  goalBox: { flexDirection: 'row', alignItems: 'center', height: 64, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.borderStrong, paddingHorizontal: space.lg },
  dollar: { fontFamily: fonts.sansBold, fontSize: 26, color: colors.textSubtle, marginRight: 6 },
  goalInput: { flex: 1, fontFamily: fonts.sansBold, fontSize: 28, color: colors.ink },
  goalBreakdown: { backgroundColor: colors.bg, borderRadius: radius.md, padding: space.md, gap: space.sm },
  checkRow: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start', paddingVertical: 4 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
});
