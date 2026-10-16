import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ChevronRight, FileEdit, LayoutDashboard, MessageSquareWarning, Mic, PenLine, Trash2 } from 'lucide-react-native';
import { completedSteps, STEPS } from '@amplify/domain';
import { useDrafts, type Draft } from '@/features/create/draftStore';
import { api } from '@/lib/api';
import { relativeTime } from '@/lib/format';
import { keys, queryClient, useMyCampaigns, type MyCampaign } from '@/lib/queries';
import { colors, IconButton, Notice, radius, Row, SectionHeader, shadow, space, TabTitle, Text, toast } from '@/ui';

function DraftRow({ title, cover, subtitle, done, warn, onPress, onDelete }: { title: string; cover?: string | null; subtitle: string; done: number; warn?: boolean; onPress: () => void; onDelete?: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.draft, pressed && { opacity: 0.9 }]} accessibilityRole="button" accessibilityLabel={`Continue ${title}`}>
      {cover ? <Image source={cover} style={styles.draftImg} contentFit="cover" /> : <View style={[styles.draftImg, styles.draftImgEmpty]}><FileEdit size={20} color={colors.textSubtle} /></View>}
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="bodyStrong" numberOfLines={1}>{title || 'Untitled campaign'}</Text>
        <Row gap={6}>
          {warn ? <MessageSquareWarning size={13} color={colors.warning} /> : null}
          <Text variant="caption" color={warn ? colors.warning : colors.textSubtle} numberOfLines={1} style={{ flex: 1 }}>{subtitle}</Text>
        </Row>
        <View style={styles.dots}>
          {STEPS.map((s, i) => (
            <View key={s.key} style={[styles.dot, i < done && { backgroundColor: colors.accent }]} />
          ))}
        </View>
      </View>
      {onDelete ? <IconButton icon={<Trash2 size={16} color={colors.textSubtle} />} label="Delete draft" size={34} onPress={onDelete} /> : <ChevronRight size={18} color={colors.placeholder} />}
    </Pressable>
  );
}

export default function CreateScreen() {
  const router = useRouter();
  const drafts = useDrafts((s) => s.drafts);
  const createDraft = useDrafts((s) => s.create);
  const removeDraft = useDrafts((s) => s.remove);
  const mine = useMyCampaigns();

  const server = mine.data ?? [];
  const changes = server.filter((c) => c.status === 'changes_requested');
  const localKeys = new Set(Object.values(drafts).map((d) => d.serverId).filter(Boolean));
  const editable = new Set(['draft', 'changes_requested']);
  const serverStatus = new Map(server.map((c) => [c.id, c.status]));
  const local = Object.values(drafts)
    .filter((d) => !d.serverId || editable.has(serverStatus.get(d.serverId) ?? 'draft'))
    .filter((d) => !changes.some((c) => c.id === d.serverId))
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const serverOnly = server.filter((c) => c.status === 'draft' && !localKeys.has(c.id));

  const start = () => router.push({ pathname: '/create/[id]', params: { id: createDraft() } });
  const del = (d: Draft) => {
    removeDraft(d.key);
    if (d.serverId) void api(`/campaigns/${d.serverId}`, { method: 'DELETE' }).catch(() => undefined).then(() => queryClient.invalidateQueries({ queryKey: keys.myCampaigns }));
    toast.info('Draft deleted');
  };
  const draftSubtitle = (d: Draft) => {
    const n = completedSteps(d.content).length;
    return `${n} of 5 steps complete · edited ${relativeTime(new Date(d.updatedAt).toISOString())}`;
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: space.xxxl }}>
      <TabTitle title="Create" subtitle="Turn a message that matters into a reviewed campaign" />
      <View style={{ paddingHorizontal: space.lg, gap: space.xl }}>
        {changes.length ? (
          <View style={{ gap: space.sm }}>
            <Notice tone="warning" title="Reviewers asked for changes" icon={<MessageSquareWarning size={18} color={colors.warning} />}>
              Update the flagged items and resubmit to keep your campaign moving.
            </Notice>
            {changes.map((c: MyCampaign) => (
              <DraftRow key={c.id} title={c.title} cover={c.coverUrl} subtitle="Changes requested · tap to respond" done={4} warn onPress={() => router.push({ pathname: '/create/[id]', params: { id: c.id } })} />
            ))}
          </View>
        ) : null}

        {local.length || serverOnly.length ? (
          <View style={{ gap: space.sm }}>
            <SectionHeader title="Continue a draft" />
            {local.map((d) => (
              <DraftRow key={d.key} title={d.content.basics.title} cover={d.content.basics.cover?.url} subtitle={draftSubtitle(d)} done={completedSteps(d.content).length} onPress={() => router.push({ pathname: '/create/[id]', params: { id: d.key } })} onDelete={() => del(d)} />
            ))}
            {serverOnly.map((c) => (
              <DraftRow key={c.id} title={c.title} cover={c.coverUrl} subtitle={`Saved to your account · ${relativeTime(c.updatedAt)}`} done={1} onPress={() => router.push({ pathname: '/create/[id]', params: { id: c.id } })} />
            ))}
          </View>
        ) : null}

        <View style={{ gap: space.md }}>
          <SectionHeader title="Start a new campaign" subtitle="Five steps: Basics → Story → Visuals → Reach → Submit" />
          <Pressable onPress={start} style={({ pressed }) => [styles.option, pressed && styles.pressed]} accessibilityRole="button">
            <View style={[styles.optionIcon, { backgroundColor: colors.accentSoft }]}>
              <PenLine size={24} color={colors.accent} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="heading">Write it myself</Text>
              <Text variant="label">A guided form with tips at each step and a full preview before you submit.</Text>
            </View>
            <ChevronRight size={20} color={colors.placeholder} />
          </Pressable>
          <Pressable onPress={() => router.push('/create/voice')} style={({ pressed }) => [styles.option, pressed && styles.pressed]} accessibilityRole="button">
            <View style={[styles.optionIcon, { backgroundColor: colors.ink }]}>
              <Mic size={24} color={colors.white} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="heading">Talk it through</Text>
              <Text variant="label">Answer five short questions out loud. We’ll draft the campaign for you to edit.</Text>
            </View>
            <ChevronRight size={20} color={colors.placeholder} />
          </Pressable>
        </View>

        <Pressable onPress={() => router.push('/me/campaigns')} style={styles.dashboardLink} accessibilityRole="button">
          <LayoutDashboard size={20} color={colors.ink} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">Your campaigns</Text>
            <Text variant="caption">Track review, funding, distribution and reports</Text>
          </View>
          <ChevronRight size={18} color={colors.placeholder} />
        </Pressable>

        <View style={styles.tips}>
          <Text variant="overline" color={colors.accentText}>What reviewers look for</Text>
          {['Every claim traceable to a cited source', 'Calm, fair framing — no sensational wording', 'A clear, practical action people can take', 'Images you have the rights to use'].map((t) => (
            <Text key={t} variant="label" color={colors.text}>• {t}</Text>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  draft: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...shadow.card },
  draftImg: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  draftImgEmpty: { alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 18, height: 4, borderRadius: 2, backgroundColor: colors.border },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.lg, backgroundColor: colors.surface, borderRadius: radius.xl, padding: space.lg, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  optionIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dashboardLink: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  tips: { gap: space.sm, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.accentSoft },
});
