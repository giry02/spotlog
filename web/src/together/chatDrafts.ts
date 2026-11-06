import { isChatStickerId } from './chatExpressions.ts';
import { roomIdForActivity, roomIdForGroup, type TogetherState } from './model.ts';

export interface ChatComposerDraft { body: string; stickerId: string; replyToMessageId: string }
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
    return roomId === roomIdForGroup(groupId) || state.activities.some(item => item.groupId === groupId && roomIdForActivity(item.id) === roomId);
  };
  return {
    activate: userId => { if (userId !== activeUser) { drafts.clear(); activeUser = userId; } },
    reconcile: (state, userId) => {
      if (userId !== activeUser) return;
      for (const [id, entry] of drafts) if (!allowed({ state, userId, groupId: entry.groupId, roomId: entry.roomId })) drafts.delete(id);
    },
    read: context => {
      if (!allowed(context)) { drafts.delete(key(context)); return emptyChatDraft(); }
      return { ...(drafts.get(key(context))?.draft ?? emptyChatDraft()) };
    },
    write: (context, draft) => {
      if (!allowed(context)) { drafts.delete(key(context)); return false; }
      if (typeof draft.body !== 'string' || draft.body.length > 4000 || typeof draft.replyToMessageId !== 'string'
        || typeof draft.stickerId !== 'string' || (draft.stickerId !== '' && !isChatStickerId(draft.stickerId))) return false;
      if (!draft.body && !draft.stickerId && !draft.replyToMessageId) drafts.delete(key(context));
      else drafts.set(key(context), { groupId: context.groupId, roomId: context.roomId,
        draft: { body: draft.body, stickerId: draft.stickerId, replyToMessageId: draft.replyToMessageId } });
      return true;
    },
    clear: context => { if (allowed(context)) drafts.delete(key(context)); },
  };
}

// One active account per page. Leaving the Together section does not discard room drafts.
export const pageChatDraftMemory = createChatDraftMemory();
