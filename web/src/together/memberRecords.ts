import type { Journey } from '../data';
import { isMember, memberName, snapshotJourneyForGroup, togetherId, type TogetherState } from './model.ts';
import { isSafeTogetherImageUrl } from './contentMedia.ts';

export type MemberRecordTab = 'journals' | 'media' | 'posts' | 'comments' | 'activities';

/** An explicit return keeps its selected tab; first entry opens this scope's existing content. */
export function initialMemberRecordTab(records: Record<MemberRecordTab, ReadonlyArray<unknown>>, preferred?: MemberRecordTab): MemberRecordTab {
  return preferred || (['posts', 'journals', 'media', 'comments', 'activities'] as const).find(tab => records[tab].length > 0) || 'posts';
}

function accessibleGroup(state: TogetherState, viewerId: string, groupId: string, activityId?: string) {
  const group = state.groups.find(item => item.id === groupId);
  if (!viewerId || !state.members.some(item => item.id === viewerId) || !group || !isMember(state, viewerId, groupId)
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
  const member = state.members.find(item => item.id === authorId)!;
  const canReadIntroduction = viewerId === authorId || group.ownerId === viewerId || group.managerIds.includes(viewerId);
  const scopedPosts = state.posts.filter(item => item.groupId === groupId && item.activityId === activityId);
  return {
    identity: { id: authorId, name: memberName(state, authorId, groupId),
      avatar: isSafeTogetherImageUrl(member.avatar) ? member.avatar : '',
      role: group.ownerId === authorId ? '모임장' : group.managerIds.includes(authorId) ? '운영진' : '모임원',
      introduction: canReadIntroduction ? group.memberProfiles?.[authorId]?.introduction || '' : '' },
    journals: state.sharedJournals.filter(matches).filter(item => !item.journey.trash && item.journey.purpose === 'JOURNAL' && item.journey.status === 'PUBLISHED'),
    media: state.media.filter(matches).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    posts: state.posts.filter(matches).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    comments: scopedPosts.flatMap(post => post.comments.filter(comment => comment.authorId === authorId).map(comment => ({
      id: comment.id, postId: post.id, postTitle: post.title, body: comment.body, createdAt: comment.createdAt,
    }))).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    activities: state.activities.filter(item => item.groupId === groupId && (!activityId || item.id === activityId) && item.participants[authorId] === 'JOINED')
      .map(item => ({ id: item.id, title: item.title, date: item.date, endDate: item.endDate, startTime: item.startTime || '', status: item.status,
        cover: isSafeTogetherImageUrl(item.cover) ? item.cover : '' }))
      .sort((a, b) => Number(!a.date) - Number(!b.date) || b.date.localeCompare(a.date) || a.id.localeCompare(b.id)),
  };
}

export type MemberRecordTarget = { kind: 'COMMENT'; postId: string; commentId: string } | { kind: 'ACTIVITY'; activityId: string };

/** Re-resolve a profile link against fresh membership, author and exact record scope before navigating. */
export function resolveMemberRecordDestination(state: TogetherState, viewerId: string, groupId: string, authorId: string, activityId: string | undefined, target: MemberRecordTarget) {
  const records = selectMemberRecords(state, viewerId, groupId, authorId, activityId);
  if (!records) return null;
  if (target.kind === 'ACTIVITY') {
    const activity = records.activities.find(item => item.id === target.activityId);
    return activity ? { kind: 'ACTIVITY' as const, route: `activity-${activity.id}`, activityId: activity.id, view: 'schedule' as const } : null;
  }
  const comment = records.comments.find(item => item.id === target.commentId && item.postId === target.postId);
  return comment ? { kind: 'COMMENT' as const, route: activityId ? `activity-${activityId}` : `group-${groupId}`, activityId,
    view: activityId ? 'record' as const : 'board' as const, recordView: 'posts' as const,
    elementId: `tg-comment-${comment.postId}-${comment.id}`, postElementId: `tg-post-${comment.postId}` } : null;
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
