import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { Img as Image } from '@/ui/Img';
import { useRouter } from 'expo-router';
import { BadgeCheck, Bell, BellOff, CircleDollarSign, Flag, Megaphone, MessageSquareWarning, Newspaper, Settings2, ShieldAlert, ShieldCheck, Undo2, XCircle, type LucideIcon } from 'lucide-react-native';
import type { NotificationDTO, NotificationType } from '@amplify/domain';
import { api } from '@/lib/api';
import { dayBucket, relativeTime } from '@/lib/format';
import { keys, queryClient, useActivity } from '@/lib/queries';
import { colors, EmptyState, ErrorState, IconButton, radius, Segmented, Skeleton, space, TabTitle, Text } from '@/ui';

const ICONS: Partial<Record<NotificationType, { icon: LucideIcon; color: string; bg: string }>> = {
  submission_received: { icon: ShieldCheck, color: colors.info, bg: colors.infoSoft },
  approved: { icon: BadgeCheck, color: colors.success, bg: colors.successSoft },
  funding_open: { icon: Megaphone, color: colors.accent, bg: colors.accentSoft },
  changes_requested: { icon: MessageSquareWarning, color: colors.warning, bg: colors.warningSoft },
  rejected: { icon: XCircle, color: colors.danger, bg: colors.dangerSoft },
  milestone: { icon: Flag, color: colors.accent, bg: colors.accentSoft },
  goal_reached: { icon: BadgeCheck, color: colors.success, bg: colors.successSoft },
  contribution_succeeded: { icon: CircleDollarSign, color: colors.success, bg: colors.successSoft },
  contribution_failed: { icon: XCircle, color: colors.danger, bg: colors.dangerSoft },
  promotion_started: { icon: Megaphone, color: colors.success, bg: colors.successSoft },
  distribution_progress: { icon: Megaphone, color: colors.accent, bg: colors.accentSoft },
  report_ready: { icon: Newspaper, color: colors.accent, bg: colors.accentSoft },
  refund: { icon: Undo2, color: colors.warning, bg: colors.warningSoft },
  security: { icon: ShieldAlert, color: colors.textMuted, bg: colors.surfaceAlt },
};

type Item = NotificationDTO & { collapsed: NotificationDTO[] };

/** Collapse repeated milestone notifications for the same campaign on the same day. */
function collapse(list: NotificationDTO[]): Item[] {
  const out: Item[] = [];
  for (const n of list) {
    const prev = out[out.length - 1];
    if (prev && n.type === 'milestone' && prev.type === 'milestone' && prev.campaignId === n.campaignId && dayBucket(prev.at) === dayBucket(n.at)) {
      prev.collapsed.push(n);
      continue;
    }
    out.push({ ...n, collapsed: [] });
  }
  return out;
}

export default function ActivityScreen() {
  const router = useRouter();
  const q = useActivity();
  const [tab, setTab] = useState<'you' | 'campaigns'>('you');
  const all = q.data ?? [];
  const forYou = all.filter((n) => n.audience !== 'creator');
  const yours = all.filter((n) => n.audience === 'creator');
  const list = tab === 'you' ? forYou : yours;
  const unread = (l: NotificationDTO[]) => l.filter((n) => !n.read).length;

  const sections = useMemo(() => {
    const groups = new Map<string, Item[]>();
    for (const item of collapse(list)) {
      const b = dayBucket(item.at);
      groups.set(b, [...(groups.get(b) ?? []), item]);
    }
    return [...groups.entries()].map(([title, data]) => ({ title, data }));
  }, [list]);

  const markRead = async (ids?: string[]) => {
    queryClient.setQueryData<NotificationDTO[]>(keys.activity, (old) => old?.map((n) => (!ids || ids.includes(n.id) ? { ...n, read: true } : n)));
    await api('/activity/read', { method: 'POST', body: ids ? { ids } : {} }).catch(() => undefined);
  };

  const open = (n: Item) => {
    void markRead([n.id, ...n.collapsed.map((c) => c.id)]);
    if (!n.campaignId) return;
    if (n.type === 'report_ready') router.push({ pathname: '/campaign/[id]/report', params: { id: n.campaignId } });
    else if (n.audience === 'creator') router.push({ pathname: '/me/campaign/[id]', params: { id: n.campaignId } });
    else router.push({ pathname: '/campaign/[id]', params: { id: n.campaignId } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TabTitle
        title="Activity"
        subtitle="Funding, review and distribution updates"
        right={<IconButton icon={<Settings2 size={20} color={colors.ink} />} label="Notification settings" variant="filled" onPress={() => router.push('/me/notifications')} />}
      />
      <View style={{ paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.sm }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { key: 'you', label: 'For you', count: unread(forYou) },
            { key: 'campaigns', label: 'Your campaigns', count: unread(yours) },
          ]}
        />
        {unread(list) > 0 ? (
          <Pressable onPress={() => markRead(list.filter((n) => !n.read).map((n) => n.id))} style={{ alignSelf: 'flex-end' }} hitSlop={8} accessibilityRole="button">
            <Text variant="label" weight="semi" color={colors.accent}>Mark all as read</Text>
          </Pressable>
        ) : null}
      </View>
      {q.isPending ? (
        <View style={{ padding: space.lg, gap: space.md }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={72} radius={16} />
          ))}
        </View>
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(n) => n.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxxl }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.accent} colors={[colors.accent]} />}
          renderSectionHeader={({ section }) => <Text variant="overline" style={{ marginTop: space.lg, marginBottom: space.sm }}>{section.title}</Text>}
          ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
          renderItem={({ item: n }) => {
            const meta = ICONS[n.type] ?? { icon: Bell, color: colors.textMuted, bg: colors.surfaceAlt };
            return (
              <Pressable onPress={() => open(n)} style={({ pressed }) => [styles.item, !n.read && styles.unread, pressed && { opacity: 0.9 }]} accessibilityRole="button" accessibilityLabel={`${n.read ? '' : 'Unread. '}${n.title}. ${n.body}`}>
                <View style={[styles.icon, { backgroundColor: meta.bg }]}>
                  <meta.icon size={18} color={meta.color} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyStrong" numberOfLines={1}>{n.title}{n.collapsed.length ? ` · +${n.collapsed.length} more` : ''}</Text>
                  <Text variant="label" color={colors.text} numberOfLines={2}>{n.body}</Text>
                  <Text variant="caption">{relativeTime(n.at)}</Text>
                </View>
                {n.campaignCoverUrl ? <Image source={n.campaignCoverUrl} style={styles.thumb} contentFit="cover" /> : null}
                {!n.read ? <View style={styles.dot} /> : null}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            tab === 'you' ? (
              <EmptyState icon={BellOff} title="Nothing yet" body="Back or follow a campaign and you’ll see funding milestones, when ads go live, and final reports here." action="Explore campaigns" onAction={() => router.push('/explore')} />
            ) : (
              <EmptyState icon={BellOff} title="No campaign activity" body="Review decisions, funding milestones and distribution updates for campaigns you create appear here." action="Start a campaign" onAction={() => router.push('/create')} />
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', gap: space.md, alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  unread: { borderColor: colors.accentBorder, backgroundColor: '#FBFBFF' },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  thumb: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  dot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
});
