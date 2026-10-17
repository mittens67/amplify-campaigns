import { Dimensions } from 'react-native';
import type { StatusTone } from '@amplify/domain';

/** Small phones (most Android devices are 360–393 dp wide) get a tighter type scale. */
export const isNarrow = Dimensions.get('window').width < 380;
const n = <T,>(narrow: T, regular: T) => (isNarrow ? narrow : regular);

/** Design tokens — calm editorial: ink on slate, one indigo accent. */
export const colors = {
  ink: '#0F172A',
  text: '#1E293B',
  textMuted: '#475569',
  textSubtle: '#64748B',
  placeholder: '#94A3B8',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  bg: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F5F9',
  overlay: 'rgba(15, 23, 42, 0.45)',

  accent: '#4F46E5',
  accentPressed: '#4338CA',
  accentSoft: '#EEF2FF',
  accentBorder: '#C7D2FE',
  accentText: '#3730A3',

  success: '#047857',
  successSoft: '#ECFDF5',
  warning: '#B45309',
  warningSoft: '#FFFBEB',
  danger: '#B91C1C',
  dangerSoft: '#FEF2F2',
  info: '#0369A1',
  infoSoft: '#F0F9FF',

  // Money flow segments
  flowAds: '#4F46E5',
  flowFee: '#94A3B8',
  flowProcessing: '#CBD5E1',
  white: '#FFFFFF',
} as const;

export const toneColors: Record<StatusTone, { fg: string; bg: string; border: string }> = {
  neutral: { fg: colors.textMuted, bg: colors.surfaceAlt, border: colors.border },
  info: { fg: colors.info, bg: colors.infoSoft, border: '#BAE6FD' },
  accent: { fg: colors.accentText, bg: colors.accentSoft, border: colors.accentBorder },
  success: { fg: colors.success, bg: colors.successSoft, border: '#A7F3D0' },
  warning: { fg: colors.warning, bg: colors.warningSoft, border: '#FDE68A' },
  danger: { fg: colors.danger, bg: colors.dangerSoft, border: '#FECACA' },
};

export const categoryTint: Record<string, string> = {
  Environment: '#ECFDF5',
  Health: '#FEF2F2',
  Science: '#F0F9FF',
  Education: '#FFFBEB',
  'Public Policy': '#EEF2FF',
  'Economic Policy': '#F5F3FF',
  Community: '#FFF7ED',
  'Arts & Culture': '#FDF2F8',
  Business: '#F1F5F9',
  Other: '#F1F5F9',
};

export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;

export const fonts = {
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemi: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
  serif: 'SourceSerif4_400Regular',
  serifSemi: 'SourceSerif4_600SemiBold',
  serifBold: 'SourceSerif4_700Bold',
} as const;

export const type = {
  display: { fontFamily: fonts.serifBold, fontSize: n(26, 30), lineHeight: n(32, 36), letterSpacing: -0.4, color: colors.ink },
  title: { fontFamily: fonts.serifSemi, fontSize: n(20, 22), lineHeight: n(26, 28), letterSpacing: -0.2, color: colors.ink },
  cardTitle: { fontFamily: fonts.serifSemi, fontSize: n(17, 19), lineHeight: n(22, 24), color: colors.ink },
  heading: { fontFamily: fonts.sansSemi, fontSize: n(16, 17), lineHeight: n(21, 22), color: colors.ink },
  body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22, color: colors.text },
  bodyStrong: { fontFamily: fonts.sansSemi, fontSize: 15, lineHeight: 22, color: colors.text },
  story: { fontFamily: fonts.serif, fontSize: n(16, 17), lineHeight: n(26, 28), color: colors.text },
  label: { fontFamily: fonts.sansMedium, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  caption: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 16, color: colors.textSubtle },
  overline: { fontFamily: fonts.sansSemi, fontSize: 11, lineHeight: 14, letterSpacing: 0.8, textTransform: 'uppercase' as const, color: colors.textSubtle },
  number: { fontFamily: fonts.sansBold, fontSize: n(20, 22), lineHeight: n(24, 26), color: colors.ink, fontVariant: ['tabular-nums' as const] },
} as const;

export const shadow = {
  card: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  raised: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
} as const;

export const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 };
