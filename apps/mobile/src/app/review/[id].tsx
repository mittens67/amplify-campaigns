import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { Check, ExternalLink, Eye, Rocket, Square, SquareCheck } from 'lucide-react-native';
import {
  adBudget,
  CHANNELS,
  estimateReachAtGoal,
  formatMoney,
  platformFee,
  REVIEW_LAYERS,
  STATUS_LABEL,
  type ReviewLayerKey,
  type ReviewOutcome,
} from '@amplify/domain';
import { CampaignView } from '@/features/campaign/CampaignView';
import { errorMessage } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { longDate } from '@/lib/format';
import { useReviewAction, useReviewCampaign } from '@/lib/queries';
import { Accordion, Button, colors, ErrorState, Estimate, Notice, Pill, radius, Row, ScreenHeader, Skeleton, space, StatusPill, Text, TextField, toast } from '@/ui';

const OUTCOMES: { key: ReviewOutcome; label: string; tone: 'success' | 'warning' | 'danger' }[] = [
  { key: 'pass', label: 'Pass', tone: 'success' },
  { key: 'concern', label: 'Concern', tone: 'warning' },
  { key: 'fail', label: 'Fail', tone: 'danger' },
];
const NOTE_FIELDS = [
  ['basics.title', 'Title'],
  ['basics.summary', 'Summary'],
  ['story.intro', 'Introduction'],
  ['story.sources', 'Sources'],
  ['visuals.adHeadline', 'Ad headline'],
  ['reach.locations', 'Targeting'],
] as const;

function KV({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text variant="caption">{k}</Text>
      <Text variant="label" color={colors.ink}>{v || '—'}</Text>
    </View>
  );
}

export default function ReviewInspector() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useReviewCampaign(id);
  const act = useReviewAction(id);
  const [layers, setLayers] = useState<Partial<Record<ReviewLayerKey, { outcome: ReviewOutcome; notes: string }>>>({});
  const [message, setMessage] = useState('');
  const [fieldNotes, setFieldNotes] = useState<Record<string, string>>({});
  const [adSetup, setAdSetup] = useState(false);
  const [preview, setPreview] = useState(false);

  const c = q.data;
  if (!c) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenHeader title="Review" />
        {q.isError ? <ErrorState error={q.error} onRetry={q.refetch} /> : <View style={{ padding: space.lg }}><Skeleton height={300} radius={20} /></View>}
      </View>
    );
  }
  const content = c.status === 'submitted' || c.status === 'changes_requested' ? c.draft?.content ?? c.content : c.content;
  if (preview) return <CampaignView c={{ ...c, content }} preview onBack={() => setPreview(false)} />;

  const run = async (action: Parameters<typeof act.mutateAsync>[0]['action'], body?: Record<string, unknown>, success?: string) => {
    try {
      await act.mutateAsync({ action, body });
      haptic('success');
      toast.success(success ?? 'Done');
    } catch (e) {
      haptic('error');
      toast.error(errorMessage(e));
    }
  };
  const decide = (decision: 'approve' | 'request_changes' | 'reject') =>
    run(
      'decision',
      {
        decision,
        message,
        layers: Object.entries(layers).map(([layer, v]) => ({ layer, outcome: v!.outcome, notes: v!.notes })),
        fieldNotes: Object.fromEntries(Object.entries(fieldNotes).filter(([, v]) => v.trim())),
      },
      decision === 'approve' ? 'Approved — now open for backing' : decision === 'reject' ? 'Rejected — creator notified' : 'Changes requested — creator notified',
    );
  const allLayers = REVIEW_LAYERS.every((l) => layers[l.key]);
  const anyFail = Object.values(layers).some((l) => l?.outcome === 'fail');
  const goal = c.goalCents || content.submit.goalCents || 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Review" subtitle={STATUS_LABEL[c.status]} right={<Button label="Preview" size="sm" variant="ghost" icon={<Eye size={16} color={colors.accent} />} onPress={() => setPreview(true)} />} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxxl }} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Row gap={space.md} align="flex-start">
            {content.basics.cover ? <Image source={content.basics.cover.url} style={styles.thumb} contentFit="cover" /> : null}
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="cardTitle">{content.basics.title}</Text>
              <Text variant="caption">{content.basics.creatorName} · {content.basics.category}</Text>
              <StatusPill status={c.status} />
            </View>
          </Row>
          <Text variant="label" color={colors.text}>{content.basics.summary}</Text>
        </View>

        {/* Lifecycle actions for funded / live campaigns */}
        {['goal_reached', 'funding_ended'].includes(c.status) ? (
          <Notice tone="accent" title="Funding closed — prepare distribution">
            <Text variant="label" color={colors.text}>{formatMoney(c.raisedCents)} raised · ad budget {formatMoney(adBudget(c.raisedCents))}. Finalise placements and bids with the ad partners.</Text>
            <Button label="Start distribution preparation" size="sm" onPress={() => run('prepare', {}, 'Distribution preparation started')} loading={act.isPending} style={{ marginTop: space.sm, alignSelf: 'flex-start' }} />
          </Notice>
        ) : null}
        {c.status === 'distribution_preparation' ? (
          <View style={styles.card}>
            <Text variant="heading">Launch ads</Text>
            <Text variant="label">Ads only run once approval, payment and ad setup are all complete.</Text>
            {[['Approved by review', true], [`Funds captured (${formatMoney(c.raisedCents)})`, true]].map(([l]) => (
              <Row key={String(l)} gap={space.sm}><Check size={16} color={colors.success} /><Text variant="label" color={colors.text}>{l}</Text></Row>
            ))}
            <Pressable onPress={() => setAdSetup((v) => !v)} style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }} accessibilityRole="checkbox" accessibilityState={{ checked: adSetup }}>
              {adSetup ? <SquareCheck size={20} color={colors.accent} /> : <Square size={20} color={colors.textSubtle} />}
              <Text variant="label" color={colors.ink}>Creative, targeting and budget are set up with the ad partners</Text>
            </Pressable>
            <Button label="Launch ads" icon={<Rocket size={16} color={colors.white} />} disabled={!adSetup} onPress={() => run('launch', { adSetupConfirmed: true }, 'Ads launched')} loading={act.isPending} full />
          </View>
        ) : null}
        {c.status === 'promoting' ? (
          <Notice tone="success" title={`Ads running · day ${c.delivery?.days ?? 0}`}>
            <Text variant="label" color={colors.text}>Delivery accrues daily. Advance the demo clock, or finish the run now to generate the final report.</Text>
            <Button label="Finish ad run now" size="sm" onPress={() => run('finish', {}, 'Ad run completed — report ready')} loading={act.isPending} style={{ marginTop: space.sm, alignSelf: 'flex-start' }} />
          </Notice>
        ) : null}

        <Accordion title="Story & sources" subtitle={`${content.story.blocks.length} sections · ${content.story.sources.length} sources`} initiallyOpen={c.status === 'submitted'}>
          <Text variant="story" numberOfLines={6}>{content.story.intro}</Text>
          {content.story.sources.map((s, i) => (
            <Pressable key={s.id} onPress={() => s.url && void Linking.openURL(s.url)} style={styles.source} accessibilityRole="link">
              <Text variant="label" weight="bold" color={colors.accentText}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text variant="label" color={colors.ink}>{s.title}</Text>
                <Text variant="caption" numberOfLines={1}>{s.url}</Text>
              </View>
              <ExternalLink size={14} color={colors.textSubtle} />
            </Pressable>
          ))}
          {content.story.sources.length < 3 ? <Pill label={`Only ${content.story.sources.length} source${content.story.sources.length === 1 ? '' : 's'}`} tone="warning" /> : null}
          <Button label="Open full preview" variant="secondary" size="sm" onPress={() => setPreview(true)} />
        </Accordion>
        <Accordion title="Creative assets" subtitle={`${content.visuals.adImages.length} ad image(s)${content.visuals.video ? ' · video' : ''}`}>
          <ScrollView horizontal contentContainerStyle={{ gap: space.sm }}>
            {[content.basics.cover, ...content.visuals.adImages].filter(Boolean).map((a, i) => (
              <Image key={i} source={a!.url} style={styles.asset} contentFit="cover" />
            ))}
          </ScrollView>
          <KV k="Ad headline" v={content.visuals.adHeadline || `(title) ${content.basics.title}`} />
          <KV k="Ad description" v={content.visuals.adDescription} />
          <KV k="Call to action" v={content.visuals.cta} />
        </Accordion>
        <Accordion title="Targeting & budget" subtitle={content.reach.locations.join(', ')}>
          <KV k="Locations" v={content.reach.locations.join(', ')} />
          <KV k="Ages" v={`${content.reach.ageMin}–${content.reach.ageMax}`} />
          <KV k="Interests" v={content.reach.interests.join(', ')} />
          <KV k="Proposed split" v={CHANNELS.filter((ch) => content.reach.channels.includes(ch.key)).map((ch) => `${ch.label} ${content.reach.split[ch.key] ?? 0}%`).join(' · ')} />
          <KV k="Ad run" v={`${content.reach.durationDays} days`} />
          <KV k="Funding goal" v={`${formatMoney(goal)} → ${formatMoney(adBudget(goal))} ad budget + ${formatMoney(platformFee(goal))} fee`} />
          <Row gap={space.sm}><Text variant="caption">Reach at goal</Text><Estimate value={estimateReachAtGoal(goal)} variant="caption" /></Row>
        </Accordion>

        {c.status === 'submitted' ? (
          <>
            <View style={styles.card}>
              <Text variant="heading">Review rubric</Text>
              <Text variant="caption">Record an outcome for each layer. Approval needs all three, with no failures. Outcomes are shown to the public; no score is calculated.</Text>
              {REVIEW_LAYERS.map((l) => {
                const v = layers[l.key];
                return (
                  <View key={l.key} style={styles.layer}>
                    <Text variant="bodyStrong">{l.label}</Text>
                    <Text variant="caption">{l.question}</Text>
                    <Row gap={space.sm}>
                      {OUTCOMES.map((o) => {
                        const on = v?.outcome === o.key;
                        return (
                          <Pressable
                            key={o.key}
                            onPress={() => setLayers((s) => ({ ...s, [l.key]: { outcome: o.key, notes: s[l.key]?.notes ?? '' } }))}
                            style={[styles.outcome, on && { borderColor: colors[o.tone], backgroundColor: o.tone === 'success' ? colors.successSoft : o.tone === 'warning' ? colors.warningSoft : colors.dangerSoft }]}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: on }}
                          >
                            <Text variant="label" weight="semi" color={on ? colors[o.tone] : colors.text}>{o.label}</Text>
                          </Pressable>
                        );
                      })}
                    </Row>
                    {v ? <TextField value={v.notes} onChangeText={(t) => setLayers((s) => ({ ...s, [l.key]: { ...s[l.key]!, notes: t } }))} placeholder="Notes (shown to the public on approval)" /> : null}
                  </View>
                );
              })}
            </View>

            <View style={styles.card}>
              <Text variant="heading">Feedback for the creator</Text>
              <TextField label="Message" value={message} onChangeText={setMessage} multiline placeholder="Explain the decision — required for changes or rejection" />
              <Text variant="label" weight="semi" color={colors.text}>Field notes (shown next to the field in their editor)</Text>
              {NOTE_FIELDS.map(([path, label]) => (
                <TextField key={path} label={label} optional value={fieldNotes[path] ?? ''} onChangeText={(t) => setFieldNotes((s) => ({ ...s, [path]: t }))} placeholder={`Note on ${label.toLowerCase()}`} />
              ))}
              <Button label="Approve" icon={<Check size={16} color={colors.white} />} onPress={() => decide('approve')} disabled={!allLayers || anyFail} loading={act.isPending} full />
              {!allLayers ? <Text variant="caption">Record all three layers to enable approval.</Text> : anyFail ? <Text variant="caption" color={colors.danger}>A failed layer can’t be approved.</Text> : null}
              <Row gap={space.sm}>
                <Button label="Request changes" variant="secondary" onPress={() => decide('request_changes')} disabled={!message.trim()} style={{ flex: 1 }} />
                <Button label="Reject" variant="danger" onPress={() => decide('reject')} disabled={!message.trim()} style={{ flex: 1 }} />
              </Row>
            </View>
          </>
        ) : null}

        {['available_for_funding', 'goal_reached', 'funding_ended', 'distribution_preparation'].includes(c.status) ? (
          <Button label="Halt campaign and refund backers" variant="danger" onPress={() => run('halt', { note: 'Halted by reviewer after report' }, 'Campaign halted — refunds started')} full />
        ) : null}

        <Accordion title="Audit history" subtitle={`${c.timeline.length} events`}>
          {c.timeline.map((e) => (
            <View key={e.id} style={{ gap: 2, paddingVertical: 4 }}>
              <Text variant="label" weight="semi" color={colors.ink}>{e.event.replace(/_/g, ' ')} → {STATUS_LABEL[e.to]}</Text>
              <Text variant="caption">{longDate(e.at)} · {e.actorRole}</Text>
              {e.note ? <Text variant="caption" color={colors.text}>“{e.note}”</Text> : null}
            </View>
          ))}
          {c.reviewHistory.length ? <Text variant="caption">{c.reviewHistory.length} rubric entries across {new Set(c.reviewHistory.map((h) => h.round)).size} review round(s).</Text> : null}
        </Accordion>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: space.lg, gap: space.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  thumb: { width: 72, height: 72, borderRadius: radius.md },
  source: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  asset: { width: 150, height: 94, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  layer: { gap: space.sm, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  outcome: { flex: 1, height: 42, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
});
