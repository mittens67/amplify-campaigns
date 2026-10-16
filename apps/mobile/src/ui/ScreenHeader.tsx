import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, X } from 'lucide-react-native';
import { IconButton } from './Button';
import { Text } from './Text';
import { colors, space } from './theme';

/** Consistent top bar: back (or close for modals), centred title, optional right action. */
export function ScreenHeader({
  title,
  subtitle,
  right,
  close,
  onBack,
  border = true,
  large,
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  close?: boolean;
  onBack?: () => void;
  border?: boolean;
  large?: boolean;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + space.xs }, border && styles.border]}>
      <View style={styles.bar}>
        <IconButton
          icon={close ? <X size={22} color={colors.ink} /> : <ArrowLeft size={22} color={colors.ink} />}
          label={close ? 'Close' : 'Back'}
          onPress={back}
        />
        <View style={styles.titleWrap}>
          {title && !large ? (
            <Text variant="heading" numberOfLines={1} accessibilityRole="header">{title}</Text>
          ) : null}
          {subtitle ? <Text variant="caption" numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        <View style={styles.right}>{right}</View>
      </View>
      {large && title ? (
        <Text variant="display" style={{ paddingHorizontal: space.lg, paddingBottom: space.md }} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
    </View>
  );
}

/** Top-level tab screen title. */
export function TabTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + space.md, paddingHorizontal: space.lg, paddingBottom: space.md, flexDirection: 'row', alignItems: 'flex-end', gap: space.md }}>
      <View style={{ flex: 1 }}>
        <Text variant="display" accessibilityRole="header">{title}</Text>
        {subtitle ? <Text variant="label" style={{ marginTop: 4 }}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.surface },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  bar: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, gap: space.xs },
  titleWrap: { flex: 1, alignItems: 'center' },
  right: { minWidth: 40, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
});
