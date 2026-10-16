import { StyleSheet, View } from 'react-native';
import { colors, space, Text } from '@/ui';

/** Minimal daily bar chart — enough to show momentum without a charting library. */
export function Bars({ values, labels, color = colors.accent, height = 72, formatMax }: { values: number[]; labels?: [string, string]; color?: string; height?: number; formatMax?: (n: number) => string }) {
  const max = Math.max(1, ...values);
  if (!values.length) return <Text variant="caption">No data yet.</Text>;
  return (
    <View accessibilityLabel={`Daily values, peak ${formatMax ? formatMax(max) : max}`}>
      <View style={[styles.wrap, { height }]}>
        {values.map((v, i) => (
          <View key={i} style={{ flex: 1, justifyContent: 'flex-end', height }}>
            <View style={{ height: Math.max(2, (v / max) * height), backgroundColor: color, borderRadius: 2, opacity: i === values.length - 1 ? 1 : 0.75 }} />
          </View>
        ))}
      </View>
      {labels ? (
        <View style={styles.labels}>
          <Text variant="caption" style={{ fontSize: 11 }}>{labels[0]}</Text>
          {formatMax ? <Text variant="caption" style={{ fontSize: 11 }}>peak {formatMax(max)}</Text> : null}
          <Text variant="caption" style={{ fontSize: 11 }}>{labels[1]}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.xs },
});
