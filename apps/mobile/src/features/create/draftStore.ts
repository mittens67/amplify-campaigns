import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { emptyContent, normalizeContent, type CampaignContent, type StepKey } from '@amplify/domain';
import { api, ApiError } from '@/lib/api';
import { queryClient, keys } from '@/lib/queries';

export type SyncState = 'saved' | 'saving' | 'pending' | 'offline' | 'conflict' | 'locked';

export interface Draft {
  key: string;
  serverId: string | null;
  version: number;
  content: CampaignContent;
  step: StepKey;
  updatedAt: number;
  savedAt: number | null;
  sync: SyncState;
}

interface DraftState {
  drafts: Record<string, Draft>;
  create: (content?: CampaignContent) => string;
  adopt: (serverId: string, content: CampaignContent, version: number, step?: StepKey) => string;
  update: (key: string, mutate: (c: CampaignContent) => void, touchedPaths?: string[]) => void;
  setStep: (key: string, step: StepKey) => void;
  patch: (key: string, p: Partial<Draft>) => void;
  remove: (key: string) => void;
}

/**
 * Local-first drafts: every change is saved on the device immediately (AsyncStorage),
 * then synced to the API after a short pause. Works offline; the server version check
 * prevents an old copy from overwriting newer work.
 */
export const useDrafts = create<DraftState>()(
  persist(
    (set, get) => ({
      drafts: {},
      create: (content) => {
        const key = 'd_' + Crypto.randomUUID().slice(0, 12);
        set((s) => ({
          drafts: {
            ...s.drafts,
            [key]: { key, serverId: null, version: 0, content: content ?? emptyContent(), step: 'basics', updatedAt: Date.now(), savedAt: null, sync: 'pending' },
          },
        }));
        scheduleSync(key, 0);
        return key;
      },
      adopt: (serverId, content, version, step = 'basics') => {
        const existing = Object.values(get().drafts).find((d) => d.serverId === serverId);
        if (existing && existing.version >= version) return existing.key;
        const key = existing?.key ?? serverId;
        set((s) => ({
          drafts: { ...s.drafts, [key]: { key, serverId, version, content: normalizeContent(content), step, updatedAt: Date.now(), savedAt: Date.now(), sync: 'saved' } },
        }));
        return key;
      },
      update: (key, mutate, touchedPaths) => {
        const d = get().drafts[key];
        if (!d) return;
        const next = structuredClone(d.content);
        mutate(next);
        // Editing an AI-suggested field counts as the creator taking ownership of it.
        if (touchedPaths?.length) next.aiSuggested = next.aiSuggested.filter((p) => !touchedPaths.includes(p));
        set((s) => ({ drafts: { ...s.drafts, [key]: { ...d, content: next, updatedAt: Date.now(), sync: d.sync === 'locked' ? 'locked' : 'pending' } } }));
        scheduleSync(key);
      },
      setStep: (key, step) => {
        const d = get().drafts[key];
        if (!d || d.step === step) return;
        set((s) => ({ drafts: { ...s.drafts, [key]: { ...d, step } } }));
        scheduleSync(key);
      },
      patch: (key, p) => {
        const d = get().drafts[key];
        if (d) set((s) => ({ drafts: { ...s.drafts, [key]: { ...d, ...p } } }));
      },
      remove: (key) =>
        set((s) => {
          const { [key]: _gone, ...rest } = s.drafts;
          return { drafts: rest };
        }),
    }),
    {
      name: 'amplify-drafts',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ drafts: s.drafts }),
    },
  ),
);

const timers = new Map<string, ReturnType<typeof setTimeout>>();
const inflight = new Map<string, Promise<void>>();

export function scheduleSync(key: string, delay = 1200) {
  clearTimeout(timers.get(key));
  timers.set(key, setTimeout(() => void syncDraft(key), delay));
}

/** Push the latest local copy to the server. Safe to call repeatedly. */
export async function syncDraft(key: string): Promise<void> {
  clearTimeout(timers.get(key));
  const running = inflight.get(key);
  if (running) {
    await running;
  }
  const d = useDrafts.getState().drafts[key];
  if (!d || d.sync === 'locked' || d.sync === 'saved') return;
  const { patch } = useDrafts.getState();
  const startedAt = d.updatedAt;
  const job = (async () => {
    patch(key, { sync: 'saving' });
    try {
      let serverId = d.serverId;
      let version = d.version;
      if (!serverId) {
        const created = await api<{ id: string; version: number }>('/campaigns', { method: 'POST', body: { content: d.content } });
        serverId = created.id;
        version = created.version;
        // Remember the server copy right away so a failed save below never creates a duplicate.
        patch(key, { serverId, version });
      }
      const saved = await api<{ version: number }>(`/campaigns/${serverId}/draft`, {
        method: 'PUT',
        body: { content: useDrafts.getState().drafts[key]?.content ?? d.content, version, step: d.step },
      });
      const latest = useDrafts.getState().drafts[key];
      patch(key, {
        serverId,
        version: saved.version,
        savedAt: Date.now(),
        sync: latest && latest.updatedAt > startedAt ? 'pending' : 'saved',
      });
      void queryClient.invalidateQueries({ queryKey: keys.myCampaigns });
      if (latest && latest.updatedAt > startedAt) scheduleSync(key, 400);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'STALE') patch(key, { sync: 'conflict' });
      else if (e instanceof ApiError && e.code === 'LOCKED') patch(key, { sync: 'locked' });
      else {
        patch(key, { sync: 'offline' });
        scheduleSync(key, 8000); // retry quietly; the work is safe on the device
      }
    }
  })();
  inflight.set(key, job);
  await job;
  inflight.delete(key);
}

/** Replace the local copy with the server's latest (resolving a conflict). */
export async function reloadFromServer(key: string) {
  const d = useDrafts.getState().drafts[key];
  if (!d?.serverId) return;
  const detail = await api<{ draft?: { content: CampaignContent; version: number } }>(`/campaigns/${d.serverId}`);
  if (detail.draft) {
    useDrafts.getState().patch(key, { content: normalizeContent(detail.draft.content), version: detail.draft.version, sync: 'saved', savedAt: Date.now() });
  }
}
