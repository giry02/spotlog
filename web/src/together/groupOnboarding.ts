import type { PublicActivityIntent, TogetherState } from './model.ts';
import { approveGroupApplication, togetherId } from './model.ts';
import { validateGroupCreationDraft, type GroupCreationDraft } from './groupCreation.ts';
import { normalizeGroupJoinFields, validateGroupJoinDraft, type GroupJoinDraft } from './groupJoining.ts';
import { discoveryProfile } from './discovery.ts';
import { joinPublicGroup, requestGroupApplication } from './publicActivityIntent.ts';

/** One final write, after reviewing the editable form. Never publishes or creates a second group. */
export function createConfiguredGroup(state: TogetherState, userId: string, input: GroupCreationDraft, at = new Date()): string {
  if (!userId || !state.members.some(member => member.id === userId)) throw new Error('로그인 후 모임을 만들어 주세요.');
  const value = validateGroupCreationDraft(input), id = togetherId('group');
  state.groups.push({ id, name: value.name, kind: value.kind, region: value.region, introduction: value.introduction, cover: '',
    visibility: 'PRIVATE', ownerId: userId, memberIds: [userId], managerIds: [], archived: false, promotionPublished: false,
    createdAt: at.toISOString(), sourceKind: 'LOCAL', joinFields: value.joinFields,
    discovery: { topics: value.topics, subtopics: value.subcategoryIds, district: value.district, style: 'NEIGHBORHOOD', recruitment: 'PAUSED',
      joinMode: value.joinMode, welcome: value.joinFields.welcome, joinGuide: '' } });
  return id;
}

/** Called inside the repository transaction, keeping membership, answers and selected public event together. */
export function joinGroupWithProfile(state: TogetherState, groupId: string, userId: string, input: GroupJoinDraft, expectedVersion: string, intent?: PublicActivityIntent, at = new Date()): boolean {
  const group = state.groups.find(item => item.id === groupId);
  if (!group) throw new Error('모임을 다시 확인해 주세요.');
  const fields = normalizeGroupJoinFields(group.joinFields), profile = validateGroupJoinDraft(input, fields);
  if (discoveryProfile(group).joinMode === 'DIRECT') {
    const joined = !group.memberIds.includes(userId);
    joinPublicGroup(state, groupId, userId, expectedVersion, intent, at);
    // A repeated confirmation never overwrites an existing member's profile.
    if (joined) group.memberProfiles = { ...group.memberProfiles, [userId]: structuredClone(profile) };
    return joined;
  }
  const alreadyPending = state.applications.some(item => item.groupId === groupId && item.userId === userId && item.status === 'PENDING');
  const application = requestGroupApplication(state, groupId, userId, profile.introduction, intent, at, expectedVersion);
  if (!alreadyPending) {
    application.joinProfile = structuredClone(profile);
    application.joinQuestions = structuredClone(fields.questions);
  }
  return false;
}

export function approveGroupWithProfile(state: TogetherState, applicationId: string, actorId: string): void {
  const application = state.applications.find(item => item.id === applicationId);
  const alreadyApproved = application?.status === 'APPROVED';
  approveGroupApplication(state, applicationId, actorId);
  if (alreadyApproved || !application?.joinProfile) return;
  const group = state.groups.find(item => item.id === application.groupId)!;
  const profile = structuredClone(application.joinProfile);
  profile.answers = profile.answers.map(answer => ({ ...answer, question: answer.question || application.joinQuestions?.find(item => item.id === answer.questionId)?.label }));
  group.memberProfiles = { ...group.memberProfiles, [application.userId]: profile };
}
