import { normalizeSocialTarget, resolveSocialTarget, type SocialTarget } from './social-target';
import { findSampleThread, SAMPLE_SOCIAL_ID_PREFIX } from './social-samples';

export const SOCIAL_STORAGE_KEY = 'spotlog-social-local-v1';
export const SOCIAL_AUTHOR = '나 · 이 기기';
export const SOCIAL_LIMITS = { comments: 300, reactions: 300, storageCharacters: 600_000 } as const;
export const SOCIAL_REACTION_LABELS = { LIKE: '좋아요', LOVE: '너무 좋아요', BEST: '최고예요', HELPFUL: '동선이 유용해요' } as const;
export type SocialReactionKind = keyof typeof SOCIAL_REACTION_LABELS;
export type SocialComment = {
  id: string; target: SocialTarget; body: string; parentId: string | null;
  createdAt: string; updatedAt: string; deletedAt: string | null;
};
export type SocialReaction = { target: SocialTarget; kind: SocialReactionKind; updatedAt: string };
export type SocialStore = { version: 1; comments: SocialComment[]; reactions: SocialReaction[] };
export type SocialAction =
  | { type: 'add-comment'; target: SocialTarget; body: string; parentId?: string }
  | { type: 'edit-comment'; id: string; body: string }
  | { type: 'delete-comment'; id: string }
  | { type: 'restore-comment'; id: string }
  | { type: 'set-reaction'; target: SocialTarget; reaction: SocialReactionKind | null };
export type SocialDependencies = { now: () => string; id: () => string };
export type SocialResult = { ok: true; store: SocialStore } | { ok: false; store: SocialStore; error: string };

export const createEmptySocialStore = (): SocialStore => ({ version: 1, comments: [], reactions: [] });
export const socialCharacterCount = (body: string) => Array.from(body).length;
const validId = (id: unknown): id is string => typeof id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/.test(id) && !['__proto__', 'prototype', 'constructor'].includes(id);
const validLocalId = (id: unknown): id is string => validId(id) && !id.startsWith(SAMPLE_SOCIAL_ID_PREFIX);
const validDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const plain = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const fields = (value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []) => Object.getOwnPropertySymbols(value).length === 0 && required.every(key => Object.hasOwn(value, key)) && Object.getOwnPropertyNames(value).every(key => required.includes(key) || optional.includes(key));
const cleanBody = (body: unknown, limit: number): string | null => {
  if (typeof body !== 'string' || body.length > limit * 2 + 2000) return null;
  const cleaned = body.replace(/\r\n?/g, '\n').trim();
  return cleaned.length > 0 && socialCharacterCount(cleaned) <= limit && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(cleaned) ? cleaned : null;
};
const targetKey = (target: SocialTarget) => resolveSocialTarget(target)?.key;
const reactionAllowed = (target: SocialTarget, kind: unknown): kind is SocialReactionKind => {
  const resolved = resolveSocialTarget(target);
  return resolved?.reactionMode === 'like' ? kind === 'LIKE' : !!resolved && (kind === 'LOVE' || kind === 'BEST' || kind === 'HELPFUL');
};

/** Strict, bounded persisted data. Rejected input must never replace the existing local value. */
export function parseSocialStore(raw: string | null): { ok: true; store: SocialStore } | { ok: false; error: string } {
  if (raw === null) return { ok: true, store: createEmptySocialStore() };
  if (typeof raw !== 'string' || raw.length > SOCIAL_LIMITS.storageCharacters) return { ok: false, error: '저장된 스레드 용량을 확인할 수 없어 읽기 전용으로 열었어요. 기존 기록은 보존됩니다.' };
  try {
    const value: unknown = JSON.parse(raw);
    if (!plain(value) || !fields(value, ['version', 'comments', 'reactions']) || value.version !== 1 || !Array.isArray(value.comments) || !Array.isArray(value.reactions) || value.comments.length > SOCIAL_LIMITS.comments || value.reactions.length > SOCIAL_LIMITS.reactions) throw new Error('store');
    const store = createEmptySocialStore();
    const ids = new Set<string>();
    for (const item of value.comments) {
      if (!plain(item) || !fields(item, ['id', 'target', 'body', 'parentId', 'createdAt', 'updatedAt', 'deletedAt'])) throw new Error('comment');
      const target = normalizeSocialTarget(item.target);
      const limit = target && resolveSocialTarget(target)?.commentLimit;
      const body = limit && cleanBody(item.body, limit);
      if (!target || !body || item.body !== body || !validLocalId(item.id) || ids.has(item.id) || (item.parentId !== null && !validId(item.parentId)) || !validDate(item.createdAt) || !validDate(item.updatedAt) || item.updatedAt < item.createdAt || (item.deletedAt !== null && (!validDate(item.deletedAt) || item.deletedAt < item.createdAt || item.deletedAt > item.updatedAt))) throw new Error('comment-value');
      ids.add(item.id);
      store.comments.push({ id: item.id, target, body, parentId: item.parentId as string | null, createdAt: item.createdAt, updatedAt: item.updatedAt, deletedAt: item.deletedAt as string | null });
    }
    for (const item of store.comments) {
      if (!item.parentId) continue;
      const parent = store.comments.find(comment => comment.id === item.parentId);
      const sampleParent = parent ? null : findSampleThread(item.target, item.parentId);
      if (parent ? parent.parentId !== null || parent.id === item.id || targetKey(parent.target) !== targetKey(item.target) || item.createdAt < parent.createdAt
        : !sampleParent || sampleParent.parentId !== null || item.createdAt < sampleParent.createdAt) throw new Error('parent');
    }
    const reactionTargets = new Set<string>();
    for (const item of value.reactions) {
      if (!plain(item) || !fields(item, ['target', 'kind', 'updatedAt'])) throw new Error('reaction');
      const target = normalizeSocialTarget(item.target);
      const key = target && targetKey(target);
      if (!target || !key || reactionTargets.has(key) || !reactionAllowed(target, item.kind) || !validDate(item.updatedAt)) throw new Error('reaction-value');
      reactionTargets.add(key);
      store.reactions.push({ target, kind: item.kind, updatedAt: item.updatedAt });
    }
    return { ok: true, store };
  } catch {
    return { ok: false, error: '저장된 스레드 형식을 확인할 수 없어 읽기 전용으로 열었어요. 기존 기록은 보존됩니다.' };
  }
}

export function selectSocialComments(store: SocialStore, target: SocialTarget): SocialComment[] {
  const key = targetKey(target);
  return key ? store.comments.filter(comment => targetKey(comment.target) === key).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)) : [];
}

export function getSocialReaction(store: SocialStore, target: SocialTarget): SocialReactionKind | null {
  const key = targetKey(target);
  return (key && store.reactions.find(item => targetKey(item.target) === key)?.kind) || null;
}

export function applySocialAction(store: SocialStore, action: SocialAction, dependencies: SocialDependencies): SocialResult {
  const fail = (error: string): SocialResult => ({ ok: false, store, error });
  if (!plain(action)) return fail('요청 형식을 확인해 주세요.');
  let raw: string;
  try { raw = JSON.stringify(store); } catch { return fail('스레드 기록 형식을 확인할 수 없어요. 기존 기록은 보존됩니다.'); }
  const verified = parseSocialStore(raw);
  if (!verified.ok) return fail(verified.error);
  let now: string;
  try { now = dependencies.now(); } catch { return fail('기기 시간을 확인할 수 없어요.'); }
  if (!validDate(now)) return fail('기기 시간을 확인해 주세요.');
  let next = verified.store;
  if (action.type === 'add-comment') {
    if (!fields(action, ['type', 'target', 'body'], ['parentId'])) return fail('댓글 요청을 확인해 주세요.');
    const target = normalizeSocialTarget(action.target);
    const resolved = target && resolveSocialTarget(target);
    if (!target || !resolved) return fail('이 장소 또는 코스를 찾을 수 없어요.');
    const body = cleanBody(action.body, resolved.commentLimit);
    if (!body) return fail(`댓글은 공백을 제외하고 1~${resolved.commentLimit}자로 입력해 주세요.`);
    if (next.comments.length >= SOCIAL_LIMITS.comments) return fail('이 기기에 저장할 수 있는 댓글 수에 도달했어요. 기존 기록은 보존됩니다.');
    let parentId: string | null = null;
    if (Object.hasOwn(action, 'parentId')) {
      if (!validId(action.parentId)) return fail('답글을 달 댓글을 확인해 주세요.');
      const parent = next.comments.find(comment => comment.id === action.parentId);
      const sampleParent = parent ? null : findSampleThread(target, action.parentId);
      if (parent ? parent.parentId || parent.deletedAt || targetKey(parent.target) !== resolved.key || now < parent.createdAt
        : !sampleParent || sampleParent.parentId !== null || now < sampleParent.createdAt) return fail('같은 스레드의 삭제되지 않은 댓글에만 답글을 달 수 있어요.');
      parentId = action.parentId;
    }
    let id: string;
    try { id = dependencies.id(); } catch { return fail('댓글 번호를 만들 수 없어요. 다시 시도해 주세요.'); }
    if (!validLocalId(id) || next.comments.some(comment => comment.id === id)) return fail('댓글 번호가 중복되었어요. 다시 시도해 주세요.');
    next = { ...next, comments: [...next.comments, { id, target, body, parentId, createdAt: now, updatedAt: now, deletedAt: null }] };
  } else if (action.type === 'set-reaction') {
    if (!fields(action, ['type', 'target', 'reaction'])) return fail('평가 요청을 확인해 주세요.');
    const target = normalizeSocialTarget(action.target);
    const key = target && targetKey(target);
    if (!target || !key || (action.reaction !== null && !reactionAllowed(target, action.reaction))) return fail('이 항목에 사용할 수 없는 평가예요.');
    const remaining = next.reactions.filter(item => targetKey(item.target) !== key);
    if (action.reaction !== null && remaining.length >= SOCIAL_LIMITS.reactions) return fail('이 기기에 저장할 수 있는 평가 수에 도달했어요. 기존 기록은 보존됩니다.');
    next = { ...next, reactions: action.reaction === null ? remaining : [...remaining, { target, kind: action.reaction, updatedAt: now }] };
  } else if (action.type === 'edit-comment' || action.type === 'delete-comment' || action.type === 'restore-comment') {
    if (!fields(action, action.type === 'edit-comment' ? ['type', 'id', 'body'] : ['type', 'id']) || !validLocalId(action.id)) return fail('댓글 요청을 확인해 주세요.');
    const comment = next.comments.find(item => item.id === action.id);
    if (!comment || now < comment.updatedAt) return fail('수정할 댓글 또는 기기 시간을 확인해 주세요.');
    if (action.type === 'edit-comment' && comment.deletedAt) return fail('삭제한 댓글은 복원한 뒤 수정해 주세요.');
    const body = action.type === 'edit-comment' ? cleanBody(action.body, resolveSocialTarget(comment.target)!.commentLimit) : comment.body;
    if (!body) return fail(`댓글은 1~${resolveSocialTarget(comment.target)!.commentLimit}자로 입력해 주세요.`);
    next = { ...next, comments: next.comments.map(item => item.id !== comment.id ? item : {
      ...item, body, updatedAt: now,
      deletedAt: action.type === 'delete-comment' ? now : action.type === 'restore-comment' ? null : item.deletedAt,
    }) };
  } else return fail('지원하지 않는 요청이에요.');
  if (JSON.stringify(next).length > SOCIAL_LIMITS.storageCharacters) return fail('이 기기의 스레드 저장 용량에 도달했어요. 기존 기록은 보존됩니다.');
  return { ok: true, store: next };
}
