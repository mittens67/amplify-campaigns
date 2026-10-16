import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { colors, fonts, Text } from '@/ui';

const SIZE = 168;
const RINGS = [
  { r: 34, threshold: 0, dots: 5 },
  { r: 54, threshold: 10, dots: 9 },
  { r: 70, threshold: 35, dots: 13 },
  { r: 84, threshold: 70, dots: 17 },
];

function Ring({ r, on, dots, index }: { r: number; on: boolean; dots: number; index: number }) {
  const v = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    v.value = withSpring(on ? 1 : 0, { damping: 14, stiffness: 120 });
  }, [on, v]);
  const style = useAnimatedStyle(() => ({ opacity: withTiming(v.value, { duration: 200 }), transform: [{ scale: 0.7 + 0.3 * v.value }] }));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, style]}>
      <View
        style={{
          width: r * 2,
          height: r * 2,
          borderRadius: r,
          borderWidth: 1,
          borderColor: index === 0 ? colors.borderStrong : colors.accentBorder,
          borderStyle: index === 0 ? 'solid' : 'dashed',
        }}
      />
      {Array.from({ length: dots }).map((_, i) => {
        const a = (i / dots) * Math.PI * 2 + index * 0.4;
        return (
          <View
            key={i}
            style={[
              styles.dot,
              {
                left: SIZE / 2 + Math.cos(a) * r - 3.5,
                top: SIZE / 2 + Math.sin(a) * r - 3.5,
                backgroundColor: index === 0 ? colors.textSubtle : colors.accent,
                opacity: index === 0 ? 0.7 : 1 - index * 0.12,
              },
            ]}
          />
        );
      })}
    </Animated.View>
  );
}

/** "Outside your bubble": your own network in the middle, new audiences ripple outward as backing grows. */
export function ReachRings({ dollars }: { dollars: number }) {
  return (
    <View style={{ width: SIZE, height: SIZE }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {RINGS.map((ring, i) => (
        <Ring key={i} index={i} r={ring.r} dots={ring.dots} on={dollars >= ring.threshold} />
      ))}
      <View style={styles.center}>
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 10, color: colors.white, textAlign: 'center' }}>Your{'\n'}network</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dot: { position: 'absolute', width: 7, height: 7, borderRadius: 3.5 },
  center: {
    position: 'absolute',
    left: SIZE / 2 - 24,
    top: SIZE / 2 - 24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
