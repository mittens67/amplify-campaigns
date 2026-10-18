import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { Check, Keyboard, Mic, Sparkles, Square } from 'lucide-react-native';
import { emptyContent } from '@amplify/domain';
import { applyAiDraft, type AiDraftResult } from '@/features/create/aiDraft';
import { useDrafts } from '@/features/create/draftStore';
import { api, apiUpload, errorMessage } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { Button, colors, fonts, Notice, radius, Row, ScreenHeader, space, Text, toast } from '@/ui';

const QUESTIONS = [
  { key: 'about', q: 'What is your campaign about?', hint: 'Say it like you’d explain it to a friend.' },
  { key: 'audience', q: 'Who needs to hear this message?', hint: 'Where do they live? What do they care about?' },
  { key: 'why', q: 'Why does it matter right now?', hint: 'What changes if people hear it?' },
  { key: 'evidence', q: 'What evidence backs it up?', hint: 'Name your sources — reports, agencies, studies.' },
  { key: 'action', q: 'What should people do after seeing it?', hint: 'One to three simple actions.' },
] as const;
type Key = (typeof QUESTIONS)[number]['key'];

const SAMPLE: Record<Key, string> = {
  about: 'Heat safety for outdoor workers. Delivery riders, farm workers and construction crews are working through record heat and most don’t know the warning signs of heat stroke.',
  audience: 'Outdoor workers and their employers in Arizona and Texas, plus families who can share the message.',
  why: 'Heat is the leading weather-related killer in the US and the deaths are preventable with water, rest and shade.',
  evidence: 'CDC heat-related illness guidance and OSHA heat injury prevention data. Maricopa County recorded over 600 heat deaths in 2023.',
  action: 'Learn the warning signs, take water rest shade breaks, and ask employers for a heat plan.',
};

function Pulse({ active }: { active: boolean }) {
  const s = useSharedValue(1);
  useEffect(() => {
    s.value = active ? withRepeat(withTiming(1.35, { duration: 800 }), -1, true) : withTiming(1);
  }, [active, s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }], opacity: active ? 0.35 : 0 }));
  return <Animated.View style={[styles.pulse, style]} />;
}

export default function VoiceInterview() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const rec = useAudioRecorderState(recorder);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<Key, string>>({ about: '', audience: '', why: '', evidence: '', action: '' });
  const [typing, setTyping] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [drafting, setDrafting] = useState<string | null>(null);
  const [voiceOk, setVoiceOk] = useState<boolean | null>(null);
  const [sample, setSample] = useState(false);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const q = QUESTIONS[i];
  const isLast = i === QUESTIONS.length - 1;

  useEffect(() => {
    api<{ voice: boolean }>('/ai/status').then((s) => setVoiceOk(s.voice)).catch(() => setVoiceOk(false));
  }, []);

  const startRecording = async () => {
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) {
      toast.error('Microphone access is off. You can type your answers instead.');
      setTyping(true);
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    haptic('medium');
  };

  const stopRecording = async () => {
    await recorder.stop();
    haptic('light');
    const uri = recorder.uri;
    if (!uri) return;
    setTranscribing(true);
    try {
      const res = await apiUpload<{ text: string }>('/ai/transcribe', {
        field: 'audio',
        uri,
        name: Platform.OS === 'web' ? 'answer.webm' : 'answer.m4a',
        type: Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4',
        timeoutMs: 40_000,
      });
      if (!res.text) toast.info('We didn’t catch that. Try again or type it.');
      setAnswers((a) => ({ ...a, [q.key]: [a[q.key], res.text].filter(Boolean).join(' ') }));
    } catch (e) {
      toast.error(errorMessage(e));
      setTyping(true);
    } finally {
      setTranscribing(false);
    }
  };

  const useSample = () => {
    setAnswers(SAMPLE);
    setSample(true);
    setI(QUESTIONS.length - 1);
    toast.info('Sample answers filled in — edit any of them');
  };

  const draft = async () => {
    setDrafting('Drafting your title and summary…');
    const stages = ['Writing the story…', 'Suggesting ad copy…', 'Almost there…'];
    let n = 0;
    const timer = setInterval(() => setDrafting(stages[Math.min(n++, stages.length - 1)]), 1400);
    try {
      const res = await api<AiDraftResult>('/ai/draft', { method: 'POST', body: { ...answers, sample }, timeoutMs: 30_000 });
      const content = emptyContent();
      content.basics.prompts = { about: answers.about, audience: answers.audience, why: answers.why, evidence: answers.evidence };
      applyAiDraft(content, res.draft);
      const key = useDrafts.getState().create(content);
      haptic('success');
      router.replace({ pathname: '/create/[id]', params: { id: key } });
      toast.success('Draft ready. Everything marked “Suggested” is yours to edit.');
    } catch (e) {
      toast.error(`${errorMessage(e)} You can continue manually.`);
    } finally {
      clearInterval(timer);
      setDrafting(null);
    }
  };

  const manual = () => {
    const content = emptyContent();
    content.basics.prompts = { about: answers.about, audience: answers.audience, why: answers.why, evidence: answers.evidence };
    content.story.actions = answers.action ? [answers.action] : [];
    const key = useDrafts.getState().create(content);
    router.replace({ pathname: '/create/[id]', params: { id: key } });
  };

  if (drafting) {
    return (
      <View style={[styles.drafting, { paddingTop: insets.top }]}>
        <Animated.View entering={FadeIn} style={{ alignItems: 'center', gap: space.lg }}>
          <View style={styles.sparkle}>
            <Sparkles size={30} color={colors.accent} />
          </View>
          <Text variant="title" align="center">{drafting}</Text>
          <Text variant="label" align="center" style={{ maxWidth: 280 }}>AI drafts suggestions from your answers. You’ll review and edit every field — it never sets your funding goal.</Text>
          <ActivityIndicator color={colors.accent} />
        </Animated.View>
      </View>
    );
  }

  const answered = QUESTIONS.filter((x) => answers[x.key].trim()).length;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader close title="Talk it through" subtitle={`Question ${i + 1} of ${QUESTIONS.length}`} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
        <View style={styles.progress}>
          {QUESTIONS.map((x, n) => (
            <Pressable key={x.key} onPress={() => setI(n)} style={[styles.progressDot, n === i && styles.progressOn, answers[x.key].trim() && n !== i && { backgroundColor: colors.accent }]} accessibilityLabel={`Question ${n + 1}`} hitSlop={8} />
          ))}
        </View>

        <View style={{ gap: space.sm }}>
          <Text variant="display" style={{ fontSize: 28, lineHeight: 34 }}>{q.q}</Text>
          <Text variant="body" color={colors.textMuted}>{q.hint}</Text>
        </View>

        {voiceOk === false && !typing ? (
          <Notice tone="info" title="Voice isn’t available right now">Type your answers instead — the AI draft still works.</Notice>
        ) : null}

        {!typing && voiceOk !== false ? (
          <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.lg }}>
            <View style={{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}>
              <Pulse active={rec.isRecording} />
              <Pressable
                onPress={rec.isRecording ? stopRecording : startRecording}
                disabled={transcribing}
                style={[styles.mic, rec.isRecording && { backgroundColor: colors.danger }]}
                accessibilityRole="button"
                accessibilityLabel={rec.isRecording ? 'Stop recording' : 'Start recording your answer'}
              >
                {transcribing ? <ActivityIndicator color={colors.white} /> : rec.isRecording ? <Square size={30} color={colors.white} fill={colors.white} /> : <Mic size={36} color={colors.white} />}
              </Pressable>
            </View>
            <Text variant="label" weight="semi" color={colors.ink}>
              {transcribing ? 'Transcribing…' : rec.isRecording ? `Listening · ${Math.floor((rec.durationMillis ?? 0) / 1000)}s — tap to stop` : 'Tap to answer'}
            </Text>
          </View>
        ) : null}

        <View style={{ gap: space.xs }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="label" weight="semi" color={colors.text}>{typing || voiceOk === false ? 'Your answer' : 'Transcript (edit if needed)'}</Text>
            {voiceOk !== false ? (
              <Pressable onPress={() => { setTyping((t) => !t); setTimeout(() => input.current?.focus(), 100); }} hitSlop={8} accessibilityRole="button">
                <Row gap={4}>
                  {typing ? <Mic size={14} color={colors.accent} /> : <Keyboard size={14} color={colors.accent} />}
                  <Text variant="label" weight="semi" color={colors.accent}>{typing ? 'Use voice' : 'Type instead'}</Text>
                </Row>
              </Pressable>
            ) : null}
          </Row>
          <TextInput
            ref={input}
            value={answers[q.key]}
            onChangeText={(t) => setAnswers((a) => ({ ...a, [q.key]: t }))}
            multiline
            placeholder={typing || voiceOk === false ? 'Type your answer…' : 'Your words appear here'}
            placeholderTextColor={colors.placeholder}
            style={styles.answer}
            accessibilityLabel={q.q}
          />
        </View>

        <Pressable onPress={useSample} accessibilityRole="button" style={{ alignSelf: 'center' }}>
          <Text variant="label" color={colors.textMuted}>No idea yet? <Text variant="label" weight="semi" color={colors.accent}>Use sample answers</Text></Text>
        </Pressable>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
        {isLast ? (
          <View style={{ gap: space.sm }}>
            <Button label="Draft my campaign" icon={<Sparkles size={18} color={colors.white} />} onPress={draft} disabled={answered < 2 || rec.isRecording} full size="lg" />
            <Button label="Skip AI and write it myself" variant="ghost" onPress={manual} full size="sm" />
          </View>
        ) : (
          <Row gap={space.sm}>
            {i > 0 ? <Button label="Back" variant="secondary" onPress={() => setI(i - 1)} style={{ flex: 1 }} /> : null}
            <Button label={answers[q.key].trim() ? 'Next question' : 'Skip'} variant={answers[q.key].trim() ? 'primary' : 'secondary'} icon={answers[q.key].trim() ? <Check size={16} color={colors.white} /> : undefined} onPress={() => setI(i + 1)} disabled={rec.isRecording || transcribing} style={{ flex: 2 }} />
          </Row>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  progress: { flexDirection: 'row', gap: 6 },
  progressDot: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.border },
  progressOn: { backgroundColor: colors.ink },
  mic: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  pulse: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: colors.danger },
  answer: { minHeight: 120, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderStrong, padding: space.md, fontFamily: fonts.serif, fontSize: 17, lineHeight: 26, color: colors.ink, textAlignVertical: 'top' },
  footer: { paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  drafting: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, padding: space.xl },
  sparkle: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
});
