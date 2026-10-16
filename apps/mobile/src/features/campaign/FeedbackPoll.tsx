import { Pressable, StyleSheet, View } from 'react-native';
import type { CampaignDetailDTO } from '@amplify/domain';
import { useFeedback } from '@/lib/queries';
import { haptic } from '@/lib/haptics';
import { colors, radius, space, Text } from '@/ui';

const QUESTIONS = [
  { key: 'visuals' as const, text: 'Did the visuals make you want to keep reading?' },
  { key: 'mind' as const, text: 'Did this campaign change your mind about anything?' },
];
const ANSWERS = [
  { key: 'no' as const, label: 'No' },
  { key: 'somewhat' as const, label: 'Somewhat' },
  { key: 'yes' as const, label: 'Yes' },
];

/** Anonymous two-question poll; results appear after answering so they don't bias the answer. */
export function FeedbackPoll({ c }: { c: CampaignDetailDTO }) {
  const vote = useFeedback(c.id);
  return (
    <View style={styles.wrap}>
      <Text variant="heading">Quick feedback</Text>
      <Text variant="caption">Anonymous. Helps creators and reviewers learn what works.</Text>
      {QUESTIONS.map((q) => {
        const mine = c.viewer.feedback[q.key];
        const counts = c.feedback[q.key];
        const total = counts.no + counts.somewhat + counts.yes;
        return (
          <View key={q.key} style={{ gap: space.sm, marginTop: space.sm }}>
            <Text variant="label" weight="semi" color={colors.ink}>{q.text}</Text>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {ANSWERS.map((a) => {
                const selected = mine === a.key;
                const share = total ? Math.round((counts[a.key] / total) * 100) : 0;
                return (
                  <Pressable
                    key={a.key}
                    onPress={() => {
                      haptic('select');
                      vote.mutate({ question: q.key, answer: a.key });
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    style={[styles.option, selected && styles.optionOn]}
                  >
                    {mine ? <View style={[styles.fill, { width: `${share}%` }, selected && { backgroundColor: colors.accentBorder }]} /> : null}
                    <Text variant="label" weight="semi" color={selected ? colors.accentText : colors.ink}>{a.label}</Text>
                    {mine ? <Text variant="caption" color={selected ? colors.accentText : colors.textSubtle}>{share}%</Text> : null}
                  </Pressable>
                );
              })}
            </View>
            {mine ? <Text variant="caption">{total.toLocaleString()} responses</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.bg, borderRadius: radius.lg, padding: space.lg, gap: 2, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  option: { flex: 1, height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  optionOn: { borderColor: colors.accent, borderWidth: 1.5 },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.surfaceAlt },
});
