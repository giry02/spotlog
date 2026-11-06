import type { TogetherState } from './model.ts';

export type WorkspaceView = 'DETAIL' | 'CHAT' | 'SUMMARY';
export type ScopedWorkspaceRouteContext =
  | { scope: 'GROUP'; groupId: string; view: WorkspaceView }
  | { scope: 'ACTIVITY'; groupId: string; activityId: string; view: WorkspaceView };

/** Resolves only currently readable member workspaces, never public introductions or invitation tokens. */
export function getScopedWorkspaceRouteContext(state: TogetherState, userId: string, route: string): ScopedWorkspaceRouteContext | null {
  if (!userId || typeof route !== 'string' || route.startsWith('group-invite-')) return null;
  const match = /^(group|groupchat|groupsummary|activity|activitychat|activitysummary)-([A-Za-z0-9_-]+)$/.exec(route);
  if (!match) return null;
  const [, prefix, id] = match;
  const activity = prefix.startsWith('activity') ? state.activities.find(item => item.id === id) : undefined;
  if (prefix.startsWith('activity') && !activity) return null;
  const group = state.groups.find(item => item.id === (activity?.groupId ?? id));
  if (!group || !group.memberIds.includes(userId) || group.blockedMemberIds?.includes(userId)) return null;
  const view: WorkspaceView = prefix.endsWith('chat') ? 'CHAT' : prefix.endsWith('summary') ? 'SUMMARY' : 'DETAIL';
  // Archiving/completing disables mutations, while existing members retain the read-only context.
  return activity ? { scope: 'ACTIVITY', groupId: group.id, activityId: activity.id, view }
    : { scope: 'GROUP', groupId: group.id, view };
}

/** True only for peer views in one member workspace; entering/leaving a hierarchy must preserve history. */
export function isTogetherWorkspaceSwitch(state: TogetherState, userId: string, fromRoute: string, toRoute: string): boolean {
  if (fromRoute === toRoute) return false;
  const from = getScopedWorkspaceRouteContext(state, userId, fromRoute);
  const to = getScopedWorkspaceRouteContext(state, userId, toRoute);
  if (!from || !to || from.groupId !== to.groupId || from.scope !== to.scope) return false;
  if (from.scope === 'GROUP' && to.scope === 'GROUP') return true;
  return from.scope === 'ACTIVITY' && to.scope === 'ACTIVITY' && from.activityId === to.activityId;
}
