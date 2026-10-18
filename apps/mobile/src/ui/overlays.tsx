import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, FadeOutUp, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react-native';
import { create } from 'zustand';
import { GLOSSARY, type GlossaryKey } from '@amplify/domain';
import { useServer } from '@/lib/api';
import { markTask } from '@/lib/tour';
import { IconButton } from './Button';
import { Text } from './Text';
import { colors, radius, shadow, space } from './theme';

/* ---------- Bottom sheet (one at a time) ---------- */

export function Sheet({ visible, onClose, title, children, footer }: { visible: boolean; onClose: () => void; title?: string; children: ReactNode; footer?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={StyleSheet.absoluteFill}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]} onPress={onClose} accessibilityLabel="Close" />
        <Animated.View entering={SlideInDown.duration(260)} style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.lg) }]}>
          <View style={styles.grabber} />
          {title ? (
            <View style={styles.sheetHead}>
              <Text variant="heading" style={{ flex: 1 }} accessibilityRole="header">{title}</Text>
              <IconButton icon={<X size={20} color={colors.textMuted} />} label="Close" onPress={onClose} variant="filled" size={32} />
            </View>
          ) : null}
          <ScrollView bounces={false} contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: space.md, gap: space.md }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={{ paddingHorizontal: space.xl, paddingTop: space.sm }}>{footer}</View> : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

/* ---------- Glossary: tap any unfamiliar concept for a plain-language explanation ---------- */

const useGlossaryStore = create<{ key: GlossaryKey | null; open: (k: GlossaryKey) => void; close: () => void }>((set) => ({
  key: null,
  open: (key) => set({ key }),
  close: () => set({ key: null }),
}));
export const openGlossary = (k: GlossaryKey) => {
  if (k === 'platformFee' || k === 'notDonation' || k === 'processingFee') markTask('learn');
  useGlossaryStore.getState().open(k);
};

export function GlossaryHost() {
  const { key, close } = useGlossaryStore();
  const entry = key ? GLOSSARY[key] : null;
  return (
    <Sheet visible={!!entry} onClose={close} title={entry?.title}>
      <Text variant="body" color={colors.textMuted} style={{ lineHeight: 23 }}>{entry?.body}</Text>
    </Sheet>
  );
}

/* ---------- Toasts ---------- */

type ToastKind = 'success' | 'error' | 'info';
const useToastStore = create<{ toast: { id: number; kind: ToastKind; message: string; action?: { label: string; onPress: () => void } } | null; show: (kind: ToastKind, message: string, action?: { label: string; onPress: () => void }) => void; hide: () => void }>(
  (set) => ({
    toast: null,
    show: (kind, message, action) => set({ toast: { id: Date.now(), kind, message, action } }),
    hide: () => set({ toast: null }),
  }),
);
export const toast = {
  success: (m: string, action?: { label: string; onPress: () => void }) => useToastStore.getState().show('success', m, action),
  error: (m: string) => useToastStore.getState().show('error', m),
  info: (m: string, action?: { label: string; onPress: () => void }) => useToastStore.getState().show('info', m, action),
};

/** Shown while the free-tier server is starting up, so a slow first load doesn't look broken. */
export function WakeBanner() {
  const state = useServer((s) => s.state);
  const insets = useSafeAreaInsets();
  if (state !== 'waking') return null;
  return (
    <Animated.View entering={FadeInDown.duration(200)} exiting={FadeOutUp.duration(150)} pointerEvents="none" style={[styles.toastWrap, { top: insets.top + space.sm }]}>
      <View style={styles.toast} accessibilityLiveRegion="polite">
        <ActivityIndicator size="small" color="#A5B4FC" />
        <Text variant="label" color={colors.white} weight="medium" style={{ flex: 1 }}>
          Waking up the server. The first load can take up to a minute.
        </Text>
      </View>
    </Animated.View>
  );
}

export function ToastHost() {
  const { toast: t, hide } = useToastStore();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!t) return;
    const timer = setTimeout(hide, t.action ? 5000 : 2800);
    return () => clearTimeout(timer);
  }, [t, hide]);
  if (!t) return null;
  const Icon = t.kind === 'success' ? CheckCircle2 : t.kind === 'error' ? XCircle : Info;
  const iconColor = t.kind === 'success' ? '#6EE7B7' : t.kind === 'error' ? '#FCA5A5' : '#A5B4FC';
  return (
    <Animated.View
      key={t.id}
      entering={FadeInDown.duration(200)}
      exiting={FadeOutUp.duration(150)}
      pointerEvents="box-none"
      style={[styles.toastWrap, { top: insets.top + space.sm }]}
    >
      <View style={styles.toast} accessibilityLiveRegion="polite" accessibilityRole="alert">
        <Icon size={18} color={iconColor} />
        <Text variant="label" color={colors.white} weight="medium" style={{ flex: 1 }}>{t.message}</Text>
        {t.action ? (
          <Pressable
            onPress={() => {
              t.action?.onPress();
              hide();
            }}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Text variant="label" weight="bold" color="#A5B4FC">{t.action.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

export function FadeInView({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <Animated.View entering={FadeIn.delay(delay).duration(220)} exiting={FadeOut.duration(120)}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '88%', backgroundColor: colors.surface, borderTopLeftRadius: radius.xl + 4, borderTopRightRadius: radius.xl + 4, ...shadow.raised },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginTop: space.sm, marginBottom: space.xs },
  sheetHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xl, paddingTop: space.sm, paddingBottom: space.md, gap: space.md },
  toastWrap: { position: 'absolute', left: space.lg, right: space.lg, zIndex: 1000 },
  toast: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.ink, borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: space.md, ...shadow.raised },
});
