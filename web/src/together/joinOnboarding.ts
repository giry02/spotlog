import { isMember, type TogetherState } from './model.ts';

/** Produced only after an explicit successful direct-join transaction; page-memory UI, not an application. */
export interface DirectJoinEntry { accountId: string; groupId: string; token: string }

/** Public joining has an existing receipt; this is a read-only first-entry hint. */
export function selectJoinOnboarding(state: TogetherState, accountId: string, groupId: string, directEntry?: DirectJoinEntry | null) {
  const group = state.groups.find(item => item.id === groupId);
  if (!group || group.archived || group.spaceType === 'ACTIVITY' || !isMember(state, accountId, groupId) || group.blockedMemberIds?.includes(accountId)) return null;
  if (directEntry?.accountId === accountId && directEntry.groupId === groupId && typeof directEntry.token === 'string' && directEntry.token.trim()) {
    return { key: `direct:${accountId}:${groupId}:${directEntry.token}`, mode: 'DIRECT' as const };
  }
  const receipt = state.applications.filter(item => item.groupId === groupId && item.userId === accountId && item.status === 'APPROVED')
    .sort((a, b) => (b.decidedAt || b.createdAt || '').localeCompare(a.decidedAt || a.createdAt || ''))[0];
  return receipt ? { key: `${accountId}:${groupId}:${receipt.id}:${receipt.decidedAt || receipt.createdAt || ''}`, mode: receipt.joinMode === 'DIRECT' ? 'DIRECT' as const : 'APPROVAL' as const } : null;
}

export function selectPendingMemberships(state: TogetherState, accountId: string) {
  if (!accountId) return [];
  return state.applications.filter(item => item.userId === accountId && item.status === 'PENDING')
    .filter(item => { const group = state.groups.find(value => value.id === item.groupId); return !group?.memberIds.includes(accountId) && !group?.blockedMemberIds?.includes(accountId); })
    .map(application => {
      const group = state.groups.find(item => item.id === application.groupId);
      const publicNow = group && !group.archived && group.visibility === 'PUBLIC' && group.promotionPublished && group.spaceType !== 'ACTIVITY';
      return { id: application.id, groupId: application.groupId, title: publicNow ? group.name : '공개가 종료된 모임', publicNow: Boolean(publicNow) };
    });
}
