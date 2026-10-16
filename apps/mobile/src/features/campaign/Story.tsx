import { Fragment } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Img as Image } from '@/ui/Img';
import { ArrowUpRight, CircleCheck, Quote as QuoteIcon } from 'lucide-react-native';
import type { Block, CampaignContent } from '@amplify/domain';
import { colors, fonts, radius, space, Text } from '@/ui';

/** Markdown-lite: **bold** and [label](https://link) — enough for an editorial story without a heavy editor. */
export function RichText({ text, variant = 'story' }: { text: string; variant?: 'story' | 'body' }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g).filter(Boolean);
  return (
    <Text variant={variant}>
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**')) {
          return (
            <Text key={i} variant={variant} style={{ fontFamily: variant === 'story' ? fonts.serifSemi : fonts.sansSemi }}>
              {p.slice(2, -2)}
            </Text>
          );
        }
        const link = p.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
        if (link) {
          return (
            <Text key={i} variant={variant} color={colors.accent} style={{ textDecorationLine: 'underline' }} onPress={() => void Linking.openURL(link[2])} accessibilityRole="link">
              {link[1]}
            </Text>
          );
        }
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </Text>
  );
}

function Cites({ ids, sourceIndex, onCite }: { ids?: string[]; sourceIndex: Map<string, number>; onCite?: (n: number) => void }) {
  const nums = (ids ?? []).map((id) => sourceIndex.get(id)).filter((n): n is number => !!n);
  if (!nums.length) return null;
  return (
    <View style={styles.cites}>
      {nums.map((n) => (
        <Pressable key={n} onPress={() => onCite?.(n)} style={styles.cite} accessibilityRole="button" accessibilityLabel={`Source ${n}`} hitSlop={6}>
          <Text variant="caption" weight="semi" color={colors.accentText}>[{n}]</Text>
        </Pressable>
      ))}
    </View>
  );
}

function BlockView({ b, sourceIndex, onCite }: { b: Block; sourceIndex: Map<string, number>; onCite?: (n: number) => void }) {
  switch (b.type) {
    case 'heading':
      return b.text ? <Text variant="title" style={{ marginTop: space.md }}>{b.text}</Text> : null;
    case 'paragraph':
      return b.text ? (
        <View>
          <RichText text={b.text} />
          <Cites ids={b.sourceIds} sourceIndex={sourceIndex} onCite={onCite} />
        </View>
      ) : null;
    case 'image':
      return b.image ? (
        <View style={{ gap: 6, marginVertical: space.xs }}>
          <Image source={b.image.url} style={[styles.image, b.image.width && b.image.height ? { aspectRatio: b.image.width / b.image.height } : null]} contentFit="cover" transition={200} accessibilityLabel={b.caption || 'Story image'} />
          {b.caption || b.credit ? (
            <Text variant="caption">
              {b.caption}
              {b.caption && b.credit ? '  ·  ' : ''}
              {b.credit ? <Text variant="caption" color={colors.placeholder}>{b.credit}</Text> : null}
            </Text>
          ) : null}
        </View>
      ) : null;
    case 'stat':
      return b.value ? (
        <View style={styles.stat}>
          <Text style={styles.statValue}>{b.value}</Text>
          <View style={{ flex: 1 }}>
            <Text variant="body" color={colors.text}>{b.text}</Text>
            <Cites ids={b.sourceIds} sourceIndex={sourceIndex} onCite={onCite} />
          </View>
        </View>
      ) : null;
    case 'quote':
      return b.text ? (
        <View style={styles.quote}>
          <QuoteIcon size={20} color={colors.accent} />
          <Text variant="story" style={{ fontFamily: fonts.serifSemi, fontSize: 19, lineHeight: 28 }}>{b.text}</Text>
          {b.attribution ? <Text variant="label">— {b.attribution}</Text> : null}
        </View>
      ) : null;
  }
}

/** Editorial story renderer, shared by the published page and the creator's live preview. */
export function Story({ content, onCite }: { content: CampaignContent; onCite?: (n: number) => void }) {
  const sourceIndex = new Map(content.story.sources.map((s, i) => [s.id, i + 1]));
  return (
    <View style={{ gap: space.lg }}>
      {content.story.headline ? <Text variant="title" style={{ fontSize: 24, lineHeight: 31 }}>{content.story.headline}</Text> : null}
      {content.story.intro ? <RichText text={content.story.intro} /> : null}
      {content.story.blocks.map((b) => (
        <BlockView key={b.id} b={b} sourceIndex={sourceIndex} onCite={onCite} />
      ))}
    </View>
  );
}

export function Actions({ actions }: { actions: string[] }) {
  const list = actions.filter((a) => a.trim());
  if (!list.length) return null;
  return (
    <View style={styles.actions}>
      <Text variant="overline" color={colors.accentText}>What you can do</Text>
      {list.map((a, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
          <CircleCheck size={18} color={colors.accent} style={{ marginTop: 2 }} />
          <Text variant="body" color={colors.ink} style={{ flex: 1 }}>{a}</Text>
        </View>
      ))}
    </View>
  );
}

export function Sources({ sources, highlight }: { sources: CampaignContent['story']['sources']; highlight?: number | null }) {
  if (!sources.length) return null;
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="heading">Sources</Text>
      <Text variant="caption">Every claim should trace back to one of these. Tap to open.</Text>
      {sources.map((s, i) => (
        <Pressable
          key={s.id}
          onPress={() => s.url && void Linking.openURL(s.url)}
          accessibilityRole="link"
          style={({ pressed }) => [styles.source, highlight === i + 1 && styles.sourceHighlight, pressed && { backgroundColor: colors.surfaceAlt }]}
        >
          <Text variant="label" weight="bold" color={colors.accentText} style={{ width: 24 }}>{i + 1}</Text>
          <View style={{ flex: 1 }}>
            <Text variant="label" weight="semi" color={colors.ink}>{s.title || 'Untitled source'}</Text>
            <Text variant="caption" numberOfLines={1}>{s.publisher ? `${s.publisher} · ` : ''}{s.url?.replace(/^https?:\/\//, '')}</Text>
          </View>
          <ArrowUpRight size={16} color={colors.textSubtle} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', aspectRatio: 3 / 2, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  cites: { flexDirection: 'row', gap: 4, marginTop: 4 },
  cite: { backgroundColor: colors.accentSoft, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  stat: { flexDirection: 'row', gap: space.lg, alignItems: 'center', paddingVertical: space.lg, borderTopWidth: 2, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.ink },
  statValue: { fontFamily: fonts.serifBold, fontSize: 40, lineHeight: 44, color: colors.accent, minWidth: 80 },
  quote: { gap: space.sm, paddingLeft: space.lg, borderLeftWidth: 3, borderColor: colors.accent },
  actions: { gap: space.md, backgroundColor: colors.accentSoft, borderRadius: radius.lg, padding: space.lg },
  source: { flexDirection: 'row', gap: space.sm, alignItems: 'center', paddingVertical: space.md, paddingHorizontal: space.sm, borderRadius: radius.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  sourceHighlight: { backgroundColor: colors.accentSoft },
});
