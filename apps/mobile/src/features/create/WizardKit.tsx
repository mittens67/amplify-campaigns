import { createContext, useContext, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Lock, MessageSquareWarning, Sparkles } from 'lucide-react-native';
import { STEPS, type CampaignContent, type FieldErrors, type StepKey } from '@amplify/domain';
import { haptic } from '@/lib/haptics';
import { colors, radius, space, Text } from '@/ui';

export interface WizardCtx {
  content: CampaignContent;
  update: (mutate: (c: CampaignContent) => void, paths?: string[]) => void;
  errors: FieldErrors;
  notes: Record<string, string>;
  goTo: (s: StepKey) => void;
}

export const Wizard = createContext<WizardCtx | null>(null);
export function useWizard() {
  const ctx = useContext(Wizard);
  if (!ctx) throw new Error('useWizard outside wizard');
  return ctx;
}

/** Field-level helpers: current error, reviewer note and AI-suggestion state for a path. */
export function useField(path: string) {
  const { errors, notes, content, update } = useWizard();
  const suggested = content.aiSuggested.includes(path);
  return {
    error: errors[path] ?? null,
    note: notes[path] ?? null,
    suggested,
    accept: () => update((c) => void (c.aiSuggested = c.aiSuggested.filter((p) => p !== path))),
  };
}

export function SuggestedChip({ path }: { path: string }) {
  const f = useField(path);
  if (!f.suggested) return null;
  return (
    <Pressable onPress={f.accept} style={styles.suggested} accessibilityRole="button" accessibilityLabel="AI suggested. Tap to keep it." hitSlop={8}>
      <Sparkles size={12} color={colors.accentText} />
      <Text variant="caption" weight="semi" color={colors.accentText}>Suggested · Keep</Text>
    </Pressable>
  );
}

export function ReviewerNote({ path }: { path: string }) {
  const { note } = useField(path);
  if (!note) return null;
  return (
    <View style={styles.note}>
      <MessageSquareWarning size={16} color={colors.warning} />
      <Text variant="caption" color={colors.text} style={{ flex: 1 }}>
        <Text variant="caption" weight="semi" color={colors.warning}>Reviewer: </Text>
        {note}
      </Text>
    </View>
  );
}

export function StepIntro({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ gap: space.xs }}>
      <Text variant="title" accessibilityRole="header">{title}</Text>
      <Text variant="label">{body}</Text>
    </View>
  );
}

export function Group({ title, hint, children, locked }: { title: string; hint?: string; children: ReactNode; locked?: boolean }) {
  return (
    <View style={[styles.group, locked && styles.locked]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {locked ? <Lock size={14} color={colors.textMuted} /> : null}
        <Text variant="overline" color={locked ? colors.textMuted : colors.accentText}>{title}</Text>
      </View>
      {hint ? <Text variant="caption" style={{ marginTop: -4 }}>{hint}</Text> : null}
      {children}
    </View>
  );
}

/** Persistent five-step progress indicator; completed steps can be revisited. */
export function StepBar({ current, completed, onSelect }: { current: StepKey; completed: StepKey[]; onSelect: (s: StepKey) => void }) {
  const idx = STEPS.findIndex((s) => s.key === current);
  return (
    <View style={{ gap: 8 }}>
      <View style={styles.segments} accessibilityRole="tablist">
        {STEPS.map((s, i) => {
          const done = completed.includes(s.key);
          const active = i === idx;
          return (
            <Pressable
              key={s.key}
              onPress={() => {
                haptic('select');
                onSelect(s.key);
              }}
              style={styles.segmentHit}
              accessibilityRole="tab"
              accessibilityLabel={`Step ${i + 1}: ${s.label}${done ? ', complete' : ''}`}
              accessibilityState={{ selected: active }}
              hitSlop={{ top: 12, bottom: 12 }}
            >
              <View style={[styles.segment, (done || i < idx) && { backgroundColor: colors.accent }, active && { backgroundColor: colors.ink }]} />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.stepLabels}>
        {STEPS.map((s, i) => (
          <Text key={s.key} variant="caption" weight={i === idx ? 'semi' : 'regular'} color={i === idx ? colors.ink : colors.textSubtle} style={{ flex: 1, textAlign: 'center', fontSize: 11 }} numberOfLines={1}>
            {s.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  suggested: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.accentSoft, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  note: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start', backgroundColor: colors.warningSoft, borderRadius: radius.sm, padding: space.sm, borderWidth: 1, borderColor: '#FDE68A' },
  group: { gap: space.md, backgroundColor: colors.surface, borderRadius: radius.xl, padding: space.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  locked: { backgroundColor: colors.surfaceAlt, borderStyle: 'dashed', borderColor: colors.borderStrong, borderWidth: 1 },
  segments: { flexDirection: 'row', gap: 6 },
  segmentHit: { flex: 1, paddingVertical: 4 },
  segment: { height: 5, borderRadius: 3, backgroundColor: colors.border },
  stepLabels: { flexDirection: 'row', gap: 6 },
});
