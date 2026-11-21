import { togetherId, type TogetherPhotoAttachment, type TogetherPost, type TogetherState } from './model.ts';
import { discoveryProfile, isDiscoverableGroup, publicActivities } from './discovery.ts';
import { assertMemberRecordWriteAccess, selectMemberRecords } from './memberRecords.ts';
import { isPublicReviewPreview, isSafeTogetherImageUrl, isTogetherPhotoAttachments } from './contentMedia.ts';
import { updateOwnMemberPresentation } from './memberProfile.ts';
import { resolveRoomIdentity, roomProfileEditorValues } from './roomIdentity.ts';

export interface ReviewDraftFacts {
  scope: { groupId: string; activityId?: string; name: string };
  activities: { id: string; title: string; date: string; endDate: string; status: string }[];
  ownReviews: { id: string; title: string; body: string }[];
}
/** Exact room facts only. No chat, attendance, route, meeting point or another member's private text. */
export function selectReviewDraftFacts(state: TogetherState, actorId: string, groupId: string, activityId?: string): ReviewDraftFacts {
  const records = selectMemberRecords(state, actorId, groupId, actorId, activityId);
  if (!records) throw new Error('현재 모임원만 이 공간의 기록으로 초안을 만들 수 있어요.');
  const group = state.groups.find(item => item.id === groupId)!;
  const activity = activityId ? state.activities.find(item => item.id === activityId && item.groupId === groupId) : undefined;
  return { scope: { groupId, ...(activityId ? { activityId } : {}), name: activity?.title || group.name },
    activities: activity ? [{ id: activity.id, title: activity.title, date: activity.date, endDate: activity.endDate, status: activity.status }] : [],
    ownReviews: records.posts.filter(item => item.category === 'REVIEW').slice(0, 5).map(item => ({ id: item.id, title: item.title.slice(0, 120), body: item.body.slice(0, 1600) })) };
}

/** This is an editable factual template, deliberately never presented as an AI result. */
export function createFactualReviewDraft(facts: ReviewDraftFacts): { title: string; body: string } {
  const lines = facts.activities.map(item => `약속: ${item.title}${item.date ? `\n일정: ${item.date}${item.endDate && item.endDate !== item.date ? ` ~ ${item.endDate}` : ''}` : ''}`);
  return { title: `${facts.scope.name} 후기`.slice(0, 120), body: `${lines.length ? lines.join('\n\n') : `모임: ${facts.scope.name}`}\n\n기억에 남은 순간\n\n다음에 함께하고 싶은 것\n` };
}

export interface GroupPostInput { title: string; body: string; category: TogetherPost['category']; attachments: TogetherPhotoAttachment[]; publicExcerpt?: string }
/** A failed write leaves the draft unchanged; call only inside the existing repository mutation. */
export function addGroupPost(state: TogetherState, actorId: string, groupId: string, input: GroupPostInput, activityId?: string): string {
  assertMemberRecordWriteAccess(state, actorId, groupId, activityId);
  const title = input.title.trim(), body = input.body.trim();
  if (!title || title.length > 120 || body.length > 12000 || !['FREE', 'QUESTION', 'REVIEW', 'NOTICE'].includes(input.category)) throw new Error('제목과 내용을 확인해 주세요.');
  if (!isTogetherPhotoAttachments(input.attachments)) throw new Error('사진은 4장까지, 저장 용량 합계 2MB 이내로 올릴 수 있어요.');
  const group = state.groups.find(item => item.id === groupId)!;
  if (input.category === 'NOTICE' && actorId !== group.ownerId && !group.managerIds.includes(actorId)) throw new Error('공지는 모임장과 운영진만 작성할 수 있어요.');
  const publicExcerpt = input.publicExcerpt?.trim();
  if (publicExcerpt && (input.category !== 'REVIEW' || !isDiscoverableGroup(group) || publicExcerpt.length > 240)) throw new Error('공개 모집 중인 모임의 후기만 소개에 공개할 수 있어요.');
  const createdAt = new Date().toISOString(), id = togetherId('post');
  state.posts.push({ id, groupId, ...(activityId ? { activityId } : {}), authorId: actorId, title, body, category: input.category, createdAt,
    likes: [], comments: [], ...(input.attachments.length ? { attachments: structuredClone(input.attachments) } : {}),
    ...(publicExcerpt ? { publicPreview: { title, excerpt: publicExcerpt, publishedAt: createdAt } } : {}) });
  return id;
}

export function setOwnMemberAvatar(state: TogetherState, actorId: string, groupId: string, avatar: string, activityId?: string): void {
  const current = roomProfileEditorValues(state, actorId, groupId, activityId);
  updateOwnMemberPresentation(state, actorId, groupId, { ...current, avatar }, activityId);
}

/** Authors can withdraw their own public excerpt even after leaving; managers can moderate this group's excerpt. */
export function withdrawPublicReviewPreview(state: TogetherState, actorId: string, postId: string): void {
  const post = state.posts.find(item => item.id === postId), group = state.groups.find(item => item.id === post?.groupId);
  const activeManager = Boolean(group?.memberIds.includes(actorId) && !group.blockedMemberIds?.includes(actorId) && (group.ownerId === actorId || group.managerIds.includes(actorId)));
  if (!actorId || !post || !state.members.some(item => item.id === actorId) || post.authorId !== actorId && !activeManager) throw new Error('내 후기 또는 관리하는 모임의 공개 요약만 내릴 수 있어요.');
  delete post.publicPreview;
}

export function changeGroupRole(state: TogetherState, actorId: string, groupId: string, memberId: string, role: 'MEMBER' | 'MANAGER' | 'OWNER'): void {
  const group = state.groups.find(item => item.id === groupId);
  if (!actorId || !group || group.archived || group.ownerId !== actorId || !group.memberIds.includes(actorId) || group.blockedMemberIds?.includes(actorId) || !state.members.some(item => item.id === actorId)) throw new Error('모임장만 운영진을 임명하거나 모임장을 위임할 수 있어요.');
  if (memberId === actorId || !group.memberIds.includes(memberId) || group.blockedMemberIds?.includes(memberId) || !state.members.some(item => item.id === memberId)) throw new Error('현재 참여 중인 다른 모임원을 선택해 주세요.');
  if (!['MEMBER', 'MANAGER', 'OWNER'].includes(role)) throw new Error('역할을 확인해 주세요.');
  if (role === 'OWNER') { group.ownerId = memberId; group.managerIds = group.managerIds.filter(id => id !== memberId); }
  else group.managerIds = role === 'MANAGER' ? [...new Set([...group.managerIds, memberId])] : group.managerIds.filter(id => id !== memberId);
}

export function selectGroupMembers(state: TogetherState, viewerId: string, groupId: string, activityId?: string) {
  const group = state.groups.find(item => item.id === groupId);
  if (!viewerId || !group?.memberIds.includes(viewerId) || group.blockedMemberIds?.includes(viewerId) || !state.members.some(item => item.id === viewerId)) return null;
  if (activityId && !state.activities.some(item => item.id === activityId && item.groupId === groupId)) return null;
  const canReadProfiles = group.ownerId === viewerId || group.managerIds.includes(viewerId);
  return group.memberIds.filter(id => !group.blockedMemberIds?.includes(id)).flatMap(id => {
    const member = state.members.find(item => item.id === id); if (!member) return [];
    return [{ id, ...resolveRoomIdentity(state, id, groupId, activityId),
      role: group.ownerId === id ? '모임장' : group.managerIds.includes(id) ? '운영진' : '모임원', introduction: id === viewerId || canReadProfiles ? group.memberProfiles?.[id]?.introduction || '' : '', sharedIntroduction: roomProfileEditorValues(state, id, groupId, activityId).introduction }];
  });
}

/** Public introduction is an allowlist. Reviews appear only with a separate author-approved public excerpt. */
export function selectPublicGroupIntroduction(state: TogetherState, groupId: string, viewerId = '') {
  const group = state.groups.find(item => item.id === groupId);
  if (!group || !isDiscoverableGroup(group) || viewerId && group.blockedMemberIds?.includes(viewerId)) return null;
  const profile = discoveryProfile(group);
  const reviews = state.posts.filter(item => item.groupId === groupId && item.category === 'REVIEW' && group.memberIds.includes(item.authorId) && !group.blockedMemberIds?.includes(item.authorId) && isPublicReviewPreview(item.publicPreview))
    .map(item => ({ title: item.publicPreview!.title, excerpt: item.publicPreview!.excerpt, publishedAt: item.publicPreview!.publishedAt }))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return { id: group.id, name: group.name, cover: isSafeTogetherImageUrl(group.cover) ? group.cover : '', introduction: group.introduction,
    region: group.region, district: profile.district, ...(profile.neighborhood !== undefined ? { neighborhood: profile.neighborhood } : {}), welcome: profile.welcome, joinGuide: profile.joinGuide, topics: [...profile.topics], example: group.sourceKind === 'EXAMPLE',
    memberCount: group.memberIds.filter(id => !group.blockedMemberIds?.includes(id)).length, recruitment: profile.recruitment, joinMode: profile.joinMode,
    publishedActivityCount: publicActivities(state, group).length, publicReviewCount: reviews.length, reviews: reviews.slice(0, 6) };
}
