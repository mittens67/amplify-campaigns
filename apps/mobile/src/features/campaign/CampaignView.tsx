import { useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  BarChart3,
  Bookmark,
  BookmarkCheck,
  ChevronRight,
  Flag,
  HandCoins,
  Megaphone,
  MoreHorizontal,
  Share2,
  ShieldCheck,
  Users,
} from 'lucide-react-native';
import {
  AMPLIFICATION_LINE,
  CHANNELS,
  CURRENT_REACH_MODEL,
  estimateReach,
  formatCompact,
  formatMoney,
  percentFunded,
  quote,
  reachModel,
  REFUND_MATRIX,
  REVIEW_LAYERS,
  type CampaignDetailDTO,
} from '@amplify/domain';
import { AdPreview } from './AdPreview';
import { creatorTypeLabel } from './CampaignCard';
import { FeedbackPoll } from './FeedbackPoll';
import { ReportSheet } from './ReportSheet';
import { Actions, Sources, Story } from './Story';
import { longDate, timeLeft } from '@/lib/format';
import { useToggle } from '@/lib/queries';
import { shareCampaign } from '@/lib/share';
import { haptic } from '@/lib/haptics';
import {
  Accordion,
  Button,
  categoryTint,
  colors,
  DemoTag,
  Estimate,
  IconButton,
  JourneyRail,
  Measured,
  MoneyFlow,
  Notice,
  openGlossary,
  Pill,
  ProgressBar,
  radius,
  Row,
  shadow,
  space,
  StatusPill,
  Text,
  toast,
} from '@/ui';

const COVER_H = 280;

function Section({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[{ paddingHorizontal: space.lg }, style]}>{children}</View>;
}

function FundingPanel({ c }: { c: CampaignDetailDTO }) {
  const p = percentFunded(c.raisedCents, c.goalCents);
  const model = reachModel(c.reachModelVersion);
  return (
    <View style={styles.panel}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View>
          <Text variant="number" style={{ fontSize: 28, lineHeight: 32 }}>{formatMoney(c.raisedCents)}</Text>
          <Text variant="label">raised of {formatMoney(c.goalCents)} distribution goal</Text>
        </View>
        <Text variant="heading" color={colors.accent}>{p}%</Text>
      </Row>
      <ProgressBar value={p} height={10} />
      <View style={styles.stats}>
        <View style={styles.statCell}>
          <Text variant="bodyStrong">{c.backerCount.toLocaleString()}</Text>
          <Text variant="caption">backers</Text>
        </View>
        <View style={styles.statCell}>
          <Text variant="bodyStrong">{c.status === 'available_for_funding' ? timeLeft(c.fundingEndsAt)?.replace(' left', '') : '—'}</Text>
          <Text variant="caption">{c.status === 'available_for_funding' ? 'left to fund' : 'funding closed'}</Text>
        </View>
        <View style={[styles.statCell, { borderRightWidth: 0 }]}>
          <Estimate value={c.estReachAtGoal} variant="bodyStrong" suffix="" color={colors.ink} />
          <Text variant="caption">reach at goal</Text>
        </View>
      </View>
      {c.delivery ? (
        <View style={styles.delivery}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="label" weight="semi" color={colors.ink}>{c.status === 'completed' ? 'Final delivery' : `Delivery so far · day ${c.delivery.days}`}</Text>
            <Pill label="Simulated delivery" tone="neutral" />
          </Row>
          <Row gap={space.lg}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="caption">People reached</Text>
              <Measured value={c.delivery.reach} variant="bodyStrong" suffix="" />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="caption">Ad spend</Text>
              <Text variant="bodyStrong">{formatMoney(c.delivery.spendCents)}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="caption">Impressions</Text>
              <Text variant="bodyStrong">{formatCompact(c.delivery.impressions)}</Text>
            </View>
          </Row>
          <Text variant="caption">Estimate for the full budget: ≈{formatCompact(estimateReach(c.raisedCents, model))} people</Text>
        </View>
      ) : null}
      {c.isDemo ? (
        <Row gap={6}>
          <DemoTag />
          <Text variant="caption">Sample figures for demonstration.</Text>
        </Row>
      ) : null}
    </View>
  );
}

export function CampaignView({ c, preview = false, onBack }: { c: CampaignDetailDTO; preview?: boolean; onBack?: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scroll = useRef<Animated.ScrollView>(null);
  const sourcesY = useRef(0);
  const [highlight, setHighlight] = useState<number | null>(null);
  const [menu, setMenu] = useState(false);
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    y.value = e.contentOffset.y;
  });
  const barStyle = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [COVER_H - 120, COVER_H - 60], [0, 1], 'clamp') }));
  const save = useToggle('save', c.id);
  const content = c.content;
  const backable = c.status === 'available_for_funding' && !preview;
  const sampleQuote = quote(2500, reachModel(c.reachModelVersion).peoplePerAdDollar);

  const cite = (n: number) => {
    setHighlight(n);
    scroll.current?.scrollTo({ y: Math.max(0, sourcesY.current - 80), animated: true });
    setTimeout(() => setHighlight(null), 2500);
  };
  const toggleSave = () => {
    if (preview) return;
    haptic('select');
    const on = !c.viewer.saved;
    save.mutate(on);
    toast.success(on ? 'Saved to your profile' : 'Removed from saved');
  };
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/explore')));
  const channels = CHANNELS.filter((ch) => content.reach.channels.includes(ch.key));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Animated.ScrollView ref={scroll} onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingBottom: backable || !preview ? 120 : space.xxxl }}>
        {/* Cover */}
        <View style={{ height: COVER_H, backgroundColor: colors.surfaceAlt }}>
          {content.basics.cover ? <Image source={content.basics.cover.url} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} accessibilityLabel="Campaign cover image" /> : null}
          <View style={styles.coverShade} />
        </View>

        <Section style={{ paddingTop: space.lg, gap: space.md }}>
          <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
            {content.basics.category ? (
              <View style={[styles.category, { backgroundColor: categoryTint[content.basics.category] }]}>
                <Text variant="caption" weight="semi" color={colors.ink}>{content.basics.category}</Text>
              </View>
            ) : null}
            <StatusPill status={c.status} />
          </Row>
          <Text variant="display" accessibilityRole="header">{content.basics.title || 'Untitled campaign'}</Text>
          {content.basics.summary ? <Text variant="body" color={colors.textMuted} style={{ fontSize: 16, lineHeight: 24 }}>{content.basics.summary}</Text> : null}
          <Row gap={space.md}>
            <View style={styles.avatar}>
              <Text variant="bodyStrong" color={colors.white}>{(content.basics.creatorName || '?')[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong" color={colors.ink}>{content.basics.creatorName || 'Creator name'}</Text>
              <Text variant="caption">
                {creatorTypeLabel(content.basics.creatorType ?? null)}
                {c.publishedAt ? ` · Published ${longDate(c.publishedAt)}` : preview ? ' · Preview' : ''}
              </Text>
            </View>
            {!preview ? <IconButton icon={<Share2 size={20} color={colors.ink} />} label="Share campaign" variant="filled" onPress={() => shareCampaign(c)} /> : null}
          </Row>
        </Section>

        <Section style={{ marginTop: space.xl }}>
          <View style={styles.journey}>
            <Text variant="overline" style={{ marginBottom: space.md }}>Where this campaign is</Text>
            <JourneyRail status={c.status} />
          </View>
        </Section>

        {!preview ? (
          <Section style={{ marginTop: space.lg }}>
            <FundingPanel c={c} />
            {c.status === 'completed' ? (
              <Button label="View final report" variant="secondary" icon={<BarChart3 size={18} color={colors.ink} />} onPress={() => router.push({ pathname: '/campaign/[id]/report', params: { id: c.id } })} full style={{ marginTop: space.md }} />
            ) : null}
          </Section>
        ) : null}

        {/* Story */}
        <Section style={{ marginTop: space.xxl }}>
          <Story content={content} onCite={cite} />
        </Section>
        <Section style={{ marginTop: space.xl }}>
          <Actions actions={content.story.actions} />
        </Section>
        <Section style={{ marginTop: space.xl }}>
          <View onLayout={(e: LayoutChangeEvent) => (sourcesY.current = e.nativeEvent.layout.y)}>
            <Sources sources={content.story.sources} highlight={highlight} />
          </View>
        </Section>

        {!preview ? (
          <Section style={{ marginTop: space.xl }}>
            <FeedbackPoll c={c} />
          </Section>
        ) : null}

        {/* Trust & transparency */}
        <Section style={{ marginTop: space.xl }}>
          <Accordion title="Where your money goes" subtitle="Fees, ad budget, refunds" icon={<HandCoins size={18} color={colors.accent} />} initiallyOpen={backable}>
            <Notice tone="accent" title="Amplification, not a donation">{AMPLIFICATION_LINE}</Notice>
            <Text variant="label" color={colors.text}>Example: a $25 contribution</Text>
            <MoneyFlow quote={sampleQuote} />
            <Text variant="label" color={colors.text}>
              Funds are held for distribution and never paid to the creator. Reaching the goal doesn’t launch ads by itself — our team launches them once ad setup is complete.
            </Text>
            <Text variant="label" weight="semi" color={colors.ink} style={{ marginTop: space.xs }}>Refunds & unspent funds</Text>
            {REFUND_MATRIX.map((r) => (
              <View key={r.when} style={styles.refundRow}>
                <Text variant="label" weight="semi" color={colors.text}>{r.when}</Text>
                <Text variant="caption">{r.treatment}</Text>
              </View>
            ))}
          </Accordion>
          <Accordion title="Who this will reach" subtitle={content.reach.locations.join(', ') || 'Audience settings'} icon={<Users size={18} color={colors.accent} />}>
            <View style={styles.kv}>
              <Text variant="caption">Where</Text>
              <Text variant="label" color={colors.ink}>{content.reach.locations.join(', ') || '—'}</Text>
            </View>
            <View style={styles.kv}>
              <Text variant="caption">Ages</Text>
              <Text variant="label" color={colors.ink}>{content.reach.ageMin}–{content.reach.ageMax}{content.reach.ageMax >= 65 ? '+' : ''}</Text>
            </View>
            {content.reach.interests.length ? (
              <View style={styles.kv}>
                <Text variant="caption">Interests</Text>
                <Text variant="label" color={colors.ink}>{content.reach.interests.join(', ')}</Text>
              </View>
            ) : null}
            <View style={styles.kv}>
              <Text variant="caption">Ad run</Text>
              <Text variant="label" color={colors.ink}>{content.reach.durationDays} days once launched</Text>
            </View>
            <Text variant="label" weight="semi" color={colors.ink} style={{ marginTop: space.xs }}>How it may appear</Text>
            <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }}>
              <AdPreview
                headline={content.visuals.adHeadline || content.basics.title}
                description={content.visuals.adDescription}
                cta={content.visuals.cta}
                imageUrl={content.visuals.adImages[0]?.url ?? content.basics.cover?.url}
                creatorName={content.basics.creatorName}
              />
              <AdPreview
                placement="story"
                headline={content.visuals.adHeadline || content.basics.title}
                description={content.visuals.adDescription}
                cta={content.visuals.cta}
                imageUrl={content.visuals.adImages[0]?.url ?? content.basics.cover?.url}
                creatorName={content.basics.creatorName}
              />
            </Animated.ScrollView>
            <Text variant="caption">
              Ads are clearly labelled “Sponsored”. Targeting uses broad location, age and interest categories only — creators never see who saw the ads, and we don’t share backers’ details with advertisers.
            </Text>
          </Accordion>
          <Accordion title="How it was reviewed" subtitle="Reviewed, not verified or guaranteed" icon={<ShieldCheck size={18} color={colors.accent} />}>
            {c.reviews.length === 0 ? (
              <Text variant="label">{preview ? 'Reviewers will assess these three layers after you submit.' : 'This campaign hasn’t been reviewed yet.'}</Text>
            ) : null}
            {REVIEW_LAYERS.map((l) => {
              const r = c.reviews.find((x) => x.layer === l.key);
              return (
                <View key={l.key} style={styles.layer}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Text variant="label" weight="semi" color={colors.ink}>{l.label}</Text>
                    {r ? <Pill label={r.outcome === 'pass' ? 'Passed' : r.outcome === 'concern' ? 'Concern noted' : 'Failed'} tone={r.outcome === 'pass' ? 'success' : r.outcome === 'concern' ? 'warning' : 'danger'} /> : <Pill label="Pending" />}
                  </Row>
                  <Text variant="caption">{l.question}</Text>
                  {r?.notes ? <Text variant="label" color={colors.text}>“{r.notes}”</Text> : null}
                </View>
              );
            })}
            {c.reviews[0] ? <Text variant="caption">Reviewed {longDate(c.reviews[0].reviewedAt)} by a trained reviewer. Reviews evaluate the campaign as submitted; they don’t certify that every claim is true.</Text> : null}
            <Pressable onPress={() => openGlossary('review')} accessibilityRole="button">
              <Text variant="label" color={colors.accent} weight="semi">How review works</Text>
            </Pressable>
          </Accordion>
          <Accordion title="Distribution partners" subtitle={channels.map((ch) => ch.label).join(' · ') || 'Channels'} icon={<Megaphone size={18} color={colors.accent} />}>
            {channels.map((ch) => (
              <View key={ch.key} style={styles.kv}>
                <Text variant="label" weight="semi" color={colors.ink}>{ch.label}</Text>
                <Text variant="caption">{ch.placements.join(', ')} · {content.reach.split[ch.key] ?? 0}% of budget (proposed)</Text>
              </View>
            ))}
            <Text variant="caption">Final placements and bids are set by our team during distribution preparation.</Text>
          </Accordion>
        </Section>

        {!preview ? (
          <Section style={{ marginTop: space.lg, gap: space.sm }}>
            <Pressable onPress={() => router.push({ pathname: '/campaign/[id]/updates', params: { id: c.id } })} style={styles.updatesRow} accessibilityRole="button">
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">Updates & milestones</Text>
                <Text variant="caption">{c.updates.length ? `${c.updates.length} update${c.updates.length === 1 ? '' : 's'} · latest: ${c.updates[0].title}` : 'Nothing posted yet'}</Text>
              </View>
              <ChevronRight size={18} color={colors.textSubtle} />
            </Pressable>
            {c.publicBackers.length ? (
              <Text variant="caption">
                Backed by {c.publicBackers.slice(0, 4).join(', ')}
                {c.backerCount > 4 ? ` and ${(c.backerCount - Math.min(4, c.publicBackers.length)).toLocaleString()} others` : ''}. Most backers choose to stay anonymous.
              </Text>
            ) : null}
          </Section>
        ) : null}
      </Animated.ScrollView>

      {/* Floating top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + space.xs }]} pointerEvents="box-none">
        <Animated.View style={[StyleSheet.absoluteFill, styles.topBarBg, barStyle]} />
        <IconButton icon={<ArrowLeft size={22} color={colors.ink} />} label="Back" variant="overlay" onPress={back} />
        <Animated.View style={[{ flex: 1, paddingHorizontal: space.sm }, barStyle]}>
          <Text variant="label" weight="semi" color={colors.ink} numberOfLines={1}>{content.basics.title}</Text>
        </Animated.View>
        {!preview ? (
          <>
            <IconButton
              icon={c.viewer.saved ? <BookmarkCheck size={20} color={colors.accent} /> : <Bookmark size={20} color={colors.ink} />}
              label={c.viewer.saved ? 'Remove from saved' : 'Save campaign'}
              variant="overlay"
              onPress={toggleSave}
            />
            <IconButton icon={<MoreHorizontal size={20} color={colors.ink} />} label="More options" variant="overlay" onPress={() => setMenu(true)} />
          </>
        ) : null}
      </View>

      {/* Sticky funding bar */}
      {!preview ? (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="label" color={colors.ink} weight="semi" numberOfLines={1}>
              {formatMoney(c.raisedCents)} <Text variant="caption">of {formatMoney(c.goalCents)}</Text>
            </Text>
            <ProgressBar value={percentFunded(c.raisedCents, c.goalCents)} height={5} />
            <Text variant="caption" numberOfLines={1}>
              {c.status === 'available_for_funding' ? timeLeft(c.fundingEndsAt) : c.status === 'completed' ? 'Campaign completed' : 'Funding closed'}
            </Text>
          </View>
          <IconButton icon={<Share2 size={20} color={colors.ink} />} label="Share" variant="filled" size={48} onPress={() => shareCampaign(c)} />
          {backable ? (
            <Button label="Back this" onPress={() => router.push({ pathname: '/back/[id]', params: { id: c.id } })} style={{ minWidth: 128 }} />
          ) : c.status === 'completed' ? (
            <Button label="See report" onPress={() => router.push({ pathname: '/campaign/[id]/report', params: { id: c.id } })} style={{ minWidth: 128 }} />
          ) : (
            <FollowButton c={c} />
          )}
        </View>
      ) : null}

      {!preview ? <ReportSheet visible={menu} onClose={() => setMenu(false)} campaignId={c.id} title={content.basics.title} /> : null}
    </View>
  );
}

function FollowButton({ c }: { c: CampaignDetailDTO }) {
  const follow = useToggle('follow', c.id);
  const on = c.viewer.following;
  return (
    <Button
      label={on ? 'Following' : 'Follow'}
      variant={on ? 'secondary' : 'primary'}
      onPress={() => {
        follow.mutate(!on);
        toast.success(on ? 'You won’t get updates for this campaign' : 'We’ll notify you about distribution and the final report');
      }}
      style={{ minWidth: 128 }}
    />
  );
}

const styles = StyleSheet.create({
  coverShade: { position: 'absolute', left: 0, right: 0, top: 0, height: 110, backgroundColor: 'rgba(15,23,42,0.18)' },
  category: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  journey: { backgroundColor: colors.bg, borderRadius: radius.lg, padding: space.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  panel: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: space.lg, gap: space.md, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  stats: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingTop: space.md },
  statCell: { flex: 1, gap: 2, borderRightWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingHorizontal: space.xs },
  delivery: { backgroundColor: colors.successSoft, borderRadius: radius.md, padding: space.md, gap: space.sm },
  refundRow: { gap: 2, paddingVertical: space.xs },
  kv: { gap: 2 },
  layer: { gap: 4, padding: space.md, backgroundColor: colors.bg, borderRadius: radius.md },
  updatesRow: { flexDirection: 'row', alignItems: 'center', padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.bg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingBottom: space.sm, gap: space.sm },
  topBarBg: { backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingTop: space.md, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...shadow.raised },
});

