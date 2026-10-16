import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Send } from 'lucide-react-native';
import { useCampaign } from '@/lib/queries';
import { Button, colors, JourneyRail, radius, space, Text } from '@/ui';

const NEXT = [
  { title: 'Review (typically 2–3 days)', body: 'Reviewers check facts, framing and fairness. You’ll get a notification with their decision.' },
  { title: 'Changes, if any', body: 'If something needs work, you’ll see exactly which fields to update, then resubmit.' },
  { title: 'Open for backing', body: 'Once approved, the campaign goes live and backers can fund distribution for 21 days.' },
  { title: 'Distribution & report', body: 'When funding closes, our team launches the ads. You’ll get measured results and a final report.' },
];

export default function Submitted() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useCampaign(id).data;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xl, gap: space.xl }}>
      <Animated.View entering={ZoomIn.springify().damping(14)} style={{ alignItems: 'center', gap: space.md }}>
        <View style={styles.icon}>
          <Send size={32} color={colors.accent} />
        </View>
        <Text variant="title" align="center">Submitted for review</Text>
        <Text variant="body" color={colors.textMuted} align="center">
          {c?.title ? `“${c.title}” is with our reviewers.` : 'Your campaign is with our reviewers.'} Your content is locked while they check it.
        </Text>
      </Animated.View>
      <View style={styles.card}>
        <JourneyRail status={c?.status ?? 'submitted'} />
      </View>
      <View style={{ gap: space.md }}>
        <Text variant="heading">What happens next</Text>
        {NEXT.map((n, i) => (
          <View key={n.title} style={styles.row}>
            <View style={[styles.num, i === 0 && { backgroundColor: colors.accent }]}>
              {i === 0 ? <Check size={14} color={colors.white} /> : <Text variant="caption" weight="bold" color={colors.textMuted}>{i + 1}</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{n.title}</Text>
              <Text variant="label">{n.body}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={{ gap: space.sm }}>
        <Button label="View your campaigns" onPress={() => router.replace('/me/campaigns')} full />
        <Button label="Back to Home" variant="ghost" onPress={() => router.replace('/')} full />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  icon: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: colors.bg, borderRadius: radius.lg, padding: space.lg },
  row: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  num: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
});
