import type { GroupTopic, TogetherState } from '../together/model';
import { discoveryProfile, topicOptions } from '../together/discovery.ts';
import { groupDiscoveryCollections, type GroupDiscoveryFilters } from '../together/groupDiscoveryModel.ts';
import { getGroupSubtopic, groupSubtopicsFor } from '../together/groupTaxonomy.ts';
import { selectDiscoveryHome, type DiscoveryGroupCard, type DiscoveryHomeFilters } from './discoveryHomeModel.ts';
import { matchesSavedGroupInterests, type GroupInterestSelection } from '../groupInterestStore.ts';

export interface HomeGroupTopicSection {
  id: string; title: string; emoji: string; topics: GroupTopic[]; groups: DiscoveryGroupCard[];
}
const homeInterestOrder: GroupTopic[] = ['SOCIAL', 'FOOD', 'CAFE', 'OUTDOOR', 'SPORTS', 'BOOK', 'CULTURE', 'GAME', 'TRAVEL', 'PHOTO', 'WALK', 'MUSIC', 'LANGUAGE', 'CRAFT', 'PETS', 'FAMILY'];

/** The existing public DTO boundary remains authoritative; layout never reads member records or attendance. */
export function selectGroupDiscoveryHome(state: TogetherState, filters: DiscoveryHomeFilters, viewerId = '', at = new Date()) {
  const source = selectDiscoveryHome(state, [], [], filters, viewerId, at);
  const inaccessible = new Set(viewerId ? state.groups.filter(group => group.blockedMemberIds?.includes(viewerId)).map(group => group.id) : []);
  const seenGroups = new Set<string>();
  const groups = source.groups.filter(group => {
    if (inaccessible.has(group.id) || seenGroups.has(group.id)) return false;
    seenGroups.add(group.id); return true;
  });
  // An activity-title search may find an approved event even when the host name does not match.
  const seenActivities = new Set<string>();
  const meetups = source.meetups.filter(item => {
    const key = `${item.group.id}:${item.activity.id}`;
    if (inaccessible.has(item.group.id) || seenActivities.has(key)) return false;
    seenActivities.add(key); return true;
  });
  const featured = groups.slice(0, 4), used = new Set(featured.map(group => group.id));
  const priorities = ['sports', 'social', 'books', 'outdoor'];
  const collections = [...priorities.flatMap(id => { const collection = groupDiscoveryCollections.find(item => item.id === id); return collection ? [collection] : []; }),
    ...groupDiscoveryCollections.filter(item => !priorities.includes(item.id))];
  const topics: HomeGroupTopicSection[] = [];
  for (const collection of collections) {
    if (!collection.topics?.length) continue;
    const available = groups.filter(group => !used.has(group.id) && collection.topics!.some(topic => group.topics.includes(topic))).slice(0, 2);
    if (!available.length) continue;
    available.forEach(group => used.add(group.id));
    topics.push({ id: collection.id, title: collection.title, emoji: collection.emoji, topics: [...collection.topics], groups: available });
  }
  return { groups, featured, meetups, topics, filters: { ...source.groupFilters, useMyRegion: false } satisfies GroupDiscoveryFilters,
    interests: [...topicOptions].sort((left, right) => {
      const leftIndex = homeInterestOrder.indexOf(left.id), rightIndex = homeInterestOrder.indexOf(right.id);
      return (leftIndex < 0 ? homeInterestOrder.length : leftIndex) - (rightIndex < 0 ? homeInterestOrder.length : rightIndex);
    }).map(topic => ({ id: topic.id, label: topic.label, emoji: topic.emoji, subtopics: groupSubtopicsFor(topic.id).map(item => ({ id: item.id, label: item.label, emoji: item.emoji })) })) };
}

export type GroupDiscoveryHomeProjection = ReturnType<typeof selectGroupDiscoveryHome>;

/** Dedicated opt-in section only; the ordinary regional projection is left intact. */
export function selectHomeSavedInterestGroups(state: TogetherState, filters: DiscoveryHomeFilters, selection: GroupInterestSelection, viewerId = '', at = new Date()): DiscoveryGroupCard[] {
  const projection = selectGroupDiscoveryHome(state, filters, viewerId, at);
  return projection.groups.filter(card => {
    const group = state.groups.find(item => item.id === card.id);
    if (!group) return false;
    const profile = discoveryProfile(group);
    return matchesSavedGroupInterests({ topics: profile.topics, subtopics: profile.subtopics }, selection);
  });
}

/** A home handoff always carries the chosen region, district and literal query into the real listing. */
export function groupHomeListingFilters(base: GroupDiscoveryFilters, destination:
  { kind: 'GROUPS' | 'MEETUPS' } | { kind: 'TOPIC'; topic: GroupTopic; subtopic?: string } | { kind: 'COLLECTION'; id: string }): GroupDiscoveryFilters {
  const filters: GroupDiscoveryFilters = { ...base, useMyRegion: false, publicActivityIntent: undefined, collectionId: undefined,
    section: destination.kind === 'MEETUPS' ? 'MEETUPS' : 'ALL', view: destination.kind === 'MEETUPS' ? 'MEETUPS' : 'GROUPS' };
  if (destination.kind === 'TOPIC') {
    if (!topicOptions.some(item => item.id === destination.topic) || destination.subtopic && getGroupSubtopic(destination.subtopic)?.parent !== destination.topic) throw new Error('관심사를 다시 선택해 주세요.');
    return { ...filters, topic: destination.topic, subtopic: destination.subtopic, categoryTopics: undefined };
  }
  if (destination.kind === 'COLLECTION') {
    if (!groupDiscoveryCollections.some(item => item.id === destination.id && item.topics?.length)) throw new Error('모임 분류를 다시 선택해 주세요.');
    return { ...filters, collectionId: destination.id };
  }
  return filters;
}
