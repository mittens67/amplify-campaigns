import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { markTask } from '@/lib/tour';
import { FileQuestion, Mail } from 'lucide-react-native';
import { AMPLIFICATION_LINE, CURRENT_REACH_MODEL, GLOSSARY, JOURNEY_STAGES, quote, REFUND_MATRIX } from '@amplify/domain';
import { Accordion, Button, colors, EmptyState, JourneyRail, MoneyFlow, Notice, radius, ScreenHeader, space, Text } from '@/ui';

type Section = { h?: string; p: string };
const PAGES: Record<string, { title: string; intro: string; sections?: Section[]; faq?: { q: string; a: string }[] }> = {
  'how-it-works': {
    title: 'How it works',
    intro: 'Amplify helps important messages reach people outside their creators’ existing networks. Three steps: create, review, amplify.',
  },
  about: {
    title: 'About Amplify',
    intro: 'Most messages only travel as far as the people who already agree with them. Amplify is a community-funded ad network for reviewed, sourced campaigns — so a clear message can reach the people who haven’t heard it yet.',
    sections: [
      { h: 'Why community-funded?', p: 'Advertising is how messages reach new audiences, but it’s usually only available to organisations with budgets. Pooling small contributions lets anyone’s well-made message compete for attention.' },
      { h: 'Why review?', p: 'Backers need to trust that they aren’t paying to spread misinformation. Every campaign is reviewed for factual grounding, fair framing and its potential to invite people across divides.' },
      { h: 'This prototype', p: 'This app is a hackathon prototype. Figures are demonstration data, payments are simulated, and ad delivery is simulated from a configurable reach model.' },
    ],
  },
  faq: {
    title: 'Frequently asked questions',
    intro: 'Short answers to what people ask most.',
    faq: [
      { q: 'Is my contribution a donation?', a: AMPLIFICATION_LINE + ' It isn’t tax-deductible and isn’t paid to the creator.' },
      { q: 'Where does my money go?', a: '80% becomes the campaign’s advertising budget and 20% is the platform fee covering review, ad operations and reporting. Card processing (2.9% + 30¢) is added on top.' },
      { q: 'How many people will my contribution reach?', a: GLOSSARY.estimatedReach.body },
      { q: 'When do the ads start?', a: GLOSSARY.distribution.body },
      { q: 'What if a campaign doesn’t reach its goal?', a: 'If the ad budget raised is at least $100 when funding closes, ads still run with the budget raised. Otherwise backers are refunded (processing fees excluded).' },
      { q: 'Can I stay anonymous?', a: 'Yes. Your name is hidden by default. You can choose to show it on a campaign when you back it.' },
      { q: 'Do I need an account?', a: 'Not to browse or back campaigns — receipts are kept on your device. You need a free account to submit a campaign.' },
      { q: 'What does “reviewed” mean?', a: GLOSSARY.review.body },
    ],
  },
  partners: {
    title: 'Distribution partners',
    intro: 'Campaign ads are placed through established ad platforms. Final placements are chosen by our team during distribution preparation.',
    sections: [
      { h: 'Facebook & Instagram', p: 'Feed and Stories placements. Broad location, age and interest targeting only.' },
      { h: 'YouTube', p: 'In-stream and Shorts for campaigns with video creatives.' },
      { h: 'Search ads', p: 'Text ads shown when people search related topics.' },
      { h: 'News sites', p: 'Display placements on local and national news publishers.' },
      { h: 'In this prototype', p: 'Partner delivery is simulated. A production version would report spend, impressions, reach and clicks from each partner’s reporting API.' },
    ],
  },
  guidelines: {
    title: 'Community guidelines',
    intro: 'Campaigns should help people understand something important — not inflame, mislead or target individuals.',
    sections: [
      { h: 'Source your claims', p: 'Every factual claim should be traceable to a cited, credible source. Sources stay visible on the campaign.' },
      { h: 'Frame fairly', p: 'No sensational wording, manipulated images, or selective statistics that mislead.' },
      { h: 'Invite people in', p: 'Write for people who don’t already agree with you. Campaigns that deepen division are not approved.' },
      { h: 'Respect people', p: 'No harassment, hate, or targeting of private individuals. Only use images you have the rights to.' },
      { h: 'Not allowed', p: 'Candidate electioneering, fundraising for the cause itself, scams, and adult content.' },
    ],
  },
  help: {
    title: 'Help center',
    intro: 'Need a hand? Start here.',
    faq: [
      { q: 'My payment failed', a: 'You weren’t charged. Try again from the campaign page, or use a different card. In this prototype, choose the “Payment succeeds” outcome at checkout.' },
      { q: 'Where is my receipt?', a: 'Profile → Payment history. Guests can see receipts made on this device.' },
      { q: 'How do I edit a submitted campaign?', a: 'Content is locked while under review. If reviewers request changes, you can edit and resubmit. After approval, post updates instead; material changes go back through review.' },
      { q: 'How do refunds work?', a: REFUND_MATRIX.map((r) => `${r.when}: ${r.treatment}`).join(' ') },
    ],
  },
  contact: {
    title: 'Contact us',
    intro: 'We usually reply within one business day.',
    sections: [
      { h: 'Support', p: 'help@amplify.example — questions about backing, receipts or your account.' },
      { h: 'Creators', p: 'creators@amplify.example — help preparing a campaign for review.' },
      { h: 'Report a concern', p: 'Use “Report a concern” on any campaign page. Reports go privately to the review team.' },
    ],
  },
  terms: {
    title: 'Terms of service',
    intro: 'Plain-language summary for this prototype. Not a legal agreement.',
    sections: [
      { h: 'What you’re paying for', p: 'Contributions fund the distribution (advertising) of a reviewed campaign message. They are not donations to the cause, person or organisation described.' },
      { h: 'Fees', p: 'A 20% platform fee is deducted from each contribution; card processing is added at checkout.' },
      { h: 'Refunds', p: REFUND_MATRIX.map((r) => `${r.when} — ${r.treatment}`).join(' ') },
      { h: 'Creators', p: 'Creators keep ownership of their content and grant Amplify a licence to display and advertise it. Creators must have rights to all images and must not misrepresent facts.' },
    ],
  },
  privacy: {
    title: 'Privacy policy',
    intro: 'We collect as little as we can.',
    sections: [
      { h: 'Backers', p: 'Your name is private by default. We never show payment details or email addresses publicly. Guests can back without an account.' },
      { h: 'Ad audiences', p: 'Ads use broad location, age and interest categories. Creators never see who saw an ad, and we don’t share backer data with advertisers.' },
      { h: 'Feedback & reports', p: 'Poll answers are anonymous and only shown in aggregate. Reports are visible only to the review team.' },
      { h: 'This prototype', p: 'Payments are simulated and no card data is collected.' },
    ],
  },
};

export default function InfoPage() {
  const { page } = useLocalSearchParams<{ page: string }>();
  const router = useRouter();
  const p = PAGES[page];
  useEffect(() => {
    if (page === 'how-it-works') markTask('learn');
  }, [page]);
  if (!p) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenHeader title="Not found" />
        <EmptyState icon={FileQuestion} title="Page not found" action="Go home" onAction={() => router.replace('/')} />
      </View>
    );
  }
  const q = quote(2500, CURRENT_REACH_MODEL.peoplePerAdDollar);
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScreenHeader title={p.title} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxxl }}>
        <Text variant="display">{p.title}</Text>
        <Text variant="story">{p.intro}</Text>
        {page === 'how-it-works' ? (
          <>
            {[
              ['1. Create', 'A creator writes the campaign in five steps — basics, story, visuals, reach and submit — with sources for every claim. They set the funding goal; AI can help draft, but never sets the goal.'],
              ['2. Review', GLOSSARY.review.body],
              ['3. Amplify', 'Approved campaigns open for backing for 21 days. Backers contribute toward the ad budget. When funding closes, our team prepares targeting and launches ads with distribution partners.'],
              ['4. Report', 'Everyone can see the results: ad spend, impressions and measured reach — always kept separate from estimates.'],
            ].map(([h, b]) => (
              <View key={h} style={styles.step}>
                <Text variant="heading">{h}</Text>
                <Text variant="body" color={colors.textMuted}>{b}</Text>
              </View>
            ))}
            <View style={styles.box}>
              <Text variant="heading">The campaign journey</Text>
              <JourneyRail status="promoting" dense />
              {JOURNEY_STAGES.map((s) => (
                <Text key={s.key} variant="label" color={colors.text}>
                  <Text variant="label" weight="semi" color={colors.ink}>{s.label}: </Text>
                  {s.blurb}
                </Text>
              ))}
            </View>
            <View style={styles.box}>
              <Text variant="heading">Where a $25 contribution goes</Text>
              <MoneyFlow quote={q} />
            </View>
            <Notice tone="accent" title="Amplification, not a donation">{AMPLIFICATION_LINE}</Notice>
            <Button label="Explore campaigns" onPress={() => router.push('/explore')} full />
          </>
        ) : null}
        {p.sections?.map((s) => (
          <View key={s.h} style={{ gap: space.xs }}>
            {s.h ? <Text variant="heading">{s.h}</Text> : null}
            <Text variant="body" color={colors.textMuted}>{s.p}</Text>
          </View>
        ))}
        {p.faq ? (
          <View>
            {p.faq.map((f) => (
              <Accordion key={f.q} title={f.q}>
                <Text variant="body" color={colors.textMuted}>{f.a}</Text>
              </Accordion>
            ))}
          </View>
        ) : null}
        {page === 'contact' ? <Button label="Email support" variant="secondary" icon={<Mail size={18} color={colors.ink} />} onPress={() => void Linking.openURL('mailto:help@amplify.example')} full /> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  step: { gap: space.xs, paddingLeft: space.lg, borderLeftWidth: 3, borderColor: colors.accent },
  box: { backgroundColor: colors.bg, borderRadius: radius.lg, padding: space.lg, gap: space.md },
});
