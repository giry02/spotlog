import { selectReviewDraftFacts, type ReviewDraftFacts } from './groupContent.ts';
import { assertMemberRecordWriteAccess } from './memberRecords.ts';
import type { TogetherPost, TogetherState } from './model';
import { createAiRequestId, postScopedAiJson, type ScopedAiRequest } from './chatAiSummary.ts';

export interface ReviewDraftContext {
  state: TogetherState; viewerId: string; groupId: string; activityId?: string; category: TogetherPost['category'];
}
export interface ReviewDraftCapture {
  viewerId: string; groupId: string; activityId?: string; facts: ReviewDraftFacts;
}

/** A suggestion belongs to the same writable review scope and the exact facts the author selected. */
export function captureReviewDraft(context: ReviewDraftContext): ReviewDraftCapture {
  if (context.category !== 'REVIEW') throw new Error('후기에서 작성 초안을 만들 수 있어요.');
  assertMemberRecordWriteAccess(context.state, context.viewerId, context.groupId, context.activityId);
  return { viewerId: context.viewerId, groupId: context.groupId, activityId: context.activityId,
    facts: selectReviewDraftFacts(context.state, context.viewerId, context.groupId, context.activityId) };
}

export function isReviewDraftCurrent(context: ReviewDraftContext, capture: ReviewDraftCapture): boolean {
  if (context.category !== 'REVIEW' || context.viewerId !== capture.viewerId || context.groupId !== capture.groupId || context.activityId !== capture.activityId) return false;
  try { return JSON.stringify(captureReviewDraft(context).facts) === JSON.stringify(capture.facts); }
  catch { return false; }
}

/** The configured application server receives only the explicitly previewed review facts. */
export function generateScopedReviewDraft(endpoint: string, userId: string, facts: ReviewDraftFacts, signal: AbortSignal) {
  const request: ScopedAiRequest = { schemaVersion: 1, requestId: createAiRequestId(), feature: 'REVIEW_DRAFT',
    scope: { userId, groupId: facts.scope.groupId, roomId: facts.scope.activityId ? `activity:${facts.scope.activityId}` : `group:${facts.scope.groupId}` },
    payload: { facts } };
  return postScopedAiJson(endpoint, request, signal, value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('AI 후기 초안의 형식을 확인하지 못했어요.');
    const row = value as Record<string, unknown>;
    if (Object.keys(row).some(key => key !== 'title' && key !== 'body') || typeof row.title !== 'string' || !row.title.trim() || row.title.length > 120 || typeof row.body !== 'string' || !row.body.trim() || row.body.length > 12000) throw new Error('AI 후기 초안의 제목과 내용을 확인하지 못했어요.');
    return { title: row.title.trim(), body: row.body.trim() };
  });
}
