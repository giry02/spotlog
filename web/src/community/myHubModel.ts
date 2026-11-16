import type { Journey } from '../data';
import type { MySection } from '../primaryNavigation.ts';
import type { TogetherActivity, TogetherState } from '../together/model';
import { isDiscoverableGroup, koreaDay } from '../together/discovery.ts';
import { buildMyGroupDirectory } from '../together/myGroupDirectory.ts';
import { selectMemberProfile } from '../together/memberProfile.ts';
import { selectMemberRecords, type MemberRecordTab } from '../together/memberRecords.ts';
import { isSafeTogetherImageUrl } from '../together/contentMedia.ts';
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

export interface MyOwnRecordScope {
  activityId?: string;
  title: string;
  counts: { journals: number; media: number; posts: number; comments: number };
  hasRecords: boolean;
}
export interface MyOwnGroupRecords {
  groupId: string;
  groupName: string;
  kind: TogetherState['groups'][number]['kind'];
  scopes: MyOwnRecordScope[];
  hasRecords: boolean;
}

export interface MyOwnRecordTarget {
  groupId: string;
  activityId?: string;
  type: 'POST' | 'MEDIA' | 'JOURNAL' | 'COMMENT';
  id: string;
  commentId?: string;
}
export interface MyOwnRecordEntry extends MyOwnRecordTarget {
  key: string;
  groupName: string;
  scopeTitle: string;
  title: string;
  excerpt: string;
  createdAt: string;
  tab: MemberRecordTab;
  photos: Array<{ id: string; url: string; caption: string }>;
  video: boolean;
}

/** Actual authored content, not membership cards or inferred attendance. Scopes use the existing directory access rules. */
export function myHubOwnRecordFeed(state: TogetherState, userId: string, at = new Date()): MyOwnRecordEntry[] {
  const entries: MyOwnRecordEntry[] = [];
  for (const group of myHubOwnGroupRecords(state, userId, at)) {
    for (const scope of group.scopes) {
      const records = selectMemberRecords(state, userId, group.groupId, userId, scope.activityId);
      if (!records) continue;
      const common = { groupId: group.groupId, ...(scope.activityId ? { activityId: scope.activityId } : {}), groupName: group.groupName, scopeTitle: scope.title };
      for (const post of records.posts) entries.push({ ...common, type: 'POST', id: post.id, key: `post:${post.id}`, title: post.title,
        excerpt: post.body, createdAt: post.createdAt, tab: 'posts', video: false,
        photos: (post.attachments || []).filter(photo => isSafeTogetherImageUrl(photo.url)).map(photo => ({ id: photo.id, url: photo.url, caption: photo.caption || post.title })) });
      for (const media of records.media) entries.push({ ...common, type: 'MEDIA', id: media.id, key: `media:${media.id}`,
        title: media.caption || (media.kind === 'VIDEO' ? '공유한 영상' : '공유한 사진'), excerpt: '', createdAt: media.createdAt, tab: 'media', video: media.kind === 'VIDEO',
        photos: media.kind === 'PHOTO' && isSafeTogetherImageUrl(media.url) ? [{ id: media.id, url: media.url, caption: media.caption || '공유한 사진' }] : [] });
      for (const journal of records.journals) entries.push({ ...common, type: 'JOURNAL', id: journal.id, key: `journal:${journal.id}`,
        title: journal.journey.title, excerpt: journal.journey.summary, createdAt: '', tab: 'journals', video: false, photos: [] });
      for (const comment of records.comments) entries.push({ ...common, type: 'COMMENT', id: comment.postId, commentId: comment.id, key: `comment:${comment.postId}:${comment.id}`,
        title: comment.postTitle, excerpt: comment.body, createdAt: comment.createdAt, tab: 'comments', video: false, photos: [] });
    }
  }
  return entries.sort((a, b) => {
    const left = Date.parse(a.createdAt), right = Date.parse(b.createdAt);
    return Number(!Number.isFinite(left)) - Number(!Number.isFinite(right)) || (Number.isFinite(left) && Number.isFinite(right) ? right - left : 0) || a.key.localeCompare(b.key);
  });
}

/** Recheck the actor, author and exact original before a record tile leaves My. */
export function resolveMyOwnRecordDestination(state: TogetherState, userId: string, target: MyOwnRecordTarget): MyOwnRecordEntry | null {
  return myHubOwnRecordFeed(state, userId).find(entry => entry.groupId === target.groupId && entry.activityId === target.activityId
    && entry.type === target.type && entry.id === target.id && entry.commentId === target.commentId) || null;
}

/** Count only the current actor's explicitly shared records in each exact reachable scope. */
export function myHubOwnGroupRecords(state: TogetherState, userId: string, at = new Date()): MyOwnGroupRecords[] {
  return myHubGroups(state, userId, at).groups.flatMap(({ group }) => {
    const projectScope = (title: string, activityId?: string): MyOwnRecordScope | null => {
      const profile = selectMemberProfile(state, userId, group.id, userId, activityId);
      if (!profile) return null;
      const { journals, media, posts, comments } = profile.counts;
      const counts = { journals, media, posts, comments };
      return { ...(activityId ? { activityId } : {}), title, counts, hasRecords: Object.values(counts).some(count => count > 0) };
    };
    const wholeGroup = projectScope('모임 전체');
    if (!wholeGroup) return [];
    const seen = new Set<string>();
    const activityScopes = state.activities.filter(activity => {
      if (activity.groupId !== group.id || seen.has(activity.id)) return false;
      seen.add(activity.id); return true;
    }).flatMap(activity => {
      const scope = projectScope(activity.title, activity.id);
      return scope?.hasRecords ? [scope] : [];
    });
    return [{ groupId: group.id, groupName: group.name, kind: group.kind, scopes: [wholeGroup, ...activityScopes],
      hasRecords: wholeGroup.hasRecords || activityScopes.length > 0 }];
  });
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
