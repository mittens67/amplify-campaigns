import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CloudOff, Eye, MessageSquareWarning, RefreshCw, X } from 'lucide-react-native';
import {
  completedSteps,
  estimateReachAtGoal,
  stepOfField,
  STEPS,
  validateStep,
  type CampaignContent,
  type CampaignDetailDTO,
  type FieldErrors,
  type StepKey,
} from '@amplify/domain';
import { CampaignView } from '@/features/campaign/CampaignView';
import { reloadFromServer, syncDraft, useDrafts, type Draft } from '@/features/create/draftStore';
import { BasicsStep } from '@/features/create/steps/Basics';
import { ReachStep } from '@/features/create/steps/Reach';
import { StoryStep } from '@/features/create/steps/Story';
import { SubmitStep } from '@/features/create/steps/Submit';
import { VisualsStep } from '@/features/create/steps/Visuals';
import { StepBar, Wizard, type WizardCtx } from '@/features/create/WizardKit';
import { api, ApiError, errorMessage } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { relativeTime } from '@/lib/format';
import { keys, queryClient, useCampaign } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { Button, colors, IconButton, Notice, radius, Row, space, Text, toast } from '@/ui';

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(s);

function SaveStatus({ d }: { d: Draft }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 20_000);
    return () => clearInterval(t);
  }, []);
  const map: Record<Draft['sync'], { text: string; color: string }> = {
    saved: { text: d.savedAt ? `Saved ${relativeTime(new Date(d.savedAt).toISOString())}` : 'Saved', color: colors.textSubtle },
    saving: { text: 'Saving…', color: colors.textSubtle },
    pending: { text: 'Saved on this device', color: colors.textSubtle },
    offline: { text: 'Offline · saved on this device', color: colors.warning },
    conflict: { text: 'Changed on another device', color: colors.danger },
    locked: { text: 'Locked while under review', color: colors.textMuted },
  };
  const s = map[d.sync];
  return (
    <Row gap={4}>
      {d.sync === 'offline' ? <CloudOff size={12} color={s.color} /> : null}
      <Text variant="caption" color={s.color} accessibilityLiveRegion="polite">{s.text}</Text>
    </Row>
  );
}

/** Build a campaign-page model from a draft so the preview uses the real published layout. */
function previewModel(content: CampaignContent, base?: CampaignDetailDTO): CampaignDetailDTO {
  const goal = content.submit.goalCents ?? 0;
  return {
    id: base?.id ?? 'preview',
    status: 'available_for_funding',
    title: content.basics.title,
    summary: content.basics.summary,
    category: content.basics.category ?? null,
    creatorName: content.basics.creatorName,
    creatorType: content.basics.creatorType ?? null,
    coverUrl: content.basics.cover?.url ?? null,
    raisedCents: 0,
    goalCents: goal,
    backerCount: 0,
    fundingEndsAt: null,
    publishedAt: null,
    estReachAtGoal: estimateReachAtGoal(goal),
    featured: false,
    isDemo: false,
    updatedAt: new Date().toISOString(),
    content,
    reachModelVersion: 1,
    reviews: [],
    timeline: [],
    updates: [],
    publicBackers: [],
    delivery: null,
    feedback: { visuals: { no: 0, somewhat: 0, yes: 0 }, mind: { no: 0, somewhat: 0, yes: 0 } },
    viewer: { isOwner: true, saved: false, following: false, contributedCents: 0, feedback: {} },
  };
}

export default function WizardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const draft = useDrafts((s) => s.drafts[id] ?? Object.values(s.drafts).find((d) => d.serverId === id));
  const { update: updateDraft, setStep, adopt } = useDrafts.getState();
  const serverId = draft?.serverId ?? (isUuid(id) ? id : undefined);
  const server = useCampaign(serverId);
  const user = useSession((s) => s.user);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [shown, setShown] = useState<Partial<Record<StepKey, boolean>>>({});
  const [preview, setPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [keyboard, setKeyboard] = useState(false);

  // Open a server-only draft (e.g. a campaign returned with requested changes).
  useEffect(() => {
    if (draft || !server.data?.draft) return;
    adopt(server.data.id, server.data.draft.content, server.data.draft.version);
  }, [draft, server.data, adopt]);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const content = draft?.content;
  const step = draft?.step ?? 'basics';
  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const notes = server.data?.status === 'changes_requested' ? server.data.draft?.reviewerNotes ?? {} : {};
  const reviewerMessage = server.data?.status === 'changes_requested' ? server.data.draft?.reviewerMessage : null;

  const errors: FieldErrors = useMemo(() => {
    if (!content) return {};
    const out: FieldErrors = {};
    for (const s of STEPS) if (shown[s.key]) Object.assign(out, validateStep(s.key, content));
    return out;
  }, [content, shown]);

  if (!draft || !content) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        {server.isError ? (
          <>
            <Text variant="heading">Couldn’t open this draft</Text>
            <Text variant="label">{errorMessage(server.error)}</Text>
            <Button label="Close" variant="secondary" onPress={() => router.back()} />
          </>
        ) : (
          <ActivityIndicator color={colors.accent} />
        )}
      </View>
    );
  }

  const key = draft.key;
  const ctx: WizardCtx = {
    content,
    update: (mutate, paths) => updateDraft(key, mutate, paths),
    errors,
    notes,
    goTo: (s) => {
      setStep(key, s);
      setPreview(false);
      requestAnimationFrame(() => scroll.current?.scrollTo({ y: 0, animated: false }));
    },
  };
  const done = completedSteps(content);

  const exit = async () => {
    void syncDraft(key);
    toast.success('Draft saved — continue any time from Create');
    router.back();
  };

  const next = () => {
    const errs = validateStep(step, content);
    setShown((s) => ({ ...s, [step]: true }));
    if (Object.keys(errs).length) {
      haptic('warning');
      toast.info(`${Object.keys(errs).length} field${Object.keys(errs).length === 1 ? ' needs' : 's need'} attention`, {
        label: 'Skip for now',
        onPress: () => ctx.goTo(STEPS[stepIndex + 1].key),
      });
      return;
    }
    haptic('success');
    ctx.goTo(STEPS[stepIndex + 1].key);
  };

  const submit = async () => {
    const all = Object.fromEntries(STEPS.map((s) => [s.key, true]));
    setShown(all);
    const errs = STEPS.flatMap((s) => Object.keys(validateStep(s.key, content)));
    if (errs.length) {
      haptic('warning');
      const firstStep = stepOfField(errs[0]);
      toast.error(`Finish ${errs.length} item${errs.length === 1 ? '' : 's'} before submitting`);
      if (firstStep !== 'submit') ctx.goTo(firstStep);
      return;
    }
    if (!user) {
      router.push({ pathname: '/sign-in', params: { reason: 'submit' } });
      return;
    }
    setSubmitting(true);
    try {
      await syncDraft(key);
      const sid = useDrafts.getState().drafts[key]?.serverId;
      if (!sid) throw new ApiError(0, 'NETWORK', 'Couldn’t save your draft to the server. Check your connection and try again.');
      await api(`/campaigns/${sid}/submit`, { method: 'POST' });
      haptic('success');
      useDrafts.getState().patch(key, { sync: 'locked' });
      void queryClient.invalidateQueries({ queryKey: keys.myCampaigns });
      void queryClient.invalidateQueries({ queryKey: keys.campaign(sid) });
      router.replace({ pathname: '/create/submitted', params: { id: sid } });
    } catch (e) {
      if (e instanceof ApiError && e.fields) {
        const first = Object.keys(e.fields)[0];
        if (first) ctx.goTo(stepOfField(first));
      }
      toast.error(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (preview) {
    return (
      <View style={{ flex: 1 }}>
        <CampaignView c={previewModel(content, server.data)} preview onBack={() => setPreview(false)} />
        <Animated.View entering={FadeIn} exiting={FadeOut} style={[styles.previewBanner, { bottom: insets.bottom + space.lg }]}>
          <Eye size={16} color={colors.white} />
          <Text variant="label" color={colors.white} weight="semi" style={{ flex: 1 }}>Previewing as the audience</Text>
          <Pressable onPress={() => setPreview(false)} hitSlop={10} accessibilityRole="button">
            <Text variant="label" weight="bold" color="#A5B4FC">Back to editing</Text>
          </Pressable>
        </Animated.View>
      </View>
    );
  }

  const locked = draft.sync === 'locked' || (server.data && !['draft', 'changes_requested'].includes(server.data.status));

  return (
    <Wizard.Provider value={ctx}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { paddingTop: insets.top + space.xs }]}>
          <Row style={{ height: 48 }}>
            <IconButton icon={<X size={22} color={colors.ink} />} label="Save and exit" onPress={exit} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text variant="label" weight="semi" color={colors.ink} numberOfLines={1}>
                Step {stepIndex + 1} of 5 · {STEPS[stepIndex].label}
              </Text>
              <SaveStatus d={draft} />
            </View>
            <IconButton icon={<Eye size={20} color={colors.ink} />} label="Preview campaign" onPress={() => setPreview(true)} />
          </Row>
          <View style={{ paddingHorizontal: space.lg, paddingBottom: space.md }}>
            <StepBar current={step} completed={done} onSelect={ctx.goTo} />
          </View>
        </View>

        <ScrollView ref={scroll} contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
          {reviewerMessage ? (
            <Notice tone="warning" title="Reviewer requested changes" icon={<MessageSquareWarning size={18} color={colors.warning} />}>
              <Text variant="label" color={colors.text}>{reviewerMessage}</Text>
              <Text variant="caption" style={{ marginTop: 4 }}>Flagged fields are marked below. Resubmit when you’re ready.</Text>
            </Notice>
          ) : null}
          {draft.sync === 'conflict' ? (
            <Notice tone="danger" title="This draft changed on another device">
              <Button label="Load the latest version" variant="secondary" size="sm" icon={<RefreshCw size={14} color={colors.ink} />} onPress={() => void reloadFromServer(key)} style={{ marginTop: 6, alignSelf: 'flex-start' }} />
            </Notice>
          ) : null}
          {locked ? <Notice tone="info" title="Under review">Content is locked while reviewers check it. You’ll be notified when there’s a decision.</Notice> : null}

          <View pointerEvents={locked ? 'none' : 'auto'} style={locked ? { opacity: 0.6 } : undefined}>
            {step === 'basics' ? <BasicsStep /> : null}
            {step === 'story' ? <StoryStep /> : null}
            {step === 'visuals' ? <VisualsStep /> : null}
            {step === 'reach' ? <ReachStep /> : null}
            {step === 'submit' ? <SubmitStep onPreview={() => setPreview(true)} /> : null}
          </View>
        </ScrollView>

        {!keyboard ? (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
            {stepIndex > 0 ? (
              <Button label="Back" variant="secondary" onPress={() => ctx.goTo(STEPS[stepIndex - 1].key)} style={{ flex: 1 }} />
            ) : (
              <Button label="Save & exit" variant="secondary" onPress={exit} style={{ flex: 1 }} />
            )}
            {step === 'submit' ? (
              <Button label={server.data?.status === 'changes_requested' ? 'Resubmit for review' : 'Submit for review'} onPress={submit} loading={submitting} disabled={!!locked} style={{ flex: 2 }} />
            ) : (
              <Button label={`Continue to ${STEPS[stepIndex + 1].label}`} onPress={next} style={{ flex: 2 }} />
            )}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Wizard.Provider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, backgroundColor: colors.bg, padding: space.xl },
  header: { backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingHorizontal: space.sm },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  previewBanner: { position: 'absolute', left: space.lg, right: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.ink, borderRadius: radius.pill, paddingHorizontal: space.lg, paddingVertical: space.md },
});

