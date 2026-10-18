import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  BookOpen,
  Bookmark,
  CircleHelp,
  ClipboardCheck,
  FileText,
  Gauge,
  HandCoins,
  Handshake,
  Info,
  LayoutDashboard,
  LogOut,
  Compass,
  ListChecks,
  Megaphone,
  PenLine,
  TrendingUp,
  PlayCircle,
  Mail,
  Receipt,
  Repeat,
  Scale,
  Shield,
  SlidersHorizontal,
  Users,
} from 'lucide-react-native';
import type { CampaignStatus, UserDTO } from '@amplify/domain';
import { api, errorMessage } from '@/lib/api';
import { signOut, useMyCampaigns, useMyContributions, useSaved } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { useTour } from '@/lib/tour';
import { Button, Card, colors, Divider, ListRow, Pill, Row, space, TabTitle, Text, toast } from '@/ui';

const LIVE_STATUSES: Partial<Record<CampaignStatus, { label: string; icon: typeof Megaphone }>> = {
  promoting: { label: 'Ads live · see reach and spend', icon: Megaphone },
  available_for_funding: { label: 'Funding · see progress', icon: TrendingUp },
  changes_requested: { label: 'Changes requested · respond to review', icon: PenLine },
};

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="overline" style={{ paddingHorizontal: space.xs }}>{title}</Text>
      <Card padded={false} style={{ overflow: 'hidden' }}>{children}</Card>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, setUser } = useSession();
  const contributions = useMyContributions();
  const mine = useMyCampaigns();
  const saved = useSaved();
  const [savingPref, setSavingPref] = useState(false);
  const backed = new Set((contributions.data ?? []).filter((c) => ['succeeded', 'refund_pending', 'refunded'].includes(c.status)).map((c) => c.campaignId)).size;

  const toggleShowName = async (v: boolean) => {
    setSavingPref(true);
    try {
      setUser(await api<UserDTO>('/me', { method: 'PATCH', body: { showNameDefault: v } }));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSavingPref(false);
    }
  };

  const go = (path: string) => () => router.push(path as any);
  // Campaigns worth checking on right now, so creators don't have to dig for them.
  const live = (mine.data ?? []).filter((c) => LIVE_STATUSES[c.status]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: space.xxxl }}>
      <TabTitle title="Profile" />
      <View style={{ paddingHorizontal: space.lg, gap: space.xl }}>
        {user ? (
          <Card>
            <Row gap={space.md}>
              <View style={styles.avatar}>
                <Text variant="title" color={colors.white}>{user.name[0]}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Row gap={space.sm}>
                  <Text variant="heading" numberOfLines={1} style={{ flexShrink: 1 }}>{user.name}</Text>
                  {user.role === 'reviewer' ? <Pill label="Reviewer" tone="accent" /> : null}
                </Row>
                <Text variant="caption" numberOfLines={1}>{user.email}</Text>
              </View>
            </Row>
            <View style={styles.stats}>
              {[
                { n: backed, label: 'Backed', path: '/me/backed' },
                { n: mine.data?.length ?? 0, label: 'Created', path: '/me/campaigns' },
                { n: saved.data?.length ?? 0, label: 'Saved', path: '/me/saved' },
              ].map((s, i) => (
                <View key={s.label} style={[styles.stat, i > 0 && styles.statBorder]}>
                  <Text variant="number" onPress={go(s.path)}>{s.n}</Text>
                  <Text variant="caption" onPress={go(s.path)}>{s.label}</Text>
                </View>
              ))}
            </View>
          </Card>
        ) : (
          <Card>
            <Text variant="heading">You’re browsing as a guest</Text>
            <Text variant="label" style={{ marginTop: 4 }}>
              You can explore and back campaigns without an account — receipts stay on this device. Sign in to submit campaigns and keep your history everywhere.
            </Text>
            <Row gap={space.sm} style={{ marginTop: space.md }}>
              <Button label="Sign in" onPress={() => router.push('/sign-in')} style={{ flex: 1 }} />
              <Button label="Create account" variant="secondary" onPress={() => router.push({ pathname: '/sign-in', params: { mode: 'signup' } })} style={{ flex: 1 }} />
            </Row>
          </Card>
        )}

        {user && live.length ? (
          <Group title="Live now">
            {live.map((c, i) => {
              const meta = LIVE_STATUSES[c.status]!;
              const Icon = meta.icon;
              return (
                <View key={c.id}>
                  {i ? <Divider inset={56} /> : null}
                  <ListRow
                    icon={<Icon size={20} color={colors.accent} />}
                    title={c.title || 'Untitled campaign'}
                    subtitle={meta.label}
                    onPress={() => router.push({ pathname: '/me/campaign/[id]', params: { id: c.id } })}
                  />
                </View>
              );
            })}
          </Group>
        ) : null}

        <Group title="Your activity">
          <ListRow icon={<LayoutDashboard size={20} color={colors.ink} />} title="Your campaigns" subtitle="Drafts, review status, funding and reports" onPress={go('/me/campaigns')} />
          <Divider inset={56} />
          <ListRow icon={<HandCoins size={20} color={colors.ink} />} title="Backed campaigns" subtitle="Progress and people reached on your behalf" onPress={go('/me/backed')} />
          <Divider inset={56} />
          <ListRow icon={<Bookmark size={20} color={colors.ink} />} title="Saved campaigns" onPress={go('/me/saved')} />
          <Divider inset={56} />
          <ListRow icon={<Receipt size={20} color={colors.ink} />} title="Payment history" subtitle="Receipts and refunds" onPress={go('/me/payments')} />
        </Group>

        {user?.role === 'reviewer' ? (
          <Group title="Review team">
            <ListRow icon={<ClipboardCheck size={20} color={colors.accent} />} title="Review queue" subtitle="Approve, request changes, launch distribution" onPress={go('/review')} />
            <Divider inset={56} />
            <ListRow icon={<Gauge size={20} color={colors.accent} />} title="Demo controls" subtitle="Advance the clock, settle payments, reset data" onPress={go('/review/demo')} />
          </Group>
        ) : null}

        <Group title="Settings">
          <ListRow icon={<SlidersHorizontal size={20} color={colors.ink} />} title="Notification preferences" onPress={go('/me/notifications')} />
          {user ? (
            <>
              <Divider inset={56} />
              <ListRow
                icon={<Shield size={20} color={colors.ink} />}
                title="Show my name when I back"
                subtitle="Off by default. Payment details are never public."
                right={<Switch value={user.showNameDefault} disabled={savingPref} onValueChange={toggleShowName} trackColor={{ true: colors.accent, false: colors.borderStrong }} thumbColor={colors.white} accessibilityLabel="Show my name by default" />}
              />
            </>
          ) : null}
        </Group>

        <Group title="Learn">
          <ListRow icon={<BookOpen size={20} color={colors.ink} />} title="How it works" onPress={go('/info/how-it-works')} />
          <Divider inset={56} />
          <ListRow icon={<PlayCircle size={20} color={colors.ink} />} title="Replay the intro" subtitle="The three-step welcome tour" onPress={go('/onboarding')} />
          <Divider inset={56} />
          <ListRow icon={<Info size={20} color={colors.ink} />} title="About" onPress={go('/info/about')} />
          <Divider inset={56} />
          <ListRow icon={<CircleHelp size={20} color={colors.ink} />} title="FAQs" onPress={go('/info/faq')} />
          <Divider inset={56} />
          <ListRow icon={<Handshake size={20} color={colors.ink} />} title="Partners" onPress={go('/info/partners')} />
          <Divider inset={56} />
          <ListRow icon={<Users size={20} color={colors.ink} />} title="Community guidelines" onPress={go('/info/guidelines')} />
        </Group>

        <Group title="Help & legal">
          <ListRow icon={<Compass size={20} color={colors.ink} />} title="Take the app tour" subtitle="A one-minute walk through the five tabs" onPress={() => useTour.getState().startTour('manual')} />
          <Divider inset={56} />
          <ListRow
            icon={<ListChecks size={20} color={colors.ink} />}
            title="Get started checklist"
            subtitle="Show the learn-by-doing steps on Home"
            onPress={() => {
              useTour.getState().showChecklist();
              router.navigate('/');
            }}
          />
          <Divider inset={56} />
          <ListRow icon={<CircleHelp size={20} color={colors.ink} />} title="Help center" onPress={go('/info/help')} />
          <Divider inset={56} />
          <ListRow icon={<Mail size={20} color={colors.ink} />} title="Contact us" onPress={go('/info/contact')} />
          <Divider inset={56} />
          <ListRow icon={<FileText size={20} color={colors.ink} />} title="Terms of service" onPress={go('/info/terms')} />
          <Divider inset={56} />
          <ListRow icon={<Scale size={20} color={colors.ink} />} title="Privacy policy" onPress={go('/info/privacy')} />
        </Group>

        <Group title="Account">
          <ListRow icon={<Repeat size={20} color={colors.ink} />} title={user ? 'Switch account' : 'Try a demo account'} subtitle="Creator, backer or reviewer" onPress={() => router.push('/sign-in')} />
          {user ? (
            <>
              <Divider inset={56} />
              <ListRow
                icon={<LogOut size={20} color={colors.danger} />}
                title="Sign out"
                danger
                onPress={() => {
                  signOut();
                  toast.info('Signed out');
                }}
              />
            </>
          ) : null}
        </Group>
        <Text variant="caption" align="center">Amplify prototype · demo data · no real payments</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', marginTop: space.lg, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statBorder: { borderLeftWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
});

