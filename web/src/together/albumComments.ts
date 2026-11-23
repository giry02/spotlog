import { createTogetherComment, hasValidTogetherCommentParents, MAX_TOGETHER_COMMENT_LENGTH } from './commentThreads.ts';
import type { TogetherMedia, TogetherMediaComment, TogetherState } from './model.ts';
import { isTemporaryRoomTrashed } from './temporaryRooms.ts';

export const MAX_ALBUM_MEDIA_COMMENT_LENGTH = MAX_TOGETHER_COMMENT_LENGTH;

export function isAlbumMediaComments(value: unknown): value is TogetherMediaComment[] {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    const { id, authorId, body, createdAt } = entry;
    if (typeof id !== 'string' || !id.trim() || ids.has(id)
      || typeof authorId !== 'string' || !authorId.trim()
      || typeof body !== 'string' || !body.trim() || body.length > MAX_ALBUM_MEDIA_COMMENT_LENGTH
      || typeof createdAt !== 'string' || !Number.isFinite(Date.parse(createdAt))) return false;
    ids.add(id);
  }
  return hasValidTogetherCommentParents(value);
}

/** The group album includes its own appointment media. An appointment album only includes its own items. */
export function readAlbumMedia(state: TogetherState, viewerId: string, groupId: string, mediaId: string, activityId?: string): { item: TogetherMedia; canComment: boolean } | null {
  const group = state.groups.find(row => row.id === groupId);
  if (!group || !viewerId || !state.members.some(member => member.id === viewerId)
    || !group.memberIds.includes(viewerId) || group.blockedMemberIds?.includes(viewerId)
    || isTemporaryRoomTrashed(group) || (group.spaceType === 'ACTIVITY' && activityId === undefined)) return null;
  const item = state.media.find(row => row.id === mediaId && row.groupId === groupId
    && (activityId === undefined || row.activityId === activityId));
  if (!item) return null;
  const activity = item.activityId === undefined ? undefined
    : state.activities.find(row => row.id === item.activityId && row.groupId === groupId);
  if (item.activityId !== undefined && !activity) return null;

  const deadline = group.temporaryRoom?.expiresAt;
  const canComment = !group.archived && !group.temporaryRoom?.closedAt
    && (!deadline || Date.parse(deadline) > Date.now()) && activity?.status !== 'CANCELLED';
  return { item, canComment };
}

/** Recheck the current album and membership within the repository update before saving. */
export function addAlbumMediaComment(state: TogetherState, viewerId: string, groupId: string, mediaId: string, body: string, activityId?: string, parentId?: string): TogetherMediaComment {
  const entry = readAlbumMedia(state, viewerId, groupId, mediaId, activityId);
  if (!entry) throw new Error('이 앨범에서 볼 수 있는 사진이나 영상을 다시 선택해 주세요.');
  if (!entry.canComment) throw new Error('이 사진이나 영상의 댓글은 읽기만 할 수 있어요.');
  const comment = createTogetherComment(entry.item.comments ?? [], viewerId, body, 'media-comment', parentId);
  (entry.item.comments ??= []).push(comment);
  return comment;
}
