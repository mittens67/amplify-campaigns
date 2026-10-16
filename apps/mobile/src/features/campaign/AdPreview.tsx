import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Globe, Heart, MessageCircle, MoreHorizontal, Send } from 'lucide-react-native';
import { colors, fonts, radius, space, Text } from '@/ui';

export interface AdPreviewProps {
  headline: string;
  description: string;
  cta: string;
  imageUrl?: string | null;
  creatorName: string;
  placement?: 'feed' | 'story' | 'search';
  width?: number;
}

/** Mock of how the ad may appear in a placement. Labelled "Sponsored" like real ads. */
export function AdPreview({ headline, description, cta, imageUrl, creatorName, placement = 'feed', width = 280 }: AdPreviewProps) {
  const initial = (creatorName || 'A').trim()[0]?.toUpperCase();
  if (placement === 'search') {
    return (
      <View style={[styles.search, { width }]}>
        <Text variant="caption" weight="semi" color={colors.ink}>Sponsored</Text>
        <Text variant="caption" color={colors.success} numberOfLines={1}>amplify.campaigns › {creatorName.toLowerCase().replace(/\s+/g, '-')}</Text>
        <Text style={styles.searchTitle} numberOfLines={2}>{headline || 'Your ad headline'}</Text>
        <Text variant="caption" color={colors.textMuted} numberOfLines={2}>{description || 'Your ad description appears here.'}</Text>
      </View>
    );
  }
  if (placement === 'story') {
    const h = (width * 16) / 9;
    return (
      <View style={[styles.story, { width: width * 0.62, height: h * 0.62 }]}>
        {imageUrl ? <Image source={imageUrl} style={StyleSheet.absoluteFill} contentFit="cover" /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.borderStrong }]} />}
        <View style={styles.storyShade} />
        <View style={styles.storyTop}>
          <View style={[styles.avatar, { width: 22, height: 22 }]}>
            <Text style={{ color: colors.white, fontFamily: fonts.sansBold, fontSize: 10 }}>{initial}</Text>
          </View>
          <View>
            <Text style={styles.storyName} numberOfLines={1}>{creatorName || 'Your name'}</Text>
            <Text style={[styles.storyName, { opacity: 0.8, fontFamily: fonts.sans }]}>Sponsored</Text>
          </View>
        </View>
        <View style={styles.storyBottom}>
          <Text style={styles.storyHeadline} numberOfLines={3}>{headline || 'Your ad headline'}</Text>
          <View style={styles.storyCta}>
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 11, color: colors.ink }}>{cta || 'Learn more'}</Text>
          </View>
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.feed, { width }]} accessibilityLabel={`Ad preview: ${headline}`}>
      <View style={styles.feedHead}>
        <View style={styles.avatar}>
          <Text style={{ color: colors.white, fontFamily: fonts.sansBold, fontSize: 12 }}>{initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="caption" weight="semi" color={colors.ink} numberOfLines={1}>{creatorName || 'Your name'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Text variant="caption" style={{ fontSize: 10 }}>Sponsored ·</Text>
            <Globe size={9} color={colors.textSubtle} />
          </View>
        </View>
        <MoreHorizontal size={16} color={colors.textSubtle} />
      </View>
      <Text variant="caption" color={colors.text} numberOfLines={2} style={{ paddingHorizontal: space.sm, marginBottom: space.sm }}>
        {description || 'Your ad description appears here.'}
      </Text>
      {imageUrl ? (
        <Image source={imageUrl} style={styles.feedImage} contentFit="cover" />
      ) : (
        <View style={[styles.feedImage, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text variant="caption">Ad image</Text>
        </View>
      )}
      <View style={styles.feedCtaRow}>
        <View style={{ flex: 1 }}>
          <Text variant="caption" style={{ fontSize: 10 }}>AMPLIFY.CAMPAIGNS</Text>
          <Text variant="label" weight="semi" color={colors.ink} numberOfLines={1}>{headline || 'Your ad headline'}</Text>
        </View>
        <View style={styles.feedCta}>
          <Text variant="caption" weight="semi" color={colors.ink}>{cta || 'Learn more'}</Text>
        </View>
      </View>
      <View style={styles.feedActions}>
        <Heart size={14} color={colors.textSubtle} />
        <MessageCircle size={14} color={colors.textSubtle} />
        <Send size={14} color={colors.textSubtle} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  feed: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  feedHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  feedImage: { width: '100%', aspectRatio: 1.91, backgroundColor: colors.surfaceAlt },
  feedCtaRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, backgroundColor: colors.surfaceAlt },
  feedCta: { backgroundColor: colors.border, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  feedActions: { flexDirection: 'row', gap: space.lg, padding: space.sm },
  story: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.ink },
  storyShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(15,23,42,0.35)' },
  storyTop: { position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  storyName: { color: colors.white, fontFamily: fonts.sansSemi, fontSize: 10 },
  storyBottom: { position: 'absolute', left: 10, right: 10, bottom: 12, gap: 8 },
  storyHeadline: { color: colors.white, fontFamily: fonts.serifBold, fontSize: 16, lineHeight: 20 },
  storyCta: { alignSelf: 'center', backgroundColor: colors.white, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 6 },
  search: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: space.md, gap: 3 },
  searchTitle: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 21, color: '#1A0DAB' },
});
