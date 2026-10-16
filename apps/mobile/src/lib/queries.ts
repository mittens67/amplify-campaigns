import { QueryClient, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AnalyticsDTO,
  CampaignDetailDTO,
  CampaignSummaryDTO,
  ContributionDTO,
  ContributionRequest,
  NotificationDTO,
  Page,
  ReviewDecision,
  ReviewQueueItemDTO,
  SessionDTO,
} from '@amplify/domain';
import { api, isApiError } from './api';
import { useSession } from './session';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, err) => (isApiError(err) && err.status >= 400 && err.status < 500 ? false : count < 2),
      retryDelay: (n) => Math.min(1500 * 2 ** n, 8000),
    },
  },
});

export const keys = {
  feed: (p: object) => ['campaigns', p] as const,
  campaign: (id: string) => ['campaign', id] as const,
  myCampaigns: ['me', 'campaigns'] as const,
  myContributions: ['me', 'contributions'] as const,
  saved: ['me', 'saved'] as const,
  activity: ['activity'] as const,
  prefs: ['activity', 'prefs'] as const,
  analytics: (id: string) => ['analytics', id] as const,
  contribution: (id: string) => ['contribution', id] as const,
  reviewQueue: (tab: string) => ['review', 'queue', tab] as const,
  reviewCounts: ['review', 'counts'] as const,
  reviewCampaign: (id: string) => ['review', 'campaign', id] as const,
  demo: ['demo'] as const,
};

/** Everything that depends on who is signed in. */
export function resetPrivateQueries() {
  for (const k of [['me'], ['activity'], ['campaign'], ['review'], ['analytics'], ['contribution']]) {
    queryClient.removeQueries({ queryKey: k });
  }
}

export interface FeedParams {
  q?: string;
  category?: string;
  status?: string;
  creatorType?: string;
  sort?: string;
  featured?: boolean;
  limit?: number;
}

const qs = (p: Record<string, unknown>) =>
  Object.entries(p)
    .filter(([, v]) => v !== undefined && v !== '' && v !== false)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');

export function useFeed(p: FeedParams) {
  return useInfiniteQuery({
    queryKey: keys.feed(p),
    queryFn: ({ pageParam }) => api<Page<CampaignSummaryDTO>>(`/campaigns?${qs({ ...p, cursor: pageParam })}`),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useCampaign(id: string | undefined) {
  return useQuery({
    queryKey: keys.campaign(id ?? ''),
    queryFn: () => api<CampaignDetailDTO>(`/campaigns/${id}`),
    enabled: !!id,
  });
}

export type MyCampaign = CampaignSummaryDTO & { currentStep: string; version: number; reviewerMessage: string | null; hasReviewerNotes: boolean };

export function useMyCampaigns() {
  return useQuery({ queryKey: keys.myCampaigns, queryFn: () => api<MyCampaign[]>('/me/campaigns') });
}

export function useMyContributions() {
  return useQuery({ queryKey: keys.myContributions, queryFn: () => api<ContributionDTO[]>('/me/contributions') });
}

export function useSaved() {
  return useQuery({ queryKey: keys.saved, queryFn: () => api<CampaignSummaryDTO[]>('/me/saved') });
}

export function useActivity() {
  return useQuery({ queryKey: keys.activity, queryFn: () => api<NotificationDTO[]>('/activity'), refetchInterval: 30_000 });
}

export function useAnalytics(id: string) {
  return useQuery({ queryKey: keys.analytics(id), queryFn: () => api<AnalyticsDTO>(`/campaigns/${id}/analytics`) });
}

/** Polls only while the payment is pending (e.g. bank verification), then stops. */
export function useContribution(id: string | null, poll: boolean) {
  return useQuery({
    queryKey: keys.contribution(id ?? ''),
    queryFn: () => api<ContributionDTO>(`/contributions/${id}`),
    enabled: !!id,
    refetchInterval: (query) => (poll && query.state.data?.status === 'pending' ? 1500 : false),
  });
}

/* ---------- Mutations ---------- */

export function useContribute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ req, idempotencyKey }: { req: ContributionRequest; idempotencyKey: string }) =>
      api<ContributionDTO>('/contributions', { method: 'POST', body: req, headers: { 'Idempotency-Key': idempotencyKey } }),
    onSuccess: (c) => {
      qc.setQueryData(keys.contribution(c.id), c);
      invalidateAfterContribution(c.campaignId);
    },
  });
}

export function invalidateAfterContribution(campaignId: string) {
  void queryClient.invalidateQueries({ queryKey: keys.campaign(campaignId) });
  void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
  void queryClient.invalidateQueries({ queryKey: ['me'] });
  void queryClient.invalidateQueries({ queryKey: keys.activity });
}

export function useToggle(kind: 'save' | 'follow', campaignId: string) {
  const qc = useQueryClient();
  const field = kind === 'save' ? 'saved' : 'following';
  return useMutation({
    mutationFn: (on: boolean) => api(`/campaigns/${campaignId}/${kind}`, { method: 'POST', body: { [field]: on } }),
    onMutate: async (on) => {
      await qc.cancelQueries({ queryKey: keys.campaign(campaignId) });
      const prev = qc.getQueryData<CampaignDetailDTO>(keys.campaign(campaignId));
      if (prev) qc.setQueryData(keys.campaign(campaignId), { ...prev, viewer: { ...prev.viewer, [field]: on } });
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(keys.campaign(campaignId), ctx.prev),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: keys.saved });
    },
  });
}

export function useFeedback(campaignId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { question: 'visuals' | 'mind'; answer: 'no' | 'somewhat' | 'yes' }) =>
      api<CampaignDetailDTO['feedback']>(`/campaigns/${campaignId}/feedback`, { method: 'POST', body: v }),
    onSuccess: (feedback, v) => {
      const prev = qc.getQueryData<CampaignDetailDTO>(keys.campaign(campaignId));
      if (prev) qc.setQueryData(keys.campaign(campaignId), { ...prev, feedback, viewer: { ...prev.viewer, feedback: { ...prev.viewer.feedback, [v.question]: v.answer } } });
    },
  });
}

/* ---------- Auth ---------- */

export async function completeSignIn(s: SessionDTO) {
  useSession.getState().signIn(s.token, s.user);
  resetPrivateQueries();
  await queryClient.invalidateQueries();
}

export function signOut() {
  useSession.getState().signOut();
  resetPrivateQueries();
  void queryClient.invalidateQueries();
}

/* ---------- Review ---------- */

export function useReviewQueue(tab: string) {
  return useQuery({ queryKey: keys.reviewQueue(tab), queryFn: () => api<any[]>(`/review/queue?tab=${tab}`) });
}
export function useReviewCounts() {
  return useQuery({ queryKey: keys.reviewCounts, queryFn: () => api<Record<string, number>>('/review/counts') });
}
export function useReviewCampaign(id: string) {
  return useQuery({
    queryKey: keys.reviewCampaign(id),
    queryFn: () => api<CampaignDetailDTO & { reviewHistory: any[] }>(`/review/campaigns/${id}`),
  });
}

export function useReviewAction(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ action, body }: { action: 'decision' | 'prepare' | 'launch' | 'finish' | 'halt'; body?: Partial<ReviewDecision> | Record<string, unknown> }) =>
      api<CampaignDetailDTO>(`/review/campaigns/${id}/${action}`, { method: 'POST', body: body ?? {} }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['review'] });
      void qc.invalidateQueries({ queryKey: keys.campaign(id) });
      void qc.invalidateQueries({ queryKey: ['campaigns'] });
      void qc.invalidateQueries({ queryKey: keys.activity });
    },
  });
}

export type { ReviewQueueItemDTO };
