import { isMember, memberName, roomIdForActivity, roomIdForGroup, type TogetherGroup, type TogetherMessage, type TogetherState } from './model.ts';
import { isSafeTogetherImageUrl } from './contentMedia.ts';
import type { ChatMemberMention, ChatMentionQuery } from './chatMentionTypes.ts';
export type { ChatMemberMention, ChatMentionQuery } from './chatMentionTypes.ts';

const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const safeId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 300 && value === value.trim()
  && !/[\u0000-\u001f\u007f]/u.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value);
const boundaryBefore = (body: string, start: number) => start === 0 || /[\s([{]/u.test(body[start - 1]);
const utf16Boundary = (body: string, offset: number) => offset === 0 || offset === body.length
  || !(body.charCodeAt(offset - 1) >= 0xd800 && body.charCodeAt(offset - 1) <= 0xdbff && body.charCodeAt(offset) >= 0xdc00 && body.charCodeAt(offset) <= 0xdfff);

/** Only canonical rooms and current shared members. Never searches account contacts or other groups. */
export function resolveChatMentionGroup(state: TogetherState, actorId: string, roomId: string): TogetherGroup | null {
  const activity = state.activities.find(item => roomIdForActivity(item.id) === roomId);
  const group = activity ? state.groups.find(item => item.id === activity.groupId) : state.groups.find(item => roomIdForGroup(item.id) === roomId);
  if (!group || !actorId || !state.members.some(item => item.id === actorId) || !isMember(state, actorId, group.id)
    || group.blockedMemberIds?.includes(actorId) || group.spaceType === 'ACTIVITY' && !activity) return null;
  return group;
}

/** Structural checks only: valid historical tags survive a later nickname change or departure. */
export function isChatMemberMentions(body: string, value: unknown, roomId?: string): value is ChatMemberMention[] {
  if (!Array.isArray(value) || value.length > 50 || typeof body !== 'string') return false;
  let previousEnd = -1;
  return value.every(item => {
    if (!object(item) || Object.keys(item).length !== 6 || Object.keys(item).some(key => !['groupId', 'roomId', 'userId', 'start', 'end', 'text'].includes(key))
      || !safeId(item.groupId) || !safeId(item.roomId) || !safeId(item.userId)
      || roomId !== undefined && item.roomId !== roomId
      || !(item.roomId === roomIdForGroup(item.groupId) || item.roomId.startsWith('activity:') && item.roomId.length > 'activity:'.length)
      || !Number.isInteger(item.start) || !Number.isInteger(item.end) || Number(item.start) < 0 || Number(item.end) <= Number(item.start)
      || Number(item.start) < previousEnd || Number(item.end) > body.length
      || typeof item.text !== 'string' || item.text.length < 2 || item.text.length > 121 || item.text[0] !== '@'
      || item.text !== item.text.trim() || /[\u0000-\u001f\u007f]/u.test(item.text)
      || body.slice(Number(item.start), Number(item.end)) !== item.text || !boundaryBefore(body, Number(item.start))
      || !utf16Boundary(body, Number(item.start)) || !utf16Boundary(body, Number(item.end))) return false;
    previousEnd = Number(item.end); return true;
  });
}

export interface ChatMentionCandidate { userId: string; name: string; avatar?: string; role: string }
export function selectChatMentionCandidates(state: TogetherState, actorId: string, roomId: string, query = ''): ChatMentionCandidate[] {
  const group = resolveChatMentionGroup(state, actorId, roomId);
  if (!group || group.archived || group.temporaryRoom?.closedAt || group.temporaryRoom?.expiresAt && Date.parse(group.temporaryRoom.expiresAt) <= Date.now()
    || typeof query !== 'string' || query.length > 80) return [];
  const needle = query.trim().toLocaleLowerCase();
  return group.memberIds.filter((id, index, all) => id !== actorId && all.indexOf(id) === index && !group.blockedMemberIds?.includes(id))
    .flatMap(userId => {
      const member = state.members.find(item => item.id === userId), name = memberName(state, userId, group.id).trim();
      if (!member || !name || name.length > 120 || /[\u0000-\u001f\u007f]/u.test(name) || !name.toLocaleLowerCase().includes(needle)) return [];
      return [{ userId, name, ...(isSafeTogetherImageUrl(member.avatar) ? { avatar: member.avatar } : {}),
        role: group.ownerId === userId ? '모임장' : group.managerIds.includes(userId) ? '매니저' : '모임원' }];
    });
}

/** A caret-local unfinished @ query, not an email or an already picked member. */
export function findChatMentionQuery(body: string, caret: number, mentions: readonly ChatMemberMention[] = []): ChatMentionQuery | null {
  if (typeof body !== 'string' || !Number.isInteger(caret) || caret <= 0 || caret > body.length || !utf16Boundary(body, caret)) return null;
  const start = body.lastIndexOf('@', caret - 1);
  if (start < 0 || !boundaryBefore(body, start) || mentions.some(item => item.start <= start && start < item.end)) return null;
  const query = body.slice(start + 1, caret);
  if (query.length > 80 || /[\r\n@.,!?;:<>/\\]/u.test(query)) return null;
  return { start, end: caret, query };
}

/** Keep only complete, unchanged tokens around one textarea edit. Never infer new member identities. */
export function rebaseChatMentions(before: string, after: string, mentions: readonly ChatMemberMention[] = []): ChatMemberMention[] {
  if (!isChatMemberMentions(before, mentions)) return [];
  if (before === after) return mentions.map(item => ({ ...item }));
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix += 1;
  let suffix = 0;
  while (suffix < before.length - prefix && suffix < after.length - prefix && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix += 1;
  const oldEnd = before.length - suffix, shift = after.length - before.length;
  const result = mentions.flatMap(item => item.end <= prefix ? [{ ...item }] : item.start >= oldEnd ? [{ ...item, start: item.start + shift, end: item.end + shift }] : []);
  return result.filter(item => isChatMemberMentions(after, [item]));
}

/** Freshly resolve the picked ID, preserving other unchanged tokens and leaving the caret after one space. */
export function insertChatMention(state: TogetherState, actorId: string, roomId: string, body: string, mentions: readonly ChatMemberMention[], query: ChatMentionQuery, userId: string) {
  if (!isChatMemberMentions(body, mentions, roomId)) throw new Error('태그할 멤버를 다시 선택해 주세요.');
  const current = findChatMentionQuery(body, query.end, mentions), candidate = selectChatMentionCandidates(state, actorId, roomId, query.query).find(item => item.userId === userId);
  const group = resolveChatMentionGroup(state, actorId, roomId);
  if (!current || !group || !candidate || current.start !== query.start || current.end !== query.end || current.query !== query.query) throw new Error('현재 대화방에서 태그할 멤버를 다시 선택해 주세요.');
  const text = `@${candidate.name}`, nextBody = `${body.slice(0, query.start)}${text} ${body.slice(query.end)}`;
  if (nextBody.length > 4000 || mentions.length >= 50) throw new Error('메시지는 4,000자, 멤버 태그는 50개 이내로 적어 주세요.');
  const nextMentions = [...rebaseChatMentions(body, nextBody, mentions), { groupId: group.id, roomId, userId, start: query.start, end: query.start + text.length, text }]
    .sort((a, b) => a.start - b.start);
  if (!isChatMemberMentions(nextBody, nextMentions, roomId)) throw new Error('태그할 멤버를 다시 선택해 주세요.');
  return { body: nextBody, mentions: nextMentions, caret: query.start + text.length + 1 };
}

/** Canonical send guard; no @text parsing, contacts lookup, notification or RSVP side effects. */
export function prepareChatMentionsForSend(state: TogetherState, actorId: string, roomId: string, body: string, mentions?: readonly ChatMemberMention[]): ChatMemberMention[] {
  if (mentions === undefined) return [];
  const group = resolveChatMentionGroup(state, actorId, roomId);
  if (!group || !isChatMemberMentions(body, mentions, roomId)) throw new Error('현재 대화방의 멤버 태그를 다시 선택해 주세요.');
  const candidates = selectChatMentionCandidates(state, actorId, roomId);
  for (const item of mentions) {
    const candidate = candidates.find(member => member.userId === item.userId);
    if (item.groupId !== group.id || !candidate || item.text !== `@${candidate.name}`) throw new Error('이름이나 참여 상태가 바뀐 멤버 태그를 다시 선택해 주세요.');
  }
  const leading = body.length - body.trimStart().length, text = body.trim();
  const result = mentions.map(item => ({ ...item, start: item.start - leading, end: item.end - leading }));
  if (!isChatMemberMentions(text, result, roomId)) throw new Error('멤버 태그 위치를 다시 확인해 주세요.');
  return result;
}

/** Historical text is retained, but links only resolve current members of the exact readable room. */
export function selectReadableChatMentions(state: TogetherState, actorId: string, roomId: string, message: TogetherMessage): ChatMemberMention[] {
  const group = resolveChatMentionGroup(state, actorId, roomId), originals = state.messages.filter(item => item.id === message.id);
  const current = originals.length === 1 && originals[0].roomId === roomId && !originals[0].deleted ? originals[0] : undefined;
  if (!group || !current || current.body !== message.body || !isChatMemberMentions(current.body, current.mentions, roomId)) return [];
  return current.mentions.filter(item => item.groupId === group.id && group.memberIds.includes(item.userId) && !group.blockedMemberIds?.includes(item.userId)
    && state.members.some(member => member.id === item.userId)).map(item => ({ ...item }));
}
