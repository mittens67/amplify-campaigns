import { FEES } from './money';
import { CURRENT_REACH_MODEL, peoplePerContributedDollar } from './reach';

const fee = FEES.platformFeeBps / 100;
const perDollar = peoplePerContributedDollar(CURRENT_REACH_MODEL);

/** Plain-language explanations of the concepts people are unfamiliar with. */
export const GLOSSARY = {
  estimatedReach: {
    title: 'Estimated reach',
    body: `An estimate of how many different people could see the campaign's ads. We use a demo assumption of about ${perDollar} people per $1 contributed, after fees. Real delivery depends on ad prices, targeting and how people respond, so it is never guaranteed.`,
  },
  measuredReach: {
    title: 'Measured reach',
    body: 'Unique people the ads were actually delivered to, as reported by the distribution partner. In this prototype, delivery is simulated and labelled as such.',
  },
  platformFee: {
    title: 'Platform fee',
    body: `${fee}% of each contribution covers review, ad operations, reporting and running the platform. The other ${100 - fee}% becomes the campaign's advertising budget.`,
  },
  processingFee: {
    title: 'Processing fee',
    body: 'Card networks charge 2.9% + 30¢ per payment. It is added on top so your full contribution goes to the campaign. Processing fees are not refundable.',
  },
  notDonation: {
    title: 'Amplification, not a donation',
    body: "Your contribution pays for ads that show this message to more people. It doesn't fund the cause, person or organisation described in the campaign, and the money isn't paid to the creator.",
  },
  review: {
    title: 'How review works',
    body: 'Every campaign is reviewed before it can be funded. Reviewers check three things: whether claims match the cited sources (Fact-Check), whether the framing is fair (Communication Integrity), and whether it invites people with different views in (Shared Reality). Reviewed means evaluated, not verified or guaranteed.',
  },
  distribution: {
    title: 'Distribution',
    body: "Once funding closes, our team finalises targeting and places the ads with distribution partners. Reaching the goal doesn't launch ads by itself — it starts only after approval, payment and ad setup are complete.",
  },
  unspentFunds: {
    title: 'Unspent funds',
    body: "If a campaign isn't approved, is halted, or doesn't reach the $100 minimum ad budget, unspent contributions are refunded minus processing fees. Money already spent on delivered ads can't be refunded.",
  },
} as const;
export type GlossaryKey = keyof typeof GLOSSARY;

export const REFUND_MATRIX = [
  { when: 'Not approved or halted before ads run', treatment: 'Full contribution refunded; processing fees are not refundable.' },
  { when: 'Funding ends below the $100 minimum ad budget', treatment: 'Full contribution refunded; processing fees are not refundable.' },
  { when: 'Ads are running or funds are committed', treatment: 'Amounts already spent or committed to delivery are not refunded.' },
  { when: 'Campaign completes under budget', treatment: 'Any unspent ad budget is refunded proportionally.' },
] as const;

export const AMPLIFICATION_LINE =
  "This pays for ads that show this message to more people. It's not a donation to the cause.";
