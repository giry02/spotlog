import type { Journey } from '../data';
import type { MySection } from '../primaryNavigation.ts';
import type { TogetherActivity, TogetherState } from '../together/model';
import { isDiscoverableGroup, koreaDay } from '../together/discovery.ts';
import { buildMyGroupDirectory } from '../together/myGroupDirectory.ts';
import { memberAppointments, personalPlansForRange } from './platformModel.ts';

export type { MySection } from '../primaryNavigation.ts';
export interface MyScheduleItem {
  type: 'activity' | 'plan';
  id: string;
  date: string;
  time: string;
  activity?: TogetherActivity;
  plan?: Journey;
}

/** No persisted migration: the destination only reorganizes existing exact IDs. */
export function myHubSection(value: unknown): MySection {
  return value === 'groups' || value === 'travel' || value === 'records' ? value : 'schedule';
}

/** A My list is account-scoped, including when a stale local group still names a removed actor. */
export function myHubGroups(state: TogetherState, userId: string, at = new Date()) {
  const actorId = userId && state.members.some(member => member.id === userId) ? userId : '';
  const directory = buildMyGroupDirectory(state, actorId, {}, at);
  const pendingApplicationCount = actorId ? new Set(state.applications.filter(application => {
    if (application.userId !== actorId || application.status !== 'PENDING') return false;
    const group = state.groups.find(item => item.id === application.groupId);
    return group && isDiscoverableGroup(group) && !group.blockedMemberIds?.includes(actorId) && !group.memberIds.includes(actorId);
  }).map(application => application.groupId)).size : 0;
  return { ...directory, pendingApplicationCount };
}

function uniqueOwnJourneys(journeys: ReadonlyArray<Journey>, plans: boolean): Journey[] {
  const seen = new Set<string>();
  return journeys.filter(journey => {
    if (!journey.isMine || journey.trash || (journey.purpose === 'PLAN') !== plans || seen.has(journey.id)) return false;
    seen.add(journey.id);
    return true;
  });
}

function firstPlanDate(plan: Journey): string {
  const valid = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date)
    && Number.isFinite(Date.parse(`${date}T12:00:00+09:00`)) && koreaDay(new Date(`${date}T12:00:00+09:00`)) === date;
  return plan.days.map(day => day.date).filter(valid).sort()[0] || (plan.startDate && valid(plan.startDate) ? plan.startDate : '');
}

/** Device records stay separate from membership; callers explicitly open the device sections. */
export function myHubContent(state: TogetherState, userId: string, plans: ReadonlyArray<Journey>, journals: ReadonlyArray<Journey>, today = koreaDay()) {
  const memberId = state.members.some(member => member.id === userId) ? userId : '';
  const ownPlans = uniqueOwnJourneys(plans, true);
  const ownJournals = uniqueOwnJourneys(journals, false);
  const activities = memberAppointments(state, memberId, 'upcoming', today);
  const undatedActivities = memberAppointments(state, memberId, 'undated', today);
  const pastActivities = memberAppointments(state, memberId, 'past', today);
  const datedPlans = personalPlansForRange(ownPlans, 'upcoming', today);
  const schedule: MyScheduleItem[] = [
    ...activities.map(activity => ({ type: 'activity' as const, id: activity.id, date: activity.date, time: activity.startTime || '23:59', activity })),
    ...datedPlans.map(plan => ({ type: 'plan' as const, id: plan.id, date: firstPlanDate(plan), time: '23:59', plan })),
  ].sort((left, right) => `${left.date}T${left.time}`.localeCompare(`${right.date}T${right.time}`) || left.id.localeCompare(right.id));
  return { schedule, undatedActivities, pastActivities, ownPlans, ownJournals, pastPlans: personalPlansForRange(ownPlans, 'past', today) };
}
