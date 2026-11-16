import { isChatStickerId } from './chatExpressionContract.ts';
import { roomIdForActivity, roomIdForGroup, type TogetherState } from './model.ts';
import { isChatMemberMentions, resolveChatMentionGroup, type ChatMemberMention } from './chatMentions.ts';

export interface ChatComposerDraft { body: string; stickerId: string; replyToMessageId: string; mentions?: ChatMemberMention[] }
export interface ChatDraftContext { state: TogetherState; userId: string; groupId: string; roomId: string }
export const emptyChatDraft = (): ChatComposerDraft => ({ body: '', stickerId: '', replyToMessageId: '' });
export interface ChatDraftMemory {
  activate(userId: string): void;
  reconcile(state: TogetherState, userId: string): void;
  read(context: ChatDraftContext): ChatComposerDraft;
  write(context: ChatDraftContext, draft: ChatComposerDraft): boolean;
  clear(context: ChatDraftContext): void;
}

/** Private composer state only. This module never reads or writes browser/device storage. */
export function createChatDraftMemory(): ChatDraftMemory {
  let activeUser = '';
  const drafts = new Map<string, { groupId: string; roomId: string; draft: ChatComposerDraft }>();
  const key = ({ userId, groupId, roomId }: ChatDraftContext) => JSON.stringify([userId, groupId, roomId]);
  const allowed = ({ state, userId, groupId, roomId }: ChatDraftContext) => {
    const group = state.groups.find(item => item.id === groupId);
    if (!userId || userId !== activeUser || !group?.memberIds.includes(userId) || group.blockedMemberIds?.includes(userId)) return false;
    return group.temporaryRoom?.disposition !== 'TRASH' && (group.spaceType !== 'ACTIVITY' && roomId === roomIdForGroup(groupId)
      || state.activities.some(item => item.groupId === groupId && roomIdForActivity(item.id) === roomId));
  };
  return {
    activate: userId => { if (userId !== activeUser) { drafts.clear(); activeUser = userId; } },
    reconcile: (state, userId) => {
      if (userId !== activeUser) return;
      for (const [id, entry] of drafts) if (!allowed({ state, userId, groupId: entry.groupId, roomId: entry.roomId })) drafts.delete(id);
    },
    read: context => {
      if (!allowed(context)) { drafts.delete(key(context)); return emptyChatDraft(); }
      const draft = drafts.get(key(context))?.draft ?? emptyChatDraft();
      return { ...draft, ...(draft.mentions ? { mentions: draft.mentions.map(item => ({ ...item })) } : {}) };
    },
    write: (context, draft) => {
      if (!allowed(context)) { drafts.delete(key(context)); return false; }
      if (typeof draft.body !== 'string' || draft.body.length > 4000 || typeof draft.replyToMessageId !== 'string'
        || typeof draft.stickerId !== 'string' || (draft.stickerId !== '' && !isChatStickerId(draft.stickerId))
        || draft.mentions !== undefined && (!isChatMemberMentions(draft.body, draft.mentions, context.roomId)
          || resolveChatMentionGroup(context.state, context.userId, context.roomId)?.id !== context.groupId
          || draft.mentions.some(item => item.groupId !== context.groupId))) return false;
      if (!draft.body && !draft.stickerId && !draft.replyToMessageId) drafts.delete(key(context));
      else drafts.set(key(context), { groupId: context.groupId, roomId: context.roomId,
        draft: { body: draft.body, stickerId: draft.stickerId, replyToMessageId: draft.replyToMessageId,
          ...(draft.mentions?.length ? { mentions: draft.mentions.map(item => ({ ...item })) } : {}) } });
      return true;
    },
    clear: context => { if (allowed(context)) drafts.delete(key(context)); },
  };
}

// One active account per page. Leaving the Together section does not discard room drafts.
export const pageChatDraftMemory = createChatDraftMemory();
