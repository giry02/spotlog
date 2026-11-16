import type { TogetherState } from './model.ts';

// Existing authored synthetic scenery, not portraits or evidence of any real person. No supplied private image is reused.
const examples: Record<string, { name: string; photo: string; groupId: string }> = {
  'example-parent': { name: '엄마', photo: 'coastal-walking', groupId: 'family-busan' },
  'example-sibling': { name: '지우', photo: 'neighborhood-bookclub', groupId: 'family-busan' },
  'example-friend': { name: '도윤', photo: 'cafe-conversation', groupId: 'weekend-walk' },
  'example-applicant': { name: '여행 친구', photo: 'friends-shared-meal', groupId: 'family-busan' },
};
export function exampleMemberAvatar(memberId: string, base = import.meta.env?.BASE_URL ?? '/'): string {
  const item = Object.hasOwn(examples, memberId) ? examples[memberId] : undefined;
  return item ? `${base.replace(/\/?$/, '/')}media/groups/${item.photo}-20261109.jpg` : '';
}
/** One-time upgrade restricted to the bundled review account and its known fictional identities. */
export function hydrateExampleMemberAvatars(state: TogetherState, accountId: string): TogetherState {
  if (accountId !== 'spotlog-local-review-member' || state.exampleMemberAvatarVersion === 1
    || !state.groups.some(group => group.id === 'family-busan' && group.ownerId === accountId && group.memberIds.includes(accountId))) return state;
  const next = structuredClone(state);
  for (const member of next.members) {
    const item = Object.hasOwn(examples, member.id) ? examples[member.id] : undefined;
    if (!item || member.name !== item.name || Object.hasOwn(member, 'avatar') || !next.groups.some(group => group.id === item.groupId)) continue;
    member.avatar = exampleMemberAvatar(member.id);
  }
  next.exampleMemberAvatarVersion = 1;
  return next;
}
