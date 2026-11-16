import type { Place, PlaceKind } from '../data';
import { isMember, memberName, type TogetherActivity, type TogetherState } from './model.ts';
import { businessPurposes, isTogetherPlaceFeedback, placeExperienceTags } from './businessAssessments.ts';
import type { BusinessPurpose, PlaceExperienceTag, TogetherPlaceFeedback } from './businessAssessmentTypes';
import { koreaDay } from './discovery.ts';

export type GroupTasteSource = { kind: 'ALL' } | { kind: 'GROUP' } | { kind: 'ACTIVITY'; activityId: string };
export interface GroupTasteFilters {
  source?: GroupTasteSource;
  kind?: PlaceKind | 'ALL';
  experienceTag?: PlaceExperienceTag | '';
  purpose?: BusinessPurpose | '';
  recommendedOnly?: boolean;
}
export interface GroupTasteRecord {
  id: string; authorId: string; authorName: string; activityId?: string; sourceTitle: string;
  rating: number; note: string; updatedAt: string; recommended: boolean;
  experienceTags: PlaceExperienceTag[]; purposes: BusinessPurpose[];
}
export interface GroupTastePlace {
  place: Place; records: GroupTasteRecord[]; reviewCount: number; memberCount: number;
  recommendationCount: number; averageRating: number;
  tagCounts: { tag: PlaceExperienceTag; count: number }[];
}
function validDay(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
/** A past appointment is a record scope, not proof that any member actually visited a place. */
function pastActivity(activity: TogetherActivity, today: string): boolean {
  if (activity.status === 'CANCELLED') return false;
  const finalDay = activity.endDate || activity.date;
  return activity.status === 'COMPLETED' || validDay(finalDay) && finalDay < today;
}
function checkedFilters(filters: GroupTasteFilters): Required<GroupTasteFilters> {
  const source = filters.source ?? { kind: 'ALL' };
  if (!source || !['ALL', 'GROUP', 'ACTIVITY'].includes(source.kind) || source.kind === 'ACTIVITY' && (typeof source.activityId !== 'string' || !source.activityId.trim())) throw new Error('기록을 볼 공간을 다시 선택해 주세요.');
  const kind = filters.kind ?? 'ALL', experienceTag = filters.experienceTag ?? '', purpose = filters.purpose ?? '';
  if (!['ALL', 'LANDMARK', 'FOOD', 'CAFE', 'STAY', 'SHOP', 'LEISURE'].includes(kind)
    || experienceTag && !placeExperienceTags.some(item => item.id === experienceTag)
    || purpose && !businessPurposes.some(item => item.id === purpose)
    || filters.recommendedOnly !== undefined && typeof filters.recommendedOnly !== 'boolean') throw new Error('취향 지도 조건을 다시 선택해 주세요.');
  return { source, kind, experienceTag, purpose, recommendedOnly: filters.recommendedOnly ?? false };
}

/** Explicit current-group feedback only. No personal saves, aliases, inferred tags or other groups enter this view. */
export function selectGroupTasteMemory(state: TogetherState, actorId: string, groupId: string, places: Place[], filters: GroupTasteFilters = {}, at = new Date()) {
  if (!Number.isFinite(at.getTime())) throw new Error('기록을 볼 기준 시간을 확인해 주세요.');
  const group = state.groups.find(item => item.id === groupId);
  if (!group || !actorId || !state.members.some(member => member.id === actorId) || !isMember(state, actorId, groupId) || group.blockedMemberIds?.includes(actorId)) throw new Error('현재 모임원만 우리 취향 지도를 볼 수 있어요.');
  const selected = checkedFilters(filters), today = koreaDay(at);
  const activities = state.activities.filter(activity => activity.groupId === groupId && pastActivity(activity, today));
  const activityById = new Map(activities.map(activity => [activity.id, activity]));
  const catalog = new Map(places.filter(place => !place.personal && place.id && place.name.trim()).map(place => [place.id, place]));
  const currentAuthor = (id: string) => state.members.some(member => member.id === id) && group.memberIds.includes(id) && !group.blockedMemberIds?.includes(id);
  const seenIds = new Set<string>(), seenAuthors = new Set<string>();
  const eligible = (state.placeFeedback ?? []).filter((row): row is TogetherPlaceFeedback => {
    if (!isTogetherPlaceFeedback(row) || row.groupId !== groupId || row.withdrawnAt || !catalog.has(row.placeId) || !currentAuthor(row.authorId)) return false;
    if (row.activityId ? !activityById.has(row.activityId) : group.spaceType === 'ACTIVITY') return false;
    const key = JSON.stringify([row.activityId ?? null, row.placeId, row.authorId]);
    if (seenIds.has(row.id) || seenAuthors.has(key)) return false;
    seenIds.add(row.id); seenAuthors.add(key); return true;
  });
  const scoped = eligible.filter(row => selected.source.kind === 'ALL'
    || selected.source.kind === 'GROUP' && !row.activityId
    || selected.source.kind === 'ACTIVITY' && row.activityId === selected.source.activityId);
  const matched = scoped.filter(row => (selected.kind === 'ALL' || catalog.get(row.placeId)!.kind === selected.kind)
    && (!selected.experienceTag || row.experienceTags?.includes(selected.experienceTag))
    && (!selected.purpose || row.purposes.includes(selected.purpose)) && (!selected.recommendedOnly || row.recommended));
  const buckets = new Map<string, TogetherPlaceFeedback[]>();
  for (const row of matched) buckets.set(row.placeId, [...(buckets.get(row.placeId) ?? []), row]);
  const items: GroupTastePlace[] = [...buckets].map(([placeId, rows]) => {
    const records = rows.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)).map(row => ({
      id: row.id, authorId: row.authorId, authorName: memberName(state, row.authorId, groupId), ...(row.activityId ? { activityId: row.activityId } : {}),
      sourceTitle: row.activityId ? activityById.get(row.activityId)!.title : '모임 전체', rating: row.rating, note: row.note,
      updatedAt: row.updatedAt, recommended: row.recommended, experienceTags: [...(row.experienceTags ?? [])], purposes: [...row.purposes],
    }));
    return { place: structuredClone(catalog.get(placeId)!), records, reviewCount: records.length,
      memberCount: new Set(records.map(row => row.authorId)).size, recommendationCount: records.filter(row => row.recommended).length,
      averageRating: Math.round(records.reduce((sum, row) => sum + row.rating, 0) / records.length * 10) / 10,
      tagCounts: placeExperienceTags.map(tag => ({ tag: tag.id, count: records.filter(row => row.experienceTags.includes(tag.id)).length })).filter(row => row.count > 0) };
  }).sort((a, b) => b.recommendationCount - a.recommendationCount || b.reviewCount - a.reviewCount || a.place.name.localeCompare(b.place.name, 'ko'));
  return { group: { id: group.id, name: group.name, archived: group.archived }, items,
    canAddFeedback: !group.archived || Boolean(group.temporaryRoom && group.temporaryRoom.disposition !== 'TRASH'),
    activities: activities.map(activity => ({ id: activity.id, title: activity.title, date: activity.date })).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)),
    hasGroupScope: group.spaceType !== 'ACTIVITY',
    totalRecordCount: eligible.length, scopedRecordCount: scoped.length, matchedRecordCount: matched.length,
    totalPlaceCount: new Set(eligible.map(row => row.placeId)).size };
}

/** Re-resolve a displayed source after membership, withdrawal, catalogue or activity status changes. */
export function resolveGroupTasteSource(state: TogetherState, actorId: string, groupId: string, recordId: string, places: Place[], at = new Date()) {
  const memory = selectGroupTasteMemory(state, actorId, groupId, places, {}, at);
  for (const item of memory.items) {
    const record = item.records.find(row => row.id === recordId);
    if (record) return { place: item.place, record };
  }
  return null;
}
