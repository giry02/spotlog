import type { ConversationInboxItem } from './conversationInbox.ts';

export type ConversationInboxFilter = 'ALL' | 'GROUP' | 'ACTIVITY' | 'UNREAD';
/** Page-memory navigation state only. Never persist a user's private search to another account's store. */
export interface ConversationInboxViewState {
  actorId: string; query: string; filter: ConversationInboxFilter; scrollTop: number;
}
const filters: ReadonlyArray<string> = ['ALL', 'GROUP', 'ACTIVITY', 'UNREAD'];
export const createConversationInboxView = (actorId: string): ConversationInboxViewState => ({ actorId, query: '', filter: 'ALL', scrollTop: 0 });

/** Rendering is synchronously actor-bound, including the render before an account-reset effect runs. */
export function resolveConversationInboxView(view: ConversationInboxViewState | undefined, actorId: string): ConversationInboxViewState {
  if (!view || view.actorId !== actorId) return createConversationInboxView(actorId);
  return { actorId, query: typeof view.query === 'string' ? view.query : '',
    filter: filters.includes(view.filter) ? view.filter : 'ALL',
    scrollTop: Number.isFinite(view.scrollTop) ? Math.max(0, view.scrollTop) : 0 };
}

/** Reject late updates from an old account rather than activating that account's view again. */
export function acceptConversationInboxView(current: ConversationInboxViewState, activeActorId: string, next: ConversationInboxViewState): ConversationInboxViewState {
  if (next.actorId !== activeActorId) return resolveConversationInboxView(current, activeActorId);
  return resolveConversationInboxView(next, activeActorId);
}

export function filterConversationInbox(rooms: ReadonlyArray<ConversationInboxItem>, view: Pick<ConversationInboxViewState, 'query' | 'filter'>) {
  const query = view.query.trim().toLocaleLowerCase('ko-KR');
  return rooms.filter(room => (!query || `${room.title} ${room.groupName}`.toLocaleLowerCase('ko-KR').includes(query))
    && (view.filter === 'ALL' || (view.filter === 'UNREAD' ? room.unread > 0 : room.type === view.filter)));
}
