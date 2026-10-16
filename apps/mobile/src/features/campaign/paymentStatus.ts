import type { ContributionStatus, StatusTone } from '@amplify/domain';

export const PAYMENT_STATUS: Record<ContributionStatus, { label: string; tone: StatusTone }> = {
  pending: { label: 'Pending', tone: 'info' },
  succeeded: { label: 'Paid', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  voided: { label: 'Not charged', tone: 'neutral' },
  refund_pending: { label: 'Refund pending', tone: 'warning' },
  refunded: { label: 'Refunded', tone: 'neutral' },
};
