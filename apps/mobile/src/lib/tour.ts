import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Learn-by-doing tasks on the Home checklist. Each is ticked off when the person actually does it. */
export const TASKS = [
  { key: 'explore', label: 'Browse campaigns in Explore', href: '/explore' },
  { key: 'open', label: 'Open a campaign and read its sources', href: '/explore' },
  { key: 'learn', label: 'See where a contribution’s money goes', href: '/info/how-it-works' },
  { key: 'back', label: 'Back a campaign (simulated — no real money)', href: '/explore' },
  { key: 'create', label: 'Start a campaign draft', href: '/create' },
  { key: 'activity', label: 'Check your Activity updates', href: '/activity' },
] as const;
export type TaskKey = (typeof TASKS)[number]['key'];

/** Show a refresher tour when someone returns after this long. */
const RETURNING_AFTER_MS = 30 * 86_400_000;

interface TourState {
  tourOpen: boolean;
  tourReason: 'new' | 'returning' | 'manual';
  tourSeen: boolean;
  lastActiveAt: number | null;
  done: Partial<Record<TaskKey, boolean>>;
  checklistHidden: boolean;
  /** Bumped to ask Home to scroll the checklist into view. */
  focusChecklist: number;
  hydrated: boolean;
  startTour: (reason?: TourState['tourReason']) => void;
  endTour: () => void;
  markTask: (k: TaskKey) => void;
  hideChecklist: () => void;
  showChecklist: () => void;
  /** Call when the app opens: starts the refresher tour for people who've been away. */
  checkIn: () => void;
}

export const useTour = create<TourState>()(
  persist(
    (set, get) => ({
      tourOpen: false,
      tourReason: 'new',
      tourSeen: false,
      lastActiveAt: null,
      done: {},
      checklistHidden: false,
      focusChecklist: 0,
      hydrated: false,
      startTour: (reason = 'manual') => set({ tourOpen: true, tourReason: reason }),
      endTour: () => set({ tourOpen: false, tourSeen: true, lastActiveAt: Date.now() }),
      markTask: (k) => {
        // Screens the tour itself opens don't count — only things the person does.
        if (get().tourOpen || get().done[k]) return;
        set((s) => ({ done: { ...s.done, [k]: true } }));
      },
      hideChecklist: () => set({ checklistHidden: true }),
      showChecklist: () => set((s) => ({ checklistHidden: false, focusChecklist: s.focusChecklist + 1 })),
      checkIn: () => {
        const { lastActiveAt, tourSeen, tourOpen } = get();
        const now = Date.now();
        if (!tourOpen && tourSeen && lastActiveAt && now - lastActiveAt > RETURNING_AFTER_MS) {
          set({ tourOpen: true, tourReason: 'returning', checklistHidden: false });
        }
        set({ lastActiveAt: now });
      },
    }),
    {
      name: 'amplify-tour',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ tourSeen: s.tourSeen, lastActiveAt: s.lastActiveAt, done: s.done, checklistHidden: s.checklistHidden }),
      onRehydrateStorage: () => () => useTour.setState({ hydrated: true }),
    },
  ),
);

export const markTask = (k: TaskKey) => useTour.getState().markTask(k);
