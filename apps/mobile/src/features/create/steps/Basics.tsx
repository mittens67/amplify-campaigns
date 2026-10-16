import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Img as Image } from '@/ui/Img';
import { ImagePlus, Sparkles, Trash2 } from 'lucide-react-native';
import { CATEGORIES, CREATOR_TYPES, effectiveAdHeadline, LIMITS } from '@amplify/domain';
import { api, errorMessage } from '@/lib/api';
import { MediaError, pickAndUploadImage } from '@/lib/media';
import { Button, Chip, colors, IconButton, radius, space, Text, TextField, toast } from '@/ui';
import { applyAiDraft, type AiDraftResult } from '../aiDraft';
import { Group, ReviewerNote, StepIntro, SuggestedChip, useField, useWizard } from '../WizardKit';

const PROMPTS = [
  { key: 'about', label: 'What is the campaign about?', placeholder: 'e.g. Free walk-in flu shots at neighbourhood clinics this fall' },
  { key: 'audience', label: 'Who should the message reach?', placeholder: 'e.g. Shift workers and caregivers in Northside' },
  { key: 'why', label: 'Why does it matter now?', placeholder: 'e.g. Turnout is lowest where hospitalisation rates are highest' },
  { key: 'evidence', label: 'What evidence supports it?', placeholder: 'e.g. CDC flu vaccine guidance, county health data' },
] as const;

export function BasicsStep() {
  const { content, update } = useWizard();
  const b = content.basics;
  const title = useField('basics.title');
  const category = useField('basics.category');
  const creator = useField('basics.creatorName');
  const creatorType = useField('basics.creatorType');
  const summary = useField('basics.summary');
  const [aiBusy, setAiBusy] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const headline = effectiveAdHeadline(content);
  const hasPrompts = Object.values(b.prompts).some((v) => v.trim().length > 10);

  const draftWithAi = async () => {
    setAiBusy(true);
    try {
      const res = await api<AiDraftResult>('/ai/draft', {
        method: 'POST',
        body: { ...b.prompts, action: content.story.actions.join('. '), creatorName: b.creatorName },
        timeoutMs: 30_000,
      });
      update((c) => applyAiDraft(c, res.draft, { onlyEmpty: true }));
      toast.success(res.source === 'ai' ? 'Draft suggestions added — edit anything' : 'Suggestions added from your answers — edit anything');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setAiBusy(false);
    }
  };

  const pickCover = async () => {
    setCoverBusy(true);
    try {
      const asset = await pickAndUploadImage({ aspect: [16, 10] });
      if (asset) update((c) => void (c.basics.cover = asset));
    } catch (e) {
      toast.error(e instanceof MediaError ? e.message : errorMessage(e));
    } finally {
      setCoverBusy(false);
    }
  };

  return (
    <View style={{ gap: space.lg }}>
      <StepIntro title="The basics" body="Start with the essentials. You can change any of this until you submit." />

      <Group title="Describe your campaign" hint="Short answers are fine. They help you — and the AI assistant — write a clear campaign.">
        {PROMPTS.map((p) => (
          <TextField
            key={p.key}
            label={p.label}
            value={b.prompts[p.key]}
            onChangeText={(v) => update((c) => void (c.basics.prompts[p.key] = v), [`basics.prompts.${p.key}`])}
            placeholder={p.placeholder}
            multiline
            style={{ minHeight: 64 }}
          />
        ))}
        <Button
          label={aiBusy ? 'Drafting…' : 'Help me draft from these answers'}
          variant="secondary"
          icon={aiBusy ? <ActivityIndicator size="small" color={colors.accent} /> : <Sparkles size={18} color={colors.accent} />}
          onPress={draftWithAi}
          disabled={aiBusy || !hasPrompts}
          full
        />
        <Text variant="caption">AI only suggests. It fills empty fields, marks them “Suggested”, and never sets your funding goal.</Text>
      </Group>

      <View style={{ gap: space.sm }}>
        <TextField
          label="Campaign title"
          value={b.title}
          onChangeText={(v) => update((c) => void (c.basics.title = v), ['basics.title'])}
          placeholder="A clear, specific headline"
          maxChars={LIMITS.title}
          error={title.error}
          badge={<SuggestedChip path="basics.title" />}
        />
        <ReviewerNote path="basics.title" />
        <View style={styles.headlinePreview}>
          <Text variant="caption" weight="semi" color={colors.textMuted}>As an ad headline</Text>
          <Text variant="label" weight="semi" color={colors.ink} numberOfLines={1}>{headline || 'Your title appears here'}</Text>
          <Text variant="caption">The start of your title is used as the ad headline unless you write a custom one in Visuals.</Text>
        </View>
      </View>

      <View style={{ gap: space.sm }}>
        <View style={styles.labelRow}>
          <Text variant="label" weight="semi" color={colors.text}>Category</Text>
          <SuggestedChip path="basics.category" />
        </View>
        <View style={styles.wrap}>
          {CATEGORIES.map((cat) => (
            <Chip key={cat} label={cat} selected={b.category === cat} onPress={() => update((c) => void (c.basics.category = cat), ['basics.category'])} />
          ))}
        </View>
        {category.error ? <Text variant="caption" color={colors.danger}>{category.error}</Text> : null}
      </View>

      <View style={{ gap: space.sm }}>
        <TextField
          label="Creator or organization name"
          value={b.creatorName}
          onChangeText={(v) => update((c) => void (c.basics.creatorName = v), ['basics.creatorName'])}
          placeholder="Shown publicly on the campaign"
          error={creator.error}
          autoCapitalize="words"
        />
        <Text variant="label" weight="semi" color={colors.text}>Who is behind it?</Text>
        <View style={styles.wrap}>
          {CREATOR_TYPES.map((t) => (
            <Chip key={t.key} label={t.label} selected={b.creatorType === t.key} onPress={() => update((c) => void (c.basics.creatorType = t.key))} />
          ))}
        </View>
        {creatorType.error ? <Text variant="caption" color={colors.danger}>{creatorType.error}</Text> : null}
      </View>

      <View style={{ gap: space.sm }}>
        <TextField
          label="Short summary"
          optional
          value={b.summary}
          onChangeText={(v) => update((c) => void (c.basics.summary = v), ['basics.summary'])}
          placeholder="One or two sentences shown on campaign cards"
          multiline
          maxChars={LIMITS.summary}
          error={summary.error}
          badge={<SuggestedChip path="basics.summary" />}
          style={{ minHeight: 72 }}
        />
        <ReviewerNote path="basics.summary" />
      </View>

      <View style={{ gap: space.sm }}>
        <Text variant="label" weight="semi" color={colors.text}>
          Cover image <Text variant="label" color={colors.textSubtle}>(optional now · required to submit)</Text>
        </Text>
        {b.cover ? (
          <View>
            <Image source={b.cover.url} style={styles.cover} contentFit="cover" />
            <View style={styles.coverActions}>
              <IconButton icon={<ImagePlus size={18} color={colors.ink} />} label="Replace cover" variant="overlay" onPress={pickCover} />
              <IconButton icon={<Trash2 size={18} color={colors.danger} />} label="Remove cover" variant="overlay" onPress={() => update((c) => void (c.basics.cover = undefined))} />
            </View>
          </View>
        ) : (
          <Pressable onPress={pickCover} style={styles.coverEmpty} accessibilityRole="button" accessibilityLabel="Add cover image">
            {coverBusy ? <ActivityIndicator color={colors.accent} /> : <ImagePlus size={26} color={colors.accent} />}
            <Text variant="label" weight="semi" color={colors.accent}>{coverBusy ? 'Uploading…' : 'Add a cover image'}</Text>
            <Text variant="caption">JPG or PNG, at least 600px wide</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headlinePreview: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: space.md, gap: 2 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cover: { width: '100%', aspectRatio: 16 / 10, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt },
  coverActions: { position: 'absolute', top: space.sm, right: space.sm, flexDirection: 'row', gap: space.sm },
  coverEmpty: { height: 150, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.accentBorder, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', gap: 4 },
});
