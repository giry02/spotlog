import { createTogetherComment, hasValidTogetherCommentParents } from './commentThreads.ts';
import { isMember, type TogetherComment, type TogetherState } from './model.ts';

function isStoredComment(value: unknown): value is TogetherComment {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.id === 'string' && typeof entry.authorId === 'string'
    && typeof entry.body === 'string' && typeof entry.createdAt === 'string';
}

export function isTogetherPostComments(value: unknown): value is TogetherComment[] {
  return Array.isArray(value) && value.every(isStoredComment) && hasValidTogetherCommentParents(value);
}

/** The group board can include its own appointment posts. A specific appointment can only write to its own posts. */
export function addTogetherPostComment(state: TogetherState, viewerId: string, groupId: string, postId: string, body: string, parentId?: string, activityId?: string): TogetherComment {
  const group = state.groups.find(item => item.id === groupId);
  if (!group || !isMember(state, viewerId, groupId) || !state.members.some(item => item.id === viewerId)
    || group.blockedMemberIds?.includes(viewerId) || (group.spaceType === 'ACTIVITY' && activityId === undefined)) {
    throw new Error('이 모임에서 볼 수 있는 게시글을 다시 선택해 주세요.');
  }
  const post = state.posts.find(item => item.id === postId && item.groupId === groupId
    && (activityId === undefined || item.activityId === activityId));
  if (!post || (post.activityId !== undefined && !state.activities.some(item => item.id === post.activityId && item.groupId === groupId))) {
    throw new Error('이 모임에서 볼 수 있는 게시글을 다시 선택해 주세요.');
  }
  if (group.archived) throw new Error('이 게시글의 댓글은 읽기만 할 수 있어요.');

  const comment = createTogetherComment(post.comments, viewerId, body, 'comment', parentId);
  post.comments.push(comment);
  return comment;
}
