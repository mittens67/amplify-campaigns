import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { ChevronRight, CircleCheck, Circle, PartyPopper, X } from 'lucide-react-native';
import { TASKS, useTour } from '@/lib/tour';
import { Button, colors, IconButton, ProgressBar, radius, Row, shadow, space, Text } from '@/ui';

/** "Get started" checklist on Home: six real actions that teach the product by doing it. */
export function GetStartedChecklist() {
  const router = useRouter();
  const { done, checklistHidden, hideChecklist, startTour, hydrated } = useTour();
  if (!hydrated || checklistHidden) return null;
  const count = TASKS.filter((t) => done[t.key]).length;
  const complete = count === TASKS.length;

  return (
    <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(150)} style={styles.card}>
      <Row style={{ justifyContent: 'space-between' }} align="flex-start">
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="overline" color={colors.accentText}>Get started</Text>
          <Text variant="heading">{complete ? 'You’ve tried everything' : 'Learn Amplify in six small steps'}</Text>
        </View>
        <IconButton icon={<X size={18} color={colors.textMuted} />} label="Hide checklist" size={32} onPress={hideChecklist} />
      </Row>
      <View style={{ gap: 6 }}>
        <ProgressBar value={(count / TASKS.length) * 100} height={6} />
        <Text variant="caption">{count} of {TASKS.length} done · ticks itself off as you go</Text>
      </View>

      {complete ? (
        <View style={styles.done}>
          <PartyPopper size={22} color={colors.accent} />
          <Text variant="label" color={colors.text} style={{ flex: 1 }}>
            Nice — you’ve explored, backed, created and checked your updates. Hide this whenever you like.
          </Text>
        </View>
      ) : (
        <View>
          {TASKS.map((t) => {
            const isDone = !!done[t.key];
            return (
              <Pressable
                key={t.key}
                onPress={() => router.push(t.href as any)}
                style={({ pressed }) => [styles.task, pressed && { backgroundColor: colors.surfaceAlt }]}
                accessibilityRole="button"
                accessibilityLabel={`${t.label}${isDone ? ', done' : ''}`}
              >
                {isDone ? <CircleCheck size={20} color={colors.success} /> : <Circle size={20} color={colors.borderStrong} />}
                <Text variant="label" color={isDone ? colors.textSubtle : colors.ink} weight={isDone ? 'regular' : 'medium'} style={[{ flex: 1 }, isDone && { textDecorationLine: 'line-through' }]}>
                  {t.label}
                </Text>
                {!isDone ? <ChevronRight size={16} color={colors.placeholder} /> : null}
              </Pressable>
            );
          })}
        </View>
      )}
      <Button label="Take the 1-minute tour" variant="ghost" size="sm" onPress={() => startTour('manual')} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: space.lg, gap: space.md, borderWidth: 1, borderColor: colors.accentBorder, ...shadow.card },
  task: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm + 2, paddingHorizontal: space.xs, borderRadius: radius.sm, minHeight: 44 },
  done: { flexDirection: 'row', gap: space.md, alignItems: 'center', backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: space.md },
});
