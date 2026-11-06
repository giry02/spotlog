import type { Place, PlaceKind } from '../data';
import { filterHomePlaces, homePlacePreview, publicPlaceRegion, type HomeRegionReference } from '../homeDiscovery.ts';
import type { GroupTopic, TogetherGroup, TogetherState } from '../together/model';
import { discoveryProfile, filterDiscoveryGroups, isDiscoverableGroup, publicActivityTimeKey, topicOptions, upcomingPublicActivities, type PublicDiscoveryActivity } from '../together/discovery.ts';

export type DiscoveryHomeView = 'recommended' | 'meetups' | 'groups' | 'places' | 'trips';
export type DiscoveryPurpose = 'FOOD' | 'CAFE' | 'WALK' | 'CULTURE' | 'FAMILY' | 'TRAVEL';
export interface DiscoveryHomeFilters { region: string; district?: string; query: string; purpose?: DiscoveryPurpose }
export const discoveryPurposes: ReadonlyArray<{ id: DiscoveryPurpose; label: string; topic: GroupTopic; placeKind: PlaceKind | 'ALL' }> = [
  { id: 'FOOD', label: '맛집', topic: 'FOOD', placeKind: 'FOOD' },
  { id: 'CAFE', label: '카페', topic: 'CAFE', placeKind: 'CAFE' },
  { id: 'WALK', label: '산책', topic: 'WALK', placeKind: 'LANDMARK' },
  { id: 'CULTURE', label: '취미', topic: 'CULTURE', placeKind: 'LEISURE' },
  { id: 'FAMILY', label: '가족', topic: 'FAMILY', placeKind: 'ALL' },
  { id: 'TRAVEL', label: '여행', topic: 'TRAVEL', placeKind: 'ALL' },
];
export interface DiscoveryGroupCard {
  id: string; name: string; cover: string; region: string; district: string; category: string;
  welcome: string; topics: GroupTopic[]; example: boolean; joined: boolean; joinMode: 'DIRECT' | 'APPROVAL';
}
export interface DiscoveryMeetupCard { group: DiscoveryGroupCard; activity: PublicDiscoveryActivity }

const normalize = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase('ko-KR');
const matches = (query: string, fields: string[]) => !query || normalize(fields.join(' ')).includes(query);
const groupCard = (group: TogetherGroup, viewerId: string): DiscoveryGroupCard => {
  const profile = discoveryProfile(group);
  return {
    id: group.id, name: group.name, cover: group.cover, region: group.region, district: profile.district,
    category: topicOptions.find(topic => topic.id === profile.topics[0])?.label || '모임',
    welcome: profile.welcome, topics: [...profile.topics], example: group.sourceKind === 'EXAMPLE',
    joined: Boolean(viewerId && group.memberIds.includes(viewerId)), joinMode: profile.joinMode === 'DIRECT' ? 'DIRECT' : 'APPROVAL',
  };
};

/** Only public promotion fields cross this boundary; member content never enters a home card. */
export function selectDiscoveryHome(state: TogetherState, places: ReadonlyArray<Place>, references: ReadonlyArray<HomeRegionReference>, filters: DiscoveryHomeFilters, viewerId = '', at = new Date()) {
  const region = filters.region.trim(), query = normalize(filters.query);
  const purpose = discoveryPurposes.find(item => item.id === filters.purpose);
  const district = filters.district?.trim() || '';
  const baseGroups = filterDiscoveryGroups(state, { region, district, topic: purpose?.topic, sort: 'EDITORIAL' }, at);
  const groups = baseGroups.filter(group => {
    const profile = discoveryProfile(group);
    return matches(query, [group.name, group.region, profile.district, group.introduction, profile.welcome, ...profile.topics.map(id => topicOptions.find(topic => topic.id === id)?.label || '')]);
  }).map(group => groupCard(group, viewerId));
  const meetups: DiscoveryMeetupCard[] = baseGroups.flatMap(group => {
    const card = groupCard(group, viewerId);
    return upcomingPublicActivities(state, group, at)
      .filter(activity => matches(query, [activity.title, activity.description, card.name, card.region, card.district, ...card.topics.map(id => topicOptions.find(topic => topic.id === id)?.label || '')]))
      .map(activity => ({ group: card, activity }));
  }).sort((left, right) => publicActivityTimeKey(left.activity.date, left.activity.startTime).localeCompare(publicActivityTimeKey(right.activity.date, right.activity.startTime)));
  // Callers supply the same approved place catalogue used by customer discovery.
  const matchingPlaces = filterHomePlaces(places, { region, district, query: filters.query, kind: purpose?.placeKind }, references);
  const regions = [...new Set([
    ...places.map(place => publicPlaceRegion(place, references)),
    ...state.groups.filter(isDiscoverableGroup).map(group => group.region),
  ].filter(value => value && value !== '지역 미정'))];
  // Keep a selected region visible even after its last public item is withdrawn.
  if (region && !regions.includes(region)) regions.push(region);
  return {
    regions, groups, meetups, places: homePlacePreview(matchingPlaces, matchingPlaces.length),
    groupFilters: { region, ...(district ? { district } : {}), query: filters.query.trim(), topic: purpose?.topic, dateFilter: 'ALL' as const, sort: 'SOONEST' as const },
    placeFilters: { region, ...(district ? { district } : {}), query: filters.query.trim(), kind: purpose?.placeKind || 'ALL' as const },
  };
}
