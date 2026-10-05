import { naverDirectionsUrl } from './placeDirections';
import { useUiCopy } from './frontendCopy';
import { Settings } from 'lucide-react';
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
import jejuGuideCover from '../../assets/spotlog/jeju-west-guide-cover.jpg';
import jejuHyeopjaeTidepool from '../../assets/spotlog/jeju-hyeopjae-tidepool.webp';
import jejuHyeopjaeUdonDinner from '../../assets/spotlog/jeju-hyeopjae-udon-dinner.webp';
import seoulForestCover from '../../assets/spotlog/seoul-forest-evening.webp';
import { Suspense, lazy } from 'react';
import { distanceKm, roundMinutes, parseDurationMinutes, formatClock } from './routeData';
const LazyRouteMap = lazy(() => import('./RouteMap'));
function RouteMap(props: {places: Place[];selectedVisitId?:string;onSelectVisit?:(id:string)=>void}) {
  const copy=useUiCopy(); const {locale}=useLocale();return <Suspense fallback={<div className="route-map-unavailable" role="status">{locale==='en'?'Loading map…':copy("지도를 불러오는 중…")}</div>}><LazyRouteMap {...props}/></Suspense>; }
import { type ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NotificationPreferences } from '../../shared/hybridBridge';
import { createLocalRepository, PLACE_DIRECTORY_KEY } from './localRepository';
import { LandmarkGuideCard } from './LandmarkGuideCard';
import { DayNavigation } from './DayNavigation';
import { getPlacePhotos } from './PhotoPlaceCard';
import { PhotoLandmarkFeed } from './PhotoLandmarkFeed';
import { MediaRegionButton } from './MediaRegionButton';
import { BottomSheet, hasActiveSheet } from './BottomSheet';
import { normalizeVisits, removeVisit } from './visits';
import { AddToTripSheet } from './AddToTripSheet';
import { applyTripPlacement, type TripPlacementRequest } from './tripPlacement';
import { SavedTripControls } from './SavedTripControls';
import { newSavedTripDraft, pickSavedTripPlace, forgetSavedTripPlace, type SavedTripDraft } from './savedTripBuilder';
import { AiPlannerSheet, type AiPlannerDraft } from './AiPlannerSheet';
import { AiPlanRevisionSheet } from './AiPlanRevisionSheet';
import { journeyVersion } from './aiPlanner';
import TravelGuideSheet from './TravelGuideSheet';
import { TranslationText } from './TranslationText';
import { mergeActiveJourneyChanges } from './tripTrash';
import { sourceVersion } from './travelGuide';
import { LocaleProvider, useLocale } from './locale';
import { ProfilePreferencesSheet } from './ProfilePreferencesSheet';
import { AccountSheet } from './AccountSheet';
import { TripTrashSheet, MoveToTrashSheet } from './TripTrashSheet';
import './phase-three-integration.css';
import { SavedLandmarkDetailSheet } from './SavedLandmarkDetailSheet';
import { publicTourismJourneys, publicTourismPlaces } from './publicTourismContent';
import { PhotoCredit, PublicSourceNotes } from './PublicTourismCredit';
import { CardSocial, CardSocialProvider } from './CardSocial.tsx';
import { CreatorAvatar } from './CreatorAvatar.tsx';
import './journal-editing.css';
import { CARD_SOCIAL_KEY, type CardSocialStore } from './cardSocialState';
import { JournalImageEditor, JournalPhotos } from './JournalPhotos';
import { finishJournalDraft, journalDraftValue, moveJournalBlock, patchJournalDay, stashJournalDraft } from './journalDraft';
import { Button, Field } from './ui';
import { StyleGuide } from './StyleGuide';
import { PersonalTrip } from './PersonalTrip';
import { CreatePlanSheet } from './CreatePlanSheet';
import { addPlanDay, buildPersonalPlan, copyPersonalPlan, copyPlanDay, hasLocation, isPersonalPlan, makeJournalFromPlan, normalizePlan, removePlanDay, transferVisit } from './tripPlan';
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

type Tab = 'home' | 'community' | 'discover' | 'trips' | 'saved' | 'profile' | 'photo-stories' | 'style-guide';
type PlaceView = 'VIDEO' | 'GUIDE' | 'PHOTO';

type PreviewLocale = 'ko' | 'en';

interface LocalizedPreviewText {
  ko: string;
  en: string;
}

interface PhotoStorySlide {
  image?: string;
  alt: LocalizedPreviewText;
  eyebrow: LocalizedPreviewText;
  title: LocalizedPreviewText;
  body: LocalizedPreviewText;
}

interface PhotoStorySample {
  place: Place;
  englishName: string;
  englishArea: string;
  creator: string;
  readTime: LocalizedPreviewText;
  intro: LocalizedPreviewText;
  tip: LocalizedPreviewText;
  slides: PhotoStorySlide[];
}

interface SpotlogNavigationState {
  spotlog: true;
  depth: number;
  tab: Tab;
  placeView: PlaceView;
  journeyId: string | null;
  templateId: string | null;
  editorId: string | null;
  scrollTop?: number;
  detailDay?: number | null;
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
  category?: 'TRAVELER' | 'AI';
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

const photoStorySamples: PhotoStorySample[] = [
  {
    place: discoveryLandmarks.find((place) => place.id === 'jeju-hyeopjae')!,
    englishName: 'Hyeopjae Beach',
    englishArea: 'Hallim, Jeju',
    creator: 'slow.jeju',
    readTime: { ko: '사진 3장 · 40초', en: '3 photos · 40 sec' },
    intro: {
      ko: '협재를 예쁜 바다 한 장으로 끝내지 않고, 걷기 좋은 방향과 저녁까지 함께 기록했어요.',
      en: 'More than a pretty beach: where to walk, what changes at sunset, and an easy dinner nearby.',
    },
    tip: {
      ko: '현지 팁 · 일몰 40분 전에 도착하고, 젖은 현무암보다 모래 쪽으로 걷는 편이 안전해요.',
      en: 'Local tip · Arrive 40 minutes before sunset and stay on the sand when the volcanic rocks are wet.',
    },
    slides: [
      {
        image: jejuGuideCover,
        alt: { ko: '비양도가 보이는 협재해수욕장', en: 'Hyeopjae Beach overlooking Biyangdo Island' },
        eyebrow: { ko: '첫 장면', en: 'FIRST LOOK' },
        title: { ko: '바다는 사진보다 천천히 색이 바뀌었다', en: 'The sea changed color more slowly than a photo can show' },
        body: { ko: '입구에서 서쪽으로 10분만 걸어도 앉아서 파도를 볼 자리가 충분했다.', en: 'A ten-minute walk west of the entrance led to a much quieter place to sit by the water.' },
      },
      {
        image: jejuHyeopjaeTidepool,
        alt: { ko: '협재해수욕장의 현무암과 얕은 물웅덩이', en: 'Volcanic rocks and tide pools at Hyeopjae Beach' },
        eyebrow: { ko: '산책 메모', en: 'WALK NOTE' },
        title: { ko: '백사장보다 오래 남은 건 작은 물웅덩이', en: 'The tide pools stayed with me longer than the white sand' },
        body: { ko: '물이 빠진 뒤 현무암 사이로 작은 풍경이 계속 나타났다. 돌은 생각보다 미끄럽다.', en: 'Low tide revealed tiny scenes between the rocks. The surface gets more slippery than it looks.' },
      },
      {
        image: jejuHyeopjaeUdonDinner,
        alt: { ko: '협재 인근 식당의 따뜻한 우동', en: 'A bowl of warm udon near Hyeopjae Beach' },
        eyebrow: { ko: '주변 한 끼', en: 'NEARBY DINNER' },
        title: { ko: '노을 뒤에는 멀리 움직이지 않기', en: 'After sunset, keep dinner close' },
        body: { ko: '차를 다시 찾고 주차하는 대신 걸어서 갈 수 있는 식당을 골라 첫날의 여유를 지켰다.', en: 'Choosing a walkable dinner kept the first evening relaxed instead of turning it into another drive.' },
      },
    ],
  },
  {
    place: discoveryLandmarks.find((place) => place.id === 'seoul-seoulforest')!,
    englishName: 'Seoul Forest',
    englishArea: 'Seongdong, Seoul',
    creator: 'seoul.afterwork',
    readTime: { ko: '사진 1장 · 메모 1장', en: '1 photo · 1 note' },
    intro: {
      ko: '서울숲은 랜드마크 하나보다 성수 골목과 이어 걸을 때 반나절 여행이 됩니다.',
      en: 'Seoul Forest becomes a half-day trip when it is connected with a slow walk through Seongsu.',
    },
    tip: {
      ko: '현지 팁 · 자전거 길과 보행로가 갈리는 구간이 있어 해 질 무렵에는 바닥 표시를 확인하세요.',
      en: 'Local tip · Cycling and walking paths split in a few places, so watch the ground markings near sunset.',
    },
    slides: [
      {
        image: seoulForestCover,
        alt: { ko: '저녁 햇빛이 드는 서울숲 산책로', en: 'A sunlit evening path in Seoul Forest' },
        eyebrow: { ko: '퇴근 뒤 한나절', en: 'AFTER-WORK ESCAPE' },
        title: { ko: '멀리 떠나지 않아도 여행이 되는 저녁', en: 'An evening that feels like a trip without leaving Seoul' },
        body: { ko: '해가 건물 아래로 내려오는 시간에는 숲과 도시의 경계가 가장 선명하게 보였다.', en: 'As the sun dropped below the towers, the contrast between forest and city became the view.' },
      },
      {
        alt: { ko: '서울숲 방문 시간에 대한 여행자 메모', en: 'Traveler note about the best time to visit Seoul Forest' },
        eyebrow: { ko: '여행자 메모', en: 'TRAVELER NOTE' },
        title: { ko: '목적지보다 시간을 먼저 정했다', en: 'I chose the time before the destination' },
        body: { ko: '오후 다섯 시에 숲부터 걷고 저녁은 성수 골목에서 먹었다. 장소를 많이 넣지 않아도 이동 자체가 여행의 이야기가 됐다.', en: 'I walked the forest at 5 p.m. and had dinner in Seongsu. With fewer stops, the walk itself became the story.' },
      },
    ],
  },
];

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
    const value = JSON.parse(localRepository.getItem(storageKeys.profile) ?? 'null') as Partial<CreatorProfile> | null;
    return value ? { ...defaultCreatorProfile, ...value } : defaultCreatorProfile;
  } catch {
    return defaultCreatorProfile;
  }
};

const readComments = (): JourneyComment[] => {
  try {
    const stored = JSON.parse(localRepository.getItem(storageKeys.comments) ?? '[]') as JourneyComment[];
    if (!Array.isArray(stored)) return defaultComments;
    const ids = new Set(stored.map((comment) => comment.id));
    return [...defaultComments.filter((comment) => !ids.has(comment.id)), ...stored];
  } catch {
    return defaultComments;
  }
};

const readCheers = (): CheerStore => {
  try {
    const stored = JSON.parse(localRepository.getItem(storageKeys.cheers) ?? '{}') as CheerStore;
    return Object.fromEntries(Object.entries(defaultCheers).map(([journeyId, cheers]) => [journeyId, { ...cheers, ...stored[journeyId] }]).concat(Object.entries(stored).filter(([journeyId]) => !defaultCheers[journeyId])));
  } catch {
    return defaultCheers;
  }
};

const readNotificationPreferences = (): NotificationPreferences => {
  try {
    const stored = JSON.parse(localRepository.getItem(storageKeys.notifications) ?? 'null') as Partial<NotificationPreferences> | null;
    if (!stored || typeof stored.enabled !== 'boolean' || typeof stored.viewMilestone !== 'number' || stored.viewMilestone <= 0) return defaultNotificationPreferences;
    return { enabled: stored.enabled, viewMilestone: stored.viewMilestone };
  } catch {
    return defaultNotificationPreferences;
  }
};

const readSavedIds = () => {
  try {
    const value: unknown = JSON.parse(localRepository.getItem(storageKeys.saved) ?? '[]');
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

const normalizeGeneratedJourneyTitle = (journey: Journey): Journey => {
  if (/^AI가 엮은 .+ 장면 여행$/.test(journey.title)) return { ...journey, title: `${journey.region} 여행 초안` };
  if (/^AI 제주 랜드마크 \d+일 샘플$/.test(journey.title)) return { ...journey, title: '제주 여행 초안' };
  return journey;
};

const readJourneys = (): Journey[] => {
  try {
    const value: unknown = JSON.parse(localRepository.getItem(storageKeys.journeys) ?? 'null');
    if (!Array.isArray(value)) return publishedJourneySeeds.map(normalizeVisits);
    const stored = (value as Journey[]).map(normalizeGeneratedJourneyTitle).map(normalizeVisits);
    const publishedGuides = publishedJourneySeeds.filter((journey) => !journey.isMine && journey.status === 'PUBLISHED');
    const guideById = new Map(publishedGuides.map((journey) => [journey.id, journey]));
    const refreshed = stored.map((journey) => {
      if (journey.isMine || !guideById.has(journey.id)) return journey;
      const seed = structuredClone(guideById.get(journey.id)!);
      return { ...seed, saves: Math.max(seed.saves, Number(journey.saves) || 0), views: Math.max(seed.views ?? 0, Number(journey.views) || 0) };
    });
    const storedIds = new Set(refreshed.map((journey) => journey.id));
    return [...publishedGuides.filter((journey) => !storedIds.has(journey.id)), ...refreshed].map(normalizeVisits);
  } catch {
    return publishedJourneySeeds.map(normalizeVisits);
  }
};

const makePlaceShareText = (place: Place) => `${place.name}\n${place.address}\n${place.description}\n\n네이버 지도 길찾기\n${naverDirectionsUrl(place)}\n\nSpotlog 여행 기록에서 공유`;
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
    && ['home', 'community', 'discover', 'trips', 'saved', 'profile', 'photo-stories', ...(import.meta.env.DEV ? ['style-guide'] : [])].includes(String(state.tab))
    && ['VIDEO', 'GUIDE', 'PHOTO'].includes(String(state.placeView))
    && (state.detailDay == null || (Number.isInteger(state.detailDay) && state.detailDay > 0));
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
  if (screen === 'places-photo') return { ...base, tab: 'discover', placeView: 'PHOTO' };
  if (screen === 'photo-stories') return { ...base, tab: 'photo-stories' };
  if (screen === 'style-guide' && import.meta.env.DEV) return { ...base, tab: 'style-guide' };
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
    title: isSample ? '제주 여행 초안' : `${region} 여행 초안`,
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

const publishedJourneySeeds: Journey[] = [...initialJourneys, ...homeCommunityJourneys, ...publicTourismJourneys];
// Prefer the verified photo/content version for the same place without deleting legacy IDs or saves.
const aiCandidateKey = (place: Place) => `${place.area.split(/\s+/)[0]}:${place.name.replace(/\s+/g, '')}`;
const officialCandidateKeys = new Set(publicTourismPlaces.map(aiCandidateKey));
const aiPlaceCandidates = [...publicTourismPlaces, ...placeCatalog.filter((place) => !officialCandidateKeys.has(aiCandidateKey(place)))];

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

const localRepository = createLocalRepository({
  getItem: (key: string) => window.localStorage.getItem(key),
  setItem: (key: string, value: string) => window.localStorage.setItem(key, value),
} as Storage);

function useLocalState<T>(key: string, read: () => T): [T, (action: T | ((current: T) => T)) => boolean] {
  const [value, setValue] = useState(read);
  const current = useRef(value);
  const update = (action: T | ((current: T) => T)) => {
    const next = typeof action === 'function' ? (action as (current: T) => T)(current.current) : action;
    if (!localRepository.setItem(key, JSON.stringify(next))) { window.dispatchEvent(new Event('spotlog-storage-issue')); return false; }
    current.current = next;
    setValue(next);
    window.dispatchEvent(new Event('spotlog-storage-issue'));
    return true;
  };
  return [value, update];
}

export default function App() { return <LocaleProvider><SpotlogApp /></LocaleProvider>; }

function SpotlogApp() {
  const copy=useUiCopy();
  const { locale } = useLocale();
  const [tab, setTab] = useState<Tab>('home');
  const [savedIds, setSavedIds] = useLocalState<string[]>(storageKeys.saved, readSavedIds);
  const [allJourneys, persistJourneys] = useLocalState<Journey[]>(storageKeys.journeys, readJourneys);
  const journeys = useMemo(() => allJourneys.filter(journey => !journey.trash), [allJourneys]);
  const [trashOpen, setTrashOpen] = useState(false);
  const [trashTarget, setTrashTarget] = useState<string | null>(null);
  const [guideDay, setGuideDay] = useState<number | null>(null);
  const [reviseDay, setReviseDay] = useState<number | null>(null);
  const setJourneys = (action: Journey[] | ((current: Journey[]) => Journey[])) => persistJourneys((current) => (typeof action === 'function' ? action(current) : action).map(journey => normalizePlan(normalizeVisits({ ...journey, purpose: journey.purpose ?? (journey.isMine && !current.some(previous => previous.id === journey.id) ? 'PLAN' : undefined) }))));
  const [storageIssue, setStorageIssue] = useState(localRepository.getIssue());
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<HomeTripTemplate | null>(null);
  const [searchDraft, setSearchDraft] = useState<TripSearchFilters>({ destination: '', duration: 'ALL' });
  const [placeView, setPlaceView] = useState<PlaceView>('VIDEO');
  const guideScrollTop = useRef(0);
  const [editingJourneyId, setEditingJourneyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [planCreating, setPlanCreating] = useState(false);
  const [planChoices, setPlanChoices] = useState<Place[] | null>(null);
  const [placementPlaces, setPlacementPlaces] = useState<Place[] | null>(null);
  const [aiTravelOpen, setAiTravelOpen] = useState(false);
  const aiTravelDraft = useRef<AiPlannerDraft | null>(null);
  const [savedTripDraft, setSavedTripDraft] = useState<SavedTripDraft>(newSavedTripDraft);
  const [detailDay, setDetailDay] = useState<number | null>(null);
  const [toast, setToast] = useState('');
  const [profile, setProfile] = useLocalState<CreatorProfile>(storageKeys.profile, readCreatorProfile);
  const [comments, setComments] = useLocalState<JourneyComment[]>(storageKeys.comments, readComments);
  const [cardSocial,setCardSocial] = useLocalState<CardSocialStore>(CARD_SOCIAL_KEY,()=>{try{return JSON.parse(localRepository.getItem(CARD_SOCIAL_KEY)??'{}');}catch{return {};}});
  const [personalPlaces,setPersonalPlaces]=useLocalState<Place[]>(PLACE_DIRECTORY_KEY,()=>{try{return JSON.parse(localRepository.getItem(PLACE_DIRECTORY_KEY)??'[]');}catch{return [];}});
  const [cheers, setCheers] = useLocalState<CheerStore>(storageKeys.cheers, readCheers);
  const [notificationPreferences, setNotificationPreferences] = useLocalState<NotificationPreferences>(storageKeys.notifications, readNotificationPreferences);
  const [notificationPermission, setNotificationPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const viewedJourneyIds = useRef(new Set<string>());
  const native = isNativeShell();
  const savedPlaces = useMemo(() => { const byId = new Map([...placeCatalog, ...allJourneys.flatMap((journey) => journey.days.flatMap((day) => day.places)),...personalPlaces].map((place) => [place.id, place])); return [...placeCatalog.filter(place => savedIds.includes(place.id)), ...savedIds.filter(id => !placeCatalog.some(place => place.id === id)).map(id => byId.get(id)).filter((place): place is Place => Boolean(place))]; }, [savedIds, allJourneys,personalPlaces]);
  const ownJourneys = useMemo(() => journeys.filter((journey) => journey.isMine), [journeys]);
  const ownPlans = ownJourneys.filter(isPersonalPlan);
  const selectedTemplateJourney = useMemo(() => selectedTemplate ? previewTemplateJourney(selectedTemplate) : null, [selectedTemplate]);
  const editingTarget = journeys.find((journey) => journey.id === editingJourneyId) ?? null;
  const selectedJourney = selectedTemplateJourney ?? journeys.find((journey) => journey.id === selectedJourneyId) ?? (editingTarget&&isPersonalPlan(editingTarget)?editingTarget:null);
  const editingJourney = editingTarget&&!isPersonalPlan(editingTarget)?editingTarget:null;

  const applyNavigationState = useCallback((state: SpotlogNavigationState) => {
    setTab(state.tab);
    setPlaceView(state.placeView);
    setSelectedJourneyId(state.journeyId);
    setSelectedTemplate(state.templateId ? homeTripTemplates.find((template) => template.id === state.templateId) ?? null : null);
    setEditingJourneyId(state.editorId);
    setCreating(false);
    setPlanCreating(false);
    setPlacementPlaces(null);
    setAiTravelOpen(false);
    setTrashOpen(false);
    setTrashTarget(null);
    setGuideDay(null);
    setReviseDay(null);
    setDetailDay(state.detailDay ?? null);
  }, []);

  const writeNavigationState = (next: Partial<Omit<SpotlogNavigationState, 'spotlog' | 'depth'>>, mode: 'push' | 'replace' = 'push') => {
    const previous = isSpotlogNavigationState(window.history.state) ? window.history.state : null;
    if (previous?.tab === 'discover' && previous.placeView === 'GUIDE' && !previous.journeyId && !previous.templateId && !previous.editorId) {
      guideScrollTop.current = document.querySelector('.content')?.scrollTop ?? 0;
    }
    const replacingSheet = Boolean(window.history.state?.spotlogSheet);
    if (replacingSheet) mode = 'replace';
    if (previous && mode === 'push') window.history.replaceState({ ...previous, scrollTop: document.querySelector('.content')?.scrollTop ?? 0 }, '');
    const state: SpotlogNavigationState = {
      spotlog: true,
      depth: replacingSheet ? (previous?.depth ?? 0) + 1 : mode === 'replace' ? previous?.depth ?? 0 : (previous?.depth ?? 0) + 1,
      tab: next.tab ?? tab,
      placeView: next.placeView ?? placeView,
      journeyId: next.journeyId === undefined ? selectedJourneyId : next.journeyId,
      templateId: next.templateId === undefined ? selectedTemplate?.id ?? null : next.templateId,
      editorId: next.editorId === undefined ? editingJourneyId : next.editorId,
      scrollTop: next.scrollTop ?? 0,
      detailDay: next.detailDay ?? null,
    };
    setDetailDay(state.detailDay ?? null);
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
      // A sheet's internal disclosure owns its back/forward transition. Applying
      // page navigation here would discard the still-open trip/AI form.
      if (event.state?.spotlogSheet && hasActiveSheet()) return;
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
      if (hasActiveSheet()) { window.history.back(); return; }
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
  useEffect(() => { const check = () => setStorageIssue(localRepository.getIssue()); window.addEventListener('spotlog-storage-issue', check); return () => window.removeEventListener('spotlog-storage-issue', check); }, []);
  useEffect(() => {
    const frame = requestAnimationFrame(() => document.querySelector<HTMLElement>('.content')?.scrollTo({ top: window.history.state?.scrollTop ?? 0, behavior: 'instant' }));
    return () => cancelAnimationFrame(frame);
  }, [tab, selectedJourneyId, selectedTemplate, editingJourneyId, placeView]);

  const showToast = (message: string) => {
    setToast(localRepository.getIssue() ?? message);
    window.setTimeout(() => setToast(''), 2200);
  };
  const toggleSaved = (id: string) => {
    const exists = savedIds.includes(id);
    const nextIds = exists ? savedIds.filter((value) => value !== id) : [...savedIds, id];
    if (!setSavedIds(nextIds)) return false;
    // Retired collection data remains in backups; saved-place actions no longer rewrite it.
    showToast(exists ? copy("저장한 장소에서 뺐습니다. 여행에 담긴 방문은 유지됩니다.") : copy("장소를 저장했습니다."));
    return true;
  };
  const saveBusiness=(place:Place)=>{
    const ids=savedIds.includes(place.id)?savedIds:[...savedIds,place.id];
    const {visitId,anchorVisitId,bookingFixed,stayDayIds,...source}=place;
    const directory=place.personal?[...personalPlaces.filter(item=>item.id!==place.id),source]:personalPlaces;
    if(!localRepository.setItems({[storageKeys.saved]:JSON.stringify(ids),[PLACE_DIRECTORY_KEY]:JSON.stringify(directory)}))return false;
    setSavedIds(ids);setPersonalPlaces(directory);showToast(copy("장소를 저장했어요. 다른 여행에서도 고를 수 있어요."));return true;
  };
  const openMyJourney = (journeyId: string, day = 1) => {
    setTab('trips'); setSelectedJourneyId(journeyId); setSelectedTemplate(null); setEditingJourneyId(null); setCreating(false);
    writeNavigationState({ tab: 'trips', journeyId, templateId: null, editorId: null, detailDay: day }, 'push');
  };
  const confirmTripPlacement = (request: TripPlacementRequest): string | null => {
    const result = applyTripPlacement(journeys, request, profile.displayName);
    if (!result.ok) return result.error;
    if (result.addedCount && !setJourneys(current => mergeActiveJourneyChanges(current, result.journeys))) return localRepository.getIssue() ?? copy("저장하지 못했어요. 다시 시도해 주세요.");
    // Replace the sheet's history entry before unmounting so Back returns to Saved.
    openMyJourney(result.journeyId, result.targetDay);
    setPlacementPlaces(null);
    showToast(result.addedCount ? `DAY ${result.targetDay}에 담았습니다.` : `이미 담긴 DAY ${result.targetDay}로 이동했습니다.`);
    return null;
  };
  const removePlacedVisit = (journeyId: string, dayNumber: number, visitId: string): string | null => {
    const target = journeys.find((journey) => journey.id === journeyId && journey.isMine);
    if (!target || !target.days.some((day) => day.day === dayNumber && day.places.some((place) => place.visitId === visitId))) return '담긴 장소를 다시 확인해 주세요.';
    if (!setJourneys((current) => current.map((journey) => journey.id === journeyId ? removeVisit(journey, dayNumber, visitId) : journey))) return localRepository.getIssue() ?? copy("해제하지 못했어요. 다시 시도해 주세요.");
    showToast(`DAY ${dayNumber} 담김을 해제했습니다. 저장한 장소는 유지됩니다.`);
    return null;
  };
  const acceptAiDraft = (draft: Journey): string | null => {
    const created = { ...draft, purpose: 'PLAN' as const, author: profile.displayName, recommendationKind: 'AI' as const, isMine: true, visibility: 'PRIVATE' as const };
    if (!setJourneys((current) => current.some(journey => journey.id === created.id) ? current : [created, ...current])) return null;
    openMyJourney(created.id);
    setAiTravelOpen(false);
    showToast(copy("내 여행에 초안을 저장했습니다. 일정을 확인하고 수정해 주세요."));
    return created.id;
  };
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
    const target=journeys.find(item=>item.id===id);
    if(target&&isPersonalPlan(target)){openMyJourney(id);return;}
    setSelectedJourneyId(null);
    setSelectedTemplate(null);
    setEditingJourneyId(id);
    writeNavigationState({ journeyId: null, templateId: null, editorId: id });
  };
  const changePlaceView = (next: PlaceView) => {
    if (next === placeView) return;
    setPlaceView(next);
    writeNavigationState({ tab: 'discover', placeView: next, journeyId: null, templateId: null, editorId: null, scrollTop: next === 'GUIDE' ? guideScrollTop.current : 0 });
  };
  const sharePlace = async (place: Place) => {
    try {
      const mode = await shareContent({ title: place.name, message: makePlaceShareText(place) });
      if (mode === 'clipboard') showToast(copy("장소 정보와 길찾기 링크를 복사했습니다."));
    } catch {
      showToast(copy("공유를 취소했습니다."));
    }
  };
  const shareJourney = async (journey: Journey) => {
    const routeText = journey.days.map((day) => `${day.date} · ${day.places.map((place) => place.name).join(' → ')}`).join('\n');
    try {
      const mode = await shareContent({ title: journey.title, message: `${journey.title}\n${journey.summary}\n\n${routeText}\n\nSpotlog ${isPersonalPlan(journey)?copy("여행 동선"):copy("여행기")}` });
      if (mode === 'clipboard') showToast(copy("여행일기 내용을 복사했습니다."));
    } catch {
      showToast(copy("공유를 취소했습니다."));
    }
  };
  const createJourney = (title: string, region: string) => {
    const journey: Journey = {...buildPersonalPlan([],1,title,profile.displayName),region};
    if (!setJourneys((current) => [journey, ...current])) return;
    openMyJourney(journey.id);
    showToast(copy("새 여행을 만들었습니다."));
  };

  const createSavedTrip = (draft: Journey): string | null => {
    const created = normalizePlan(normalizeVisits({ ...draft, purpose: 'PLAN', author: profile.displayName, isMine: true, visibility: 'PRIVATE' }));
    if (!setJourneys(current => current.some(item => item.id === created.id) ? current : [created, ...current])) return null;
    setSavedTripDraft(newSavedTripDraft());
    openMyJourney(created.id);
    showToast(copy("내 여행에 저장했어요. 주변 업체를 더 담아보세요."));
    return created.id;
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
    if (!setJourneys((current) => [draft, ...current])) return;
    openMyJourney(draft.id);
    showToast(copy("추천 일정을 내 여행으로 가져왔습니다."));
  };

  const saveJourney = (updated: Journey) => {
    if (!setJourneys((current) => current.map((journey) => journey.id === updated.id ? updated : journey))) return false;
    setEditingJourneyId(null);
    setSelectedJourneyId(updated.id);
    setSelectedTemplate(null);
    writeNavigationState({ tab: 'trips', journeyId: updated.id, templateId: null, editorId: null }, 'replace');
    showToast(copy("여행기 초안을 저장했습니다."));
    return true;
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
    showToast(copy("작성자에게 따뜻한 댓글을 전했습니다."));
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
    const copied = copyPersonalPlan(normalizePlan(normalizeVisits(source)), profile.displayName);
    if (!setJourneys((current) => [copied, ...current])) return;
    openMyJourney(copied.id);
    showToast(copy("내 여행으로 복사했습니다."));
  };

  const createJournal = (source: Journey) => {
    const draft = makeJournalFromPlan(normalizePlan(source), profile.displayName);
    if (!setJourneys(current => [draft, ...current])) return;
    editJourney(draft.id);
    showToast(copy("별도의 여행기 초안을 만들었어요. 개인 메모는 옮기지 않았어요."));
  };

  const selectTab = (next: Tab) => {
    if (next === tab && !selectedJourney && !editingJourney) return;
    setSelectedJourneyId(null);
    setSelectedTemplate(null);
    setEditingJourneyId(null);
    setTab(next);
    writeNavigationState({ tab: next, journeyId: null, templateId: null, editorId: null, scrollTop: next === 'discover' && placeView === 'GUIDE' ? guideScrollTop.current : 0 });
  };

  return (
    <CardSocialProvider store={cardSocial} save={setCardSocial} user={{id:'local-self',name:profile.displayName,avatar:profile.avatar}}><main className={`app-shell tab-${tab} place-${placeView.toLowerCase()} ${selectedJourney || editingJourney || tab === 'profile' || tab === 'photo-stories' ? 'detail-open' : ''}`}>
      <section className="content">
        {storageIssue && <div className="local-storage-warning" role="alert">{storageIssue}</div>}
        <div className={placeView !== 'GUIDE' ? 'discovery-pane' : ''} hidden={tab !== 'discover' || Boolean(selectedJourney || editingJourney)}><Discover view={placeView} onViewChange={changePlaceView} savedIds={savedIds} onToggle={toggleSaved} onShare={sharePlace} /></div>
        {editingJourney ? (
          <JourneyEditor key={editingJourney.id} journey={editingJourney} onBack={goBack} onSave={saveJourney} onDraft={(draft,view)=>setJourneys(current=>current.map(item=>item.id===draft.id?stashJournalDraft(item,draft,view):item))} />
        ) : selectedJourney && isPersonalPlan(selectedJourney) ? (
          <PersonalTrip key={selectedJourney.id} journey={selectedJourney} initialDay={detailDay ?? 1} onGuide={setGuideDay} onRefine={setReviseDay} onTrash={() => setTrashTarget(selectedJourney.id)} onSaveBusiness={saveBusiness} catalog={[...ownJourneys.flatMap(journey=>journey.days.flatMap(day=>day.places)).filter(place=>place.personal),...placeCatalog]} savedPlaces={savedPlaces} onBack={goBack} onChange={next => setJourneys(current => current.map(item => item.id === next.id ? next : item))} onAddLandmark={() => selectTab('discover')} onCopy={()=>copyJourney(selectedJourney)} onJournal={()=>createJournal(selectedJourney)} renderMap={(places,selected,onSelect)=><RouteMap places={places} selectedVisitId={selected} onSelectVisit={onSelect}/>} />
        ) : selectedJourney ? (
          <JourneyDetail key={`${selectedJourney.id}:${detailDay ?? 1}`} initialDay={detailDay ?? 1} journey={selectedJourney} profile={profile} comments={comments.filter((comment) => comment.journeyId === selectedJourney.id)} cheers={cheers[selectedJourney.id] ?? { LOVE: 0, BEST: 0, HELPFUL: 0 }} authorJourneys={selectedJourney.isMine ? journeys.filter((journey) => journey.isMine) : journeys.filter((journey) => !journey.isMine && journey.author === selectedJourney.author)} onBack={goBack} onShare={() => void shareJourney(selectedJourney)} onSharePlace={(place) => void sharePlace(place)} onEdit={() => editJourney(selectedJourney.id)} onCopy={() => selectedTemplate ? startRecommendedJourney(selectedTemplate) : copyJourney(selectedJourney)} onComment={(body) => addJourneyComment(selectedJourney.id, body)} onCheer={(cheer) => toggleJourneyCheer(selectedJourney.id, cheer)} onOpenJourney={openJourney} copyLabel={selectedTemplateJourney ? copy("이 일정 내 여행에 담기") : undefined} />
        ) : (
          <>
            {tab === 'home' && <Home journeys={journeys} templates={homeTripTemplates} onOpen={openJourney} onPreview={openTemplate} onGoCommunity={() => selectTab('community')} onGoPlaces={() => selectTab('discover')} onGoTrips={() => selectTab('trips')} onGoProfile={() => selectTab('profile')} onAiTravel={() => setAiTravelOpen(true)} />}
            {tab === 'community' && <Community journeys={journeys} filters={searchDraft} onFiltersChange={setSearchDraft} onOpen={openJourney} />}
            {tab === 'trips' && <Trips onTrash={() => setTrashOpen(true)} onDelete={setTrashTarget} journeys={journeys} onOpen={openJourney} onCreate={() => { setPlanChoices(null); setPlanCreating(true); }} onShare={(journey) => void shareJourney(journey)} />}
            {tab === 'saved' && <Saved places={savedPlaces} journeys={ownPlans} draft={savedTripDraft} onDraftChange={setSavedTripDraft} onCreate={createSavedTrip} onRemove={toggleSaved} onAdd={(place) => setPlacementPlaces([place])} onGoDiscover={() => selectTab('discover')} />}
            {import.meta.env.DEV && tab === 'style-guide' && <StyleGuide onBack={goBack} />}
            {tab === 'profile' && <Profile native={native} journeys={journeys} comments={comments} cheers={cheers} profile={profile} notificationPreferences={notificationPreferences} notificationPermission={notificationPermission} onBack={goBack} onProfileChange={setProfile} onNotificationPreferencesChange={changeNotificationPreferences} onPreviewNotification={() => showToast(previewCreatorNotification(notificationPreferences.viewMilestone) ? copy("테스트 푸시를 보냈습니다.") : copy("테스트 푸시는 Spotlog 앱에서 확인할 수 있습니다."))} onOpen={openJourney} />}
            {tab === 'photo-stories' && <PhotoStoryPreview savedIds={savedIds} onBack={goBack} onToggle={toggleSaved} onShare={(place) => void sharePlace(place)} />}
          </>
        )}
      </section>

      {!selectedJourney && !editingJourney && tab !== 'profile' && tab !== 'photo-stories' && tab !== 'style-guide' && <nav className="tabbar" aria-label={copy("주요 메뉴")}>
        {tabItems.map((item) => {
          const Icon = item.icon;
          return <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => selectTab(item.id)}><Icon size={21} strokeWidth={tab === item.id ? 2.3 : 1.8} /><span>{locale === 'en' ? ({home:'Home',community:'Journals',discover:'Places',trips:'My trips',saved:'Saved'} as Record<string,string>)[item.id] : item.label}</span></button>;
        })}
      </nav>}
      {creating && <CreateJourneySheet onClose={() => setCreating(false)} onCreate={createJourney} />}
      {planCreating && <CreatePlanSheet places={(planChoices ?? savedPlaces).filter(place => place.kind === 'LANDMARK')} author={profile.displayName} onClose={() => setPlanCreating(false)} onCreate={journey => { if (!setJourneys(current => [journey, ...current])) return false; setPlanCreating(false); openMyJourney(journey.id); return true; }} />}
      {placementPlaces && <AddToTripSheet places={placementPlaces} journeys={ownPlans} initialJourneyId={ownPlans.find((journey) => journey.days.some((day) => day.places.some((place) => placementPlaces.some((selected) => selected.id === place.id))))?.id} initialDay={ownPlans.flatMap((journey) => journey.days).find((day) => day.places.some((place) => placementPlaces.some((selected) => selected.id === place.id)))?.day} onClose={() => setPlacementPlaces(null)} onConfirm={confirmTripPlacement} onRemove={removePlacedVisit} />}
      {aiTravelOpen && <AiPlannerSheet draftRef={aiTravelDraft} existingJourneyIds={allJourneys.map(journey=>journey.id)} places={aiPlaceCandidates} savedPlaces={savedPlaces} author={profile.displayName} onDraftNotice={showToast} onClose={() => setAiTravelOpen(false)} onCreate={acceptAiDraft} />}
      {trashOpen && <TripTrashSheet language={locale} journeys={allJourneys} ownerId="local-profile" onChange={setJourneys} onClose={() => setTrashOpen(false)} onOpen={journey => { setTrashOpen(false); openMyJourney(journey.id); }} />}
      {trashTarget && <MoveToTrashSheet journeys={allJourneys} journeyId={trashTarget} ownerId="local-profile" language={locale} onChange={setJourneys} onMoved={() => { setTrashTarget(null); if (selectedJourneyId === trashTarget) selectTab('trips'); showToast(locale === 'en' ? 'Moved to Trash. You can restore it for six months.' : copy("휴지통으로 이동했어요. 6개월 동안 복원할 수 있어요.")); }} onClose={() => setTrashTarget(null)} />}
      {selectedJourney && guideDay !== null && <TravelGuideSheet journey={selectedJourney} initialDay={guideDay} onClose={() => setGuideDay(null)} />}
      {selectedJourney && reviseDay !== null && <AiPlanRevisionSheet journey={selectedJourney} initialDay={reviseDay} onClose={() => setReviseDay(null)} onApply={(next, sourceVersion) => { const current = journeys.find(item => item.id === next.id); if (!current || journeyVersion(current) !== sourceVersion) return false; return setJourneys(items => items.map(item => item.id === next.id ? next : item)); }} />}
      {toast && <div className="toast" role="status"><Check size={15} />{toast}</div>}
    </main></CardSocialProvider>
  );
}

function Home({ journeys, templates, onOpen, onPreview, onGoCommunity, onGoPlaces, onGoTrips, onGoProfile, onAiTravel }: { journeys: Journey[]; templates: HomeTripTemplate[]; onOpen: (id: string) => void; onPreview: (template: HomeTripTemplate) => void; onGoCommunity: () => void; onGoPlaces: () => void; onGoTrips: () => void; onGoProfile: () => void; onAiTravel: () => void }) {
  const copy=useUiCopy();
  const { locale } = useLocale();
  const en = locale === 'en';
  const publicGuides = journeys.filter((journey) => !journey.isMine && journey.visibility === 'PUBLIC' && journey.status === 'PUBLISHED' && journey.recommendationKind !== 'AI');
  const authorCopyCount = (author: string) => publicGuides.filter((journey) => journey.author === author).reduce((sum, journey) => sum + journey.saves, 0);
  const recommendationRolling = useRollingCarousel(templates.length, 4600);
  const guideRolling = useRollingCarousel(publicGuides.length, 5200);

  return <div className="home-page">
    <header className="home-topbar"><div><strong>spotlog</strong><span>{en ? 'Start your trip with travel inspiration' : copy("다른 사람의 여행에서 내 여행을 시작하세요")}</span></div><button onClick={onGoProfile} aria-label={en ? "Profile" : copy("프로필")}><CircleUserRound size={24} /></button></header>
    <section className="home-lead"><span>TRAVEL STORIES · READY TO EDIT</span><h1>{en ? <>Find your next place,<br />create your own trip.</> : <>{copy("가고 싶은 곳을 찾거나,")}<br />{copy("마음에 드는 여행을 고르세요.")}</>}</h1><p>{en ? 'Read journals, copy ideas into your itinerary and arrange the places your way.' : copy("공개 여행기를 그대로 읽고, 내 일정으로 복사해 장소와 동선을 자유롭게 바꿀 수 있습니다.")}</p></section>
    <button className="home-find-guides" onClick={onAiTravel}><span><Sparkles size={20} /></span><div><small>{en ? 'Tell us about your trip' : copy("가고 싶은 여행을 이야기해 주세요")}</small><strong>{en ? 'Create an AI trip' : copy("AI 여행 만들기")}</strong><p>{en ? 'Choose a region, duration and preferences for your draft.' : copy("지역·기간·취향을 적고 여행 초안을 받아보세요.")}</p></div><ChevronRight size={19} /></button>
    <section className="home-section"><div className="home-section-heading"><div><small>SPOTLOG CURATION</small><h2>{en ? 'Featured itineraries' : copy("이번 주 추천 일정")}</h2><p>{en ? 'Explore selected itineraries and make them your own.' : copy("에디터가 고른 일정을 읽어보고 내 여행에 담으세요")}</p></div><RollingControls label={copy("추천 일정")} count={templates.length} activeIndex={recommendationRolling.activeIndex} onChange={recommendationRolling.goTo} /></div><div className="promoted-track" ref={recommendationRolling.trackRef} onScroll={recommendationRolling.syncIndex}>{templates.map((template) => <article className="promoted-trip" key={template.id}><img src={template.cover} alt="" /><div className="promoted-shade" /><div className="promoted-copy"><span>{template.region} · {template.duration}</span><h2>{template.title}</h2><p>{template.summary}</p><div><button onClick={() => onPreview(template)}>{en ? 'View itinerary' : copy("일정 자세히 보기")}</button><small>{template.places.length}{copy("개 장소 · 먼저 보고 담기")}</small></div></div></article>)}</div><RollingDots label={copy("추천 일정")} count={templates.length} activeIndex={recommendationRolling.activeIndex} onChange={recommendationRolling.goTo} /></section>

    {publicGuides.length > 0 && <section className="home-section"><div className="home-section-heading"><div><small>TRAVELER'S GUIDE</small><h2>{en ? 'Travelers’ journals' : copy("여행자들이 만든 일정")}</h2><p>{en ? 'Read travel stories and save ideas for your trip.' : copy("실제 여행 기록을 읽고 내 일정으로 가져오세요")}</p></div><RollingControls label={copy("여행자 일정")} count={publicGuides.length} activeIndex={guideRolling.activeIndex} onChange={guideRolling.goTo} /></div><div className="home-guide-list" ref={guideRolling.trackRef} onScroll={guideRolling.syncIndex}>{publicGuides.map((journey) => <article className="home-guide-card" key={journey.id}><button className="home-guide-cover" onClick={() => onOpen(journey.id)}><img src={journey.cover} alt="" /><span>{journey.region}<br />{journey.duration}</span></button><div className="home-guide-copy"><div className="home-guide-author"><CreatorBadge copyCount={authorCopyCount(journey.author)} compact /><small>{journey.author} · {journeyPlaceCount(journey)}{copy("곳")}</small></div><h3>{journey.title}</h3><p>{journey.summary}</p><div className="home-guide-actions"><button onClick={() => onOpen(journey.id)}>{en ? 'Read journal' : copy("여행기 먼저 보기")}</button></div></div></article>)}</div><RollingDots label={copy("여행자 일정")} count={publicGuides.length} activeIndex={guideRolling.activeIndex} onChange={guideRolling.goTo} /></section>}

    <button className="home-find-guides" onClick={onGoCommunity}><span><Search size={20} /></span><div><small>{en ? 'Search by region and duration' : copy("지역 · 여행 기간으로 검색")}</small><strong>{en ? 'Find travel journals' : copy("다른 여행자의 여행기 찾기")}</strong><p>{en ? 'Find day trips and longer stays.' : copy("당일치기부터 3박 이상까지 골라보세요.")}</p></div><ChevronRight size={19} /></button>

    <section className="home-shortcuts"><button onClick={onGoPlaces}><Compass size={20} /><span><strong>{en ? 'Discover landmarks' : copy("랜드마크 찾기")}</strong><small>{en ? 'Save places from photos, videos and guides' : copy("영상이나 안내 목록에서 장소 담기")}</small></span><ChevronRight size={17} /></button><button onClick={onGoTrips}><MapIcon size={20} /><span><strong>{en ? 'My trips' : copy("내 여행")}</strong><small>{en ? 'Manage your itineraries' : copy("복사하고 만든 일정 관리")}</small></span><ChevronRight size={17} /></button></section>
  </div>;
}

const previewCopy = (value: LocalizedPreviewText, locale: PreviewLocale) => value[locale];

function PhotoStoryPreview({ savedIds, onBack, onToggle, onShare }: { savedIds: string[]; onBack: () => void; onToggle: (id: string) => void; onShare: (place: Place) => void }) {
  const copy=useUiCopy();
  const [locale, setLocale] = useState<PreviewLocale>('ko');
  const english = locale === 'en';

  return <div className="photo-story-preview">
    <header className="photo-story-topbar">
      <button type="button" onClick={onBack} aria-label={english ? 'Back' : copy("뒤로 가기")}><ArrowLeft size={21} /></button>
      <div><strong>{english ? 'Photo stories' : copy("사진 여행")}</strong><span>{english ? 'Swipe up for places · sideways for photos' : copy("위아래 장소 · 좌우 사진")}</span></div>
      <button type="button" className="photo-story-locale" onClick={() => setLocale(english ? 'ko' : 'en')} aria-label={english ? copy("한국어로 보기") : 'View in English'}>{english ? 'KO' : 'EN'}</button>
    </header>
    <div className="photo-story-feed">
      {photoStorySamples.map((story, index) => <PhotoStoryCard key={story.place.id} story={story} locale={locale} index={index} total={photoStorySamples.length} saved={savedIds.includes(story.place.id)} onToggle={() => onToggle(story.place.id)} onShare={() => onShare(story.place)} />)}
    </div>
  </div>;
}

function PhotoStoryCard({ story, locale, index, total, saved, onToggle, onShare }: { story: PhotoStorySample; locale: PreviewLocale; index: number; total: number; saved: boolean; onToggle: () => void; onShare: () => void }) {
  const copy=useUiCopy();
  const [activeSlide, setActiveSlide] = useState(0);
  const [liked, setLiked] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const english = locale === 'en';
  const placeName = english ? story.englishName : story.place.name;
  const placeArea = english ? story.englishArea : story.place.area;

  const goToSlide = (slideIndex: number) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: track.clientWidth * slideIndex, behavior: 'smooth' });
    setActiveSlide(slideIndex);
  };

  return <article className="photo-story-card">
    <div className="photo-story-author">
      <span>{story.creator.slice(0, 1).toUpperCase()}</span>
      <div><strong>{story.creator}</strong><small>{placeArea} · {previewCopy(story.readTime, locale)}</small></div>
      <em>{String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</em>
    </div>

    <div className="photo-story-media">
      <div ref={trackRef} className="photo-story-track" onScroll={(event) => setActiveSlide(Math.min(story.slides.length - 1, Math.round(event.currentTarget.scrollLeft / Math.max(1, event.currentTarget.clientWidth))))}>
        {story.slides.map((slide, slideIndex) => <figure className={slide.image ? '' : 'is-note'} key={`${story.place.id}-${slideIndex}`}>
          {slide.image && <img src={slide.image} alt={previewCopy(slide.alt, locale)} />}
          <figcaption>
            <small>{previewCopy(slide.eyebrow, locale)}</small>
            <strong>{previewCopy(slide.title, locale)}</strong>
            <p>{previewCopy(slide.body, locale)}</p>
          </figcaption>
        </figure>)}
      </div>
      {story.slides.length > 1 && <div className="photo-story-count">{activeSlide + 1}/{story.slides.length}</div>}
    </div>

    <div className="photo-story-body">
      <div className="photo-story-actions">
        <button type="button" className={liked ? 'active' : ''} onClick={() => setLiked((value) => !value)} aria-label={english ? 'Like' : copy("좋아요")}><Heart size={23} fill={liked ? 'currentColor' : 'none'} /></button>
        <button type="button" onClick={onShare} aria-label={english ? 'Share' : copy("공유")}><Share2 size={22} /></button>
        <div className="photo-story-dots" aria-label={english ? 'Select photo' : copy("사진 선택")}>{story.slides.map((_, slideIndex) => <button type="button" key={slideIndex} className={activeSlide === slideIndex ? 'active' : ''} onClick={() => goToSlide(slideIndex)} aria-label={`${slideIndex + 1}`} />)}</div>
        <button type="button" className={saved ? 'active' : ''} onClick={onToggle} aria-label={saved ? (english ? 'Remove saved place' : copy("저장 해제")) : (english ? 'Quick save' : copy("빠른 저장"))}><Bookmark size={23} fill={saved ? 'currentColor' : 'none'} /></button>
      </div>
      <h1>{placeName}<small>{english ? story.place.name : story.englishName}</small></h1>
      <p>{previewCopy(story.intro, locale)}</p>
      <div className="photo-story-tip"><Sparkles size={16} /><span>{previewCopy(story.tip, locale)}</span></div>
      <button type="button" className={`photo-story-save ${saved ? 'saved' : ''}`} onClick={onToggle}>
        <span><Bookmark size={18} fill={saved ? 'currentColor' : 'none'} /><strong>{saved ? (english ? 'Saved for later' : copy("빠른 저장함에 담김")) : (english ? 'Quick save this place' : copy("이 장소 빠르게 저장"))}</strong></span>
        <small>{english ? 'Region is sorted now. Choose a trip later.' : copy("지역은 자동 분류 · 여행은 나중에 선택")}</small>
      </button>
    </div>
  </article>;
}

function Community({ journeys, filters, onFiltersChange, onOpen }: { journeys: Journey[]; filters: TripSearchFilters; onFiltersChange: (filters: TripSearchFilters) => void; onOpen: (id: string) => void }) {
  const copy=useUiCopy();
  const regions = ['전체', ...new Set(journeys.filter((journey) => journey.visibility === 'PUBLIC' && journey.status === 'PUBLISHED').map((journey) => journey.region))];
  const aiCategory = filters.category === 'AI';
  const publicGuides = journeys.filter((journey) => !journey.isMine && journey.visibility === 'PUBLIC' && journey.status === 'PUBLISHED');
  const filteredGuides = publicGuides
    .filter((journey) => aiCategory ? journey.recommendationKind === 'AI' : journey.recommendationKind !== 'AI')
    .filter((journey) => matchesDestination(filters.destination, [journey.region, journey.title, journey.summary, journey.author, ...journey.tags]) && matchesTripDuration(journey.duration, filters.duration))
    .sort((left, right) => right.saves - left.saves);
  const authorCopyCount = (author: string) => publicGuides.filter((journey) => journey.author === author).reduce((sum, journey) => sum + journey.saves, 0);

  return <div className="page community-page">
    <AppHeader title={copy("여행기")} subtitle="여행자 기록과 AI 추천 여행" action={<span className="community-header-icon"><Globe2 size={20} /></span>} />
    <div className="duration-chips" role="group" aria-label={copy("여행기 종류")}><button className={!aiCategory ? 'active' : ''} aria-pressed={!aiCategory} onClick={() => onFiltersChange({ ...filters, category: 'TRAVELER' })}>{copy("여행자 여행기")}</button><button className={aiCategory ? 'active' : ''} aria-pressed={aiCategory} onClick={() => onFiltersChange({ ...filters, category: 'AI' })}>{copy("AI 추천 여행")}</button></div>
    <section className="community-intro"><small>{aiCategory ? 'AI TRAVEL PICKS' : "TRAVELER'S STORIES"}</small><h2>{copy("먼저 읽어보고,")}<br />{copy("마음에 들면 내 여행에 담으세요.")}</h2><p>{aiCategory ? copy("공식 관광 자료와 이용 가능한 사진으로 구성한 추천 샘플입니다. 실제 방문 후기나 외부 AI의 실시간 생성 결과가 아닙니다.") : copy("지역과 여행 기간별 샘플 여행기를 살펴볼 수 있습니다. 조회·담김 수와 반응은 시연용이며 실제 사용자 집계가 아닙니다.")}</p></section>
    <section className="community-search" aria-labelledby="community-search-title">
      <div className="community-search-title"><div><small>FIND A STORY</small><strong id="community-search-title">{copy("여행기 검색")}</strong></div><span>{filteredGuides.length}{copy("개")}</span></div>
      <label className="destination-search"><Search size={19} /><input value={filters.destination} onChange={(event) => onFiltersChange({ ...filters, destination: event.target.value })} placeholder={copy("지역, 제목, 작성자를 검색하세요")} aria-label={copy("여행기 지역 검색")} />{filters.destination && <button type="button" onClick={() => onFiltersChange({ ...filters, destination: '' })} aria-label={copy("검색 지우기")}>{copy("지우기")}</button>}</label>
      <div className="destination-chips" aria-label={copy("여행기 지역 선택")}>{regions.map((region) => <button type="button" key={region} className={(region === '전체' && !filters.destination) || filters.destination === region ? 'active' : ''} onClick={() => onFiltersChange({ ...filters, destination: region === '전체' ? '' : region })}>{region}</button>)}</div>
      <div className="destination-duration"><strong>{copy("여행 기간")}</strong><span>{tripDurationLabel(filters.duration)}</span></div>
      <div className="duration-chips" aria-label={copy("여행기 기간 선택")}>{tripDurationOptions.map((option) => <button type="button" key={option.id} className={filters.duration === option.id ? 'active' : ''} onClick={() => onFiltersChange({ ...filters, duration: option.id })}>{copy(option.label)}</button>)}</div>
    </section>

    <section className="community-results"><div className="community-results-heading"><div><small>PUBLIC TRAVEL LOG</small><h2>{aiCategory ? copy("AI 추천 여행") : filters.destination || tripDurationLabel(filters.duration) !== '전체 기간' ? copy("검색한 여행기") : copy("지금 많이 담는 여행기")}</h2></div><span>{aiCategory ? copy("공식 자료 기반") : copy("담김 많은 순")}</span></div>
      {filteredGuides.length ? <div className="community-list">{filteredGuides.map((journey) => <article className="community-card" key={journey.id}><button className="community-cover" onClick={() => onOpen(journey.id)}><img src={journey.cover} alt="" /><span>{journey.region} · {journey.duration}</span></button><div className="community-copy"><PhotoCredit image={journey.cover} /><div className="community-author">{journey.recommendationKind === 'AI' ? <span className="creator-tier-badge compact"><Sparkles size={11} />{copy("AI 추천")}</span> : <CreatorBadge copyCount={authorCopyCount(journey.author)} compact />}<strong>{journey.author}</strong></div><h3>{journey.title}</h3><p>{journey.summary}</p><div className="community-meta"><span><MapPin size={12} />{journeyPlaceCount(journey)}{copy("곳")}</span>{journey.recommendationKind === 'AI' ? <span>{copy("공식 자료 기반 샘플")}</span> : <><span><Eye size={12} />{(journey.views ?? 0).toLocaleString()}</span><span><Copy size={12} />{journey.saves.toLocaleString()}{copy("명")}</span></>}</div><button onClick={() => onOpen(journey.id)}>{copy("여행기 먼저 보기")}<ChevronRight size={16} /></button></div></article>)}</div> : <div className="community-empty"><Search size={27} /><h2>{copy("조건에 맞는 여행기가 없어요")}</h2><p>{copy("지역을 전체로 넓히거나 여행 기간을 바꿔보세요.")}</p><button onClick={() => onFiltersChange({ destination: '', duration: 'ALL', category: filters.category })}>{copy("전체 여행기 보기")}</button></div>}
    </section>
  </div>;
}

function RollingControls({ label, count, activeIndex, onChange }: { label: string; count: number; activeIndex: number; onChange: (index: number) => void }) {
  const {locale}=useLocale();
  return <div className="rolling-controls"><span>{activeIndex + 1} / {count}</span>{count > 1 && <><button onClick={() => onChange(activeIndex - 1)} aria-label={`${label} ${locale==='en'?'previous':'이전'}`}><ChevronLeft size={17} /></button><button onClick={() => onChange(activeIndex + 1)} aria-label={`${label} ${locale==='en'?'next':'다음'}`}><ChevronRight size={17} /></button></>}</div>;
}

function RollingDots({ label, count, activeIndex, onChange }: { label: string; count: number; activeIndex: number; onChange: (index: number) => void }) {
  const {locale}=useLocale();
  if (count < 2) return null;
  return <div className="rolling-dots" aria-label={`${label} ${locale==='en'?'pages':'페이지'}`}>{Array.from({ length: count }, (_, index) => <button key={index} className={index === activeIndex ? 'active' : ''} onClick={() => onChange(index)} aria-label={`${label} ${index + 1}${locale==='en'?'':'번'}`} aria-current={index === activeIndex ? 'true' : undefined} />)}</div>;
}

const landmarkRegion = (place: Place) => place.area.split(' ')[0] || '기타';
const domesticRegionOrder = ['서울', '경기', '인천', '강원', '충북', '충남', '대전', '세종', '전북', '전남', '광주', '경북', '경남', '대구', '울산', '부산', '제주'];
const PLACE_LIST_PAGE_SIZE = 3;

function Discover({ view, onViewChange, savedIds, onToggle, onShare }: { view: PlaceView; onViewChange: (view: PlaceView) => void; savedIds: string[]; onToggle: (id: string) => void; onShare: (place: Place) => void }) {
  const copy=useUiCopy();
  const [query, setQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [regionOpen, setRegionOpen] = useState(false);
  const regionTriggerRef = useRef<HTMLButtonElement | null>(null);
  const openRegion = (trigger: HTMLButtonElement) => { regionTriggerRef.current = trigger; setRegionOpen(true); };
  const regionWasOpen = useRef(false);
  useEffect(() => {
    const restore = regionWasOpen.current && !regionOpen && view !== 'GUIDE';
    regionWasOpen.current = regionOpen;
    if (!restore) return;
    const frame = requestAnimationFrame(() => {
      const previous = regionTriggerRef.current;
      const target = previous?.isConnected ? previous : document.querySelector<HTMLButtonElement>(view === 'PHOTO'
        ? '.photo-landmark-reel[data-active="true"] .media-region-trigger,.photo-reel-empty .photo-region-button'
        : '.feed-card[data-active="true"] .media-region-trigger,.video-reel-empty .photo-region-button')
        ?? document.querySelector<HTMLButtonElement>('.feed-card .media-region-trigger');
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [regionOpen, view]);
  // All regions stay available in a compact horizontal strip.
  const [visiblePlaceCount, setVisiblePlaceCount] = useState(PLACE_LIST_PAGE_SIZE);
  const placeLoadSentinelRef = useRef<HTMLDivElement>(null);
  const guideLandmarks = useMemo(() => placeCatalog
    .filter((place) => place.kind === 'LANDMARK')
    .sort((a, b) => domesticRegionOrder.indexOf(landmarkRegion(a)) - domesticRegionOrder.indexOf(landmarkRegion(b))), []);
  const regionGroups = domesticRegionOrder
    .map((region) => ({ region, places: guideLandmarks.filter((place) => landmarkRegion(place) === region) }))
    .filter((group) => group.places.length > 0);
  const photoPlaces = useMemo(() => guideLandmarks.filter((place) => getPlacePhotos(place).length > 0)
    .sort((left, right) => getPlacePhotos(right).length - getPlacePhotos(left).length), [guideLandmarks]);
  const mediaPlaces = view === 'VIDEO' ? discoveryLandmarks : photoPlaces;
  const mediaRegions = domesticRegionOrder.map((region) => ({ region, count: mediaPlaces.filter((place) => landmarkRegion(place) === region).length }))
    .filter((group) => group.count > 0 || group.region === selectedRegion);
  const videoPlaces = discoveryLandmarks.filter((place) => !selectedRegion || landmarkRegion(place) === selectedRegion);
  const visiblePlaces = guideLandmarks.filter((place) => {
    const matchesRegion = !selectedRegion || landmarkRegion(place) === selectedRegion;
    return matchesRegion && matchesDestination(query, [place.area, place.name, place.hook, place.description, place.note, ...(place.tags ?? [])]);
  });
  const resultTitle = query.trim()
    ? `'${query.trim()}' 검색 결과`
    : selectedRegion ? `${selectedRegion} 랜드마크` : copy("국내 랜드마크");
  const hasActiveResults = true;
  const displayedPlaces = visiblePlaces.slice(0, visiblePlaceCount);
  const hasMorePlaces = displayedPlaces.length < visiblePlaces.length;
  const displayedRegionGroups = regionGroups;
  const chooseRegion = (region: string) => {
    setSelectedRegion(region);
  };
  useEffect(() => setVisiblePlaceCount(PLACE_LIST_PAGE_SIZE), [query, selectedRegion]);
  useEffect(() => {
    const sentinel = placeLoadSentinelRef.current;
    if (!sentinel || !hasActiveResults || !hasMorePlaces) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setVisiblePlaceCount((current) => Math.min(current + PLACE_LIST_PAGE_SIZE, visiblePlaces.length));
    }, { root: document.querySelector<HTMLElement>('.content'), rootMargin: '0px 0px 280px', threshold: 0.01 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasActiveResults, hasMorePlaces, visiblePlaces.length, displayedPlaces.length, view]);

  return <div className={`place-discover ${view === 'VIDEO' ? 'is-video' : view === 'PHOTO' ? 'is-photo' : 'is-guide'}`}>
    <header className="place-discover-header"><div><strong>spotlog</strong><span>{savedIds.length}{copy("개 장소 저장")}</span></div><PlaceViewToggle view={view} onChange={onViewChange} /></header>
    {view === 'VIDEO' ? <div className="feed" key={selectedRegion}>{videoPlaces.length ? videoPlaces.map((place) => <FeedCard key={place.id} place={place} saved={savedIds.includes(place.id)} onToggle={() => onToggle(place.id)} onShare={() => onShare(place)} region={selectedRegion} onChooseRegion={openRegion} />) : <div className="photo-reel-empty video-reel-empty"><Clapperboard size={28} /><h2>{selectedRegion}{' '}{copy("영상을 준비하고 있어요")}</h2><p>{copy("다른 지역의 장소 영상을 먼저 살펴보세요.")}</p><button type="button" className="photo-region-button" onClick={(event) => openRegion(event.currentTarget)}><MapPin size={16} />{copy("지역 선택")}</button></div>}</div> : view === 'PHOTO' ? <PhotoLandmarkFeed places={photoPlaces.filter((place) => !selectedRegion || landmarkRegion(place) === selectedRegion)} savedIds={savedIds} onToggle={onToggle} onShare={onShare} region={selectedRegion} onChooseRegion={openRegion} /> : <div className="place-guide-content">
      <section className="place-guide-lead"><small>LANDMARK GUIDE</small><h1>{copy("각 지역에 무엇이 있는지 보고")}<br />{copy("내 여행에 하나씩 담아보세요.")}</h1><p>{copy("지역이나 장소를 검색하고 마음에 드는 곳을 빠르게 저장하세요.")}</p><span className="local-data-note">{copy("로컬 샘플 콘텐츠 · 사진과 운영 정보는 방문 전 확인이 필요합니다.")}</span></section>
      <section className="place-guide-search"><label className="destination-search"><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy("지역이나 랜드마크를 검색하세요")} aria-label={copy("랜드마크 지역 검색")} />{query && <button type="button" onClick={() => setQuery('')} aria-label={copy("검색 지우기")}>{copy("지우기")}</button>}</label></section>
      <section className="region-directory" aria-label={copy("지역별 대표 랜드마크")}>
        <div className="region-directory-heading"><div><small>REGION DIRECTORY</small><h2>{copy("지역별로 둘러보기")}</h2></div><span>{regionGroups.length}{copy("개 지역 ·")}{' '}{guideLandmarks.length}{copy("곳")}</span></div>
        <div className="region-count-grid phase-region-strip">
          <button type="button" className={!selectedRegion ? 'active' : ''} onClick={() => chooseRegion('')} aria-pressed={!selectedRegion}><strong>{copy("전체")}</strong><small>{guideLandmarks.length}</small></button>
          {displayedRegionGroups.map(({ region, places }) => <button type="button" key={region} className={selectedRegion === region ? 'active' : ''} onClick={() => chooseRegion(region)} aria-pressed={selectedRegion === region}><strong>{region}</strong><small>{places.length}</small></button>)}
        </div>
      </section>
      <section className="place-guide-results"><div className="place-guide-heading"><div><small>PLACES TO SAVE</small><h2>{hasActiveResults ? resultTitle : copy("지역을 골라 장소 보기")}</h2></div><span>{hasActiveResults ? `${visiblePlaces.length}곳` : copy("지역별로 나눠보기")}</span></div>{!hasActiveResults ? <div className="region-result-empty"><MapPin size={23} /><div><strong>{copy("위에서 지역을 선택하세요")}</strong><p>{copy("선택한 지역의 장소를 3곳씩 불러오며, 아래로 스크롤하면 다음 장소가 자동으로 이어집니다.")}</p></div></div> : visiblePlaces.length ? <><div className="landmark-guide-list">{displayedPlaces.map((place) => <LandmarkGuideCard key={place.id} place={place} saved={savedIds.includes(place.id)} onToggle={() => onToggle(place.id)} onShare={() => onShare(place)} />)}</div>{hasMorePlaces ? <div ref={placeLoadSentinelRef} className="place-load-sentinel" aria-live="polite"><span className="place-load-indicator" aria-hidden="true"><i /><i /><i /></span><div><strong>{copy("아래로 스크롤하면 다음")}{' '}{Math.min(PLACE_LIST_PAGE_SIZE, visiblePlaces.length - displayedPlaces.length)}{copy("곳을 불러옵니다")}</strong><small>{displayedPlaces.length} / {visiblePlaces.length}{copy("곳 표시 중")}</small></div></div> : visiblePlaces.length > PLACE_LIST_PAGE_SIZE && <div className="place-list-end"><Check size={15} />{visiblePlaces.length}{copy("곳을 모두 불러왔습니다")}</div>}</> : <div className="community-empty"><MapPin size={27} /><h2>{copy("아직 준비된 장소가 없어요")}</h2><p>{copy("다른 지역이나 랜드마크 이름으로 찾아보세요.")}</p><button onClick={() => { setQuery(''); setSelectedRegion(''); }}>{copy("전체 장소 보기")}</button></div>}</section>
    </div>}
    {regionOpen && <BottomSheet title={copy("어느 지역을 볼까요?")} description={copy("지역을 고르면 해당 지역의 장소가 이어집니다.")} onClose={() => setRegionOpen(false)}>
      <div className="photo-region-options" aria-label={copy("탐색 지역")}>
        {[{ region: '', count: mediaPlaces.length }, ...mediaRegions].map(({ region, count }) => <button type="button" key={region || 'all'} aria-pressed={selectedRegion === region} onClick={() => { chooseRegion(region); setRegionOpen(false); }}>
          <span><strong>{region || copy("모든 지역")}</strong><small>{count ? `${count}개 장소` : `${view === 'VIDEO' ? copy("영상") : copy("사진")} 준비 중`}</small></span>{selectedRegion === region && <Check size={18} aria-hidden="true" />}
        </button>)}
      </div>
    </BottomSheet>}
  </div>;
}

function PlaceViewToggle({ view, onChange }: { view: PlaceView; onChange: (view: PlaceView) => void }) {
  const copy=useUiCopy();
  return <div className="place-view-toggle" aria-label={copy("장소 보기 방식")}><button className={view === 'VIDEO' ? 'active' : ''} onClick={() => onChange('VIDEO')}><Clapperboard size={14} />{copy("영상")}</button><button aria-pressed={view === 'PHOTO'} className={view === 'PHOTO' ? 'active' : ''} onClick={() => onChange('PHOTO')}><ImagePlus size={14} />{copy("사진")}</button><button className={view === 'GUIDE' ? 'active' : ''} onClick={() => onChange('GUIDE')}><MapIcon size={14} />{copy("지역 안내")}</button></div>;
}


function MotionPhotoReel({ images, active, label }: { images: string[]; active: boolean; label: string }) {
  const scenes = useMemo(() => images.length > 1 ? images : [images[0], images[0], images[0]], [images]);
  const [activeScene, setActiveScene] = useState(0);

  useEffect(() => {
    if (!active) {
      setActiveScene(0);
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setActiveScene((current) => (current + 1) % scenes.length), 3600);
    return () => window.clearInterval(timer);
  }, [active, scenes.length]);

  return <div className={`motion-photo-reel ${active ? 'is-running' : 'is-paused'}`} role="img" aria-label={`${label} 포토 모션`}>
    {scenes.map((image, index) => <span className={`motion-photo-scene motion-cut-${index % 3} ${activeScene === index ? 'is-active' : ''}`} key={`${image}-${index}`} aria-hidden="true"><img src={image} alt="" /></span>)}
    <div className="motion-photo-progress" aria-hidden="true">{scenes.map((_, index) => <i className={index === activeScene ? 'is-active' : index < activeScene ? 'is-complete' : ''} key={index}><span /></i>)}</div>
    <div className="motion-photo-label"><Sparkles size={13} />PHOTO MOTION · {images.length > 1 ? `${images.length} SCENES` : '1 PHOTO · 3 CUTS'}</div>
  </div>;
}

function FeedCard({ place, saved, onToggle, onShare, region, onChooseRegion }: { place: Place; saved: boolean; onToggle: () => void; onShare: () => void; region: string; onChooseRegion: (trigger: HTMLButtonElement) => void }) {
  const copy=useUiCopy();
  const cardRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [active, setActive] = useState(false);
  const motionImages = place.motionImages?.filter(Boolean) ?? [];

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const observer = new IntersectionObserver(([entry]) => {
      const visible = entry.isIntersecting && entry.intersectionRatio > 0.65;
      setActive(visible);
      const video = videoRef.current;
      if (!video) return;
      if (visible) void video.play().catch(() => undefined);
      else video.pause();
    }, { threshold: [0.65] });
    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  return <article className="feed-card" ref={cardRef} data-active={active}>
    {motionImages.length ? <MotionPhotoReel images={motionImages} active={active} label={place.name} /> : <video ref={videoRef} src={place.video} poster={place.image} autoPlay muted={muted} loop playsInline preload="metadata" />}
    <div className="video-shade" />
    <div className="feed-copy">
      <div className="creator-row"><span className="creator-avatar">{place.creator?.slice(0, 1).toUpperCase()}</span><strong>{place.creator}</strong><button>{copy("팔로우")}</button></div>
      <h1>{place.hook}</h1><p>{place.description}</p>
      <div className="tags">{place.tags?.map((tag) => <span key={tag}>#{tag}</span>)}</div>
      <button className="place-pill" onClick={onToggle}><span><MapPin size={16} /></span><span className="place-pill-copy"><strong>{place.name}</strong><small>{place.area} · {saved ? copy("저장됨") : copy("빠른 저장")}</small></span><ChevronRight size={17} /></button>
    </div>
    <div className="feed-actions"><ActionButton label={saved ? copy("저장됨") : copy("저장")} onClick={onToggle} active={saved} icon={Bookmark} /><ActionButton label={copy("공유")} onClick={onShare} icon={Share2} />{motionImages.length ? <div className="motion-action" aria-label={copy("사진으로 만든 자동 영상")}><span><Sparkles size={21} /></span><em>{copy("포토 모션")}</em></div> : <ActionButton label={muted ? copy("소리 켜기") : copy("음소거")} onClick={() => setMuted((value) => !value)} icon={muted ? VolumeX : Volume2} />}<MediaRegionButton region={region} onChoose={onChooseRegion} /></div>
  </article>;
}

function ActionButton({ label, onClick, icon: Icon, active = false }: { label: string; onClick: () => void; icon: LucideIcon; active?: boolean }) {
  return <div className="action-item"><button className={active ? 'active' : ''} onClick={onClick} aria-label={label}><Icon size={23} fill={active ? 'currentColor' : 'none'} /></button><span>{label}</span></div>;
}

function Trips({ journeys, onOpen, onCreate, onShare, onTrash, onDelete }: { onTrash: () => void; onDelete: (id: string) => void; journeys: Journey[]; onOpen: (id: string) => void; onCreate: () => void; onShare: (journey: Journey) => void }) {
  const copy=useUiCopy();
  const { locale } = useLocale();
  const en = locale === 'en';
  const myTrips = journeys.filter((journey) => journey.isMine);
  return <div className="page trips-page">
    <AppHeader title={en ? 'My trips' : copy("내 여행")} subtitle={en ? 'Build your itinerary from saved places' : copy("저장한 곳을 이어 만드는 나의 동선")} action={<button className="header-action solid" onClick={onCreate} aria-label={copy("새 여행")}><Plus size={20} /></button>} />
    <section className="journey-intro"><div><span>MY TRIP</span><h2>{copy("가고 싶은 곳을 잇고")}<br />{copy("주변에서 골라 담아요")}</h2></div><MapIcon size={32} /></section>
    <button className="phase-three-trash-link" onClick={onTrash}><Trash2 size={15}/>{en ? 'Trash' : copy("휴지통")}</button>
    {myTrips.some(isPersonalPlan) && <JourneySection title={en ? 'My itineraries' : copy("내 동선")} description={en ? 'Landmarks and places you added nearby' : copy("가고 싶은 장소와 함께 담은 업체")} journeys={myTrips.filter(isPersonalPlan)} onOpen={onOpen} onShare={onShare} onDelete={onDelete} />}
    {myTrips.some(journey => !isPersonalPlan(journey)) && <JourneySection title={en ? 'Journals' : copy("여행기와 이전 기록")} description={en ? 'Your written travel stories' : copy("작성하고 보관한 여행 이야기")} journeys={myTrips.filter(journey => !isPersonalPlan(journey))} onOpen={onOpen} onShare={onShare} onDelete={onDelete} />}
    <button className="primary wide create-trip-button" onClick={onCreate}><Plus size={18} />{copy("저장한 곳으로 여행 만들기")}</button>
  </div>;
}

function JourneySection({ title, description, journeys, onOpen, onShare, onDelete }: { onDelete?: (id: string) => void; title: string; description: string; journeys: Journey[]; onOpen: (id: string) => void; onShare: (journey: Journey) => void }) {
  const copy=useUiCopy();
  return <section className="journey-section"><div className="section-heading"><div><h2>{title}</h2><p>{description}</p></div><span>{journeys.length}</span></div><div className="journey-list">{journeys.map((journey) => <div className="journey-with-credit" key={journey.id}><article className="journey-card">
    <button className="journey-main" onClick={() => onOpen(journey.id)}><img src={journey.cover} alt="" /><span className={`status-badge status-${journey.status.toLowerCase()}`}>{journey.visibility === 'PUBLIC' ? <Globe2 size={11} /> : <Lock size={11} />}{journey.isMine ? `${journey.recommendationKind === 'AI' ? copy("AI 추천 · ") : ''}${copy(statusLabel[journey.status])}` : `${journey.author}의 가이드`}</span><span className="journey-gradient" /><span className="journey-copy"><small>{journey.region} · {journey.duration}</small><strong>{journey.title}</strong><em>{journey.summary}</em><span><CalendarDays size={13} />{journey.dateRange}<i />{journeyPlaceCount(journey)}{copy("곳")}</span></span></button>
    {onDelete && journey.isMine && <button className="journey-share journey-trash" aria-label={`${journey.title} 휴지통으로 이동`} onClick={() => onDelete(journey.id)}><Trash2 size={16}/></button>}
    <button className="journey-share" onClick={() => onShare(journey)} aria-label={`${journey.title} 공유`}><Share2 size={17} /></button>
  </article><PhotoCredit image={journey.cover} /></div>)}</div></section>;
}

function SavedPlaceCard({ place, placement, selection, onRemove, onAdd }: { selection?: { label: string; badge: string; included: boolean }; place: Place; placement?: { day: number; date: string; journeyTitle: string; count: number }; onRemove: (id: string) => void; onAdd: (place: Place) => void }) {
  const copy=useUiCopy();
  const { locale } = useLocale();
  const en = locale === 'en';
  const [detailOpen, setDetailOpen] = useState(false);
  const placementLabel = selection?.label ?? (placement ? (en ? 'Manage placement' : copy("담김 확인·해제")) : (en ? 'Add to trip' : copy("여행에 담기")));
  const included = selection ? selection.included : Boolean(placement);
  return <><article className={`saved-card ${included ? 'is-added-to-trip' : ''}`}>
    <div className="saved-card-media">
      <img src={place.image} alt={`${place.name} 저장 사진`} />
      <PhotoCredit image={place.image} />
    </div>
    <div className="saved-card-copy">
      <div className="saved-card-eyebrow"><span>{place.area}</span>{(selection?.badge || (!selection && placement)) && <em><Check size={12} />{selection ? selection.badge : placement!.count > 1 ? `${placement!.count}개 일정` : `DAY ${placement!.day}`}</em>}</div>
      <h3>{place.name}</h3>
      <p>{place.hook ?? place.description}</p>
      <div className="saved-place-time"><Clock3 size={13} />{place.bestTime ?? place.duration}</div>
      <div className="saved-card-actions">
        <button className={`add-to-trip ${included ? 'is-added' : ''}`} onClick={() => onAdd(place)} aria-label={`${place.name}, ${placementLabel}`} title={placement ? `${placement.journeyTitle} · ${placement.date}` : undefined}>{included && <Check size={13} />}{placementLabel}</button>
        <button type="button" className="saved-place-detail-button" aria-label={`${place.name} 상세보기`} aria-haspopup="dialog" onClick={() => setDetailOpen(true)}>{en ? 'Details' : copy("상세보기")}<ChevronRight size={14} aria-hidden="true" /></button>
      </div>
    </div>
    <button onClick={() => onRemove(place.id)} aria-label={`${place.name} 저장 취소`}><Bookmark size={19} fill="currentColor" /></button>
  </article>{detailOpen && <SavedLandmarkDetailSheet place={place} onClose={() => setDetailOpen(false)} />}</>;
}

function Saved({ places, journeys, draft, onDraftChange, onCreate, onRemove, onAdd, onGoDiscover }: { places: Place[]; journeys: Journey[]; draft: SavedTripDraft; onDraftChange: (draft: SavedTripDraft) => void; onCreate: (journey: Journey) => string | null; onRemove: (id: string) => void; onAdd: (place: Place) => void; onGoDiscover: () => void }) {
  const copy=useUiCopy();
  const { locale } = useLocale();
  const en = locale === 'en';
  const [savedRegion, setSavedRegion] = useState('');
  const [collapsedRegions, setCollapsedRegions] = useState<string[]>([]);
  const savedRegionNames = Array.from(new Set(places.map(landmarkRegion))).sort((a, b) => domesticRegionOrder.indexOf(a) - domesticRegionOrder.indexOf(b));
  const savedRegionGroups = savedRegionNames.map((region) => ({ region, places: places.filter((place) => landmarkRegion(place) === region) }));
  const visibleSavedGroups = savedRegion ? savedRegionGroups.filter((group) => group.region === savedRegion) : savedRegionGroups;
  const selectedPlaces = visibleSavedGroups.flatMap((group) => group.places);
  const placementsByPlace = useMemo(() => {
    const placements = new Map<string, { day: number; date: string; journeyTitle: string; count: number }>();
    journeys.filter((journey) => journey.isMine).forEach((journey) => journey.days.forEach((day) => day.places.forEach((place) => placements.set(place.id, { day: day.day, date: day.date, journeyTitle: journey.title, count: (placements.get(place.id)?.count ?? 0) + 1 }))));
    return placements;
  }, [journeys]);
  const toggleSavedRegion = (region: string) => setCollapsedRegions((current) => current.includes(region) ? current.filter((value) => value !== region) : [...current, region]);
  useEffect(() => {
    if (savedRegion && !savedRegionNames.includes(savedRegion)) setSavedRegion('');
  }, [savedRegion, savedRegionNames.join('|')]);
  const pick = (place: Place) => draft.active ? onDraftChange(pickSavedTripPlace(draft, place.id)) : onAdd(place);
  const selectionFor = (place: Place) => {
    if (!draft.active) return undefined;
    if (draft.mode === 'auto') {
      const included = draft.automaticIds.includes(place.id);
      return { included, badge: included ? copy("이번 여행") : '', label: included ? copy("선택됨 · 해제") : copy("이번 여행에 담기") };
    }
    const assignment = draft.assignments.find(item => item.placeId === place.id);
    const included = assignment?.day === draft.activeDay;
    return { included, badge: assignment ? assignment.day ? 'DAY ' + assignment.day : copy("DAY 미정") : '', label: included ? copy("담김 해제") : 'DAY ' + draft.activeDay + (assignment?.day ? copy("로 옮기기") : copy("에 담기")) };
  };
  useEffect(() => {
    const missing = [...draft.automaticIds, ...draft.assignments.map(item => item.placeId)].filter(id => !places.some(place => place.id === id));
    if (missing.length) onDraftChange(missing.reduce((current, id) => forgetSavedTripPlace(current, id), draft));
  }, [places, draft, onDraftChange]);

  return <div className="page saved-page"><AppHeader title={en ? "Saved places" : copy("저장한 장소")} subtitle={en ? `${places.length} saved places in Korea` : `${places.length}개의 국내 랜드마크`} />
    <SavedTripControls draft={draft} places={places} automaticPlaces={selectedPlaces} regionLabel={savedRegion || copy("전체 지역")} onChange={onDraftChange} onCreate={onCreate} />
    {places.length ? <><section className="saved-region-filter"><div><small>SAVED BY REGION</small><h2>{copy("지역별 저장 장소")}</h2></div><div className="saved-region-chips"><button type="button" className={!savedRegion ? 'active' : ''} onClick={() => setSavedRegion('')}>{copy("전체")}{' '}<span>{places.length}</span></button>{savedRegionGroups.map(({ region, places: regionPlaces }) => <button type="button" key={region} className={savedRegion === region ? 'active' : ''} onClick={() => setSavedRegion(region)}>{region} <span>{regionPlaces.length}</span></button>)}</div></section><div className="saved-region-groups">{visibleSavedGroups.map(({ region, places: regionPlaces }) => { const collapsed = collapsedRegions.includes(region); return <section className="saved-region-section" key={region}><button type="button" className="saved-region-heading" onClick={() => toggleSavedRegion(region)} aria-expanded={!collapsed}><span><strong>{region}</strong><small>{regionPlaces.length}{copy("곳")}</small></span><span>{regionPlaces.map((place) => place.name).join(' · ')}</span>{collapsed ? <ArrowDown size={17} /> : <ArrowUp size={17} />}</button>{!collapsed && <div className="saved-list">{regionPlaces.map((place) => <SavedPlaceCard key={place.id} place={place} placement={placementsByPlace.get(place.id)} selection={selectionFor(place)} onRemove={onRemove} onAdd={pick} />)}</div>}</section>; })}</div></> : <div className="empty saved-empty"><span className="empty-icon"><Bookmark size={28} /></span><h2>{copy("내 장소를 더 담아보세요")}</h2><p>{copy("영상이나 지역 안내 목록에서 마음에 드는 랜드마크를 저장하면")}<br />{copy("저장한 장소로 나만의 여행 일정을 만들 수 있어요.")}</p><button className="outline" onClick={onGoDiscover}><Compass size={17} />{copy("장소 둘러보기")}</button></div>}
  </div>;
}

function CreatorBadge({ copyCount, compact = false }: { copyCount: number; compact?: boolean }) {
  const copy=useUiCopy();
  const tier = getCreatorTier(copyCount);
  const TierIcon = tier.icon;
  return <span className={`creator-tier-badge ${compact ? 'compact' : ''}`}><TierIcon size={compact ? 11 : 13} />{copy(compact ? tier.shortLabel : tier.label)}</span>;
}

function JourneySocialSection({ comments, cheers, profile, myCopyCount, onComment, onCheer }: { comments: JourneyComment[]; cheers: JourneyCheers; profile: CreatorProfile; myCopyCount: number; onComment: (body: string) => void; onCheer: (cheer: CheerKey) => void }) {
  const copy=useUiCopy();
  const [commentDraft, setCommentDraft] = useState('');
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!commentDraft.trim()) return;
    onComment(commentDraft);
    setCommentDraft('');
  };
  return <section className="journey-social" aria-labelledby="journey-social-title">
    <header><div><small>TRAVELER REACTIONS</small><h2 id="journey-social-title">{copy("이 여행에 남긴 응원")}</h2></div><span><MessageCircle size={15} />{comments.length}</span></header>
    <div className="quick-cheers">{cheerOptions.map(({ id, label, icon: Icon }) => <button key={id} className={cheers.selected === id ? 'active' : ''} onClick={() => onCheer(id)} aria-pressed={cheers.selected === id}><Icon size={16} fill={cheers.selected === id ? 'currentColor' : 'none'} /><strong>{copy(label)}</strong><span>{cheers[id].toLocaleString()}</span></button>)}</div>
    <div className="comment-list">{comments.length ? comments.map((comment) => <article className="journey-comment" key={comment.id}><CreatorAvatar name={comment.author} image={comment.avatar} size="small" /><div><div className="comment-author"><CreatorBadge copyCount={comment.authorCopies} compact /><strong>{comment.author}</strong><time>{comment.createdAt}</time></div><p>{comment.body}</p></div></article>) : <div className="comment-empty"><Heart size={21} /><strong>{copy("첫 응원을 남겨보세요")}</strong><span>{copy("좋았던 점 한마디가 작성자에게 다음 여행을 올릴 힘이 됩니다.")}</span></div>}</div>
    <form className="comment-composer" onSubmit={submit}><CreatorAvatar name={profile.displayName} image={profile.avatar} size="small" /><label><span className="sr-only">{copy("댓글 작성")}</span><input value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} maxLength={180} placeholder={copy("좋았던 점을 따뜻하게 남겨주세요")} aria-label={copy("댓글 작성")} /></label><button type="submit" disabled={!commentDraft.trim()}>{copy("등록")}</button></form>
    <p className="social-kind-note"><CreatorBadge copyCount={myCopyCount} compact />{' '}{copy("내 등급이 댓글에도 함께 표시됩니다.")}</p>
  </section>;
}

function CreatorJourneySection({ journey, profile, authorJourneys, onOpenJourney }: { journey: Journey; profile: CreatorProfile; authorJourneys: Journey[]; onOpenJourney: (id: string) => void }) {
  const copy=useUiCopy();
  const publicJourneys = authorJourneys.filter((item) => item.status === 'PUBLISHED');
  const copyCount = publicJourneys.reduce((sum, item) => sum + item.saves, 0);
  const name = journey.isMine ? profile.displayName : journey.author;
  const avatar = journey.isMine ? profile.avatar : undefined;
  return <section className="detail-creator" aria-labelledby="detail-creator-title">
    <div className="detail-creator-kicker">CREATOR</div>
    <div className="detail-creator-card"><CreatorAvatar name={name} image={avatar} size="large" /><div className="detail-creator-copy"><CreatorBadge copyCount={copyCount} /><h2 id="detail-creator-title">{name}</h2><p>{journey.isMine ? profile.bio : `${journey.region}을 비롯한 국내 여행의 장면과 동선을 기록합니다.`}</p></div><div className="detail-creator-numbers"><span><strong>{copyCount.toLocaleString()}</strong>{copy("누적 담김")}</span><span><strong>{publicJourneys.length}</strong>{copy("공개 여행기")}</span></div></div>
    <div className="creator-journey-heading"><strong>{copy("이 작성자의 여행기")}</strong><span>{publicJourneys.length}{copy("개")}</span></div>
    {publicJourneys.length ? <div className="creator-journey-list">{publicJourneys.slice(0, 4).map((item) => <button key={item.id} onClick={() => onOpenJourney(item.id)}><img src={item.cover} alt="" /><span><small>{item.region} · {item.duration}</small><strong>{item.title}</strong><PhotoCredit image={item.cover} plain /><em><Copy size={12} />{item.saves.toLocaleString()}{copy("명이 담아감")}</em></span><ChevronRight size={17} /></button>)}</div> : <div className="creator-journey-empty"><Globe2 size={22} /><strong>{copy("아직 공개한 여행기가 없어요")}</strong><p>{copy("여행기를 공개하면 담김 수와 응원을 받을 수 있습니다.")}</p></div>}
  </section>;
}

function JourneyDetail({ journey, initialDay = 1, profile, comments, cheers, authorJourneys, onBack, onShare, onSharePlace, onEdit, onCopy, onComment, onCheer, onOpenJourney, copyLabel = '이 여행 복사해서 만들기' }: { journey: Journey; initialDay?: number; profile: CreatorProfile; comments: JourneyComment[]; cheers: JourneyCheers; authorJourneys: Journey[]; onBack: () => void; onShare: () => void; onSharePlace: (place: Place) => void; onEdit: () => void; onCopy: () => void; onComment: (body: string) => void; onCheer: (cheer: CheerKey) => void; onOpenJourney: (id: string) => void; copyLabel?: string }) {
  const copy=useUiCopy();
  const [selectedDay, setSelectedDay] = useState(journey.days.some(day => day.day === initialDay) ? initialDay : journey.days[0]?.day ?? 1);
  const dayHeadingRef = useRef<HTMLElement>(null);
  const day = journey.days.find((item) => item.day === selectedDay) ?? journey.days[0];
  const myCopyCount = authorJourneys.filter((item) => item.isMine && item.status === 'PUBLISHED').reduce((sum, item) => sum + item.saves, 0);
  const authorCopyCount = authorJourneys.filter((item) => item.status === 'PUBLISHED').reduce((sum, item) => sum + item.saves, 0);
  const selectDay = (dayNumber: number) => {
    setSelectedDay(dayNumber);
    window.requestAnimationFrame(() => dayHeadingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  return <div className="journey-detail">
    <header className="detail-topbar"><button onClick={onBack} aria-label={copy("뒤로")}><ArrowLeft size={21} /></button><strong>{journey.isMine ? copy("내 여행기") : journey.recommendationKind === 'AI' ? copy("AI 추천 여행") : copy("여행 가이드")}</strong><button onClick={journey.isMine ? onEdit : onShare} aria-label={journey.isMine ? copy("여행기 편집") : copy("여행 공유")}>{journey.isMine ? <Edit3 size={19} /> : <Share2 size={20} />}</button></header>
    <section className="detail-hero"><img src={journey.cover} alt="" /><div className="detail-hero-shade" /><div className="detail-title"><span>{journey.region} · {journey.duration}</span><h1>{journey.title}</h1><p>{journey.dateRange}</p></div></section>
    <section className="journal-lead"><PhotoCredit image={journey.cover} />{journey.recommendationKind === 'AI' && <p className="local-data-note"><Sparkles size={13} />{' '}{copy("AI 추천 여행 ·")}{' '}{journey.recommendationBasis === 'OFFICIAL_SOURCE_SAMPLE' ? copy("공식 자료로 구성한 샘플") : copy("로컬 추천으로 만든 초안")}</p>}<div className="author-line"><CreatorAvatar name={journey.isMine ? profile.displayName : journey.author} image={journey.isMine ? profile.avatar : undefined} size="medium" /><div><span className="author-name-row"><CreatorBadge copyCount={authorCopyCount} compact /><strong>{journey.isMine ? profile.displayName : journey.author}</strong></span><small>{journey.visibility === 'PUBLIC' ? copy("전체 공개 여행일기") : copy("나만 보는 여행 초안")}</small></div><button onClick={onShare}><Share2 size={16} />{copy("공유")}</button></div>{journey.sourceAuthor && <div className="copied-source"><Copy size={14} />{journey.sourceAuthor}{copy("의 여행기를 복사해 만든 내 버전")}</div>}<p className="summary">{journey.summary}</p><p className="story">{journey.story}</p><div className="guide-facts"><div><small>{copy("전체 일정")}</small><strong>{journey.duration}</strong></div><div><small>{copy("기록 장소")}</small><strong>{journeyPlaceCount(journey)}{copy("곳")}</strong></div><div><small>{copy("가이드 구성")}</small><strong>{journey.days.length}{copy("개 DAY")}</strong></div></div><div className="journal-meta"><span><Eye size={14} />{(journey.views ?? 0).toLocaleString()}{copy("회 조회")}</span><span><Copy size={14} />{journey.saves.toLocaleString()}{copy("명이 담아감")}</span><span><MessageCircle size={14} />{copy("댓글")}{' '}{comments.length}{copy("개")}</span><span><MapPin size={14} />{journeyPlaceCount(journey)}{copy("개 장소")}</span></div><p className="local-data-note">{copy("로컬 미리보기 · 조회·담김 수와 댓글에는 샘플이 포함되어 있으며 실제 사용자 집계가 아닙니다.")}</p><div className="journal-tags">{journey.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div></section>
    <DayNavigation days={journey.days} selectedDay={selectedDay} onSelect={selectDay} onBack={onBack} />
    {day && <>
      <section className="day-heading" ref={dayHeadingRef}><small>DAY {day.day} · {day.date}</small><h2>{day.title}</h2><p>{day.story}</p>{day.story && <TranslationText sourceId={`${journey.id}:${day.dayId ?? day.day}:story`} sourceVersion={sourceVersion(day.story)} text={day.story} kind="journal" showOriginal={false}/>}</section>
      {day.blocks.length > 0
        ? <article className="guide-story">{day.blocks.map((block) => <div className="journal-content-card" key={block.id}>{block.type === 'TEXT'
          ? <section className="story-text-block" key={block.id}>{block.heading && <h3>{block.heading}</h3>}<p>{block.body}</p>{block.body && <TranslationText sourceId={`${journey.id}:${block.id}`} sourceVersion={sourceVersion(block.body)} text={block.body} kind="journal" showOriginal={false}/>}</section>
          : block.type === 'IMAGE'
            ? <JournalPhotos block={block}/>
            : <GuidePlaceEmbed key={block.id} place={day.places.find((place) => block.visitId ? place.visitId === block.visitId : place.id === block.placeId)} onShare={onSharePlace} social={{journeyId:journey.id,blockId:block.id}} showImage={!(journey.recommendationBasis === 'OFFICIAL_SOURCE_SAMPLE' && Boolean(block.visitId) && day.blocks.some((item) => item.type === 'IMAGE' && item.visitId === block.visitId))} />
        }</div>)}</article>
        : !day.places.length && <div className="empty-day"><MapPin size={26} /><strong>{copy("아직 작성한 이야기가 없습니다")}</strong><p>{copy("글과 사진을 먼저 넣고, 필요한 장소는")}<br />{copy("직접 등록하거나 목록에서 골라보세요.")}</p></div>}
      {day.places.length > 0 && <section className="day-route-section"><div className="day-route-title"><small>ROUTE MAP</small><h3>{copy("이날의 동선 한눈에 보기")}</h3></div><RouteMap key={`${journey.id}-${day.day}`} places={day.places} /><section className="route-summary"><Route size={17} /><div><strong>{copy("이날의 이동 방향")}</strong><span>{day.places.map((place) => place.name).join(' → ')}</span></div></section></section>}
    </>}
    <PublicSourceNotes journey={journey} />
    <JourneySocialSection comments={comments} cheers={cheers} profile={profile} myCopyCount={myCopyCount} onComment={onComment} onCheer={onCheer} />
    <CreatorJourneySection journey={journey} profile={profile} authorJourneys={authorJourneys} onOpenJourney={onOpenJourney} />
    <footer className={`detail-footer ${journey.isMine ? 'owner-footer' : 'reader-footer'}`}>{journey.isMine
      ? <><button onClick={onEdit}><Edit3 size={18} />{copy("이 여행기 이어서 쓰기")}</button></>
      : <><button className="share-small" onClick={onShare} aria-label={copy("여행기 공유")}><Share2 size={18} /></button><button onClick={onCopy}><Copy size={18} />{copyLabel}</button></>
    }</footer>
  </div>;
}

function GuidePlaceEmbed({ place, onShare, showImage = true, preview = false, social }: { place?: Place; onShare: (place: Place) => void; showImage?: boolean;preview?:boolean;social?:{journeyId:string;blockId:string} }) {
  const copy=useUiCopy();
  if (!place) return null;
  const Icon = kindIcon[place.kind];
  return <aside className="guide-place-embed">{showImage && place.image && <img src={place.image} alt="" />}<div className="guide-place-copy">{showImage && <PhotoCredit image={place.image} />}<div className="place-kind"><Icon size={13} />{placeKindLabel[place.kind]}</div><h3>{place.name}</h3><div className="guide-place-time"><Clock3 size={14} />{place.time ? `${place.time} 도착 · ${place.duration} 체류` : place.duration}</div><p>{place.description}</p>{place.note&&<blockquote>“{place.note}”</blockquote>}{!preview&&<div><button onClick={() => openExternal(naverDirectionsUrl(place))}><Navigation size={15} />{copy("길찾기")}</button><button onClick={() => onShare(place)}><Share2 size={15} />{copy("공유")}</button></div>}</div>{!preview&&social&&<CardSocial {...social} placeName={place.name}/>}</aside>;
}

function JourneyEditor({ journey, onBack, onSave, onDraft }: { journey: Journey; onBack: () => void; onSave: (journey: Journey) => boolean; onDraft:(journey:Journey,view?:{selectedDay:number;scrollTop:number})=>boolean }) {
  const copy=useUiCopy();
  const [draft, renderDraft] = useState<Journey>(() => normalizePlan(journalDraftValue(journey)));
  const draftRef=useRef(draft),history=useRef<Journey[]>([]),future=useRef<Journey[]>([]);
  const [draftError,setDraftError]=useState(''),[draftStatus,setDraftStatus]=useState(journey.editorDraft?copy("이어서 쓰던 내용을 복구했어요."):'');
  const [blockTransfer,setBlockTransfer]=useState<{id:string;target:string;copy:boolean}|null>(null);
  const [previewing,setPreviewing]=useState(false);
  const persistDraft=(next:Journey)=>{draftRef.current=next;renderDraft(next);const ok=onDraft(next,{selectedDay:selectedDayRef.current,scrollTop:document.querySelector('.content')?.scrollTop??0});setDraftError(ok?'':copy("작성 내용을 저장하지 못했어요. 이 화면에서 다시 저장해 주세요."));setDraftStatus(ok?copy("작성 중 내용을 저장했어요."):'');return ok;};
  const setDraft=(action:Journey|((current:Journey)=>Journey))=>{const next=typeof action==='function'?action(draftRef.current):action;history.current=[...history.current.slice(-4),draftRef.current];future.current=[];persistDraft(next);};
  const saveFinal=()=>{try{if(!onSave(finishJournalDraft(draftRef.current)))setDraftError('저장하지 못했어요. 작성한 내용을 유지하고 있어요.');}catch(error){setDraftError(error instanceof Error?error.message:copy("저장하지 못했어요."));}};
  const [selectedDay, renderDay] = useState(journey.editorDraft?.selectedDay??journey.days[0]?.day ?? 1);
  const selectedDayRef=useRef(selectedDay);
  const setSelectedDay=(next:number)=>{selectedDayRef.current=next;renderDay(next);persistDraft(draftRef.current);};
  const leaveEditor=()=>{if(persistDraft(draftRef.current))onBack();};
  useEffect(()=>{const frame=requestAnimationFrame(()=>{const content=document.querySelector('.content');if(content&&journey.editorDraft?.scrollTop)content.scrollTop=journey.editorDraft.scrollTop;});return ()=>cancelAnimationFrame(frame);},[]);
  useEffect(()=>{if(!draftError)return;const preventLoss=(event:BeforeUnloadEvent)=>event.preventDefault();window.addEventListener('beforeunload',preventLoss);return ()=>window.removeEventListener('beforeunload',preventLoss);},[draftError]);
  const [pickerKind, setPickerKind] = useState<PlaceKind | null>(null);
  const day = draft.days.find((item) => item.day === selectedDay) ?? draft.days[0];

  const updateDay = (patch: Partial<JourneyDay>) => setDraft((current) => patchJournalDay(current,day.day,patch));
  const updateBlock = (id: string, patch: Partial<StoryBlock>) => setDraft(current=>{const target=current.days.find(day=>day.blocks.some(block=>block.id===id));return target?patchJournalDay(current,target.day,{blocks:target.blocks.map(block=>block.id===id?{...block,...patch}:block)}):current;});
  const updatePlace = (block: StoryBlock, patch: Partial<Place>) => updateDay({ places: day.places.map((place) => (block.visitId ? place.visitId === block.visitId : place.id === block.placeId) ? { ...place, ...patch } : place) });
  const moveBlock = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= day.blocks.length) return;
    const blocks = [...day.blocks];
    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
    updateDay({ blocks });
  };
  const removeBlock = (block: StoryBlock) => {
    const blocks = day.blocks.filter((item) => item.id !== block.id);
    const stillUsed = blocks.some((item) => item.type==='PLACE'&&(block.visitId ? item.visitId === block.visitId : item.placeId === block.placeId));
    const removingPlace=block.type==='PLACE'&&!stillUsed;
    updateDay({ blocks:removingPlace?blocks.map(item=>item.visitId===block.visitId?{...item,visitId:undefined}:item):blocks, places: removingPlace?day.places.filter((place) => block.visitId ? place.visitId !== block.visitId : place.id !== block.placeId):day.places });
  };
  const addTextBlock = () => updateDay({ blocks: [...day.blocks, { id: `text-${crypto.randomUUID()}`, type: 'TEXT', heading: '', body: '' }] });
  const addImageBlock = () => updateDay({ blocks: [...day.blocks, { id: `image-${crypto.randomUUID()}`, type: 'IMAGE', image: '', caption: '' }] });
  const addPlaceBlock = (place: Place) => {
    const visitId = crypto.randomUUID();
    updateDay({ places: [...day.places, { ...place, visitId, move: day.places.length ? copy("이동시간 확인 필요") : copy("여행 시작") }], blocks: [...day.blocks, { id: `block-${visitId}`, type: 'PLACE', placeId: place.id, visitId }] });
    setPickerKind(null);
  };
  const addDay = () => {
    const nextDay = draft.days.length + 1;
    setDraft(addPlanDay(draft));
    setSelectedDay(nextDay);
  };
  const removeSelectedDay = () => {
    if (draft.days.length <= 1) return;
    setDraft(removePlanDay(draft,day.dayId!));
    setSelectedDay(Math.max(1,selectedDay-1));
  };
  const setPublishing = (status: Journey['status']) => setDraft((current) => ({ ...current, status, visibility: status === 'PUBLISHED' ? 'PUBLIC' : 'PRIVATE' }));

  return <div className="journey-editor">
    <header className="editor-topbar"><button onClick={leaveEditor} aria-label={copy("작성 중 내용을 남기고 뒤로")}><ArrowLeft size={20} /></button><div><small>{draft.sourceAuthor ? `${draft.sourceAuthor}의 가이드에서 복사됨` : 'TRAVEL JOURNAL EDITOR'}</small><strong>{copy("여행기 작성")}</strong></div><button className="save-editor" onClick={()=>setPreviewing(true)}>{copy("미리보기")}</button></header>
    <div className="journal-draft-status"><span role="status">{draftStatus||copy("내 여행과 별도로 작성하는 여행기예요.")}</span><div><button disabled={!history.current.length} onClick={()=>{const previous=history.current.pop();if(previous){future.current.push(draftRef.current);persistDraft(previous);}}}>{copy("되돌리기")}</button><button disabled={!future.current.length} onClick={()=>{const next=future.current.pop();if(next){history.current.push(draftRef.current);persistDraft(next);}}}>{copy("다시 실행")}</button></div>{draftError&&<p role="alert">{draftError}<button onClick={()=>persistDraft(draftRef.current)}>{copy("다시 저장")}</button></p>}</div>
    <section className="editor-cover"><img src={draft.cover} alt="" /><div /><span>{draft.region}</span><p>{copy("표지 사진")}</p></section><PhotoCredit image={draft.cover} />
    <section className="editor-basics">
      <label><span>{copy("여행기 제목")}</span><input aria-label={copy("여행기 제목")} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} /></label>
      <div className="editor-row"><label><span>{copy("지역")}</span><input aria-label={copy("여행 지역")} value={draft.region} onChange={(event) => setDraft((current) => ({ ...current, region: event.target.value }))} /></label><label><span>{copy("기간")}</span><input aria-label={copy("여행 기간")} value={draft.duration} onChange={(event) => setDraft((current) => ({ ...current, duration: event.target.value }))} /></label></div>
      <label><span>{copy("한 줄 소개")}</span><textarea aria-label={copy("여행기 한 줄 소개")} rows={2} value={draft.summary} onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))} /></label>
      <label><span>{copy("여행 전체 이야기")}</span><textarea aria-label={copy("여행 전체 이야기")} rows={4} value={draft.story} onChange={(event) => setDraft((current) => ({ ...current, story: event.target.value }))} /></label>
      <p className="plan-help">{copy("작성 중 내용은 발행본에 바로 반영되지 않아요. 미리보기에서 공개 범위를 선택해 저장하세요.")}</p>
    </section>

    <DayNavigation days={draft.days} selectedDay={day.day} onSelect={setSelectedDay} onBack={leaveEditor}/>
    <div className="journal-day-actions" aria-label={copy("작성할 날짜 관리")}>
      <button type="button" disabled={draft.days.length>=30} onClick={addDay}><Plus size={14} />{copy("DAY 추가")}</button>
      <button type="button" disabled={draft.days.length>=30} onClick={()=>{setDraft(copyPlanDay(draft,day.dayId!));setSelectedDay(draft.days.length+1);}}>{copy("DAY 복사")}</button>
      {draft.days.length > 1 && <button type="button" className="remove-day" onClick={removeSelectedDay} aria-label={`DAY ${selectedDay} 삭제`}><Trash2 size={14} />DAY {selectedDay}{' '}{copy("삭제")}</button>}
    </div>
    {day && <section className="day-editor">
      <div className="day-editor-heading"><small>DAY {day.day}</small><input aria-label={copy("날짜 제목")} value={day.title} onChange={(event) => updateDay({ title: event.target.value })} /><textarea aria-label={copy("날짜 소개")} rows={2} value={day.story} onChange={(event) => updateDay({ story: event.target.value })} /></div>
      <div className="composer-guide"><Edit3 size={18} /><div><strong>{copy("글·사진·장소를 순서대로 엮어보세요")}</strong><p>{copy("여행 사진을 본문 사이에 넣고, 숙소·맛집·카페는 직접 정보를 적거나 준비된 목록에서 고를 수 있습니다.")}</p></div></div>
      <div className="editor-blocks">{day.blocks.map((block, index) => <div className="journal-edit-card" key={block.id}>{block.type === 'TEXT'
        ? <article className="editor-text-block" key={block.id}><div className="block-toolbar"><span>{copy("글")}</span><BlockControls index={index} total={day.blocks.length} onMove={moveBlock} onRemove={() => removeBlock(block)} /></div><input aria-label={`글 ${index + 1} 소제목`} value={block.heading ?? ''} onChange={(event) => updateBlock(block.id, { heading: event.target.value })} placeholder={copy("소제목을 입력하세요")} /><textarea aria-label={`글 ${index + 1} 본문`} rows={6} value={block.body ?? ''} onChange={(event) => updateBlock(block.id, { body: event.target.value })} placeholder={copy("이 장소에서 무엇을 보고 느꼈는지, 다음 장소로 왜 이동했는지 써보세요.")} /></article>
        : block.type === 'IMAGE'
          ? <JournalImageEditor block={block} toolbar={<BlockControls index={index} total={day.blocks.length} onMove={moveBlock} onRemove={()=>removeBlock(block)}/>} onUpdate={patch=>updateBlock(block.id,patch)} onCover={image=>setDraft(current=>({...current,cover:image}))} resize={resizeImageFile}/>
          : <EditorPlaceBlock key={block.id} block={block} place={day.places.find((place) => block.visitId ? place.visitId === block.visitId : place.id === block.placeId)} index={index} total={day.blocks.length} onUpdate={(patch) => updatePlace(block, patch)} onMove={moveBlock} onRemove={() => removeBlock(block)} />
      }<div className="journal-block-options">{block.type!=='PLACE'&&<label><span>{copy("연결 장소 (선택)")}</span><select aria-label={`카드 ${index+1} 연결 장소`} value={block.visitId??''} onChange={event=>updateBlock(block.id,{visitId:event.target.value||undefined})}><option value="">{copy("독립된 기록")}</option>{day.places.map(place=><option key={place.visitId} value={place.visitId}>{place.name}</option>)}</select></label>}<button onClick={()=>setBlockTransfer({id:block.id,target:draft.days.find(item=>item.dayId!==day.dayId)?.dayId??day.dayId!,copy:false})}>{copy("DAY 이동 · 복사")}</button></div></div>)}</div>
      {!day.blocks.length && <div className="empty-composer"><Edit3 size={24} /><strong>{copy("첫 장면을 시작해 보세요")}</strong><p>{copy("글, 사진, 장소 카드를 원하는 순서로 추가할 수 있습니다.")}</p></div>}
      <div className="insert-toolbar"><span>{copy("본문에 삽입")}</span><div><button onClick={addTextBlock}><Edit3 size={16} />{copy("글")}</button><button onClick={addImageBlock}><ImagePlus size={16} />{copy("사진")}</button><button onClick={() => setPickerKind('LANDMARK')}><MapPin size={16} />{copy("장소")}</button><button onClick={() => setPickerKind('STAY')}><Hotel size={16} />{copy("숙소")}</button><button onClick={() => setPickerKind('FOOD')}><Utensils size={16} />{copy("맛집")}</button><button onClick={() => setPickerKind('CAFE')}><Coffee size={16} />{copy("카페")}</button></div></div>
    </section>}
    <footer className="editor-footer"><button onClick={()=>setPreviewing(true)}><Save size={18} />{copy("여행기 미리보기")}</button></footer>
    {blockTransfer&&<BottomSheet title={copy("기록 이동·복사")} onClose={()=>setBlockTransfer(null)}><div className="plan-form"><Field label={copy("대상 DAY")}><select value={blockTransfer.target} onChange={event=>setBlockTransfer({...blockTransfer,target:event.target.value})}>{draft.days.map(day=><option key={day.dayId} value={day.dayId}>DAY {day.day}</option>)}</select></Field><label className="plan-check"><input type="checkbox" checked={blockTransfer.copy} onChange={event=>setBlockTransfer({...blockTransfer,copy:event.target.checked})}/>{copy("원본을 남기고 복사")}</label><p className="plan-help">{copy("장소 카드를 옮기면 연결된 글과 사진도 함께 옮겨요. 글·사진만 다른 DAY로 옮기면 기존 장소와의 연결은 풀려요.")}</p><Button disabled={!blockTransfer.copy&&blockTransfer.target===day.dayId} onClick={()=>{try{const block=day.blocks.find(item=>item.id===blockTransfer.id)!;setDraft(block.type==='PLACE'?transferVisit(draft,day.dayId!,block.visitId!,blockTransfer.target,blockTransfer.copy):moveJournalBlock(draft,day.dayId!,block.id,blockTransfer.target,blockTransfer.copy));setBlockTransfer(null);}catch(error){setDraftError(error instanceof Error?error.message:copy("옮기지 못했어요."));}}}>{blockTransfer.copy?copy("복사"):copy("이동")}</Button>{draftError&&<p role="alert">{draftError}</p>}</div></BottomSheet>}
    {previewing&&<BottomSheet title={copy("여행기 미리보기")} onClose={()=>setPreviewing(false)}><div className="journal-preview"><h2>{draft.title}</h2><p>{draft.summary}</p><p>{draft.story}</p>{draft.days.map(day=><section key={day.dayId}><h3>DAY {day.day} · {day.title}</h3><p>{day.story}</p>{day.blocks.map(block=><div key={block.id}>{block.type==='TEXT'?<><h4>{block.heading}</h4><p>{block.body}</p></>:block.type==='IMAGE'?<JournalPhotos block={block}/>:<GuidePlaceEmbed preview place={day.places.find(place=>place.visitId===block.visitId)} onShare={()=>{}}/>}</div>)}</section>)}<div className="plan-form"><Field label={copy("공개 범위")}><select value={draft.status} onChange={event=>setPublishing(event.target.value as Journey['status'])}><option value="PLANNING">{copy("나만 보기")}</option><option value="TRAVELING">{copy("여행 중 · 나만 보기")}</option><option value="PUBLISHED">{copy("전체 공개")}</option></select></Field><p className="plan-help">{copy("현재는 이 기기의 화면 미리보기예요. 실제 서버 게시와 다른 사용자 공개는 연결 전이에요.")}</p><Button onClick={saveFinal}>{draft.status==='PUBLISHED'?copy("전체 공개로 저장"):copy("비공개 여행기 저장")}</Button>{draftError&&<p role="alert">{draftError}</p>}</div></div></BottomSheet>}
    {pickerKind && <PlacePicker kind={pickerKind} region={draft.region} onClose={() => setPickerKind(null)} onSelect={addPlaceBlock} />}
  </div>;
}

function BlockControls({ index, total, onMove, onRemove }: { index: number; total: number; onMove: (index: number, direction: -1 | 1) => void; onRemove: () => void }) {
  const copy=useUiCopy();
  return <div className="block-controls"><button disabled={index === 0} onClick={() => onMove(index, -1)} aria-label={copy("위로 이동")}><ArrowUp size={14} /></button><button disabled={index === total - 1} onClick={() => onMove(index, 1)} aria-label={copy("아래로 이동")}><ArrowDown size={14} /></button><button onClick={onRemove} aria-label={copy("블록 삭제")}>×</button></div>;
}

function EditorImageBlock({ block, index, total, onUpdate, onMove, onRemove }: { block: StoryBlock; index: number; total: number; onUpdate: (patch: Partial<StoryBlock>) => void; onMove: (index: number, direction: -1 | 1) => void; onRemove: () => void }) {
  const copy=useUiCopy();
  const handleImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      onUpdate({ image: await resizeImageFile(file) });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : copy("사진을 불러오지 못했습니다."));
    }
  };
  return <article className="editor-image-block"><div className="block-toolbar"><span><ImagePlus size={13} />{copy("사진")}</span><BlockControls index={index} total={total} onMove={onMove} onRemove={onRemove} /></div>
    <label className={`image-upload ${block.image ? 'has-image' : ''}`}>{block.image ? <img src={block.image} alt="업로드한 여행 사진" /> : <><ImagePlus size={26} /><strong>{copy("여행 사진 선택")}</strong><small>{copy("사진은 저장 전에 모바일용으로 줄여집니다.")}</small></>}<input type="file" accept="image/*" capture="environment" onChange={(event) => void handleImage(event)} /></label>
    <input aria-label={`사진 ${index + 1} 설명`} value={block.caption ?? ''} onChange={(event) => onUpdate({ caption: event.target.value })} placeholder={copy("사진 설명을 적어주세요 (선택)")} />
  </article>;
}

function EditorPlaceBlock({ block, place, index, total, onUpdate, onMove, onRemove }: { block: StoryBlock; place?: Place; index: number; total: number; onUpdate: (patch: Partial<Place>) => void; onMove: (index: number, direction: -1 | 1) => void; onRemove: () => void }) {
  const copy=useUiCopy();
  if (!place) return null;
  const Icon = kindIcon[place.kind];
  return <article className="editor-place-block"><div className="block-toolbar"><span><Icon size={13} />{placeKindLabel[place.kind]}{' '}{copy("카드")}</span><BlockControls index={index} total={total} onMove={onMove} onRemove={onRemove} /></div><div className="editor-place-preview">{place.image && <img src={place.image} alt="" />}<div><strong>{place.name}</strong><small>{place.address}</small><p>{place.note}</p><PhotoCredit image={place.image} /></div></div><div className="editor-place-fields"><label><span>{copy("도착 시각")}</span><input type="time" value={place.time ?? ''} onChange={(event) => onUpdate({ time: event.target.value })} /></label><label><span>{copy("체류 시간")}</span><input value={place.duration} onChange={(event) => onUpdate({ duration: event.target.value })} placeholder={copy("예: 1시간 20분")} /></label><label className="wide-field"><span>{copy("이동 메모")}</span><input value={place.move ?? ''} onChange={(event) => onUpdate({ move: event.target.value })} placeholder={copy("예: 차량 25분")} /></label></div></article>;
}

function PlacePicker({ kind, region, onClose, onSelect }: { kind: PlaceKind; region: string; onClose: () => void; onSelect: (place: Place) => void }) {
  const copy=useUiCopy();
  const [mode, setMode] = useState<'CUSTOM' | 'CATALOG'>('CUSTOM');
  const [custom, setCustom] = useState({ name: '', area: region, address: '', description: '', note: '', duration: kind === 'STAY' ? copy("숙박") : '' , image: '' });
  const candidates = placeCatalog.filter((place) => place.kind === kind).sort((a, b) => Number(b.area.includes(region)) - Number(a.area.includes(region)));
  const updateCustom = (key: keyof typeof custom, value: string) => setCustom((current) => ({ ...current, [key]: value }));
  const handleCustomImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      updateCustom('image', await resizeImageFile(file, 1200, 0.8));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : copy("사진을 불러오지 못했습니다."));
    }
  };
  const addCustomPlace = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!custom.name.trim()) return;
    onSelect({
      id: `custom-${kind.toLowerCase()}-${Date.now()}`,
      kind,
      name: custom.name.trim(),
      area: custom.area.trim() || region,
      address: custom.address.trim(),
      lat: Number.NaN,
      lng: Number.NaN,
      image: custom.image,
      photos: custom.image ? undefined : [],
      description: custom.description.trim() || copy("직접 기록한 여행 장소입니다."),
      note: custom.note.trim() || copy("다녀온 뒤의 경험과 추천 포인트를 더 적어보세요."),
      duration: custom.duration.trim() || (kind === 'STAY' ? copy("숙박") : copy("체류 시간 미입력")),
    });
  };
  return <BottomSheet title={`${placeKindLabel[kind]} 삽입`} onClose={onClose}><section className="place-picker phase-embedded-sheet">
    <div className="place-picker-tabs"><button className={mode === 'CUSTOM' ? 'active' : ''} onClick={() => setMode('CUSTOM')}>{copy("직접 등록")}</button><button className={mode === 'CATALOG' ? 'active' : ''} onClick={() => setMode('CATALOG')}>{copy("목록에서 선택")}</button></div>
    {mode === 'CUSTOM' ? <form className="custom-place-form" onSubmit={addCustomPlace}>
      <p>{copy("모든 업체를 미리 등록할 필요 없이, 직접 다녀온 정보를 여행기에 남기세요.")}</p>
      <label className={`custom-photo-field ${custom.image ? 'has-image' : ''}`}>{custom.image ? <img src={custom.image} alt="등록할 장소" /> : <><ImagePlus size={22} /><span>{placeKindLabel[kind]}{' '}{copy("사진 추가")}</span></>}<input type="file" accept="image/*" capture="environment" onChange={(event) => void handleCustomImage(event)} /></label>
      <label><span>{placeKindLabel[kind]}{' '}{copy("이름 *")}</span><input required value={custom.name} onChange={(event) => updateCustom('name', event.target.value)} placeholder={kind === 'STAY' ? copy("예: 바다 앞 작은 펜션") : copy("장소 이름")} /></label>
      <div className="custom-place-row"><label><span>{copy("지역")}</span><input value={custom.area} onChange={(event) => updateCustom('area', event.target.value)} placeholder={copy("예: 부산 해운대")} /></label><label><span>{kind === 'STAY' ? copy("숙박 형태") : copy("머문 시간")}</span><input value={custom.duration} onChange={(event) => updateCustom('duration', event.target.value)} placeholder={kind === 'STAY' ? copy("1박") : copy("약 1시간")} /></label></div>
      <label><span>{copy("주소")}</span><input value={custom.address} onChange={(event) => updateCustom('address', event.target.value)} placeholder={copy("주소를 입력하면 길찾기 검색에 사용합니다")} /></label>
      <label><span>{copy("정보 소개")}</span><textarea rows={2} value={custom.description} onChange={(event) => updateCustom('description', event.target.value)} placeholder={kind === 'STAY' ? copy("객실, 위치, 주변 동선 등 기본 정보를 적어주세요.") : copy("어떤 곳인지 간단히 소개해 주세요.")} /></label>
      <label><span>{copy("내 경험과 추천 포인트")}</span><textarea rows={3} value={custom.note} onChange={(event) => updateCustom('note', event.target.value)} placeholder={kind === 'STAY' ? copy("실제로 묵어보니 좋았던 점, 체크인 팁 등을 적어주세요.") : copy("직접 다녀와서 알게 된 팁을 적어주세요.")} /></label>
      <button className="primary custom-place-submit" type="submit"><Plus size={17} />{placeKindLabel[kind]}{' '}{copy("카드 추가")}</button>
    </form> : <><p>{copy("준비된 항목은 빠르게 고르는 보조 목록입니다. 없으면 직접 등록하세요.")}</p><div className="picker-list">{candidates.map((place) => <button key={place.id} onClick={() => onSelect(place)}><img src={place.image} alt="" /><span><strong>{place.name}</strong><small>{place.area} · {place.address}</small><PhotoCredit image={place.image} plain /></span><Plus size={17} /></button>)}</div></>}
  </section></BottomSheet>;
}

const kindIcon: Record<PlaceKind, LucideIcon> = { LANDMARK: MapPin, STAY: Hotel, FOOD: Utensils, CAFE: Coffee, SHOP: Store };

function PlaceJournalCard({ place, index, onShare }: { place: Place; index: number; onShare: () => void }) {
  const copy=useUiCopy();
  const Icon = kindIcon[place.kind];
  return <article className="place-journal-card"><div className="timeline-rail"><span>{index + 1}</span><i /></div><div className="place-card-body"><div className="move-label"><Footprints size={13} />{place.move}</div><img src={place.image} alt="" /><div className="place-card-copy"><div className="place-kind"><Icon size={13} />{placeKindLabel[place.kind]}</div><h3>{place.name}</h3><p className="address">{place.address}</p><p>{place.description}</p><blockquote>{place.note}</blockquote><div className="place-card-actions"><button onClick={() => openExternal(naverDirectionsUrl(place))}><Navigation size={15} />{copy("길찾기")}</button><button onClick={onShare}><Share2 size={15} />{copy("장소 공유")}</button></div></div></div></article>;
}

function CreateJourneySheet({ onClose, onCreate }: { onClose: () => void; onCreate: (title: string, region: string) => void }) {
  const copy=useUiCopy();
  const [region, setRegion] = useState('제주');
  const [title, setTitle] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onCreate(title.trim() || `${region}에서 남길 새로운 기록`, region);
  };
  return <BottomSheet title={copy("새 여행 만들기")} onClose={onClose}><form className="create-sheet phase-embedded-sheet" onSubmit={submit}><Field label={copy("국내 지역")}><select value={region} onChange={(event) => setRegion(event.target.value)}><option value="제주">{copy("제주")}</option><option value="서울">{copy("서울")}</option><option value="강릉">{copy("강릉")}</option><option value="부산">{copy("부산")}</option><option value="경주">{copy("경주")}</option><option value="전주">{copy("전주")}</option></select></Field><Field label={copy("여행 제목")}><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={`${region}에서 남길 새로운 기록`} /></Field><p>{copy("여행은 여러 개 만들 수 있습니다. 우선 이 기기에 비공개 초안으로 저장합니다.")}</p><Button className="wide" type="submit"><Plus size={18} />{copy("여행 만들기")}</Button></form></BottomSheet>;
}

function Profile({ native, journeys, comments, cheers, profile, notificationPreferences, notificationPermission, onBack, onProfileChange, onNotificationPreferencesChange, onPreviewNotification, onOpen }: { native: boolean; journeys: Journey[]; comments: JourneyComment[]; cheers: CheerStore; profile: CreatorProfile; notificationPreferences: NotificationPreferences; notificationPermission: 'granted' | 'denied' | 'undetermined'; onBack: () => void; onProfileChange: (profile: CreatorProfile) => boolean; onNotificationPreferencesChange: (preferences: NotificationPreferences) => void; onPreviewNotification: () => void; onOpen: (id: string) => void }) {
  const copy=useUiCopy();
  const { locale } = useLocale();
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [accountOpen,setAccountOpen]=useState(false);
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
  const notificationStatus = !native ? copy("앱에서 권한 확인") : notificationPermission === 'granted' ? copy("기기 알림 허용됨") : notificationPermission === 'denied' ? copy("기기 권한이 꺼져 있어요") : copy("권한 확인 전");
  const handleAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      onProfileChange({ ...profile, avatar: await resizeImageFile(file, 480, 0.84) });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : copy("프로필 아이콘을 불러오지 못했습니다."));
    }
  };

  return <div className="page profile-page"><header className="profile-topbar"><button onClick={onBack} aria-label={copy("홈으로 돌아가기")}><ArrowLeft size={21} /></button><div><small>{mine.length}{copy("개의 여행 ·")}{' '}{published.length}{copy("개의 공개 일기")}</small><h1>{copy("프로필")}</h1></div></header>
    <div className="profile-card creator-profile-card"><label className="profile-avatar-upload"><CreatorAvatar name={profile.displayName} image={profile.avatar} size="large" /><span className="profile-avatar-edit"><Upload size={13} /></span><input type="file" accept="image/*" onChange={(event) => void handleAvatar(event)} aria-label={copy("내 프로필 아이콘 업로드")} /></label><div><div className="profile-name-row"><CreatorBadge copyCount={copyCount} /><h3>{profile.displayName}</h3></div><p>{profile.bio}</p><button onClick={() => document.querySelector<HTMLInputElement>('.profile-avatar-upload input')?.click()}><ImagePlus size={13} />{copy("내 아이콘 바꾸기")}</button></div></div>

    <div className="profile-stats creator-stats"><div><strong>{copyCount.toLocaleString()}</strong><span>{copy("누적 담김")}</span></div><div><strong>{(reactionTotal + receivedComments.length).toLocaleString()}</strong><span>{copy("받은 응원")}</span></div><div><strong>{creatorScore.toLocaleString()}</strong><span>{copy("창작 점수")}</span></div></div>

    <section className="creator-level-card"><header><div><small>CREATOR LEVEL</small><h2><TierIcon size={19} />{copy(tier.label)}</h2></div><strong>{copyCount.toLocaleString()}{copy("회 담김")}</strong></header><div className="creator-progress"><span style={{ width: `${levelProgress}%` }} /></div><p>{nextTier ? <><strong>{Math.max(0, nextTier.min - copyCount)}{copy("번")}</strong>{' '}{copy("더 담기면")}{' '}<b>{copy(nextTier.label)}</b>{' '}{copy("등급이 됩니다.")}</> : copy("최고 등급입니다. Spotlog를 대표하는 여행 가이드예요.")}</p></section>

    <section className={`creator-notification-card ${notificationPreferences.enabled ? 'is-enabled' : ''}`}><header><span className="notification-feature-icon">{notificationPreferences.enabled ? <Bell size={20} /> : <BellOff size={20} />}</span><div><small>CREATOR PUSH</small><h2>{copy("조회수 목표 알림")}</h2><p>{copy("내 여행기가 정한 조회수를 달성하면 앱 푸시로 알려드려요.")}</p></div><button className="notification-switch" role="switch" aria-label={copy("조회수 목표 알림")} aria-checked={notificationPreferences.enabled} onClick={() => onNotificationPreferencesChange({ ...notificationPreferences, enabled: !notificationPreferences.enabled })}><span /></button></header><div className="notification-permission"><span className={native && notificationPermission === 'granted' ? 'okay' : ''}>{notificationStatus}</span><em>{notificationPreferences.enabled ? native && notificationPermission === 'denied' ? copy("권한 필요") : copy("알림 켜짐") : copy("알림 꺼짐")}</em></div>{notificationPreferences.enabled && <div className="notification-options"><label><span>{copy("조회수 알림 기준")}</span><select value={notificationPreferences.viewMilestone} onChange={(event) => onNotificationPreferencesChange({ ...notificationPreferences, viewMilestone: Number(event.target.value) })} aria-label={copy("조회수 알림 기준")}><option value={100}>{copy("100회")}</option><option value={500}>{copy("500회")}</option><option value={1000}>{copy("1,000회")}</option><option value={5000}>{copy("5,000회")}</option><option value={10000}>{copy("10,000회")}</option></select></label><button onClick={onPreviewNotification}><Bell size={15} />{copy("테스트 푸시 받기")}</button></div>}<p className="notification-server-note">{copy("실제 서비스에서는 서버가 조회수를 집계하고 같은 목표에 한 번만 푸시를 발송합니다.")}</p></section>

    <section className="profile-reactions"><div className="profile-section-heading"><div><small>CREATOR BOOST</small><h2>{copy("받은 응원")}</h2></div><span>{reactionTotal + receivedComments.length}</span></div><div className="profile-reaction-chips">{cheerOptions.map(({ id, label, icon: Icon }) => <div key={id}><Icon size={16} /><span>{copy(label)}</span><strong>{reactionCounts[id].toLocaleString()}</strong></div>)}</div>{receivedComments.length ? <div className="profile-feedback-list">{receivedComments.slice(-3).reverse().map((comment) => <blockquote key={comment.id}>“{comment.body}”<span>{comment.author}</span></blockquote>)}</div> : <div className="profile-feedback-empty"><MessageCircle size={22} /><strong>{copy("공개 여행기에 응원이 쌓여요")}</strong><p>{copy("“너무 좋아요”, “최고예요” 같은 반응과 댓글을 이곳에서 한눈에 볼 수 있습니다.")}</p></div>}</section>

    <section className="profile-journeys"><div className="profile-section-heading"><div><small>MY TRAVEL STORIES</small><h2>{copy("내가 만든 여행")}</h2></div><span>{mine.length}</span></div>{mine.length ? <div>{mine.map((journey) => <button key={journey.id} onClick={() => onOpen(journey.id)}><img src={journey.cover} alt="" /><span><small>{journey.visibility === 'PUBLIC' ? copy("공개 여행기") : copy("비공개 초안")} · {journey.region}</small><strong>{journey.title}</strong><PhotoCredit image={journey.cover} plain /><em><Eye size={12} />{(journey.views ?? 0).toLocaleString()} <i /> <Copy size={12} />{journey.saves.toLocaleString()}{copy("명")}{' '}<i /> <MessageCircle size={12} />{comments.filter((comment) => comment.journeyId === journey.id).length}</em></span><ChevronRight size={17} /></button>)}</div> : <div className="profile-feedback-empty"><MapIcon size={22} /><strong>{copy("첫 여행기를 만들어보세요")}</strong><p>{copy("여행을 공개하면 담김 수와 응원으로 창작 등급이 올라갑니다.")}</p></div>}</section>

    <button className="phase-three-profile-settings" onClick={() => setPreferencesOpen(true)}><Settings size={16}/>{locale === 'en' ? 'Profile & preferences' : copy("프로필 · 이용 설정")}</button>
    <button className="phase-three-profile-settings" onClick={()=>setAccountOpen(true)}><UserRound size={16}/>{locale==='en'?'Account · sign in':copy("계정 · 로그인")}</button>
    {accountOpen&&<AccountSheet onClose={()=>setAccountOpen(false)}/>}
    {preferencesOpen && <ProfilePreferencesSheet name={profile.displayName} onClose={() => setPreferencesOpen(false)} onSave={displayName => onProfileChange({...profile,displayName})} />}
    <div className="settings-list"><SettingRow icon={Globe2} label={copy("서비스 화면")} value={copy("모바일웹")} /><SettingRow icon={MapIcon} label={copy("여행 범위")} value={copy("대한민국")} /><SettingRow icon={Route} label={copy("지도·길찾기")} value={copy("연결됨")} active /><SettingRow icon={UserRound} label={copy("실행 환경")} value={native ? copy("Expo 앱") : copy("웹 브라우저")} /></div><p className="demo-note">{copy("댓글·응원·프로필 아이콘은 현재 이 기기에 저장됩니다. 실제 사용자 간 동기화는 서버 연결 시 동일한 화면 구조로 전환됩니다.")}</p></div>;
}

function SettingRow({ icon: Icon, label, value, active = false }: { icon: LucideIcon; label: string; value: string; active?: boolean }) {
  return <div><span className="setting-icon"><Icon size={18} /></span><strong>{label}</strong><span className={active ? 'active-value' : ''}>{value}</span><ChevronRight size={16} /></div>;
}

function AppHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  const copy=useUiCopy();
  return <header className="app-header"><div><small>{subtitle}</small><h1>{title}</h1></div>{action ?? <button className="header-action" aria-label={copy("검색")}><Search size={20} /></button>}</header>;
}
