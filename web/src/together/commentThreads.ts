import { togetherId, type TogetherComment } from './model.ts';

export const MAX_TOGETHER_COMMENT_LENGTH = 1000;

/** Replies use the unambiguous ID of a root on the same post or album item. */
export function hasValidTogetherCommentParents(comments: ReadonlyArray<TogetherComment>): boolean {
  const byId = new Map<string, TogetherComment>();
  const repeatedIds = new Set<string>();
  for (const comment of comments) {
    if (byId.has(comment.id)) repeatedIds.add(comment.id);
    byId.set(comment.id, comment);
  }
  return comments.every(comment => {
    if (comment.parentId === undefined) return true;
    if (typeof comment.parentId !== 'string' || !comment.parentId.trim() || repeatedIds.has(comment.id)
      || repeatedIds.has(comment.parentId)) return false;
    const parent = byId.get(comment.parentId);
    return !!parent && parent.parentId === undefined;
  });
}

export function createTogetherComment(comments: ReadonlyArray<TogetherComment>, authorId: string, body: string, prefix: string, parentId?: string): TogetherComment {
  const text = typeof body === 'string' ? body.trim() : '';
  if (!text) throw new Error('댓글을 입력해 주세요.');
  if (text.length > MAX_TOGETHER_COMMENT_LENGTH) throw new Error('댓글은 1,000자 이내로 적어 주세요.');
  if (parentId !== undefined) {
    const [parent, duplicate] = comments.filter(comment => comment.id === parentId);
    if (typeof parentId !== 'string' || !parentId.trim() || !parent || duplicate || parent.parentId !== undefined) {
      throw new Error('답글을 달 댓글을 다시 선택해 주세요.');
    }
  }
  return {
    id: togetherId(prefix), authorId, body: text, createdAt: new Date().toISOString(),
    ...(parentId === undefined ? {} : { parentId }),
  };
}

export function getTogetherCommentGroups(comments: ReadonlyArray<TogetherComment>): { root: TogetherComment; replies: TogetherComment[] }[] {
  const sorted = comments.map((comment, index) => ({ comment, index, time: Date.parse(comment.createdAt) || 0 }))
    .sort((left, right) => left.time - right.time || left.index - right.index);
  const repliesByParent = new Map<string, TogetherComment[]>();
  for (const { comment } of sorted) {
    if (comment.parentId === undefined) continue;
    const replies = repliesByParent.get(comment.parentId) ?? [];
    replies.push(comment);
    repliesByParent.set(comment.parentId, replies);
  }
  return sorted.filter(({ comment }) => comment.parentId === undefined)
    .sort((left, right) => right.time - left.time || left.index - right.index)
    .map(({ comment }) => ({ root: comment, replies: repliesByParent.get(comment.id) ?? [] }));
}
