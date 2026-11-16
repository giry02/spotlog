import { isChatStickerId } from './chatExpressionContract.ts';
import { prepareChatMentionsForSend, type ChatMemberMention } from './chatMentions.ts';
import { isMember, roomIdForActivity, roomIdForGroup, togetherId, type TogetherGroup, type TogetherMessage, type TogetherState } from './model.ts';

export const ALLOWED_MESSAGE_REACTIONS = Object.freeze(['👍', '❤️', '😂', '✅', '❓'] as const);
export type MessageReactionEmoji = typeof ALLOWED_MESSAGE_REACTIONS[number];

/** Resolve only canonical rooms. RSVP and personal itinerary ownership never grant chat access. */
function writableRoom(state: TogetherState, actorId: string, roomId: string): TogetherGroup {
  const activity = state.activities.find(item => roomIdForActivity(item.id) === roomId);
  const group = activity
    ? state.groups.find(item => item.id === activity.groupId)
    : state.groups.find(item => roomIdForGroup(item.id) === roomId);
  if (!group || !actorId || !state.members.some(item => item.id === actorId) || !isMember(state, actorId, group.id)
    || group.blockedMemberIds?.includes(actorId) || group.spaceType === 'ACTIVITY' && !activity) throw new Error('현재 모임원만 이 채팅을 이용할 수 있어요.');
  if (group.archived || group.temporaryRoom?.closedAt || group.temporaryRoom?.expiresAt && Date.parse(group.temporaryRoom.expiresAt) <= Date.now()) throw new Error('보관된 모임에서는 메시지와 반응을 보낼 수 없어요.');
  return group;
}

function currentMessage(state: TogetherState, roomId: string, messageId: string): TogetherMessage {
  const message = state.messages.find(item => item.id === messageId && item.roomId === roomId && !item.deleted);
  if (!message) throw new Error('이 채팅에서 사용할 수 있는 원문 메시지를 찾지 못했어요.');
  return message;
}

/** Gesture/button preparation is read-only; sending rechecks the same current original. */
export function canReplyToMessage(state: TogetherState, actorId: string, roomId: string, messageId: string): boolean {
  try {
    writableRoom(state, actorId, roomId);
    currentMessage(state, roomId, messageId);
    return true;
  } catch { return false; }
}

/** Store a reference to the original, never a copied original body or another room's message. */
export function postTogetherMessage(state: TogetherState, actorId: string, roomId: string, body: string, stickerId?: string, replyToMessageId?: string, mentions?: readonly ChatMemberMention[]): TogetherMessage {
  writableRoom(state, actorId, roomId);
  if (typeof body !== 'string') throw new Error('메시지 내용을 확인해 주세요.');
  const text = body.trim();
  if (text.length > 4000) throw new Error('메시지는 4,000자 이내로 적어 주세요.');
  if (stickerId !== undefined && !isChatStickerId(stickerId)) throw new Error('사용할 수 있는 이모티콘을 선택해 주세요.');
  if (!text && !stickerId) throw new Error('메시지나 이모티콘을 선택해 주세요.');
  if (replyToMessageId !== undefined) {
    if (typeof replyToMessageId !== 'string' || !replyToMessageId.trim()) throw new Error('답장할 원문을 다시 선택해 주세요.');
    currentMessage(state, roomId, replyToMessageId);
  }
  const validMentions = prepareChatMentionsForSend(state, actorId, roomId, body, mentions);
  const message: TogetherMessage = {
    id: togetherId('message'), roomId, authorId: actorId, body: text, createdAt: new Date().toISOString(),
    ...(stickerId !== undefined ? { stickerId } : {}),
    ...(replyToMessageId !== undefined ? { replyToMessageId } : {}),
    ...(validMentions.length ? { mentions: validMentions } : {}),
  };
  state.messages.push(message);
  return message;
}

/** Toggle only this actor's reaction, retaining other members and other reaction choices. */
export function toggleMessageReaction(state: TogetherState, actorId: string, roomId: string, messageId: string, emoji: string): TogetherMessage {
  writableRoom(state, actorId, roomId);
  if (!ALLOWED_MESSAGE_REACTIONS.some(value => value === emoji)) throw new Error('사용할 수 있는 메시지 반응을 선택해 주세요.');
  const message = currentMessage(state, roomId, messageId);
  const reactions = { ...message.reactions };
  const previous = reactions[emoji] ?? [];
  const next = previous.includes(actorId) ? previous.filter(id => id !== actorId) : [...new Set([...previous, actorId])];
  if (next.length) reactions[emoji] = next;
  else delete reactions[emoji];
  for (const key of Object.keys(reactions)) if (!reactions[key].length) delete reactions[key];
  if (Object.keys(reactions).length) message.reactions = reactions;
  else delete message.reactions;
  return message;
}
