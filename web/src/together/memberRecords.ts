import type { Journey } from '../data';
import { memberName, snapshotJourneyForGroup, togetherId, type TogetherState } from './model.ts';

function accessibleGroup(state: TogetherState, viewerId: string, groupId: string, activityId?: string) {
  const group = state.groups.find(item => item.id === groupId);
  if (!viewerId || !state.members.some(item => item.id === viewerId) || !group?.memberIds.includes(viewerId)
    || group.blockedMemberIds?.includes(viewerId)) return null;
  if (group.spaceType === 'ACTIVITY' && !activityId) return null;
  if (activityId && !state.activities.some(item => item.id === activityId && item.groupId === groupId)) return null;
  return group;
}

/** Only records explicitly shared into this exact group/appointment; never reads a personal library. */
export function selectMemberRecords(state: TogetherState, viewerId: string, groupId: string, authorId: string, activityId?: string) {
  const group = accessibleGroup(state, viewerId, groupId, activityId);
  if (!group || !group.memberIds.includes(authorId) || group.blockedMemberIds?.includes(authorId)
    || !state.members.some(item => item.id === authorId)) return null;
  const matches = (item: { groupId: string; authorId: string; activityId?: string }) => item.groupId === groupId
    && item.authorId === authorId && item.activityId === activityId;
  return {
    journals: state.sharedJournals.filter(matches).filter(item => !item.journey.trash && item.journey.purpose === 'JOURNAL' && item.journey.status === 'PUBLISHED'),
    media: state.media.filter(matches).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    posts: state.posts.filter(matches).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}

/** A private, completed own journal is selectable; selection is not public publication or sharing. */
export function ownShareableJournals(journeys: ReadonlyArray<Journey>): Journey[] {
  return journeys.filter(item => item.isMine && item.purpose === 'JOURNAL' && item.status === 'PUBLISHED' && !item.trash);
}

export function assertMemberRecordWriteAccess(state: TogetherState, actorId: string, groupId: string, activityId?: string): void {
  const group = accessibleGroup(state, actorId, groupId, activityId);
  if (!group || group.archived) throw new Error('현재 모임원만 기록을 공유할 수 있어요.');
  if (activityId && state.activities.find(item => item.id === activityId)?.status === 'CANCELLED') throw new Error('취소된 약속에는 새 기록을 공유할 수 없어요.');
}

/** Explicit snapshot write rechecks current room membership; original and all other scopes stay untouched. */
export function shareMemberJournal(state: TogetherState, actorId: string, groupId: string, source: Journey, activityId?: string): string {
  assertMemberRecordWriteAccess(state, actorId, groupId, activityId);
  if (!ownShareableJournals([source]).length) throw new Error('완료한 내 여행기를 선택해 주세요.');
  const duplicate = state.sharedJournals.find(item => item.groupId === groupId && item.activityId === activityId
    && item.authorId === actorId && item.sourceJourneyId === source.id);
  if (duplicate) throw new Error('이미 공유한 여행기예요. 기존 공유본을 확인해 주세요.');
  const journey = snapshotJourneyForGroup(source, memberName(state, actorId, groupId));
  const id = togetherId('shared-journal');
  state.sharedJournals.push({ id, groupId, activityId, authorId: actorId, sourceJourneyId: source.id, journey });
  return id;
}
