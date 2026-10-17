import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { Img as Image } from '@/ui/Img';
import * as Crypto from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BadgeCheck, CircleAlert, CircleX, Clock, CreditCard, Lock, Share2 } from 'lucide-react-native';
import {
  AMPLIFICATION_LINE,
  CONTRIBUTION_LIMITS,
  formatMoney,
  percentFunded,
  quote,
  reachModel,
  type CampaignDetailDTO,
  type ContributionDTO,
  type PaymentOutcome,
} from '@amplify/domain';
import { ApiError, errorMessage } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { invalidateAfterContribution, useCampaign, useContribute, useContribution } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { shareCampaign } from '@/lib/share';
import { markTask } from '@/lib/tour';
import {
  Button,
  Chip,
  colors,
  ErrorState,
  Estimate,
  fonts,
  JourneyRail,
  MoneyFlow,
  Notice,
  openGlossary,
  ProgressBar,
  radius,
  Row,
  ScreenHeader,
  shadow,
  space,
  Text,
  TextField,
} from '@/ui';

type Step = 'amount' | 'review' | 'pay' | 'result';
const OUTCOMES: { key: PaymentOutcome; label: string; hint: string }[] = [
  { key: 'succeed', label: 'Payment succeeds', hint: 'Card is approved' },
  { key: 'verify', label: 'Needs verification', hint: 'Bank checks it, then approves' },
  { key: 'decline', label: 'Card declined', hint: 'Issuer refuses the charge' },
];

function CampaignStrip({ c, addCents = 0 }: { c: CampaignDetailDTO; addCents?: number }) {
  const before = percentFunded(c.raisedCents, c.goalCents);
  const after = percentFunded(c.raisedCents + addCents, c.goalCents);
  return (
    <View style={styles.strip}>
      <Image source={c.coverUrl} style={styles.thumb} contentFit="cover" />
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="label" weight="semi" color={colors.ink} numberOfLines={1}>{c.title}</Text>
        <ProgressBar value={after} height={5} />
        <Text variant="caption">
          {addCents && after > before
            ? `${before}% → ${after}% funded with you`
            : addCents
              ? `+${formatMoney(addCents)} toward ${formatMoney(c.goalCents)} · ${before}% funded`
              : `${before}% of ${formatMoney(c.goalCents)} funded`}
        </Text>
      </View>
    </View>
  );
}

export default function BackFlow() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useSession((s) => s.user);
  const campaign = useCampaign(id);
  const c = campaign.data;

  const [step, setStep] = useState<Step>('amount');
  const [preset, setPreset] = useState<number | null>(1000);
  const [custom, setCustom] = useState('');
  const [showName, setShowName] = useState(user?.showNameDefault ?? false);
  const [publicName, setPublicName] = useState(user?.name ?? '');
  const [email, setEmail] = useState('');
  const [outcome, setOutcome] = useState<PaymentOutcome>('succeed');
  const [contributionId, setContributionId] = useState<string | null>(null);
  const [closedError, setClosedError] = useState<ApiError | null>(null);
  const idem = useRef<string>(Crypto.randomUUID());
  const contribute = useContribute();
  useEffect(() => {
    if (step === 'review') markTask('learn'); // the itemised money breakdown
  }, [step]);

  const amountCents = preset ?? Math.round((parseFloat(custom.replace(/[^0-9.]/g, '')) || 0) * 100);
  const amountError =
    amountCents && amountCents < CONTRIBUTION_LIMITS.minCents
      ? 'The minimum is $1'
      : amountCents > CONTRIBUTION_LIMITS.maxCents
        ? 'The maximum is $10,000'
        : null;
  const model = reachModel(c?.reachModelVersion);
  const q = useMemo(() => quote(amountCents, model.peoplePerAdDollar), [amountCents, model.peoplePerAdDollar]);

  const result = useContribution(contributionId, true);
  const contribution: ContributionDTO | undefined = result.data ?? contribute.data;
  const status = contribution?.status;
  useEffect(() => {
    if (status === 'succeeded') {
      haptic('success');
      markTask('back');
      if (id) invalidateAfterContribution(id);
    }
    if (status === 'failed') haptic('error');
  }, [status, id]);

  if (!c) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenHeader close title="Back this campaign" />
        {campaign.isError ? <ErrorState error={campaign.error} onRetry={campaign.refetch} /> : <ActivityIndicator color={colors.accent} style={{ marginTop: space.xxl }} />}
      </View>
    );
  }

  const pay = async (chosen: PaymentOutcome) => {
    setClosedError(null);
    try {
      const res = await contribute.mutateAsync({
        req: { campaignId: c.id, amountCents, showName, publicName: showName ? publicName : undefined, email: email || undefined, outcome: chosen },
        idempotencyKey: idem.current,
      });
      setContributionId(res.id);
      setStep('result');
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setClosedError(e);
        setStep('result');
      }
    }
  };
  const retry = () => {
    idem.current = Crypto.randomUUID(); // a new attempt is a new payment
    setContributionId(null);
    contribute.reset();
    setStep('pay');
  };
  const done = () => router.back();

  const stepIndex = { amount: 1, review: 2, pay: 3, result: 3 }[step];
  const headerBack = step === 'review' ? () => setStep('amount') : step === 'pay' ? () => setStep('review') : undefined;

  /* ---------- Result ---------- */
  if (step === 'result') {
    const pending = !closedError && (!status || status === 'pending');
    const success = status === 'succeeded';
    const voided = !!closedError || status === 'voided';
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <ScrollView contentContainerStyle={[styles.result, { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xl }]}>
          {pending ? (
            <Animated.View entering={FadeIn} style={styles.resultHead}>
              <View style={[styles.resultIcon, { backgroundColor: colors.infoSoft }]}>
                <Clock size={34} color={colors.info} />
              </View>
              <Text variant="title" align="center">Verifying your payment</Text>
              <Text variant="body" color={colors.textMuted} align="center">Your bank is confirming the charge. This usually takes a few seconds — you can stay here.</Text>
              <ActivityIndicator color={colors.accent} style={{ marginTop: space.md }} />
            </Animated.View>
          ) : success && contribution ? (
            <>
              <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.resultHead}>
                <View style={[styles.resultIcon, { backgroundColor: colors.successSoft }]}>
                  <BadgeCheck size={38} color={colors.success} />
                </View>
                <Text variant="title" align="center">Thank you — you’re backing this</Text>
                <Text variant="body" color={colors.textMuted} align="center">
                  {formatMoney(contribution.amountCents)} toward distributing “{c.title}”.
                </Text>
              </Animated.View>
              <View style={styles.receiptCard}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text variant="label">Your contribution could reach</Text>
                  <Estimate value={contribution.estReach} variant="bodyStrong" compact={false} />
                </Row>
                <MoneyFlow quote={{ ...q, amountCents: contribution.amountCents, platformFeeCents: contribution.platformFeeCents, adBudgetCents: contribution.adBudgetCents, processingCents: contribution.processingCents, totalCents: contribution.totalCents, estReach: contribution.estReach }} compact />
                <Text variant="caption">
                  Paid {formatMoney(contribution.totalCents, { cents: true })} · Receipt {contribution.receiptNo}. Funds are held for distribution — they’re not paid to the creator.
                </Text>
              </View>
              {contribution.campaign ? (
                <View style={styles.receiptCard}>
                  <Text variant="label" weight="semi" color={colors.ink}>Campaign progress</Text>
                  <ProgressBar value={percentFunded(contribution.campaign.raisedCents, contribution.campaign.goalCents)} height={10} />
                  <Text variant="label">
                    {formatMoney(contribution.campaign.raisedCents)} of {formatMoney(contribution.campaign.goalCents)} · {contribution.campaign.backerCount.toLocaleString()} backers
                  </Text>
                  <JourneyRail status={contribution.campaignStatus} />
                </View>
              ) : null}
              <Notice tone="accent" title="What happens next">
                When funding closes, our team prepares targeting and launches the ads. You’re following this campaign, so we’ll tell you when ads go live and when the final report is ready.
              </Notice>
              <View style={{ gap: space.sm, alignSelf: 'stretch' }}>
                <Button label="Share this campaign" icon={<Share2 size={18} color={colors.white} />} onPress={() => shareCampaign(c)} full />
                <Button label="View receipt" variant="secondary" onPress={() => router.replace({ pathname: '/me/receipt/[id]', params: { id: contribution.id } })} full />
                <Button label="Done" variant="ghost" onPress={done} full />
              </View>
            </>
          ) : voided ? (
            <View style={styles.resultHead}>
              <View style={[styles.resultIcon, { backgroundColor: colors.successSoft }]}>
                <BadgeCheck size={34} color={colors.success} />
              </View>
              <Text variant="title" align="center">{closedError?.code === 'GOAL_REACHED' || status === 'voided' ? 'This campaign just reached its goal' : 'Funding has closed'}</Text>
              <Text variant="body" color={colors.textMuted} align="center">
                {contribution?.failureReason ?? 'It filled up moments before your payment went through. You have not been charged.'}
              </Text>
              <Button label="Explore other campaigns" onPress={() => router.replace('/explore')} full style={{ marginTop: space.lg }} />
              <Button label="Back to campaign" variant="ghost" onPress={done} full />
            </View>
          ) : status === 'cancelled' ? (
            <View style={styles.resultHead}>
              <View style={[styles.resultIcon, { backgroundColor: colors.surfaceAlt }]}>
                <CircleX size={34} color={colors.textMuted} />
              </View>
              <Text variant="title" align="center">Checkout cancelled</Text>
              <Text variant="body" color={colors.textMuted} align="center">You weren’t charged. You can try again whenever you’re ready.</Text>
              <Button label="Return to checkout" onPress={retry} full style={{ marginTop: space.lg }} />
              <Button label="Back to campaign" variant="ghost" onPress={done} full />
            </View>
          ) : (
            <View style={styles.resultHead}>
              <View style={[styles.resultIcon, { backgroundColor: colors.dangerSoft }]}>
                <CircleAlert size={34} color={colors.danger} />
              </View>
              <Text variant="title" align="center">Payment didn’t go through</Text>
              <Text variant="body" color={colors.textMuted} align="center">{contribution?.failureReason ?? 'The payment could not be completed.'} You weren’t charged.</Text>
              <Button label="Try again" onPress={retry} full style={{ marginTop: space.lg }} />
              <Button label="Change amount" variant="secondary" onPress={() => { retry(); setStep('amount'); }} full />
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader close={step === 'amount'} onBack={headerBack} title="Back this campaign" subtitle={`Step ${stepIndex} of 3`} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
        <CampaignStrip c={c} addCents={step === 'amount' ? 0 : amountCents} />

        {step === 'amount' ? (
          <>
            <View style={{ gap: space.xs }}>
              <Text variant="title">How much would you like to contribute?</Text>
              <Text variant="label">Your contribution pays for ads that carry this message to new audiences.</Text>
            </View>
            <View style={styles.presets}>
              {CONTRIBUTION_LIMITS.presetsCents.map((p) => {
                const on = preset === p;
                return (
                  <Pressable
                    key={p}
                    onPress={() => {
                      haptic('select');
                      setPreset(p);
                      setCustom('');
                    }}
                    style={[styles.preset, on && styles.presetOn]}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                  >
                    <Text style={[styles.presetAmount, on && { color: colors.accentText }]}>{formatMoney(p)}</Text>
                    <Text variant="caption" color={on ? colors.accentText : colors.textSubtle}>≈ {quote(p, model.peoplePerAdDollar).estReach} people</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={[styles.custom, preset === null && custom ? styles.presetOn : null, amountError ? { borderColor: colors.danger } : null]}>
              <Text style={styles.dollar}>$</Text>
              <TextInput
                value={custom}
                onChangeText={(t) => {
                  setCustom(t.replace(/[^0-9.]/g, '').slice(0, 7));
                  setPreset(null);
                }}
                onFocus={() => setPreset(null)}
                placeholder="Other amount"
                placeholderTextColor={colors.placeholder}
                keyboardType="decimal-pad"
                style={styles.customInput}
                accessibilityLabel="Custom amount in dollars"
              />
            </View>
            {amountError ? <Text variant="caption" color={colors.danger}>{amountError}</Text> : null}

            {amountCents >= CONTRIBUTION_LIMITS.minCents && !amountError ? (
              <View style={styles.card}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text variant="bodyStrong">Where your {formatMoney(amountCents)} goes</Text>
                </Row>
                <MoneyFlow quote={q} />
                <Row style={{ justifyContent: 'space-between', marginTop: space.xs }}>
                  <Text variant="label">Adds to this campaign’s reach</Text>
                  <Estimate value={q.estReach} variant="bodyStrong" compact={false} suffix="people" />
                </Row>
              </View>
            ) : null}
          </>
        ) : null}

        {step === 'review' ? (
          <>
            <Text variant="title">Review your contribution</Text>
            <View style={styles.card}>
              <MoneyFlow quote={q} />
              <Row style={{ justifyContent: 'space-between' }}>
                <Text variant="label">Estimated reach of your contribution</Text>
                <Estimate value={q.estReach} variant="label" compact={false} />
              </Row>
            </View>
            <Notice tone="accent" title="Amplification, not a donation">{AMPLIFICATION_LINE}</Notice>
            <View style={styles.card}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">Show my name as a backer</Text>
                  <Text variant="caption">Off by default. Your payment details are never shown.</Text>
                </View>
                <Switch value={showName} onValueChange={setShowName} trackColor={{ true: colors.accent, false: colors.borderStrong }} thumbColor={colors.white} accessibilityLabel="Show my name publicly" />
              </Row>
              {showName ? <TextField label="Name to show" value={publicName} onChangeText={setPublicName} maxChars={40} placeholder="e.g. Sam R." /> : null}
              {!user ? (
                <TextField
                  label="Email for your receipt"
                  optional
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="you@example.com"
                  hint="No account needed. Receipts also stay on this device."
                />
              ) : null}
            </View>
            <Pressable onPress={() => openGlossary('unspentFunds')} accessibilityRole="button">
              <Text variant="caption">
                If this campaign isn’t approved for distribution or doesn’t reach its minimum ad budget, you’ll be refunded (processing fees excluded). Amounts already spent on delivered ads aren’t refundable.{' '}
                <Text variant="caption" color={colors.accent} weight="semi">Refund policy</Text>
              </Text>
            </Pressable>
          </>
        ) : null}

        {step === 'pay' ? (
          <>
            <Notice tone="warning" title="Simulated checkout" icon={<CreditCard size={18} color={colors.warning} />}>
              This is a prototype. No real money moves and no card details are stored. Choose how the payment should behave.
            </Notice>
            <View style={styles.cardMock}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text variant="label" color="#C7D2FE">Test card</Text>
                <Lock size={14} color="#C7D2FE" />
              </Row>
              <Text style={styles.cardNumber}>4242 4242 4242 4242</Text>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text variant="caption" color="#C7D2FE">{user?.name?.toUpperCase() ?? 'GUEST BACKER'}</Text>
                <Text variant="caption" color="#C7D2FE">12/30 · CVC •••</Text>
              </Row>
            </View>
            <Text variant="label" weight="semi" color={colors.ink}>Demo outcome</Text>
            <View style={{ gap: space.sm }}>
              {OUTCOMES.map((o) => (
                <Pressable key={o.key} onPress={() => setOutcome(o.key)} style={[styles.outcome, outcome === o.key && styles.presetOn]} accessibilityRole="radio" accessibilityState={{ checked: outcome === o.key }}>
                  <View style={[styles.radio, outcome === o.key && styles.radioOn]} />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong">{o.label}</Text>
                    <Text variant="caption">{o.hint}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
            {contribute.isError && !(contribute.error instanceof ApiError && contribute.error.status === 409) ? (
              <Notice tone="danger" title="Couldn’t start the payment">{errorMessage(contribute.error)}</Notice>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
        {step === 'amount' ? (
          <Button label={amountCents >= 100 && !amountError ? `Continue with ${formatMoney(amountCents)}` : 'Choose an amount'} disabled={amountCents < 100 || !!amountError} onPress={() => setStep('review')} full size="lg" />
        ) : step === 'review' ? (
          <Button label="Continue to payment" onPress={() => setStep('pay')} full size="lg" />
        ) : (
          <View style={{ gap: space.sm }}>
            <Button label={`Pay ${formatMoney(q.totalCents, { cents: true })}`} icon={<Lock size={16} color={colors.white} />} onPress={() => pay(outcome)} loading={contribute.isPending} full size="lg" />
            <Button label="Cancel checkout" variant="ghost" onPress={() => pay('cancel')} disabled={contribute.isPending} full size="sm" />
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', gap: space.md, alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  preset: { width: '48%', flexGrow: 1, height: 76, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 2 },
  presetOn: { borderColor: colors.accent, borderWidth: 2, backgroundColor: colors.accentSoft },
  presetAmount: { fontFamily: fonts.sansBold, fontSize: 22, color: colors.ink },
  custom: { flexDirection: 'row', alignItems: 'center', height: 56, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: space.lg },
  dollar: { fontFamily: fonts.sansBold, fontSize: 20, color: colors.textSubtle, marginRight: 4 },
  customInput: { flex: 1, fontFamily: fonts.sansSemi, fontSize: 18, color: colors.ink },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: space.lg, gap: space.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...shadow.card },
  cardMock: { backgroundColor: colors.ink, borderRadius: radius.xl, padding: space.xl, gap: space.lg },
  cardNumber: { fontFamily: fonts.sansSemi, fontSize: 20, letterSpacing: 2, color: colors.white },
  outcome: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.borderStrong },
  radioOn: { borderColor: colors.accent, borderWidth: 6 },
  footer: { paddingHorizontal: space.lg, paddingTop: space.md, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  result: { paddingHorizontal: space.lg, gap: space.lg, alignItems: 'center' },
  resultHead: { alignItems: 'center', gap: space.sm, alignSelf: 'stretch' },
  resultIcon: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  receiptCard: { alignSelf: 'stretch', backgroundColor: colors.bg, borderRadius: radius.lg, padding: space.lg, gap: space.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
});
