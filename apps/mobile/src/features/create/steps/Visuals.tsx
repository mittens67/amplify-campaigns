import { useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Img as Image } from '@/ui/Img';
import { LinearGradient } from 'expo-linear-gradient';
import { captureRef } from 'react-native-view-shot';
import { AlertTriangle, Film, ImagePlus, Lightbulb, Sparkles, Trash2, Wand2 } from 'lucide-react-native';
import { effectiveAdHeadline, LIMITS } from '@amplify/domain';
import { errorMessage } from '@/lib/api';
import { MediaError, pickAndUploadImage, pickAndUploadVideo, uploadLocalImage } from '@/lib/media';
import { AdPreview } from '@/features/campaign/AdPreview';
import { Button, Chip, colors, fonts, IconButton, Notice, radius, Row, Segmented, Sheet, space, Text, TextField, toast } from '@/ui';
import { Group, StepIntro, SuggestedChip, useField, useWizard } from '../WizardKit';

const TEMPLATES = [
  { key: 'ink', label: 'Ink', colors: ['rgba(15,23,42,0.05)', 'rgba(15,23,42,0.88)'] as const, text: colors.white },
  { key: 'indigo', label: 'Indigo', colors: ['rgba(79,70,229,0.15)', 'rgba(55,48,163,0.92)'] as const, text: colors.white },
  { key: 'paper', label: 'Paper', colors: ['rgba(248,250,252,0)', 'rgba(248,250,252,0.96)'] as const, text: colors.ink },
];

function creativeTips(headline: string, description: string, cta: string): string[] {
  const tips: string[] = [];
  if (headline.length > 32) tips.push('Shorter headlines (under ~32 characters) are easier to read in a scrolling feed.');
  if (!/\d/.test(headline + description)) tips.push('A specific number or place often makes a message feel concrete.');
  if (/!{2,}|\b(shocking|outrage|destroy)\b/i.test(headline + description)) tips.push('Sensational wording can fail review and reduces trust. Keep the tone calm.');
  if (!/^(learn|see|find|check|join|get|take|read|vote|plan|sign|watch|pick|share)/i.test(cta.trim())) tips.push('Start the call to action with a verb, e.g. “Learn the signs”.');
  if (description.length < 40) tips.push('Use the description to say what’s in it for the reader in one sentence.');
  return tips.length ? tips : ['Looks clear. Headline, description and call to action work together.'];
}

export function VisualsStep() {
  const { content, update } = useWizard();
  const v = content.visuals;
  const coverErr = useField('basics.cover');
  const imagesErr = useField('visuals.adImages');
  const [busy, setBusy] = useState<string | null>(null);
  const [placement, setPlacement] = useState<'feed' | 'story' | 'search'>('feed');
  const [generator, setGenerator] = useState(false);
  const [template, setTemplate] = useState(0);
  const [tips, setTips] = useState<string[] | null>(null);
  const cardRef = useRef<ComponentRef<typeof View>>(null);
  const headline = effectiveAdHeadline(content);
  const adImage = v.adImages[0]?.url ?? content.basics.cover?.url ?? null;

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof MediaError ? e.message : errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const generate = () =>
    run('generate', async () => {
      const uri = await captureRef(cardRef as any, { format: 'jpg', quality: 0.9, width: 1200, height: 628, result: 'tmpfile' });
      const asset = await uploadLocalImage(uri, 1200, 628);
      update((c) => void c.visuals.adImages.push(asset));
      setGenerator(false);
      toast.success('Ad image created and added');
    });

  const missing = [!content.basics.cover && 'a cover image', v.adImages.length === 0 && 'at least one ad image'].filter(Boolean) as string[];

  return (
    <View style={{ gap: space.lg }}>
      <StepIntro title="Campaign & ad visuals" body="The story stays on the campaign page. These are the creatives used to advertise it, kept separate on purpose." />

      {missing.length ? (
        <Notice tone="warning" title="Missing assets" icon={<AlertTriangle size={18} color={colors.warning} />}>
          {`Add ${missing.join(' and ')} before you submit.`}
        </Notice>
      ) : null}

      <Group title="Campaign cover" hint="Shown at the top of the campaign page and on cards.">
        {content.basics.cover ? (
          <View>
            <Image source={content.basics.cover.url} style={styles.cover} contentFit="cover" />
            <View style={styles.overlayActions}>
              <IconButton icon={<ImagePlus size={18} color={colors.ink} />} label="Replace cover" variant="overlay" onPress={() => run('cover', async () => { const a = await pickAndUploadImage({ aspect: [16, 10] }); if (a) update((c) => void (c.basics.cover = a)); })} />
            </View>
          </View>
        ) : (
          <Pressable style={styles.empty} onPress={() => run('cover', async () => { const a = await pickAndUploadImage({ aspect: [16, 10] }); if (a) update((c) => void (c.basics.cover = a)); })} accessibilityRole="button">
            {busy === 'cover' ? <ActivityIndicator color={colors.accent} /> : <ImagePlus size={24} color={colors.accent} />}
            <Text variant="label" weight="semi" color={colors.accent}>Add cover image</Text>
          </Pressable>
        )}
        {coverErr.error ? <Text variant="caption" color={colors.danger}>{coverErr.error}</Text> : null}
      </Group>

      <Group title="Ad images" hint="Landscape works best (1.91:1). Upload your own or generate one from your headline.">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {v.adImages.map((img, i) => (
            <View key={img.url}>
              <Image source={img.url} style={styles.adThumb} contentFit="cover" />
              {img.generated ? (
                <View style={styles.genTag}>
                  <Sparkles size={10} color={colors.white} />
                  <Text variant="caption" color={colors.white} style={{ fontSize: 10 }}>Generated</Text>
                </View>
              ) : null}
              <View style={styles.overlayActions}>
                <IconButton icon={<Trash2 size={16} color={colors.danger} />} label="Remove ad image" variant="overlay" size={32} onPress={() => update((c) => void c.visuals.adImages.splice(i, 1))} />
              </View>
            </View>
          ))}
        </ScrollView>
        <Row gap={space.sm}>
          <Button label="Upload" variant="secondary" icon={busy === 'ad' ? <ActivityIndicator size="small" color={colors.ink} /> : <ImagePlus size={16} color={colors.ink} />} onPress={() => run('ad', async () => { const a = await pickAndUploadImage(); if (a) update((c) => void c.visuals.adImages.push(a)); })} style={{ flex: 1 }} disabled={!!busy} />
          <Button label="Generate" variant="secondary" icon={<Wand2 size={16} color={colors.accent} />} onPress={() => setGenerator(true)} style={{ flex: 1 }} disabled={!!busy} />
        </Row>
        {imagesErr.error ? <Text variant="caption" color={colors.danger}>{imagesErr.error}</Text> : null}
        <Row gap={space.sm}>
          <Film size={16} color={colors.textMuted} />
          <Text variant="label" style={{ flex: 1 }}>{v.video ? 'Video added' : 'Video (optional, up to 60s) — supported on Facebook, Instagram and YouTube'}</Text>
          {v.video ? (
            <Button label="Remove" variant="ghost" size="sm" onPress={() => update((c) => void (c.visuals.video = undefined))} />
          ) : (
            <Button label={busy === 'video' ? 'Uploading…' : 'Add'} variant="ghost" size="sm" onPress={() => run('video', async () => { const a = await pickAndUploadVideo(); if (a) update((c) => void (c.visuals.video = a)); })} disabled={!!busy} />
          )}
        </Row>
      </Group>

      <Group title="Ad copy">
        <TextField
          label="Ad headline"
          optional
          value={v.adHeadline}
          onChangeText={(t) => update((c) => void (c.visuals.adHeadline = t), ['visuals.adHeadline'])}
          placeholder={headline || 'Defaults to the start of your title'}
          maxChars={LIMITS.adHeadline}
          badge={<SuggestedChip path="visuals.adHeadline" />}
          hint={v.adHeadline ? undefined : 'Leave empty to use your title'}
        />
        <TextField
          label="Ad description"
          value={v.adDescription}
          onChangeText={(t) => update((c) => void (c.visuals.adDescription = t), ['visuals.adDescription'])}
          placeholder="One sentence on why it matters to the reader"
          multiline
          maxChars={LIMITS.adDescription}
          badge={<SuggestedChip path="visuals.adDescription" />}
        />
        <TextField label="Call to action" value={v.cta} onChangeText={(t) => update((c) => void (c.visuals.cta = t), ['visuals.cta'])} maxChars={LIMITS.cta} badge={<SuggestedChip path="visuals.cta" />} />
        <View style={styles.wrap}>
          {['Learn more', 'Read the facts', 'Find out how', 'Take action'].map((s) => (
            <Chip key={s} size="sm" label={s} selected={v.cta === s} onPress={() => update((c) => void (c.visuals.cta = s), ['visuals.cta'])} />
          ))}
        </View>
      </Group>

      <View style={{ gap: space.md }}>
        <Text variant="heading">Preview by placement</Text>
        <Segmented
          value={placement}
          onChange={setPlacement}
          options={[
            { key: 'feed', label: 'Feed' },
            { key: 'story', label: 'Story' },
            { key: 'search', label: 'Search' },
          ]}
        />
        <View style={{ alignItems: 'center' }}>
          <AdPreview placement={placement} headline={headline} description={v.adDescription} cta={v.cta} imageUrl={adImage} creatorName={content.basics.creatorName} width={300} />
        </View>
        <Button label="Run a quick creative check" variant="ghost" icon={<Lightbulb size={16} color={colors.accent} />} onPress={() => setTips(creativeTips(headline, v.adDescription, v.cta))} />
        {tips ? (
          <Notice tone="info" title="Creative check">
            <View style={{ gap: 4 }}>
              {tips.map((t) => (
                <Text key={t} variant="label" color={colors.text}>• {t}</Text>
              ))}
            </View>
          </Notice>
        ) : null}
      </View>

      <Sheet
        visible={generator}
        onClose={() => setGenerator(false)}
        title="Generate an ad image"
        footer={<Button label={busy === 'generate' ? 'Creating…' : 'Use this design'} onPress={generate} loading={busy === 'generate'} disabled={!headline} full />}
      >
        <Text variant="label">Built from your cover photo and headline. You can generate several and keep the best.</Text>
        <View ref={cardRef} collapsable={false} style={styles.genCard}>
          {content.basics.cover ? <Image source={content.basics.cover.url} style={StyleSheet.absoluteFill} contentFit="cover" /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.accent }]} />}
          <LinearGradient colors={TEMPLATES[template].colors} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
          <View style={styles.genText}>
            <Text style={[styles.genHeadline, { color: TEMPLATES[template].text }]} numberOfLines={3}>{headline || 'Your headline'}</Text>
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 11, color: TEMPLATES[template].text, opacity: 0.85 }}>{content.basics.creatorName || 'Your name'}</Text>
          </View>
        </View>
        <View style={styles.wrap}>
          {TEMPLATES.map((t, i) => (
            <Chip key={t.key} label={t.label} selected={template === i} onPress={() => setTemplate(i)} />
          ))}
        </View>
        {!content.basics.cover ? <Text variant="caption">Tip: add a cover image in step 1 for a photo background.</Text> : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { width: '100%', aspectRatio: 16 / 10, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  overlayActions: { position: 'absolute', top: 6, right: 6, flexDirection: 'row', gap: 6 },
  empty: { height: 120, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.accentBorder, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', gap: 6 },
  adThumb: { width: 200, aspectRatio: 1.91, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  genTag: { position: 'absolute', left: 6, bottom: 6, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(15,23,42,0.75)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  genCard: { width: '100%', aspectRatio: 1.91, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.ink },
  genText: { position: 'absolute', left: 16, right: 16, bottom: 14, gap: 6 },
  genHeadline: { fontFamily: fonts.serifBold, fontSize: 22, lineHeight: 26 },
});
