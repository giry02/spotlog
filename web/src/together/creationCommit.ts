import type { Journey, Place } from '../data';
import { creationBriefTopics, validateCreationPlan, type CreationBrief, type CreationGroupDraft, type CreationPlan } from './creationPlanner.ts';
import { isMember, memberName, togetherId, type GroupKind, type GroupTopic, type TogetherActivity, type TogetherState } from './model.ts';
import { getPlanningSupportContext } from './planningSupport.ts';
import { resolvePlacePhotos } from '../placePhotos.ts';
import { topicOptions } from './discovery.ts';
import { shareChatEntity } from './chatEntities.ts';

export interface CreationCommitInput {
  requestId: string;
  brief: CreationBrief;
  plan: CreationPlan | null;
  groupDraft?: CreationGroupDraft;
  /** Only persistent groups can receive another activity. One-off rooms never grant later access. */
  groupId?: string;
}

const bounded = (value: unknown, limit: number, label: string, required = false): string => {
  if (typeof value !== 'string' || value.length > limit || required && !value.trim()) throw new Error(`${label}을 다시 확인해 주세요.`);
  return value.trim();
};
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
function checkBrief(brief: CreationBrief) {
  if (!['MEETUP', 'OUTING', 'TRIP', 'GROUP'].includes(brief.purpose)) throw new Error('만들 내용을 다시 선택해 주세요.');
  bounded(brief.region, 80, '지역', true);
  bounded(brief.prompt, 1000, '요청');
  bounded(brief.notes, 2000, '조건');
  if (brief.purpose === 'GROUP') return;
  if (brief.date && !validDate(brief.date) || brief.endDate && (!brief.date || !validDate(brief.endDate) || brief.endDate < brief.date)) throw new Error('날짜를 다시 확인해 주세요.');
  if (brief.startTime && (!brief.date || !/^([01]\d|2[0-3]):[0-5]\d$/.test(brief.startTime))) throw new Error('날짜와 시작 시간을 다시 확인해 주세요.');
  if (brief.people !== undefined && (!Number.isInteger(brief.people) || brief.people < 1 || brief.people > 500)) throw new Error('인원은 1~500명 사이로 입력해 주세요.');
  if (brief.budgetPerPerson !== undefined && (!Number.isFinite(brief.budgetPerPerson) || brief.budgetPerPerson < 0) || brief.walkingLimitMinutes !== undefined && (!Number.isFinite(brief.walkingLimitMinutes) || brief.walkingLimitMinutes < 0)) throw new Error('예산과 걷기 조건을 다시 확인해 주세요.');
}

function conditionDescription(brief: CreationBrief, plan: CreationPlan): string {
  const topics = creationBriefTopics(brief).map(id => topicOptions.find(topic => topic.id === id)?.label).filter(Boolean);
  return [
    brief.locationUndecided ? '장소는 나중에 정하는 일정' : '선택한 등록 장소로 만든 일정',
    `계획 종류: ${brief.purpose === 'TRIP' ? '여행' : brief.purpose === 'OUTING' ? '나들이' : '약속·활동'} · 활동 지역: ${brief.region}`,
    topics.length ? `함께할 활동: ${topics.join(' · ')}` : '',
    `이동 수단: ${({ UNSET: '미정', WALK: '도보', PUBLIC: '대중교통', CAR: '차량' })[brief.transport] ?? '미정'}`,
    brief.people ? `예상 인원 ${brief.people}명 · 참석 응답은 별도` : '',
    brief.budgetPerPerson !== undefined ? `희망 예산 ${brief.budgetPerPerson.toLocaleString('ko-KR')}원/인 · 실제 가격 확인 필요` : '',
    brief.walkingLimitMinutes !== undefined ? `희망 걷기 ${brief.walkingLimitMinutes}분 이내 · 실제 보행 경로 확인 필요` : '',
    brief.notes,
    plan.unknowns.length ? `확인할 것: ${plan.unknowns.join(' / ')}` : '',
  ].filter(Boolean).join('\n').slice(0, 4000);
}

/** New IDs and public-place allowlist only. No old notes, locks, progress or reservations are copied. */
export function buildCreationJourney(brief: CreationBrief, plan: CreationPlan, places: Place[], author: string): Journey {
  checkBrief(brief);
  const errors = validateCreationPlan(brief, plan, places);
  if (errors.length) throw new Error(errors[0]);
  if ((!plan.placeIds.length && !brief.locationUndecided) || !plan.days.length) throw new Error('실제 장소를 선택하거나 장소 미정을 직접 선택해 주세요.');
  const days = plan.days.map((day, index) => {
    const date = brief.date ? new Date(Date.parse(`${brief.date}T12:00:00Z`) + index * 86400000).toISOString().slice(0, 10) : '';
    const selected = day.placeIds.map(id => {
      const place = places.find(item => item.id === id)!;
      const photos = structuredClone(resolvePlacePhotos(place, [], true));
      return { id: place.id, kind: place.kind, name: place.name, area: place.area, address: place.address,
        lat: place.lat, lng: place.lng, image: photos[0]?.image ?? '', photos,
        description: place.description, duration: place.duration, note: '', visitId: togetherId('visit'),
        locationVerified: place.locationVerified, bookingFixed: false,
        ...(index === 0 && day.placeIds[0] === id && brief.startTime ? { time: brief.startTime } : {}) };
    });
    return { dayId: togetherId('day'), day: index + 1, date, title: `DAY ${index + 1}`, story: '', places: selected,
      blocks: selected.map(place => ({ id: togetherId('block'), type: 'PLACE' as const, placeId: place.id, visitId: place.visitId })) };
  });
  return { id: togetherId('created-plan'), title: bounded(plan.title, 100, '일정 이름', true), region: brief.region,
    purpose: 'PLAN', planStage: 'READY', status: 'PLANNING', visibility: 'PRIVATE',
    startDate: brief.date || undefined, dateRange: brief.date ? `${brief.date}${days.length > 1 ? ` ~ ${days.at(-1)!.date}` : ''}` : '',
    duration: `${days.length}일`, cover: days.flatMap(day => day.places)[0]?.image ?? '',
    summary: '', story: '', tags: creationBriefTopics(brief).map(id => topicOptions.find(topic => topic.id === id)?.label).filter((label): label is string => Boolean(label)), saves: 0, author, isMine: false, days };
}

/** Execute inside repository.update so membership, catalog and failures stay atomic. */
export function commitCreation(state: TogetherState, actorId: string, input: CreationCommitInput, places: Place[]): { kind: 'GROUP' | 'ACTIVITY'; id: string } {
  if (!actorId || !state.members.some(member => member.id === actorId)) throw new Error('로그인한 뒤 만들 수 있어요.');
  const id = bounded(input.requestId, 160, '요청 ID', true);
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error('요청 ID를 다시 확인해 주세요.');
  checkBrief(input.brief);
  const target = input.groupId ? state.groups.find(group => group.id === input.groupId) : undefined;
  if (input.groupId && (!target || target.spaceType === 'ACTIVITY' || target.archived || !isMember(state, actorId, target.id) || target.blockedMemberIds?.includes(actorId))) throw new Error('현재 모임에 새 일정을 만들 수 없어요.');
  if (input.brief.purpose === 'GROUP') {
    if (input.groupId || !input.groupDraft || input.plan) throw new Error('새 모임 초안을 다시 확인해 주세요.');
    const draft = input.groupDraft;
    const name = bounded(draft.name, 100, '모임 이름', true);
    const firstIdea = bounded(draft.firstActivityIdea ?? '', 500, '첫 활동 아이디어');
    const introduction = bounded([bounded(draft.introduction, 3000, '모임 소개'), firstIdea ? `첫 활동 아이디어 · 일정 미정\n${firstIdea}` : ''].filter(Boolean).join('\n\n'), 4000, '모임 소개');
    const area = bounded(draft.region, 80, '활동 지역', true).split(/\s+/), region = area[0], district = area.slice(1).join(' ');
    const themes: Partial<Record<CreationBrief['theme'], GroupTopic>> = { FOOD: 'FOOD', CAFE: 'CAFE', FOLIAGE: 'OUTDOOR', CULTURE: 'CULTURE', TRAVEL: 'TRAVEL' };
    const chosenTopics = draft.topics ?? (themes[input.brief.theme] ? [themes[input.brief.theme]!] : []);
    if (!Array.isArray(chosenTopics) || chosenTopics.length > 16 || chosenTopics.some(topic => !topicOptions.some(item => item.id === topic))) throw new Error('관심사를 다시 확인해 주세요.');
    const topics = [...new Set(chosenTopics)];
    const welcome = bounded(draft.welcome ?? '', 500, '환영 안내'), joinGuide = bounded(draft.joinGuide ?? '', 1000, '가입 안내');
    const joinMode = draft.joinMode ?? 'DIRECT';
    if (!['DIRECT', 'APPROVAL'].includes(joinMode)) throw new Error('모임 가입 방식을 다시 선택해 주세요.');
    if (!['FAMILY', 'FRIENDS', 'HOBBY', 'GUIDE'].includes(draft.kind)) throw new Error('모임 종류를 다시 선택해 주세요.');
    const previous = state.groups.find(group => group.id === id);
    if (previous) {
      if (previous.ownerId !== actorId || !previous.memberIds.includes(actorId) || previous.name !== name || previous.introduction !== introduction || previous.region !== region || previous.kind !== draft.kind || previous.spaceType === 'ACTIVITY' || previous.archived || previous.blockedMemberIds?.includes(actorId)) throw new Error('같은 요청의 내용이 바뀌었어요. 다시 확인해 주세요.');
      if (previous.discovery?.topics.join('\n') !== topics.join('\n') || previous.discovery?.district !== district || previous.discovery?.welcome !== welcome || previous.discovery?.joinGuide !== joinGuide || previous.discovery?.joinMode !== joinMode) throw new Error('같은 요청의 가입 안내가 바뀌었어요. 다시 확인해 주세요.');
      return { kind: 'GROUP', id };
    }
    if (state.activities.some(activity => activity.id === id)) throw new Error('이미 사용한 요청이에요.');
    state.groups.push({ id, name, kind: draft.kind, region, introduction, cover: '', visibility: 'PRIVATE',
      ownerId: actorId, memberIds: [actorId], managerIds: [], archived: false, promotionPublished: false,
      sourceKind: 'LOCAL', spaceType: 'GROUP', interestPlaceIds: [],
      createdAt: new Date().toISOString(), discovery: { topics, district, style: 'NEIGHBORHOOD', recruitment: 'PAUSED', welcome, joinGuide, joinMode } });
    return { kind: 'GROUP', id };
  }
  if (!input.plan) throw new Error('만들 일정을 선택해 주세요.');
  const plan = input.plan;
  const journey = buildCreationJourney(input.brief, plan, places, memberName(state, actorId));
  const title = journey.title, description = conditionDescription(input.brief, plan);
  const groupId = target?.id ?? `space-${id}`;
  const previous = state.activities.find(activity => activity.id === id);
  if (previous) {
    const previousGroup = state.groups.find(group => group.id === groupId);
    const selectedIds = previous.journey?.days.flatMap(day => day.places.map(place => place.id)) ?? [];
    const partitionsMatch = previous.journey?.days.every((day, index) => day.date === journey.days[index]?.date && day.places.map(place => place.id).join('\n') === journey.days[index]?.places.map(place => place.id).join('\n'));
    if (!partitionsMatch || previous.journey?.region !== journey.region || previous.kind !== (input.brief.purpose === 'TRIP' ? 'TRIP' : 'MEETUP')) throw new Error('같은 요청의 일정 구성이 바뀌었어요. 다시 확인해 주세요.');
    if (previous.groupId !== groupId || previous.leadId !== actorId || previous.title !== title || previous.date !== input.brief.date || previous.startTime !== (input.brief.startTime || undefined) || previous.description !== description || previous.journey?.days.length !== journey.days.length || previous.endDate !== journey.days.at(-1)!.date || selectedIds.join('\n') !== plan.days.flatMap(day => day.placeIds).join('\n') || !previousGroup?.memberIds.includes(actorId) || previousGroup.blockedMemberIds?.includes(actorId) || previousGroup.archived) throw new Error('같은 요청의 내용이 바뀌었어요. 다시 확인해 주세요.');
      shareChatEntity(state, actorId, { type: 'ACTIVITY', id });
      return { kind: 'ACTIVITY', id };
  }
  if (state.groups.some(group => group.id === id || !target && group.id === groupId) || state.activities.some(activity => activity.id === groupId)) throw new Error('이미 사용한 요청이에요.');
  const first = journey.days.flatMap(day => day.places)[0];
  const kind: GroupKind = /가족|부모|엄마|아빠/.test(input.brief.prompt) ? 'FAMILY' : 'FRIENDS';
  const activity: TogetherActivity = { id, groupId, kind: input.brief.purpose === 'TRIP' ? 'TRIP' : 'MEETUP', title,
    date: input.brief.date, endDate: journey.days.at(-1)!.date, startTime: input.brief.startTime || undefined,
    meetingPoint: first ? `${first.name}${first.address ? ` · ${first.address}` : ''}` : '', description,
    status: 'PLANNED', leadId: actorId, editorIds: [], participants: {}, arrivedIds: [], revision: 1, journey };
  if (!target) state.groups.push({ id: groupId, name: title, kind, region: input.brief.region, introduction: '', cover: journey.cover,
    spaceType: 'ACTIVITY', visibility: 'PRIVATE', ownerId: actorId, memberIds: [actorId], managerIds: [],
    archived: false, promotionPublished: false, sourceKind: 'LOCAL', interestPlaceIds: [...plan.placeIds] });
  state.activities.push(activity);
  shareChatEntity(state, actorId, { type: 'ACTIVITY', id });
  return { kind: 'ACTIVITY', id };
}

interface PlanningWriteScope { id: string; groupId: string; activityId?: string; expectedRevision?: number }
function planningWriteContext(state: TogetherState, actorId: string, scope: PlanningWriteScope, feedback = false) {
  const context = getPlanningSupportContext(state, actorId, scope);
  if (!(feedback ? context.canPlanNext : context.canWrite)) throw new Error('이 공간에는 지금 반영할 수 없어요. 현재 상태를 확인해 주세요.');
  if (context.activity?.revision !== scope.expectedRevision) throw new Error('약속이 바뀌었어요. 현재 내용을 확인한 뒤 다시 반영해 주세요.');
  bounded(scope.id, 160, '요청 ID', true);
  return context;
}

/** Polling never confirms a time or RSVPs on behalf of any member. */
export function createPlanningPoll(state: TogetherState, actorId: string, input: PlanningWriteScope & { question: string; options: string[] }): string {
  planningWriteContext(state, actorId, input);
  const question = bounded(input.question, 160, '투표 제목', true);
  if (!Array.isArray(input.options) || input.options.length < 2 || input.options.length > 8) throw new Error('후보를 2~8개 선택해 주세요.');
  const labels = input.options.map(option => bounded(option, 200, '후보', true));
  if (new Set(labels).size !== labels.length) throw new Error('같은 후보가 중복됐어요.');
  const matches = (poll: TogetherState['polls'][number]) => poll.groupId === input.groupId && poll.activityId === input.activityId && poll.question === question && poll.options.map(option => option.label).join('\n') === labels.join('\n');
  const previous = state.polls.find(poll => poll.id === input.id);
  if (previous) { if (!matches(previous)) throw new Error('다른 투표에 사용한 요청이에요.'); shareChatEntity(state, actorId, { type: 'POLL', id: previous.id }); return previous.id; }
  const duplicate = state.polls.find(poll => !poll.closed && matches(poll));
  if (duplicate) { shareChatEntity(state, actorId, { type: 'POLL', id: duplicate.id }); return duplicate.id; }
  state.polls.push({ id: input.id, groupId: input.groupId, activityId: input.activityId, question,
    options: labels.map((label, index) => ({ id: `${input.id}-${index}`, label, voterIds: [] })), closed: false });
  shareChatEntity(state, actorId, { type: 'POLL', id: input.id });
  return input.id;
}

/** Only the explicitly written feedback is shared, never automatically gathered messages or private records. */
export function savePlanningFeedback(state: TogetherState, actorId: string, input: PlanningWriteScope & { body: string }): string {
  planningWriteContext(state, actorId, input, true);
  const body = bounded(input.body, 1600, '후기', true);
  const matches = (post: TogetherState['posts'][number]) => post.groupId === input.groupId && post.activityId === input.activityId && post.authorId === actorId && post.category === 'REVIEW' && post.body === body;
  const previous = state.posts.find(post => post.id === input.id);
  if (previous) { if (!matches(previous)) throw new Error('다른 후기에 사용한 요청이에요.'); return previous.id; }
  const duplicate = state.posts.find(matches);
  if (duplicate) return duplicate.id;
  state.posts.push({ id: input.id, groupId: input.groupId, activityId: input.activityId, authorId: actorId,
    title: '다음 활동을 위한 후기', body, category: 'REVIEW', createdAt: new Date().toISOString(), likes: [], comments: [] });
  return input.id;
}
