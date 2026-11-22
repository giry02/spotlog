import { canReadChatDigest, chatDigestSelectionKey, projectChatDigest, type ChatDigestContext, type ChatDigestFilters, type ChatDigestSnapshot } from './chatDigest.ts';
import { parseChatAiSummaryOutput, projectChatAiRequest, type ChatAiSummaryPurpose, type ChatAiSummarySnapshot } from './chatAiSummary.ts';
import type { TogetherState } from './model.ts';

export interface ChatSummaryTaskDraft { section: number; item: number; title: string; assignSelf: boolean }
export interface ChatSummaryViewState {
  mode: 'ai' | 'originals';
  purpose: ChatAiSummaryPurpose;
  filters: ChatDigestFilters;
  originals: ChatDigestSnapshot | null;
  ai: ChatAiSummarySnapshot | null;
  taskDraft: ChatSummaryTaskDraft | null;
  savedTaskItems: string[];
  limit: number;
  conditionsOpen: boolean;
  scrollTop: number;
}
export interface ChatSummaryMemory {
  activate(userId: string): void;
  reconcile(state: TogetherState, userId: string): void;
  read(context: ChatDigestContext): ChatSummaryViewState | undefined;
  write(context: ChatDigestContext, state: ChatSummaryViewState): boolean;
  has(context: ChatDigestContext): boolean;
  clear(context: ChatDigestContext): void;
}

/** The host owns this page memory. Private text never enters browser storage. */
export function createChatSummaryMemory(): ChatSummaryMemory {
  let actor = '';
  const rooms = new Map<string, { groupId: string; roomId: string; view: ChatSummaryViewState }>();
  const key = (context: Pick<ChatDigestContext, 'groupId' | 'roomId'>) => JSON.stringify([context.groupId, context.roomId]);
  const allowed = (context: ChatDigestContext) => Boolean(actor && actor === context.userId && canReadChatDigest(context));
  const validView = (context: ChatDigestContext, view: ChatSummaryViewState) => {
    const next = structuredClone(view);
    if (next.originals) {
      try {
        const projected = projectChatDigest(context, next.originals);
        if (projected.forbidden || projected.removedCount || chatDigestSelectionKey(next.filters, context.unreadAfter)
          !== chatDigestSelectionKey(next.originals.filters, next.originals.unreadAfter)) next.originals = null;
      } catch { next.originals = null; }
    }
    if (next.ai) {
      try {
        if (!projectChatAiRequest(context, next.ai.request, next.filters, next.purpose).available) next.ai = null;
        else next.ai.output = parseChatAiSummaryOutput(next.ai.output, next.ai.request);
      } catch { next.ai = null; }
    }
    if (!next.ai) { next.taskDraft = null; next.savedTaskItems = []; }
    else {
      const prefix = next.ai.request.requestId + ':';
      next.savedTaskItems = [...new Set(next.savedTaskItems.filter(item => item.startsWith(prefix)))].slice(0, 40);
      if (next.taskDraft && !next.ai.output.sections[next.taskDraft.section]?.items[next.taskDraft.item]) next.taskDraft = null;
    }
    return next;
  };
  const read = (context: ChatDigestContext) => {
    const id = key(context);
    if (context.userId !== actor) return undefined;
    if (!allowed(context)) { rooms.delete(id); return undefined; }
    const entry = rooms.get(id);
    if (!entry) return undefined;
    const view = validView(context, entry.view);
    entry.view = view;
    return structuredClone(view);
  };
  return {
    activate(userId) {
      if (actor !== userId) { rooms.clear(); actor = userId; }
    },
    reconcile(state, userId) {
      if (actor !== userId) return;
      for (const entry of rooms.values()) read({ state, userId, groupId: entry.groupId, roomId: entry.roomId,
        unreadAfter: entry.view.ai?.request.payload.unreadAfter ?? entry.view.originals?.unreadAfter });
    },
    read,
    has(context) { const view = read(context); return Boolean(view?.ai || view?.originals); },
    write(context, view) {
      if (!allowed(context)) return false;
      const id = key(context);
      const safe = validView(context, view);
      safe.scrollTop = Number.isFinite(safe.scrollTop) ? Math.max(0, safe.scrollTop) : 0;
      safe.limit = Number.isInteger(safe.limit) ? Math.max(12, Math.min(300, safe.limit)) : 12;
      if (safe.originals && (safe.originals.sources.length > 300 || safe.originals.sources.reduce((sum, source) => sum + source.body.length, 0) > 60000)) safe.originals = null;
      rooms.delete(id);
      rooms.set(id, { groupId: context.groupId, roomId: context.roomId, view: safe });
      if (rooms.size > 6) rooms.delete(rooms.keys().next().value!);
      return true;
    },
    clear(context) { if (allowed(context)) rooms.delete(key(context)); },
  };
}
