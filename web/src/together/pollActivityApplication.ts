import type { Place } from '../data';
import { setPlanDates } from '../tripPlan.ts';
import { validCalendarDay } from './calendarPlans.ts';
import { koreaDay } from './discovery.ts';
import { assertCurrentActivityEditor } from './activityLifecycle.ts';
import { resolveScopedPollPlace } from './activityPlaces.ts';
import { unpublishActivityFromGroup, type TogetherState } from './model.ts';
import { isTogetherPollFields } from './polls.ts';

export interface PollActivityApplicationScope { groupId: string; activityId: string; pollId: string }
export interface PollActivityValues {
  date: string; endDate: string; startTime: string; meetingPoint: string; venuePlaceId?: string;
}
/** A reviewed proposal in page memory. It grants no authority; apply resolves every source again. */
export interface PollActivityApplicationPreview extends PollActivityApplicationScope {
  actorId: string; optionId: string; kind: 'DATE' | 'PLACE'; activityTitle: string; optionLabel: string;
  activityRevision: number; pollRevision: number; activityVersion: string; pollVersion: string; placeVersion?: string;
  before: PollActivityValues; after: PollActivityValues;
  beforeLabel: string; afterLabel: string; notes: string[];
}

const values = (activity: TogetherState['activities'][number]): PollActivityValues => ({
  date: activity.date, endDate: activity.endDate, startTime: activity.startTime || '',
  meetingPoint: activity.meetingPoint, ...(activity.venuePlaceId ? { venuePlaceId: activity.venuePlaceId } : {}),
});
const dateLabel = (value: PollActivityValues) => `${value.date || '날짜 미정'}${value.endDate && value.endDate !== value.date ? ` ~ ${value.endDate}` : ''} · ${value.startTime || '시각 미정'} (한국 시각)`;
const moveDay = (day: string, days: number) => {
  const instant = Date.parse(`${day}T00:00:00Z`) + days * 86400000;
  const next = Number.isFinite(instant) ? new Date(instant).toISOString().slice(0, 10) : '';
  if (!validCalendarDay(next)) throw new Error('변경할 여행 기간을 다시 확인해 주세요.');
  return next;
};

/** Only a confirmed typed winner from this exact appointment can propose its date or venue. */
export function previewPollActivityApplication(state: TogetherState, actorId: string, scope: PollActivityApplicationScope, places: Place[], at = new Date()): PollActivityApplicationPreview {
  if (!Number.isFinite(at.getTime())) throw new Error('현재 시각을 다시 확인해 주세요.');
  const poll = state.polls.find(item => item.id === scope.pollId && item.groupId === scope.groupId && item.activityId === scope.activityId);
  const source = state.activities.find(item => item.id === scope.activityId && item.groupId === scope.groupId);
  if (!scope.activityId || !poll || !source) throw new Error('이 투표가 속한 약속에서 다시 확인해 주세요.');
  const activity = assertCurrentActivityEditor(state, actorId, scope.groupId, scope.activityId, source.revision);
  if (activity.status !== 'PLANNED' || validCalendarDay(activity.endDate || activity.date) && (activity.endDate || activity.date) < koreaDay(at)) throw new Error('지난·완료·취소된 약속에는 투표 결과를 반영할 수 없어요.');
  if (!isTogetherPollFields(poll) || poll.closed !== true || !poll.confirmedOptionId || poll.options.length < 2 || poll.options.length > 12
    || poll.options.some(item => typeof item.id !== 'string' || !item.id.trim() || typeof item.label !== 'string' || !item.label.trim() || !Array.isArray(item.voterIds))
    || new Set(poll.options.map(item => item.id)).size !== poll.options.length
    || poll.options.filter(item => item.id === poll.confirmedOptionId).length !== 1) throw new Error('투표 결과와 후보를 먼저 확인해 주세요.');
  const option = poll.options.find(item => item.id === poll.confirmedOptionId)!;
  const before = values(activity), after = { ...before }, notes: string[] = [];
  let kind: 'DATE' | 'PLACE', placeVersion: string | undefined;
  if (poll.kind === 'DATE') {
    kind = 'DATE';
    if (!validCalendarDay(option.date) || option.date < koreaDay(at)) throw new Error('오늘 이후의 확정된 날짜만 일정에 반영할 수 있어요.');
    if (activity.date && !validCalendarDay(activity.date) || activity.endDate && (!validCalendarDay(activity.endDate) || !activity.date || activity.endDate < activity.date)) throw new Error('기존 일정의 날짜를 먼저 확인해 주세요.');
    if (activity.journey?.days.some(day => day.places.some(place => place.bookingFixed))
      && (activity.date !== option.date || activity.journey.days.some((day, index) => day.date !== moveDay(option.date!, index)))) throw new Error('예약 고정된 방문이 있어 날짜를 옮길 수 없어요. 일정 편집에서 예약과 고정 상태를 먼저 확인해 주세요.');
    after.date = option.date; after.startTime = option.time || '';
    if (activity.journey) {
      if (!activity.journey.days.length || activity.journey.days.length > 366) throw new Error('여행 DAY 구성을 먼저 확인해 주세요.');
      after.endDate = moveDay(option.date, activity.journey.days.length - 1);
      if (activity.journey.days.length > 1) notes.push(`${activity.journey.days.length}일의 여행 기간과 방문 순서를 유지하고 DAY 날짜를 함께 옮겨요.`);
    } else if (before.date && before.endDate) {
      after.endDate = moveDay(option.date, Math.round((Date.parse(`${before.endDate}T00:00:00Z`) - Date.parse(`${before.date}T00:00:00Z`)) / 86400000));
      if (before.endDate !== before.date) notes.push('기존 여행 기간을 유지하고 종료 날짜도 함께 옮겨요.');
    }
    if (!option.time && before.startTime) notes.push('선택한 후보에 시각이 없어 기존 시작 시각은 미정으로 바뀌어요.');
  } else if (option.placeId && !option.date && !option.time) {
    kind = 'PLACE';
    const place = resolveScopedPollPlace(state, actorId, poll, option.id, places);
    if (!place || place.id !== option.placeId) throw new Error('현재 장소 정보를 찾지 못했어요. 다른 장소 후보를 확인해 주세요.');
    placeVersion = JSON.stringify(place);
    after.venuePlaceId = place.id;
    after.meetingPoint = [place.name, place.address || place.area].filter(Boolean).join(' · ');
    notes.push('만날 장소만 바꾸며 동선의 방문 장소·순서는 유지해요.');
  } else throw new Error('날짜 투표나 장소 ID가 있는 후보만 일정에 반영할 수 있어요. 텍스트 후보는 일정에서 직접 확인해 주세요.');
  const sameDate = kind === 'DATE' && before.date === after.date && (before.endDate || before.date) === (after.endDate || after.date)
    && before.startTime === after.startTime && !activity.journey?.days.some((day, index) => day.date !== moveDay(after.date, index));
  if (sameDate || JSON.stringify(before) === JSON.stringify(after)) throw new Error('이 확정안은 이미 일정에 반영되어 있어요.');
  return { groupId: scope.groupId, activityId: scope.activityId, pollId: scope.pollId, actorId, optionId: option.id, kind, activityTitle: activity.title, optionLabel: option.label,
    activityRevision: activity.revision, pollRevision: poll.revision ?? 0, activityVersion: JSON.stringify(activity), pollVersion: JSON.stringify(poll),
    ...(placeVersion ? { placeVersion } : {}), before, after,
    beforeLabel: kind === 'DATE' ? dateLabel(before) : before.meetingPoint || '만날 장소 미정',
    afterLabel: kind === 'DATE' ? dateLabel(after) : after.meetingPoint, notes };
}

/** Execute in repository.update. A changed poll, appointment or catalogue requires a new review. */
export function applyPollActivityApplication(state: TogetherState, actorId: string, reviewed: PollActivityApplicationPreview, places: Place[], at = new Date()) {
  if (!reviewed || reviewed.actorId !== actorId || !Number.isInteger(reviewed.activityRevision) || !Number.isInteger(reviewed.pollRevision)) throw new Error('현재 계정으로 변경 내용을 다시 확인해 주세요.');
  const fresh = previewPollActivityApplication(state, actorId, reviewed, places, at);
  if (JSON.stringify(fresh) !== JSON.stringify(reviewed)) throw new Error('투표·일정·장소가 변경됐어요. 최신 변경안을 다시 확인해 주세요.');
  const activity = assertCurrentActivityEditor(state, actorId, reviewed.groupId, reviewed.activityId, reviewed.activityRevision);
  // Derive from fresh canonical sources, never from editable fields in the preview object.
  if (fresh.kind === 'DATE') {
    const journey = activity.journey ? setPlanDates(activity.journey, fresh.after.date) : undefined;
    activity.date = fresh.after.date; activity.endDate = fresh.after.endDate; activity.startTime = fresh.after.startTime || undefined;
    if (journey) activity.journey = journey;
  } else { activity.venuePlaceId = fresh.after.venuePlaceId; activity.meetingPoint = fresh.after.meetingPoint; }
  activity.revision += 1;
  unpublishActivityFromGroup(state, activity.id);
  return activity;
}
