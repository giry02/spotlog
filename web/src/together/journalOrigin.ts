import type { Journey } from '../data';
import { finishJournalDraft } from '../journalDraft.ts';
import { assertMemberRecordWriteAccess, ownShareableJournals } from './memberRecords.ts';
import type { TogetherState } from './model';

/** IDs only, held by the current account's page memory; never persisted into a personal journal. */
export interface JournalOrigin { actorId: string; groupId: string; activityId: string; journeyId: string }
export interface JournalShareRequest extends JournalOrigin { id: string }

export function captureJournalOrigin(state: TogetherState, actorId: string, groupId: string, activityId: string, journeyId: string): JournalOrigin | null {
  if (!actorId || !groupId || !activityId || !journeyId) return null;
  try {
    assertMemberRecordWriteAccess(state, actorId, groupId, activityId);
    return { actorId, groupId, activityId, journeyId };
  } catch { return null; }
}

/** Re-resolve current membership and the exact appointment. No fallback to a sibling or group-wide room. */
export function resolveJournalOrigin(state: TogetherState, actorId: string, origin: JournalOrigin | null | undefined, journals?: ReadonlyArray<Journey>) {
  if (!origin || actorId !== origin.actorId || !captureJournalOrigin(state, actorId, origin.groupId, origin.activityId, origin.journeyId)) return null;
  if (journals && !ownShareableJournals(journals).some(item => item.id === origin.journeyId)) return null;
  const group = state.groups.find(item => item.id === origin.groupId)!;
  const activity = state.activities.find(item => item.id === origin.activityId && item.groupId === origin.groupId)!;
  return { ...origin, groupName: group.name, activityTitle: activity.title, route: `activity-${activity.id}` };
}

/** Final completion and public visibility are independent. Draft autosaves do not call this. */
export function completeJournal(draft: Journey): Journey {
  if (!draft.isMine || draft.purpose === 'PLAN' || draft.trash) throw new Error('완료할 내 여행기를 다시 확인해 주세요.');
  return finishJournalDraft({ ...draft, status: 'PUBLISHED', visibility: draft.visibility === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE' });
}
