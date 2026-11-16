import type { GroupMemberPresentation, TogetherState } from './model.ts';
import { assertMemberRecordWriteAccess, selectMemberRecords } from './memberRecords.ts';
import { isSafeTogetherImageUrl } from './contentMedia.ts';

export interface MemberPresentationInput extends GroupMemberPresentation { avatar: string }
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const safeId = (value: string) => Boolean(value.trim()) && value === value.trim() && value.length <= 300 && !/[\u0000-\u001f\u007f]/u.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value);
export function isGroupMemberPresentation(value: unknown): value is GroupMemberPresentation {
  return object(value) && Object.keys(value).length === 2 && Object.keys(value).every(key => ['nickname', 'introduction'].includes(key))
    && typeof value.nickname === 'string' && value.nickname.length <= 40 && !/[\u0000-\u001f\u007f]/u.test(value.nickname)
    && typeof value.introduction === 'string' && value.introduction.length <= 600 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value.introduction);
}
export function isGroupMemberPresentations(value: unknown): value is Record<string, GroupMemberPresentation> {
  return object(value) && Object.keys(value).length <= 1000 && Object.entries(value).every(([id, profile]) => safeId(id) && isGroupMemberPresentation(profile));
}

/** Shared identity is allowlisted. Joining introductions/answers and account contact data never enter this projection. */
export function selectMemberProfile(state: TogetherState, viewerId: string, groupId: string, authorId: string, activityId?: string) {
  const records = selectMemberRecords(state, viewerId, groupId, authorId, activityId);
  if (!records) return null;
  const group = state.groups.find(item => item.id === groupId)!;
  const presentation = group.memberPresentations?.[authorId];
  const postPhotos = records.posts.flatMap(post => (post.attachments || []).filter(photo => isSafeTogetherImageUrl(photo.url)).map(photo => ({
    id: `post:${post.id}:${photo.id}`, recordId: post.id, url: photo.url, caption: photo.caption || post.title, createdAt: post.createdAt,
  }))).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { identity: { id: authorId, name: records.identity.name, avatar: records.identity.avatar, role: records.identity.role,
    introduction: isGroupMemberPresentation(presentation) ? presentation.introduction : '' }, groupName: group.name,
    isOwn: viewerId === authorId,
    canEdit: viewerId === authorId && !group.archived && (!activityId || state.activities.find(item => item.id === activityId)?.status !== 'CANCELLED'),
    counts: { journals: records.journals.length, media: records.media.length + postPhotos.length, posts: records.posts.length, comments: records.comments.length, activities: records.activities.length },
    postPhotos };
}

/** Call inside the account repository transaction. No joining profile, other member or personal library is rewritten. */
export function updateOwnMemberPresentation(state: TogetherState, actorId: string, groupId: string, input: MemberPresentationInput, activityId?: string): void {
  assertMemberRecordWriteAccess(state, actorId, groupId, activityId);
  if (!safeId(actorId) || !object(input) || Object.keys(input).length !== 3 || !Object.keys(input).every(key => ['nickname', 'introduction', 'avatar'].includes(key))
    || !isGroupMemberPresentation({ nickname: input.nickname, introduction: input.introduction }) || typeof input.avatar !== 'string'
    || input.avatar && !isSafeTogetherImageUrl(input.avatar)) throw new Error('사진과 모임 이름표·소개를 다시 확인해 주세요.');
  const group = state.groups.find(item => item.id === groupId)!, member = state.members.find(item => item.id === actorId)!;
  group.memberPresentations = { ...group.memberPresentations, [actorId]: { nickname: input.nickname.trim(), introduction: input.introduction.trim() } };
  if (input.avatar) member.avatar = input.avatar; else delete member.avatar;
}
