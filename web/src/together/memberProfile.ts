import type { GroupMemberPresentation, TogetherState } from './model.ts';
import { assertMemberRecordWriteAccess, selectMemberRecords } from './memberRecords.ts';
import { isSafeTogetherImageUrl } from './contentMedia.ts';
import { canUseRoomProfiles, isGroupMemberPresentation, rememberRoomProfilePreset, roomProfileEditorValues, safePresentationId } from './roomIdentity.ts';

export interface MemberPresentationInput extends GroupMemberPresentation { avatar: string }
export { isGroupMemberPresentation, isGroupMemberPresentations } from './roomIdentity.ts';

/** Shared identity is allowlisted. Joining introductions/answers and account contact data never enter this projection. */
export function selectMemberProfile(state: TogetherState, viewerId: string, groupId: string, authorId: string, activityId?: string) {
  const records = selectMemberRecords(state, viewerId, groupId, authorId, activityId);
  if (!records) return null;
  const group = state.groups.find(item => item.id === groupId)!;
  const activity = activityId ? state.activities.find(item => item.id === activityId && item.groupId === groupId) : undefined;
  const presentation = roomProfileEditorValues(state, authorId, groupId, activityId);
  const canEdit = viewerId === authorId && canUseRoomProfiles(group) && !group.archived && activity?.status !== 'CANCELLED';
  const postPhotos = records.posts.flatMap(post => (post.attachments || []).filter(photo => isSafeTogetherImageUrl(photo.url)).map(photo => ({
    id: `post:${post.id}:${photo.id}`, recordId: post.id, url: photo.url, caption: photo.caption || post.title, createdAt: post.createdAt,
  }))).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { identity: { id: authorId, name: records.identity.name, avatar: records.identity.avatar, role: records.identity.role,
    introduction: presentation.introduction }, groupName: group.name, ...(activity && { activityName: activity.title }),
    isOwn: viewerId === authorId,
    canEdit, ...(canEdit && { editablePresentation: presentation }),
    counts: { journals: records.journals.length, media: records.media.length + postPhotos.length, posts: records.posts.length, comments: records.comments.length, activities: records.activities.length },
    postPhotos };
}

/** Call inside the account repository transaction. No joining profile, other member or personal library is rewritten. */
export function updateOwnMemberPresentation(state: TogetherState, actorId: string, groupId: string, input: MemberPresentationInput, activityId?: string): void {
  assertMemberRecordWriteAccess(state, actorId, groupId, activityId);
  const group = state.groups.find(item => item.id === groupId)!;
  if (!canUseRoomProfiles(group)) throw new Error('이 대화방은 기본 프로필을 사용해요.');
  if (!safePresentationId(actorId) || !isGroupMemberPresentation(input) || typeof input.avatar !== 'string') {
    throw new Error('사진과 모임 이름표·소개를 다시 확인해 주세요.');
  }
  const room = activityId ? state.activities.find(item => item.id === activityId && item.groupId === groupId)! : group;
  const presentation = { nickname: input.nickname.trim(), introduction: input.introduction.trim(), avatar: input.avatar };
  rememberRoomProfilePreset(state, actorId, { nickname: presentation.nickname, avatar: presentation.avatar });
  room.memberPresentations = { ...room.memberPresentations, [actorId]: presentation };
}
