import type { Place } from '../data';
import { getAssistantContext, selectAssistantPlaces, compareAssistantConditions, type ActivityAssistantScope, type AssistantConditions, type AssistantPlaceEvidence } from './activityAssistant.ts';
import type { CreationBrief } from './creationPlanner';
import type { GroupTopic, TogetherState } from './model';
import { topicOptions } from './discovery.ts';

export type Availability = 'YES' | 'MAYBE' | 'NO';
export interface PlanningDateCandidate { id: string; date: string; time: string; availability: Availability }
export interface DatePollDraft { question: string; options: string[]; availabilityCounts: Record<Availability, number> }
export interface DepartureCheck { id: string; label: string; value: string; state: 'REGISTERED' | 'MISSING' | 'OPEN' | 'FIXED'; taskTitle?: string }
export const planningToday = (at = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(at);
export const validPlanningDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

/** Reads the current exact space only. A passed date is read-only even if status was never updated. */
export function getPlanningSupportContext(state: TogetherState, userId: string, scope: ActivityAssistantScope, at = new Date()) {
  const context = getAssistantContext(state, userId, scope);
  const activity = context.activity;
  const finalDay = activity && validPlanningDate(activity.endDate) && activity.endDate >= activity.date ? activity.endDate : activity?.date;
  const past = Boolean(finalDay && validPlanningDate(finalDay) && finalDay < planningToday(at));
  return { ...context, past, canWrite: !context.group.archived && (!activity || activity.status === 'PLANNED') && !past,
    canPlanNext: !context.group.archived && activity?.status !== 'CANCELLED' };
}

/** Every comparison uses public-catalog items that were explicitly shared in this exact group/route. */
export function comparePlanningPlaces(state: TogetherState, userId: string, scope: ActivityAssistantScope, places: Place[], selectedIds: string[], conditions: AssistantConditions, evidence: AssistantPlaceEvidence[]) {
  const candidates = selectAssistantPlaces(state, userId, scope, places);
  const selected = [...new Set(selectedIds)];
  if (selected.length > 8 || selected.some(id => !candidates.some(place => place.id === id))) throw new Error('현재 공유된 장소에서 최대 8곳을 선택해 주세요.');
  return selected.map(id => {
    const place = candidates.find(item => item.id === id)!;
    const input = evidence.find(item => item.placeId === id) ?? { placeId: id };
    return { place, evidence: input, checks: compareAssistantConditions(conditions, input) };
  });
}

/** Explicit candidate dates and the actor's own stated availability, never another member's inferred calendar. */
export function buildDatePollDraft(rows: PlanningDateCandidate[], question: string, at = new Date()): DatePollDraft {
  const title = question.trim();
  if (!title || title.length > 160) throw new Error('투표 제목을 160자 이내로 적어 주세요.');
  if (rows.length < 2 || rows.length > 8) throw new Error('후보 날짜를 2~8개 입력해 주세요.');
  const counts: Record<Availability, number> = { YES: 0, MAYBE: 0, NO: 0 };
  const options = rows.map(row => {
    if (!validPlanningDate(row.date) || row.date < planningToday(at)) throw new Error('오늘 이후의 올바른 후보 날짜를 입력해 주세요.');
    if (row.time && !validTime(row.time)) throw new Error('후보 시각을 확인해 주세요.');
    if (!['YES', 'MAYBE', 'NO'].includes(row.availability)) throw new Error('내 가능 여부를 확인해 주세요.');
    counts[row.availability] += 1;
    return `${row.date}${row.time ? ` ${row.time}` : ' · 시각 미정'} (한국 시각)`;
  });
  if (new Set(options).size !== options.length) throw new Error('같은 날짜와 시각이 중복됐어요.');
  return { question: title, options, availabilityCounts: counts };
}

/** Stored dates/locations and shared booking-protection flags are facts; a fixed flag is not a reservation confirmation. */
export function buildDepartureChecklist(state: TogetherState, userId: string, scope: ActivityAssistantScope) {
  const { activity } = getAssistantContext(state, userId, scope);
  if (!activity) return { activity: undefined, checks: [] as DepartureCheck[], tasks: state.tasks.filter(item => item.groupId === scope.groupId && !item.activityId && !item.completed), fixedBookings: [] };
  const checks: DepartureCheck[] = [
    { id: 'date', label: '날짜', value: activity.date ? `${activity.date}${activity.endDate && activity.endDate !== activity.date ? ` ~ ${activity.endDate}` : ''}` : '날짜 미정', state: validPlanningDate(activity.date) ? 'REGISTERED' : 'MISSING', taskTitle: validPlanningDate(activity.date) ? undefined : '모임 날짜 정하기' },
    { id: 'time', label: '만나는 시각', value: activity.startTime || '시각 미정', state: activity.startTime && validTime(activity.startTime) ? 'REGISTERED' : 'MISSING', taskTitle: activity.startTime && validTime(activity.startTime) ? undefined : '만나는 시각 확인하기' },
    { id: 'meeting', label: '만나는 곳', value: activity.meetingPoint.trim() || '만나는 곳 미정', state: activity.meetingPoint.trim() ? 'REGISTERED' : 'MISSING', taskTitle: activity.meetingPoint.trim() ? undefined : '만나는 곳과 출구 확인하기' },
  ];
  const fixedBookings = activity.journey?.days.flatMap((day, dayIndex) => day.places.filter(place => place.bookingFixed).map((place, index) => ({ id: place.visitId || `${dayIndex}:${index}:${place.id}`, placeId: place.id, name: place.name, day: day.day, time: place.time || '' }))) ?? [];
  const tasks = state.tasks.filter(item => item.groupId === scope.groupId && item.activityId === activity.id && !item.completed);
  fixedBookings.forEach(item => checks.push({ id: `booking:${item.id}`, label: `DAY ${item.day} · 고정 예약`, value: `${item.name}${item.time ? ` · ${item.time}` : ''} · 예약 완료 여부는 별도 확인`, state: 'FIXED', taskTitle: `${item.name} 예약 완료·이용 조건 확인하기` }));
  return { activity, checks, tasks, fixedBookings };
}

export interface NextActivityInput { region: string; previousTitle?: string; feedback: string; wish: string; purpose: CreationBrief['purpose']; theme: CreationBrief['theme']; topics?: GroupTopic[] }
/** Only text the actor deliberately typed; no historical chat, attendance, booking or private memo is copied. */
export function buildNextActivityBrief(input: NextActivityInput): Partial<CreationBrief> {
  const feedback = input.feedback.trim(), wish = input.wish.trim();
  if (!wish || wish.length > 500 || feedback.length > 500) throw new Error('다음에 하고 싶은 일을 500자 이내로 적어 주세요.');
  if (!['MEETUP', 'OUTING', 'TRIP', 'GROUP'].includes(input.purpose) || !['FOOD', 'CAFE', 'FOLIAGE', 'CULTURE', 'TRAVEL', 'OTHER'].includes(input.theme)) throw new Error('다음 활동의 종류를 다시 선택해 주세요.');
  if (input.topics !== undefined && (!Array.isArray(input.topics) || input.topics.some(topic => !topicOptions.some(option => option.id === topic)))) throw new Error('다음 활동의 관심사를 다시 선택해 주세요.');
  return { prompt: wish, ...(input.region.trim() ? { region: input.region.trim() } : {}), purpose: input.purpose, theme: input.theme,
    ...(input.topics !== undefined ? { topics: [...new Set(input.topics)] } : {}),
    ...(feedback ? { notes: `직접 남긴 후기: ${feedback}` } : {}) };
}

export function buildPlanningFeedback(input: Pick<NextActivityInput, 'previousTitle' | 'feedback' | 'wish'>): string {
  const feedback = input.feedback.trim(), wish = input.wish.trim();
  if (!feedback || feedback.length > 500 || wish.length > 500) throw new Error('공유할 후기를 500자 이내로 적어 주세요.');
  return [`${input.previousTitle?.trim() ? `‘${input.previousTitle.trim().slice(0, 100)}’ 후기` : '함께한 활동 후기'}`, feedback, ...(wish ? [`다음에 하고 싶은 일: ${wish}`] : [])].join('\n\n');
}
