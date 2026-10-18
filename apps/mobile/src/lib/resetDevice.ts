import { useDrafts } from '@/features/create/draftStore';
import { queryClient } from './queries';
import { useSession } from './session';
import { useTour } from './tour';

/**
 * Return this device to a first-launch state: signed out as a new guest, intro and tour
 * not yet seen, empty checklist, no local drafts. Used between usability-test participants.
 */
export function resetDevice() {
  queryClient.clear();
  useDrafts.setState({ drafts: {} });
  useTour.setState({ tourOpen: false, tourSeen: false, lastActiveAt: null, done: {}, checklistHidden: false });
  useSession.getState().signOut(); // also issues a fresh guest id
  useSession.setState({ onboarded: false });
}
