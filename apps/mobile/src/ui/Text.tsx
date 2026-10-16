import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { colors, type as typeScale } from './theme';

export type TextVariant = keyof typeof typeScale;

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  color?: string;
  align?: TextStyle['textAlign'];
  weight?: 'regular' | 'medium' | 'semi' | 'bold';
}

const sansWeight = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semi: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export function Text({ variant = 'body', color, align, weight, style, ...rest }: AppTextProps) {
  const base = typeScale[variant] as TextStyle;
  const isSerif = String(base.fontFamily).startsWith('SourceSerif');
  return (
    <RNText
      maxFontSizeMultiplier={1.4}
      {...rest}
      style={[
        base,
        weight && !isSerif ? { fontFamily: sansWeight[weight] } : null,
        color ? { color } : null,
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}

export const Muted = (p: AppTextProps) => <Text color={colors.textMuted} {...p} />;
