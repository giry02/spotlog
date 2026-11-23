import type { JourneyComment } from './consumerPublicSeed.ts';
import type { PublicComment } from './publicServiceTypes.ts';

export type JourneyCommentDraft = { body: string; parentId?: string };

export function journalCommentTime(comment: JourneyComment): number {
  const localId = /^comment-(\d{13})$/.exec(comment.id);
  if (localId) return Number(localId[1]);
  const timestamp = Date.parse(comment.createdAt);
  if (Number.isFinite(timestamp)) return timestamp;
  // Bundled comments use Korean month/day labels from 2026.
  const sampleDate = /(\d{1,2})월\s*(\d{1,2})일/.exec(comment.createdAt);
  return sampleDate ? Date.UTC(2026, Number(sampleDate[1]) - 1, Number(sampleDate[2])) : 0;
}

export function projectJournalComment(comment: JourneyComment): PublicComment {
  const time = journalCommentTime(comment);
  return { commentId: comment.id, revision: 1, journalId: comment.journeyId, parentId: comment.parentId,
    authorId: comment.authorId ?? 'public-author:' + comment.author, authorName: comment.author, authorAvatar: comment.avatar,
    original: comment.body, english: '', createdAt: time ? new Date(time).toISOString() : new Date().toISOString(),
    moderation: 'VISIBLE', sourceKind: 'PUBLIC_SAMPLE' };
}

export function getJourneyCommentGroups(journeyId: string, comments: readonly JourneyComment[], publicComments: readonly PublicComment[], moderation: readonly { id: string; state: string }[]) {
  const projected = publicComments.filter(comment => comment.journalId === journeyId && !comment.cardId);
  const hidden = new Set([
    ...moderation.filter(item => item.state !== 'VISIBLE').map(item => item.id),
    ...projected.filter(comment => comment.moderation !== 'VISIBLE').map(comment => comment.commentId),
  ]);
  const imported = projected.map((comment): JourneyComment => ({
    id: comment.commentId, journeyId, author: comment.authorName ?? comment.authorId, authorId: comment.authorId,
    body: comment.original, parentId: comment.parentId, createdAt: comment.createdAt, avatar: comment.authorAvatar, authorCopies: 0,
  }));
  const items = [...new Map([...imported, ...comments.filter(comment => comment.journeyId === journeyId)]
    .filter(comment => !hidden.has(comment.id)).map(comment => [comment.id, comment])).values()];
  const replies = new Map<string, JourneyComment[]>();
  for (const comment of items) {
    if (!comment.parentId) continue;
    const branch = replies.get(comment.parentId);
    if (branch) branch.push(comment);
    else replies.set(comment.parentId, [comment]);
  }
  const byTime = (left: JourneyComment, right: JourneyComment) => journalCommentTime(left) - journalCommentTime(right);
  return items.filter(comment => !comment.parentId).sort((left, right) => byTime(right, left))
    .map(root => ({ root, replies: (replies.get(root.id) ?? []).sort(byTime) }));
}
