import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ExternalLink, MessageSquareWarning, PenSquare, Share2 } from 'lucide-react-native';
import { formatCompact, formatMoney, nextStepCopy, percentFunded, PUBLIC_STATUSES, STATUS_LABEL } from '@amplify/domain';
import { Bars } from '@/features/campaign/Bars';
import { GhostBar, ReportBody } from '@/features/campaign/ReportBody';
import { api, errorMessage } from '@/lib/api';
import { longDate, shortDate, timeLeft } from '@/lib/format';
import { keys, queryClient, useAnalytics, useCampaign } from '@/lib/queries';
import { shareCampaign } from '@/lib/share';
import { Button, colors, ErrorState, IconButton, JourneyRail, Measured, Notice, Pill, ProgressBar, radius, Row, ScreenHeader, Sheet, Skeleton, space, StatusPill, Text, TextField, toast } from '@/ui';

const EVENT_LABEL: Record<string, string> = {
  create: 'Draft created',
  submit: 'Submitted for review',
  resubmit: 'Resubmitted',
  request_changes: 'Changes requested',
  approve: 'Approved',
  reject: 'Not approved',
  open_funding: 'Opened for backing',
  goal_reached: 'Funding goal reached',
  period_ended: 'Funding period ended',
  funding_failed: 'Ended below minimum',
  prepare: 'Distribution preparation started',
  launch: 'Ads launched',
  complete: 'Ad run completed',
  halt: 'Halted — refunds started',
  refund_complete: 'Refunds issued',
  cancel: 'Cancelled',
};

function Panel({ title, tag, children }: { title: string; tag?: string; children: React.ReactNode }) {
  return (
    <View style={styles.panel}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="heading">{title}</Text>
        {tag ? <Pill label={tag} /> : null}
      </Row>
      {children}
    </View>
  );
}

function Stat({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <View style={styles.stat}>
      <Text variant="caption">{label}</Text>
      {children ?? <Text variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>{value}</Text>}
    </View>
  );
}

export default function CreatorCampaign() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const c = useCampaign(id);
  const a = useAnalytics(id);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [uTitle, setUTitle] = useState('');
  const [uBody, setUBody] = useState('');
  const [posting, setPosting] = useState(false);

  if (c.isError) return (<View style={{ flex: 1, backgroundColor: colors.bg }}><ScreenHeader title="Campaign" /><ErrorState error={c.error} onRetry={c.refetch} /></View>);
  const d = c.data;
  const an = a.data;
  const isPublic = d && PUBLIC_STATUSES.includes(d.status);

  const post = async () => {
    setPosting(true);
    try {
      await api(`/campaigns/${id}/updates`, { method: 'POST', body: { title: uTitle, body: uBody } });
      toast.success('Update posted and sent to backers');
      setUpdateOpen(false);
      setUTitle('');
      setUBody('');
      void queryClient.invalidateQueries({ queryKey: keys.campaign(id) });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setPosting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        title={d?.title ?? 'Campaign'}
        right={isPublic && d ? <IconButton icon={<Share2 size={20} color={colors.ink} />} label="Share" onPress={() => shareCampaign(d)} /> : undefined}
      />
      {!d ? (
        <View style={{ padding: space.lg, gap: space.md }}>
          <Skeleton height={120} radius={20} />
          <Skeleton height={200} radius={20} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxxl }}
          refreshControl={<RefreshControl refreshing={c.isRefetching} onRefresh={() => { void c.refetch(); void a.refetch(); }} tintColor={colors.accent} colors={[colors.accent]} />}
        >
          <View style={styles.panel}>
            <Row style={{ justifyContent: 'space-between' }}>
              <StatusPill status={d.status} />
              {d.status === 'available_for_funding' ? <Text variant="caption">{timeLeft(d.fundingEndsAt)}</Text> : null}
            </Row>
            <JourneyRail status={d.status} />
            <Text variant="label" color={colors.text}>{nextStepCopy(d.status)}</Text>
            <Row gap={space.sm}>
              {isPublic ? <Button label="View public page" variant="secondary" size="sm" icon={<ExternalLink size={14} color={colors.ink} />} onPress={() => router.push({ pathname: '/campaign/[id]', params: { id } })} /> : null}
              {isPublic && d.status !== 'completed' ? <Button label="Post an update" variant="secondary" size="sm" icon={<PenSquare size={14} color={colors.ink} />} onPress={() => setUpdateOpen(true)} /> : null}
            </Row>
          </View>

          {d.status === 'rejected' && d.draft?.reviewerMessage ? (
            <Notice tone="danger" title="Not approved" icon={<MessageSquareWarning size={18} color={colors.danger} />}>{d.draft.reviewerMessage}</Notice>
          ) : null}
          {d.status === 'refund_pending' || d.status === 'refunded' ? (
            <Notice tone="warning" title={STATUS_LABEL[d.status]}>Backers are refunded their contributions (processing fees excluded). No ads will run for this campaign.</Notice>
          ) : null}

          {an ? (
            <>
              <Panel title="Funding" tag="From payment records">
                <View>
                  <Text variant="number" style={{ fontSize: 28, lineHeight: 32 }}>{formatMoney(an.funding.raisedCents)}</Text>
                  <Text variant="label">of {formatMoney(an.funding.goalCents)} · {percentFunded(an.funding.raisedCents, an.funding.goalCents)}%</Text>
                </View>
                <ProgressBar value={percentFunded(an.funding.raisedCents, an.funding.goalCents)} height={8} />
                <View style={styles.grid}>
                  <Stat label="Backers" value={an.funding.backerCount.toLocaleString()} />
                  <Stat label="Contributions" value={an.funding.contributionCount.toLocaleString()} />
                  <Stat label="Average" value={formatMoney(an.funding.averageCents)} />
                  <Stat label="Ad budget so far" value={formatMoney(an.funding.adBudgetCents)} />
                </View>
                <Text variant="label" weight="semi" color={colors.ink}>Contributions per day</Text>
                <Bars
                  values={an.funding.daily.map((p) => p.value)}
                  labels={an.funding.daily.length ? [shortDate(an.funding.daily[0].day), shortDate(an.funding.daily[an.funding.daily.length - 1].day)] : undefined}
                  formatMax={(n) => formatMoney(n)}
                />
              </Panel>

              <Panel title="Delivery" tag={an.delivery.daily.length ? 'Simulated delivery' : 'Not started'}>
                {an.delivery.daily.length ? (
                  <>
                    <View style={{ gap: 6 }}>
                      <Row style={{ justifyContent: 'space-between' }}>
                        <Text variant="label">Ad budget spent</Text>
                        <Text variant="label" weight="semi" color={colors.ink}>{formatMoney(an.delivery.spentCents)} of {formatMoney(an.delivery.allocatedCents)}</Text>
                      </Row>
                      <ProgressBar value={(an.delivery.spentCents / Math.max(1, an.delivery.allocatedCents)) * 100} color={colors.success} height={8} />
                    </View>
                    <GhostBar label="People reached vs. estimate" estimate={an.estimates.reachForRaised} measured={an.delivery.reach} />
                    <View style={styles.grid}>
                      <Stat label="Impressions" value={formatCompact(an.delivery.impressions)} />
                      <Stat label="Clicks" value={formatCompact(an.delivery.clicks)} />
                      <Stat label="CTR" value={an.delivery.ctr != null ? `${(an.delivery.ctr * 100).toFixed(2)}%` : '—'} />
                      <Stat label="CPM" value={an.delivery.cpmCents != null ? formatMoney(an.delivery.cpmCents, { cents: true }) : '—'} />
                    </View>
                    <Text variant="label" weight="semi" color={colors.ink}>People reached per day</Text>
                    <Bars color={colors.success} values={an.delivery.daily.map((p) => p.reach)} labels={[shortDate(an.delivery.daily[0].day), shortDate(an.delivery.daily[an.delivery.daily.length - 1].day)]} formatMax={(n) => formatCompact(n)} />
                    <Row gap={space.sm}>
                      <Text variant="caption">Total measured reach</Text>
                      <Measured value={an.delivery.reach} variant="caption" />
                    </Row>
                  </>
                ) : (
                  <Text variant="label">Delivery metrics appear once ads launch. Funding completion doesn’t start ads automatically — our team launches them after ad setup.</Text>
                )}
              </Panel>

              {d.status === 'completed' && d.delivery ? (
                <View style={{ gap: space.md }}>
                  <Text variant="title">Final report</Text>
                  <ReportBody
                    final
                    n={{ raisedCents: d.raisedCents, spentCents: d.delivery.spendCents, impressions: d.delivery.impressions, reach: d.delivery.reach, clicks: d.delivery.clicks, estReach: an.estimates.reachForRaised, days: d.delivery.days, durationDays: an.durationDays, backerCount: d.backerCount }}
                  />
                </View>
              ) : null}
            </>
          ) : a.isError ? (
            <ErrorState error={a.error} onRetry={a.refetch} compact />
          ) : (
            <Skeleton height={220} radius={20} />
          )}

          <Panel title="History">
            {d.timeline.map((e, i) => (
              <View key={e.id} style={styles.event}>
                <View style={styles.eventRail}>
                  <View style={[styles.eventDot, i === d.timeline.length - 1 && { backgroundColor: colors.accent }]} />
                  {i < d.timeline.length - 1 ? <View style={styles.eventLine} /> : null}
                </View>
                <View style={{ flex: 1, paddingBottom: space.md }}>
                  <Text variant="label" weight="semi" color={colors.ink}>{EVENT_LABEL[e.event] ?? STATUS_LABEL[e.to]}</Text>
                  <Text variant="caption">{longDate(e.at)} · {e.actorRole === 'system' ? 'Automatic' : e.actorRole === 'reviewer' ? 'Review team' : 'You'}</Text>
                  {e.note ? <Text variant="caption" color={colors.text} style={{ marginTop: 2 }}>“{e.note}”</Text> : null}
                </View>
              </View>
            ))}
          </Panel>
        </ScrollView>
      )}

      <Sheet visible={updateOpen} onClose={() => setUpdateOpen(false)} title="Post an update" footer={<Button label="Post update" onPress={post} loading={posting} disabled={uTitle.trim().length < 3 || !uBody.trim()} full />}>
        <Text variant="label">Backers and followers are notified. Material changes to the campaign itself go back through review.</Text>
        <TextField label="Title" value={uTitle} onChangeText={setUTitle} maxChars={80} placeholder="e.g. Ads are now running in Phoenix" />
        <TextField label="Update" value={uBody} onChangeText={setUBody} multiline maxChars={2000} placeholder="What’s new?" />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: space.lg, gap: space.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  stat: { width: '48%', flexGrow: 1, backgroundColor: colors.bg, borderRadius: radius.md, padding: space.md, gap: 2 },
  event: { flexDirection: 'row', gap: space.md },
  eventRail: { width: 12, alignItems: 'center' },
  eventDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.borderStrong, marginTop: 4 },
  eventLine: { flex: 1, width: 2, backgroundColor: colors.border, marginTop: 2 },
});
