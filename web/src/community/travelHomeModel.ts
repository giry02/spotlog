import type { Journey, Place } from '../data';
import type { HomeTripTemplate } from '../consumerPublicSeed';
import { filterHomePlaces, homePlacePreview, publicPlaceRegion, type HomeRegionReference } from '../homeDiscovery.ts';
import { discoveryPurposes, type DiscoveryPurpose } from './discoveryHomeModel.ts';

export type HomeTravelDuration = 'ALL' | 'DAY' | 'TWO' | 'THREE' | 'LONG';
export const homeTravelDurations: ReadonlyArray<{ id: HomeTravelDuration; label: string }> = [
  { id: 'ALL', label: '기간 전체' }, { id: 'DAY', label: '당일' }, { id: 'TWO', label: '1박 2일' },
  { id: 'THREE', label: '2박 3일' }, { id: 'LONG', label: '4일 이상' },
];
export interface TravelHomeFilters { region: string; district?: string; query: string; duration?: HomeTravelDuration; purpose?: DiscoveryPurpose }
export interface HomeTravelCourseCard {
  id: string; title: string; region: string; duration: string; dayCount: number;
  cover: string; summary: string; placeCount: number; sourceKind: NonNullable<Journey['publicSourceKind']>;
}
export interface HomeTravelJournalCard {
  id: string; title: string; region: string; duration: string; cover: string; author: string;
  placeCount: number; sourceKind: NonNullable<Journey['publicSourceKind']>;
}
const normalize = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase('ko-KR');
const matchesQuery = (query: string, values: string[]) => !query || normalize(values.join(' ')).includes(query);

export function matchesHomeTravelDuration(days: number, duration: HomeTravelDuration = 'ALL'): boolean {
  if (duration === 'ALL') return true;
  if (!Number.isInteger(days) || days < 1) return false;
  return duration === 'DAY' ? days === 1 : duration === 'TWO' ? days === 2 : duration === 'THREE' ? days === 3 : days >= 4;
}

/** Local drafts and device-owned journeys must never enter public recommendation cards. */
export function isPublicHomeJournal(journey: Journey): boolean {
  return journey.visibility === 'PUBLIC' && journey.status === 'PUBLISHED' && !journey.isMine
    && !journey.trash && journey.purpose !== 'PLAN' && journey.recommendationKind !== 'AI';
}

/** This projection accepts approved catalogues from App; it never reads personal libraries or storage. */
export function selectTravelHomeContent(templates: ReadonlyArray<HomeTripTemplate>, journals: ReadonlyArray<Journey>,
  places: ReadonlyArray<Place>, references: ReadonlyArray<HomeRegionReference>, filters: TravelHomeFilters) {
  const region = filters.region.trim(), district = normalize(filters.district || ''), query = normalize(filters.query);
  const placeKind = discoveryPurposes.find(item => item.id === filters.purpose)?.placeKind || 'ALL';
  const approvedPlaces = new Map(places.map(place => [place.id, place]));
  const inScope = (itemRegion: string, itemPlaces: Place[]) => (!region || itemRegion === region
    || itemPlaces.some(place => publicPlaceRegion(place, references) === region))
    && (!district || itemPlaces.some(place => normalize(`${place.area} ${place.address || ''}`).includes(district)))
    && (placeKind === 'ALL' || itemPlaces.some(place => place.kind === placeKind));
  const courses: HomeTravelCourseCard[] = [];
  const seenCourses = new Set<string>();
  for (const template of templates) {
    if (seenCourses.has(template.id) || template.publicJourney && !isPublicHomeJournal(template.publicJourney)) continue;
    const currentPlaces = template.places.flatMap(place => { const current = approvedPlaces.get(place.id); return current ? [current] : []; });
    if (!currentPlaces.length || !matchesHomeTravelDuration(template.dayCount, filters.duration) || !inScope(template.region, currentPlaces)) continue;
    if (!matchesQuery(query, [template.title, template.summary, template.region, template.duration, template.eyebrow,
      ...currentPlaces.flatMap(place => [place.name, place.area])])) continue;
    seenCourses.add(template.id);
    courses.push({ id: template.id, title: template.title, region: template.region, duration: template.duration,
      dayCount: template.dayCount, cover: template.cover, summary: template.summary,
      placeCount: new Set(currentPlaces.map(place => place.id)).size, sourceKind: template.publicJourney?.publicSourceKind || 'EDITORIAL' });
  }
  const publicJournals: HomeTravelJournalCard[] = [];
  const seenJournals = new Set<string>();
  for (const journal of journals) {
    if (!isPublicHomeJournal(journal) || seenJournals.has(journal.id)) continue;
    const publishedPlaces = journal.days.flatMap(day => day.places);
    const journalPlaces = publishedPlaces.flatMap(place => { const current = approvedPlaces.get(place.id); return current ? [current] : []; });
    // A withdrawn place cannot reappear through a stale published journey snapshot.
    // Keep the original journal intact; omit its recommendation until its public route is reviewable again.
    if (publishedPlaces.length !== journalPlaces.length) continue;
    // Search only the published presentation fields, never planning preferences, notes or bookings.
    if (!matchesHomeTravelDuration(journal.days.length, filters.duration) || !inScope(journal.region, journalPlaces)) continue;
    if (!matchesQuery(query, [journal.title, journal.summary, journal.region, journal.author, journal.duration,
      ...journal.tags, ...journalPlaces.flatMap(place => [place.name, place.area])])) continue;
    seenJournals.add(journal.id);
    publicJournals.push({ id: journal.id, title: journal.title, region: journal.region, duration: journal.duration,
      cover: journal.cover, author: journal.author, placeCount: new Set(journalPlaces.map(place => place.id)).size,
      sourceKind: journal.publicSourceKind || 'PUBLIC_SAMPLE' });
  }
  const matchingPlaces = filterHomePlaces(places, { region, district: filters.district, query: '', kind: placeKind }, references)
    .filter(place => matchesQuery(query, [place.name, place.area, place.hook || '', place.description, ...(place.tags || [])]));
  return { courses, journals: publicJournals, places: homePlacePreview(matchingPlaces, matchingPlaces.length) };
}

export function homeJournalSourceLabel(kind: HomeTravelJournalCard['sourceKind']): string {
  return kind === 'SERVER' ? '여행자 기록' : kind === 'EDITORIAL' ? '운영 추천 여행기' : '공개 여행기 예시';
}
