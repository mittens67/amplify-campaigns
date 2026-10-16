import React, { forwardRef, useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { Text } from './Text';
import { colors, fonts, radius, space } from './theme';

export interface TextFieldProps extends TextInputProps {
  label?: string;
  hint?: string;
  error?: string | null;
  maxChars?: number;
  optional?: boolean;
  left?: ReactNode;
  right?: ReactNode;
  /** Shown under the label, e.g. "✦ Suggested" chips */
  badge?: ReactNode;
}

export const TextField = forwardRef<React.ComponentRef<typeof TextInput>, TextFieldProps>(function TextField(
  { label, hint, error, maxChars, optional, left, right, badge, multiline, style, value, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const length = value?.length ?? 0;
  const over = maxChars != null && length > maxChars;
  const borderColor = error || over ? colors.danger : focused ? colors.accent : colors.borderStrong;
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <View style={styles.labelRow}>
          <Text variant="label" weight="semi" color={colors.text}>
            {label}
            {optional ? <Text variant="label" color={colors.textSubtle}> (optional)</Text> : null}
          </Text>
          {badge}
        </View>
      ) : null}
      <View style={[styles.box, { borderColor, borderWidth: focused || error ? 1.5 : 1 }, multiline && { alignItems: 'flex-start' }]}>
        {left}
        <TextInput
          ref={ref}
          value={value}
          multiline={multiline}
          placeholderTextColor={colors.placeholder}
          accessibilityLabel={label}
          accessibilityHint={hint}
          maxFontSizeMultiplier={1.3}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, multiline && { minHeight: 96, textAlignVertical: 'top', paddingTop: 12 }, style]}
          {...rest}
        />
        {right}
      </View>
      {error || hint || maxChars ? (
        <View style={styles.footer}>
          {error ? (
            <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center', flex: 1 }}>
              <AlertCircle size={14} color={colors.danger} />
              <Text variant="caption" color={colors.danger} style={{ flex: 1 }} accessibilityLiveRegion="polite">{error}</Text>
            </View>
          ) : (
            <Text variant="caption" style={{ flex: 1 }}>{hint ?? ''}</Text>
          )}
          {maxChars ? (
            <Text variant="caption" color={over ? colors.danger : colors.textSubtle} style={{ fontVariant: ['tabular-nums'] }}>
              {length}/{maxChars}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  box: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: space.md, minHeight: 50, gap: space.sm },
  input: { flex: 1, fontFamily: fonts.sans, fontSize: 16, color: colors.ink, paddingVertical: 12 },
  footer: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
});
