import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps, type ViewStyle } from 'react-native';
import { haptic } from '@/lib/haptics';
import { Text } from './Text';
import { colors, hitSlop, radius, space } from './theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet';
type Size = 'md' | 'lg' | 'sm';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
  full?: boolean;
  style?: ViewStyle;
}

const palette: Record<Variant, { bg: string; bgPressed: string; fg: string; border?: string }> = {
  primary: { bg: colors.accent, bgPressed: colors.accentPressed, fg: colors.white },
  secondary: { bg: colors.surface, bgPressed: colors.surfaceAlt, fg: colors.ink, border: colors.borderStrong },
  ghost: { bg: 'transparent', bgPressed: colors.accentSoft, fg: colors.accent },
  quiet: { bg: colors.surfaceAlt, bgPressed: colors.border, fg: colors.ink },
  danger: { bg: colors.surface, bgPressed: colors.dangerSoft, fg: colors.danger, border: '#FECACA' },
};

const heights: Record<Size, number> = { sm: 36, md: 48, lg: 54 };

export function Button({ label, variant = 'primary', size = 'md', icon, iconRight, loading, full, disabled, style, onPress, ...rest }: ButtonProps) {
  const p = palette[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      hitSlop={size === 'sm' ? hitSlop : undefined}
      disabled={inactive}
      onPress={(e) => {
        if (variant === 'primary') haptic('light');
        onPress?.(e);
      }}
      style={({ pressed }) => [
        styles.base,
        {
          height: heights[size],
          paddingHorizontal: size === 'sm' ? space.md : space.xl,
          backgroundColor: pressed ? p.bgPressed : p.bg,
          borderColor: p.border ?? 'transparent',
          borderWidth: p.border ? 1 : 0,
          opacity: disabled ? 0.45 : 1,
          alignSelf: full ? 'stretch' : 'auto',
        },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text variant={size === 'sm' ? 'label' : 'bodyStrong'} color={p.fg} numberOfLines={1} weight="semi">
            {label}
          </Text>
          {iconRight}
        </View>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  variant = 'plain',
  size = 40,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  onPress?: () => void;
  variant?: 'plain' | 'filled' | 'overlay';
  size?: number;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.4 : 1,
          backgroundColor:
            variant === 'filled'
              ? pressed
                ? colors.border
                : colors.surfaceAlt
              : variant === 'overlay'
                ? 'rgba(255,255,255,0.92)'
                : pressed
                  ? colors.surfaceAlt
                  : 'transparent',
        },
      ]}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
