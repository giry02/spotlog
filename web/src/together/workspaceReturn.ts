import { isMember, type TogetherState } from './model.ts';

/** Transient UI location only; never copy messages, forms or another account's place. */
export interface WorkspaceReturn {
  accountId: string; groupId: string; activityId?: string; view: string; scrollTop: number;
}
const groupViews = ['home', 'activities', 'board', 'album'];
const activityViews = ['schedule', 'prep', 'record', 'album'];

export function captureWorkspaceReturn(state: TogetherState, accountId: string, groupId: string, activityId: string | undefined, view: string, scrollTop: number): WorkspaceReturn | null {
  const group = state.groups.find(item => item.id === groupId);
  if (!group || !isMember(state, accountId, groupId) || group.blockedMemberIds?.includes(accountId)) return null;
  if (activityId && !state.activities.some(item => item.id === activityId && item.groupId === groupId)) return null;
  if (!(activityId ? activityViews : groupViews).includes(view)) return null;
  return { accountId, groupId, ...(activityId ? { activityId } : {}), view, scrollTop: Number.isFinite(scrollTop) ? Math.max(0, scrollTop) : 0 };
}

export function resolveWorkspaceReturn(state: TogetherState, accountId: string, groupId: string, activityId: string | undefined, origin: WorkspaceReturn | null) {
  if (!origin || origin.accountId !== accountId || origin.groupId !== groupId || origin.activityId !== activityId) return null;
  const valid = captureWorkspaceReturn(state, accountId, groupId, activityId, origin.view, origin.scrollTop);
  return valid ? { ...valid, route: activityId ? `activity-${activityId}` : `group-${groupId}` } : null;
}

/** A direct link from Saved/Home belongs to the host's history, not a fabricated workspace tab. */
export function navigateFromChat(state: TogetherState, accountId: string, groupId: string, activityId: string | undefined, origin: WorkspaceReturn | null, actions: {
  restore: (origin: NonNullable<ReturnType<typeof resolveWorkspaceReturn>>) => void;
  onHostBack?: (fallback: string) => void;
  fallback: (view: 'schedule' | 'home') => void;
}) {
  const restored = resolveWorkspaceReturn(state, accountId, groupId, activityId, origin);
  if (restored) { actions.restore(restored); return; }
  if (actions.onHostBack) { actions.onHostBack(activityId ? `activity-${activityId}` : `group-${groupId}`); return; }
  actions.fallback(activityId ? 'schedule' : 'home');
}
