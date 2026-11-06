import type { Journey } from '../data';

export type GroupKind = 'FAMILY' | 'FRIENDS' | 'HOBBY' | 'GUIDE';
export type GroupTopic = 'TRAVEL' | 'FOOD' | 'CAFE' | 'WALK' | 'PHOTO' | 'OUTDOOR' | 'CULTURE' | 'FAMILY' | 'SOCIAL' | 'SPORTS' | 'BOOK' | 'GAME' | 'MUSIC' | 'LANGUAGE' | 'CRAFT' | 'PETS';
export interface GroupDiscoveryProfile {
  topics: GroupTopic[]; district: string; style: 'NEIGHBORHOOD' | 'DESTINATION'; recruitment: 'OPEN' | 'PAUSED'; welcome: string; joinGuide: string;
}
export type ActivityStatus = 'PLANNED' | 'CANCELLED' | 'COMPLETED';
export type ParticipationStatus = 'JOINED' | 'MAYBE' | 'DECLINED';
export interface TogetherMember { id: string; name: string }
export interface TogetherGroup {
  id: string; name: string; kind: GroupKind; region: string; introduction: string; cover: string;
  visibility: 'PRIVATE' | 'PUBLIC'; ownerId: string; memberIds: string[]; managerIds: string[];
  archived: boolean; promotionPublished: boolean; promotionActivityIds?: string[]; interestPlaceIds?: string[]; blockedMemberIds?: string[];
  discovery?: GroupDiscoveryProfile; sourceKind?: 'EXAMPLE' | 'LOCAL' | 'SERVER';
  promotionActivitySnapshots?: GroupPublicActivitySnapshot[];
}
export interface TogetherActivity {
  id: string; groupId: string; title: string; date: string; endDate: string; meetingPoint: string;
  description: string; status: ActivityStatus; leadId: string; editorIds: string[];
  participants: Record<string, ParticipationStatus>; arrivedIds: string[]; journey?: Journey; revision: number;
  kind?: 'MEETUP' | 'TRIP'; startTime?: string; capacity?: number;
}
/** Approved public text only. Internal route, attendance and precise meeting details never belong here. */
export type GroupPublicActivitySnapshot = Pick<TogetherActivity, 'id' | 'groupId' | 'title' | 'date' | 'endDate' | 'description' | 'status' | 'kind' | 'startTime'>;
export interface TogetherMessage { id: string; roomId: string; authorId: string; body: string; createdAt: string; deleted?: boolean; stickerId?: string }
export interface TogetherNotice { id: string; groupId: string; activityId?: string; title: string; body: string; createdAt: string }
export interface TogetherTask { id: string; groupId: string; activityId?: string; title: string; assigneeId?: string; dueDate?: string; completed: boolean; sourceMessageIds?: string[] }
export interface TogetherPoll { id: string; groupId: string; activityId?: string; question: string; options: { id: string; label: string; voterIds: string[] }[]; closed: boolean; confirmedOptionId?: string }
export interface TogetherPost { id: string; groupId: string; activityId?: string; authorId: string; title: string; body: string; category: 'NOTICE' | 'REVIEW' | 'QUESTION' | 'FREE'; createdAt: string; likes: string[]; comments: { id: string; authorId: string; body: string; createdAt: string }[] }
export interface TogetherMedia { id: string; groupId: string; activityId?: string; authorId: string; url: string; kind: 'PHOTO' | 'VIDEO'; caption: string; createdAt: string }
export interface TogetherInvite { id: string; intentId: string; sourceTripId?: string; sourceJourney?: Journey; groupId?: string; senderId: string; name: string; kind: GroupKind; region: string; acceptedBy: string[]; expiresAt: string; revoked: boolean }
export interface TogetherApplication { id: string; groupId: string; userId: string; status: 'PENDING' | 'APPROVED' | 'DECLINED'; message?: string; createdAt?: string; decidedAt?: string; decidedBy?: string }
export interface TogetherSharedJournal { id: string; groupId: string; activityId?: string; authorId: string; sourceJourneyId?: string; journey: Journey }
export interface TogetherReport { id: string; targetType: 'MESSAGE' | 'POST' | 'COMMENT' | 'MEDIA'; targetId: string; groupId: string; reporterId: string; reason: string; createdAt: string }
export interface TogetherState {
  schemaVersion: 1;
  discoveryCatalogVersion?: number;
  groups: TogetherGroup[]; members: TogetherMember[]; activities: TogetherActivity[];
  messages: TogetherMessage[]; notices: TogetherNotice[]; tasks: TogetherTask[]; polls: TogetherPoll[];
  posts: TogetherPost[]; media: TogetherMedia[]; invites: TogetherInvite[]; applications: TogetherApplication[];
  sharedJournals: TogetherSharedJournal[]; readCursors: Record<string, string>; mutedRooms: string[]; reports?: TogetherReport[];
}

export const roomIdForGroup = (id: string) => `group:${id}`;
export const roomIdForActivity = (id: string) => `activity:${id}`;
export const memberName = (state: TogetherState, userId: string) => state.members.find(member => member.id === userId)?.name ?? '모임원';
export const isMember = (state: TogetherState, userId: string, groupId: string) => Boolean(userId && state.groups.find(group => group.id === groupId)?.memberIds.includes(userId));
export function canEditActivity(state: TogetherState, userId: string, activity: TogetherActivity): boolean {
  const group = state.groups.find(item => item.id === activity.groupId);
  return Boolean(group && !group.archived && group.memberIds.includes(userId) && (group.ownerId === userId || group.managerIds.includes(userId) || activity.leadId === userId || activity.editorIds.includes(userId)));
}
export function togetherId(prefix = 'item'): string {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
}
export function isShareableJourney(source: Journey): boolean {
  return !source.trash && (source.purpose === 'JOURNAL' || (source.planStage !== 'DRAFT' && !source.businessCandidates?.length && source.days.some(day => day.places.length > 0)));
}

/** Allowlist the shared route, excluding private notes, shortlists, drafts and booking data. */
export function copyJourneyForGroup(source: Journey, author: string): Journey {
  const copiedDayIds = source.days.map(() => togetherId('day'));
  const dayIds = new Map(source.days.filter(day => day.dayId).map(day => [day.dayId!, copiedDayIds[source.days.indexOf(day)]]));
  const visitIds = new Map(source.days.flatMap(day => day.places).filter(place => place.visitId).map(place => [place.visitId!, togetherId('visit')]));
  const days = source.days.map((day, index) => {
    const places = day.places.map(place => {
      const clean = { id: place.id, kind: place.kind, name: place.name, area: place.area, address: place.address,
        lat: place.lat, lng: place.lng, personal: place.personal, locationVerified: place.locationVerified, image: place.image,
        photos: place.photos ? structuredClone(place.photos) : undefined, description: place.description,
        duration: place.duration, note: '', visitId: place.visitId ? visitIds.get(place.visitId) : togetherId('visit'),
        anchorVisitId: place.anchorVisitId ? visitIds.get(place.anchorVisitId) : undefined,
        stayDayIds: place.stayDayIds?.map(id => dayIds.get(id)).filter((id): id is string => Boolean(id)),
        bookingFixed: Boolean(place.bookingFixed), planningSlot: place.planningSlot, time: place.time, move: place.move, tags: place.tags ? [...place.tags] : undefined };
      return clean;
    });
    return { dayId: copiedDayIds[index], day: day.day, date: day.date, title: day.title, story: '', places,
      blocks: places.map(place => ({ id: togetherId('block'), type: 'PLACE' as const, placeId: place.id, visitId: place.visitId })) };
  });
  return { id: togetherId('group-trip'), purpose: 'PLAN', planStage: 'READY', startDate: source.startDate, title: source.title, region: source.region,
    dateRange: source.dateRange, duration: source.duration, status: 'PLANNING', visibility: 'PRIVATE', cover: source.cover,
    summary: '', story: '', tags: [...source.tags], saves: 0, days, author, isMine: false };
}

export function createEmptyState(viewerId: string, name: string): TogetherState {
  return { schemaVersion: 1, groups: [], members: viewerId ? [{ id: viewerId, name }] : [], activities: [], messages: [], notices: [],
    tasks: [], polls: [], posts: [], media: [], invites: [], applications: [], sharedJournals: [], readCursors: {}, mutedRooms: [] };
}

/** Privacy-filtered invitation payload, retaining the author-selected journal content and content type. */
export function snapshotJourneyForGroup(source: Journey, author: string): Journey {
  const clean = copyJourneyForGroup(source, author);
  // A customer's own copied journal can itself have public-source provenance. Its own ID is the share source.
  clean.sourceJourneyId = source.isMine ? source.id : source.sourceJourneyId ?? source.id;
  if (source.purpose !== 'JOURNAL') return clean;
  clean.purpose = 'JOURNAL'; clean.status = 'PUBLISHED'; clean.planStage = undefined;
  clean.story = source.story; clean.summary = source.summary;
  clean.days.forEach((day, dayIndex) => {
    const originalDay = source.days[dayIndex];
    day.story = originalDay.story;
    const remappedVisits = new Map(originalDay.places.map((place, index) => [place.visitId, day.places[index].visitId]));
    day.blocks = originalDay.blocks.map(block => ({ id: togetherId('block'), type: block.type,
      ...(block.type === 'PLACE' ? { placeId: block.placeId, visitId: remappedVisits.get(block.visitId) }
        : { heading: block.heading, body: block.body, image: block.image, caption: block.caption,
          images: block.images?.map(image => ({ ...image, id: togetherId('image') })) }) }));
  });
  return clean;
}

/** Mutates only the supplied together draft. Personal source is never changed. */
export function createGroupFromJourney(state: TogetherState, source: Journey, userId: string, options: { name?: string; kind?: GroupKind; region?: string; groupId?: string } = {}): TogetherGroup {
  if (!userId || !state.members.some(member => member.id === userId)) throw new Error('로그인 후 함께할 수 있어요.');
  if (!isShareableJourney(source)) throw new Error('후보와 방문 장소를 먼저 확인하고 내 여행을 완성해 주세요.');
  let group = options.groupId ? state.groups.find(item => item.id === options.groupId) : undefined;
  if (options.groupId && (!group || group.archived || !group.memberIds.includes(userId))) throw new Error('이 모임에 일정을 추가할 수 없어요.');
  if (!group) {
    group = { id: togetherId('group'), name: options.name?.trim() || `${source.title} 함께하기`, kind: options.kind ?? 'FAMILY', region: options.region || source.region,
      introduction: '', cover: source.cover, visibility: 'PRIVATE', ownerId: userId, memberIds: [userId], managerIds: [], archived: false, promotionPublished: false };
    state.groups.push(group);
  }
  if (source.purpose === 'JOURNAL') {
    // Shared journal is an explicitly selected, privacy-filtered snapshot, independent of future original edits.
    const clean = snapshotJourneyForGroup(source, memberName(state, userId));
    state.sharedJournals.push({ id: togetherId('shared-journal'), groupId: group.id, authorId: userId, sourceJourneyId: clean.sourceJourneyId, journey: clean });
  } else {
    const journey = copyJourneyForGroup(source, memberName(state, userId));
    const datedDays = source.days.map(day => day.date).filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort();
    const startDate = source.startDate && /^\d{4}-\d{2}-\d{2}$/.test(source.startDate) ? source.startDate : datedDays[0] ?? '';
    state.activities.push({ id: togetherId('activity'), groupId: group.id, title: source.title, date: startDate, endDate: datedDays.at(-1) ?? startDate,
      meetingPoint: '', description: '', status: 'PLANNED', leadId: userId, editorIds: [], participants: {}, arrivedIds: [], journey, revision: 1 });
  }
  return group;
}

/** One intent owns one group, even when recipients have separate invitation tokens. */
export function acceptInvite(state: TogetherState, inviteId: string, userId: string): string {
  const invite = state.invites.find(item => item.id === inviteId);
  if (!invite || invite.revoked) throw new Error('사용할 수 없는 초대예요.');
  if (!userId || userId === invite.senderId || !state.members.some(member => member.id === userId)) throw new Error('초대받은 계정으로 로그인해 주세요.');
  const accepted = invite.acceptedBy.includes(userId);
  if (!accepted && (!Number.isFinite(Date.parse(invite.expiresAt)) || Date.parse(invite.expiresAt) <= Date.now())) throw new Error('초대 기간이 지났어요.');
  const related = state.invites.filter(item => item.intentId === invite.intentId);
  const groupId = invite.groupId ?? related.find(item => item.groupId)?.groupId;
  let group = groupId ? state.groups.find(item => item.id === groupId) : undefined;
  if (groupId && !group) throw new Error('초대한 모임을 찾을 수 없어요.');
  if (group?.archived) throw new Error('보관된 모임의 초대는 받을 수 없어요.');
  if (group?.blockedMemberIds?.includes(userId)) throw new Error('이 모임은 운영진의 참여 제한 해제 후 다시 가입할 수 있어요.');
  if (group) {
    const senderActive = group.memberIds.includes(invite.senderId) && !group.blockedMemberIds?.includes(invite.senderId);
    const senderAuthorized = invite.sourceJourney || invite.sourceTripId ? group.ownerId === invite.senderId : group.ownerId === invite.senderId || group.managerIds.includes(invite.senderId);
    if (!senderActive || !senderAuthorized) throw new Error('초대한 운영자의 권한이 바뀌었어요. 현재 모임장이나 운영진에게 새 초대를 요청해 주세요.');
  }
  if (!group) {
    if (!state.members.some(member => member.id === invite.senderId)) throw new Error('초대자를 확인할 수 없어요.');
    if (invite.sourceJourney) group = createGroupFromJourney(state, invite.sourceJourney, invite.senderId, { name: invite.name, kind: invite.kind, region: invite.region });
    else {
      group = { id: togetherId('group'), name: invite.name, kind: invite.kind, region: invite.region, introduction: '', cover: '', visibility: 'PRIVATE', ownerId: invite.senderId,
        memberIds: [invite.senderId], managerIds: [], archived: false, promotionPublished: false };
      state.groups.push(group);
    }
    related.forEach(item => { item.groupId = group!.id; });
  }
  if (!group.memberIds.includes(userId)) group.memberIds.push(userId);
  if (!accepted) invite.acceptedBy.push(userId);
  return group.id;
}

/** Call after authorized changes to public fields, including derived dates from place/stay edits. */
export function unpublishActivityFromGroup(state: TogetherState, activityId: string): void {
  const activity = state.activities.find(item => item.id === activityId);
  const group = state.groups.find(item => item.id === activity?.groupId);
  if (!group) return;
  group.promotionActivityIds = group.promotionActivityIds?.filter(id => id !== activityId);
  group.promotionActivitySnapshots = group.promotionActivitySnapshots?.filter(snapshot => snapshot.id !== activityId);
}

function manageableGroup(state: TogetherState, groupId: string, actorId: string): TogetherGroup {
  const group = state.groups.find(item => item.id === groupId);
  if (!group || group.archived || !group.memberIds.includes(actorId) || (group.ownerId !== actorId && !group.managerIds.includes(actorId))) throw new Error('모임장과 운영진만 멤버를 관리할 수 있어요.');
  return group;
}

/** Revokes this group's access only. Authored posts/media and past attendance are retained. */
export function removeGroupMember(state: TogetherState, groupId: string, actorId: string, targetId: string): void {
  const group = manageableGroup(state, groupId, actorId);
  if (targetId === actorId) throw new Error('본인은 모임 나가기를 이용해 주세요.');
  if (targetId === group.ownerId) throw new Error('모임장은 내보낼 수 없어요. 먼저 모임장을 위임해 주세요.');
  if (!group.memberIds.includes(targetId)) throw new Error('이미 모임에 속하지 않은 사람이에요.');
  if (actorId !== group.ownerId && group.managerIds.includes(targetId)) throw new Error('운영진 내보내기는 모임장만 할 수 있어요.');
  group.memberIds = group.memberIds.filter(id => id !== targetId);
  group.managerIds = group.managerIds.filter(id => id !== targetId);
  group.blockedMemberIds = [...new Set([...(group.blockedMemberIds ?? []), targetId])];
  state.activities.filter(activity => activity.groupId === groupId).forEach(activity => {
    activity.editorIds = activity.editorIds.filter(id => id !== targetId);
    activity.revision += 1;
  });
  state.applications.filter(application => application.groupId === groupId && application.userId === targetId && application.status === 'PENDING').forEach(application => {
    application.status = 'DECLINED'; application.decidedAt = new Date().toISOString(); application.decidedBy = actorId;
  });
}

/** Restoring eligibility never grants membership or changes the historical record. */
export function restoreGroupMemberAccess(state: TogetherState, groupId: string, actorId: string, targetId: string): void {
  const group = manageableGroup(state, groupId, actorId);
  group.blockedMemberIds = (group.blockedMemberIds ?? []).filter(id => id !== targetId);
}

export function approveGroupApplication(state: TogetherState, applicationId: string, actorId: string): void {
  const application = state.applications.find(item => item.id === applicationId);
  if (!application) throw new Error('가입 신청을 찾을 수 없어요.');
  const group = manageableGroup(state, application.groupId, actorId);
  if (group.blockedMemberIds?.includes(application.userId)) throw new Error('참여 제한을 먼저 해제한 뒤 가입 신청을 승인해 주세요.');
  if (!state.members.some(member => member.id === application.userId)) throw new Error('신청한 회원을 확인할 수 없어요.');
  if (application.status === 'APPROVED' && group.memberIds.includes(application.userId)) return;
  if (application.status !== 'PENDING') throw new Error('이미 처리한 신청이에요. 새 가입 신청을 확인해 주세요.');
  application.status = 'APPROVED';
  application.decidedAt = new Date().toISOString(); application.decidedBy = actorId;
  if (!group.memberIds.includes(application.userId)) group.memberIds.push(application.userId);
}

export function rejectGroupApplication(state: TogetherState, applicationId: string, actorId: string): void {
  const application = state.applications.find(item => item.id === applicationId);
  if (!application) throw new Error('가입 신청을 찾을 수 없어요.');
  manageableGroup(state, application.groupId, actorId);
  if (application.status !== 'PENDING') throw new Error('이미 처리한 신청이에요. 현재 상태를 확인해 주세요.');
  application.status = 'DECLINED'; application.decidedAt = new Date().toISOString(); application.decidedBy = actorId;
}

export function countGroupParticipants(state: TogetherState, activityId: string): number {
  const activity = state.activities.find(item => item.id === activityId);
  const group = state.groups.find(item => item.id === activity?.groupId);
  return activity && group ? group.memberIds.filter(id => activity.participants[id] === 'JOINED').length : 0;
}

/** Sets only the actor's RSVP. The repository transaction prevents concurrent last-seat overwrites. */
export function setGroupParticipation(state: TogetherState, activityId: string, actorId: string, status: ParticipationStatus): void {
  const activity = state.activities.find(item => item.id === activityId);
  const group = state.groups.find(item => item.id === activity?.groupId);
  if (!activity || !group || !group.memberIds.includes(actorId) || group.blockedMemberIds?.includes(actorId)) throw new Error('모임원만 참가 여부를 선택할 수 있어요.');
  if (group.archived || activity.status !== 'PLANNED') throw new Error('취소·완료·보관된 일정은 참가 여부를 바꿀 수 없어요.');
  if (!['JOINED', 'MAYBE', 'DECLINED'].includes(status)) throw new Error('참가 상태를 다시 선택해 주세요.');
  if (activity.participants[actorId] === status) return;
  if (status === 'JOINED' && activity.capacity !== undefined && countGroupParticipants(state, activityId) >= activity.capacity) throw new Error('모집 정원이 찼어요. 미정으로 남기거나 담당자에게 문의해 주세요.');
  activity.participants[actorId] = status; activity.revision += 1;
}
