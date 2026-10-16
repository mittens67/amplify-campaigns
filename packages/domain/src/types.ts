import type { CampaignContent, Category, ContributionStatus, CreatorType, ReviewLayerKey, ReviewOutcome } from './content';
import type { CampaignStatus } from './lifecycle';

/** API data-transfer objects shared by the API and the app. */

export type Role = 'user' | 'reviewer';

export interface UserDTO {
  id: string;
  email: string;
  name: string;
  role: Role;
  showNameDefault: boolean;
}

export interface SessionDTO {
  token: string;
  user: UserDTO;
}

export interface CampaignSummaryDTO {
  id: string;
  status: CampaignStatus;
  title: string;
  summary: string;
  category: Category | null;
  creatorName: string;
  creatorType: CreatorType | null;
  coverUrl: string | null;
  raisedCents: number;
  goalCents: number;
  backerCount: number;
  fundingEndsAt: string | null;
  publishedAt: string | null;
  estReachAtGoal: number;
  featured: boolean;
  isDemo: boolean;
  updatedAt: string;
}

export interface ReviewLayerDTO {
  layer: ReviewLayerKey;
  outcome: ReviewOutcome;
  notes: string;
  reviewedAt: string;
}

export interface TimelineEventDTO {
  id: string;
  event: string;
  from: CampaignStatus | null;
  to: CampaignStatus;
  note: string | null;
  actorRole: 'creator' | 'reviewer' | 'system';
  at: string;
}

export interface CampaignUpdateDTO {
  id: string;
  title: string;
  body: string;
  kind: 'creator' | 'milestone';
  at: string;
}

export interface MetricsTotalsDTO {
  days: number;
  spendCents: number;
  impressions: number;
  reach: number;
  clicks: number;
}

export interface CampaignDetailDTO extends CampaignSummaryDTO {
  content: CampaignContent;
  reachModelVersion: number;
  reviews: ReviewLayerDTO[];
  timeline: TimelineEventDTO[];
  updates: CampaignUpdateDTO[];
  publicBackers: string[];
  delivery: MetricsTotalsDTO | null;
  feedback: Record<'visuals' | 'mind', { no: number; somewhat: number; yes: number }>;
  viewer: {
    isOwner: boolean;
    saved: boolean;
    following: boolean;
    contributedCents: number;
    feedback: Partial<Record<'visuals' | 'mind', 'no' | 'somewhat' | 'yes'>>;
  };
  /** Present for owners/reviewers only. */
  draft?: { content: CampaignContent; version: number; reviewerNotes: Record<string, string>; reviewerMessage: string | null };
}

export interface ContributionDTO {
  id: string;
  campaignId: string;
  campaignTitle: string;
  campaignCoverUrl: string | null;
  campaignStatus: CampaignStatus;
  amountCents: number;
  platformFeeCents: number;
  adBudgetCents: number;
  processingCents: number;
  totalCents: number;
  refundCents: number;
  status: ContributionStatus;
  estReach: number;
  attributedReach: number | null;
  publicName: string | null;
  receiptNo: string;
  createdAt: string;
  failureReason: string | null;
  campaign?: { raisedCents: number; goalCents: number; backerCount: number };
}

export type NotificationType =
  | 'submission_received'
  | 'approved'
  | 'changes_requested'
  | 'rejected'
  | 'funding_open'
  | 'milestone'
  | 'deadline'
  | 'contribution_succeeded'
  | 'contribution_failed'
  | 'goal_reached'
  | 'funding_ended'
  | 'promotion_started'
  | 'distribution_progress'
  | 'completed'
  | 'report_ready'
  | 'refund'
  | 'update'
  | 'security';

export type NotificationGroup = 'campaigns' | 'backing' | 'account';

export interface NotificationDTO {
  id: string;
  type: NotificationType;
  group: NotificationGroup;
  title: string;
  body: string;
  campaignId: string | null;
  campaignTitle: string | null;
  campaignCoverUrl: string | null;
  read: boolean;
  at: string;
  /** For the "your campaigns" vs "for you" segmentation. */
  audience: 'creator' | 'backer' | 'account';
}

export interface DailyPointDTO {
  day: string;
  value: number;
}

export interface AnalyticsDTO {
  campaignId: string;
  status: CampaignStatus;
  funding: {
    raisedCents: number;
    goalCents: number;
    backerCount: number;
    contributionCount: number;
    averageCents: number;
    daily: DailyPointDTO[];
    platformFeeCents: number;
    adBudgetCents: number;
  };
  delivery: {
    allocatedCents: number;
    spentCents: number;
    impressions: number;
    reach: number;
    clicks: number;
    ctr: number | null;
    cpmCents: number | null;
    daily: { day: string; spendCents: number; impressions: number; reach: number; clicks: number }[];
  };
  estimates: { reachAtGoal: number; reachForRaised: number };
  durationDays: number;
  fundingEndsAt: string | null;
}

export interface ReviewQueueItemDTO extends CampaignSummaryDTO {
  submittedAt: string | null;
  reportCount: number;
}

export interface CampaignReportDTO {
  id: string;
  campaignId: string;
  campaignTitle: string;
  reason: string;
  details: string;
  at: string;
  resolved: boolean;
}

export interface ApiErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> };
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
