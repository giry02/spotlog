import type { TogetherState } from '../together/model.ts';
import { isSafeTogetherImageUrl } from '../together/contentMedia.ts';
import { updateOwnMemberPresentation, type MemberPresentationInput } from '../together/memberProfile.ts';
import { canUseRoomProfiles, resolveRoomIdentity } from '../together/roomIdentity.ts';

/** This self-service picker contains active group memberships, never standalone backing spaces. */
export function ownGroupProfileChoices(state: TogetherState, actorId: string) {
  if (!actorId || !state.members.some(member => member.id === actorId)) return [];
  return state.groups.filter(group => canUseRoomProfiles(group) && !group.archived && group.memberIds.includes(actorId) && !group.blockedMemberIds?.includes(actorId))
    .map(group => ({ id: group.id, name: group.name, nickname: resolveRoomIdentity(state, actorId, group.id).name,
      cover: isSafeTogetherImageUrl(group.cover) ? group.cover : '',
      role: group.ownerId === actorId ? '모임장' : group.managerIds.includes(actorId) ? '운영진' : '모임원' }));
}

/** The captured sheet owner cannot write through another account's current session or a stale membership. */
export function updateOwnGroupProfile(state: TogetherState, currentActorId: string, capturedActorId: string, groupId: string, input: MemberPresentationInput): void {
  if (!currentActorId || currentActorId !== capturedActorId || !ownGroupProfileChoices(state, currentActorId).some(group => group.id === groupId)) {
    throw new Error('지금 가입한 모임과 내 계정을 다시 확인해 주세요.');
  }
  updateOwnMemberPresentation(state, currentActorId, groupId, input);
}
