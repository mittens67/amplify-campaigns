import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { AlertTriangle, ChevronDown, ChevronRight, CloudOff, type LucideIcon } from 'lucide-react-native';
import { STATUS_LABEL, STATUS_TONE, type CampaignStatus, type StatusTone } from '@amplify/domain';
import { haptic } from '@/lib/haptics';
import { Button } from './Button';
import { Text } from './Text';
import { colors, hitSlop, radius, shadow, space, toneColors } from './theme';

/* ---------- Layout ---------- */

export function Card({ children, style, padded = true, onPress, accessibilityLabel }: { children: ReactNode; style?: ViewStyle; padded?: boolean; onPress?: () => void; accessibilityLabel?: string }) {
  const inner = [styles.card, padded && { padding: space.lg }, style];
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [...inner, pressed && { opacity: 0.92, transform: [{ scale: 0.995 }] }]}>
        {children}
      </Pressable>
    );
  }
  return <View style={inner}>{children}</View>;
}

export function Divider({ inset = 0, style }: { inset?: number; style?: ViewStyle }) {
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: inset }, style]} />;
}

export function Row({ children, gap = space.sm, style, align = 'center' }: { children: ReactNode; gap?: number; style?: ViewStyle; align?: ViewStyle['alignItems'] }) {
  return <View style={[{ flexDirection: 'row', alignItems: align, gap }, style]}>{children}</View>;
}

export function SectionHeader({ title, action, onAction, subtitle }: { title: string; subtitle?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: space.md }}>
      <View style={{ flex: 1 }}>
        <Text variant="title">{title}</Text>
        {subtitle ? <Text variant="label" style={{ marginTop: 2 }}>{subtitle}</Text> : null}
      </View>
      {action ? (
        <Pressable onPress={onAction} hitSlop={hitSlop} accessibilityRole="button">
          <Text variant="label" color={colors.accent} weight="semi">{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/* ---------- Chips & pills ---------- */

export function Chip({ label, selected, onPress, icon, tint, count, size = 'md' }: { label: string; selected?: boolean; onPress?: () => void; icon?: ReactNode; tint?: string; count?: number; size?: 'sm' | 'md' }) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected: !!selected }}
      onPress={() => {
        haptic('select');
        onPress?.();
      }}
      disabled={!onPress}
      hitSlop={size === 'sm' ? hitSlop : undefined}
      style={({ pressed }) => [
        styles.chip,
        size === 'sm' && { height: 28, paddingHorizontal: space.sm + 2 },
        selected
          ? { backgroundColor: colors.ink, borderColor: colors.ink }
          : { backgroundColor: tint ?? colors.surface, borderColor: tint ? 'transparent' : colors.border },
        pressed && { opacity: 0.8 },
      ]}
    >
      {icon}
      <Text variant="label" weight="medium" color={selected ? colors.white : colors.text} numberOfLines={1}>
        {label}
      </Text>
      {count ? (
        <View style={[styles.count, { backgroundColor: selected ? 'rgba(255,255,255,0.2)' : colors.surfaceAlt }]}>
          <Text variant="caption" weight="semi" color={selected ? colors.white : colors.textMuted}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function Pill({ label, tone = 'neutral', icon }: { label: string; tone?: StatusTone; icon?: ReactNode }) {
  const t = toneColors[tone];
  return (
    <View style={[styles.pill, { backgroundColor: t.bg, borderColor: t.border }]}>
      {icon}
      <Text variant="caption" weight="semi" color={t.fg} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export function StatusPill({ status }: { status: CampaignStatus }) {
  return <Pill label={STATUS_LABEL[status]} tone={STATUS_TONE[status]} />;
}

export function DemoTag() {
  return (
    <View style={styles.demo} accessibilityLabel="Demonstration data">
      <Text variant="caption" weight="semi" color={colors.textSubtle} style={{ fontSize: 10 }}>DEMO DATA</Text>
    </View>
  );
}

/* ---------- Progress ---------- */

export function ProgressBar({ value, height = 8, color = colors.accent, track = colors.surfaceAlt, animate = true }: { value: number; height?: number; color?: string; track?: string; animate?: boolean }) {
  const pct = Math.max(0, Math.min(100, value));
  const w = useSharedValue(animate ? 0 : pct);
  useEffect(() => {
    w.value = animate ? withTiming(pct, { duration: 600 }) : pct;
  }, [pct, animate, w]);
  const fill = useAnimatedStyle(() => ({ width: `${w.value}%` }));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
      style={{ height, borderRadius: height, backgroundColor: track, overflow: 'hidden' }}
    >
      <Animated.View style={[{ height, borderRadius: height, backgroundColor: color, minWidth: pct > 0 ? height : 0 }, fill]} />
    </View>
  );
}

/* ---------- Loading / empty / error ---------- */

export function Skeleton({ width = '100%', height = 14, radius: r = 6, style }: { width?: number | `${number}%`; height?: number; radius?: number; style?: ViewStyle }) {
  const o = useSharedValue(0.55);
  useEffect(() => {
    o.value = withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0.55, { duration: 700 })), -1);
  }, [o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ width, height, borderRadius: r, backgroundColor: colors.border }, a, style]} />;
}

export function CardSkeleton() {
  return (
    <View style={[styles.card, { overflow: 'hidden' }]} accessibilityLabel="Loading">
      <Skeleton height={190} radius={0} />
      <View style={{ padding: space.lg, gap: space.sm }}>
        <Skeleton width={90} height={12} />
        <Skeleton width="90%" height={20} />
        <Skeleton width="60%" height={20} />
        <Skeleton width="100%" height={8} style={{ marginTop: space.sm }} />
      </View>
    </View>
  );
}

export function EmptyState({ icon: Icon, title, body, action, onAction }: { icon: LucideIcon; title: string; body?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.state}>
      <View style={styles.stateIcon}>
        <Icon size={26} color={colors.accent} strokeWidth={1.8} />
      </View>
      <Text variant="heading" align="center">{title}</Text>
      {body ? <Text variant="body" color={colors.textMuted} align="center" style={{ maxWidth: 300 }}>{body}</Text> : null}
      {action ? <Button label={action} variant="secondary" onPress={onAction} style={{ marginTop: space.sm }} /> : null}
    </View>
  );
}

export function ErrorState({ error, onRetry, compact }: { error: unknown; onRetry?: () => void; compact?: boolean }) {
  const offline = (error as any)?.code === 'NETWORK';
  const message = (error as any)?.message ?? 'Something went wrong.';
  const [busy, setBusy] = useState(false);
  return (
    <View style={[styles.state, compact && { paddingVertical: space.xl }]}>
      <View style={[styles.stateIcon, { backgroundColor: offline ? colors.surfaceAlt : colors.dangerSoft }]}>
        {offline ? <CloudOff size={24} color={colors.textMuted} /> : <AlertTriangle size={24} color={colors.danger} />}
      </View>
      <Text variant="heading" align="center">{offline ? 'Can’t reach the server' : 'That didn’t load'}</Text>
      <Text variant="body" color={colors.textMuted} align="center" style={{ maxWidth: 300 }}>
        {offline ? 'The demo server may be waking up. This can take up to a minute the first time.' : message}
      </Text>
      {onRetry ? (
        <Button
          label="Try again"
          variant="secondary"
          loading={busy}
          onPress={async () => {
            setBusy(true);
            try {
              await onRetry();
            } finally {
              setBusy(false);
            }
          }}
          style={{ marginTop: space.sm }}
        />
      ) : null}
    </View>
  );
}

/* ---------- Disclosure ---------- */

export function Accordion({ title, subtitle, icon, children, initiallyOpen = false }: { title: string; subtitle?: string; icon?: ReactNode; children: ReactNode; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <View style={styles.accordion}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => {
          haptic('select');
          setOpen((o) => !o);
        }}
        style={({ pressed }) => [styles.accordionHead, pressed && { backgroundColor: colors.surfaceAlt }]}
      >
        {icon ? <View style={styles.accordionIcon}>{icon}</View> : null}
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">{title}</Text>
          {subtitle ? <Text variant="caption" style={{ marginTop: 2 }}>{subtitle}</Text> : null}
        </View>
        <ChevronDown size={20} color={colors.textSubtle} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
      </Pressable>
      {open ? <View style={styles.accordionBody}>{children}</View> : null}
    </View>
  );
}

export function ListRow({ icon, title, subtitle, onPress, right, danger }: { icon?: ReactNode; title: string; subtitle?: string; onPress?: () => void; right?: ReactNode; danger?: boolean }) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.listRow, pressed && { backgroundColor: colors.surfaceAlt }]}
    >
      {icon ? <View style={{ width: 28, alignItems: 'center' }}>{icon}</View> : null}
      <View style={{ flex: 1 }}>
        <Text variant="body" color={danger ? colors.danger : colors.ink} weight="medium">{title}</Text>
        {subtitle ? <Text variant="caption" style={{ marginTop: 2 }}>{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <ChevronRight size={18} color={colors.placeholder} /> : null)}
    </Pressable>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { key: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              haptic('select');
              onChange(o.key);
            }}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text variant="label" weight="semi" color={active ? colors.ink : colors.textMuted}>
              {o.label}
              {o.count ? `  ${o.count}` : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Notice({ tone = 'info', title, children, icon }: { tone?: StatusTone; title?: string; children?: ReactNode; icon?: ReactNode }) {
  const t = toneColors[tone];
  return (
    <View style={[styles.notice, { backgroundColor: t.bg, borderColor: t.border }]}>
      {icon}
      <View style={{ flex: 1, gap: 2 }}>
        {title ? <Text variant="bodyStrong" color={t.fg}>{title}</Text> : null}
        {typeof children === 'string' ? <Text variant="label" color={colors.text}>{children}</Text> : children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...shadow.card },
  chip: { height: 36, paddingHorizontal: space.md + 2, borderRadius: radius.pill, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  count: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, borderWidth: 1, alignSelf: 'flex-start' },
  demo: { borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, alignSelf: 'flex-start' },
  state: { alignItems: 'center', justifyContent: 'center', paddingVertical: space.xxxl, paddingHorizontal: space.xl, gap: space.sm },
  stateIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  accordion: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  accordionHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.lg, minHeight: 56 },
  accordionIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  accordionBody: { paddingBottom: space.lg, gap: space.md },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md + 2, paddingHorizontal: space.lg, minHeight: 52 },
  segmented: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 3 },
  segment: { flex: 1, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm + 2 },
  segmentActive: { backgroundColor: colors.surface, ...shadow.card },
  notice: { flexDirection: 'row', gap: space.md, padding: space.md + 2, borderRadius: radius.md, borderWidth: 1, alignItems: 'flex-start' },
});
