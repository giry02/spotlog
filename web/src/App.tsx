import {
  Award,
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Bell,
  BellOff,
  Bookmark,
  CalendarDays,
  Car,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Coffee,
  Compass,
  Copy,
  Crown,
  Edit3,
  Eye,
  Footprints,
  Globe2,
  Heart,
  Hotel,
  House,
  ImagePlus,
  Lock,
  Map as MapIcon,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Navigation,
  Clapperboard,
  Plus,
  Save,
  Route,
  Search,
  Share2,
  Sparkles,
  Star,
  Store,
  ThumbsUp,
  Trash2,
  Upload,
  UserRound,
  Utensils,
  Volume2,
  VolumeX,
  type LucideIcon,
} from 'lucide-react';
import busanHaeundaeCover from '../../assets/spotlog/busan-haeundae-blue-hour.webp';
import gangwonEastSeaCover from '../../assets/spotlog/gangwon-east-sea-sunrise.webp';
import seoulForestCover from '../../assets/spotlog/seoul-forest-evening.webp';
import 'maplibre-gl/dist/maplibre-gl.css';
import { type ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NotificationPreferences } from '../../shared/hybridBridge';
import {
  discoveryLandmarks,
  initialJourneys,
  placeCatalog,
  placeKindLabel,
  type Journey,
  type JourneyDay,
  type Place,
  type PlaceKind,
  type StoryBlock,
} from './data';
import { isNativeShell, notifyNavigationState, notifyReady, openExternal, previewCreatorNotification, shareContent, subscribeNavigationCommands, subscribeNotificationStatus, updateNotificationPreferences } from './nativeBridge';

type Tab = 'home' | 'community' | 'discover' | 'trips' | 'saved' | 'profile';
type PlaceView = 'VIDEO' | 'GUIDE';

interface SpotlogNavigationState {
  spotlog: true;
  depth: number;
  tab: Tab;
  placeView: PlaceView;
  journeyId: string | null;
  templateId: string | null;
  editorId: string | null;
}

interface HomeTripTemplate {
  id: string;
  region: string;
  eyebrow: string;
  title: string;
  summary: string;
  duration: string;
  dayCount: number;
  cover: string;
  places: Place[];
}

type TripDurationFilter = 'ALL' | 'DAY_TRIP' | 'ONE_NIGHT' | 'TWO_NIGHTS' | 'THREE_PLUS';

interface TripSearchFilters {
  destination: string;
  duration: TripDurationFilter;
}

const tripDurationOptions: Array<{ id: TripDurationFilter; label: string }> = [
  { id: 'ALL', label: '전체 기간' },
  { id: 'DAY_TRIP', label: '당일치기' },
  { id: 'ONE_NIGHT', label: '1박 2일' },
  { id: 'TWO_NIGHTS', label: '2박 3일' },
  { id: 'THREE_PLUS', label: '3박 이상' },
];

interface CreatorProfile {
  displayName: string;
  bio: string;
  avatar?: string;
}

interface JourneyComment {
  id: string;
  journeyId: string;
  author: string;
  body: string;
  createdAt: string;
  avatar?: string;
  authorCopies: number;
}

type CheerKey = 'LOVE' | 'BEST' | 'HELPFUL';

interface JourneyCheers {
  LOVE: number;
  BEST: number;
  HELPFUL: number;
  selected?: CheerKey;
}

type CheerStore = Record<string, JourneyCheers>;

const cheerOptions: Array<{ id: CheerKey; label: string; icon: LucideIcon }> = [
  { id: 'LOVE', label: '너무 좋아요', icon: Heart },
  { id: 'BEST', label: '최고예요', icon: Star },
  { id: 'HELPFUL', label: '동선이 유용해요', icon: ThumbsUp },
];

const creatorTiers: Array<{ min: number; label: string; shortLabel: string; icon: LucideIcon }> = [
  { min: 0, label: '새싹 기록자', shortLabel: '새싹', icon: Sparkles },
  { min: 10, label: '동네 가이드', shortLabel: '가이드', icon: Award },
  { min: 100, label: '여행 큐레이터', shortLabel: '큐레이터', icon: Star },
  { min: 1000, label: '루트 메이커', shortLabel: '루트메이커', icon: Route },
  { min: 5000, label: 'Spotlog 마스터', shortLabel: '마스터', icon: Crown },
];

const getCreatorTier = (copyCount: number) => [...creatorTiers].reverse().find((tier) => copyCount >= tier.min) ?? creatorTiers[0];
const getNextCreatorTier = (copyCount: number) => creatorTiers.find((tier) => tier.min > copyCount) ?? null;

const tabItems: Array<{ id: Tab; icon: LucideIcon; label: string }> = [
  { id: 'home', icon: House, label: '홈' },
  { id: 'community', icon: Globe2, label: '여행기' },
  { id: 'discover', icon: Compass, label: '장소' },
  { id: 'trips', icon: MapIcon, label: '내 여행' },
  { id: 'saved', icon: Bookmark, label: '저장' },
];

const statusLabel = { PLANNING: '계획 중', TRAVELING: '여행 중', PUBLISHED: '여행일기' } as const;
const storageKeys = {
  saved: 'spotlog.web.saved.v3',
  journeys: 'spotlog.web.journeys.v4',
  profile: 'spotlog.web.profile.v1',
  comments: 'spotlog.web.comments.v1',
  cheers: 'spotlog.web.cheers.v1',
  notifications: 'spotlog.web.notifications.v1',
};

const defaultNotificationPreferences: NotificationPreferences = { enabled: false, viewMilestone: 100 };

const defaultCreatorProfile: CreatorProfile = {
  displayName: 'Spotlog 여행자',
  bio: '국내 여행을 기록하는 중',
};

const defaultComments: JourneyComment[] = [
  { id: 'comment-jeju-1', journeyId: 'jeju-west-slow', author: '바다수집가', body: '사진만 예쁜 게 아니라 이동 순서가 현실적이라 그대로 담아가고 싶어요.', createdAt: '8월 22일', authorCopies: 86 },
  { id: 'comment-jeju-2', journeyId: 'jeju-west-slow', author: '주말여행러', body: '숙소를 중간에 둔 이유까지 적혀 있어서 정말 유용했습니다. 최고예요!', createdAt: '8월 21일', authorCopies: 14 },
  { id: 'comment-busan-1', journeyId: 'busan-oldtown-to-sea', author: '골목산책', body: '부산의 서로 다른 분위기를 이틀에 나눈 구성이 너무 좋아요.', createdAt: '8월 19일', authorCopies: 238 },
  { id: 'comment-gangwon-1', journeyId: 'gangwon-sea-and-river', author: '느린발걸음', body: '장소를 욕심내지 않는 일정이라 부모님과 가기 좋겠어요.', createdAt: '8월 17일', authorCopies: 32 },
  { id: 'comment-seoul-1', journeyId: 'seoul-seongsu-day', author: '도시산책자', body: '멀리 떠나지 않아도 하루 여행이 된다는 구성이 마음에 들어요.', createdAt: '8월 15일', authorCopies: 54 },
  { id: 'comment-suncheon-1', journeyId: 'suncheon-yeosu-three-days', author: '갈대밭노트', body: '순천의 초록에서 여수의 밤으로 넘어가는 흐름을 그대로 담았습니다.', createdAt: '8월 13일', authorCopies: 127 },
  { id: 'comment-east-1', journeyId: 'east-coast-four-days', author: '파도수집가', body: '강릉부터 고성까지 올라가는 방향이라 매일 풍경이 달라지는 게 좋아요.', createdAt: '8월 11일', authorCopies: 311 },
  { id: 'comment-south-1', journeyId: 'southern-road-five-days', author: '시장과바다', body: '긴 일정인데 하루마다 도시의 성격이 분명해서 따라가기 편해 보여요.', createdAt: '8월 9일', authorCopies: 73 },
];

const defaultCheers: CheerStore = {
  'jeju-west-slow': { LOVE: 186, BEST: 94, HELPFUL: 231 },
  'busan-oldtown-to-sea': { LOVE: 118, BEST: 76, HELPFUL: 143 },
  'gangwon-sea-and-river': { LOVE: 82, BEST: 41, HELPFUL: 109 },
  'jeju-west-weekend': { LOVE: 143, BEST: 71, HELPFUL: 168 },
  'seoul-seongsu-day': { LOVE: 97, BEST: 44, HELPFUL: 132 },
  'suncheon-yeosu-three-days': { LOVE: 174, BEST: 88, HELPFUL: 206 },
  'east-coast-four-days': { LOVE: 221, BEST: 119, HELPFUL: 274 },
  'southern-road-five-days': { LOVE: 263, BEST: 146, HELPFUL: 319 },
};

const readCreatorProfile = (): CreatorProfile => {
  try {
    const value = JSON.parse(localStorage.getItem(storageKeys.profile) ?? 'null') as Partial<CreatorProfile> | null;
    return value ? { ...defaultCreatorProfile, ...value } : defaultCreatorProfile;
  } catch {
    return defaultCreatorProfile;
  }
};

const readComments = (): JourneyComment[] => {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKeys.comments) ?? '[]') as JourneyComment[];
    if (!Array.isArray(stored)) return defaultComments;
    const ids = new Set(stored.map((comment) => comment.id));
    return [...defaultComments.filter((comment) => !ids.has(comment.id)), ...stored];
  } catch {
    return defaultComments;
  }
};

const readCheers = (): CheerStore => {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKeys.cheers) ?? '{}') as CheerStore;
    return Object.fromEntries(Object.entries(defaultCheers).map(([journeyId, cheers]) => [journeyId, { ...cheers, ...stored[journeyId] }]).concat(Object.entries(stored).filter(([journeyId]) => !defaultCheers[journeyId])));
  } catch {
    return defaultCheers;
  }
};

const readNotificationPreferences = (): NotificationPreferences => {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKeys.notifications) ?? 'null') as Partial<NotificationPreferences> | null;
    if (!stored || typeof stored.enabled !== 'boolean' || typeof stored.viewMilestone !== 'number' || stored.viewMilestone <= 0) return defaultNotificationPreferences;
    return { enabled: stored.enabled, viewMilestone: stored.viewMilestone };
  } catch {
    return defaultNotificationPreferences;
  }
};

const readSavedIds = () => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKeys.saved) ?? '[]');
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

const readJourneys = (): Journey[] => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKeys.journeys) ?? 'null');
    if (!Array.isArray(value) || !value.length) return publishedJourneySeeds;
    const stored = value as Journey[];
    const publishedGuides = publishedJourneySeeds.filter((journey) => !journey.isMine && journey.status === 'PUBLISHED');
    const guideById = new Map(publishedGuides.map((journey) => [journey.id, journey]));
    const refreshed = stored.map((journey) => {
      if (journey.isMine || !guideById.has(journey.id)) return journey;
      const seed = structuredClone(guideById.get(journey.id)!);
      return { ...seed, saves: Math.max(seed.saves, Number(journey.saves) || 0), views: Math.max(seed.views ?? 0, Number(journey.views) || 0) };
    });
    const storedIds = new Set(refreshed.map((journey) => journey.id));
    return [...publishedGuides.filter((journey) => !storedIds.has(journey.id)), ...refreshed];
  } catch {
    return publishedJourneySeeds;
  }
};

const makePlaceShareText = (place: Place) => `${place.name}\n${place.address}\n${place.description}\n\n카카오맵 길찾기\n${kakaoDirectionsUrl(place)}\n\nSpotlog 여행 기록에서 공유`;
const kakaoDirectionsUrl = (place: Place) => Number.isFinite(place.lat) && Number.isFinite(place.lng)
  ? `https://map.kakao.com/link/to/${encodeURIComponent(place.name)},${place.lat},${place.lng}`
  : `https://map.kakao.com/?q=${encodeURIComponent(`${place.name} ${place.address}`)}`;
const journeyPlaceCount = (journey: Journey) => journey.days.reduce((sum, day) => sum + day.places.length, 0);
const tripDurationLabel = (duration: TripDurationFilter) => tripDurationOptions.find((option) => option.id === duration)?.label ?? '전체 기간';
const matchesTripDuration = (durationText: string, filter: TripDurationFilter) => {
  if (filter === 'ALL') return true;
  if (filter === 'DAY_TRIP') return durationText.includes('당일') || durationText.includes('반나절');
  const nights = Number(durationText.match(/(\d+)\s*박/)?.[1] ?? -1);
  if (filter === 'ONE_NIGHT') return nights === 1;
  if (filter === 'TWO_NIGHTS') return nights === 2;
  return nights >= 3;
};
const matchesDestination = (destination: string, values: Array<string | undefined>) => {
  const query = destination.trim().toLocaleLowerCase('ko-KR');
  return !query || values.filter(Boolean).join(' ').toLocaleLowerCase('ko-KR').includes(query);
};
const isSpotlogNavigationState = (value: unknown): value is SpotlogNavigationState => {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<SpotlogNavigationState>;
  return state.spotlog === true
    && typeof state.depth === 'number'
    && ['home', 'community', 'discover', 'trips', 'saved', 'profile'].includes(String(state.tab))
    && ['VIDEO', 'GUIDE'].includes(String(state.placeView));
};
const spotlogNavigationUrl = (state: SpotlogNavigationState) => {
  const screen = state.editorId
    ? `edit-${state.editorId}`
    : state.journeyId
      ? `journey-${state.journeyId}`
      : state.templateId
        ? `recommendation-${state.templateId}`
        : state.tab === 'discover'
          ? `places-${state.placeView.toLowerCase()}`
          : state.tab;
  return `${window.location.pathname}${window.location.search}#${encodeURIComponent(screen)}`;
};
const navigationStateFromHash = (): SpotlogNavigationState => {
  const screen = decodeURIComponent(window.location.hash.replace(/^#/, '')) || 'home';
  const base: SpotlogNavigationState = { spotlog: true, depth: 0, tab: 'home', placeView: 'VIDEO', journeyId: null, templateId: null, editorId: null };
  if (screen === 'places-guide') return { ...base, tab: 'discover', placeView: 'GUIDE' };
  if (screen === 'places-video') return { ...base, tab: 'discover', placeView: 'VIDEO' };
  if (['home', 'community', 'trips', 'saved', 'profile'].includes(screen)) return { ...base, tab: screen as Tab };
  if (screen.startsWith('journey-')) return { ...base, journeyId: screen.slice('journey-'.length) };
  if (screen.startsWith('recommendation-')) return { ...base, templateId: screen.slice('recommendation-'.length) };
  if (screen.startsWith('edit-')) return { ...base, tab: 'trips', editorId: screen.slice('edit-'.length) };
  return base;
};
const navigationStateMatchesHash = (state: SpotlogNavigationState) => spotlogNavigationUrl(state).endsWith(window.location.hash || '#home');

const resizeImageFile = (file: File, maxWidth = 1600, quality = 0.82) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('사진을 읽을 수 없습니다.'));
  reader.onload = () => {
    const source = new Image();
    source.onerror = () => reject(new Error('사진 형식을 확인해 주세요.'));
    source.onload = () => {
      const scale = Math.min(1, maxWidth / source.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(source.width * scale));
      canvas.height = Math.max(1, Math.round(source.height * scale));
      canvas.getContext('2d')?.drawImage(source, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    source.src = String(reader.result);
  };
  reader.readAsDataURL(file);
});

type RouteSource = 'ROAD' | 'ESTIMATE';

interface RouteLeg {
  from: Place;
  to: Place;
  distanceKm: number;
  minutes: number;
  mode: 'WALK' | 'DRIVE';
}

interface RouteResult {
  source: RouteSource;
  coordinates: Array<[number, number]>;
  distanceKm: number;
  minutes: number;
  legs: RouteLeg[];
}

interface OsrmRoutePayload {
  code?: string;
  routes?: Array<{
    distance?: number;
    duration?: number;
    geometry?: { coordinates?: Array<[number, number]> };
    legs?: Array<{ distance?: number; duration?: number }>;
  }>;
}

const distanceKm = (from: Place, to: Place) => {
  const toRadians = (value: number) => value * Math.PI / 180;
  const latitudeDelta = toRadians(to.lat - from.lat);
  const longitudeDelta = toRadians(to.lng - from.lng);
  const fromLatitude = toRadians(from.lat);
  const toLatitude = toRadians(to.lat);
  const value = Math.sin(latitudeDelta / 2) ** 2 + Math.sin(longitudeDelta / 2) ** 2 * Math.cos(fromLatitude) * Math.cos(toLatitude);
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

const routeMode = (place: Place): RouteLeg['mode'] => place.move?.includes('도보') ? 'WALK' : 'DRIVE';
const roundMinutes = (value: number) => Math.max(5, Math.ceil(value / 5) * 5);

const parseDurationMinutes = (value: string) => {
  if (value.includes('숙박') || value.includes('박')) return null;
  const hourMatch = value.match(/(\d+)\s*시간/);
  const minuteMatch = value.match(/(\d+)\s*분/);
  const minutes = Number(hourMatch?.[1] ?? 0) * 60 + Number(minuteMatch?.[1] ?? 0);
  return minutes > 0 ? minutes : null;
};

const timeToMinutes = (value?: string) => {
  if (!value) return null;
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const formatClock = (value: number) => {
  const normalized = ((value % (24 * 60)) + (24 * 60)) % (24 * 60);
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
};

const scheduleCheckForLeg = (leg: RouteLeg) => {
  const fromStart = timeToMinutes(leg.from.time);
  const nextStart = timeToMinutes(leg.to.time);
  const stay = parseDurationMinutes(leg.from.duration);
  if (fromStart === null || nextStart === null || stay === null) return null;
  const arrival = fromStart + stay + leg.minutes;
  const margin = nextStart - arrival;
  return {
    margin,
    text: margin < 0
      ? `${Math.abs(margin)}분 부족 · ${formatClock(arrival)} 도착 예상`
      : `${margin}분 여유 · ${formatClock(arrival)} 도착 예상`,
  };
};

const makeEstimatedRoute = (places: Place[]): RouteResult => {
  const legs = places.slice(1).map((place, index) => {
    const from = places[index];
    const distance = distanceKm(from, place);
    const mode = routeMode(place);
    const minutes = mode === 'WALK' ? roundMinutes((distance / 4.5) * 60) : roundMinutes((distance / 25) * 60 + 8);
    return { from, to: place, distanceKm: distance, minutes, mode };
  });
  return {
    source: 'ESTIMATE',
    coordinates: places.map((place) => [place.lng, place.lat]),
    distanceKm: legs.reduce((sum, leg) => sum + leg.distanceKm, 0),
    minutes: legs.reduce((sum, leg) => sum + leg.minutes, 0),
    legs,
  };
};

const fetchRoadRoute = async (places: Place[], signal: AbortSignal): Promise<RouteResult> => {
  const coordinates = places.map((place) => `${place.lng},${place.lat}`).join(';');
  const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?alternatives=false&steps=false&overview=full&geometries=geojson`, { signal });
  if (!response.ok) throw new Error(`Route HTTP ${response.status}`);
  const payload = await response.json() as OsrmRoutePayload;
  const route = payload.code === 'Ok' ? payload.routes?.[0] : undefined;
  const geometry = route?.geometry?.coordinates;
  if (!route || !Array.isArray(geometry) || geometry.length < 2) throw new Error('Road route unavailable');
  const legs = places.slice(1).map((place, index) => {
    const roadLeg = route.legs?.[index];
    const from = places[index];
    const distance = Number(roadLeg?.distance ?? 0) / 1000 || distanceKm(from, place);
    const mode = routeMode(place);
    const minutes = mode === 'WALK' ? roundMinutes((distance / 4.5) * 60) : roundMinutes(Number(roadLeg?.duration ?? 0) / 60 || (distance / 25) * 60 + 8);
    return { from, to: place, distanceKm: distance, minutes, mode };
  });
  return {
    source: 'ROAD',
    coordinates: geometry,
    distanceKm: legs.reduce((sum, leg) => sum + leg.distanceKm, 0),
    minutes: legs.reduce((sum, leg) => sum + leg.minutes, 0),
    legs,
  };
};

const orderPlacesByDistance = (places: Place[]) => {
  if (places.length < 2) return [...places];
  const remaining = places.slice(1);
  const ordered = [places[0]];
  while (remaining.length) {
    const previous = ordered[ordered.length - 1];
    let nearestIndex = 0;
    remaining.forEach((candidate, index) => {
      if (distanceKm(previous, candidate) < distanceKm(previous, remaining[nearestIndex])) nearestIndex = index;
    });
    ordered.push(remaining.splice(nearestIndex, 1)[0]);
  }
  return ordered;
};

const buildAiJourneyDraft = (sourcePlaces: Place[], requestedDays: number, isSample: boolean, sourceLabel = '저장한 랜드마크'): Journey => {
  const uniquePlaces = Array.from(new Map(sourcePlaces.map((place) => [place.id, place])).values());
  const orderedPlaces = orderPlacesByDistance(uniquePlaces);
  const dayCount = Math.max(1, Math.min(requestedDays, orderedPlaces.length, 7));
  const broadRegions = Array.from(new Set(orderedPlaces.map((place) => place.area.split(' ')[0])));
  const region = broadRegions.length === 1 ? broadRegions[0] : '국내';
  const id = `journey-ai-${Date.now()}`;
  let offset = 0;

  const days: JourneyDay[] = Array.from({ length: dayCount }, (_, dayIndex) => {
    const remainingPlaces = orderedPlaces.length - offset;
    const remainingDays = dayCount - dayIndex;
    const placesForDay = orderedPlaces.slice(offset, offset + Math.ceil(remainingPlaces / remainingDays));
    offset += placesForDay.length;
    let startMinutes = 9 * 60 + 30;
    const plannedPlaces = placesForDay.map((place, placeIndex) => {
      const previous = placeIndex > 0 ? placesForDay[placeIndex - 1] : undefined;
      let move = '하루 시작';
      if (previous) {
        const distance = distanceKm(previous, place);
        const walk = distance < 1.2;
        const moveMinutes = walk ? roundMinutes((distance / 4.5) * 60) + 5 : roundMinutes((distance / 25) * 60 + 8) + 10;
        startMinutes += (parseDurationMinutes(previous.duration) ?? 60) + moveMinutes;
        move = `${walk ? '도보' : '차량'} 약 ${moveMinutes}분`;
      }
      return { ...place, time: formatClock(startMinutes), move };
    });
    const names = plannedPlaces.map((place) => place.name);
    const blockPrefix = `${id}-day-${dayIndex + 1}`;
    const blocks: StoryBlock[] = [
      {
        id: `${blockPrefix}-intro`,
        type: 'TEXT',
        heading: 'AI가 제안한 하루의 흐름',
        body: `${names.length > 1 ? `${names[0]}에서 시작해 ${names.slice(1, -1).length ? `${names.slice(1, -1).join(', ')}을 지나 ` : ''}${names[names.length - 1]}까지` : names[0]} 이어지는 동선입니다. 장소 수보다 머무는 시간을 우선해 하루가 너무 빡빡해지지 않도록 구성했습니다.\n\n이 글은 ${sourceLabel}의 위치와 체류시간을 바탕으로 만든 초안입니다. 실제 방문 전 운영시간과 현장 상황을 확인하고, 마음에 맞게 사진과 경험을 더해보세요.`,
      },
    ];
    plannedPlaces.forEach((place, placeIndex) => {
      blocks.push({ id: `${blockPrefix}-place-${placeIndex}`, type: 'PLACE', placeId: place.id });
      blocks.push({
        id: `${blockPrefix}-note-${placeIndex}`,
        type: 'TEXT',
        heading: `${place.name}에서 놓치지 않을 것`,
        body: `${place.description}\n\n좋은 점 · ${place.hook ?? `${place.area}의 분위기를 직접 보고 여행의 장면으로 남기기 좋습니다.`}\n\nAI 가이드 메모 · ${place.note}`,
      });
    });
    return {
      day: dayIndex + 1,
      date: `DAY ${dayIndex + 1}`,
      title: `${plannedPlaces[0]?.area ?? region}의 장면을 잇는 날`,
      story: `${names.join(' → ')} 순서로 이동합니다. 장소 사이 거리와 예상 체류시간을 기준으로 만든 편집 가능한 일정입니다.`,
      places: plannedPlaces,
      blocks,
    };
  });

  const duration = dayCount === 1 ? '당일 여행' : `${dayCount - 1}박 ${dayCount}일`;
  return {
    id,
    title: isSample ? `AI 제주 랜드마크 ${dayCount}일 샘플` : `AI가 엮은 ${region} 장면 여행`,
    region,
    dateRange: '날짜 미정 · AI 초안',
    duration,
    status: 'PLANNING',
    visibility: 'PRIVATE',
    cover: orderedPlaces[0].image,
    summary: `${sourceLabel} ${orderedPlaces.length}곳을 거리와 체류시간에 맞춰 ${dayCount}일 여행으로 엮었습니다.`,
    story: 'Spotlog AI 여행 만들기가 장소의 위치, 지역, 추천 시간과 체류시간을 읽어 첫 동선을 만들었습니다. 지도 경로를 확인한 뒤 일정과 글, 사진을 자유롭게 고쳐 나만의 여행기로 완성할 수 있습니다.',
    tags: ['AI초안', region, `${orderedPlaces.length}곳`],
    saves: 0,
    days,
    author: 'Spotlog AI · 나',
    isMine: true,
  };
};

const placesById = (ids: string[]) => ids.map((id) => placeCatalog.find((place) => place.id === id)).filter((place): place is Place => Boolean(place));

const homeTripTemplates: HomeTripTemplate[] = [
  {
    id: 'curation-jeju-west', region: '제주', eyebrow: '바다 · 차밭 · 오름', title: '제주 서쪽의 장면만 천천히', duration: '1박 2일', dayCount: 2,
    summary: '협재의 바다에서 안덕의 차밭과 해안, 새별오름까지 이어지는 느린 제주 일정입니다.',
    cover: discoveryLandmarks[0].image,
    places: placesById(['jeju-hyeopjae', 'jeju-osulloc', 'jeju-sagye', 'jeju-saebyeol']),
  },
  {
    id: 'curation-busan-coast', region: '부산', eyebrow: '원도심 · 해운대 · 기장', title: '부산의 오래된 골목과 새 바다', duration: '1박 2일', dayCount: 2,
    summary: '감천의 골목에서 시작해 해운대의 밤과 기장 해안까지 이동하는 부산 동서 여행입니다.',
    cover: busanHaeundaeCover,
    places: placesById(['busan-gamcheon', 'busan-signiel', 'busan-amso', 'busan-waveon']),
  },
  {
    id: 'curation-gangwon-slow', region: '강원', eyebrow: '동해 · 강변', title: '강릉의 아침, 정선의 느린 오후', duration: '1박 2일', dayCount: 2,
    summary: '안목해변의 아침 산책과 아우라지 강변의 오후를 각각 충분히 머무는 일정입니다.',
    cover: gangwonEastSeaCover,
    places: placesById(['gangneung-anmok', 'jeongseon-rail']),
  },
  {
    id: 'curation-seoul-halfday', region: '서울', eyebrow: '숲 · 골목 · 한강', title: '서울숲에서 한강까지 걷는 하루', duration: '당일 여행', dayCount: 1,
    summary: '서울숲의 초록에서 성수 골목을 지나 뚝섬의 저녁까지, 걸어서 이어지는 도심 하루 여행입니다.',
    cover: seoulForestCover,
    places: placesById(['seoul-seoulforest', 'seoul-seongsu-yeonbang', 'seoul-tukseom-hangang']),
  },
  {
    id: 'curation-suncheon-yeosu', region: '전남', eyebrow: '정원 · 갈대 · 여수 밤바다', title: '초록에서 밤바다로, 순천과 여수', duration: '2박 3일', dayCount: 3,
    summary: '순천의 정원과 갈대밭을 충분히 걷고 여수의 섬과 야경으로 마무리하는 2박 3일입니다.',
    cover: placesById(['suncheon-garden'])[0]?.image ?? gangwonEastSeaCover,
    places: placesById(['suncheon-garden', 'suncheon-bay', 'yeosu-odongdo', 'yeosu-dolsan']),
  },
  {
    id: 'curation-east-coast', region: '강원', eyebrow: '강릉 · 양양 · 속초 · 고성', title: '파도를 따라 북쪽으로 가는 동해안', duration: '3박 4일', dayCount: 4,
    summary: '강릉의 아침부터 양양의 해안, 속초의 시장과 고성의 잔잔한 바다까지 북쪽으로 이어갑니다.',
    cover: gangwonEastSeaCover,
    places: placesById(['gangneung-anmok', 'gangneung-ojukheon', 'yangyang-naksansa', 'yangyang-surfy', 'sokcho-yeonggeumjeong', 'sokcho-central-market', 'goseong-ayajin', 'goseong-cheonjin']),
  },
  {
    id: 'curation-southern-road', region: '남도', eyebrow: '전주 · 담양 · 순천 · 여수 · 통영', title: '골목과 정원, 섬을 잇는 남도 로드트립', duration: '4박 5일', dayCount: 5,
    summary: '전주의 골목에서 출발해 담양과 순천의 초록을 지나 여수와 통영의 바다에 닿는 긴 국내 여행입니다.',
    cover: busanHaeundaeCover,
    places: placesById(['jeonju-hanok', 'jeonju-nambu-market', 'damyang-juknokwon', 'damyang-metasequoia', 'suncheon-garden', 'suncheon-bay', 'yeosu-odongdo', 'yeosu-dolsan', 'tongyeong-dongpirang', 'tongyeong-mireuksan']),
  },
];

const publishTemplateJourney = (template: HomeTripTemplate, meta: { id: string; title: string; author: string; dateRange: string; saves: number; story: string }): Journey => {
  const generated = buildAiJourneyDraft(template.places, template.dayCount, false, '여행자가 고른 장소');
  return {
    ...generated,
    id: meta.id,
    title: meta.title,
    region: template.region,
    duration: template.duration,
    cover: template.cover,
    dateRange: meta.dateRange,
    status: 'PUBLISHED',
    visibility: 'PUBLIC',
    summary: template.summary,
    story: meta.story,
    tags: [template.region, template.duration, '여행자가이드'],
    saves: meta.saves,
    views: Math.round(meta.saves * 8.4),
    author: meta.author,
    isMine: false,
    days: generated.days.map((day) => ({
      ...day,
      blocks: day.blocks.map((block) => block.type !== 'TEXT' ? block : {
        ...block,
        heading: block.heading === 'AI가 제안한 하루의 흐름' ? '이 여행의 하루 흐름' : block.heading,
        body: block.body?.replace('AI 가이드 메모', '여행자 메모').replace('이 글은 여행자가 고른 장소의 위치와 체류시간을 바탕으로 만든 초안입니다.', '이 글은 실제로 고른 장소의 위치와 머문 시간을 바탕으로 정리한 여행 기록입니다.'),
      }),
    })),
  };
};

const previewTemplateJourney = (template: HomeTripTemplate): Journey => {
  const preview = publishTemplateJourney(template, {
    id: `preview-${template.id}`,
    title: template.title,
    author: 'Spotlog 큐레이션',
    dateRange: '추천 일정 · 날짜를 정해 담아보세요',
    saves: 0,
    story: `Spotlog가 ${template.eyebrow}을 중심으로 골라 구성한 ${template.region} 추천 일정입니다. 날짜별 장소와 이동 동선을 먼저 살펴보고, 마음에 들면 내 여행에 담아 일정과 기록을 자유롭게 바꿔보세요.`,
  });
  return { ...preview, days: preview.days.map((day) => ({ ...day, date: `${day.day}일차` })) };
};

const homeCommunityJourneys: Journey[] = [
  publishTemplateJourney(homeTripTemplates[0], {
    id: 'jeju-west-weekend', title: '주말에 천천히 만난 제주 서쪽', author: '제주주말러', dateRange: '2026.08.01 — 08.02', saves: 736,
    story: '협재의 바다를 오래 보고 다음 날 차밭과 오름으로 이어갔다. 장소를 많이 넣지 않고 서로 가까운 장면을 묶어, 짧은 주말에도 이동에 쫓기지 않았던 제주 기록이다.',
  }),
  publishTemplateJourney(homeTripTemplates[1], {
    id: 'busan-oldtown-to-sea', title: '골목에서 바다까지, 부산의 두 얼굴', author: '부산산책자', dateRange: '2026.07.11 — 07.12', saves: 842,
    story: '원도심 골목의 높낮이와 해운대의 밤, 다음 날 기장 바다까지 부산의 서로 다른 표정을 이틀에 나눠 걸었다. 유명 장소를 체크하기보다 동네가 바뀌는 방향을 따라간 기록이다.',
  }),
  publishTemplateJourney(homeTripTemplates[2], {
    id: 'gangwon-sea-and-river', title: '동해의 아침과 정선의 느린 오후', author: '느린주말', dateRange: '2026.06.06 — 06.07', saves: 619,
    story: '첫날은 강릉 바다 앞에서 오래 걷고, 둘째 날은 산길을 넘어 정선의 물가에 앉았다. 장소를 많이 넣지 않아 이동 뒤에도 풍경을 충분히 볼 수 있었던 강원 여행이다.',
  }),
  publishTemplateJourney(homeTripTemplates[3], {
    id: 'seoul-seongsu-day', title: '숲과 골목, 한강으로 이어지는 서울 하루', author: '퇴근후서울', dateRange: '2026.07.25 · 당일', saves: 524,
    story: '서울숲에서 아침을 시작해 성수의 작은 가게를 보고, 해가 낮아질 무렵 한강으로 걸었다. 익숙한 도시에서도 걷는 방향을 정하면 한 편의 여행기가 된다는 걸 기록했다.',
  }),
  publishTemplateJourney(homeTripTemplates[4], {
    id: 'suncheon-yeosu-three-days', title: '순천의 초록에서 여수 밤바다까지', author: '남도기록', dateRange: '2026.06.19 — 06.21', saves: 903,
    story: '첫날은 국가정원의 초록, 둘째 날은 갈대밭의 저녁, 마지막은 여수 바다에 시간을 주었다. 순천과 여수를 빠르게 소비하지 않고 자연스럽게 분위기가 바뀌도록 만든 2박 3일이다.',
  }),
  publishTemplateJourney(homeTripTemplates[5], {
    id: 'east-coast-four-days', title: '강릉에서 고성까지 파도를 따라 북쪽으로', author: '해안선수집가', dateRange: '2026.05.02 — 05.05', saves: 1168,
    story: '강릉에서 시작해 양양과 속초를 지나 고성까지, 매일 조금씩 북쪽으로 올라갔다. 같은 동해라도 도시와 해변마다 다른 소리와 빛을 발견한 3박 4일 해안 기록이다.',
  }),
  publishTemplateJourney(homeTripTemplates[6], {
    id: 'southern-road-five-days', title: '전주 골목에서 통영의 섬까지', author: '긴주말여행자', dateRange: '2026.04.29 — 05.03', saves: 1376,
    story: '전주의 오래된 골목, 담양과 순천의 초록, 여수와 통영의 섬을 다섯 날에 나눴다. 이동하는 날에도 한 도시를 기억할 장면이 남도록 하루의 중심 장소를 분명히 한 남도 로드트립이다.',
  }),
];

const publishedJourneySeeds: Journey[] = [...initialJourneys, ...homeCommunityJourneys];

const scrollCarouselItem = (track: HTMLDivElement | null, index: number) => {
  const item = track?.children.item(index) as HTMLElement | null;
  if (!track || !item) return;
  track.scrollTo({ left: item.offsetLeft - track.offsetLeft, behavior: 'smooth' });
};

function useRollingCarousel(itemCount: number, intervalMs = 4800) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const goTo = (requestedIndex: number) => {
    if (!itemCount) return;
    const nextIndex = (requestedIndex + itemCount) % itemCount;
    setActiveIndex(nextIndex);
    scrollCarouselItem(trackRef.current, nextIndex);
  };

  useEffect(() => {
    setActiveIndex(0);
    scrollCarouselItem(trackRef.current, 0);
  }, [itemCount]);

  useEffect(() => {
    if (itemCount < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => {
        const next = (current + 1) % itemCount;
        scrollCarouselItem(trackRef.current, next);
        return next;
      });
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, itemCount]);

  const syncIndex = () => {
    const track = trackRef.current;
    if (!track?.children.length) return;
    const items = Array.from(track.children) as HTMLElement[];
    const nearest = items.reduce((best, item, index) => Math.abs(item.offsetLeft - track.offsetLeft - track.scrollLeft) < Math.abs(items[best].offsetLeft - track.offsetLeft - track.scrollLeft) ? index : best, 0);
    setActiveIndex(nearest);
  };

  return { trackRef, activeIndex, goTo, syncIndex };
}

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [savedIds, setSavedIds] = useState<string[]>(readSavedIds);
  const [journeys, setJourneys] = useState<Journey[]>(readJourneys);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<HomeTripTemplate | null>(null);
  const [searchDraft, setSearchDraft] = useState<TripSearchFilters>({ destination: '', duration: 'ALL' });
  const [placeView, setPlaceView] = useState<PlaceView>('VIDEO');
  const [editingJourneyId, setEditingJourneyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState('');
  const [profile, setProfile] = useState<CreatorProfile>(readCreatorProfile);
  const [comments, setComments] = useState<JourneyComment[]>(readComments);
  const [cheers, setCheers] = useState<CheerStore>(readCheers);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(readNotificationPreferences);
  const [notificationPermission, setNotificationPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const viewedJourneyIds = useRef(new Set<string>());
  const native = isNativeShell();
  const savedPlaces = useMemo(() => placeCatalog.filter((place) => savedIds.includes(place.id)), [savedIds]);
  const aiSamplePlaces = useMemo(() => Array.from(new Map(initialJourneys.flatMap((journey) => journey.days.flatMap((day) => day.places)).filter((place) => place.kind === 'LANDMARK' && place.area.startsWith('제주')).map((place) => [place.id, place])).values()).slice(0, 4), []);
  const selectedTemplateJourney = useMemo(() => selectedTemplate ? previewTemplateJourney(selectedTemplate) : null, [selectedTemplate]);
  const selectedJourney = selectedTemplateJourney ?? journeys.find((journey) => journey.id === selectedJourneyId) ?? null;
  const editingJourney = journeys.find((journey) => journey.id === editingJourneyId) ?? null;

  const applyNavigationState = useCallback((state: SpotlogNavigationState) => {
    setTab(state.tab);
    setPlaceView(state.placeView);
    setSelectedJourneyId(state.journeyId);
    setSelectedTemplate(state.templateId ? homeTripTemplates.find((template) => template.id === state.templateId) ?? null : null);
    setEditingJourneyId(state.editorId);
    setCreating(false);
  }, []);

  const writeNavigationState = (next: Partial<Omit<SpotlogNavigationState, 'spotlog' | 'depth'>>, mode: 'push' | 'replace' = 'push') => {
    const previous = isSpotlogNavigationState(window.history.state) ? window.history.state : null;
    const state: SpotlogNavigationState = {
      spotlog: true,
      depth: mode === 'replace' ? previous?.depth ?? 0 : (previous?.depth ?? 0) + 1,
      tab: next.tab ?? tab,
      placeView: next.placeView ?? placeView,
      journeyId: next.journeyId === undefined ? selectedJourneyId : next.journeyId,
      templateId: next.templateId === undefined ? selectedTemplate?.id ?? null : next.templateId,
      editorId: next.editorId === undefined ? editingJourneyId : next.editorId,
    };
    window.history[mode === 'push' ? 'pushState' : 'replaceState'](state, '', spotlogNavigationUrl(state));
    notifyNavigationState(state.depth > 0);
  };

  const goBack = () => {
    const state = window.history.state;
    if (isSpotlogNavigationState(state) && state.depth > 0) {
      window.history.back();
      return;
    }
    const root: SpotlogNavigationState = { spotlog: true, depth: 0, tab: 'home', placeView, journeyId: null, templateId: null, editorId: null };
    window.history.replaceState(root, '', spotlogNavigationUrl(root));
    applyNavigationState(root);
    notifyNavigationState(false);
  };

  useEffect(() => {
    const initial: SpotlogNavigationState = isSpotlogNavigationState(window.history.state) && navigationStateMatchesHash(window.history.state)
      ? window.history.state
      : navigationStateFromHash();
    window.history.replaceState(initial, '', spotlogNavigationUrl(initial));
    applyNavigationState(initial);
    notifyNavigationState(initial.depth > 0);
    const handlePopState = (event: PopStateEvent) => {
      const state: SpotlogNavigationState = isSpotlogNavigationState(event.state)
        ? event.state
        : navigationStateFromHash();
      if (!isSpotlogNavigationState(event.state)) window.history.replaceState(state, '', spotlogNavigationUrl(state));
      applyNavigationState(state);
      notifyNavigationState(state.depth > 0);
    };
    window.addEventListener('popstate', handlePopState);
    const handleHashChange = () => {
      if (isSpotlogNavigationState(window.history.state) && navigationStateMatchesHash(window.history.state)) return;
      const state = navigationStateFromHash();
      window.history.replaceState(state, '', spotlogNavigationUrl(state));
      applyNavigationState(state);
      notifyNavigationState(false);
    };
    window.addEventListener('hashchange', handleHashChange);
    const unsubscribeNavigation = subscribeNavigationCommands(() => {
      const state = window.history.state;
      if (isSpotlogNavigationState(state) && state.depth > 0) window.history.back();
    });
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handleHashChange);
      unsubscribeNavigation();
    };
  }, [applyNavigationState]);

  useEffect(() => subscribeNotificationStatus((status) => {
    setNotificationPermission(status.permission);
  }), []);
  useEffect(() => notifyReady(), []);
  useEffect(() => localStorage.setItem(storageKeys.saved, JSON.stringify(savedIds)), [savedIds]);
  useEffect(() => localStorage.setItem(storageKeys.journeys, JSON.stringify(journeys)), [journeys]);
  useEffect(() => localStorage.setItem(storageKeys.profile, JSON.stringify(profile)), [profile]);
  useEffect(() => localStorage.setItem(storageKeys.comments, JSON.stringify(comments)), [comments]);
  useEffect(() => localStorage.setItem(storageKeys.cheers, JSON.stringify(cheers)), [cheers]);
  useEffect(() => localStorage.setItem(storageKeys.notifications, JSON.stringify(notificationPreferences)), [notificationPreferences]);
  useEffect(() => {
    document.querySelector<HTMLElement>('.content')?.scrollTo({ top: 0, behavior: 'instant' });
  }, [tab, selectedJourneyId, selectedTemplate, editingJourneyId, placeView]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2200);
  };
  const toggleSaved = (id: string) => setSavedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const changeNotificationPreferences = (preferences: NotificationPreferences) => {
    setNotificationPreferences(preferences);
    updateNotificationPreferences(preferences);
  };
  const openJourney = (id: string) => {
    setSelectedTemplate(null);
    setSelectedJourneyId(id);
    setEditingJourneyId(null);
    writeNavigationState({ journeyId: id, templateId: null, editorId: null });
    if (viewedJourneyIds.current.has(id)) return;
    viewedJourneyIds.current.add(id);
    setJourneys((current) => current.map((journey) => journey.id === id && !journey.isMine && journey.visibility === 'PUBLIC' ? { ...journey, views: (journey.views ?? 0) + 1 } : journey));
  };
  const openTemplate = (template: HomeTripTemplate) => {
    setSelectedJourneyId(null);
    setSelectedTemplate(template);
    setEditingJourneyId(null);
    writeNavigationState({ journeyId: null, templateId: template.id, editorId: null });
  };
  const editJourney = (id: string) => {
    setSelectedJourneyId(null);
    setSelectedTemplate(null);
    setEditingJourneyId(id);
    writeNavigationState({ journeyId: null, templateId: null, editorId: id });
  };
  const changePlaceView = (next: PlaceView) => {
    if (next === placeView) return;
    setPlaceView(next);
    writeNavigationState({ tab: 'discover', placeView: next, journeyId: null, templateId: null, editorId: null });
  };
  const sharePlace = async (place: Place) => {
    try {
      const mode = await shareContent({ title: place.name, message: makePlaceShareText(place) });
      if (mode === 'clipboard') showToast('장소 정보와 길찾기 링크를 복사했습니다.');
    } catch {
      showToast('공유를 취소했습니다.');
    }
  };
  const shareJourney = async (journey: Journey) => {
    const routeText = journey.days.map((day) => `${day.date} · ${day.places.map((place) => place.name).join(' → ')}`).join('\n');
    try {
      const mode = await shareContent({ title: journey.title, message: `${journey.title}\n${journey.summary}\n\n${routeText}\n\nSpotlog 공개 여행일기` });
      if (mode === 'clipboard') showToast('여행일기 내용을 복사했습니다.');
    } catch {
      showToast('공유를 취소했습니다.');
    }
  };
  const addToPlanningJourney = (place: Place) => {
    const target = journeys.find((journey) => journey.status === 'PLANNING') ?? journeys[0];
    const alreadyAdded = target.days.some((day) => day.places.some((item) => item.id === place.id));
    if (alreadyAdded) {
      showToast(`${target.title}에 이미 담겨 있습니다.`);
      return;
    }
    setJourneys((current) => current.map((journey) => journey.id !== target.id ? journey : {
      ...journey,
      days: journey.days.map((day, index) => index ? day : {
        ...day,
        places: [...day.places, { ...place, move: '이동시간 확인 필요' }],
        blocks: [...day.blocks, { id: `place-${place.id}-${Date.now()}`, type: 'PLACE' as const, placeId: place.id }],
      }),
    }));
    showToast(`${target.title}에 담았습니다.`);
  };
  const createJourney = (title: string, region: string) => {
    const id = `journey-${Date.now()}`;
    const journey: Journey = {
      id, title, region, dateRange: '날짜 미정', duration: '일정 미정', status: 'PLANNING', visibility: 'PRIVATE', cover: placeCatalog.find((place) => place.area.includes(region))?.image ?? discoveryLandmarks[0].image,
      summary: `${region}에서의 장면과 이야기를 담을 새 여행입니다.`, story: '아직 출발 전입니다. 장소를 담고 날짜별 이동 순서를 만들어보세요.', tags: [region, '새여행'], saves: 0, views: 0,
      days: [{ day: 1, date: 'DAY 1', title: '첫날의 기록', story: '이날의 이야기를 기록할 자리입니다.', places: [], blocks: [{ id: `text-${Date.now()}`, type: 'TEXT', heading: '첫 번째 이야기', body: '' }] }],
      author: 'Spotlog 여행자', isMine: true,
    };
    setJourneys((current) => [journey, ...current]);
    setCreating(false);
    setEditingJourneyId(id);
    writeNavigationState({ tab: 'trips', journeyId: null, templateId: null, editorId: id });
    showToast('새 여행을 만들었습니다.');
  };

  const generateAiJourney = (places: Place[], dayCount: number, isSample: boolean) => {
    const draft = buildAiJourneyDraft(places, dayCount, isSample);
    setJourneys((current) => [draft, ...current]);
    setTab('trips');
    setSelectedJourneyId(draft.id);
    setSelectedTemplate(null);
    setEditingJourneyId(null);
    writeNavigationState({ tab: 'trips', journeyId: draft.id, templateId: null, editorId: null });
    showToast('AI 여행 초안을 만들었습니다.');
  };

  const startRecommendedJourney = (template: HomeTripTemplate) => {
    const generated = buildAiJourneyDraft(template.places, template.dayCount, false, '추천 일정에 담긴 장소');
    const draft: Journey = {
      ...generated,
      title: `${template.title} · 내 여행`,
      region: template.region,
      duration: template.duration,
      summary: template.summary,
      story: `Spotlog가 ${template.eyebrow}을 중심으로 골라둔 추천 일정을 내 여행 초안으로 가져왔습니다. 날짜와 장소 순서, 사진과 글을 자유롭게 바꿔 실제 여행 계획과 여행기로 완성해보세요.`,
      tags: ['Spotlog추천', template.region, '수정가능'],
      author: 'Spotlog 여행자',
      sourceAuthor: 'Spotlog 큐레이션',
    };
    setJourneys((current) => [draft, ...current]);
    setSelectedJourneyId(null);
    setSelectedTemplate(null);
    setTab('trips');
    setEditingJourneyId(draft.id);
    writeNavigationState({ tab: 'trips', journeyId: null, templateId: null, editorId: draft.id });
    showToast('추천 일정을 내 여행으로 가져왔습니다.');
  };

  const saveJourney = (updated: Journey) => {
    setJourneys((current) => current.map((journey) => journey.id === updated.id ? updated : journey));
    setEditingJourneyId(null);
    setSelectedJourneyId(updated.id);
    setSelectedTemplate(null);
    writeNavigationState({ tab: 'trips', journeyId: updated.id, templateId: null, editorId: null }, 'replace');
    showToast('여행기 초안을 저장했습니다.');
  };

  const deleteJourney = (target: Journey) => {
    if (!target.isMine || !window.confirm(`“${target.title}” 여행기를 삭제할까요?\n삭제한 여행기는 복구할 수 없습니다.`)) return;
    setJourneys((current) => current.filter((journey) => journey.id !== target.id));
    goBack();
    showToast('여행기를 삭제했습니다.');
  };

  const addJourneyComment = (journeyId: string, body: string) => {
    const message = body.trim();
    if (!message) return;
    const myCopyCount = journeys.filter((journey) => journey.isMine).reduce((sum, journey) => sum + journey.saves, 0);
    const comment: JourneyComment = {
      id: `comment-${Date.now()}`,
      journeyId,
      author: profile.displayName,
      body: message.slice(0, 180),
      createdAt: new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(new Date()),
      avatar: profile.avatar,
      authorCopies: myCopyCount,
    };
    setComments((current) => [...current, comment]);
    showToast('작성자에게 따뜻한 댓글을 전했습니다.');
  };

  const toggleJourneyCheer = (journeyId: string, cheer: CheerKey) => {
    setCheers((current) => {
      const previous = current[journeyId] ?? { LOVE: 0, BEST: 0, HELPFUL: 0 };
      const next = { ...previous };
      if (previous.selected === cheer) {
        next[cheer] = Math.max(0, next[cheer] - 1);
        delete next.selected;
      } else {
        if (previous.selected) next[previous.selected] = Math.max(0, next[previous.selected] - 1);
        next[cheer] += 1;
        next.selected = cheer;
      }
      return { ...current, [journeyId]: next };
    });
  };

  const copyJourney = (source: Journey) => {
    const id = `journey-copy-${Date.now()}`;
    const copied: Journey = {
      ...structuredClone(source),
      id,
      title: `${source.title} · 내 버전`,
      status: 'PLANNING',
      visibility: 'PRIVATE',
      saves: 0,
      views: 0,
      author: 'Spotlog 여행자',
      isMine: true,
      sourceJourneyId: source.id,
      sourceAuthor: source.author,
    };
    setJourneys((current) => [copied, ...current.map((journey) => journey.id === source.id ? { ...journey, saves: journey.saves + 1 } : journey)]);
    setSelectedJourneyId(null);
    setTab('trips');
    setEditingJourneyId(id);
    writeNavigationState({ tab: 'trips', journeyId: null, templateId: null, editorId: id });
    showToast('내 여행으로 복사했습니다.');
  };

  const selectTab = (next: Tab) => {
    if (next === tab && !selectedJourney && !editingJourney) return;
    setSelectedJourneyId(null);
    setSelectedTemplate(null);
    setEditingJourneyId(null);
    setTab(next);
    writeNavigationState({ tab: next, journeyId: null, templateId: null, editorId: null });
  };

  return (
    <main className={`app-shell tab-${tab} place-${placeView.toLowerCase()} ${selectedJourney || editingJourney || tab === 'profile' ? 'detail-open' : ''}`}>
      <section className="content">
        {editingJourney ? (
          <JourneyEditor journey={editingJourney} onBack={goBack} onSave={saveJourney} />
        ) : selectedJourney ? (
          <JourneyDetail key={selectedJourney.id} journey={selectedJourney} profile={profile} comments={comments.filter((comment) => comment.journeyId === selectedJourney.id)} cheers={cheers[selectedJourney.id] ?? { LOVE: 0, BEST: 0, HELPFUL: 0 }} authorJourneys={selectedJourney.isMine ? journeys.filter((journey) => journey.isMine) : journeys.filter((journey) => !journey.isMine && journey.author === selectedJourney.author)} onBack={goBack} onShare={() => void shareJourney(selectedJourney)} onSharePlace={(place) => void sharePlace(place)} onEdit={() => editJourney(selectedJourney.id)} onDelete={() => deleteJourney(selectedJourney)} onCopy={() => selectedTemplate ? startRecommendedJourney(selectedTemplate) : copyJourney(selectedJourney)} onComment={(body) => addJourneyComment(selectedJourney.id, body)} onCheer={(cheer) => toggleJourneyCheer(selectedJourney.id, cheer)} onOpenJourney={openJourney} copyLabel={selectedTemplateJourney ? '이 일정 내 여행에 담기' : undefined} />
        ) : (
          <>
            {tab === 'home' && <Home journeys={journeys} templates={homeTripTemplates} onOpen={openJourney} onPreview={openTemplate} onGoCommunity={() => selectTab('community')} onGoPlaces={() => selectTab('discover')} onGoTrips={() => selectTab('trips')} onGoProfile={() => selectTab('profile')} />}
            {tab === 'community' && <Community journeys={journeys} filters={searchDraft} onFiltersChange={setSearchDraft} onOpen={openJourney} />}
            {tab === 'discover' && <Discover view={placeView} onViewChange={changePlaceView} savedIds={savedIds} onToggle={toggleSaved} onShare={sharePlace} />}
            {tab === 'trips' && <Trips journeys={journeys} onOpen={openJourney} onCreate={() => setCreating(true)} onShare={(journey) => void shareJourney(journey)} />}
            {tab === 'saved' && <Saved places={savedPlaces} samplePlaces={aiSamplePlaces} onGenerate={generateAiJourney} onRemove={toggleSaved} onAdd={addToPlanningJourney} onGoDiscover={() => selectTab('discover')} />}
            {tab === 'profile' && <Profile native={native} journeys={journeys} comments={comments} cheers={cheers} profile={profile} notificationPreferences={notificationPreferences} notificationPermission={notificationPermission} onBack={goBack} onProfileChange={setProfile} onNotificationPreferencesChange={changeNotificationPreferences} onPreviewNotification={() => showToast(previewCreatorNotification(notificationPreferences.viewMilestone) ? '테스트 푸시를 보냈습니다.' : '테스트 푸시는 Spotlog 앱에서 확인할 수 있습니다.')} onOpen={openJourney} />}
          </>
        )}
      </section>

      {!selectedJourney && !editingJourney && tab !== 'profile' && <nav className="tabbar" aria-label="주요 메뉴">
        {tabItems.map((item) => {
          const Icon = item.icon;
          return <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => selectTab(item.id)}><Icon size={21} strokeWidth={tab === item.id ? 2.3 : 1.8} /><span>{item.label}</span></button>;
        })}
      </nav>}
      {creating && <CreateJourneySheet onClose={() => setCreating(false)} onCreate={createJourney} />}
      {toast && <div className="toast"><Check size={15} />{toast}</div>}
    </main>
  );
}

function Home({ journeys, templates, onOpen, onPreview, onGoCommunity, onGoPlaces, onGoTrips, onGoProfile }: { journeys: Journey[]; templates: HomeTripTemplate[]; onOpen: (id: string) => void; onPreview: (template: HomeTripTemplate) => void; onGoCommunity: () => void; onGoPlaces: () => void; onGoTrips: () => void; onGoProfile: () => void }) {
  const publicGuides = journeys.filter((journey) => !journey.isMine && journey.status === 'PUBLISHED');
  const authorCopyCount = (author: string) => publicGuides.filter((journey) => journey.author === author).reduce((sum, journey) => sum + journey.saves, 0);
  const recommendationRolling = useRollingCarousel(templates.length, 4600);
  const guideRolling = useRollingCarousel(publicGuides.length, 5200);

  return <div className="home-page">
    <header className="home-topbar"><div><strong>spotlog</strong><span>다른 사람의 여행에서 내 여행을 시작하세요</span></div><button onClick={onGoProfile} aria-label="프로필"><CircleUserRound size={24} /></button></header>
    <section className="home-lead"><span>TRAVEL STORIES · READY TO EDIT</span><h1>가고 싶은 곳을 찾거나,<br />마음에 드는 여행을 고르세요.</h1><p>공개 여행기를 그대로 읽고, 내 일정으로 복사해 장소와 동선을 자유롭게 바꿀 수 있습니다.</p></section>
    <button className="home-find-guides" onClick={onGoCommunity}><span><Search size={20} /></span><div><small>지역 · 여행 기간으로 검색</small><strong>다른 여행자의 여행기 찾기</strong><p>당일치기부터 3박 이상까지 골라보세요.</p></div><ChevronRight size={19} /></button>

    <section className="home-section"><div className="home-section-heading"><div><small>SPOTLOG CURATION</small><h2>이번 주 추천 일정</h2><p>에디터가 고른 일정을 읽어보고 내 여행에 담으세요</p></div><RollingControls label="추천 일정" count={templates.length} activeIndex={recommendationRolling.activeIndex} onChange={recommendationRolling.goTo} /></div><div className="promoted-track" ref={recommendationRolling.trackRef} onScroll={recommendationRolling.syncIndex}>{templates.map((template) => <article className="promoted-trip" key={template.id}><img src={template.cover} alt="" /><div className="promoted-shade" /><div className="promoted-copy"><span>{template.region} · {template.duration}</span><h2>{template.title}</h2><p>{template.summary}</p><div><button onClick={() => onPreview(template)}>일정 자세히 보기</button><small>{template.places.length}개 장소 · 먼저 보고 담기</small></div></div></article>)}</div><RollingDots label="추천 일정" count={templates.length} activeIndex={recommendationRolling.activeIndex} onChange={recommendationRolling.goTo} /></section>

    {publicGuides.length > 0 && <section className="home-section"><div className="home-section-heading"><div><small>TRAVELER'S GUIDE</small><h2>여행자들이 만든 일정</h2><p>실제 여행 기록을 읽고 내 일정으로 가져오세요</p></div><RollingControls label="여행자 일정" count={publicGuides.length} activeIndex={guideRolling.activeIndex} onChange={guideRolling.goTo} /></div><div className="home-guide-list" ref={guideRolling.trackRef} onScroll={guideRolling.syncIndex}>{publicGuides.map((journey) => <article className="home-guide-card" key={journey.id}><button className="home-guide-cover" onClick={() => onOpen(journey.id)}><img src={journey.cover} alt="" /><span>{journey.region}<br />{journey.duration}</span></button><div className="home-guide-copy"><div className="home-guide-author"><CreatorBadge copyCount={authorCopyCount(journey.author)} compact /><small>{journey.author} · {journeyPlaceCount(journey)}곳</small></div><h3>{journey.title}</h3><p>{journey.summary}</p><div className="home-guide-actions"><button onClick={() => onOpen(journey.id)}>여행기 먼저 보기</button></div></div></article>)}</div><RollingDots label="여행자 일정" count={publicGuides.length} activeIndex={guideRolling.activeIndex} onChange={guideRolling.goTo} /></section>}

    <section className="home-shortcuts"><button onClick={onGoPlaces}><Compass size={20} /><span><strong>랜드마크 찾기</strong><small>영상이나 안내 목록에서 장소 담기</small></span><ChevronRight size={17} /></button><button onClick={onGoTrips}><MapIcon size={20} /><span><strong>내 여행</strong><small>복사하고 만든 일정 관리</small></span><ChevronRight size={17} /></button></section>
  </div>;
}

function Community({ journeys, filters, onFiltersChange, onOpen }: { journeys: Journey[]; filters: TripSearchFilters; onFiltersChange: (filters: TripSearchFilters) => void; onOpen: (id: string) => void }) {
  const regions = ['전체', '제주', '부산', '강원', '서울', '전남', '남도'];
  const publicGuides = journeys.filter((journey) => !journey.isMine && journey.status === 'PUBLISHED');
  const filteredGuides = publicGuides
    .filter((journey) => matchesDestination(filters.destination, [journey.region, journey.title, journey.summary, journey.author, ...journey.tags]) && matchesTripDuration(journey.duration, filters.duration))
    .sort((left, right) => right.saves - left.saves);
  const authorCopyCount = (author: string) => publicGuides.filter((journey) => journey.author === author).reduce((sum, journey) => sum + journey.saves, 0);

  return <div className="page community-page">
    <AppHeader title="여행기" subtitle="다른 여행자의 실제 일정과 기록" action={<span className="community-header-icon"><Globe2 size={20} /></span>} />
    <section className="community-intro"><small>TRAVELER'S STORIES</small><h2>먼저 읽어보고,<br />마음에 들면 내 여행에 담으세요.</h2><p>지역과 여행 기간을 고르면 실제 여행자가 공개한 글만 찾아볼 수 있습니다.</p></section>
    <section className="community-search" aria-labelledby="community-search-title">
      <div className="community-search-title"><div><small>FIND A STORY</small><strong id="community-search-title">여행기 검색</strong></div><span>{filteredGuides.length}개</span></div>
      <label className="destination-search"><Search size={19} /><input value={filters.destination} onChange={(event) => onFiltersChange({ ...filters, destination: event.target.value })} placeholder="지역, 제목, 작성자를 검색하세요" aria-label="여행기 지역 검색" />{filters.destination && <button type="button" onClick={() => onFiltersChange({ ...filters, destination: '' })} aria-label="검색 지우기">지우기</button>}</label>
      <div className="destination-chips" aria-label="여행기 지역 선택">{regions.map((region) => <button type="button" key={region} className={(region === '전체' && !filters.destination) || filters.destination === region ? 'active' : ''} onClick={() => onFiltersChange({ ...filters, destination: region === '전체' ? '' : region })}>{region}</button>)}</div>
      <div className="destination-duration"><strong>여행 기간</strong><span>{tripDurationLabel(filters.duration)}</span></div>
      <div className="duration-chips" aria-label="여행기 기간 선택">{tripDurationOptions.map((option) => <button type="button" key={option.id} className={filters.duration === option.id ? 'active' : ''} onClick={() => onFiltersChange({ ...filters, duration: option.id })}>{option.label}</button>)}</div>
    </section>

    <section className="community-results"><div className="community-results-heading"><div><small>PUBLIC TRAVEL LOG</small><h2>{filters.destination || tripDurationLabel(filters.duration) !== '전체 기간' ? '검색한 여행기' : '지금 많이 담는 여행기'}</h2></div><span>담김 많은 순</span></div>
      {filteredGuides.length ? <div className="community-list">{filteredGuides.map((journey) => <article className="community-card" key={journey.id}><button className="community-cover" onClick={() => onOpen(journey.id)}><img src={journey.cover} alt="" /><span>{journey.region} · {journey.duration}</span></button><div className="community-copy"><div className="community-author"><CreatorBadge copyCount={authorCopyCount(journey.author)} compact /><strong>{journey.author}</strong></div><h3>{journey.title}</h3><p>{journey.summary}</p><div className="community-meta"><span><MapPin size={12} />{journeyPlaceCount(journey)}곳</span><span><Eye size={12} />{(journey.views ?? 0).toLocaleString()}</span><span><Copy size={12} />{journey.saves.toLocaleString()}명</span></div><button onClick={() => onOpen(journey.id)}>여행기 먼저 보기<ChevronRight size={16} /></button></div></article>)}</div> : <div className="community-empty"><Search size={27} /><h2>조건에 맞는 여행기가 없어요</h2><p>지역을 전체로 넓히거나 여행 기간을 바꿔보세요.</p><button onClick={() => onFiltersChange({ destination: '', duration: 'ALL' })}>전체 여행기 보기</button></div>}
    </section>
  </div>;
}

function RollingControls({ label, count, activeIndex, onChange }: { label: string; count: number; activeIndex: number; onChange: (index: number) => void }) {
  return <div className="rolling-controls"><span>{activeIndex + 1} / {count}</span>{count > 1 && <><button onClick={() => onChange(activeIndex - 1)} aria-label={`${label} 이전`}><ChevronLeft size={17} /></button><button onClick={() => onChange(activeIndex + 1)} aria-label={`${label} 다음`}><ChevronRight size={17} /></button></>}</div>;
}

function RollingDots({ label, count, activeIndex, onChange }: { label: string; count: number; activeIndex: number; onChange: (index: number) => void }) {
  if (count < 2) return null;
  return <div className="rolling-dots" aria-label={`${label} 페이지`}>{Array.from({ length: count }, (_, index) => <button key={index} className={index === activeIndex ? 'active' : ''} onClick={() => onChange(index)} aria-label={`${label} ${index + 1}번`} aria-current={index === activeIndex ? 'true' : undefined} />)}</div>;
}

const landmarkRegion = (place: Place) => place.area.split(' ')[0] || '기타';
const domesticRegionOrder = ['서울', '경기', '인천', '강원', '충북', '충남', '대전', '세종', '전북', '전남', '광주', '경북', '경남', '대구', '울산', '부산', '제주'];

function Discover({ view, onViewChange, savedIds, onToggle, onShare }: { view: PlaceView; onViewChange: (view: PlaceView) => void; savedIds: string[]; onToggle: (id: string) => void; onShare: (place: Place) => void }) {
  const [query, setQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [showEveryRegion, setShowEveryRegion] = useState(false);
  const [showEveryPlace, setShowEveryPlace] = useState(false);
  const guideLandmarks = useMemo(() => placeCatalog
    .filter((place) => place.kind === 'LANDMARK')
    .sort((a, b) => domesticRegionOrder.indexOf(landmarkRegion(a)) - domesticRegionOrder.indexOf(landmarkRegion(b))), []);
  const regionGroups = domesticRegionOrder
    .map((region) => ({ region, places: guideLandmarks.filter((place) => landmarkRegion(place) === region) }))
    .filter((group) => group.places.length > 0);
  const visiblePlaces = guideLandmarks.filter((place) => {
    const matchesRegion = !selectedRegion || landmarkRegion(place) === selectedRegion;
    return matchesRegion && matchesDestination(query, [place.area, place.name, place.hook, place.description, place.note, ...(place.tags ?? [])]);
  });
  const resultTitle = query.trim()
    ? `'${query.trim()}' 검색 결과`
    : selectedRegion ? `${selectedRegion} 랜드마크` : '국내 랜드마크';
  const hasActiveResults = Boolean(query.trim() || selectedRegion);
  const displayedPlaces = showEveryPlace ? visiblePlaces : visiblePlaces.slice(0, 3);
  const displayedRegionGroups = showEveryRegion ? regionGroups : regionGroups.slice(0, 8);
  const chooseRegion = (region: string) => {
    setSelectedRegion(region);
    setShowEveryPlace(false);
  };
  useEffect(() => setShowEveryPlace(false), [query, selectedRegion]);

  return <div className={`place-discover ${view === 'VIDEO' ? 'is-video' : 'is-guide'}`}>
    <header className="place-discover-header"><div><strong>spotlog</strong><span>{savedIds.length}개 장소 저장</span></div><PlaceViewToggle view={view} onChange={onViewChange} /></header>
    {view === 'VIDEO' ? <div className="feed">{discoveryLandmarks.map((place) => <FeedCard key={place.id} place={place} saved={savedIds.includes(place.id)} onToggle={() => onToggle(place.id)} onShare={() => onShare(place)} />)}</div> : <div className="place-guide-content">
      <section className="place-guide-lead"><small>LANDMARK GUIDE</small><h1>각 지역에 무엇이 있는지 보고<br />내 여행에 하나씩 담아보세요.</h1><p>{regionGroups.length}개 지역의 대표 장소 {guideLandmarks.length}곳을 모았습니다. 영상이 없는 장소도 안내 글로 살펴보고 같은 저장 목록에 담을 수 있어요.</p></section>
      <section className="place-guide-search"><label className="destination-search"><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="지역이나 랜드마크를 검색하세요" aria-label="랜드마크 지역 검색" />{query && <button type="button" onClick={() => setQuery('')} aria-label="검색 지우기">지우기</button>}</label></section>
      <section className="region-directory" aria-label="지역별 대표 랜드마크">
        <div className="region-directory-heading"><div><small>REGION DIRECTORY</small><h2>지역별로 둘러보기</h2></div><span>{regionGroups.length}개 지역 · {guideLandmarks.length}곳</span></div>
        <div className="region-count-grid">
          <button type="button" className={!selectedRegion ? 'active' : ''} onClick={() => chooseRegion('')} aria-pressed={!selectedRegion}><strong>전체</strong><small>{guideLandmarks.length}</small></button>
          {displayedRegionGroups.map(({ region, places }) => <button type="button" key={region} className={selectedRegion === region ? 'active' : ''} onClick={() => chooseRegion(region)} aria-pressed={selectedRegion === region}><strong>{region}</strong><small>{places.length}</small></button>)}
        </div>
        <button type="button" className="region-directory-more" onClick={() => setShowEveryRegion((current) => !current)}>{showEveryRegion ? <ArrowUp size={15} /> : <ArrowDown size={15} />}{showEveryRegion ? '지역 접어보기' : `나머지 ${regionGroups.length - displayedRegionGroups.length}개 지역 펼쳐보기`}</button>
      </section>
      <section className="place-guide-results"><div className="place-guide-heading"><div><small>PLACES TO SAVE</small><h2>{hasActiveResults ? resultTitle : '지역을 골라 장소 보기'}</h2></div><span>{hasActiveResults ? `${visiblePlaces.length}곳` : '지역별로 나눠보기'}</span></div>{!hasActiveResults ? <div className="region-result-empty"><MapPin size={23} /><div><strong>위에서 지역을 선택하세요</strong><p>선택한 지역의 장소 3곳을 먼저 보여주고, 필요할 때 나머지를 펼칠 수 있습니다.</p></div></div> : visiblePlaces.length ? <><div className="landmark-guide-list">{displayedPlaces.map((place) => <LandmarkGuideCard key={place.id} place={place} saved={savedIds.includes(place.id)} onToggle={() => onToggle(place.id)} onShare={() => onShare(place)} />)}</div>{visiblePlaces.length > 3 && <button type="button" className="place-results-more" onClick={() => setShowEveryPlace((current) => !current)}>{showEveryPlace ? <ArrowUp size={16} /> : <ArrowDown size={16} />}{showEveryPlace ? '장소 접어보기' : `나머지 ${visiblePlaces.length - displayedPlaces.length}곳 펼쳐보기`}</button>}</> : <div className="community-empty"><MapPin size={27} /><h2>아직 준비된 장소가 없어요</h2><p>다른 지역이나 랜드마크 이름으로 찾아보세요.</p><button onClick={() => { setQuery(''); setSelectedRegion(''); }}>전체 장소 보기</button></div>}</section>
    </div>}
  </div>;
}

function PlaceViewToggle({ view, onChange }: { view: PlaceView; onChange: (view: PlaceView) => void }) {
  return <div className="place-view-toggle" aria-label="장소 보기 방식"><button className={view === 'VIDEO' ? 'active' : ''} onClick={() => onChange('VIDEO')}><Clapperboard size={14} />영상</button><button className={view === 'GUIDE' ? 'active' : ''} onClick={() => onChange('GUIDE')}><MapIcon size={14} />지역 안내</button></div>;
}

function LandmarkGuideCard({ place, saved, onToggle, onShare }: { place: Place; saved: boolean; onToggle: () => void; onShare: () => void }) {
  return <article className="landmark-guide-card"><div className="landmark-guide-image"><img src={place.image} alt={`${place.name} 여행 사진`} /><span>{landmarkRegion(place)} · 랜드마크</span></div><div className="landmark-guide-copy"><small>{place.area} · {place.bestTime ?? place.duration}</small><h3>{place.name}</h3><strong>{place.hook ?? `${place.area} 일정에 담기 좋은 대표 장소`}</strong><p>{place.description}</p><blockquote>여행자 메모 · {place.note}</blockquote><div className="landmark-guide-tags">{place.tags?.map((tag) => <span key={tag}>#{tag}</span>)}</div><div className="landmark-guide-actions"><button className={saved ? 'saved' : ''} onClick={onToggle}><Bookmark size={16} fill={saved ? 'currentColor' : 'none'} />{saved ? '저장됨' : '이 장소 저장'}</button><button onClick={onShare}><Share2 size={16} />공유</button></div></div></article>;
}

function FeedCard({ place, saved, onToggle, onShare }: { place: Place; saved: boolean; onToggle: () => void; onShare: () => void }) {
  const cardRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const card = cardRef.current;
    const video = videoRef.current;
    if (!card || !video) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && entry.intersectionRatio > 0.65) void video.play().catch(() => undefined);
      else video.pause();
    }, { threshold: [0.65] });
    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  return <article className="feed-card" ref={cardRef}>
    <video ref={videoRef} src={place.video} poster={place.image} autoPlay muted={muted} loop playsInline preload="metadata" />
    <div className="video-shade" />
    <div className="feed-copy">
      <div className="creator-row"><span className="creator-avatar">{place.creator?.slice(0, 1).toUpperCase()}</span><strong>{place.creator}</strong><button>팔로우</button></div>
      <h1>{place.hook}</h1><p>{place.description}</p>
      <div className="tags">{place.tags?.map((tag) => <span key={tag}>#{tag}</span>)}</div>
      <button className="place-pill" onClick={onToggle}><span><MapPin size={16} /></span><span className="place-pill-copy"><strong>{place.name}</strong><small>{place.area} · {saved ? '저장됨' : '여행에 담기'}</small></span><ChevronRight size={17} /></button>
    </div>
    <div className="feed-actions"><ActionButton label={saved ? '저장됨' : '저장'} onClick={onToggle} active={saved} icon={Bookmark} /><ActionButton label="공유" onClick={onShare} icon={Share2} /><ActionButton label={muted ? '소리 켜기' : '음소거'} onClick={() => setMuted((value) => !value)} icon={muted ? VolumeX : Volume2} /><button className="more-button" aria-label="더보기"><MoreHorizontal size={23} /></button></div>
  </article>;
}

function ActionButton({ label, onClick, icon: Icon, active = false }: { label: string; onClick: () => void; icon: LucideIcon; active?: boolean }) {
  return <div className="action-item"><button className={active ? 'active' : ''} onClick={onClick} aria-label={label}><Icon size={23} fill={active ? 'currentColor' : 'none'} /></button><span>{label}</span></div>;
}

function Trips({ journeys, onOpen, onCreate, onShare }: { journeys: Journey[]; onOpen: (id: string) => void; onCreate: () => void; onShare: (journey: Journey) => void }) {
  const myTrips = journeys.filter((journey) => journey.isMine);
  return <div className="page trips-page">
    <AppHeader title="내 여행" subtitle="계획하고, 기록하고, 다시 나누는 여행" action={<button className="header-action solid" onClick={onCreate} aria-label="새 여행"><Plus size={20} /></button>} />
    <section className="journey-intro"><div><span>PLAN · WRITE · SHARE</span><h2>동선 위에 이야기를 쓰는<br />나만의 여행 가이드</h2></div><Edit3 size={32} /></section>
    {myTrips.length > 0 && <JourneySection title="내 여행과 여행기" description="계획 중인 초안과 내가 발행한 글" journeys={myTrips} onOpen={onOpen} onShare={onShare} />}
    <button className="primary wide create-trip-button" onClick={onCreate}><Edit3 size={18} />새 여행기 만들기</button>
  </div>;
}

function JourneySection({ title, description, journeys, onOpen, onShare }: { title: string; description: string; journeys: Journey[]; onOpen: (id: string) => void; onShare: (journey: Journey) => void }) {
  return <section className="journey-section"><div className="section-heading"><div><h2>{title}</h2><p>{description}</p></div><span>{journeys.length}</span></div><div className="journey-list">{journeys.map((journey) => <article className="journey-card" key={journey.id}>
    <button className="journey-main" onClick={() => onOpen(journey.id)}><img src={journey.cover} alt="" /><span className={`status-badge status-${journey.status.toLowerCase()}`}>{journey.visibility === 'PUBLIC' ? <Globe2 size={11} /> : <Lock size={11} />}{journey.isMine ? statusLabel[journey.status] : `${journey.author}의 가이드`}</span><span className="journey-gradient" /><span className="journey-copy"><small>{journey.region} · {journey.duration}</small><strong>{journey.title}</strong><em>{journey.summary}</em><span><CalendarDays size={13} />{journey.dateRange}<i />{journeyPlaceCount(journey)}곳</span></span></button>
    <button className="journey-share" onClick={() => onShare(journey)} aria-label={`${journey.title} 공유`}><Share2 size={17} /></button>
  </article>)}</div></section>;
}

function Saved({ places, samplePlaces, onGenerate, onRemove, onAdd, onGoDiscover }: { places: Place[]; samplePlaces: Place[]; onGenerate: (places: Place[], dayCount: number, isSample: boolean) => void; onRemove: (id: string) => void; onAdd: (place: Place) => void; onGoDiscover: () => void }) {
  const [dayCount, setDayCount] = useState(2);
  const [generating, setGenerating] = useState<'saved' | 'sample' | null>(null);
  const [savedRegion, setSavedRegion] = useState('');
  const [collapsedRegions, setCollapsedRegions] = useState<string[]>([]);
  const previewPlaces = places.length ? places : samplePlaces;
  const maxDays = Math.max(1, Math.min(3, previewPlaces.length));
  const effectiveDayCount = Math.min(dayCount, maxDays);
  const savedRegionNames = Array.from(new Set(places.map(landmarkRegion))).sort((a, b) => domesticRegionOrder.indexOf(a) - domesticRegionOrder.indexOf(b));
  const savedRegionGroups = savedRegionNames.map((region) => ({ region, places: places.filter((place) => landmarkRegion(place) === region) }));
  const visibleSavedGroups = savedRegion ? savedRegionGroups.filter((group) => group.region === savedRegion) : savedRegionGroups;
  const toggleSavedRegion = (region: string) => setCollapsedRegions((current) => current.includes(region) ? current.filter((value) => value !== region) : [...current, region]);
  useEffect(() => {
    if (savedRegion && !savedRegionNames.includes(savedRegion)) setSavedRegion('');
  }, [savedRegion, savedRegionNames.join('|')]);
  const runGenerator = (source: Place[], isSample: boolean) => {
    if (!source.length || generating) return;
    setGenerating(isSample ? 'sample' : 'saved');
    window.setTimeout(() => onGenerate(source, isSample ? Math.min(2, source.length) : effectiveDayCount, isSample), 850);
  };

  return <div className="page saved-page"><AppHeader title="저장한 장소" subtitle={`${places.length}개의 국내 랜드마크`} />
    <section className="ai-trip-card" aria-labelledby="ai-trip-title">
      <div className="ai-trip-heading"><span className="ai-trip-icon"><Sparkles size={19} /></span><div><small>AI TRIP MAKER</small><h2 id="ai-trip-title">저장한 장소로 여행 만들기</h2></div><span className="ai-trip-kpi">{places.length ? `${places.length}곳 · ${savedRegionGroups.length}지역` : '샘플 4곳'}</span></div>
      <p>{places.length ? '위치와 체류시간을 분석해 날짜별 동선 초안을 만듭니다.' : '제주 랜드마크 샘플로 결과를 먼저 볼 수 있습니다.'}</p>
      {places.length > 0 && <div className="ai-day-picker"><span>여행 기간</span><div>{Array.from({ length: maxDays }, (_, index) => index + 1).map((days) => <button key={days} className={effectiveDayCount === days ? 'active' : ''} onClick={() => setDayCount(days)} disabled={Boolean(generating)}>{days}일</button>)}</div></div>}
      <button className="ai-generate-button" onClick={() => runGenerator(previewPlaces, !places.length)} disabled={Boolean(generating)}><Sparkles size={18} className={generating ? 'is-spinning' : ''} />{generating ? '장소와 동선을 분석하는 중…' : places.length ? 'AI로 여행 초안 만들기' : '제주 샘플 여행 만들어보기'}<ChevronRight size={18} /></button>
      {places.length > 0 && <button className="ai-sample-button" onClick={() => runGenerator(samplePlaces, true)} disabled={Boolean(generating)}>제주 랜드마크 4곳 샘플도 보기</button>}
    </section>
    {places.length ? <><section className="saved-region-filter"><div><small>SAVED BY REGION</small><h2>지역별 저장 장소</h2></div><div className="saved-region-chips"><button type="button" className={!savedRegion ? 'active' : ''} onClick={() => setSavedRegion('')}>전체 <span>{places.length}</span></button>{savedRegionGroups.map(({ region, places: regionPlaces }) => <button type="button" key={region} className={savedRegion === region ? 'active' : ''} onClick={() => setSavedRegion(region)}>{region} <span>{regionPlaces.length}</span></button>)}</div></section><div className="saved-region-groups">{visibleSavedGroups.map(({ region, places: regionPlaces }) => { const collapsed = collapsedRegions.includes(region); return <section className="saved-region-section" key={region}><button type="button" className="saved-region-heading" onClick={() => toggleSavedRegion(region)} aria-expanded={!collapsed}><span><strong>{region}</strong><small>{regionPlaces.length}곳</small></span><span>{regionPlaces.map((place) => place.name).join(' · ')}</span>{collapsed ? <ArrowDown size={17} /> : <ArrowUp size={17} />}</button>{!collapsed && <div className="saved-list">{regionPlaces.map((place) => <article className="saved-card" key={place.id}><img src={place.image} alt={`${place.name} 저장 사진`} /><div className="saved-card-copy"><span>{place.area}</span><h3>{place.name}</h3><p>{place.hook ?? place.description}</p><div><Clock3 size={13} />{place.bestTime ?? place.duration}</div><button className="add-to-trip" onClick={() => onAdd(place)}>여행에 담기</button></div><button onClick={() => onRemove(place.id)} aria-label={`${place.name} 저장 취소`}><Bookmark size={19} fill="currentColor" /></button></article>)}</div>}</section>; })}</div></> : <div className="empty saved-empty"><span className="empty-icon"><Bookmark size={28} /></span><h2>내 장소를 더 담아보세요</h2><p>영상이나 지역 안내 목록에서 마음에 드는 랜드마크를 저장하면<br />AI가 내 장소만으로 새 여행을 만들어줍니다.</p><button className="outline" onClick={onGoDiscover}><Compass size={17} />장소 둘러보기</button></div>}
  </div>;
}

function CreatorAvatar({ name, image, size = 'medium' }: { name: string; image?: string; size?: 'small' | 'medium' | 'large' }) {
  return <span className={`creator-profile-avatar avatar-${size}`}>{image ? <img src={image} alt={`${name} 프로필 아이콘`} /> : name.slice(0, 1)}</span>;
}

function CreatorBadge({ copyCount, compact = false }: { copyCount: number; compact?: boolean }) {
  const tier = getCreatorTier(copyCount);
  const TierIcon = tier.icon;
  return <span className={`creator-tier-badge ${compact ? 'compact' : ''}`}><TierIcon size={compact ? 11 : 13} />{compact ? tier.shortLabel : tier.label}</span>;
}

function JourneySocialSection({ comments, cheers, profile, myCopyCount, onComment, onCheer }: { comments: JourneyComment[]; cheers: JourneyCheers; profile: CreatorProfile; myCopyCount: number; onComment: (body: string) => void; onCheer: (cheer: CheerKey) => void }) {
  const [commentDraft, setCommentDraft] = useState('');
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!commentDraft.trim()) return;
    onComment(commentDraft);
    setCommentDraft('');
  };
  return <section className="journey-social" aria-labelledby="journey-social-title">
    <header><div><small>TRAVELER REACTIONS</small><h2 id="journey-social-title">이 여행에 남긴 응원</h2></div><span><MessageCircle size={15} />{comments.length}</span></header>
    <div className="quick-cheers">{cheerOptions.map(({ id, label, icon: Icon }) => <button key={id} className={cheers.selected === id ? 'active' : ''} onClick={() => onCheer(id)} aria-pressed={cheers.selected === id}><Icon size={16} fill={cheers.selected === id ? 'currentColor' : 'none'} /><strong>{label}</strong><span>{cheers[id].toLocaleString()}</span></button>)}</div>
    <div className="comment-list">{comments.length ? comments.map((comment) => <article className="journey-comment" key={comment.id}><CreatorAvatar name={comment.author} image={comment.avatar} size="small" /><div><div className="comment-author"><CreatorBadge copyCount={comment.authorCopies} compact /><strong>{comment.author}</strong><time>{comment.createdAt}</time></div><p>{comment.body}</p></div></article>) : <div className="comment-empty"><Heart size={21} /><strong>첫 응원을 남겨보세요</strong><span>좋았던 점 한마디가 작성자에게 다음 여행을 올릴 힘이 됩니다.</span></div>}</div>
    <form className="comment-composer" onSubmit={submit}><CreatorAvatar name={profile.displayName} image={profile.avatar} size="small" /><label><span className="sr-only">댓글 작성</span><input value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} maxLength={180} placeholder="좋았던 점을 따뜻하게 남겨주세요" aria-label="댓글 작성" /></label><button type="submit" disabled={!commentDraft.trim()}>등록</button></form>
    <p className="social-kind-note"><CreatorBadge copyCount={myCopyCount} compact /> 내 등급이 댓글에도 함께 표시됩니다.</p>
  </section>;
}

function CreatorJourneySection({ journey, profile, authorJourneys, onOpenJourney }: { journey: Journey; profile: CreatorProfile; authorJourneys: Journey[]; onOpenJourney: (id: string) => void }) {
  const publicJourneys = authorJourneys.filter((item) => item.status === 'PUBLISHED');
  const copyCount = publicJourneys.reduce((sum, item) => sum + item.saves, 0);
  const name = journey.isMine ? profile.displayName : journey.author;
  const avatar = journey.isMine ? profile.avatar : undefined;
  return <section className="detail-creator" aria-labelledby="detail-creator-title">
    <div className="detail-creator-kicker">CREATOR</div>
    <div className="detail-creator-card"><CreatorAvatar name={name} image={avatar} size="large" /><div className="detail-creator-copy"><CreatorBadge copyCount={copyCount} /><h2 id="detail-creator-title">{name}</h2><p>{journey.isMine ? profile.bio : `${journey.region}을 비롯한 국내 여행의 장면과 동선을 기록합니다.`}</p></div><div className="detail-creator-numbers"><span><strong>{copyCount.toLocaleString()}</strong>누적 담김</span><span><strong>{publicJourneys.length}</strong>공개 여행기</span></div></div>
    <div className="creator-journey-heading"><strong>이 작성자의 여행기</strong><span>{publicJourneys.length}개</span></div>
    {publicJourneys.length ? <div className="creator-journey-list">{publicJourneys.slice(0, 4).map((item) => <button key={item.id} onClick={() => onOpenJourney(item.id)}><img src={item.cover} alt="" /><span><small>{item.region} · {item.duration}</small><strong>{item.title}</strong><em><Copy size={12} />{item.saves.toLocaleString()}명이 담아감</em></span><ChevronRight size={17} /></button>)}</div> : <div className="creator-journey-empty"><Globe2 size={22} /><strong>아직 공개한 여행기가 없어요</strong><p>여행기를 공개하면 담김 수와 응원을 받을 수 있습니다.</p></div>}
  </section>;
}

function JourneyDetail({ journey, profile, comments, cheers, authorJourneys, onBack, onShare, onSharePlace, onEdit, onDelete, onCopy, onComment, onCheer, onOpenJourney, copyLabel = '이 여행 복사해서 만들기' }: { journey: Journey; profile: CreatorProfile; comments: JourneyComment[]; cheers: JourneyCheers; authorJourneys: Journey[]; onBack: () => void; onShare: () => void; onSharePlace: (place: Place) => void; onEdit: () => void; onDelete: () => void; onCopy: () => void; onComment: (body: string) => void; onCheer: (cheer: CheerKey) => void; onOpenJourney: (id: string) => void; copyLabel?: string }) {
  const [selectedDay, setSelectedDay] = useState(journey.days[0]?.day ?? 1);
  const dayHeadingRef = useRef<HTMLElement>(null);
  const day = journey.days.find((item) => item.day === selectedDay) ?? journey.days[0];
  const myCopyCount = authorJourneys.filter((item) => item.isMine && item.status === 'PUBLISHED').reduce((sum, item) => sum + item.saves, 0);
  const authorCopyCount = authorJourneys.filter((item) => item.status === 'PUBLISHED').reduce((sum, item) => sum + item.saves, 0);
  const selectDay = (dayNumber: number) => {
    setSelectedDay(dayNumber);
    window.requestAnimationFrame(() => dayHeadingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  return <div className="journey-detail">
    <header className="detail-topbar"><button onClick={onBack} aria-label="뒤로"><ArrowLeft size={21} /></button><strong>{journey.isMine ? '내 여행기' : '여행 가이드'}</strong><button onClick={journey.isMine ? onEdit : onShare} aria-label={journey.isMine ? '여행기 편집' : '여행 공유'}>{journey.isMine ? <Edit3 size={19} /> : <Share2 size={20} />}</button></header>
    <section className="detail-hero"><img src={journey.cover} alt="" /><div className="detail-hero-shade" /><div className="detail-title"><span>{journey.region} · {journey.duration}</span><h1>{journey.title}</h1><p>{journey.dateRange}</p></div></section>
    <section className="journal-lead"><div className="author-line"><CreatorAvatar name={journey.isMine ? profile.displayName : journey.author} image={journey.isMine ? profile.avatar : undefined} size="medium" /><div><span className="author-name-row"><CreatorBadge copyCount={authorCopyCount} compact /><strong>{journey.isMine ? profile.displayName : journey.author}</strong></span><small>{journey.visibility === 'PUBLIC' ? '전체 공개 여행일기' : '나만 보는 여행 초안'}</small></div><button onClick={onShare}><Share2 size={16} />공유</button></div>{journey.sourceAuthor && <div className="copied-source"><Copy size={14} />{journey.sourceAuthor}의 여행기를 복사해 만든 내 버전</div>}<p className="summary">{journey.summary}</p><p className="story">{journey.story}</p><div className="guide-facts"><div><small>전체 일정</small><strong>{journey.duration}</strong></div><div><small>기록 장소</small><strong>{journeyPlaceCount(journey)}곳</strong></div><div><small>가이드 구성</small><strong>{journey.days.length}개 DAY</strong></div></div><div className="journal-meta"><span><Eye size={14} />{(journey.views ?? 0).toLocaleString()}회 조회</span><span><Copy size={14} />{journey.saves.toLocaleString()}명이 담아감</span><span><MessageCircle size={14} />댓글 {comments.length}개</span><span><MapPin size={14} />{journeyPlaceCount(journey)}개 장소</span></div><div className="journal-tags">{journey.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div></section>
    <nav className="day-tabs" aria-label="여행 날짜">{journey.days.map((item) => <button key={item.day} className={selectedDay === item.day ? 'active' : ''} aria-current={selectedDay === item.day ? 'page' : undefined} onClick={() => selectDay(item.day)}><small>DAY {item.day}</small><strong>{item.date}</strong></button>)}</nav>
    {day && <>
      <section className="day-heading" ref={dayHeadingRef}><small>DAY {day.day} · {day.date}</small><h2>{day.title}</h2><p>{day.story}</p></section>
      {day.blocks.length > 0
        ? <article className="guide-story">{day.blocks.map((block) => block.type === 'TEXT'
          ? <section className="story-text-block" key={block.id}>{block.heading && <h3>{block.heading}</h3>}<p>{block.body}</p></section>
          : block.type === 'IMAGE'
            ? block.image && <figure className="story-image-block" key={block.id}><img src={block.image} alt={block.caption || '여행 사진'} />{block.caption && <figcaption>{block.caption}</figcaption>}</figure>
            : <GuidePlaceEmbed key={block.id} place={day.places.find((place) => place.id === block.placeId)} onShare={onSharePlace} />
        )}</article>
        : !day.places.length && <div className="empty-day"><MapPin size={26} /><strong>아직 작성한 이야기가 없습니다</strong><p>글과 사진을 먼저 넣고, 필요한 장소는<br />직접 등록하거나 목록에서 골라보세요.</p></div>}
      {day.places.length > 0 && <section className="day-route-section"><div className="day-route-title"><small>ROUTE MAP</small><h3>이날의 동선 한눈에 보기</h3></div><RouteMap key={`${journey.id}-${day.day}`} places={day.places} /><section className="route-summary"><Route size={17} /><div><strong>이날의 이동 방향</strong><span>{day.places.map((place) => place.name).join(' → ')}</span></div></section></section>}
    </>}
    <JourneySocialSection comments={comments} cheers={cheers} profile={profile} myCopyCount={myCopyCount} onComment={onComment} onCheer={onCheer} />
    <CreatorJourneySection journey={journey} profile={profile} authorJourneys={authorJourneys} onOpenJourney={onOpenJourney} />
    <footer className={`detail-footer ${journey.isMine ? 'owner-footer' : 'reader-footer'}`}>{journey.isMine
      ? <><button className="delete-journey" onClick={onDelete}><Trash2 size={17} />삭제</button><button onClick={onEdit}><Edit3 size={18} />이 여행기 이어서 쓰기</button></>
      : <><button className="share-small" onClick={onShare} aria-label="여행기 공유"><Share2 size={18} /></button><button onClick={onCopy}><Copy size={18} />{copyLabel}</button></>
    }</footer>
  </div>;
}

function GuidePlaceEmbed({ place, onShare }: { place?: Place; onShare: (place: Place) => void }) {
  if (!place) return null;
  const Icon = kindIcon[place.kind];
  return <aside className="guide-place-embed"><img src={place.image} alt="" /><div className="guide-place-copy"><div className="place-kind"><Icon size={13} />{placeKindLabel[place.kind]}</div><h3>{place.name}</h3><div className="guide-place-time"><Clock3 size={14} />{place.time ? `${place.time} 도착 · ${place.duration} 체류` : place.duration}</div><p>{place.description}</p><blockquote>“{place.note}”</blockquote><div><button onClick={() => openExternal(kakaoDirectionsUrl(place))}><Navigation size={15} />길찾기</button><button onClick={() => onShare(place)}><Share2 size={15} />공유</button></div></div></aside>;
}

function JourneyEditor({ journey, onBack, onSave }: { journey: Journey; onBack: () => void; onSave: (journey: Journey) => void }) {
  const [draft, setDraft] = useState<Journey>(() => structuredClone(journey));
  const [selectedDay, setSelectedDay] = useState(journey.days[0]?.day ?? 1);
  const [pickerKind, setPickerKind] = useState<PlaceKind | null>(null);
  const day = draft.days.find((item) => item.day === selectedDay) ?? draft.days[0];

  const updateDay = (patch: Partial<JourneyDay>) => setDraft((current) => ({
    ...current,
    days: current.days.map((item) => item.day === selectedDay ? { ...item, ...patch } : item),
  }));
  const updateBlock = (id: string, patch: Partial<StoryBlock>) => updateDay({ blocks: day.blocks.map((block) => block.id === id ? { ...block, ...patch } : block) });
  const updatePlace = (id: string, patch: Partial<Place>) => updateDay({ places: day.places.map((place) => place.id === id ? { ...place, ...patch } : place) });
  const moveBlock = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= day.blocks.length) return;
    const blocks = [...day.blocks];
    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
    updateDay({ blocks });
  };
  const removeBlock = (block: StoryBlock) => {
    const blocks = day.blocks.filter((item) => item.id !== block.id);
    const stillUsed = block.placeId && blocks.some((item) => item.placeId === block.placeId);
    updateDay({ blocks, places: stillUsed ? day.places : day.places.filter((place) => place.id !== block.placeId) });
  };
  const addTextBlock = () => updateDay({ blocks: [...day.blocks, { id: `text-${Date.now()}`, type: 'TEXT', heading: '', body: '' }] });
  const addImageBlock = () => updateDay({ blocks: [...day.blocks, { id: `image-${Date.now()}`, type: 'IMAGE', image: '', caption: '' }] });
  const addPlaceBlock = (place: Place) => {
    const exists = day.places.some((item) => item.id === place.id);
    updateDay({
      places: exists ? day.places : [...day.places, { ...place, move: day.places.length ? '이동시간 확인 필요' : '여행 시작' }],
      blocks: [...day.blocks, { id: `place-${place.id}-${Date.now()}`, type: 'PLACE', placeId: place.id }],
    });
    setPickerKind(null);
  };
  const addDay = () => {
    const nextDay = draft.days.length + 1;
    setDraft((current) => ({
      ...current,
      duration: `${nextDay - 1}박 ${nextDay}일`,
      days: [...current.days, { day: nextDay, date: `DAY ${nextDay}`, title: `${nextDay}일차 이야기`, story: '이날의 이동과 기억을 한 문장으로 정리해 보세요.', places: [], blocks: [] }],
    }));
    setSelectedDay(nextDay);
  };
  const removeSelectedDay = () => {
    if (draft.days.length <= 1) return;
    const selectedIndex = draft.days.findIndex((item) => item.day === selectedDay);
    const remainingDays = draft.days
      .filter((item) => item.day !== selectedDay)
      .map((item, index) => ({
        ...item,
        day: index + 1,
        date: /^DAY\s+\d+$/i.test(item.date) ? `DAY ${index + 1}` : item.date,
      }));
    const nextSelectedIndex = Math.min(Math.max(selectedIndex, 0), remainingDays.length - 1);
    setDraft((current) => ({
      ...current,
      duration: remainingDays.length === 1 ? '당일 여행' : `${remainingDays.length - 1}박 ${remainingDays.length}일`,
      days: remainingDays,
    }));
    setSelectedDay(remainingDays[nextSelectedIndex].day);
  };
  const setPublishing = (status: Journey['status']) => setDraft((current) => ({ ...current, status, visibility: status === 'PUBLISHED' ? 'PUBLIC' : 'PRIVATE' }));

  return <div className="journey-editor">
    <header className="editor-topbar"><button onClick={onBack} aria-label="편집 취소"><ArrowLeft size={20} /></button><div><small>{draft.sourceAuthor ? `${draft.sourceAuthor}의 가이드에서 복사됨` : 'TRAVEL JOURNAL EDITOR'}</small><strong>여행기 작성</strong></div><button className="save-editor" onClick={() => onSave(draft)}><Save size={16} />저장</button></header>
    <section className="editor-cover"><img src={draft.cover} alt="" /><div /><span>{draft.region}</span><p>표지 사진</p></section>
    <section className="editor-basics">
      <label><span>여행기 제목</span><input aria-label="여행기 제목" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} /></label>
      <div className="editor-row"><label><span>지역</span><input aria-label="여행 지역" value={draft.region} onChange={(event) => setDraft((current) => ({ ...current, region: event.target.value }))} /></label><label><span>기간</span><input aria-label="여행 기간" value={draft.duration} onChange={(event) => setDraft((current) => ({ ...current, duration: event.target.value }))} /></label></div>
      <label><span>한 줄 소개</span><textarea aria-label="여행기 한 줄 소개" rows={2} value={draft.summary} onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))} /></label>
      <label><span>여행 전체 이야기</span><textarea aria-label="여행 전체 이야기" rows={4} value={draft.story} onChange={(event) => setDraft((current) => ({ ...current, story: event.target.value }))} /></label>
      <label><span>공개 상태</span><select aria-label="공개 상태" value={draft.status} onChange={(event) => setPublishing(event.target.value as Journey['status'])}><option value="PLANNING">비공개 초안</option><option value="TRAVELING">여행 중</option><option value="PUBLISHED">공개 여행일기로 발행</option></select></label>
    </section>

    <nav className="editor-day-tabs" aria-label="작성할 날짜">
      {draft.days.map((item) => <button type="button" key={item.day} className={item.day === selectedDay ? 'active' : ''} onClick={() => setSelectedDay(item.day)}>DAY {item.day}</button>)}
      <button type="button" className="add-day" onClick={addDay}><Plus size={14} />날짜</button>
      {draft.days.length > 1 && <button type="button" className="remove-day" onClick={removeSelectedDay} aria-label={`DAY ${selectedDay} 삭제`}><Trash2 size={14} />DAY {selectedDay} 삭제</button>}
    </nav>
    {day && <section className="day-editor">
      <div className="day-editor-heading"><small>DAY {day.day}</small><input aria-label="날짜 제목" value={day.title} onChange={(event) => updateDay({ title: event.target.value })} /><textarea aria-label="날짜 소개" rows={2} value={day.story} onChange={(event) => updateDay({ story: event.target.value })} /></div>
      <div className="composer-guide"><Edit3 size={18} /><div><strong>글·사진·장소를 순서대로 엮어보세요</strong><p>여행 사진을 본문 사이에 넣고, 숙소·맛집·카페는 직접 정보를 적거나 준비된 목록에서 고를 수 있습니다.</p></div></div>
      <div className="editor-blocks">{day.blocks.map((block, index) => block.type === 'TEXT'
        ? <article className="editor-text-block" key={block.id}><div className="block-toolbar"><span>글</span><BlockControls index={index} total={day.blocks.length} onMove={moveBlock} onRemove={() => removeBlock(block)} /></div><input aria-label={`글 ${index + 1} 소제목`} value={block.heading ?? ''} onChange={(event) => updateBlock(block.id, { heading: event.target.value })} placeholder="소제목을 입력하세요" /><textarea aria-label={`글 ${index + 1} 본문`} rows={6} value={block.body ?? ''} onChange={(event) => updateBlock(block.id, { body: event.target.value })} placeholder="이 장소에서 무엇을 보고 느꼈는지, 다음 장소로 왜 이동했는지 써보세요." /></article>
        : block.type === 'IMAGE'
          ? <EditorImageBlock key={block.id} block={block} index={index} total={day.blocks.length} onUpdate={(patch) => updateBlock(block.id, patch)} onMove={moveBlock} onRemove={() => removeBlock(block)} />
          : <EditorPlaceBlock key={block.id} block={block} place={day.places.find((place) => place.id === block.placeId)} index={index} total={day.blocks.length} onUpdate={(patch) => block.placeId && updatePlace(block.placeId, patch)} onMove={moveBlock} onRemove={() => removeBlock(block)} />
      )}</div>
      {!day.blocks.length && <div className="empty-composer"><Edit3 size={24} /><strong>첫 장면을 시작해 보세요</strong><p>글, 사진, 장소 카드를 원하는 순서로 추가할 수 있습니다.</p></div>}
      <div className="insert-toolbar"><span>본문에 삽입</span><div><button onClick={addTextBlock}><Edit3 size={16} />글</button><button onClick={addImageBlock}><ImagePlus size={16} />사진</button><button onClick={() => setPickerKind('LANDMARK')}><MapPin size={16} />장소</button><button onClick={() => setPickerKind('STAY')}><Hotel size={16} />숙소</button><button onClick={() => setPickerKind('FOOD')}><Utensils size={16} />맛집</button><button onClick={() => setPickerKind('CAFE')}><Coffee size={16} />카페</button></div></div>
    </section>}
    <footer className="editor-footer"><button onClick={() => onSave(draft)}><Save size={18} />여행기 저장하고 미리보기</button></footer>
    {pickerKind && <PlacePicker kind={pickerKind} region={draft.region} onClose={() => setPickerKind(null)} onSelect={addPlaceBlock} />}
  </div>;
}

function BlockControls({ index, total, onMove, onRemove }: { index: number; total: number; onMove: (index: number, direction: -1 | 1) => void; onRemove: () => void }) {
  return <div className="block-controls"><button disabled={index === 0} onClick={() => onMove(index, -1)} aria-label="위로 이동"><ArrowUp size={14} /></button><button disabled={index === total - 1} onClick={() => onMove(index, 1)} aria-label="아래로 이동"><ArrowDown size={14} /></button><button onClick={onRemove} aria-label="블록 삭제">×</button></div>;
}

function EditorImageBlock({ block, index, total, onUpdate, onMove, onRemove }: { block: StoryBlock; index: number; total: number; onUpdate: (patch: Partial<StoryBlock>) => void; onMove: (index: number, direction: -1 | 1) => void; onRemove: () => void }) {
  const handleImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      onUpdate({ image: await resizeImageFile(file) });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '사진을 불러오지 못했습니다.');
    }
  };
  return <article className="editor-image-block"><div className="block-toolbar"><span><ImagePlus size={13} />사진</span><BlockControls index={index} total={total} onMove={onMove} onRemove={onRemove} /></div>
    <label className={`image-upload ${block.image ? 'has-image' : ''}`}>{block.image ? <img src={block.image} alt="업로드한 여행 사진" /> : <><ImagePlus size={26} /><strong>여행 사진 선택</strong><small>사진은 저장 전에 모바일용으로 줄여집니다.</small></>}<input type="file" accept="image/*" capture="environment" onChange={(event) => void handleImage(event)} /></label>
    <input aria-label={`사진 ${index + 1} 설명`} value={block.caption ?? ''} onChange={(event) => onUpdate({ caption: event.target.value })} placeholder="사진 설명을 적어주세요 (선택)" />
  </article>;
}

function EditorPlaceBlock({ block, place, index, total, onUpdate, onMove, onRemove }: { block: StoryBlock; place?: Place; index: number; total: number; onUpdate: (patch: Partial<Place>) => void; onMove: (index: number, direction: -1 | 1) => void; onRemove: () => void }) {
  if (!place) return null;
  const Icon = kindIcon[place.kind];
  return <article className="editor-place-block"><div className="block-toolbar"><span><Icon size={13} />{placeKindLabel[place.kind]} 카드</span><BlockControls index={index} total={total} onMove={onMove} onRemove={onRemove} /></div><div className="editor-place-preview"><img src={place.image} alt="" /><div><strong>{place.name}</strong><small>{place.address}</small><p>{place.note}</p></div></div><div className="editor-place-fields"><label><span>도착 시각</span><input type="time" value={place.time ?? ''} onChange={(event) => onUpdate({ time: event.target.value })} /></label><label><span>체류 시간</span><input value={place.duration} onChange={(event) => onUpdate({ duration: event.target.value })} placeholder="예: 1시간 20분" /></label><label className="wide-field"><span>이동 메모</span><input value={place.move ?? ''} onChange={(event) => onUpdate({ move: event.target.value })} placeholder="예: 차량 25분" /></label></div></article>;
}

function PlacePicker({ kind, region, onClose, onSelect }: { kind: PlaceKind; region: string; onClose: () => void; onSelect: (place: Place) => void }) {
  const [mode, setMode] = useState<'CUSTOM' | 'CATALOG'>('CUSTOM');
  const [custom, setCustom] = useState({ name: '', area: region, address: '', description: '', note: '', duration: kind === 'STAY' ? '숙박' : '' , image: '' });
  const candidates = placeCatalog.filter((place) => place.kind === kind).sort((a, b) => Number(b.area.includes(region)) - Number(a.area.includes(region)));
  const updateCustom = (key: keyof typeof custom, value: string) => setCustom((current) => ({ ...current, [key]: value }));
  const handleCustomImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      updateCustom('image', await resizeImageFile(file, 1200, 0.8));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '사진을 불러오지 못했습니다.');
    }
  };
  const addCustomPlace = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!custom.name.trim()) return;
    const fallbackImage = candidates[0]?.image ?? discoveryLandmarks[0].image;
    onSelect({
      id: `custom-${kind.toLowerCase()}-${Date.now()}`,
      kind,
      name: custom.name.trim(),
      area: custom.area.trim() || region,
      address: custom.address.trim(),
      lat: Number.NaN,
      lng: Number.NaN,
      image: custom.image || fallbackImage,
      description: custom.description.trim() || '직접 기록한 여행 장소입니다.',
      note: custom.note.trim() || '다녀온 뒤의 경험과 추천 포인트를 더 적어보세요.',
      duration: custom.duration.trim() || (kind === 'STAY' ? '숙박' : '체류 시간 미입력'),
    });
  };
  return <div className="sheet-backdrop"><section className="place-picker"><div className="sheet-handle" /><header><div><small>ADD TO STORY</small><h2>{placeKindLabel[kind]} 삽입</h2></div><button onClick={onClose} aria-label="장소 선택 닫기">×</button></header>
    <div className="place-picker-tabs"><button className={mode === 'CUSTOM' ? 'active' : ''} onClick={() => setMode('CUSTOM')}>직접 등록</button><button className={mode === 'CATALOG' ? 'active' : ''} onClick={() => setMode('CATALOG')}>목록에서 선택</button></div>
    {mode === 'CUSTOM' ? <form className="custom-place-form" onSubmit={addCustomPlace}>
      <p>모든 업체를 미리 등록할 필요 없이, 직접 다녀온 정보를 여행기에 남기세요.</p>
      <label className={`custom-photo-field ${custom.image ? 'has-image' : ''}`}>{custom.image ? <img src={custom.image} alt="등록할 장소" /> : <><ImagePlus size={22} /><span>{placeKindLabel[kind]} 사진 추가</span></>}<input type="file" accept="image/*" capture="environment" onChange={(event) => void handleCustomImage(event)} /></label>
      <label><span>{placeKindLabel[kind]} 이름 *</span><input required value={custom.name} onChange={(event) => updateCustom('name', event.target.value)} placeholder={kind === 'STAY' ? '예: 바다 앞 작은 펜션' : '장소 이름'} /></label>
      <div className="custom-place-row"><label><span>지역</span><input value={custom.area} onChange={(event) => updateCustom('area', event.target.value)} placeholder="예: 부산 해운대" /></label><label><span>{kind === 'STAY' ? '숙박 형태' : '머문 시간'}</span><input value={custom.duration} onChange={(event) => updateCustom('duration', event.target.value)} placeholder={kind === 'STAY' ? '1박' : '약 1시간'} /></label></div>
      <label><span>주소</span><input value={custom.address} onChange={(event) => updateCustom('address', event.target.value)} placeholder="주소를 입력하면 길찾기 검색에 사용합니다" /></label>
      <label><span>정보 소개</span><textarea rows={2} value={custom.description} onChange={(event) => updateCustom('description', event.target.value)} placeholder={kind === 'STAY' ? '객실, 위치, 주변 동선 등 기본 정보를 적어주세요.' : '어떤 곳인지 간단히 소개해 주세요.'} /></label>
      <label><span>내 경험과 추천 포인트</span><textarea rows={3} value={custom.note} onChange={(event) => updateCustom('note', event.target.value)} placeholder={kind === 'STAY' ? '실제로 묵어보니 좋았던 점, 체크인 팁 등을 적어주세요.' : '직접 다녀와서 알게 된 팁을 적어주세요.'} /></label>
      <button className="primary custom-place-submit" type="submit"><Plus size={17} />{placeKindLabel[kind]} 카드 추가</button>
    </form> : <><p>준비된 항목은 빠르게 고르는 보조 목록입니다. 없으면 직접 등록하세요.</p><div className="picker-list">{candidates.map((place) => <button key={place.id} onClick={() => onSelect(place)}><img src={place.image} alt="" /><span><strong>{place.name}</strong><small>{place.area} · {place.address}</small></span><Plus size={17} /></button>)}</div></>}
  </section></div>;
}

function RouteMap({ places }: { places: Place[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mappablePlaces = useMemo(() => places.filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lng)), [places]);
  const estimatedRoute = useMemo(() => makeEstimatedRoute(mappablePlaces), [mappablePlaces]);
  const [routeResult, setRouteResult] = useState<RouteResult>(estimatedRoute);
  const [routeLoading, setRouteLoading] = useState(false);

  useEffect(() => {
    setRouteResult(estimatedRoute);
    if (mappablePlaces.length < 2) {
      setRouteLoading(false);
      return;
    }
    const controller = new AbortController();
    setRouteLoading(true);
    void fetchRoadRoute(mappablePlaces, controller.signal)
      .then((result) => setRouteResult(result))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setRouteResult(estimatedRoute);
      })
      .finally(() => {
        if (!controller.signal.aborted) setRouteLoading(false);
      });
    return () => controller.abort();
  }, [estimatedRoute, mappablePlaces]);

  useEffect(() => {
    if (!containerRef.current || !mappablePlaces.length) return;
    const container = containerRef.current;
    let disposed = false;
    let map: { remove: () => void } | null = null;
    let animationFrame: number | null = null;
    let routeOverlay: SVGSVGElement | null = null;
    let detachOverlayListeners: (() => void) | null = null;
    void import('maplibre-gl').then(({ AttributionControl, LngLatBounds, Map: MapLibreMap, Marker }) => {
      if (disposed) return;
      const instance = new MapLibreMap({
        container,
        style: {
          version: 8,
          sources: {
            osm: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '© OpenStreetMap contributors',
            },
          },
          layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
        },
        center: [mappablePlaces[0].lng, mappablePlaces[0].lat],
        zoom: 11,
        attributionControl: false,
      });
      map = instance;
      instance.addControl(new AttributionControl({ compact: true }), 'bottom-right');
      const bounds = new LngLatBounds();
      routeResult.coordinates.forEach((coordinate) => {
        if (Number.isFinite(coordinate[0]) && Number.isFinite(coordinate[1])) bounds.extend(coordinate);
      });
      mappablePlaces.forEach((place, index) => {
        bounds.extend([place.lng, place.lat]);
        const marker = document.createElement('div');
        marker.className = 'route-marker';
        marker.textContent = String(index + 1);
        marker.title = `${index + 1}. ${place.name}`;
        marker.setAttribute('aria-label', `${index + 1}번 장소 ${place.name}`);
        const closeToPrevious = index > 0 && distanceKm(mappablePlaces[index - 1], place) < 0.8;
        const closeToNext = index < mappablePlaces.length - 1 && distanceKm(place, mappablePlaces[index + 1]) < 0.8;
        const offset: [number, number] = closeToPrevious ? [15, -8] : closeToNext ? [-15, 8] : [0, 0];
        new Marker({ element: marker, anchor: 'center', offset }).setLngLat([place.lng, place.lat]).addTo(instance);
      });
      instance.on('load', () => {
        if (routeResult.coordinates.length > 1) {
          instance.addSource('route', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: routeResult.coordinates } } });
          instance.addLayer({ id: 'route-shadow', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#241f1c', 'line-width': 13, 'line-opacity': 0.16, 'line-blur': 2 } });
          instance.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 10, 'line-opacity': 0.98 } });
          instance.addLayer({ id: 'route-line', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ff4f35', 'line-width': 5.5, 'line-opacity': 1 } });

          const route = routeResult.coordinates;
          const svgNamespace = 'http://www.w3.org/2000/svg';
          routeOverlay = document.createElementNS(svgNamespace, 'svg');
          routeOverlay.classList.add('route-map-overlay');
          routeOverlay.setAttribute('aria-hidden', 'true');
          const overlayCasing = document.createElementNS(svgNamespace, 'path');
          overlayCasing.classList.add('route-overlay-casing');
          const overlayLine = document.createElementNS(svgNamespace, 'path');
          overlayLine.classList.add('route-overlay-line');
          routeOverlay.append(overlayCasing, overlayLine);
          container.append(routeOverlay);
          const updateRouteOverlay = () => {
            const path = route.map((coordinate, index) => {
              const point = instance.project(coordinate);
              return `${index ? 'L' : 'M'}${point.x.toFixed(1)},${point.y.toFixed(1)}`;
            }).join(' ');
            overlayCasing.setAttribute('d', path);
            overlayLine.setAttribute('d', path);
          };
          instance.on('move', updateRouteOverlay);
          instance.on('resize', updateRouteOverlay);
          detachOverlayListeners = () => {
            instance.off('move', updateRouteOverlay);
            instance.off('resize', updateRouteOverlay);
          };

          const traveler = document.createElement('div');
          traveler.className = 'route-traveler';
          traveler.innerHTML = '<span>➜</span>';
          traveler.setAttribute('aria-hidden', 'true');
          const travelerMarker = new Marker({ element: traveler, anchor: 'center' }).setLngLat(route[0]).addTo(instance);
          const segmentLengths = route.slice(1).map((coordinate, index) => {
            const [fromLng, fromLat] = route[index];
            const [toLng, toLat] = coordinate;
            const latitudeScale = Math.cos(((fromLat + toLat) / 2) * Math.PI / 180);
            return Math.hypot((toLng - fromLng) * latitudeScale, toLat - fromLat);
          });
          const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0) || 1;
          const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          const startedAt = performance.now();
          const animateTraveler = (now: number) => {
            if (disposed) return;
            let distanceAt = reduceMotion ? totalLength * 0.5 : (((now - startedAt) % 12000) / 12000) * totalLength;
            let segmentIndex = 0;
            while (segmentIndex < segmentLengths.length - 1 && distanceAt > segmentLengths[segmentIndex]) {
              distanceAt -= segmentLengths[segmentIndex];
              segmentIndex += 1;
            }
            const from = route[segmentIndex];
            const to = route[segmentIndex + 1];
            const ratio = Math.min(1, distanceAt / (segmentLengths[segmentIndex] || 1));
            travelerMarker.setLngLat([from[0] + (to[0] - from[0]) * ratio, from[1] + (to[1] - from[1]) * ratio]);
            const arrow = traveler.firstElementChild as HTMLElement | null;
            if (arrow) arrow.style.transform = `rotate(${-Math.atan2(to[1] - from[1], to[0] - from[0])}rad)`;
            if (!reduceMotion) animationFrame = requestAnimationFrame(animateTraveler);
          };
          animationFrame = requestAnimationFrame(animateTraveler);
        }
        instance.fitBounds(bounds, { padding: 34, maxZoom: 13, duration: 0 });
        window.requestAnimationFrame(() => instance.triggerRepaint());
      });
    });

    return () => {
      disposed = true;
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      detachOverlayListeners?.();
      routeOverlay?.remove();
      map?.remove();
    };
  }, [mappablePlaces, routeResult]);

  const routeStatus = routeLoading
    ? '도로 경로 계산 중'
    : routeResult.legs.length
      ? `${routeResult.minutes}분 · ${routeResult.distanceKm.toFixed(1)}km`
      : `${places.length}개 장소`;
  const scheduleChecks = routeResult.legs.map(scheduleCheckForLeg).filter((check): check is NonNullable<typeof check> => check !== null);
  const conflictCount = scheduleChecks.filter((check) => check.margin < 0).length;

  return <section className="map-card"><div className="map-label"><MapIcon size={15} /><span>DAY ROUTE</span><strong aria-live="polite">{routeStatus}</strong></div>{mappablePlaces.length ? <div className="route-map" ref={containerRef} /> : <div className="route-map-unavailable"><MapPin size={24} /><strong>주소로 길찾기할 수 있어요</strong><span>지도 좌표 연결은 장소 검색 기능을 붙일 때 자동화됩니다.</span></div>}
    {routeResult.legs.length > 0 && <div className="route-leg-list">{routeResult.legs.map((leg) => {
      const schedule = scheduleCheckForLeg(leg);
      return <div className="route-leg" key={`${leg.from.id}-${leg.to.id}`}><span className="route-leg-icon">{leg.mode === 'WALK' ? <Footprints size={15} /> : <Car size={15} />}</span><div><small>{leg.from.time ?? '--:--'} → {leg.to.time ?? '--:--'} · {leg.mode === 'WALK' ? '도보' : '차량'}</small><strong>{leg.from.name} → {leg.to.name}</strong>{schedule && <span className={`route-leg-schedule ${schedule.margin < 0 ? 'conflict' : 'okay'}`}>{schedule.text}</span>}</div><em>약 {leg.minutes}분<br />{leg.distanceKm.toFixed(1)}km</em></div>;
    })}</div>}
    {routeResult.legs.length > 0 && <div className={`route-schedule-summary ${conflictCount ? 'conflict' : 'okay'}`}><Check size={15} /><span>{scheduleChecks.length === 0 ? '도착 시각과 체류시간을 입력하면 일정 충돌을 확인합니다.' : conflictCount ? `${conflictCount}개 구간의 시간이 부족합니다.` : `시간을 입력한 ${scheduleChecks.length}개 구간 모두 여유가 있습니다.`}</span></div>}
    {routeResult.legs.length > 0 && <p className="route-data-note">{routeResult.source === 'ROAD' ? '도로 경로 기준 예상치입니다. 실시간 교통은 길찾기에서 다시 확인하세요.' : '도로 경로를 불러오지 못해 직선거리 기준으로 계산했습니다.'}</p>}
  </section>;
}

const kindIcon: Record<PlaceKind, LucideIcon> = { LANDMARK: MapPin, STAY: Hotel, FOOD: Utensils, CAFE: Coffee, SHOP: Store };

function PlaceJournalCard({ place, index, onShare }: { place: Place; index: number; onShare: () => void }) {
  const Icon = kindIcon[place.kind];
  return <article className="place-journal-card"><div className="timeline-rail"><span>{index + 1}</span><i /></div><div className="place-card-body"><div className="move-label"><Footprints size={13} />{place.move}</div><img src={place.image} alt="" /><div className="place-card-copy"><div className="place-kind"><Icon size={13} />{placeKindLabel[place.kind]}</div><h3>{place.name}</h3><p className="address">{place.address}</p><p>{place.description}</p><blockquote>{place.note}</blockquote><div className="place-card-actions"><button onClick={() => openExternal(kakaoDirectionsUrl(place))}><Navigation size={15} />길찾기</button><button onClick={onShare}><Share2 size={15} />장소 공유</button></div></div></div></article>;
}

function CreateJourneySheet({ onClose, onCreate }: { onClose: () => void; onCreate: (title: string, region: string) => void }) {
  const [region, setRegion] = useState('제주');
  const [title, setTitle] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onCreate(title.trim() || `${region}에서 남길 새로운 기록`, region);
  };
  return <div className="sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="create-sheet" onSubmit={submit}><div className="sheet-handle" /><div className="sheet-title"><div><small>NEW DOMESTIC TRIP</small><h2>새 여행 만들기</h2></div><button type="button" onClick={onClose} aria-label="닫기">×</button></div><label><span>국내 지역</span><select value={region} onChange={(event) => setRegion(event.target.value)}><option>제주</option><option>서울</option><option>강릉</option><option>부산</option><option>경주</option><option>전주</option></select></label><label><span>여행 제목</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={`${region}에서 남길 새로운 기록`} /></label><p>여행은 여러 개 만들 수 있습니다. 먼저 비공개 초안으로 만들고, 다녀온 뒤 상세 일기와 동선을 공개할 수 있어요.</p><button className="primary wide" type="submit"><Plus size={18} />여행 만들기</button></form></div>;
}

function Profile({ native, journeys, comments, cheers, profile, notificationPreferences, notificationPermission, onBack, onProfileChange, onNotificationPreferencesChange, onPreviewNotification, onOpen }: { native: boolean; journeys: Journey[]; comments: JourneyComment[]; cheers: CheerStore; profile: CreatorProfile; notificationPreferences: NotificationPreferences; notificationPermission: 'granted' | 'denied' | 'undetermined'; onBack: () => void; onProfileChange: (profile: CreatorProfile) => void; onNotificationPreferencesChange: (preferences: NotificationPreferences) => void; onPreviewNotification: () => void; onOpen: (id: string) => void }) {
  const mine = journeys.filter((journey) => journey.isMine);
  const published = mine.filter((journey) => journey.status === 'PUBLISHED');
  const mineIds = new Set(mine.map((journey) => journey.id));
  const receivedComments = comments.filter((comment) => mineIds.has(comment.journeyId));
  const copyCount = published.reduce((sum, journey) => sum + journey.saves, 0);
  const reactionCounts = published.reduce((totals, journey) => {
    const value = cheers[journey.id];
    if (!value) return totals;
    cheerOptions.forEach(({ id }) => { totals[id] += value[id]; });
    return totals;
  }, { LOVE: 0, BEST: 0, HELPFUL: 0 } as Record<CheerKey, number>);
  const reactionTotal = Object.values(reactionCounts).reduce((sum, value) => sum + value, 0);
  const creatorScore = copyCount * 10 + reactionTotal * 2 + receivedComments.length * 5 + published.length * 50;
  const tier = getCreatorTier(copyCount);
  const TierIcon = tier.icon;
  const nextTier = getNextCreatorTier(copyCount);
  const levelProgress = nextTier ? Math.max(0, Math.min(100, ((copyCount - tier.min) / (nextTier.min - tier.min)) * 100)) : 100;
  const notificationStatus = !native ? '앱에서 권한 확인' : notificationPermission === 'granted' ? '기기 알림 허용됨' : notificationPermission === 'denied' ? '기기 권한이 꺼져 있어요' : '권한 확인 전';
  const handleAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      onProfileChange({ ...profile, avatar: await resizeImageFile(file, 480, 0.84) });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '프로필 아이콘을 불러오지 못했습니다.');
    }
  };

  return <div className="page profile-page"><header className="profile-topbar"><button onClick={onBack} aria-label="홈으로 돌아가기"><ArrowLeft size={21} /></button><div><small>{mine.length}개의 여행 · {published.length}개의 공개 일기</small><h1>프로필</h1></div></header>
    <div className="profile-card creator-profile-card"><label className="profile-avatar-upload"><CreatorAvatar name={profile.displayName} image={profile.avatar} size="large" /><span className="profile-avatar-edit"><Upload size={13} /></span><input type="file" accept="image/*" onChange={(event) => void handleAvatar(event)} aria-label="내 프로필 아이콘 업로드" /></label><div><div className="profile-name-row"><CreatorBadge copyCount={copyCount} /><h3>{profile.displayName}</h3></div><p>{profile.bio}</p><button onClick={() => document.querySelector<HTMLInputElement>('.profile-avatar-upload input')?.click()}><ImagePlus size={13} />내 아이콘 바꾸기</button></div></div>

    <div className="profile-stats creator-stats"><div><strong>{copyCount.toLocaleString()}</strong><span>누적 담김</span></div><div><strong>{(reactionTotal + receivedComments.length).toLocaleString()}</strong><span>받은 응원</span></div><div><strong>{creatorScore.toLocaleString()}</strong><span>창작 점수</span></div></div>

    <section className="creator-level-card"><header><div><small>CREATOR LEVEL</small><h2><TierIcon size={19} />{tier.label}</h2></div><strong>{copyCount.toLocaleString()}회 담김</strong></header><div className="creator-progress"><span style={{ width: `${levelProgress}%` }} /></div><p>{nextTier ? <><strong>{Math.max(0, nextTier.min - copyCount)}번</strong> 더 담기면 <b>{nextTier.label}</b> 등급이 됩니다.</> : '최고 등급입니다. Spotlog를 대표하는 여행 가이드예요.'}</p></section>

    <section className={`creator-notification-card ${notificationPreferences.enabled ? 'is-enabled' : ''}`}><header><span className="notification-feature-icon">{notificationPreferences.enabled ? <Bell size={20} /> : <BellOff size={20} />}</span><div><small>CREATOR PUSH</small><h2>조회수 목표 알림</h2><p>내 여행기가 정한 조회수를 달성하면 앱 푸시로 알려드려요.</p></div><button className="notification-switch" role="switch" aria-checked={notificationPreferences.enabled} onClick={() => onNotificationPreferencesChange({ ...notificationPreferences, enabled: !notificationPreferences.enabled })}><span /></button></header><div className="notification-permission"><span className={native && notificationPermission === 'granted' ? 'okay' : ''}>{notificationStatus}</span><em>{notificationPreferences.enabled ? native && notificationPermission === 'denied' ? '권한 필요' : '알림 켜짐' : '알림 꺼짐'}</em></div>{notificationPreferences.enabled && <div className="notification-options"><label><span>조회수 알림 기준</span><select value={notificationPreferences.viewMilestone} onChange={(event) => onNotificationPreferencesChange({ ...notificationPreferences, viewMilestone: Number(event.target.value) })} aria-label="조회수 알림 기준"><option value={100}>100회</option><option value={500}>500회</option><option value={1000}>1,000회</option><option value={5000}>5,000회</option><option value={10000}>10,000회</option></select></label><button onClick={onPreviewNotification}><Bell size={15} />테스트 푸시 받기</button></div>}<p className="notification-server-note">실제 서비스에서는 서버가 조회수를 집계하고 같은 목표에 한 번만 푸시를 발송합니다.</p></section>

    <section className="profile-reactions"><div className="profile-section-heading"><div><small>CREATOR BOOST</small><h2>받은 응원</h2></div><span>{reactionTotal + receivedComments.length}</span></div><div className="profile-reaction-chips">{cheerOptions.map(({ id, label, icon: Icon }) => <div key={id}><Icon size={16} /><span>{label}</span><strong>{reactionCounts[id].toLocaleString()}</strong></div>)}</div>{receivedComments.length ? <div className="profile-feedback-list">{receivedComments.slice(-3).reverse().map((comment) => <blockquote key={comment.id}>“{comment.body}”<span>{comment.author}</span></blockquote>)}</div> : <div className="profile-feedback-empty"><MessageCircle size={22} /><strong>공개 여행기에 응원이 쌓여요</strong><p>“너무 좋아요”, “최고예요” 같은 반응과 댓글을 이곳에서 한눈에 볼 수 있습니다.</p></div>}</section>

    <section className="profile-journeys"><div className="profile-section-heading"><div><small>MY TRAVEL STORIES</small><h2>내가 만든 여행</h2></div><span>{mine.length}</span></div>{mine.length ? <div>{mine.map((journey) => <button key={journey.id} onClick={() => onOpen(journey.id)}><img src={journey.cover} alt="" /><span><small>{journey.visibility === 'PUBLIC' ? '공개 여행기' : '비공개 초안'} · {journey.region}</small><strong>{journey.title}</strong><em><Eye size={12} />{(journey.views ?? 0).toLocaleString()} <i /> <Copy size={12} />{journey.saves.toLocaleString()}명 <i /> <MessageCircle size={12} />{comments.filter((comment) => comment.journeyId === journey.id).length}</em></span><ChevronRight size={17} /></button>)}</div> : <div className="profile-feedback-empty"><MapIcon size={22} /><strong>첫 여행기를 만들어보세요</strong><p>여행을 공개하면 담김 수와 응원으로 창작 등급이 올라갑니다.</p></div>}</section>

    <div className="settings-list"><SettingRow icon={Globe2} label="서비스 화면" value="모바일웹" /><SettingRow icon={MapIcon} label="여행 범위" value="대한민국" /><SettingRow icon={Route} label="지도·길찾기" value="연결됨" active /><SettingRow icon={UserRound} label="실행 환경" value={native ? 'Expo 앱' : '웹 브라우저'} /></div><p className="demo-note">댓글·응원·프로필 아이콘은 현재 이 기기에 저장됩니다. 실제 사용자 간 동기화는 서버 연결 시 동일한 화면 구조로 전환됩니다.</p></div>;
}

function SettingRow({ icon: Icon, label, value, active = false }: { icon: LucideIcon; label: string; value: string; active?: boolean }) {
  return <div><span className="setting-icon"><Icon size={18} /></span><strong>{label}</strong><span className={active ? 'active-value' : ''}>{value}</span><ChevronRight size={16} /></div>;
}

function AppHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return <header className="app-header"><div><small>{subtitle}</small><h1>{title}</h1></div>{action ?? <button className="header-action" aria-label="검색"><Search size={20} /></button>}</header>;
}
