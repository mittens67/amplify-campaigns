import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Img as Image } from '@/ui/Img';
import * as Crypto from 'expo-crypto';
import { ArrowDown, ArrowUp, Bold, BookMarked, Heading2, ImagePlus, Link2, ListPlus, MoreHorizontal, Pilcrow, Plus, Quote, Sigma, Trash2, X } from 'lucide-react-native';
import type { Block, BlockType } from '@amplify/domain';
import { errorMessage } from '@/lib/api';
import { MediaError, pickAndUploadImage } from '@/lib/media';
import { Button, colors, fonts, IconButton, ListRow, radius, Row, Sheet, space, Text, TextField, toast } from '@/ui';
import { Group, ReviewerNote, StepIntro, SuggestedChip, useField, useWizard } from '../WizardKit';

const uid = () => Crypto.randomUUID().slice(0, 8);

const BLOCK_META: Record<BlockType, { label: string; icon: typeof Pilcrow; hint: string }> = {
  heading: { label: 'Section heading', icon: Heading2, hint: 'Break the story into readable parts' },
  paragraph: { label: 'Paragraph', icon: Pilcrow, hint: 'Text with bold, links and citations' },
  image: { label: 'Photo', icon: ImagePlus, hint: 'Image with caption and credit' },
  stat: { label: 'Key statistic', icon: Sigma, hint: 'A number that matters, with its source' },
  quote: { label: 'Quote', icon: Quote, hint: 'A short quote with attribution' },
};

function ParagraphEditor({ b, onChange, onCite }: { b: Block; onChange: (p: Partial<Block>) => void; onCite: () => void }) {
  const [sel, setSel] = useState({ start: 0, end: 0 });
  const text = b.text ?? '';
  const wrap = (before: string, after: string, placeholder: string) => {
    const s = text.slice(sel.start, sel.end) || placeholder;
    onChange({ text: text.slice(0, sel.start) + before + s + after + text.slice(sel.end) });
  };
  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.toolbar}>
        <IconButton icon={<Bold size={16} color={colors.ink} />} label="Bold" size={34} onPress={() => wrap('**', '**', 'bold text')} />
        <IconButton icon={<Link2 size={16} color={colors.ink} />} label="Add link" size={34} onPress={() => wrap('[', '](https://)', 'link text')} />
        <IconButton icon={<BookMarked size={16} color={colors.ink} />} label="Cite a source" size={34} onPress={onCite} />
        <Text variant="caption" style={{ marginLeft: 'auto' }}>{(b.sourceIds ?? []).length ? `${b.sourceIds!.length} source${b.sourceIds!.length > 1 ? 's' : ''} cited` : 'No citation'}</Text>
      </View>
      <TextInput
        value={text}
        onChangeText={(t) => onChange({ text: t })}
        onSelectionChange={(e) => setSel(e.nativeEvent.selection)}
        multiline
        placeholder="Write this part of the story…"
        placeholderTextColor={colors.placeholder}
        style={styles.storyInput}
        accessibilityLabel="Paragraph text"
      />
    </View>
  );
}

export function StoryStep() {
  const { content, update } = useWizard();
  const s = content.story;
  const intro = useField('story.intro');
  const sourcesErr = useField('story.sources');
  const { errors } = useWizard();
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [adding, setAdding] = useState<number | null>(null); // insert index
  const [citeFor, setCiteFor] = useState<number | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const validSources = s.sources.filter((x) => x.title?.trim() && x.url?.trim()).length;

  const setBlock = (i: number, p: Partial<Block>) => update((c) => void Object.assign(c.story.blocks[i], p), ['story.blocks']);
  const insert = (at: number, type: BlockType) => {
    update((c) => void c.story.blocks.splice(at, 0, { id: uid(), type, text: '', sourceIds: [] }), ['story.blocks']);
    setAdding(null);
  };
  const move = (i: number, dir: -1 | 1) => update((c) => {
    const j = i + dir;
    if (j < 0 || j >= c.story.blocks.length) return;
    [c.story.blocks[i], c.story.blocks[j]] = [c.story.blocks[j], c.story.blocks[i]];
  }, ['story.blocks']);
  const remove = (i: number) => {
    const removed = s.blocks[i];
    update((c) => void c.story.blocks.splice(i, 1), ['story.blocks']);
    toast.info('Section removed', { label: 'Undo', onPress: () => update((c) => void c.story.blocks.splice(i, 0, removed)) });
  };
  const pickImage = async (i: number) => {
    setUploading(s.blocks[i].id);
    try {
      const asset = await pickAndUploadImage();
      if (asset) setBlock(i, { image: asset });
    } catch (e) {
      toast.error(e instanceof MediaError ? e.message : errorMessage(e));
    } finally {
      setUploading(null);
    }
  };

  return (
    <View style={{ gap: space.lg }}>
      <StepIntro title="Tell the story" body="Write it like a short article: clear, specific and sourced. Readers see exactly this on the campaign page." />

      <TextField
        label="Story headline"
        optional
        value={s.headline}
        onChangeText={(v) => update((c) => void (c.story.headline = v), ['story.headline'])}
        placeholder="The line that pulls readers in"
        badge={<SuggestedChip path="story.headline" />}
      />
      <View style={{ gap: space.sm }}>
        <TextField
          label="Introduction"
          value={s.intro}
          onChangeText={(v) => update((c) => void (c.story.intro = v), ['story.intro'])}
          placeholder="What’s happening, and why should someone care?"
          multiline
          error={intro.error}
          badge={<SuggestedChip path="story.intro" />}
          style={{ minHeight: 110, fontFamily: fonts.serif, fontSize: 17, lineHeight: 26 }}
        />
        <ReviewerNote path="story.intro" />
      </View>

      <View style={{ gap: space.md }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="heading">Story sections</Text>
          <SuggestedChip path="story.blocks" />
        </Row>
        {s.blocks.length === 0 ? <Text variant="label">Add sections to build out the story — headings, paragraphs, photos, statistics and quotes.</Text> : null}
        {s.blocks.map((b, i) => {
          const Meta = BLOCK_META[b.type];
          return (
            <View key={b.id} style={styles.block}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Row gap={6}>
                  <Meta.icon size={14} color={colors.textMuted} />
                  <Text variant="caption" weight="semi" color={colors.textMuted}>{Meta.label}</Text>
                </Row>
                <IconButton icon={<MoreHorizontal size={18} color={colors.textMuted} />} label={`Options for ${Meta.label}`} size={32} onPress={() => setMenuFor(i)} />
              </Row>
              {b.type === 'heading' ? (
                <TextInput value={b.text} onChangeText={(t) => setBlock(i, { text: t })} placeholder="Section heading" placeholderTextColor={colors.placeholder} style={styles.headingInput} accessibilityLabel="Section heading" />
              ) : b.type === 'paragraph' ? (
                <ParagraphEditor b={b} onChange={(p) => setBlock(i, p)} onCite={() => setCiteFor(i)} />
              ) : b.type === 'image' ? (
                <View style={{ gap: space.sm }}>
                  {b.image ? (
                    <Pressable onPress={() => pickImage(i)} accessibilityLabel="Replace image">
                      <Image source={b.image.url} style={styles.blockImage} contentFit="cover" />
                    </Pressable>
                  ) : (
                    <Pressable onPress={() => pickImage(i)} style={styles.imageEmpty} accessibilityRole="button">
                      {uploading === b.id ? <ActivityIndicator color={colors.accent} /> : <ImagePlus size={22} color={colors.accent} />}
                      <Text variant="label" color={colors.accent} weight="semi">{uploading === b.id ? 'Uploading…' : 'Choose a photo'}</Text>
                    </Pressable>
                  )}
                  {errors[`story.blocks.${i}.image`] ? <Text variant="caption" color={colors.danger}>{errors[`story.blocks.${i}.image`]}</Text> : null}
                  <TextField value={b.caption ?? ''} onChangeText={(t) => setBlock(i, { caption: t })} placeholder="Caption" />
                  <TextField value={b.credit ?? ''} onChangeText={(t) => setBlock(i, { credit: t })} placeholder="Photo credit (e.g. © Jane Doe)" />
                </View>
              ) : b.type === 'stat' ? (
                <View style={{ gap: space.sm }}>
                  <TextField value={b.value ?? ''} onChangeText={(t) => setBlock(i, { value: t })} placeholder="The number, e.g. 1 in 4" error={errors[`story.blocks.${i}.value`]} />
                  <TextField value={b.text ?? ''} onChangeText={(t) => setBlock(i, { text: t })} placeholder="What it measures" multiline />
                  <Button label={(b.sourceIds ?? []).length ? 'Change cited source' : 'Cite the source'} variant="quiet" size="sm" icon={<BookMarked size={14} color={colors.ink} />} onPress={() => setCiteFor(i)} />
                </View>
              ) : (
                <View style={{ gap: space.sm }}>
                  <TextInput value={b.text} onChangeText={(t) => setBlock(i, { text: t })} placeholder="Quote" placeholderTextColor={colors.placeholder} multiline style={[styles.storyInput, { fontFamily: fonts.serifSemi }]} />
                  <TextField value={b.attribution ?? ''} onChangeText={(t) => setBlock(i, { attribution: t })} placeholder="Who said it" />
                </View>
              )}
            </View>
          );
        })}
        <Button label="Add section" variant="secondary" icon={<Plus size={18} color={colors.ink} />} onPress={() => setAdding(s.blocks.length)} full />
      </View>

      <Group title="Supporting sources" hint={`Sources stay visible to readers. Reviewers look for 3 or more — you have ${validSources}.`}>
        <ReviewerNote path="story.sources" />
        {s.sources.map((src, i) => (
          <View key={src.id} style={styles.source}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="label" weight="bold" color={colors.accentText}>Source {i + 1}</Text>
              <IconButton
                icon={<X size={16} color={colors.textMuted} />}
                label={`Remove source ${i + 1}`}
                size={30}
                onPress={() => update((c) => {
                  c.story.sources.splice(i, 1);
                  c.story.blocks.forEach((b) => (b.sourceIds = (b.sourceIds ?? []).filter((x) => x !== src.id)));
                })}
              />
            </Row>
            <TextField value={src.title} onChangeText={(t) => update((c) => void (c.story.sources[i].title = t))} placeholder="Title, e.g. Heat and Health" error={errors[`story.sources.${i}.title`]} />
            <TextField value={src.url} onChangeText={(t) => update((c) => void (c.story.sources[i].url = t.trim()))} placeholder="https://…" autoCapitalize="none" keyboardType="url" autoCorrect={false} error={errors[`story.sources.${i}.url`]} />
            <TextField value={src.publisher ?? ''} onChangeText={(t) => update((c) => void (c.story.sources[i].publisher = t))} placeholder="Publisher, e.g. CDC (optional)" />
          </View>
        ))}
        {sourcesErr.error ? <Text variant="caption" color={colors.danger}>{sourcesErr.error}</Text> : null}
        <Button label="Add a source" variant="quiet" icon={<Plus size={16} color={colors.ink} />} onPress={() => update((c) => void c.story.sources.push({ id: uid(), title: '', url: '' }))} full />
      </Group>

      <Group title="What should readers do?" hint="1–3 short, concrete actions. Shown at the end of the story.">
        <SuggestedChip path="story.actions" />
        {s.actions.map((a, i) => (
          <TextField
            key={i}
            value={a}
            onChangeText={(t) => update((c) => void (c.story.actions[i] = t), ['story.actions'])}
            placeholder="e.g. Check your polling place"
            right={<IconButton icon={<X size={16} color={colors.textMuted} />} label="Remove action" size={30} onPress={() => update((c) => void c.story.actions.splice(i, 1), ['story.actions'])} />}
          />
        ))}
        {s.actions.length < 5 ? <Button label="Add an action" variant="quiet" icon={<ListPlus size={16} color={colors.ink} />} onPress={() => update((c) => void c.story.actions.push(''))} full /> : null}
      </Group>

      {/* Block options */}
      <Sheet visible={menuFor !== null} onClose={() => setMenuFor(null)} title="Section options">
        <View style={{ marginHorizontal: -space.xl }}>
          <ListRow icon={<ArrowUp size={20} color={colors.ink} />} title="Move up" onPress={() => { move(menuFor!, -1); setMenuFor(null); }} />
          <ListRow icon={<ArrowDown size={20} color={colors.ink} />} title="Move down" onPress={() => { move(menuFor!, 1); setMenuFor(null); }} />
          <ListRow icon={<Plus size={20} color={colors.ink} />} title="Insert a section above" onPress={() => { const at = menuFor!; setMenuFor(null); setTimeout(() => setAdding(at), 250); }} />
          <ListRow icon={<Trash2 size={20} color={colors.danger} />} title="Delete section" danger onPress={() => { const at = menuFor!; setMenuFor(null); remove(at); }} />
        </View>
      </Sheet>

      {/* Add block */}
      <Sheet visible={adding !== null} onClose={() => setAdding(null)} title="Add a section">
        <View style={{ marginHorizontal: -space.xl }}>
          {(Object.keys(BLOCK_META) as BlockType[]).map((t) => {
            const M = BLOCK_META[t];
            return <ListRow key={t} icon={<M.icon size={20} color={colors.accent} />} title={M.label} subtitle={M.hint} onPress={() => insert(adding!, t)} />;
          })}
        </View>
      </Sheet>

      {/* Cite */}
      <Sheet visible={citeFor !== null} onClose={() => setCiteFor(null)} title="Cite sources">
        {s.sources.length === 0 ? <Text variant="label">Add a source below the story first, then cite it here.</Text> : null}
        {s.sources.map((src, i) => {
          const on = citeFor !== null && (s.blocks[citeFor]?.sourceIds ?? []).includes(src.id);
          return (
            <Pressable
              key={src.id}
              onPress={() => citeFor !== null && setBlock(citeFor, { sourceIds: on ? (s.blocks[citeFor].sourceIds ?? []).filter((x) => x !== src.id) : [...(s.blocks[citeFor].sourceIds ?? []), src.id] })}
              style={[styles.citeRow, on && { borderColor: colors.accent, backgroundColor: colors.accentSoft }]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
            >
              <Text variant="label" weight="bold" color={colors.accentText}>[{i + 1}]</Text>
              <Text variant="body" color={colors.ink} style={{ flex: 1 }} numberOfLines={2}>{src.title || src.url || 'Untitled source'}</Text>
            </Pressable>
          );
        })}
        <Button label="Done" onPress={() => setCiteFor(null)} full />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, gap: space.sm, borderWidth: 1, borderColor: colors.border },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, paddingHorizontal: 4 },
  storyInput: { fontFamily: fonts.serif, fontSize: 17, lineHeight: 26, color: colors.ink, minHeight: 90, textAlignVertical: 'top', padding: 0 },
  headingInput: { fontFamily: fonts.serifSemi, fontSize: 21, color: colors.ink, paddingVertical: 4 },
  blockImage: { width: '100%', aspectRatio: 3 / 2, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  imageEmpty: { height: 120, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.accentBorder, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', gap: 6 },
  source: { gap: space.sm, paddingBottom: space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  citeRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
});
