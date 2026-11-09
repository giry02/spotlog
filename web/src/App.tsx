import { naverDirectionsUrl } from './placeDirections';
import { accountProviderName } from './accountMethods';
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
  BookOpen,
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
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  ThumbsUp,
  Trash2,
  Upload,
  UserRound,
  Utensils,
  Users,
  X,
  Volume2,
  VolumeX,
  type LucideIcon,
} from 'lucide-react';
import jejuGuideCover from '../../assets/spotlog/jeju-west-guide-cover.jpg';
import jejuHyeopjaeTidepool from '../../assets/spotlog/jeju-hyeopjae-tidepool.webp';
import jejuHyeopjaeUdonDinner from '../../assets/spotlog/jeju-hyeopjae-udon-dinner.webp';
import seoulForestCover from '../../assets/spotlog/seoul-forest-evening.webp';
import { Suspense, lazy } from 'react';
import { distanceKm, roundMinutes, parseDurationMinutes, formatClock } from './routeData';
const LazyRouteMap = lazy(() => import('./RouteMap'));
function RouteMap(props: {places: Place[];selectedVisitId?:string;onSelectVisit?:(id:string)=>void;onResolveWarning?:(warning: import('./routeWarnings').RouteWarning)=>void}) {
  const copy=useUiCopy(); const {locale}=useLocale();return <Suspense fallback={<div className="route-map-unavailable" role="status">{locale==='en'?'Loading map…':copy("지도를 불러오는 중…")}</div>}><LazyRouteMap {...props}/></Suspense>; }
import { type ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AppMenu, AppMenuButton, AppMenuContext, OfflineLibrary } from './AppMenu';
import InterestCollections from './InterestCollections';
import MyRegionSheet from './MyRegionSheet';
import SavedPlaceUseSheet from './SavedPlaceUseSheet';
import { afterSheetClose } from './sheetNavigation';
import { placeProposalDestinations, proposeSavedPlace, type PlaceProposalTarget } from './together/placeProposal';
import { retainCreationHandoff } from './together/creationHandoff';
import { activeRegion, myRegionStorageKey, readMyRegions, type MyRegionsState } from './discoveryRegionStore';
import './saved-place-density.css';
import InterestPlacesMap from './InterestPlacesMap';
import TogetherApp from './together/TogetherApp';
import HomeCommunity from './together/HomeCommunity';
import DiscoveryHome from './community/DiscoveryHome';
import TravelDiscovery from './community/TravelDiscovery';
import PlaceDirectory, { type PlaceDirectorySearch } from './community/PlaceDirectory';
import { CreateAppointmentSheet } from './community/PlatformHubs';
import { MyHub } from './community/MyHub';
import { detailScreen, isTravelRootRoute, legacyMyHashMatches, legacyMySection, myRoute, mySectionForRoute, primaryTabForScreen, primaryTabs, type MySection } from './primaryNavigation';
import { selectMemberHomeSchedule } from './community/memberHomeReturn';
import { validCalendarDay } from './together/calendarPlans';
import { createStandaloneAppointment, memberAppointments, type AppointmentInput, type AppointmentRange } from './community/platformModel';
import type { DiscoveryHomeView, DiscoveryPurpose } from './community/discoveryHomeModel';
import { isPublicHomeJournal, type HomeTravelDuration } from './community/travelHomeModel';
import { createTogetherRepository } from './together/repository';
import { createPublicActivityIntent, resolvePublicActivityIntent } from './together/publicActivityIntent';
import { isTogetherWorkspaceSwitch } from './together/workspaceNavigation';
import { ScreenHeader, ScreenTabs } from './ScreenHeader';
import { publicPlaceRegion, filterHomePlaces, homePlacePreview } from './homeDiscovery';
import './recommendation-home.css';
import type { GroupDiscoveryFilters } from './together/GroupDiscovery';
import type { NotificationPreferences } from '../../shared/hybridBridge';
import { createLocalRepository, PLACE_DIRECTORY_KEY } from './localRepository';
import { LandmarkGuideCard } from './LandmarkGuideCard';
import { DayNavigation } from './DayNavigation';
import { getPlacePhotos } from './PhotoPlaceCard';
import { PhotoLandmarkFeed } from './PhotoLandmarkFeed';
import { MediaRegionButton } from './MediaRegionButton';
import { BottomSheet, hasActiveSheet, SHEET_OPEN_EVENT } from './BottomSheet';
import { normalizeVisits, removeVisit } from './visits';
import { AddToTripSheet } from './AddToTripSheet';
import { applyTripPlacement, type TripPlacementRequest } from './tripPlacement';
import { SavedTripControls } from './SavedTripControls';
import { newSavedTripDraft, pickSavedTripPlace, forgetSavedTripPlace, type SavedTripDraft } from './savedTripBuilder';
import { AiPlannerSheet, type AiPlannerDraft } from './AiPlannerSheet';
import TravelGuideSheet from './TravelGuideSheet';
import { ContentLanguageControls, ContentTranslationScope, TranslationText } from './TranslationText';
import { mergeActiveJourneyChanges } from './tripTrash';
import { sourceVersion } from './travelGuide';
import { LocaleProvider, useLocale } from './locale';
import { ProfilePreferencesSheet } from './ProfilePreferencesSheet';
import { AccountProvider } from './AccountProvider';
import { CustomerErrorBoundary } from './CustomerErrorBoundary';
import { ErrorPage, ErrorPagesReview } from './ErrorPage';
import { isErrorKind, readErrorRoute, type ErrorKind } from './errorStates';
import { useAccount } from './accountContext';
import type { SocialAccountAdapter } from './socialAccountService';
import { PrivacySheet } from './PrivacySheet';
import { TripTrashSheet, MoveToTrashSheet } from './TripTrashSheet';
import './phase-three-integration.css';
import './strategy-home.css';
import { useConsumerDensity } from './consumerDensity';
import { SavedLandmarkDetailSheet } from './SavedLandmarkDetailSheet';
import { publicTourismPlaces } from './publicTourismContent';
import { homeTripTemplates, publishedJourneySeeds, previewTemplateJourney, buildAiJourneyDraft, defaultComments, type JourneyComment, type HomeTripTemplate } from './consumerPublicSeed';
import { PhotoCredit, PublicSourceNotes } from './PublicTourismCredit';
import { CardSocial, CardSocialProvider, useCardSocialStore } from './CardSocial.tsx';
import { JournalReportButton, ReportButton, ReportProvider } from './ReportSheet';
import { restrictPublicJourneyMedia, recordPublicCheer, type PublicPlaceProjection } from './reviewServiceBridge';
import { PublicReviewProvider, usePublicReview, useHomePlaceExposures, reviewExposureOrder, localPublicReviewEnabled } from './publicReview';
import { creatorGradeRules, currentCreatorGrade } from './creatorGrade';
import { CreatorAvatar } from './CreatorAvatar.tsx';
import './journal-editing.css';
import { CARD_SOCIAL_KEY, type CardSocialStore } from './cardSocialState';
import { journalCommentTime, sampleJournalComments, withSampleCardThreads } from './consumerSocialSamples';
import { JournalImageEditor, JournalPhotos } from './JournalPhotos';
import { finishJournalDraft, journalDraftValue, moveJournalBlock, patchJournalDay, stashJournalDraft } from './journalDraft';
import { Button, Field } from './ui';
import { StyleGuide } from './StyleGuide';
import { PersonalTrip } from './PersonalTrip';
import { OfflineSavedBadge, useConnectivity } from './OfflineTripControl';
import { removeOfflineTrip } from './offlineTrips';
import { CreatePlanSheet } from './CreatePlanSheet';
import { addPlanDay, appendPlanPlace, buildPersonalPlan, copyPersonalPlan, copyPlanDay, hasLocation, initializeCreatedPlan, isPersonalPlan, makeJournalFromPlan, normalizePlan, removePlanDay, transferVisit } from './tripPlan';
import { PLAN_CREATION_KEY, type PlanCreationDraft } from './planCreationDraft';
import { SAVED_TRIP_DRAFT_KEY } from './savedTripDraft';
import { ChatbotHostController } from './ChatbotHostController';
import { createChatbotDraftCopy, type ChatbotEntry } from './chatbotHostBridge';
import { RECENT_TRIP_KEY, tripContinuation, type TripContinuation } from './tripContinuation';
import { rememberTravelPosition } from './tripProgress';
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
import { isNativeShell, notifyNavigationState, notifyReady, openExternal, previewCreatorNotification, shareContent, subscribeNavigationCommands, subscribeNotificationStatus, subscribePreviewNotificationResult, updateNotificationPreferences } from './nativeBridge';

type Tab = 'home' | 'travel' | 'my' | 'appointments' | 'records' | 'community' | 'discover' | 'together' | 'offline' | 'trips' | 'saved' | 'profile' | 'photo-stories' | 'style-guide' | 'error' | 'errors';
type PlaceView = 'VIDEO' | 'GUIDE' | 'PHOTO';
type BrowsePlaceKind = PlaceKind | 'ALL';
const browsePlaceKinds: BrowsePlaceKind[] = ['ALL', 'LANDMARK', 'FOOD', 'CAFE', 'STAY', 'SHOP', 'LEISURE'];

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

type HomeTopic = 'recommended' | 'places' | 'groups' | 'trips';
interface DiscoveryMemory { region: string; query: string; view: DiscoveryHomeView; purpose?: DiscoveryPurpose; useMyRegion?: boolean; travelRegion?: string; travelQuery?: string; duration?: HomeTravelDuration; travelDuration?: HomeTravelDuration }
function myRegionsStorage() { try { return window.localStorage; } catch { return null; } }
interface HomeViewMemory { placeKind: PlaceKind | 'ALL'; region?: string; query?: string; groupRegion: { value: string }; recommendationId?: string; guideId?: string }

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
  errorKind?: ErrorKind;
  togetherRoute?: string;
  discoveryFilters?: GroupDiscoveryFilters;
  homeTopic?: HomeTopic;
  discoveryHome?: DiscoveryMemory;
  appointmentRange?: AppointmentRange;
  recordsSection?: string;
  mySection?: MySection;
  calendarView?: { month: string; date: string };
  placeKind?: BrowsePlaceKind;
  placeRegion?: string;
  placeDistrict?: string;
  placeQuery?: string;
}

type TripDurationFilter = 'ALL' | 'DAY_TRIP' | 'ONE_NIGHT' | 'TWO_NIGHTS' | 'THREE_PLUS';

interface TripSearchFilters {
  destination: string;
  duration: TripDurationFilter;
  category?: 'TRAVELER' | 'AI';
  region?: string;
  district?: string;
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

type CheerKey = 'LOVE' | 'BEST' | 'HELPFUL';

interface JourneyCheers {
  LOVE: number;
  BEST: number;
  HELPFUL: number;
  selected?: CheerKey;
  selections?: Record<string, CheerKey>;
}

type CheerStore = Record<string, JourneyCheers>;

const cheerOptions: Array<{ id: CheerKey; label: string; icon: LucideIcon }> = [
  { id: 'LOVE', label: '너무 좋아요', icon: Heart },
  { id: 'BEST', label: '최고예요', icon: Star },
  { id: 'HELPFUL', label: '동선이 유용해요', icon: ThumbsUp },
];

const creatorGradeIcons = { SPARKLES: Sparkles, AWARD: Award, STAR: Star, ROUTE: Route, CROWN: Crown };
const getCreatorTier = (copyCount: number, references?: Parameters<typeof creatorGradeRules>[0]) => { const tier = currentCreatorGrade(copyCount, creatorGradeRules(references)); return { ...tier, icon: creatorGradeIcons[tier.icon] }; };
const getNextCreatorTier = (copyCount: number, references?: Parameters<typeof creatorGradeRules>[0]) => creatorGradeRules(references).find(tier => tier.min > copyCount) ?? null;

const primaryIcons: Record<string, LucideIcon> = { home: House, together: Users, travel: Route, saved: Bookmark, my: CircleUserRound };
const tabItems = primaryTabs.map(item => ({ ...item, icon: primaryIcons[item.id] }));

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
    if (!Array.isArray(stored)) return [...defaultComments, ...sampleJournalComments];
    const ids = new Set(stored.map((comment) => comment.id));
    return [...defaultComments, ...sampleJournalComments].filter((comment) => !ids.has(comment.id)).concat(stored);
  } catch {
    return [...defaultComments, ...sampleJournalComments];
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
const isTogetherRoute = (value: unknown): boolean => typeof value === 'string' && /^(?:together(?:-(?:find|plan(?:-trip)?|calendar|tasks|invites|shares|share-[A-Za-z0-9_-]+))?|group(?:-invite)?-[A-Za-z0-9_-]+|activity-[A-Za-z0-9_-]+|groupchat-[A-Za-z0-9_-]+|activitychat-[A-Za-z0-9_-]+|groupsummary-[A-Za-z0-9_-]+|activitysummary-[A-Za-z0-9_-]+)$/.test(value);
const isSpotlogNavigationState = (value: unknown): value is SpotlogNavigationState => {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<SpotlogNavigationState>;
  return state.spotlog === true
    && typeof state.depth === 'number'
    && ['home', 'travel', 'my', 'appointments', 'records', 'community', 'discover', 'together', 'offline', 'trips', 'saved', 'profile', 'photo-stories', 'error', ...(import.meta.env.DEV ? ['style-guide', 'errors'] : [])].includes(String(state.tab))
    && (state.tab !== 'error' || isErrorKind(state.errorKind))
    && (state.tab !== 'together' || state.togetherRoute == null || isTogetherRoute(state.togetherRoute))
    && ['VIDEO', 'GUIDE', 'PHOTO'].includes(String(state.placeView))
    && (state.homeTopic == null || ['recommended', 'places', 'groups', 'trips'].includes(state.homeTopic))
    && (state.discoveryHome == null || typeof state.discoveryHome.region === 'string' && typeof state.discoveryHome.query === 'string'
      && ['recommended', 'meetups', 'groups', 'places', 'trips'].includes(state.discoveryHome.view)
      && (state.discoveryHome.purpose === undefined || ['FOOD','CAFE','WALK','CULTURE','FAMILY','TRAVEL'].includes(state.discoveryHome.purpose))
      && (state.discoveryHome.useMyRegion === undefined || typeof state.discoveryHome.useMyRegion === 'boolean')
      && (state.discoveryHome.travelRegion === undefined || typeof state.discoveryHome.travelRegion === 'string')
      && (state.discoveryHome.travelQuery === undefined || typeof state.discoveryHome.travelQuery === 'string'))
    && (state.appointmentRange === undefined || ['upcoming','undated','past'].includes(state.appointmentRange))
    && (state.recordsSection === undefined || ['activities','journals'].includes(state.recordsSection))
    && (state.mySection === undefined || ['schedule','groups','travel','records'].includes(state.mySection))
    && (state.calendarView === undefined || Boolean(state.calendarView && typeof state.calendarView.month === 'string'
      && /^\d{4}-(0[1-9]|1[0-2])$/.test(state.calendarView.month) && typeof state.calendarView.date === 'string'
      && (state.calendarView.date === '' || validCalendarDay(state.calendarView.date) && state.calendarView.date.startsWith(`${state.calendarView.month}-`))))
    && (state.placeKind == null || browsePlaceKinds.includes(state.placeKind))
    && (state.placeRegion == null || typeof state.placeRegion === 'string')
    && (state.placeDistrict == null || typeof state.placeDistrict === 'string')
    && (state.placeQuery == null || typeof state.placeQuery === 'string')
    && (state.detailDay == null || (Number.isInteger(state.detailDay) && state.detailDay > 0));
};
const spotlogNavigationUrl = (state: SpotlogNavigationState) => {
  const screen = state.tab === 'error' ? `error-${state.errorKind ?? 500}` : detailScreen(state)
    ?? (state.tab === 'together' ? state.togetherRoute ?? 'together'
        : state.tab === 'discover'
          ? `places-${state.placeView.toLowerCase()}${state.placeView === 'GUIDE' && state.placeKind && state.placeKind !== 'ALL' ? `-${state.placeKind.toLowerCase()}` : ''}`
          : state.tab === 'my' || legacyMySection(state.tab, state.appointmentRange) ? myRoute(state.mySection ?? legacyMySection(state.tab, state.appointmentRange) ?? 'schedule')
          : state.tab === 'home' && state.discoveryHome ? state.discoveryHome.view === 'recommended' ? 'home' : `home-${state.discoveryHome.view}`
            : state.tab === 'home' && state.homeTopic && state.homeTopic !== 'recommended' ? `home-${state.homeTopic}` : state.tab);
  return `${window.location.pathname}${window.location.search}#${encodeURIComponent(screen)}`;
};
const navigationStateFromHash = (): SpotlogNavigationState => {
  const { screen, error } = readErrorRoute(window.location.hash);
  const base: SpotlogNavigationState = { spotlog: true, depth: 0, tab: 'home', placeView: 'GUIDE', placeKind: 'ALL', journeyId: null, templateId: null, editorId: null };
  if (error !== undefined) return { ...base, tab: 'error', errorKind: error };
  if (isTravelRootRoute(screen)) return { ...base, tab: 'travel' };
  const section = mySectionForRoute(screen);
  if (section) return { ...base, tab: 'my', mySection: section };
  if (isTogetherRoute(screen)) return { ...base, tab: 'together', togetherRoute: screen };
  if (/^home-(recommended|places|groups|trips|meetups)$/.test(screen)) return { ...base, homeTopic: screen === 'home-meetups' ? 'recommended' : screen.slice(5) as HomeTopic, discoveryHome: { region: '', query: '', view: screen.slice(5) as DiscoveryHomeView, useMyRegion: true } };
  if (screen === 'places-guide') return { ...base, tab: 'discover', placeView: 'GUIDE' };
  if (screen.startsWith('places-guide-')) {
    const kind = screen.slice('places-guide-'.length).toUpperCase() as BrowsePlaceKind;
    if (browsePlaceKinds.includes(kind)) return { ...base, tab: 'discover', placeView: 'GUIDE', placeKind: kind };
  }
  if (screen === 'places-video') return { ...base, tab: 'discover', placeView: 'VIDEO' };
  if (screen === 'places-photo') return { ...base, tab: 'discover', placeView: 'PHOTO' };
  if (screen === 'photo-stories') return { ...base, tab: 'photo-stories' };
  if (screen === 'style-guide' && import.meta.env.DEV) return { ...base, tab: 'style-guide' };
  if (screen === 'errors' && import.meta.env.DEV) return { ...base, tab: 'errors' };
  if (['home', 'appointments', 'records', 'community', 'trips', 'saved', 'profile', 'offline'].includes(screen)) return { ...base, tab: screen as Tab };
  if (screen.startsWith('journey-') && screen.length > 'journey-'.length) return { ...base, journeyId: screen.slice('journey-'.length) };
  if (screen.startsWith('recommendation-') && screen.length > 'recommendation-'.length) return { ...base, templateId: screen.slice('recommendation-'.length) };
  if (screen.startsWith('edit-') && screen.length > 'edit-'.length) return { ...base, tab: 'trips', editorId: screen.slice('edit-'.length) };
  return { ...base, tab: 'error', errorKind: 404 };
};
const navigationStateMatchesHash = (state: SpotlogNavigationState) => spotlogNavigationUrl(state).endsWith(window.location.hash || '#home')
  || legacyMyHashMatches(state.tab, window.location.hash, Boolean(state.journeyId || state.templateId || state.editorId));
const canonicalNavigationState = (state: SpotlogNavigationState): SpotlogNavigationState => {
  const section = legacyMySection(state.tab, state.appointmentRange);
  if (state.tab === 'home' && state.discoveryHome?.view === 'trips' && !detailScreen(state)) {
    return { ...state, tab: 'travel', discoveryHome: { ...state.discoveryHome, view: 'recommended', travelQuery: state.discoveryHome.travelQuery ?? state.discoveryHome.query } };
  }
  return section ? { ...state, tab: 'my', mySection: section } : state;
};

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

// Prefer the verified photo/content version for the same place without deleting legacy IDs or saves.
const aiCandidateKey = (place: Place) => `${place.area.split(/\s+/)[0]}:${place.name.replace(/\s+/g, '')}`;
const officialCandidateKeys = new Set(publicTourismPlaces.map(aiCandidateKey));
const aiPlaceCandidates = [...publicTourismPlaces, ...placeCatalog.filter((place) => !officialCandidateKeys.has(aiCandidateKey(place)))];

const scrollCarouselItem = (track: HTMLDivElement | null, index: number, behavior: ScrollBehavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth') => {
  const item = track?.children.item(index) as HTMLElement | null;
  if (!track || !item) return;
  track.scrollTo({ left: item.offsetLeft - track.offsetLeft, behavior });
};

function useManualHomeCarousel(ids: string[], memory: HomeViewMemory, key: 'recommendationId' | 'guideId', visible: boolean) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, ids.indexOf(memory[key] ?? '')));
  const itemCount = ids.length;
  const signature = ids.join('\u0000');

  const goTo = (requestedIndex: number) => {
    if (!itemCount) return;
    const nextIndex = (requestedIndex + itemCount) % itemCount;
    memory[key] = ids[nextIndex];
    setActiveIndex(nextIndex);
    scrollCarouselItem(trackRef.current, nextIndex);
  };

  useEffect(() => {
    if (!visible) return;
    const next = Math.max(0, ids.indexOf(memory[key] ?? ''));
    setActiveIndex(next);
    const frame = requestAnimationFrame(() => scrollCarouselItem(trackRef.current, next, 'instant'));
    return () => cancelAnimationFrame(frame);
  }, [signature, visible]);

  const syncIndex = () => {
    const track = trackRef.current;
    if (!visible || !track?.clientWidth || !track.children.length) return;
    const items = Array.from(track.children) as HTMLElement[];
    const nearest = items.reduce((best, item, index) => Math.abs(item.offsetLeft - track.offsetLeft - track.scrollLeft) < Math.abs(items[best].offsetLeft - track.offsetLeft - track.scrollLeft) ? index : best, 0);
    memory[key] = ids[nearest];
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

const publicPlaceBaseline = placeCatalog.map(place => ({ ...place, photos: getPlacePhotos(place, true) }));

export default function App({ accountAdapter }: { accountAdapter?: SocialAccountAdapter } = {}) { useConsumerDensity(); return <LocaleProvider><AccountProvider adapter={accountAdapter}><CustomerErrorBoundary><PublicReviewProvider baseline={publicPlaceBaseline}><SpotlogApp /></PublicReviewProvider></CustomerErrorBoundary></AccountProvider></LocaleProvider>; }

function SpotlogApp() {
  const account = useAccount()!;
  const copy=useUiCopy();
  const { locale } = useLocale();
  const publicReview = usePublicReview(), placeCatalog = publicReview.catalog;
  const togetherViewer = account.session.state === 'SIGNED_IN' ? { id: account.session.user.id, name: account.session.user.displayName } : null;
  const togetherRepository = useMemo(() => createTogetherRepository(togetherViewer?.id ?? '', togetherViewer?.name ?? '', placeCatalog), [togetherViewer?.id]);
  const togetherState = useSyncExternalStore(togetherRepository.subscribe, togetherRepository.getSnapshot, togetherRepository.getSnapshot);
  const regionOwner = togetherViewer?.id ?? 'guest-device';
  const regionOwnerRef = useRef(regionOwner); regionOwnerRef.current = regionOwner;
  const [regionPreferences, setRegionPreferences] = useState(() => readMyRegions(myRegionsStorage(), regionOwner));
  const currentRegionPreferences = regionPreferences.state.owner === regionOwner ? regionPreferences : readMyRegions(myRegionsStorage(), regionOwner);
  const myRegion = activeRegion(currentRegionPreferences.state);
  const myRegionLabel = myRegion ? [myRegion.region, myRegion.district].filter(Boolean).join(' ') : '';
  const [myRegionsOpen, setMyRegionsOpen] = useState(false);
  useEffect(() => {
    setRegionPreferences(readMyRegions(myRegionsStorage(), regionOwner)); setMyRegionsOpen(false);
    const reload = (event: StorageEvent) => { if (event.key === null || event.key === myRegionStorageKey(regionOwner)) setRegionPreferences(readMyRegions(myRegionsStorage(), regionOwner)); };
    window.addEventListener('storage', reload); return () => window.removeEventListener('storage', reload);
  }, [regionOwner]);
  const [discoveryHome, setDiscoveryHome] = useState<DiscoveryMemory>({ region: '', query: '', view: 'recommended', useMyRegion: true });
  const [appointmentRange, setAppointmentRange] = useState<AppointmentRange>('upcoming');
  const [recordsSection, setRecordsSection] = useState('activities');
  const [mySection, setMySection] = useState<MySection>('schedule');
  const [calendarView, setCalendarView] = useState<{ month: string; date: string }>();
  const [appointmentCreating, setAppointmentCreating] = useState(false);
  const [appointmentDraft, setAppointmentDraft] = useState<AppointmentInput>({ title: '', date: '', kind: 'FRIENDS' });
  const [discoveryPlace, setDiscoveryPlace] = useState<Place | null>(null);
  const [travelRecommendationsOpen, setTravelRecommendationsOpen] = useState(false);
  useEffect(() => { setAppointmentCreating(false); setAppointmentDraft({ title: '', date: '', kind: 'FRIENDS' }); setDiscoveryPlace(null); }, [togetherViewer?.id]);
  const liveTemplates = useMemo(() => [...new Map([...homeTripTemplates, ...publicReview.operatingTemplates].map(t => [t.id,t])).values()].map(template => ({ ...template, cover: publicReview.state.withdrawnImages.includes(template.cover) ? '' : template.cover, places: template.places.flatMap(place => { const current = placeCatalog.find(p => p.id === place.id); return current ? [current] : []; }) })).filter(t => t.places.length > 0), [placeCatalog, publicReview]);
  const homePublicTemplates = useMemo(() => reviewExposureOrder(liveTemplates, 'HOME_TRIP', publicReview.state, publicReview.now), [liveTemplates, publicReview]);
  const aiPlaceCandidates = useMemo(() => { const official = placeCatalog.filter(p => publicTourismPlaces.some(o => o.id === p.id)); const keys = new Set(official.map(aiCandidateKey)); return [...official, ...placeCatalog.filter(p => !keys.has(aiCandidateKey(p)))]; }, [placeCatalog]);
  const [tab, setTab] = useState<Tab>('home');
  const homeIsTravel = tab === 'travel';
  const homeRegion = homeIsTravel ? (discoveryHome.travelRegion ?? (discoveryHome.useMyRegion === undefined ? discoveryHome.region : '')) : discoveryHome.useMyRegion === true ? myRegion?.region ?? '' : discoveryHome.region;
  const homeDistrict = !homeIsTravel && discoveryHome.useMyRegion === true ? myRegion?.district ?? '' : '';
  const [homeTopic, setHomeTopic] = useState<HomeTopic>('recommended');
  const homeScrollTop = useRef<Record<HomeTopic, number>>({ recommended: 0, places: 0, groups: 0, trips: 0 });
  const homeMemory = useRef<HomeViewMemory>({ placeKind: 'ALL', groupRegion: { value: '' } });
  const [togetherRoute, setTogetherRoute] = useState('together');
  useEffect(() => {
    // The hash is already restored when App remounts after first login.
    // Reading it avoids discarding the preview during the initial home render.
    const plannerRoute = window.location.hash.match(/^#(together-plan(?:-trip)?)$/)?.[1];
    retainCreationHandoff(plannerRoute);
  }, [tab, togetherRoute]);
  const [discoveryFilters, setDiscoveryFilters] = useState<GroupDiscoveryFilters>({ useMyRegion: true });
  const effectiveDiscoveryFilters = discoveryFilters.useMyRegion === true ? { ...discoveryFilters, region: myRegion?.region ?? '', district: myRegion?.district ?? '' } : discoveryFilters;
  const [appMenuOpen, setAppMenuOpen] = useState(false);
  const [interestPlaceKind, setInterestPlaceKind] = useState<PlaceKind | null>(null);
  const [errorKind, setErrorKind] = useState<ErrorKind>(500);
  const [savedIds, setSavedIds] = useLocalState<string[]>(storageKeys.saved, readSavedIds);
  const [allJourneys, persistJourneys] = useLocalState<Journey[]>(storageKeys.journeys, readJourneys);
  const [recentTripId, setRecentTripId] = useLocalState<string | null>(RECENT_TRIP_KEY, () => JSON.parse(localRepository.getItem(RECENT_TRIP_KEY) ?? 'null'));
  const journeys = useMemo(() => [...new Map([...allJourneys, ...publicReview.operatingJourneys].filter(journey => !journey.trash && (journey.visibility !== 'PUBLIC' || !publicReview.state.journalModeration.some(m => m.id === journey.id && m.state !== 'VISIBLE'))).map(journey => [journey.id, restrictPublicJourneyMedia(journey, publicReview.state)])).values()], [allJourneys, publicReview]);
  const homePublicJournals = useMemo(() => reviewExposureOrder(journeys.filter(isPublicHomeJournal), 'HOME_JOURNAL', publicReview.state, publicReview.now), [journeys, publicReview]);
  const [trashOpen, setTrashOpen] = useState(false);
  const [trashTarget, setTrashTarget] = useState<string | null>(null);
  const [guideDay, setGuideDay] = useState<number | null>(null);
  const setJourneys = (action: Journey[] | ((current: Journey[]) => Journey[])) => {
    let removedOfflineIds: string[] = [];
    const saved = persistJourneys(current => {
      const next = (typeof action === 'function' ? action(current) : action).map(journey => normalizePlan(normalizeVisits({ ...journey, purpose: journey.purpose ?? (journey.isMine && !current.some(previous => previous.id === journey.id) ? 'PLAN' : undefined) })));
      const remaining = new Set(next.filter(journey => journey.isMine && journey.purpose === 'PLAN' && journey.visibility === 'PRIVATE' && !journey.trash).map(journey => journey.id));
      removedOfflineIds = current.filter(journey => journey.isMine && journey.purpose === 'PLAN' && !remaining.has(journey.id)).map(journey => journey.id);
      return next;
    });
    if (saved) for (const id of removedOfflineIds) void removeOfflineTrip(id).catch(() => {});
    return saved;
  };
  const [storageIssue, setStorageIssue] = useState(localRepository.getIssue());
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<HomeTripTemplate | null>(null);
  const [requestedTemplateId, setRequestedTemplateId] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState<TripSearchFilters>({ destination: '', duration: 'ALL' });
  const [placeView, setPlaceView] = useState<PlaceView>('GUIDE');
  const [guideKind, setGuideKind] = useState<BrowsePlaceKind>('ALL');
  const [guideEntry, setGuideEntry] = useState(0);
  const guideScrollTop = useRef(0);
  const [guideSearch, setGuideSearch] = useState<PlaceDirectorySearch>({ region: '', query: '' });
  const [editingJourneyId, setEditingJourneyId] = useState<string | null>(null);
  const [chatbotEditorEntry, setChatbotEditorEntry] = useState<{ journeyId: string; day: number; entry?: ChatbotEntry; requestId: string } | null>(null);
  const [chatbotSocialEntry, setChatbotSocialEntry] = useState<{ journeyId: string; entry: 'journey-comment' | 'journey-cheer'; requestId: string } | null>(null);
  const [chatbotProfileEntry, setChatbotProfileEntry] = useState<{ entry: 'profile-summary' | 'profile-activity'; requestId: string } | null>(null);
  const [chatbotPersonalPlace, setChatbotPersonalPlace] = useState<{ journeyId: string; day: number; kind: PlaceKind } | null>(null);
  const [creating, setCreating] = useState(false);
  const [planCreating, setPlanCreating] = useState(false);
  const [tripCreationOpen, setTripCreationOpen] = useState(false);
  const [planCreationDraft, setPlanCreationDraft] = useLocalState<PlanCreationDraft | null>(PLAN_CREATION_KEY, () => JSON.parse(localRepository.getItem(PLAN_CREATION_KEY) ?? 'null'));
  const [planChoices, setPlanChoices] = useState<Place[] | null>(null);
  const [placementPlaces, setPlacementPlaces] = useState<Place[] | null>(null);
  const [placeUse, setPlaceUse] = useState<{ placeId: string; owner: string } | null>(null);
  const pendingSheetNavigation = useRef<(() => void) | null>(null);
  useEffect(() => {
    setPlaceUse(null); pendingSheetNavigation.current?.(); pendingSheetNavigation.current = null;
    return () => { pendingSheetNavigation.current?.(); pendingSheetNavigation.current = null; };
  }, [regionOwner]);
  const [aiTravelOpen, setAiTravelOpen] = useState(false);
  const aiTravelDraft = useRef<AiPlannerDraft | null>(null);
  const [savedTripDraft, setSavedTripDraft] = useLocalState<SavedTripDraft>(SAVED_TRIP_DRAFT_KEY, () => JSON.parse(localRepository.getItem(SAVED_TRIP_DRAFT_KEY) ?? JSON.stringify(newSavedTripDraft())));
  const [detailDay, setDetailDay] = useState<number | null>(null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<number | undefined>(undefined);
  const toastSheet = useRef<string | null>(null);
  const clearToast = useCallback(() => { window.clearTimeout(toastTimer.current); setToast(''); }, []);
  useEffect(() => {
    const opened = (event: Event) => {
      if (toastSheet.current !== (event as CustomEvent<string>).detail) clearToast();
    };
    window.addEventListener(SHEET_OPEN_EVENT, opened);
    return () => { window.removeEventListener(SHEET_OPEN_EVENT, opened); window.clearTimeout(toastTimer.current); };
  }, [clearToast]);
  const [profile, setProfile] = useLocalState<CreatorProfile>(storageKeys.profile, readCreatorProfile);
  const [comments, setComments] = useLocalState<JourneyComment[]>(storageKeys.comments, readComments);
  const [cardSocial,setCardSocial] = useLocalState<CardSocialStore>(CARD_SOCIAL_KEY,()=>{try{return withSampleCardThreads(JSON.parse(localRepository.getItem(CARD_SOCIAL_KEY)??'{}'));}catch{return withSampleCardThreads({});}});
  const [personalPlaces,setPersonalPlaces]=useLocalState<Place[]>(PLACE_DIRECTORY_KEY,()=>{try{return JSON.parse(localRepository.getItem(PLACE_DIRECTORY_KEY)??'[]');}catch{return [];}});
  const [cheers, setCheers] = useLocalState<CheerStore>(storageKeys.cheers, readCheers);
  const [notificationPreferences, setNotificationPreferences] = useLocalState<NotificationPreferences>(storageKeys.notifications, readNotificationPreferences);
  const [notificationPermission, setNotificationPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const viewedJourneyIds = useRef(new Set<string>());
  const native = isNativeShell();
  const savedPlaces = useMemo(() => { const byId = new Map([...placeCatalog, ...allJourneys.flatMap((journey) => journey.days.flatMap((day) => day.places)),...personalPlaces].map((place) => [place.id, place])); return [...placeCatalog.filter(place => savedIds.includes(place.id)), ...savedIds.filter(id => !placeCatalog.some(place => place.id === id)).map(id => byId.get(id)).filter((place): place is Place => Boolean(place))]; }, [savedIds, allJourneys,personalPlaces,placeCatalog]);
  const ownJourneys = useMemo(() => journeys.filter((journey) => journey.isMine), [journeys]);
  const ownPlans = ownJourneys.filter(isPersonalPlan);
  const selectedTemplateJourney = useMemo(() => selectedTemplate ? previewTemplateJourney(selectedTemplate) : null, [selectedTemplate]);
  const editingTarget = journeys.find((journey) => journey.id === editingJourneyId) ?? null;
  const selectedJourney = selectedTemplateJourney ?? journeys.find((journey) => journey.id === selectedJourneyId) ?? (editingTarget&&isPersonalPlan(editingTarget)?editingTarget:null);
  const editingJourney = editingTarget&&!isPersonalPlan(editingTarget)?editingTarget:null;
  const continuation = useMemo(() => tripContinuation(journeys, recentTripId), [journeys, recentTripId]);
  useEffect(() => { if (selectedJourney && isPersonalPlan(selectedJourney) && selectedJourney.visibility === 'PRIVATE' && recentTripId !== selectedJourney.id) setRecentTripId(selectedJourney.id); }, [selectedJourney?.id, recentTripId]);

  const applyNavigationState = useCallback((state: SpotlogNavigationState) => {
    clearToast();
    const legacySection = legacyMySection(state.tab, state.appointmentRange);
    setTab(legacySection ? 'my' : state.tab);
    setMySection(state.mySection ?? legacySection ?? 'schedule');
    setCalendarView(state.calendarView);
    setHomeTopic(state.homeTopic ?? 'recommended');
    const restoredDiscovery = state.discoveryHome ?? { region: '', query: '', view: 'recommended' as const, useMyRegion: true };
    // Older history used region for travel as well; preserve that destination before adopting a home area.
    setDiscoveryHome(restoredDiscovery.useMyRegion === undefined && restoredDiscovery.travelRegion === undefined
      ? { ...restoredDiscovery, travelRegion: restoredDiscovery.region } : restoredDiscovery);
    setAppointmentRange(state.appointmentRange ?? 'upcoming');
    setRecordsSection(state.recordsSection ?? 'activities');
    setAppointmentCreating(false);
    setDiscoveryPlace(null);
    setTogetherRoute(state.togetherRoute ?? 'together');
    setDiscoveryFilters(state.discoveryFilters ?? { useMyRegion: true });
    setAppMenuOpen(false);
    setInterestPlaceKind(null);
    setErrorKind(state.errorKind ?? 500);
    setPlaceView(state.placeView);
    setGuideKind(state.placeKind ?? 'ALL');
    setGuideSearch({ region: state.placeRegion ?? '', district: state.placeDistrict || undefined, query: state.placeQuery ?? '' });
    setSelectedJourneyId(state.journeyId);
    setSelectedTemplate(state.templateId ? liveTemplates.find((template) => template.id === state.templateId) ?? null : null);
    setRequestedTemplateId(state.templateId);
    setEditingJourneyId(state.editorId);
    setCreating(false);
    setPlanCreating(false);
    setTripCreationOpen(false);
    setPlacementPlaces(null);
    setAiTravelOpen(false);
    setTrashOpen(false);
    setTrashTarget(null);
    setGuideDay(null);
    setDetailDay(state.detailDay ?? null);
  }, [clearToast]);

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
      errorKind: (next.tab ?? tab) === 'error' ? next.errorKind ?? errorKind : undefined,
      togetherRoute: (next.tab ?? tab) === 'together' ? next.togetherRoute ?? togetherRoute : undefined,
      discoveryFilters: next.discoveryFilters ?? discoveryFilters,
      homeTopic: next.homeTopic ?? homeTopic,
      discoveryHome: next.discoveryHome ?? discoveryHome,
      appointmentRange: next.appointmentRange ?? appointmentRange,
      recordsSection: next.recordsSection ?? recordsSection,
      mySection: next.mySection ?? mySection,
      calendarView: next.calendarView ?? calendarView,
      placeKind: next.placeKind ?? guideKind,
      placeRegion: next.placeRegion ?? guideSearch.region,
      placeDistrict: Object.prototype.hasOwnProperty.call(next, 'placeDistrict') ? next.placeDistrict : guideSearch.district,
      placeQuery: next.placeQuery ?? guideSearch.query,
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
    const initial = canonicalNavigationState(isSpotlogNavigationState(window.history.state) && navigationStateMatchesHash(window.history.state)
      ? window.history.state
      : navigationStateFromHash());
    window.history.replaceState(initial, '', spotlogNavigationUrl(initial));
    applyNavigationState(initial);
    notifyNavigationState(initial.depth > 0);
    const handlePopState = (event: PopStateEvent) => {
      // A sheet's internal disclosure owns its back/forward transition. Applying
      // page navigation here would discard the still-open trip/AI form.
      if (event.state?.spotlogSheet && hasActiveSheet()) return;
      const state = canonicalNavigationState(isSpotlogNavigationState(event.state)
        ? event.state
        : navigationStateFromHash());
      if (!isSpotlogNavigationState(event.state) || state !== event.state) window.history.replaceState(state, '', spotlogNavigationUrl(state));
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
  }, [tab, homeTopic, mySection, selectedJourneyId, selectedTemplate, editingJourneyId, placeView, togetherRoute]);

  const showToast = (message: string) => {
    window.clearTimeout(toastTimer.current);
    toastSheet.current = document.querySelector('[data-spotlog-sheet]')?.getAttribute('data-spotlog-sheet') ?? null;
    setToast(localRepository.getIssue() ?? message);
    toastTimer.current = window.setTimeout(() => setToast(''), 2200);
  };
  useEffect(() => subscribePreviewNotificationResult(result => {
    showToast(result.sent ? copy("테스트 알림을 예약했어요. 잠시 후 기기에서 확인해 주세요.") : result.reason === 'permission' ? copy("기기 알림 권한이 꺼져 있어요. 설정에서 허용한 뒤 다시 시도해 주세요.") : copy("테스트 알림을 예약하지 못했어요. 잠시 후 다시 시도해 주세요."));
  }), [copy]);
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
  const resumeTrip = (target: TripContinuation) => {
    const current = journeys.find(journey => journey.id === target.journey.id && isPersonalPlan(journey) && journey.visibility === 'PRIVATE');
    if (!current) { showToast(copy("이어갈 여행을 다시 확인해 주세요.")); return; }
    if (!target.place) { openMyJourney(current.id, target.day.day); return; }
    try {
      const next = rememberTravelPosition(current, target.day.dayId!, target.place?.visitId);
      if (!setJourneys(previous => previous.map(journey => journey.id === next.id ? next : journey))) return;
      openMyJourney(next.id, target.day.day);
    } catch { showToast(copy("여행의 방문 위치가 바뀌었어요. 다시 확인해 주세요.")); }
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
    const journey: Journey = {...buildPersonalPlan([],1,title,profile.displayName),planStage:'DRAFT',region};
    if (!setJourneys((current) => [journey, ...current])) return;
    openMyJourney(journey.id);
    showToast(copy("새 여행을 만들었습니다."));
  };

  const createSavedTrip = (draft: Journey): string | null => {
    const created = initializeCreatedPlan(draft, profile.displayName);
    if (!setJourneys(current => current.some(item => item.id === created.id) ? current : [created, ...current])) return null;
    setSavedTripDraft(newSavedTripDraft());
    openMyJourney(created.id);
    showToast(copy(created.planStage === 'READY' ? '내 여행을 만들었어요. 필요한 곳만 다듬어 보세요.' : '여행 준비를 저장했어요. 후보를 담고 마지막에 확인해요.'));
    return created.id;
  };

  const startRecommendedJourney = (template: HomeTripTemplate) => {
    if (template.publicJourney) {
      const draft = copyPersonalPlan(normalizePlan(normalizeVisits({ ...template.publicJourney, title: template.title, summary: template.summary, cover: template.cover })), profile.displayName);
      if (!setJourneys(current => [draft, ...current])) return;
      openMyJourney(draft.id); showToast(copy("추천 일정을 내 여행으로 가져왔습니다.")); return;
    }
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
    if (updated.visibility === 'PUBLIC' && updated.status === 'PUBLISHED' && !account.requireMember('여행기 공개에는 로그인이 필요해요.')) return false;
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
    if (!message || !account.requireMember('댓글을 등록하려면 로그인이 필요해요.')) return false;
    const myCopyCount = journeys.filter((journey) => journey.isMine).reduce((sum, journey) => sum + journey.saves, 0);
    const comment: JourneyComment = {
      id: `comment-${Date.now()}`,
      journeyId,
      author: account.session.state === 'SIGNED_IN' ? account.session.user.displayName : profile.displayName,
      authorId: account.session.state === 'SIGNED_IN' ? account.session.user.id : undefined,
      body: message.slice(0, 180),
      createdAt: new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(new Date()),
      avatar: undefined,
      authorCopies: myCopyCount,
    };
    if (!setComments((current) => [...current, comment])) return false;
    showToast('이 기기에 댓글 미리보기를 저장했어요. 실제 전송은 서버 연결 후 사용할 수 있어요.');
    return true;
  };

  const toggleJourneyCheer = (journeyId: string, cheer: CheerKey) => {
    if (!account.requireMember('응원을 남기려면 로그인이 필요해요.')) return;
    if (account.session.state !== 'SIGNED_IN') return;
    const actorId = account.session.user.id;
    const selectedPublicJourney = journeys.find(j => j.id === journeyId && j.visibility === 'PUBLIC' && j.status === 'PUBLISHED' && j.purpose !== 'PLAN');
    if (selectedPublicJourney && localPublicReviewEnabled()) try { recordPublicCheer(selectedPublicJourney, actorId, cheer, cheers[journeyId]?.selections?.[actorId] !== cheer); } catch (failure) { showToast(failure instanceof Error ? failure.message : copy("공개 응원 검수 자료를 저장하지 못했어요.")); return; }
    setCheers((current) => {
      const previous = current[journeyId] ?? { LOVE: 0, BEST: 0, HELPFUL: 0 };
      const next = { ...previous, selections: { ...previous.selections } }, selected = previous.selections?.[actorId];
      if (selected === cheer) {
        next[cheer] = Math.max(0, next[cheer] - 1);
        delete next.selections[actorId];
      } else {
        if (selected) next[selected] = Math.max(0, next[selected] - 1);
        next[cheer] += 1;
        next.selections[actorId] = cheer;
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

  const createJournal = (source: Journey, options?: { includePlanned?: boolean }) => {
    try {
      const draft = makeJournalFromPlan(normalizePlan(source), profile.displayName, options);
      if (!setJourneys(current => [draft, ...current])) return;
      editJourney(draft.id);
      const count = draft.days.reduce((total, day) => total + day.places.length, 0);
      showToast(`${count}곳을 별도 비공개 여행기 초안에 담았어요. 개인 메모는 옮기지 않았어요.`);
    } catch (error) { showToast(error instanceof Error ? error.message : copy("여행기 초안을 만들지 못했어요.")); }
  };

  const selectTab = (next: Tab) => {
    const legacySection = legacyMySection(next);
    if (legacySection) { openMySection(legacySection); return; }
    if (next === tab && !selectedJourney && !editingJourney && !(next === 'together' && togetherRoute !== 'together')) return;
    setSelectedJourneyId(null);
    setSelectedTemplate(null);
    setRequestedTemplateId(null);
    setEditingJourneyId(null);
    setTab(next);
    if (next === 'together') setTogetherRoute('together');
    writeNavigationState({ tab: next, togetherRoute: next === 'together' ? 'together' : undefined, journeyId: null, templateId: null, editorId: null, scrollTop: next === 'discover' && placeView === 'GUIDE' ? guideScrollTop.current : 0 });
  };
  const openMySection = (section: MySection) => {
    if (tab === 'my' && mySection === section && !selectedJourney && !editingJourney) return;
    setSelectedJourneyId(null); setSelectedTemplate(null); setRequestedTemplateId(null); setEditingJourneyId(null);
    setTab('my'); setMySection(section);
    writeNavigationState({ tab: 'my', mySection: section, journeyId: null, templateId: null, editorId: null, scrollTop: 0 });
  };
  const changeHomeTopic = (next: HomeTopic) => {
    if (next === homeTopic) return;
    homeScrollTop.current[homeTopic] = document.querySelector('.content')?.scrollTop ?? 0;
    writeNavigationState({ tab: 'home', homeTopic: next, journeyId: null, templateId: null, editorId: null, scrollTop: homeScrollTop.current[next] }, 'replace');
    setHomeTopic(next);
  };
  const openPlaceGuide = (kind?: BrowsePlaceKind, search?: { region?: string; district?: string; query?: string }) => {
    const nextKind = kind ?? guideKind;
    const freshSearch = kind !== undefined || search !== undefined;
    if (!freshSearch && tab === 'discover' && placeView === 'GUIDE' && !selectedJourney && !editingJourney) return;
    setSelectedJourneyId(null);
    setSelectedTemplate(null);
    setRequestedTemplateId(null);
    setEditingJourneyId(null);
    setTab('discover');
    setPlaceView('GUIDE');
    setGuideKind(nextKind);
    const nextSearch = search ? { region: search.region ?? '', ...(search.district ? { district: search.district } : {}), query: search.query ?? '' } : freshSearch ? { region: '', query: '' } : guideSearch;
    setGuideSearch(nextSearch);
    if (freshSearch) setGuideEntry(current => current + 1);
    writeNavigationState({ tab: 'discover', placeView: 'GUIDE', placeKind: nextKind, placeRegion: nextSearch.region, placeDistrict: nextSearch.district, placeQuery: nextSearch.query, journeyId: null, templateId: null, editorId: null, scrollTop: freshSearch ? 0 : guideScrollTop.current });
    if (freshSearch) guideScrollTop.current = 0;
  };
  const changeGuideKind = (kind: BrowsePlaceKind) => {
    if (kind === guideKind) return;
    setGuideKind(kind);
    writeNavigationState({ placeKind: kind, scrollTop: 0 }, 'replace');
    guideScrollTop.current = 0;
    document.querySelector('.content')?.scrollTo({ top: 0, behavior: 'instant' });
  };
  const navigateTogether = (route: string, filters?: GroupDiscoveryFilters) => {
    const section = mySectionForRoute(route);
    if (section) { openMySection(section); return; }
    if (['home', 'travel', 'appointments', 'records', 'trips', 'profile', 'saved', 'community', 'discover', 'offline'].includes(route)) { selectTab(route as Tab); return; }
    if (!isTogetherRoute(route)) return;
    const state = { tab: 'together' as const, togetherRoute: route, discoveryFilters: filters ?? discoveryFilters, journeyId: null, templateId: null, editorId: null, scrollTop: 0 };
    setSelectedJourneyId(null); setSelectedTemplate(null); setRequestedTemplateId(null); setEditingJourneyId(null);
    setTab('together'); setTogetherRoute(route); setAppMenuOpen(false);
    if (filters) setDiscoveryFilters(filters);
    const snapshot = togetherRepository.getSnapshot();
    const invite = togetherRoute.startsWith('group-invite-') ? snapshot.invites.find(item => item.id === togetherRoute.slice('group-invite-'.length)) : undefined;
    const targetActivity = route.startsWith('activity-') ? snapshot.activities.find(item => item.id === route.slice('activity-'.length)) : undefined;
    const returningToInvitedAppointment = Boolean(togetherViewer && invite?.groupId && targetActivity?.groupId === invite.groupId
      && snapshot.groups.some(group => group.id === invite.groupId && group.spaceType === 'ACTIVITY' && group.memberIds.includes(togetherViewer.id) && !group.blockedMemberIds?.includes(togetherViewer.id)));
    const replacePeer = tab === 'together' && (returningToInvitedAppointment || isTogetherWorkspaceSwitch(snapshot, togetherViewer?.id ?? '', togetherRoute, route));
    writeNavigationState(state, replacePeer ? 'replace' : 'push');
  };
  const goTogetherBack = (fallback: string) => {
    if (isSpotlogNavigationState(window.history.state) && window.history.state.depth > 0) { window.history.back(); return; }
    const section = mySectionForRoute(fallback);
    const fallbackTab: Tab = section ? 'my' : ['home', 'trips', 'saved'].includes(fallback) ? fallback as Tab : 'together';
    const state: SpotlogNavigationState = { spotlog: true, depth: 0, tab: fallbackTab, mySection: section, placeView, togetherRoute: isTogetherRoute(fallback) ? fallback : 'together', discoveryFilters, journeyId: null, templateId: null, editorId: null };
    window.history.replaceState(state, '', spotlogNavigationUrl(state));
    applyNavigationState(state); notifyNavigationState(false);
  };
  const navigateMenu = (route: string) => {
    if (route === 'my-regions') setMyRegionsOpen(true);
    else if (route === 'create-trip') setTripCreationOpen(true);
    else if (route === 'ai-trip') navigateTogether('together-plan-trip', { region: homeRegion });
    else if (route === 'recommended-trips') { selectTab('community'); setTravelRecommendationsOpen(true); }
    else if (['profile', 'saved', 'offline', 'my', 'travel'].includes(route)) selectTab(route as Tab);
    else navigateTogether(route);
  };
  const updateDiscoveryHome = (patch: Partial<DiscoveryMemory>) => {
    setDiscoveryHome(current => ({ ...current, ...patch }));
    const current = window.history.state;
    if (isSpotlogNavigationState(current)) {
      const next = { ...current, discoveryHome: { ...(current.discoveryHome ?? discoveryHome), ...patch } };
      window.history.replaceState(next, '', spotlogNavigationUrl(next));
    }
  };
  const openHomeTravel = (duration: HomeTravelDuration) => {
    const next = { ...discoveryHome, travelRegion: homeRegion, travelQuery: discoveryHome.query, travelDuration: duration };
    setDiscoveryHome(next); setTab('travel'); setSelectedJourneyId(null); setSelectedTemplate(null); setEditingJourneyId(null);
    writeNavigationState({ tab: 'travel', discoveryHome: next, journeyId: null, templateId: null, editorId: null, scrollTop: 0 });
  };
  const openPublicJournals = (duration: HomeTravelDuration, region = homeRegion, query = discoveryHome.query, district = homeDistrict) => {
    const durations: Record<HomeTravelDuration, TripDurationFilter> = { ALL: 'ALL', DAY: 'DAY_TRIP', TWO: 'ONE_NIGHT', THREE: 'TWO_NIGHTS', LONG: 'THREE_PLUS' };
    setSearchDraft({ destination: query, region, district, duration: durations[duration], category: 'TRAVELER' });
    selectTab('community');
  };
  const openAppointmentCreation = () => {
    if (!togetherViewer) { account.openAccount('login', '로그인하면 비공개 약속을 만들고 친구를 초대할 수 있어요.'); return; }
    setAppointmentCreating(true);
  };
  const afterPlaceSheet = (navigate: () => void) => {
    pendingSheetNavigation.current?.();
    const owner = regionOwnerRef.current, origin = window.history.state;
    const locationKey = (value: unknown) => {
      const state = value && typeof value === 'object' ? value as Partial<SpotlogNavigationState> : {};
      return JSON.stringify([state.tab, state.mySection, state.togetherRoute, state.journeyId, state.templateId, state.editorId, state.placeView]);
    };
    pendingSheetNavigation.current = afterSheetClose(window, state => regionOwnerRef.current === owner && locationKey(state) === locationKey(origin), () => { pendingSheetNavigation.current = null; navigate(); });
  };
  const createAppointment = (input: AppointmentInput): boolean => {
    if (!togetherViewer) return false;
    let id = '';
    const saved = togetherRepository.update(draft => { id = createStandaloneAppointment(draft, togetherViewer.id, input, savedPlaces).id; });
    if (!saved) { showToast(togetherRepository.getError() || '약속을 저장하지 못했어요.'); return false; }
    afterPlaceSheet(() => navigateTogether(`activity-${id}`));
    setAppointmentCreating(false); setAppointmentDraft({ title: '', date: '', kind: 'FRIENDS' });
    return true;
  };
  const openMyActivity = (activityId: string) => {
    if (!togetherViewer) return;
    const current = togetherRepository.getSnapshot();
    if (![...memberAppointments(current, togetherViewer.id, 'upcoming'), ...memberAppointments(current, togetherViewer.id, 'undated')].some(item => item.id === activityId)) { showToast('현재 참여할 수 있는 약속을 다시 확인해 주세요.'); return; }
    navigateTogether(`activity-${activityId}`);
  };
  const openMyChat = (groupId: string, activityId?: string) => {
    const current = togetherRepository.getSnapshot(), group = current.groups.find(item => item.id === groupId);
    if (!togetherViewer || !group || group.archived || !group.memberIds.includes(togetherViewer.id) || group.blockedMemberIds?.includes(togetherViewer.id)) return;
    if (activityId && !current.activities.some(item => item.id === activityId && item.groupId === groupId && item.status === 'PLANNED')) return;
    navigateTogether(activityId ? `activitychat-${activityId}` : `groupchat-${groupId}`);
  };
  const openMyPlan = (id: string) => {
    const target = togetherViewer && selectMemberHomeSchedule(togetherRepository.getSnapshot(), togetherViewer.id, ownPlans);
    if (target && target.kind === 'PLAN' && target.id === id) openJourney(id);
    else showToast('현재 여행 일정을 다시 확인해 주세요.');
  };
  const startPlaceAppointment = (place: Place) => {
    setPlaceUse(null);
    if (!togetherViewer) { account.openAccount('login', '로그인하면 선택한 장소에서 약속을 만들 수 있어요.'); return; }
    setAppointmentDraft(current => ({ ...current, title: current.title || `${place.name}에서 만나요`, placeId: place.id, meetingPoint: place.name }));
    setAppointmentCreating(true);
  };
  const sendPlaceProposal = (target: PlaceProposalTarget, expectedVersion: string, requestId: string): string | null => {
    if (!placeUse || placeUse.owner !== regionOwnerRef.current || !togetherViewer) return '로그인 상태를 다시 확인해 주세요.';
    const currentPlace = savedPlaces.find(place => place.id === placeUse.placeId);
    if (!currentPlace) return '저장한 장소가 바뀌었어요. 목록에서 다시 선택해 주세요.';
    const saved = togetherRepository.update(draft => { proposeSavedPlace(draft, togetherViewer.id, target, currentPlace, expectedVersion, requestId, placeCatalog.map(place => place.id)); });
    if (!saved) return togetherRepository.getError() || '제안하지 못했어요. 내용을 유지했어요.';
    afterPlaceSheet(() => {
      const current = togetherRepository.getSnapshot();
      if (!placeProposalDestinations(current, togetherViewer.id).some(item => item.groupId === target.groupId && item.activityId === target.activityId)) return;
      navigateTogether(target.activityId ? `activitychat-${target.activityId}` : `groupchat-${target.groupId}`);
    });
    setPlaceUse(null); showToast('선택한 대화방에 장소를 제안했어요.');
    return null;
  };
  const openPublicGroup = (groupId: string, activityId?: string) => {
    const current = togetherRepository.getSnapshot();
    const intent = activityId ? createPublicActivityIntent(current, groupId, activityId) : undefined;
    if (activityId && (!intent || !resolvePublicActivityIntent(current, intent, togetherViewer?.id))) { showToast('공개 약속 안내가 바뀌었어요. 모임에서 다시 확인해 주세요.'); return; }
    navigateTogether(`group-${groupId}`, { region: homeRegion, district: homeDistrict, query: discoveryHome.query, publicActivityIntent: intent });
  };
  const changeDiscoveryFilters = (filters: GroupDiscoveryFilters) => {
    setDiscoveryFilters(filters);
    if (isSpotlogNavigationState(window.history.state)) window.history.replaceState({ ...window.history.state, discoveryFilters: filters }, '');
  };
  const togetherDetail = tab === 'together' && !['together', 'together-find'].includes(togetherRoute);

  useEffect(() => { if (tab === 'error' && errorKind === 401 && account.session.state === 'SIGNED_IN') goBack(); }, [tab, errorKind, account.session.state]);
  const missingTarget = Boolean((selectedJourneyId && !selectedJourney) || (editingJourneyId && !editingTarget) || (requestedTemplateId && !selectedJourneyId && !editingJourneyId && !liveTemplates.some(template => template.id === requestedTemplateId)));
  const openErrorReview = () => selectTab('errors');
  if (tab === 'error' || missingTarget || tab === 'errors') return <main className="app-shell detail-open"><section className="content">
    {tab === 'errors' && import.meta.env.DEV ? <ErrorPagesReview onHome={() => selectTab('home')} onOpen={kind => { setTab('error'); setErrorKind(kind); writeNavigationState({ tab: 'error', errorKind: kind, journeyId: null, templateId: null, editorId: null }); }} /> : <ErrorPage kind={missingTarget ? 404 : errorKind} onHome={() => selectTab('home')} onBack={goBack} onRetry={() => window.location.reload()} onLogin={() => account.openAccount('login', '로그인한 뒤 이전 화면에서 다시 이용해 주세요.')} onReview={import.meta.env.DEV ? openErrorReview : undefined} />}
  </section></main>;

  return (
    <AppMenuContext.Provider value={() => setAppMenuOpen(true)}><ReportProvider journeys={selectedJourney && !journeys.some(journey => journey.id === selectedJourney.id) ? [...journeys, selectedJourney] : journeys}><CardSocialProvider store={cardSocial} save={setCardSocial} user={{id:account.session.state==='SIGNED_IN'?account.session.user.id:'guest',name:account.session.state==='SIGNED_IN'?account.session.user.displayName:'방문자',avatar:undefined}}><main className={`app-shell tab-${tab} place-${placeView.toLowerCase()} ${selectedJourney || editingJourney || togetherDetail || tab === 'offline' || tab === 'profile' || tab === 'photo-stories' ? 'detail-open' : ''}`}>
      <ChatbotHostController journeys={journeys} catalog={placeCatalog} savedPlaces={savedPlaces} selectedJourney={selectedJourney} selectedDay={detailDay ?? 1} onCreateDraft={(draft, allowUnverified, action) => {
        const created = createChatbotDraftCopy(draft, placeCatalog, profile.displayName, allowUnverified);
        if (!setJourneys(current => [created, ...current])) throw new Error('새 초안을 저장하지 못했어요. 기존 여행은 그대로입니다.');
        openMyJourney(created.id, action.day ?? 1);
        if (action.entry === 'personal-place') setChatbotPersonalPlace({ journeyId: created.id, day: action.day ?? 1, kind: 'LANDMARK' });
        showToast('새 비공개 일정 초안을 추가했어요. 후보와 방문을 확인하고 완료한 뒤 여행기로 기록해 주세요.');
        return { journeyId: created.id };
      }} onNavigate={(action, options) => {
        if (action.journeyId) {
          const target = journeys.find(item => item.id === action.journeyId && !item.trash);
          if (target && action.target === 'journal' && target.isMine) {
            const journal = isPersonalPlan(target) ? makeJournalFromPlan(normalizePlan(target), profile.displayName) : target;
            if (journal.id !== target.id && !setJourneys(current => [journal, ...current])) throw new Error('여행기 초안을 저장하지 못했어요. 원래 일정은 그대로입니다.');
            setChatbotEditorEntry({ journeyId: journal.id, day: action.day ?? 1, entry: action.entry, requestId: crypto.randomUUID() });
            editJourney(journal.id); return;
          }
          if (target && action.entry === 'personal-place' && isPersonalPlan(target)) { openMyJourney(target.id, action.day ?? 1); setChatbotPersonalPlace({ journeyId: target.id, day: action.day ?? 1, kind: options?.placeKind ?? 'LANDMARK' }); return; }
          if (target && isPersonalPlan(target)) { openMyJourney(target.id, action.day ?? 1); return; }
          if (target) { setChatbotSocialEntry(action.entry === 'journey-comment' || action.entry === 'journey-cheer' ? { journeyId: target.id, entry: action.entry, requestId: crypto.randomUUID() } : null); openJourney(target.id); return; }
        }
        setChatbotProfileEntry(action.entry === 'profile-summary' || action.entry === 'profile-activity' ? { entry: action.entry, requestId: crypto.randomUUID() } : null);
        const nextTab: Tab = action.target === 'saved' ? 'saved' : ['trips', 'journal'].includes(action.target) ? 'trips' : ['profile', 'notifications'].includes(action.target) ? 'profile' : ['discover', 'photos', 'videos'].includes(action.target) ? 'discover' : 'community';
        const nextView: PlaceView = action.target === 'photos' ? 'PHOTO' : action.target === 'videos' ? 'VIDEO' : 'GUIDE';
        const next = { spotlog: true as const, depth: 0, tab: nextTab, placeView: nextView, journeyId: null, templateId: null, editorId: null };
        applyNavigationState(next); writeNavigationState(next);
      }} />
      <section className="content">
        {storageIssue && <div className="local-storage-warning" role="alert">{storageIssue}</div>}
        {!selectedJourney && !editingJourney && tab === 'community' && <ScreenHeader title="여행기 둘러보기" leading={<button type="button" aria-label="뒤로" onClick={goBack}><ArrowLeft size={22}/></button>} actions={<><button type="button" className="screen-header__text-action" onClick={() => setTravelRecommendationsOpen(true)}>추천 일정</button><AppMenuButton/></>}/>}
        <div className={placeView !== 'GUIDE' ? 'discovery-pane' : ''} hidden={tab !== 'discover' || Boolean(selectedJourney || editingJourney)}>{placeView === 'GUIDE' ? <PlaceDirectory places={reviewExposureOrder(placeCatalog, 'REGION_GUIDE', publicReview.state, publicReview.now)} references={publicReview.state.references} search={guideSearch} kind={guideKind} savedIds={savedIds} onToggle={toggleSaved} onShare={sharePlace} onBack={goBack} onViewChange={changePlaceView} onApplyFilters={(search, kind) => { setGuideSearch(search); setGuideKind(kind); guideScrollTop.current = 0; writeNavigationState({ placeKind: kind, placeRegion: search.region, placeDistrict: search.district, placeQuery: search.query, scrollTop: 0 }, 'replace'); }} onSearchChange={next => { setGuideSearch(next); writeNavigationState({ placeRegion: next.region, placeDistrict: next.district, placeQuery: next.query, scrollTop: 0 }, 'replace'); }} onKindChange={changeGuideKind} onReset={() => { setGuideKind('ALL'); setGuideSearch({ region: '', query: '' }); guideScrollTop.current = 0; writeNavigationState({ placeKind: 'ALL', placeRegion: '', placeDistrict: undefined, placeQuery: '', scrollTop: 0 }, 'replace'); }}/> : <Discover key={guideEntry} view={placeView} onViewChange={changePlaceView} guideKind={guideKind} onResetSearch={() => { setGuideKind('ALL'); setGuideSearch({ region: '', query: '' }); guideScrollTop.current = 0; writeNavigationState({ placeKind: 'ALL', placeRegion: '', placeDistrict: undefined, placeQuery: '', scrollTop: 0 }, 'replace'); }} search={guideSearch} onSearchChange={next => { const scoped = { ...next, district: next.region === guideSearch.region ? guideSearch.district : undefined }; setGuideSearch(scoped); writeNavigationState({ placeRegion: scoped.region, placeDistrict: scoped.district, placeQuery: scoped.query, scrollTop: 0 }, 'replace'); }} onKindChange={changeGuideKind} savedIds={savedIds} onToggle={toggleSaved} onShare={sharePlace}/>}</div>
        {editingJourney ? (
          <JourneyEditor key={`${editingJourney.id}:${chatbotEditorEntry?.journeyId === editingJourney.id ? chatbotEditorEntry.requestId : ''}`} journey={editingJourney} initialDay={chatbotEditorEntry?.journeyId === editingJourney.id ? chatbotEditorEntry.day : undefined} initialEntry={chatbotEditorEntry?.journeyId === editingJourney.id ? chatbotEditorEntry.entry : undefined} onBack={goBack} onSave={saveJourney} onDraft={(draft,view)=>setJourneys(current=>current.map(item=>item.id===draft.id?stashJournalDraft(item,draft,view):item))} />
        ) : selectedJourney && isPersonalPlan(selectedJourney) ? (
          <PersonalTrip key={selectedJourney.id} journey={selectedJourney} onTogether={() => navigateTogether(`together-share-${selectedJourney.id}`)} initialDay={detailDay ?? 1} onGuide={setGuideDay} onTrash={() => setTrashTarget(selectedJourney.id)} onSaveBusiness={saveBusiness} catalog={[...ownJourneys.flatMap(journey=>journey.days.flatMap(day=>day.places)).filter(place=>place.personal),...placeCatalog]} savedPlaces={savedPlaces} onBack={goBack} onChange={next => setJourneys(current => current.map(item => item.id === next.id ? next : item))} onAddLandmark={() => selectTab('discover')} onCopy={()=>copyJourney(selectedJourney)} onJournal={options=>createJournal(selectedJourney,options)} renderMap={(places,selected,onSelect,onResolve)=><RouteMap places={places} selectedVisitId={selected} onSelectVisit={onSelect} onResolveWarning={onResolve}/>} />
        ) : selectedJourney ? (
          <JourneyDetail key={`${selectedJourney.id}:${detailDay ?? 1}`} onTogether={selectedJourney.isMine ? () => navigateTogether(`together-share-${selectedJourney.id}`) : undefined} initialDay={detailDay ?? 1} socialRequestId={chatbotSocialEntry?.requestId} initialSocialEntry={chatbotSocialEntry?.journeyId === selectedJourney.id ? chatbotSocialEntry.entry : undefined} onCloseSocialEntry={() => setChatbotSocialEntry(null)} journey={selectedJourney} profile={profile} comments={comments.filter((comment) => comment.journeyId === selectedJourney.id)} cheers={cheers[selectedJourney.id] ?? { LOVE: 0, BEST: 0, HELPFUL: 0 }} authorJourneys={selectedJourney.isMine ? journeys.filter((journey) => journey.isMine && !isPersonalPlan(journey)) : journeys.filter((journey) => !journey.isMine && journey.author === selectedJourney.author)} onBack={goBack} onShare={() => void shareJourney(selectedJourney)} onSharePlace={(place) => void sharePlace(place)} onEdit={() => editJourney(selectedJourney.id)} onCopy={() => selectedTemplate ? startRecommendedJourney(selectedTemplate) : copyJourney(selectedJourney)} onComment={(body) => addJourneyComment(selectedJourney.id, body)} onCheer={(cheer) => toggleJourneyCheer(selectedJourney.id, cheer)} onOpenJourney={openJourney} copyLabel={selectedTemplateJourney ? copy("이 일정 내 여행에 담기") : undefined} />
        ) : (
          <>
            {tab === 'home' && <DiscoveryHome templates={homePublicTemplates} journals={homePublicJournals} duration={discoveryHome.duration} onDurationChange={duration => updateDiscoveryHome({ duration })} onOpenTemplate={id => { const template = homePublicTemplates.find(item => item.id === id); if (template) openTemplate(template); }} onOpenJournal={id => { if (homePublicJournals.some(item => item.id === id)) openJourney(id); }} onMoreTravel={openHomeTravel} onMoreJournals={openPublicJournals} personalPlans={ownPlans} onOpenMyPlan={openMyPlan} onOpenMyActivity={openMyActivity} onOpenMyChat={openMyChat} onPlan={() => navigateTogether('together-plan', { region: homeRegion })} places={reviewExposureOrder(placeCatalog, 'REGION_GUIDE', publicReview.state, publicReview.now)} references={publicReview.state.references} state={togetherState} viewerId={togetherViewer?.id} region={homeRegion} district={homeDistrict} myRegionLabel={myRegionLabel} onManageMyRegions={() => setMyRegionsOpen(true)} onUseMyRegion={() => updateDiscoveryHome({ useMyRegion: true })} query={discoveryHome.query} view={discoveryHome.view === 'trips' ? 'recommended' : discoveryHome.view} purpose={discoveryHome.purpose} onRegionChange={region => updateDiscoveryHome({ region, useMyRegion: false })} onQueryChange={query => updateDiscoveryHome({ query })} onViewChange={view => view === 'trips' ? openHomeTravel(discoveryHome.duration ?? 'ALL') : updateDiscoveryHome({ view })} onPurposeChange={purpose => updateDiscoveryHome({ purpose })} onOpenGroup={openPublicGroup} onFindGroups={filters => navigateTogether('together-find', filters)} onOpenPlace={setDiscoveryPlace} onOpenPlaces={filters => openPlaceGuide(filters.kind ?? 'ALL', filters)} headerActions={<AppMenuButton/>}/>}
            {tab === 'travel' && <DiscoveryHome mode="travel" view="trips" places={placeCatalog} references={publicReview.state.references} state={togetherState} region={homeRegion} query={discoveryHome.travelQuery ?? ''} onRegionChange={travelRegion => updateDiscoveryHome({ travelRegion })} onQueryChange={travelQuery => updateDiscoveryHome({ travelQuery })} onOpenGroup={openPublicGroup} onFindGroups={filters => navigateTogether('together-find', filters)} onOpenPlace={setDiscoveryPlace} onOpenPlaces={filters => openPlaceGuide(filters.kind ?? 'ALL', filters)} headerActions={<AppMenuButton/>} travelContent={<TravelDiscovery templates={homePublicTemplates} duration={discoveryHome.travelDuration} onDurationChange={travelDuration => updateDiscoveryHome({ travelDuration })} region={homeRegion} query={discoveryHome.travelQuery ?? ''} onOpen={openTemplate} onMyTrips={() => openMySection('travel')} onCreateTrip={() => navigateTogether('together-plan-trip', { region: homeRegion })} onJournals={() => openPublicJournals(discoveryHome.travelDuration ?? 'ALL', homeRegion, discoveryHome.travelQuery ?? '', '')}/>}/>}
            {tab === 'my' && <MyHub key={togetherViewer?.id ?? 'guest-device'} state={togetherState} userId={togetherViewer?.id ?? ''} userName={togetherViewer?.name} plans={ownPlans} journals={ownJourneys.filter(item => !isPersonalPlan(item))} section={mySection} onSectionChange={section => { setMySection(section); writeNavigationState({ mySection: section, scrollTop: 0 }, 'replace'); }} onActivity={id => navigateTogether(`activity-${id}`)} onGroup={id => navigateTogether(`group-${id}`)} onFindGroups={() => navigateTogether('together-find')} onPlan={openJourney} onJournal={openJourney} onLogin={() => account.openAccount('login')} onInvites={() => navigateTogether('together-invites')} onTrash={() => setTrashOpen(true)} onPersonalLibrary={() => selectTab('trips')} onAccount={() => selectTab('profile')} onCalendar={() => navigateTogether('together-calendar')} onCreateAppointment={openAppointmentCreation} onCreateTravel={() => setTripCreationOpen(true)}/>}
            {tab === 'community' && <Community journeys={journeys} filters={searchDraft} onFiltersChange={setSearchDraft} onOpen={openJourney} />}
            {tab === 'together' && <TogetherApp calendarView={calendarView} onCalendarViewChange={view => { setCalendarView(view); writeNavigationState({ calendarView: view }, 'replace'); }} repository={togetherRepository} key={togetherViewer?.id ?? 'guest'} route={togetherRoute} discoveryFilters={effectiveDiscoveryFilters} myRegionLabel={myRegionLabel} onManageMyRegions={() => setMyRegionsOpen(true)} onUseMyRegion={() => changeDiscoveryFilters({ ...discoveryFilters, useMyRegion: true })} onDiscoveryFiltersChange={changeDiscoveryFilters} onBack={goTogetherBack} onNavigate={navigateTogether} viewer={togetherViewer} onLogin={() => account.openAccount('login', togetherRoute.startsWith('together-plan') ? '로그인하고 만든 계획을 저장해 주세요.' : '로그인하고 모임에 함께해 주세요.')} places={placeCatalog} journeys={ownJourneys} onOpenJourney={openJourney} onSavePlace={place => {
              const saved = saveBusiness({ ...place, personal: place.personal || !placeCatalog.some(item => item.id === place.id) });
              if (!saved) showToast('장소를 저장하지 못했어요. 기존 저장 장소는 그대로예요.');
            }} onCopyJourney={copyJourney} onCreatePersonalPlan={source => { const owned = copyPersonalPlan(source, togetherViewer?.name ?? profile.displayName); if (!setJourneys(current => [owned, ...current])) return false; openMyJourney(owned.id); showToast('내 일정으로 만들었어요.'); return true; }} onCreateJournal={source => {
              try {
                const owned = copyPersonalPlan(source, togetherViewer?.name ?? profile.displayName);
                const journal = makeJournalFromPlan(owned, togetherViewer?.name ?? profile.displayName, { includePlanned: true });
                if (!setJourneys(current => [journal, ...current])) return;
                editJourney(journal.id);
              } catch (error) { showToast(error instanceof Error ? error.message : '여행기 초안을 만들지 못했어요.'); }
            }}/>}
            {tab === 'offline' && <OfflineLibrary journeys={ownPlans} onBack={goBack} onOpen={openJourney}/>}
            {tab === 'trips' && <Trips onTrash={() => setTrashOpen(true)} onDelete={setTrashTarget} journeys={journeys} onOpen={openJourney} onCreate={() => { setPlanChoices(null); setPlanCreating(true); }} onShare={(journey) => void shareJourney(journey)} />}
            {tab === 'saved' && <Saved onUsePlace={place => setPlaceUse({ placeId: place.id, owner: regionOwnerRef.current })} onRegisterPlace={() => setInterestPlaceKind('FOOD')} key={togetherViewer?.id ?? 'guest-device'} viewerId={togetherViewer?.id ?? 'guest-device'} places={savedPlaces} journeys={ownPlans} draft={savedTripDraft} onDraftChange={setSavedTripDraft} onCreate={createSavedTrip} onRemove={toggleSaved} onAdd={(place) => setPlacementPlaces([place])} onCollectionCreate={places => { setPlanChoices(places); setPlanCreating(true); }} onGoDiscover={() => openPlaceGuide()} />}
            {import.meta.env.DEV && tab === 'style-guide' && <StyleGuide onBack={goBack} />}
            {tab === 'profile' && <Profile initialEntry={chatbotProfileEntry?.entry} entryRequestId={chatbotProfileEntry?.requestId} native={native} journeys={journeys} comments={comments} cheers={cheers} profile={profile} notificationPreferences={notificationPreferences} notificationPermission={notificationPermission} onBack={() => { setChatbotProfileEntry(null); goBack(); }} onDeviceTrips={() => selectTab('trips')} onProfileChange={setProfile} onNotificationPreferencesChange={changeNotificationPreferences} onPreviewNotification={() => showToast(previewCreatorNotification(notificationPreferences.viewMilestone) ? copy("테스트 알림을 준비하고 있어요.") : copy("테스트 알림은 Spotlog 앱에서 확인할 수 있어요."))} onOpen={openJourney} />}
            {tab === 'photo-stories' && <PhotoStoryPreview savedIds={savedIds} onBack={goBack} onToggle={toggleSaved} onShare={(place) => void sharePlace(place)} />}
          </>
        )}
      </section>

      {!selectedJourney && !editingJourney && !togetherDetail && tab !== 'offline' && tab !== 'profile' && tab !== 'photo-stories' && tab !== 'style-guide' && <nav className="tabbar" aria-label={copy("주요 메뉴")}>
        {tabItems.map((item) => {
          const Icon = item.icon;
          const active = primaryTabForScreen(tab) === item.id;
          return <button key={item.id} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined} onClick={() => selectTab(item.id)}><Icon size={21} strokeWidth={active ? 2.3 : 1.8} /><span>{locale === 'en' ? item.english : item.label}</span></button>;
        })}
      </nav>}
      {creating && <CreateJourneySheet onClose={() => setCreating(false)} onCreate={createJourney} />}
      {tripCreationOpen && <BottomSheet title="여행 만들기" onClose={() => setTripCreationOpen(false)}><div className="my-trip-create-choices"><button type="button" onClick={() => { setTripCreationOpen(false); setPlanChoices(null); setPlanCreating(true); }}><Bookmark size={21}/><span><strong>저장한 장소로 만들기</strong><small>모아 둔 장소를 골라 DAY 일정으로 담아요.</small></span><ChevronRight size={18}/></button><button type="button" onClick={() => { afterPlaceSheet(() => navigateTogether('together-plan-trip', { region: homeRegion })); setTripCreationOpen(false); }}><Route size={21}/><span><strong>조건으로 계획하기</strong><small>가고 싶은 지역과 활동을 적고 후보를 비교해요.</small></span><ChevronRight size={18}/></button></div></BottomSheet>}
      {appointmentCreating && <CreateAppointmentSheet places={savedPlaces} initial={appointmentDraft} onChange={setAppointmentDraft} onClose={() => setAppointmentCreating(false)} onCreate={createAppointment}/>}
      {discoveryPlace && <BottomSheet title={discoveryPlace.name} onClose={() => setDiscoveryPlace(null)}><LandmarkGuideCard place={discoveryPlace} showCredit saved={savedIds.includes(discoveryPlace.id)} onToggle={() => toggleSaved(discoveryPlace.id)} onShare={() => void sharePlace(discoveryPlace)}/></BottomSheet>}
      {travelRecommendationsOpen && <BottomSheet title="추천 여행 일정" onClose={() => setTravelRecommendationsOpen(false)}><div className="platform-hub-body">{reviewExposureOrder(liveTemplates, 'HOME_TRIP', publicReview.state, publicReview.now).map(template => <button type="button" key={template.id} className="platform-journal-row" onClick={() => { setTravelRecommendationsOpen(false); openTemplate(template); }}><Route size={24}/><span className="platform-row-copy"><strong>{template.title}</strong><span>{template.region} · {template.duration}</span><small>{template.summary}</small></span><ChevronRight size={18}/></button>)}</div></BottomSheet>}
      {chatbotPersonalPlace && (() => { const target = journeys.find(item => item.id === chatbotPersonalPlace.journeyId && isPersonalPlan(item) && !item.trash); const day = target?.days.find(item => item.day === chatbotPersonalPlace.day); return target && day ? <PlacePicker kind={chatbotPersonalPlace.kind} region={target.region} personalPlan onClose={() => setChatbotPersonalPlace(null)} onSelect={place => { const next = appendPlanPlace(target, day.dayId!, { ...place, personal: true, locationVerified: false }); if (!setJourneys(current => current.map(item => item.id === target.id ? { ...next, planStage: 'DRAFT' } : item))) throw new Error('저장하지 못했어요. 입력한 내용을 유지합니다.'); setChatbotPersonalPlace(null); showToast(`DAY ${day.day}에 개인 입력 장소를 담았어요. 등록 정보와 위치는 미확인이에요.`); }} /> : null; })()}
      {planCreating && <CreatePlanSheet places={planChoices ?? savedPlaces} author={profile.displayName} draft={planCreationDraft} onDraftChange={setPlanCreationDraft} onClose={() => setPlanCreating(false)} onCreate={journey => { const created = initializeCreatedPlan(journey, profile.displayName); if (!setJourneys(current => [created, ...current])) return false; setPlanCreationDraft(null); setPlanCreating(false); openMyJourney(created.id); return true; }} />}
      {placeUse && placeUse.owner === regionOwner && (() => {
        const place = savedPlaces.find(item => item.id === placeUse.placeId);
        return place ? <SavedPlaceUseSheet key={`${regionOwner}:${place.id}`} place={place} state={togetherState} actorId={togetherViewer?.id ?? ''} hasPlacement={ownPlans.some(journey => journey.days.some(day => day.places.some(item => item.id === place.id)))} onClose={() => setPlaceUse(null)} onLogin={() => { setPlaceUse(null); account.openAccount('login', '로그인 후 공유할 모임이나 약속을 직접 선택해 주세요.'); }} onAppointment={() => startPlaceAppointment(place)} onTrip={() => { setPlaceUse(null); setPlacementPlaces([place]); }} onPropose={sendPlaceProposal}/> : null;
      })()}
      {placementPlaces && <AddToTripSheet places={placementPlaces} journeys={ownPlans} initialJourneyId={ownPlans.find((journey) => journey.days.some((day) => day.places.some((place) => placementPlaces.some((selected) => selected.id === place.id))))?.id} initialDay={ownPlans.flatMap((journey) => journey.days).find((day) => day.places.some((place) => placementPlaces.some((selected) => selected.id === place.id)))?.day} onClose={() => setPlacementPlaces(null)} onConfirm={confirmTripPlacement} onRemove={removePlacedVisit} />}
      {aiTravelOpen && <AiPlannerSheet draftRef={aiTravelDraft} existingJourneyIds={allJourneys.map(journey=>journey.id)} places={aiPlaceCandidates} savedPlaces={savedPlaces} author={profile.displayName} onDraftNotice={showToast} onClose={() => setAiTravelOpen(false)} onCreate={acceptAiDraft} />}
      {trashOpen && <TripTrashSheet language={locale} journeys={allJourneys} ownerId="local-profile" onChange={setJourneys} onClose={() => setTrashOpen(false)} onOpen={journey => { setTrashOpen(false); openMyJourney(journey.id); }} />}
      {trashTarget && <MoveToTrashSheet journeys={allJourneys} journeyId={trashTarget} ownerId="local-profile" language={locale} onChange={setJourneys} onMoved={() => { setTrashTarget(null); if (selectedJourneyId === trashTarget) selectTab('trips'); showToast(locale === 'en' ? 'Moved to Trash. You can restore it for six months.' : copy("휴지통으로 이동했어요. 6개월 동안 복원할 수 있어요.")); }} onClose={() => setTrashTarget(null)} />}
      {selectedJourney && guideDay !== null && <TravelGuideSheet journey={selectedJourney} initialDay={guideDay} onClose={() => setGuideDay(null)} />}
      {interestPlaceKind && <PlacePicker interest onKindChange={setInterestPlaceKind} kind={interestPlaceKind} region="" onClose={() => setInterestPlaceKind(null)} onSelect={place => {
        if (!saveBusiness({ ...place, personal: true, locationVerified: false })) throw new Error('장소를 저장하지 못했어요. 입력한 내용을 유지해요.');
        setInterestPlaceKind(null);
      }}/>}
      {appMenuOpen && <AppMenu onClose={() => setAppMenuOpen(false)} onNavigate={navigateMenu} myRegionLabel={myRegionLabel}/>}
      {myRegionsOpen && <MyRegionSheet key={regionOwner} ownerId={regionOwner} onClose={() => setMyRegionsOpen(false)} onSaved={(saved: MyRegionsState) => {
        if (saved.owner !== regionOwnerRef.current) return;
        setRegionPreferences({ state: saved, status: 'ready', message: '' });
        updateDiscoveryHome({ useMyRegion: true });
        changeDiscoveryFilters({ ...discoveryFilters, useMyRegion: true });
      }}/>}
      {toast && <div className="toast" role="status"><Check size={15} />{toast}</div>}
    </main></CardSocialProvider></ReportProvider></AppMenuContext.Provider>
  );
}

function Home({ topic, onTopicChange, memory, viewer, onNavigateTogether, journeys, continuation, onResume, templates, savedIds, onTogglePlace, onOpen, onPreview, onGoCommunity, onGoPlaces, onGoTogether, onGoTrips, onAiTravel }: {
  topic: HomeTopic; onTopicChange: (topic: HomeTopic) => void; memory: HomeViewMemory;
  viewer: { id: string; name: string } | null; onNavigateTogether: (route: string, filters?: GroupDiscoveryFilters) => void;
  journeys: Journey[]; continuation: TripContinuation | null; onResume: (target: TripContinuation) => void;
  templates: HomeTripTemplate[]; savedIds: string[]; onTogglePlace: (id: string) => void; onSharePlace: (place: Place) => void;
  onOpen: (id: string) => void; onPreview: (template: HomeTripTemplate) => void; onGoCommunity: () => void;
  onGoPlaces: (kind: BrowsePlaceKind, search?: { region?: string; district?: string; query?: string }) => void;
  onGoTogether: (filters?: GroupDiscoveryFilters) => void; onGoTrips: () => void; onGoProfile: () => void; onAiTravel: () => void;
}) {
  const copy = useUiCopy();
  const { state: reviewState, now, catalog } = usePublicReview();
  const homePlaces = useHomePlaceExposures();
  const { locale } = useLocale();
  const en = locale === 'en';
  const [region, setRegion] = useState(memory.region ?? '');
  const [query, setQuery] = useState(memory.query ?? '');
  const [regionOpen, setRegionOpen] = useState(false);
  const [placeKind, setPlaceKind] = useState<BrowsePlaceKind>(memory.placeKind);
  const [detailPlaceId, setDetailPlaceId] = useState<string | null>(null);
  const directory = reviewExposureOrder([...new Map([...homePlaces, ...catalog].map(place => [place.id, place])).values()], 'REGION_GUIDE', reviewState, now);
  const regions = [...new Set([...domesticRegionOrder, ...directory.map(place => publicPlaceRegion(place, reviewState.references))])];
  const filteredPlaces = filterHomePlaces(directory, { region, query, kind: placeKind }, reviewState.references);
  const previewPlaces = homePlacePreview(filteredPlaces, topic === 'places' ? 6 : 2);
  const detailPlace = directory.find(place => place.id === detailPlaceId);
  templates = reviewExposureOrder(templates, 'HOME_TRIP', reviewState, now).filter(item => matchesDestination(region, [item.region]) && matchesDestination(query, [item.title, item.summary, item.region]));
  const publicGuides = reviewExposureOrder(journeys.filter(item => !item.isMine && item.visibility === 'PUBLIC' && item.status === 'PUBLISHED' && item.recommendationKind !== 'AI' && matchesDestination(region, [item.region]) && matchesDestination(query, [item.title, item.summary, item.region, item.author])), 'HOME_JOURNAL', reviewState, now);
  const authorCopyCount = (author: string) => publicGuides.filter(item => item.author === author).reduce((sum, item) => sum + item.saves, 0);
  const recommendationRolling = useManualHomeCarousel(templates.map(item => item.id), memory, 'recommendationId', topic === 'recommended' || topic === 'trips');
  const guideRolling = useManualHomeCarousel(publicGuides.map(item => item.id), memory, 'guideId', topic === 'recommended' || topic === 'trips');
  const topics = [{ id: 'recommended', label: '추천' }, { id: 'places', label: '장소' }, { id: 'groups', label: '모임' }, { id: 'trips', label: '여행' }] as const;
  const changeTopic = (next: string) => { setDetailPlaceId(null); onTopicChange(next as HomeTopic); };
  const showPlaces = topic === 'recommended' || topic === 'places';
  const showGroups = topic === 'recommended' || topic === 'groups';
  const showTrips = topic === 'recommended' || topic === 'trips';
  const searchHint = topic === 'groups' ? '모임 이름·관심사 검색' : topic === 'trips' ? '여행 지역·제목 검색' : topic === 'places' ? '장소 이름·특징 검색' : '장소·모임 이름 검색';
  const changeRegion = (next: string) => { setRegion(next); memory.region = next; memory.groupRegion.value = next; setRegionOpen(false); };

  return <div className="home-page recommendation-home">
    <ScreenHeader title="spotlog" brand actions={<><button type="button" className="home-region-button screen-header__text-action" onClick={() => setRegionOpen(true)} aria-label={`홈 지역 선택 · ${region || '전체 지역'}`}><MapPin size={16}/><span>{region || '전체 지역'}</span><ChevronRight size={14}/></button><AppMenuButton/></>} />
    <ScreenTabs label="홈에서 볼 내용" idPrefix="home-topic" items={topics.map(item => ({ ...item, panelId: 'home-discovery-panel' }))} value={topic} onChange={changeTopic}/>
    <div className="home-search-bar"><Search size={19} aria-hidden="true"/><input type="search" value={query} onChange={event => { setQuery(event.target.value); memory.query = event.target.value; }} aria-label={searchHint} placeholder={searchHint}/>{query && <button type="button" aria-label="홈 검색 지우기" onClick={() => { setQuery(''); memory.query = ''; }}>×</button>}</div>
    <div id="home-discovery-panel" role="tabpanel" aria-labelledby={`home-topic-${topic}`} className="home-discovery-panel">
      <h1 className="home-discovery-title">{query.trim() ? `‘${query.trim()}’ 검색 결과` : topic === 'recommended' ? '오늘의 발견, 함께할 사람들' : topic === 'places' ? `${region || '전국'}의 가고 싶은 장소` : topic === 'groups' ? `${region || '전국'}에서 함께하는 모임` : '내 속도로 떠나는 여행'}</h1>
      {continuation && (topic === 'recommended' || topic === 'trips') && <button type="button" className="home-compact-continuation" onClick={() => onResume(continuation)}><span className="home-compact-icon"><Route size={20}/></span><span><small>내 일정 이어보기</small><strong>{continuation.journey.title}</strong></span><ChevronRight size={18}/></button>}
      {showPlaces && <section className="home-hub-section" aria-label="공개 장소 둘러보기">
        <div className="home-hub-heading"><div><h2>{region ? `${region}에서 가볼 만한 곳` : '가고 싶은 곳을 한 곳씩'}</h2><p>맛집·카페·숙소도 따로 저장해요</p></div><button type="button" onClick={() => onGoPlaces(placeKind, { region, query })} aria-label="선택한 지역과 종류의 장소 더 보기">더 보기<ChevronRight size={16}/></button></div>
        <div className="home-category-strip" role="group" aria-label="둘러볼 장소 종류">{browsePlaceKinds.map(kind => { const Icon = kind === 'FOOD' ? Utensils : kind === 'CAFE' ? Coffee : kind === 'STAY' ? Hotel : kind === 'SHOP' ? Store : kind === 'LEISURE' ? Footprints : MapPin; return <button type="button" key={kind} aria-pressed={placeKind === kind} onClick={() => { setPlaceKind(kind); memory.placeKind = kind; }}><Icon size={17}/>{kind === 'ALL' ? '전체' : placeKindLabel[kind]}</button>; })}</div>
        <div className="home-photo-grid">{previewPlaces.map(place => {
          const photo = getPlacePhotos(place, true)[0];
          return <article className="home-photo-place" key={place.id}>
            <div className="home-photo-place-media"><button type="button" aria-label={`${place.name} 상세 보기`} onClick={() => setDetailPlaceId(place.id)}>{photo ? <img src={photo.image} alt="" loading="lazy"/> : <span className="home-photo-placeholder"><MapPin size={28}/></span>}</button><button type="button" className="home-photo-bookmark" aria-label={`${place.name} ${savedIds.includes(place.id) ? '저장 취소' : '저장'}`} aria-pressed={savedIds.includes(place.id)} onClick={() => onTogglePlace(place.id)}><Bookmark size={19} fill={savedIds.includes(place.id) ? 'currentColor' : 'none'}/></button></div>
            <button type="button" className="home-photo-place-copy" aria-label={`${place.name} 정보 보기`} onClick={() => setDetailPlaceId(place.id)}><small>{placeKindLabel[place.kind]} · {publicPlaceRegion(place, reviewState.references)}</small><strong>{place.name}</strong><span>{place.hook || place.description}</span></button>
          </article>;
        })}</div>
        {!previewPlaces.length && <div className="home-hub-empty"><MapPin size={24}/><strong>조건에 맞는 장소가 없어요</strong><p>지역이나 종류, 검색어를 바꿔보세요.</p><button type="button" onClick={() => { changeRegion(''); setPlaceKind('ALL'); memory.placeKind = 'ALL'; setQuery(''); memory.query = ''; }}>전체 장소 보기</button></div>}
      </section>}
      {showGroups && <HomeCommunity viewer={viewer} places={catalog} region={region} query={query} onResetFilters={() => { changeRegion(''); setQuery(''); memory.query = ''; }} onNavigate={onNavigateTogether} onExplore={onGoTogether}/>}
      {showTrips && <div className="home-trip-discovery">
      <section className="home-lead strategy-home-lead"><h2>{en ? 'A trip at your own pace' : '내 속도로 계획하는 여행'}</h2><p>{en ? 'Start with a draft or a published itinerary.' : '간단한 AI 초안이나 공개 일정으로 여행을 시작하세요.'}</p></section>
      <button type="button" className="home-topic-primary" onClick={onAiTravel}><Sparkles size={19}/><span>{en ? 'Create an AI trip draft' : 'AI 여행 초안 만들기'}</span><ChevronRight size={18}/></button>

    {templates.length > 0 && <section className="home-section"><div className="home-section-heading"><div><small>SPOTLOG CURATION</small><h2>{en ? 'Featured itineraries' : copy("가볍게 시작하는 여행")}</h2><p>{en ? 'Explore selected itineraries and make them your own.' : copy("에디터가 고른 일정을 읽어보고 내 여행에 담으세요")}</p></div><RollingControls label={copy("추천 일정")} count={templates.length} activeIndex={recommendationRolling.activeIndex} onChange={recommendationRolling.goTo} /></div><div className="promoted-track" ref={recommendationRolling.trackRef} onScroll={recommendationRolling.syncIndex}>{templates.map((template) => <article className="promoted-trip" key={template.id}><img src={template.cover} alt="" /><div className="promoted-shade" /><div className="promoted-copy"><span>{template.region} · {template.duration}</span><h2>{template.title}</h2><p>{template.summary}</p><div><button onClick={() => onPreview(template)}>{en ? 'View itinerary' : copy("일정 자세히 보기")}</button><small>{template.places.length}{copy("개 장소 · 먼저 보고 담기")}</small></div></div></article>)}</div></section>}

    {publicGuides.length > 0 && <section className="home-section"><div className="home-section-heading"><div><small>TRAVELER'S GUIDE</small><h2>{en ? 'Travelers’ journals' : copy("여행자들이 만든 일정")}</h2><p>{en ? 'Read travel stories and save ideas for your trip.' : copy("실제 여행 기록을 읽고 내 일정으로 가져오세요")}</p></div><RollingControls label={copy("여행자 일정")} count={publicGuides.length} activeIndex={guideRolling.activeIndex} onChange={guideRolling.goTo} /></div><div className="home-guide-list" ref={guideRolling.trackRef} onScroll={guideRolling.syncIndex}>{publicGuides.map((journey) => <article className="home-guide-card" key={journey.id}><button className="home-guide-cover" onClick={() => onOpen(journey.id)}><img src={journey.cover} alt="" /><span>{journey.region}<br />{journey.duration}</span></button><div className="home-guide-copy"><div className="home-guide-author">{journey.publicSourceKind === 'EDITORIAL' ? <span className="creator-tier-badge compact">{copy("운영 추천 여행기")}</span> : <CreatorBadge copyCount={authorCopyCount(journey.author)} compact />}<small>{journey.author} · {journeyPlaceCount(journey)}{copy("곳")}</small></div><h3>{journey.title}</h3><p>{journey.summary}</p><div className="home-guide-actions"><button onClick={() => onOpen(journey.id)}>{en ? 'Read journal' : copy("여행기 먼저 보기")}</button></div></div></article>)}</div></section>}

      <section className="home-shortcuts"><button type="button" onClick={onGoCommunity}><BookOpen size={20}/><span><strong>여행기 더 보기</strong><small>지역·기간으로 공개 여행기 찾기</small></span><ChevronRight size={17}/></button><button type="button" onClick={onGoTrips}><MapIcon size={20}/><span><strong>내 여행</strong><small>작성한 일정 이어보기</small></span><ChevronRight size={17}/></button></section>
      {!templates.length && !publicGuides.length && <div className="home-hub-empty"><Route size={24}/><strong>조건에 맞는 공개 일정이 없어요</strong><p>저장한 장소로 직접 일정을 만들 수도 있어요.</p><button type="button" onClick={onAiTravel}>여행 초안 만들기</button></div>}
      </div>}
    </div>
    {regionOpen && <BottomSheet title="보고 싶은 지역" description="장소와 공개 모임을 같은 지역으로 둘러봐요." onClose={() => setRegionOpen(false)}><div className="home-region-grid">{['', ...regions].map(item => <button type="button" key={item || 'ALL'} aria-pressed={region === item} onClick={() => changeRegion(item)}>{item || '전체 지역'}{region === item && <Check size={16}/>}</button>)}</div></BottomSheet>}
    {detailPlace && <SavedLandmarkDetailSheet place={detailPlace} onClose={() => setDetailPlaceId(null)}/>}
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
  const { state: reviewState } = usePublicReview();
  const regions = ['전체', ...new Set(journeys.filter((journey) => journey.visibility === 'PUBLIC' && journey.status === 'PUBLISHED').map((journey) => journey.region))];
  const aiCategory = filters.category === 'AI';
  const publicGuides = journeys.filter((journey) => !journey.isMine && journey.visibility === 'PUBLIC' && journey.status === 'PUBLISHED');
  const filteredGuides = publicGuides
    .filter((journey) => aiCategory ? journey.recommendationKind === 'AI' : journey.recommendationKind !== 'AI')
    .filter(journey => {
      const places = journey.days.flatMap(day => day.places);
      return (!filters.region || journey.region === filters.region || places.some(place => publicPlaceRegion(place, reviewState.references) === filters.region))
        && (!filters.district || places.some(place => `${place.area} ${place.address || ''}`.normalize('NFKC').includes(filters.district!.normalize('NFKC'))));
    })
    .filter((journey) => matchesDestination(filters.destination, [journey.region, journey.title, journey.summary, journey.author, ...journey.tags]) && matchesTripDuration(journey.duration, filters.duration))
    .sort((left, right) => right.saves - left.saves);
  const authorCopyCount = (author: string) => publicGuides.filter((journey) => journey.author === author).reduce((sum, journey) => sum + journey.saves, 0);

  return <div className="page community-page">
    <p className="browse-intro">여행자들의 기록을 보고 내 여행에 담아보세요.</p>
    {filters.region && <div className="duration-chips" aria-label="홈에서 선택한 여행기 지역"><button type="button" onClick={() => onFiltersChange({ ...filters, region: undefined, district: undefined })}>{[filters.region, filters.district].filter(Boolean).join(' · ')}<X size={14} aria-hidden="true"/></button></div>}
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
      {filteredGuides.length ? <div className="community-list">{filteredGuides.map((journey) => <article className="community-card" key={journey.id}><button className="community-cover" onClick={() => onOpen(journey.id)}><img src={journey.cover} alt="" /><span>{journey.region} · {journey.duration}</span></button><div className="community-copy"><div className="community-author">{journey.publicSourceKind === 'EDITORIAL' ? <span className="creator-tier-badge compact">{copy("운영 추천 여행기")}</span> : journey.recommendationKind === 'AI' ? <span className="creator-tier-badge compact"><Sparkles size={11} />{copy("AI 추천")}</span> : <CreatorBadge copyCount={authorCopyCount(journey.author)} compact />}<strong>{journey.author}</strong></div><h3>{journey.title}</h3><p>{journey.summary}</p><div className="community-meta"><span><MapPin size={12} />{journeyPlaceCount(journey)}{copy("곳")}</span>{journey.recommendationKind === 'AI' ? <span>{copy("공식 자료 기반 샘플")}</span> : <><span><Eye size={12} />{(journey.views ?? 0).toLocaleString()}</span><span><Copy size={12} />{journey.saves.toLocaleString()}{copy("명")}</span></>}</div><button onClick={() => onOpen(journey.id)}>{copy("여행기 먼저 보기")}<ChevronRight size={16} /></button></div></article>)}</div> : <div className="community-empty"><Search size={27} /><h2>{copy("조건에 맞는 여행기가 없어요")}</h2><p>{copy("지역을 전체로 넓히거나 여행 기간을 바꿔보세요.")}</p><button onClick={() => onFiltersChange({ destination: '', duration: 'ALL', category: filters.category })}>{copy("전체 여행기 보기")}</button></div>}
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

function Discover({ view, onViewChange, guideKind, search, onResetSearch, onSearchChange, onKindChange, savedIds, onToggle, onShare }: { view: PlaceView; onViewChange: (view: PlaceView) => void; search: { region: string; query: string }; onResetSearch: () => void; onSearchChange: (search: { region: string; query: string }) => void; guideKind: BrowsePlaceKind; onKindChange: (kind: BrowsePlaceKind) => void; savedIds: string[]; onToggle: (id: string) => void; onShare: (place: Place) => void }) {
  const copy=useUiCopy();
  const { locale } = useLocale();
  const { catalog: placeCatalog, state: reviewState, now } = usePublicReview();
  const { query } = search;
  // Full-screen photo/video filters stay local and never replace a sheet history entry.
  const [mediaRegion, setMediaRegion] = useState('');
  const selectedRegion = view === 'GUIDE' ? search.region : mediaRegion;
  const setQuery = (query: string) => onSearchChange({ ...search, query });
  const setSelectedRegion = (region: string) => view === 'GUIDE' ? onSearchChange({ ...search, region }) : setMediaRegion(region);
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
  const landmarkRegion = (place: Place) => publicPlaceRegion(place, reviewState.references);
  const guideCatalog = useMemo(() => reviewExposureOrder(placeCatalog, 'REGION_GUIDE', reviewState,now)
    .sort((a, b) => domesticRegionOrder.indexOf(landmarkRegion(a)) - domesticRegionOrder.indexOf(landmarkRegion(b))), [placeCatalog, reviewState,now]);
  const guideLandmarks = useMemo(() => guideCatalog.filter(place => place.kind === 'LANDMARK'), [guideCatalog]);
  const guidePlaces = useMemo(() => guideKind === 'ALL' ? guideCatalog : guideCatalog.filter(place => place.kind === guideKind), [guideCatalog, guideKind]);
  const regionOrder = [...new Set([...domesticRegionOrder, ...reviewState.references.filter(r=>r.category==='REGION').map(r=>r.name), ...guideCatalog.map(landmarkRegion)])];
  const regionGroups = regionOrder
    .map((region) => ({ region, places: guidePlaces.filter((place) => landmarkRegion(place) === region) }))
    .filter((group) => group.places.length > 0 || group.region === selectedRegion);
  const photoPlaces = useMemo(() => reviewExposureOrder(guideLandmarks.filter((place) => getPlacePhotos(place).length > 0)
    .sort((left, right) => getPlacePhotos(right).length - getPlacePhotos(left).length), 'DISCOVERY_PHOTO', reviewState,now), [guideLandmarks, reviewState,now]);
  const mediaPlaces = view === 'VIDEO' ? placeCatalog.filter(place => place.video || place.motionImages?.length) : photoPlaces;
  const mediaRegions = regionOrder.map((region) => ({ region, count: mediaPlaces.filter((place) => landmarkRegion(place) === region).length }))
    .filter((group) => group.count > 0 || group.region === selectedRegion);
  const videoPlaces = reviewExposureOrder(placeCatalog, 'DISCOVERY_VIDEO', reviewState,now).filter(place => (place.video || place.motionImages?.length) && (!selectedRegion || landmarkRegion(place) === selectedRegion));
  const kindCountPlaces = filterHomePlaces(guideCatalog, { region: selectedRegion, query }, reviewState.references);
  const visiblePlaces = filterHomePlaces(guideCatalog, { region: selectedRegion, query, kind: guideKind }, reviewState.references);
  const resultTitle = query.trim()
    ? `'${query.trim()}' 검색 결과`
    : `${selectedRegion || "국내"} ${guideKind === "ALL" ? "장소" : placeKindLabel[guideKind]}`;
  const hasActiveResults = true;
  const displayedPlaces = visiblePlaces.slice(0, visiblePlaceCount);
  const hasMorePlaces = displayedPlaces.length < visiblePlaces.length;
  const displayedRegionGroups = regionGroups;
  const chooseRegion = (region: string) => {
    setSelectedRegion(region);
  };
  useEffect(() => setVisiblePlaceCount(PLACE_LIST_PAGE_SIZE), [query, selectedRegion, guideKind]);
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
    {view !== 'GUIDE' && <header className="place-discover-header"><div><strong>{view === 'PHOTO' ? '장소 사진' : '장소 영상'}</strong><span>{savedIds.length}{copy("개 장소 저장")}</span></div><AppMenuButton/><PlaceViewToggle view={view} onChange={onViewChange} /></header>}
    {view === 'VIDEO' ? <div className="feed" key={selectedRegion}>{videoPlaces.length ? videoPlaces.map((place) => <FeedCard key={place.id} place={place} saved={savedIds.includes(place.id)} onToggle={() => onToggle(place.id)} onShare={() => onShare(place)} region={selectedRegion} onChooseRegion={openRegion} />) : <div className="photo-reel-empty video-reel-empty"><Clapperboard size={28} /><h2>{selectedRegion}{' '}{copy("영상을 준비하고 있어요")}</h2><p>{copy("다른 지역의 장소 영상을 먼저 살펴보세요.")}</p><button type="button" className="photo-region-button" onClick={(event) => openRegion(event.currentTarget)}><MapPin size={16} />{copy("지역 선택")}</button></div>}</div> : view === 'PHOTO' ? <PhotoLandmarkFeed places={photoPlaces.filter((place) => !selectedRegion || landmarkRegion(place) === selectedRegion)} savedIds={savedIds} onToggle={onToggle} onShare={onShare} region={selectedRegion} onChooseRegion={openRegion} /> : <div className="place-guide-content">
      <div className="browse-view-toolbar"><span>{selectedRegion || '전체 지역'} · {savedIds.length}곳 저장</span><PlaceViewToggle view={view} onChange={onViewChange}/></div>
      <section className="place-guide-search"><label className="destination-search"><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy("지역이나 장소 이름을 검색하세요")} aria-label={copy("장소 지역 검색")} />{query && <button type="button" onClick={() => setQuery('')} aria-label={copy("검색 지우기")}>{copy("지우기")}</button>}</label></section>
      <div className="place-kind-filter" role="group" aria-label="장소 종류">{browsePlaceKinds.map(kind => {
        const count = kind === 'ALL' ? kindCountPlaces.length : kindCountPlaces.filter(place => place.kind === kind).length;
        const label = kind === 'ALL' ? '전체' : placeKindLabel[kind];
        return <button key={kind} type="button" aria-label={`${label} ${count}곳`} aria-pressed={guideKind === kind} className={guideKind === kind ? 'active' : ''} onClick={() => onKindChange(kind)}>{label}<span>{count}</span></button>;
      })}</div>
      <section className="region-directory" aria-label={copy("지역별 장소")}>
        <div className="region-count-grid phase-region-strip">
          <button type="button" className={!selectedRegion ? 'active' : ''} onClick={() => chooseRegion('')} aria-pressed={!selectedRegion}><strong>{copy("전체")}</strong><small>{guidePlaces.length}</small></button>
          {displayedRegionGroups.map(({ region, places }) => <button type="button" key={region} className={selectedRegion === region ? 'active' : ''} onClick={() => chooseRegion(region)} aria-pressed={selectedRegion === region}><strong>{region}</strong><small>{places.length}</small></button>)}
        </div>
      </section>
      <section className="place-guide-results"><div className="place-guide-heading"><div><h2>{hasActiveResults ? resultTitle : copy("지역을 골라 장소 보기")}</h2></div><span>{hasActiveResults ? `${visiblePlaces.length}곳` : copy("지역별로 나눠보기")}</span></div>{!hasActiveResults ? <div className="region-result-empty"><MapPin size={23} /><div><strong>{copy("위에서 지역을 선택하세요")}</strong><p>{copy("선택한 지역의 장소를 3곳씩 불러오며, 아래로 스크롤하면 다음 장소가 자동으로 이어집니다.")}</p></div></div> : visiblePlaces.length ? <><div className="landmark-guide-list">{displayedPlaces.map((place) => <LandmarkGuideCard key={place.id} place={place} saved={savedIds.includes(place.id)} onToggle={() => onToggle(place.id)} onShare={() => onShare(place)} />)}</div>{hasMorePlaces ? <div ref={placeLoadSentinelRef} className="place-load-sentinel" aria-live="polite"><span className="place-load-indicator" aria-hidden="true"><i /><i /><i /></span><div><strong>{copy("아래로 스크롤하면 다음")}{' '}{Math.min(PLACE_LIST_PAGE_SIZE, visiblePlaces.length - displayedPlaces.length)}{copy("곳을 불러옵니다")}</strong><small>{displayedPlaces.length} / {visiblePlaces.length}{copy("곳 표시 중")}</small></div></div> : visiblePlaces.length > PLACE_LIST_PAGE_SIZE && <div className="place-list-end"><Check size={15} />{visiblePlaces.length}{copy("곳을 모두 불러왔습니다")}</div>}</> : <div className="community-empty"><MapPin size={27} /><h2>{copy("아직 준비된 장소가 없어요")}</h2><p>{copy("다른 지역이나 장소 종류로 찾아보세요.")}</p><button onClick={onResetSearch}>{copy("전체 장소 보기")}</button></div>}</section>
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
  return <div className="place-view-toggle" role="group" aria-label={copy("장소 보기 방식")}><button type="button" aria-pressed={view === 'GUIDE'} className={view === 'GUIDE' ? 'active' : ''} onClick={() => onChange('GUIDE')}><MapIcon size={14} />장소 목록</button><button type="button" aria-pressed={view === 'PHOTO'} className={view === 'PHOTO' ? 'active' : ''} onClick={() => onChange('PHOTO')}><ImagePlus size={14} />{view === 'PHOTO' ? '랜드마크 사진' : copy("사진")}</button><button type="button" aria-pressed={view === 'VIDEO'} className={view === 'VIDEO' ? 'active' : ''} onClick={() => onChange('VIDEO')}><Clapperboard size={14} />{copy("영상")}</button></div>;
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
      <div className="creator-row"><span className="creator-avatar">{place.creator?.slice(0, 1).toUpperCase()}</span><strong>{place.creator}</strong><button disabled title="후속 준비" aria-label="팔로우 · 후속 준비">{copy("팔로우")}</button></div>
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
  const account = useAccount();
  const online = useConnectivity();
  const [view, setView] = useState<'plans'|'journals'>('plans');
  const myTrips = journeys.filter(journey=>journey.isMine && !journey.trash);
  const plans = myTrips.filter(isPersonalPlan), journals = myTrips.filter(journey=>!isPersonalPlan(journey));
  const ready = plans.filter(journey=>journey.planStage!=='DRAFT'), drafts = plans.filter(journey=>journey.planStage==='DRAFT');
  return <div className="page trips-page">
    <AppHeader title="내 여행" subtitle={view==='plans'?'장소를 이어 만든 나의 여행 일정':'따로 작성하고 보관하는 여행 이야기'} action={<button className="header-action solid" onClick={onCreate} aria-label="새 여행"><Plus size={20}/></button>}/>
    <ScreenTabs label="내 여행과 여행기" items={[{id:'plans',label:<>내 여행<small>{plans.length}</small></>,tabId:'trip-plans-tab',panelId:'trip-library-panel'},{id:'journals',label:<>내 여행기<small>{journals.length}</small></>,tabId:'trip-journals-tab',panelId:'trip-library-panel'}]} value={view} onChange={value=>setView(value as 'plans'|'journals')}/>
    <p className="device-record-note">이 기기에 보관한 기록이에요. {account?.session.state === 'SIGNED_IN' ? '계정 동기화는 서버 연결 후 제공해요.' : '로그인하지 않아도 초안을 만들 수 있어요. 계정 저장·공개에는 로그인이 필요해요.'}</p>
    {!online && <p className="trip-offline-library" role="status">오프라인이에요. ‘오프라인 저장됨’ 여행은 저장한 사진도 볼 수 있어요. 새 정보와 길찾기는 인터넷 연결이 필요해요.</p>}
    <div role="tabpanel" id="trip-library-panel" aria-labelledby={view==='plans'?'trip-plans-tab':'trip-journals-tab'}>
      {view==='plans'?<>
        {drafts.length>0&&<JourneySection title="여행 준비 중" description="후보를 담고 마지막에 한 곳씩 골라요" journeys={drafts} onOpen={onOpen} onShare={onShare} onDelete={onDelete}/>}
        {ready.length>0&&<JourneySection title="내 여행 일정" description="DAY별 장소와 동선 · 비공개" journeys={ready} onOpen={onOpen} onShare={onShare} onDelete={onDelete}/>}
        {!plans.length&&<div className="empty"><MapIcon size={28}/><h2>가고 싶은 곳으로 시작해요</h2><p>음식점·카페만 담은 여행도 만들 수 있어요.<br/>작성한 여행기는 ‘내 여행기’에서 따로 볼 수 있어요.</p></div>}
        <button className="primary wide create-trip-button" onClick={onCreate}><Plus size={18}/>저장한 곳으로 여행 만들기</button>
      </>:journals.length?<JourneySection title="내 여행기" description="내 여행 일정과 별도로 작성한 기록" journeys={journals} onOpen={onOpen} onShare={onShare} onDelete={onDelete}/>:<div className="empty"><BookOpen size={28}/><h2>아직 작성한 여행기가 없어요</h2><p>내 여행을 열고 ‘여행기로 기록’를 누르면<br/>별도의 여행기 초안을 만들 수 있어요.</p><button className="outline" onClick={()=>setView('plans')}>내 여행 보기</button></div>}
    </div>
    <footer className="trip-library-footer"><button className="phase-three-trash-link" onClick={onTrash}><Trash2 size={15}/>휴지통</button></footer>
  </div>;
}

function JourneySection({ title, description, journeys, onOpen, onShare, onDelete }: { onDelete?: (id: string) => void; title: string; description: string; journeys: Journey[]; onOpen: (id: string) => void; onShare: (journey: Journey) => void }) {
  const copy=useUiCopy();
  return <section className="journey-section"><div className="section-heading"><div><h2>{title}</h2><p>{description}</p></div><span>{journeys.length}</span></div><div className="journey-list">{journeys.map((journey) => <div className="journey-with-credit" key={journey.id}><article className="journey-card">
    <button className="journey-main" onClick={() => onOpen(journey.id)}><img src={journey.cover} alt="" /><span className={`status-badge status-${journey.status.toLowerCase()}`}>{journey.visibility === 'PUBLIC' ? <Globe2 size={11} /> : <Lock size={11} />}{journey.isMine ? `${journey.recommendationKind === 'AI' ? copy("AI 추천 · ") : ''}${isPersonalPlan(journey)?journey.planStage==='DRAFT'?'준비 중':'내 여행':copy(statusLabel[journey.status])}` : `${journey.author}의 가이드`}</span><span className="journey-gradient" /><span className="journey-copy"><small>{journey.region} · {journey.duration}</small><strong>{journey.title}</strong><em>{journey.summary}</em><span><CalendarDays size={13} />{journey.dateRange}<i />{journeyPlaceCount(journey)}{copy("곳")}</span></span></button>
    {onDelete && journey.isMine && <button className="journey-share journey-trash" aria-label={`${journey.title} 휴지통으로 이동`} onClick={() => onDelete(journey.id)}><Trash2 size={16}/></button>}
    <button className="journey-share" onClick={() => onShare(journey)} aria-label={`${journey.title} 공유`}><Share2 size={17} /></button>
  </article>{isPersonalPlan(journey) && journey.isMine && journey.visibility === 'PRIVATE' && !journey.trash && <OfflineSavedBadge journey={journey}/>}</div>)}</div></section>;
}

function SavedPlaceCard({ place, placement, selection, onRemove, onAdd, onUse }: { onUse?: (place: Place) => void; selection?: { label: string; badge: string; included: boolean }; place: Place; placement?: { day: number; date: string; journeyTitle: string; count: number }; onRemove: (id: string) => void; onAdd: (place: Place) => void }) {
  const copy=useUiCopy();
  const { locale } = useLocale();
  const en = locale === 'en';
  const [detailOpen, setDetailOpen] = useState(false);
  const detailTrigger = useRef<HTMLButtonElement>(null);
  const placementLabel = onUse ? '약속·모임·여행에 활용' : selection?.label ?? (placement ? (en ? 'Manage placement' : copy("담김 확인·해제")) : (en ? 'Add to trip' : copy("여행에 담기")));
  const included = selection ? selection.included : Boolean(placement);
  const rowActionLabel = onUse ? '활용' : selection ? included ? (en ? 'Undo' : '해제') : selection.badge ? (en ? 'Move' : '이동') : (en ? 'Add' : '담기') : placement ? (en ? 'Manage' : '관리') : (en ? 'Add' : '담기');
  const removeFromSaved = () => {
    const row = detailTrigger.current?.closest('.saved-place-row');
    const neighbor = (row?.nextElementSibling ?? row?.previousElementSibling)?.querySelector<HTMLButtonElement>('.saved-place-row-main');
    setDetailOpen(false); onRemove(place.id);
    requestAnimationFrame(() => {
      const target = neighbor?.isConnected ? neighbor : document.querySelector<HTMLButtonElement>('.saved-page .interest-quick-filters button');
      target?.focus({ preventScroll: true });
    });
  };
  return <><article className={`saved-card saved-place-row ${included ? 'is-added-to-trip' : ''}`}>
    <button type="button" ref={detailTrigger} className="saved-place-row-main" aria-label={`${place.name} 상세보기`} aria-haspopup="dialog" onClick={() => setDetailOpen(true)}>
      <span className="saved-place-row-media">{place.image ? <img src={place.image} alt="" /> : <MapPin size={24} aria-hidden="true" />}</span>
      <span className="saved-place-row-copy">
        <strong className="saved-place-row-title">{place.name}</strong>
        <span className="saved-place-row-meta">{placeKindLabel[place.kind]} · {place.area}{(selection?.badge || (!selection && placement)) && <> · {selection ? selection.badge : placement!.count > 1 ? `${placement!.count}개 일정` : `DAY ${placement!.day}`}</>}</span>
        <span className="saved-place-row-intro">{place.hook ?? place.description}</span>
      </span>
    </button>
    <button type="button" className={`saved-place-row-add ${included ? 'is-added' : ''}`} onClick={() => onUse ? onUse(place) : onAdd(place)} aria-label={`${place.name}, ${placementLabel}`} title={placement ? `${placement.journeyTitle} · ${placement.date} · ${placementLabel}` : placementLabel}>{onUse ? <ChevronRight size={18} aria-hidden="true" /> : included ? <Check size={18} aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}<span>{rowActionLabel}</span></button>
  </article>{detailOpen && <SavedLandmarkDetailSheet place={place} onClose={() => setDetailOpen(false)} actions={<>{onUse && <button type="button" className="saved-place-remove" onClick={() => { setDetailOpen(false); onUse(place); }}><Users size={18}/>이 장소 활용</button>}<button type="button" className="saved-place-remove" onClick={removeFromSaved}><Bookmark size={18} aria-hidden="true" />{en ? 'Remove from saved places' : '관심 장소 저장 취소'}</button></>} />}</>;
}

function Saved({ places, journeys, viewerId, draft, onDraftChange, onCreate, onRemove, onAdd, onCollectionCreate, onRegisterPlace, onGoDiscover, onUsePlace }: { onUsePlace: (place: Place) => void; places: Place[]; journeys: Journey[]; viewerId: string; draft: SavedTripDraft; onDraftChange: (draft: SavedTripDraft) => void; onCreate: (journey: Journey) => string | null; onRemove: (id: string) => void; onAdd: (place: Place) => void; onCollectionCreate: (places: Place[]) => void; onRegisterPlace: () => void; onGoDiscover: () => void }) {
  const copy=useUiCopy();
  const { locale } = useLocale();
  const en = locale === 'en';
  const [displayMode, setDisplayMode] = useState<'list' | 'map'>('list');
  const [mapPlace, setMapPlace] = useState<Place | null>(null);
  const [visiblePlaceIds, setVisiblePlaceIds] = useState<string[] | null>(null);
  const filteredPlaces = visiblePlaceIds === null ? places : places.filter(place => visiblePlaceIds.includes(place.id));
  const [collapsedRegions, setCollapsedRegions] = useState<string[]>([]);
  const savedRegionNames = Array.from(new Set(filteredPlaces.map(landmarkRegion))).sort((a, b) => domesticRegionOrder.indexOf(a) - domesticRegionOrder.indexOf(b));
  const visibleSavedGroups = savedRegionNames.map((region) => ({ region, places: filteredPlaces.filter((place) => landmarkRegion(place) === region) }));
  const selectedPlaces = visibleSavedGroups.flatMap((group) => group.places);
  const placementsByPlace = useMemo(() => {
    const placements = new Map<string, { day: number; date: string; journeyTitle: string; count: number }>();
    journeys.filter((journey) => journey.isMine).forEach((journey) => journey.days.forEach((day) => day.places.forEach((place) => placements.set(place.id, { day: day.day, date: day.date, journeyTitle: journey.title, count: (placements.get(place.id)?.count ?? 0) + 1 }))));
    return placements;
  }, [journeys]);
  const toggleSavedRegion = (region: string) => setCollapsedRegions((current) => current.includes(region) ? current.filter((value) => value !== region) : [...current, region]);
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

  return <div className="page saved-page"><AppHeader action={<button className="header-action" aria-label="관심 장소 직접 추가" onClick={onRegisterPlace}><Plus size={20}/></button>} title={en ? "Saved places" : copy("저장 장소")} subtitle={en ? `${places.length} saved places` : `${places.length}곳 저장`} />
    <InterestCollections places={places} viewerId={viewerId} onAddToTrip={onAdd} onCreateTrip={onCollectionCreate} onExplore={onGoDiscover} onVisiblePlaceIdsChange={setVisiblePlaceIds}/>
    <SavedTripControls draft={draft} places={places} automaticPlaces={selectedPlaces} onChange={onDraftChange} onCreate={onCreate} browseControls={<div className="interest-view-toggle" role="group" aria-label="관심 장소 보기"><button type="button" aria-pressed={displayMode === 'list'} className={displayMode === 'list' ? 'active' : ''} onClick={() => setDisplayMode('list')}><BookOpen size={16}/>목록</button><button type="button" aria-pressed={displayMode === 'map'} className={displayMode === 'map' ? 'active' : ''} onClick={() => setDisplayMode('map')}><MapIcon size={16}/>지도</button><span aria-live="polite">{selectedPlaces.length}곳</span></div>} />
    {displayMode === 'map' && <InterestPlacesMap places={selectedPlaces} onSelectPlace={setMapPlace}/>}
    <div hidden={displayMode !== 'list'}>
    {places.length ? <><div className="saved-region-groups">{!visibleSavedGroups.length && <p className="saved-filter-empty">선택한 조건에 맞는 장소가 없어요.</p>}{visibleSavedGroups.map(({ region, places: regionPlaces }) => { const collapsed = collapsedRegions.includes(region); return <section className="saved-region-section" key={region}><button type="button" className="saved-region-heading" onClick={() => toggleSavedRegion(region)} aria-expanded={!collapsed}><span><strong>{region}</strong><small>{regionPlaces.length}{copy("곳")}</small></span><span>{regionPlaces.map((place) => place.name).join(' · ')}</span>{collapsed ? <ArrowDown size={17} /> : <ArrowUp size={17} />}</button>{!collapsed && <div className="saved-list">{regionPlaces.map((place) => <SavedPlaceCard key={place.id} place={place} placement={placementsByPlace.get(place.id)} selection={selectionFor(place)} onRemove={onRemove} onAdd={pick} onUse={draft.active ? undefined : onUsePlace} />)}</div>}</section>; })}</div></> : <div className="empty saved-empty"><span className="empty-icon"><Bookmark size={28} /></span><h2>{copy("내 장소를 더 담아보세요")}</h2><p>{copy("음식점·카페·숙소 등 마음에 드는 장소를 저장하면")}<br />{copy("저장한 장소로 약속을 만들거나 모임에 제안할 수 있어요.")}</p><button className="outline" onClick={onGoDiscover}><Compass size={17} />{copy("장소 둘러보기")}</button></div>}
    </div>
    <p className="device-record-note">이 기기에 저장한 장소예요. 계정의 저장 목록과 자동으로 합쳐지지 않아요.</p>
    {mapPlace && <SavedLandmarkDetailSheet place={mapPlace} onClose={() => setMapPlace(null)} actions={<button type="button" className="saved-place-remove" onClick={() => { const selected = mapPlace; setMapPlace(null); onUsePlace(selected); }}><Users size={18}/>이 장소 활용</button>}/>}
  </div>;
}

function CreatorBadge({ copyCount, compact = false }: { copyCount: number; compact?: boolean }) {
  const copy=useUiCopy();
  const { state: reviewState } = usePublicReview();
  const tier = getCreatorTier(copyCount, reviewState.references);
  const TierIcon = tier.icon;
  return <span className={`creator-tier-badge ${compact ? 'compact' : ''}`}><TierIcon size={compact ? 11 : 13} />{copy(compact ? tier.shortLabel : tier.label)}</span>;
}

function JourneySocialSection({ journey, comments, cheers, profile, myCopyCount, onComment, onCheer, commentValue, onCommentValue, onGuestAction }: { journey: Journey; comments: JourneyComment[]; cheers: JourneyCheers; profile: CreatorProfile; myCopyCount: number; onComment: (body: string) => boolean; onCheer: (cheer: CheerKey) => void; commentValue?: string; onCommentValue?: (value: string) => void; onGuestAction?: () => void }) {
  const copy=useUiCopy();
  const { state: reviewState } = usePublicReview();
  const account = useAccount(), member = account?.session.state === 'SIGNED_IN' ? account.session.user : null;
  const [ownDraft, setOwnDraft] = useState('');
  const commentDraft = commentValue ?? ownDraft, setCommentDraft = onCommentValue ?? setOwnDraft;
  const visibleComments = [...new Map([...reviewState.comments.filter(c => c.journalId === journey.id && !c.cardId && c.moderation === 'VISIBLE').map(c => ({ id: c.commentId, journeyId: c.journalId, author: c.authorName ?? c.authorId, body: c.original, createdAt: c.createdAt, avatar: c.authorAvatar, authorCopies: 0, authorId: c.authorId })), ...comments].filter(c => !reviewState.commentModeration.some(m => m.id === c.id && m.state !== 'VISIBLE')).map(c => [c.id, c])).values()].sort((left, right) => journalCommentTime(right) - journalCommentTime(left));
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!commentDraft.trim()) return;
    if (!member) onGuestAction?.();
    if (onComment(commentDraft)) setCommentDraft('');
  };
  return <section className="journey-social" aria-labelledby="journey-social-title">
    <header><div><small>TRAVELER REACTIONS</small><h2 id="journey-social-title">{copy("이 여행에 남긴 응원")}</h2></div><span><MessageCircle size={15} />{visibleComments.length}</span></header>
    <div className="quick-cheers">{cheerOptions.map(({ id, label, icon: Icon }) => <button key={id} className={member && cheers.selections?.[member.id] === id ? 'active' : ''} onClick={() => { if (!member) onGuestAction?.(); onCheer(id); }} aria-pressed={Boolean(member && cheers.selections?.[member.id] === id)}><Icon size={16} fill={member && cheers.selections?.[member.id] === id ? 'currentColor' : 'none'} /><strong>{copy(label)}</strong><span>{cheers[id].toLocaleString()}</span></button>)}</div>
    <div className="comment-list">{visibleComments.length ? visibleComments.map((comment) => <article className="journey-comment" key={comment.id}><CreatorAvatar name={comment.author} image={comment.avatar} size="small" /><div><div className="comment-author"><CreatorBadge copyCount={comment.authorCopies} compact /><strong>{comment.author}</strong><time>{comment.createdAt}</time>{journey.visibility === 'PUBLIC' && journey.status === 'PUBLISHED' && journey.purpose !== 'PLAN' && !journey.trash && !(member && comment.authorId === member.id) && !(comment.authorId === undefined && comment.author === profile.displayName) && <ReportButton iconOnly label="댓글 신고" target={{ type: 'COMMENT', id: comment.id, label: `${comment.author} · 댓글`, journey, comment: reviewState.comments.find(item => item.commentId === comment.id && item.journalId === journey.id && !item.cardId) ?? { commentId: comment.id, revision: 1, journalId: journey.id, authorId: comment.authorId ?? `public-author:${comment.author}`, authorName: comment.author, authorAvatar: comment.avatar, original: comment.body, english: '', createdAt: Number.isFinite(Date.parse(comment.createdAt)) ? new Date(comment.createdAt).toISOString() : new Date().toISOString(), moderation: 'VISIBLE', sourceKind: 'PUBLIC_SAMPLE' } }} />}</div><TranslationText sourceId={`journal-comment:${comment.id}`} sourceVersion={sourceVersion(comment.body)} text={comment.body} kind="comment" /></div></article>) : <div className="comment-empty"><Heart size={21} /><strong>{copy("첫 응원을 남겨보세요")}</strong><span>{copy("좋았던 점 한마디가 작성자에게 다음 여행을 올릴 힘이 됩니다.")}</span></div>}</div>
    <form className="comment-composer" onSubmit={submit}>{member ? <CreatorAvatar name={member.displayName} size="small" /> : <span className="guest-comment-avatar"><CircleUserRound size={28} aria-hidden="true" /></span>}<label><span className="sr-only">{copy("댓글 작성")}</span><input value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} maxLength={180} placeholder={copy("좋았던 점을 따뜻하게 남겨주세요")} aria-label={copy("댓글 작성")} /></label><button type="submit" disabled={!commentDraft.trim()}>{copy("등록")}</button></form>
    <p className="social-kind-note">{member ? '댓글·응원은 현재 이 기기의 검수 기록이에요. 실제 전송은 서버 연결 후 제공해요.' : '댓글·응원은 로그인 후 남길 수 있어요. 입력한 내용은 로그인 창을 닫아도 유지돼요.'}</p>
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
    <div className="detail-creator-card"><CreatorAvatar name={name} image={avatar} size="large" /><div className="detail-creator-copy">{journey.publicSourceKind !== 'EDITORIAL' && <CreatorBadge copyCount={copyCount} />}<h2 id="detail-creator-title">{name}</h2><p>{journey.isMine ? profile.bio : `${journey.region}을 비롯한 국내 여행의 장면과 동선을 기록합니다.`}</p></div><div className="detail-creator-numbers"><span><strong>{copyCount.toLocaleString()}</strong>{copy("누적 담김")}</span><span><strong>{publicJourneys.length}</strong>{copy("공개 여행기")}</span></div></div>
    <div className="creator-journey-heading"><strong>{copy("이 작성자의 여행기")}</strong><span>{publicJourneys.length}{copy("개")}</span></div>
    {publicJourneys.length ? <div className="creator-journey-list">{publicJourneys.slice(0, 4).map((item) => <button key={item.id} onClick={() => onOpenJourney(item.id)}><img src={item.cover} alt="" /><span><small>{item.region} · {item.duration}</small><strong>{item.title}</strong><em><Copy size={12} />{item.saves.toLocaleString()}{copy("명이 담아감")}</em></span><ChevronRight size={17} /></button>)}</div> : <div className="creator-journey-empty"><Globe2 size={22} /><strong>{copy("아직 공개한 여행기가 없어요")}</strong><p>{copy("여행기를 공개하면 담김 수와 응원을 받을 수 있습니다.")}</p></div>}
  </section>;
}

function JourneyDetail({ journey, initialDay = 1, initialSocialEntry, socialRequestId, onCloseSocialEntry, profile, comments, cheers, authorJourneys, onBack, onShare, onSharePlace, onEdit, onCopy, onComment, onCheer, onOpenJourney, onTogether, copyLabel = '이 여행 복사해서 만들기' }: { journey: Journey; initialDay?: number; initialSocialEntry?: 'journey-comment' | 'journey-cheer'; socialRequestId?: string; onCloseSocialEntry?: () => void; profile: CreatorProfile; comments: JourneyComment[]; cheers: JourneyCheers; authorJourneys: Journey[]; onBack: () => void; onShare: () => void; onSharePlace: (place: Place) => void; onEdit: () => void; onCopy: () => void; onComment: (body: string) => boolean; onCheer: (cheer: CheerKey) => void; onOpenJourney: (id: string) => void; onTogether?: () => void; copyLabel?: string }) {
  const copy=useUiCopy();
  const [selectedDay, setSelectedDay] = useState(journey.days.some(day => day.day === initialDay) ? initialDay : journey.days[0]?.day ?? 1);
  const [socialSheet, setSocialSheet] = useState(initialSocialEntry), [socialCommentDraft, setSocialCommentDraft] = useState('');
  useEffect(() => { if (initialSocialEntry) setSocialSheet(initialSocialEntry); }, [initialSocialEntry, socialRequestId]);
  const closeSocialSheet = () => { setSocialSheet(undefined); onCloseSocialEntry?.(); };
  const cardSocial = useCardSocialStore();
  const dayHeadingRef = useRef<HTMLElement>(null);
  const day = journey.days.find((item) => item.day === selectedDay) ?? journey.days[0];
  const myCopyCount = authorJourneys.filter((item) => item.isMine && item.status === 'PUBLISHED').reduce((sum, item) => sum + item.saves, 0);
  const authorCopyCount = authorJourneys.filter((item) => item.status === 'PUBLISHED').reduce((sum, item) => sum + item.saves, 0);
  const selectDay = (dayNumber: number) => {
    setSelectedDay(dayNumber);
    window.requestAnimationFrame(() => dayHeadingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const read = (field: string, text: string, as: 'p' | 'h1' | 'h2' | 'h3' = 'p', className?: string) => <TranslationText sourceId={`${journey.id}:${field}`} sourceVersion={sourceVersion(text)} text={text} kind="journal" as={as} className={className} />;
  return <ContentTranslationScope><div className="journey-detail">
    <header className="detail-topbar"><button onClick={onBack} aria-label={copy("뒤로")}><ArrowLeft size={21} /></button><strong>{journey.isMine ? copy("내 여행기") : journey.recommendationKind === 'AI' ? copy("AI 추천 여행") : copy("여행 가이드")}</strong><button onClick={journey.isMine ? onEdit : onShare} aria-label={journey.isMine ? copy("여행기 편집") : copy("여행 공유")}>{journey.isMine ? <Edit3 size={19} /> : <Share2 size={20} />}</button></header>
    <section className="detail-hero"><img src={journey.cover} alt="" /><div className="detail-hero-shade" /><div className="detail-title"><span>{journey.region} · {journey.duration}</span>{read('title', journey.title, 'h1')}<p>{journey.dateRange}</p></div></section>
    {journey.isMine && onTogether && <button className="journey-together-entry" onClick={onTogether}><Users size={18}/>모임에 여행기 공유</button>}<section className="journal-lead"><PhotoCredit image={journey.cover} /><ContentLanguageControls />{journey.publicSourceKind === 'EDITORIAL' && <p className="local-data-note">{copy("운영 추천 여행기 · 공개 장소 자료로 구성한 제안 일정이며 실제 방문 후기가 아닙니다.")}</p>}{journey.recommendationKind === 'AI' && <p className="local-data-note"><Sparkles size={13} />{' '}{copy("AI 추천 여행 ·")}{' '}{journey.recommendationBasis === 'OFFICIAL_SOURCE_SAMPLE' ? copy("공식 자료로 구성한 샘플") : copy("로컬 추천으로 만든 초안")}</p>}<div className="author-line"><CreatorAvatar name={journey.isMine ? profile.displayName : journey.author} image={journey.isMine ? profile.avatar : undefined} size="medium" /><div><span className="author-name-row">{journey.publicSourceKind === 'EDITORIAL' ? <span className="creator-tier-badge compact">{copy("운영 추천 여행기")}</span> : <CreatorBadge copyCount={authorCopyCount} compact />}<strong>{journey.isMine ? profile.displayName : journey.author}</strong></span><small>{journey.visibility === 'PUBLIC' ? copy("전체 공개 여행일기") : copy("나만 보는 여행 초안")}</small></div><button onClick={onShare}><Share2 size={16} />{copy("공유")}</button></div>{journey.sourceAuthor && <div className="copied-source"><Copy size={14} />{journey.sourceAuthor}{copy("의 여행기를 복사해 만든 내 버전")}</div>}{read('summary', journey.summary, 'p', 'summary')}{read('story', journey.story, 'p', 'story')}<div className="guide-facts"><div><small>{copy("전체 일정")}</small><strong>{journey.duration}</strong></div><div><small>{copy("기록 장소")}</small><strong>{journeyPlaceCount(journey)}{copy("곳")}</strong></div><div><small>{copy("가이드 구성")}</small><strong>{journey.days.length}{copy("개 DAY")}</strong></div></div><div className="journal-meta"><span><Eye size={14} />{(journey.views ?? 0).toLocaleString()}{copy("회 조회")}</span><span><Copy size={14} />{journey.saves.toLocaleString()}{copy("명이 담아감")}</span><span><MessageCircle size={14} />{copy("댓글")}{' '}{comments.length}{copy("개")}</span><span><MapPin size={14} />{journeyPlaceCount(journey)}{copy("개 장소")}</span></div><p className="local-data-note">{copy("로컬 미리보기 · 조회·담김 수와 댓글에는 샘플이 포함되어 있으며 실제 사용자 집계가 아닙니다.")}</p><div className="journal-tags">{journey.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div></section>
    <DayNavigation days={journey.days} selectedDay={selectedDay} onSelect={selectDay} onBack={onBack} />
    {day && <>
      <section className="day-heading" ref={dayHeadingRef}><small>DAY {day.day} · {day.date}</small>{read(`${day.dayId ?? day.day}:title`, day.title, 'h2')}{read(`${day.dayId ?? day.day}:story`, day.story)}</section>
      {day.blocks.length > 0
        ? <article className="guide-story">{day.blocks.map((block) => <div className="journal-content-card" key={block.id}>{block.type === 'TEXT'
          ? <section className="story-text-block" key={block.id}>{block.heading && read(`${block.id}:heading`, block.heading, 'h3')}{read(block.id, block.body ?? '')}</section>
          : block.type === 'IMAGE'
            ? <JournalPhotos block={block}/>
            : <GuidePlaceEmbed journey={journey} key={block.id} place={day.places.find((place) => block.visitId ? place.visitId === block.visitId : place.id === block.placeId)} onShare={onSharePlace} social={{journeyId:journey.id,blockId:block.id}} showImage={!(journey.recommendationBasis === 'OFFICIAL_SOURCE_SAMPLE' && Boolean(block.visitId) && day.blocks.some((item) => item.type === 'IMAGE' && item.visitId === block.visitId))} />
        }</div>)}</article>
        : !day.places.length && <div className="empty-day"><MapPin size={26} /><strong>{copy("아직 작성한 이야기가 없습니다")}</strong><p>{copy("글과 사진을 먼저 넣고, 필요한 장소는")}<br />{copy("직접 등록하거나 목록에서 골라보세요.")}</p></div>}
      {day.places.length > 0 && <section className="day-route-section"><div className="day-route-title"><small>ROUTE MAP</small><h3>{copy("이날의 동선 한눈에 보기")}</h3></div><RouteMap key={`${journey.id}-${day.day}`} places={day.places} /><section className="route-summary"><Route size={17} /><div><strong>{copy("이날의 이동 방향")}</strong><span>{day.places.map((place) => place.name).join(' → ')}</span></div></section></section>}
    </>}
    <PublicSourceNotes journey={journey} />
    {socialSheet ? <BottomSheet title={socialSheet === 'journey-comment' ? '여행기 전체 댓글' : '여행기 응원'} description={journey.title} onClose={closeSocialSheet}><p className="plan-help">이 공개 여행기 전체에 남긴 댓글과 응원이에요. 직접 등록하기 전에는 반응을 남기지 않아요.</p><JourneySocialSection journey={journey} comments={comments} cheers={cheers} profile={profile} myCopyCount={myCopyCount} onComment={onComment} onCheer={onCheer} commentValue={socialCommentDraft} onCommentValue={setSocialCommentDraft} onGuestAction={closeSocialSheet} /></BottomSheet> : <JourneySocialSection journey={journey} comments={comments} cheers={cheers} profile={profile} myCopyCount={myCopyCount} onComment={onComment} onCheer={onCheer} commentValue={socialCommentDraft} onCommentValue={setSocialCommentDraft} />}
    <CreatorJourneySection journey={journey} profile={profile} authorJourneys={authorJourneys} onOpenJourney={onOpenJourney} />
    <JournalReportButton journey={journey} comments={comments} threads={cardSocial} selfName={profile.displayName} />
    <footer className={`detail-footer ${journey.isMine ? 'owner-footer' : 'reader-footer'}`}>{journey.isMine
      ? <><button onClick={onEdit}><Edit3 size={18} />{copy("이 여행기 이어서 쓰기")}</button></>
      : <><button className="share-small" onClick={onShare} aria-label={copy("여행기 공유")}><Share2 size={18} /></button><button onClick={onCopy}><Copy size={18} />{copyLabel}</button></>
    }</footer>
  </div></ContentTranslationScope>;
}

function GuidePlaceEmbed({ place, journey, onShare, showImage = true, preview = false, social }: { place?: Place; journey?: Journey; onShare: (place: Place) => void; showImage?: boolean;preview?:boolean;social?:{journeyId:string;blockId:string} }) {
  const copy=useUiCopy();
  if (!place) return null;
  const Icon = kindIcon[place.kind];
  return <aside className="guide-place-embed">{showImage && place.image && <img src={place.image} alt="" />}<div className="guide-place-copy">{showImage && <PhotoCredit image={place.image} />}<div className="place-kind"><Icon size={13} />{placeKindLabel[place.kind]}</div><TranslationText as="h3" sourceId={`place:${place.id}:name`} sourceVersion={sourceVersion(place.name)} text={place.name} kind="journal" /><div className="guide-place-time"><Clock3 size={14} />{place.time ? `${place.time} 도착 · ${place.duration} 체류` : place.duration}</div><TranslationText sourceId={`place:${place.id}:description`} sourceVersion={sourceVersion(place.description)} text={place.description} kind="journal" />{place.note&&<blockquote>“<TranslationText as="span" sourceId={`place:${place.id}:note`} sourceVersion={sourceVersion(place.note)} text={place.note} kind="journal" />”</blockquote>}{!preview&&<div><button onClick={() => openExternal(naverDirectionsUrl(place))}><Navigation size={15} />{copy("길찾기")}</button><button onClick={() => onShare(place)}><Share2 size={15} />{copy("공유")}</button></div>}</div> {!preview&&social&&<CardSocial {...social} placeName={place.name}/>}</aside>;
}

function JourneyEditor({ journey, initialDay, initialEntry, onBack, onSave, onDraft }: { journey: Journey; initialDay?: number; initialEntry?: ChatbotEntry; onBack: () => void; onSave: (journey: Journey) => boolean; onDraft:(journey:Journey,view?:{selectedDay:number;scrollTop:number})=>boolean }) {
  const account = useAccount();
  const copy=useUiCopy();
  const [draft, renderDraft] = useState<Journey>(() => normalizePlan(journalDraftValue(journey)));
  const draftRef=useRef(draft),history=useRef<Journey[]>([]),future=useRef<Journey[]>([]);
  const [draftError,setDraftError]=useState(''),[draftStatus,setDraftStatus]=useState(journey.editorDraft?copy("이어서 쓰던 내용을 복구했어요."):'');
  const [blockTransfer,setBlockTransfer]=useState<{id:string;target:string;copy:boolean}|null>(null);
  const [previewing,setPreviewing]=useState(initialEntry === 'journal-preview' || initialEntry === 'journal-visibility');
  const persistDraft=(next:Journey)=>{draftRef.current=next;renderDraft(next);const ok=onDraft(next,{selectedDay:selectedDayRef.current,scrollTop:document.querySelector('.content')?.scrollTop??0});setDraftError(ok?'':copy("작성 내용을 저장하지 못했어요. 이 화면에서 다시 저장해 주세요."));setDraftStatus(ok?copy("작성 중 내용을 저장했어요."):'');return ok;};
  const setDraft=(action:Journey|((current:Journey)=>Journey))=>{const next=typeof action==='function'?action(draftRef.current):action;history.current=[...history.current.slice(-4),draftRef.current];future.current=[];persistDraft(next);};
  const saveFinal=()=>{try{const next=finishJournalDraft(draftRef.current);if(next.visibility==='PUBLIC'&&next.status==='PUBLISHED'&&account?.session.state!=='SIGNED_IN'){setPreviewing(false);account?.openAccount('login','여행기 공개에는 로그인이 필요해요.');return;}if(!onSave(next))setDraftError('저장하지 못했어요. 작성한 내용을 유지하고 있어요.');}catch(error){setDraftError(error instanceof Error?error.message:copy("저장하지 못했어요."));}};
  const [selectedDay, renderDay] = useState(journey.days.some(day => day.day === initialDay) ? initialDay! : journey.editorDraft?.selectedDay ?? (journey.sourceTripId ? journey.days.find(day => day.places.length || day.blocks.length || day.story.trim())?.day : undefined) ?? journey.days[0]?.day ?? 1);
  const selectedDayRef=useRef(selectedDay);
  const setSelectedDay=(next:number)=>{selectedDayRef.current=next;renderDay(next);persistDraft(draftRef.current);};
  const leaveEditor=()=>{if(persistDraft(draftRef.current))onBack();};
  useEffect(()=>{const frame=requestAnimationFrame(()=>{const content=document.querySelector('.content');if(content&&journey.editorDraft?.scrollTop)content.scrollTop=journey.editorDraft.scrollTop;});return ()=>cancelAnimationFrame(frame);},[]);
  useEffect(()=>{if(!draftError)return;const preventLoss=(event:BeforeUnloadEvent)=>event.preventDefault();window.addEventListener('beforeunload',preventLoss);return ()=>window.removeEventListener('beforeunload',preventLoss);},[draftError]);
  const [pickerKind, setPickerKind] = useState<PlaceKind | null>(null);
  const day = draft.days.find((item) => item.day === selectedDay) ?? draft.days[0];
  const entryFocus = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!initialEntry || initialEntry === 'journal-preview' || initialEntry === 'journal-visibility') return; const frame = requestAnimationFrame(() => entryFocus.current?.scrollIntoView({ block: 'start' })); return () => cancelAnimationFrame(frame); }, [initialEntry]);

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
    <ScreenHeader variant="editor" title={copy("여행기 작성")} context={draft.sourceAuthor ? `${draft.sourceAuthor}의 가이드에서 복사됨` : undefined} leading={<button type="button" onClick={leaveEditor} aria-label={copy("작성 중 내용을 남기고 뒤로")}><ArrowLeft size={20}/></button>} actions={<button type="button" className="screen-header__text-action screen-header__primary-action" onClick={()=>setPreviewing(true)}>{copy("미리보기")}</button>}/>
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
    {initialEntry && !['journal-preview', 'journal-visibility'].includes(initialEntry) && <div ref={entryFocus} className="chatbot-journal-entry" role="region" aria-label="챗봇에서 연결한 여행기 작업"><p className="plan-help">DAY {day.day} · {initialEntry === 'journal-text' ? '글 카드를 직접 추가해 작성하세요.' : initialEntry === 'journal-photos' ? '사진 카드를 추가한 뒤 기기 사진을 직접 선택하세요. 서버로 자동 업로드하지 않아요.' : '저장해 두었던 초안을 이어 씁니다. 아래 되돌리기·다시 실행은 이번 편집 내역에 적용돼요.'}</p>{initialEntry === 'journal-text' && <Button onClick={addTextBlock}>DAY {day.day}에 글 추가</Button>}{initialEntry === 'journal-photos' && <Button onClick={addImageBlock}>DAY {day.day}에 사진 카드 추가</Button>}</div>}
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

function PlacePicker({ kind, region, personalPlan = false, interest = false, onKindChange, onClose, onSelect }: { kind: PlaceKind; region: string; personalPlan?: boolean; interest?: boolean; onKindChange?: (kind: PlaceKind) => void; onClose: () => void; onSelect: (place: Place) => void }) {
  const { catalog: placeCatalog } = usePublicReview();
  const copy=useUiCopy();
  const [mode, setMode] = useState<'CUSTOM' | 'CATALOG'>('CUSTOM');
  const [registrationError, setRegistrationError] = useState('');
  const select = (place: Place) => { try { onSelect(place); } catch (failure) { setRegistrationError(failure instanceof Error ? failure.message : '저장하지 못했어요. 입력한 내용을 유지합니다.'); } };
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
    select({
      id: `custom-${kind.toLowerCase()}-${Date.now()}`,
      kind,
      name: custom.name.trim(),
      area: custom.area.trim() || region,
      address: custom.address.trim(),
      lat: Number.NaN,
      lng: Number.NaN,
      image: custom.image,
      photos: custom.image ? undefined : [],
      description: custom.description.trim() || (personalPlan ? '직접 입력한 개인 장소 · 등록 정보 미확인' : copy("직접 기록한 여행 장소입니다.")),
      note: custom.note.trim() || (personalPlan ? '' : copy("다녀온 뒤의 경험과 추천 포인트를 더 적어보세요.")),
      duration: custom.duration.trim() || (kind === 'STAY' ? copy("숙박") : copy("체류 시간 미입력")),
    });
  };
  return <BottomSheet title={interest ? "관심 장소 추가" : `${placeKindLabel[kind]} 삽입`} onClose={onClose}><section className="place-picker phase-embedded-sheet">
    {interest && onKindChange && <label className="interest-kind-picker">장소 종류<select value={kind} onChange={event => onKindChange(event.target.value as PlaceKind)}>{Object.entries(placeKindLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
    <div className="place-picker-tabs"><button className={mode === 'CUSTOM' ? 'active' : ''} onClick={() => setMode('CUSTOM')}>{copy("직접 등록")}</button>{!personalPlan&&<button className={mode === 'CATALOG' ? 'active' : ''} onClick={() => setMode('CATALOG')}>{copy("목록에서 선택")}</button>}</div>
    {mode === 'CUSTOM' ? <form className="custom-place-form" onSubmit={addCustomPlace}>
      <p>{interest ? '가고 싶은 장소를 직접 저장해요. 개인 메모는 모임에 자동 공유되지 않아요.' : personalPlan ? '이름·주소를 직접 입력해 선택한 DAY의 개인 일정 초안에 담아요. 등록 정보와 좌표는 미확인이며 예약을 만들지 않아요.' : copy("모든 업체를 미리 등록할 필요 없이, 직접 다녀온 정보를 여행기에 남기세요.")}</p>
      <label className={`custom-photo-field ${custom.image ? 'has-image' : ''}`}>{custom.image ? <img src={custom.image} alt="등록할 장소" /> : <><ImagePlus size={22} /><span>{placeKindLabel[kind]}{' '}{copy("사진 추가")}</span></>}<input type="file" accept="image/*" capture="environment" onChange={(event) => void handleCustomImage(event)} /></label>
      <label><span>{placeKindLabel[kind]}{' '}{copy("이름 *")}</span><input required value={custom.name} onChange={(event) => updateCustom('name', event.target.value)} placeholder={kind === 'STAY' ? copy("예: 바다 앞 작은 펜션") : copy("장소 이름")} /></label>
      <div className="custom-place-row"><label><span>{copy("지역")}</span><input value={custom.area} onChange={(event) => updateCustom('area', event.target.value)} placeholder={copy("예: 부산 해운대")} /></label><label><span>{kind === 'STAY' ? copy("숙박 형태") : copy("머문 시간")}</span><input value={custom.duration} onChange={(event) => updateCustom('duration', event.target.value)} placeholder={kind === 'STAY' ? copy("1박") : copy("약 1시간")} /></label></div>
      <label><span>{copy("주소")}</span><input value={custom.address} onChange={(event) => updateCustom('address', event.target.value)} placeholder={copy("주소를 입력하면 길찾기 검색에 사용합니다")} /></label>
      <label><span>{copy("정보 소개")}</span><textarea rows={2} value={custom.description} onChange={(event) => updateCustom('description', event.target.value)} placeholder={kind === 'STAY' ? copy("객실, 위치, 주변 동선 등 기본 정보를 적어주세요.") : copy("어떤 곳인지 간단히 소개해 주세요.")} /></label>
      <label><span>{copy("내 경험과 추천 포인트")}</span><textarea rows={3} value={custom.note} onChange={(event) => updateCustom('note', event.target.value)} placeholder={kind === 'STAY' ? copy("실제로 묵어보니 좋았던 점, 체크인 팁 등을 적어주세요.") : copy("직접 다녀와서 알게 된 팁을 적어주세요.")} /></label>
      {registrationError && <p className="ui-error" role="alert">{registrationError}</p>}<button className="primary custom-place-submit" type="submit"><Plus size={17} />{placeKindLabel[kind]}{' '}{interest ? "관심 장소에 저장" : copy("카드 추가")}</button>
    </form> : <><p>{copy("준비된 항목은 빠르게 고르는 보조 목록입니다. 없으면 직접 등록하세요.")}</p><div className="picker-list">{candidates.map((place) => <button key={place.id} onClick={() => onSelect(place)}><img src={place.image} alt="" /><span><strong>{place.name}</strong><small>{place.area} · {place.address}</small></span><Plus size={17} /></button>)}</div></>}
  </section></BottomSheet>;
}

const kindIcon: Record<PlaceKind, LucideIcon> = { LANDMARK: MapPin, STAY: Hotel, FOOD: Utensils, CAFE: Coffee, SHOP: Store, LEISURE: Footprints };

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

function Profile({ initialEntry, entryRequestId, native, journeys, comments, cheers, profile, notificationPreferences, notificationPermission, onBack, onDeviceTrips, onProfileChange, onNotificationPreferencesChange, onPreviewNotification, onOpen }: { initialEntry?: 'profile-summary' | 'profile-activity'; entryRequestId?: string; native: boolean; journeys: Journey[]; comments: JourneyComment[]; cheers: CheerStore; profile: CreatorProfile; notificationPreferences: NotificationPreferences; notificationPermission: 'granted' | 'denied' | 'undetermined'; onBack: () => void; onProfileChange: (profile: CreatorProfile) => boolean; onNotificationPreferencesChange: (preferences: NotificationPreferences) => void; onPreviewNotification: () => void; onDeviceTrips: () => void; onOpen: (id: string) => void }) {
  const copy=useUiCopy();
  const { locale } = useLocale();
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const account = useAccount()!;
  const member = account.session.state === 'SIGNED_IN' ? account.session.user : null;
  const devicePreview = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (!initialEntry || !member || !devicePreview.current) return;
    devicePreview.current.open = true;
    const frame = window.requestAnimationFrame(() => devicePreview.current?.querySelector(initialEntry === 'profile-activity' ? '.profile-stats' : '.creator-profile-card')?.scrollIntoView({ block: 'start', behavior: 'instant' }));
    return () => window.cancelAnimationFrame(frame);
  }, [initialEntry, entryRequestId, member?.id]);
  const [privacyOpen,setPrivacyOpen]=useState(false);
  const mine = journeys.filter((journey) => journey.isMine && !isPersonalPlan(journey));
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
  const { state: reviewState } = usePublicReview();
  const tier = getCreatorTier(copyCount, reviewState.references);
  const TierIcon = tier.icon;
  const nextTier = getNextCreatorTier(copyCount, reviewState.references);
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

  if (!member) return <div className="page profile-page guest-profile-page">
    <ScreenHeader variant="detail" title="내 계정" leading={<button type="button" onClick={onBack} aria-label="홈으로 돌아가기"><ArrowLeft size={21}/></button>}/>
    <section className="guest-profile-card">
      <CircleUserRound size={44} aria-hidden="true" />
      <h2>{account.status === 'CHECKING' ? '계정을 확인하고 있어요' : '로그인하고 여행을 이어가세요'}</h2>
      <p>공개 장소와 여행기는 바로 둘러볼 수 있어요.<br />{account.adapter.reviewAccount ? '검수 계정으로 로그인해 댓글·응원·여행 화면을 확인할 수 있어요.' : '로그인하면 댓글·응원을 남기고 내 여행을 계정에 보관할 수 있어요.'}</p>
      {account.status === 'ERROR' && <ErrorPage inline kind={account.failureKind ?? 500} onRetry={account.refresh} onHome={onBack} />}
      <Button disabled={account.status === 'CHECKING'} onClick={() => account.openAccount('login')}>로그인</Button>
      <Button variant="secondary" disabled={account.status === 'CHECKING'} onClick={() => account.openAccount('signup')}>회원가입</Button>
      <p className="guest-signin-options">카카오 · 네이버 · Google · Apple · 이메일</p>
    </section>
    <section className="guest-device-card"><h2>이 기기에 보관한 여행</h2><p>기존 장소·여행·작성 중인 내용을 그대로 이어볼 수 있어요. 아직 계정에 연결한 기록은 아니에요.</p><Button variant="secondary" onClick={onDeviceTrips}>기기 기록 보기</Button></section>
    <button className="phase-three-profile-settings" onClick={() => setPrivacyOpen(true)}><ShieldCheck size={16} />약관 · 개인정보</button>
    {privacyOpen && <PrivacySheet onClose={() => setPrivacyOpen(false)} />}
  </div>;

  return <div className="page profile-page"><ScreenHeader variant="detail" title="내 계정" context={account.adapter.reviewAccount ? '검수 계정 로그인됨' : '로그인됨'} leading={<button type="button" onClick={onBack} aria-label={copy("홈으로 돌아가기")}><ArrowLeft size={21}/></button>}/>
    <section className="member-account-card"><CircleUserRound size={36} aria-hidden="true" /><div><h2>{member.displayName}</h2><p>{accountProviderName(member.provider)} 계정 · {member.email ?? '이메일 미제공'}</p>{account.adapter.reviewAccount && <p>화면 확인용 · 실제 서비스 회원 아님</p>}</div><Button variant="secondary" onClick={() => account.openAccount('manage')}>계정 관리 · 로그아웃</Button></section>
    <section className="guest-device-card"><h2>이 기기에 보관한 여행</h2><p>기기 기록은 그대로 유지돼요. 계정 동기화·실제 활동 통계는 서버 연결 후 제공해요.</p><Button variant="secondary" onClick={onDeviceTrips}>기기 기록 보기</Button></section>
    <details className="device-profile-preview" ref={devicePreview}><summary>기기 프로필 · 활동 미리보기</summary><p className="device-record-note">아래 이름·아이콘·등급·통계·알림은 기기 검수 자료예요. 로그인 계정의 프로필이나 실제 서버 집계와 연결되지 않았어요.</p>
    <div className="profile-card creator-profile-card"><label className="profile-avatar-upload"><CreatorAvatar name={profile.displayName} image={profile.avatar} size="large" /><span className="profile-avatar-edit"><Upload size={13} /></span><input type="file" accept="image/*" onChange={(event) => void handleAvatar(event)} aria-label={copy("내 프로필 아이콘 업로드")} /></label><div><div className="profile-name-row"><CreatorBadge copyCount={copyCount} /><h3>{profile.displayName}</h3></div><p>{profile.bio}</p><button onClick={() => document.querySelector<HTMLInputElement>('.profile-avatar-upload input')?.click()}><ImagePlus size={13} />{copy("내 아이콘 바꾸기")}</button></div></div>

    <div className="profile-stats creator-stats"><div><strong>{copyCount.toLocaleString()}</strong><span>{copy("누적 담김")}</span></div><div><strong>{(reactionTotal + receivedComments.length).toLocaleString()}</strong><span>{copy("받은 응원")}</span></div><div><strong>{creatorScore.toLocaleString()}</strong><span>{copy("창작 점수")}</span></div></div>

    <section className="creator-level-card"><header><div><small>CREATOR LEVEL</small><h2><TierIcon size={19} />{copy(tier.label)}</h2></div><strong>{copyCount.toLocaleString()}{copy("회 담김")}</strong></header><div className="creator-progress"><span style={{ width: `${levelProgress}%` }} /></div><p>{nextTier ? <><strong>{Math.max(0, nextTier.min - copyCount)}{copy("번")}</strong>{' '}{copy("더 담기면")}{' '}<b>{copy(nextTier.label)}</b>{' '}{copy("등급이 됩니다.")}</> : copy("최고 등급입니다. Spotlog를 대표하는 여행 가이드예요.")}</p></section>

    <section className={`creator-notification-card ${notificationPreferences.enabled ? 'is-enabled' : ''}`}><header><span className="notification-feature-icon">{notificationPreferences.enabled ? <Bell size={20} /> : <BellOff size={20} />}</span><div><small>CREATOR PUSH</small><h2>{copy("조회수 목표 알림")}</h2><p>{copy("내 여행기가 정한 조회수를 달성하면 앱 푸시로 알려드려요.")}</p></div><button className="notification-switch" role="switch" aria-label={copy("조회수 목표 알림")} aria-checked={notificationPreferences.enabled} onClick={() => onNotificationPreferencesChange({ ...notificationPreferences, enabled: !notificationPreferences.enabled })}><span /></button></header><div className="notification-permission"><span className={native && notificationPermission === 'granted' ? 'okay' : ''}>{notificationStatus}</span><em>{notificationPreferences.enabled ? native && notificationPermission === 'denied' ? copy("권한 필요") : copy("알림 켜짐") : copy("알림 꺼짐")}</em></div>{notificationPreferences.enabled && <div className="notification-options"><label><span>{copy("조회수 알림 기준")}</span><select value={notificationPreferences.viewMilestone} onChange={(event) => onNotificationPreferencesChange({ ...notificationPreferences, viewMilestone: Number(event.target.value) })} aria-label={copy("조회수 알림 기준")}><option value={100}>{copy("100회")}</option><option value={500}>{copy("500회")}</option><option value={1000}>{copy("1,000회")}</option><option value={5000}>{copy("5,000회")}</option><option value={10000}>{copy("10,000회")}</option></select></label><button onClick={onPreviewNotification}><Bell size={15} />{copy("테스트 푸시 받기")}</button></div>}<p className="notification-server-note">{copy("실제 서비스에서는 서버가 조회수를 집계하고 같은 목표에 한 번만 푸시를 발송합니다.")}</p></section>

    <section className="profile-reactions"><div className="profile-section-heading"><div><small>CREATOR BOOST</small><h2>{copy("받은 응원")}</h2></div><span>{reactionTotal + receivedComments.length}</span></div><div className="profile-reaction-chips">{cheerOptions.map(({ id, label, icon: Icon }) => <div key={id}><Icon size={16} /><span>{copy(label)}</span><strong>{reactionCounts[id].toLocaleString()}</strong></div>)}</div>{receivedComments.length ? <div className="profile-feedback-list">{receivedComments.slice(-3).reverse().map((comment) => <blockquote key={comment.id}>“{comment.body}”<span>{comment.author}</span></blockquote>)}</div> : <div className="profile-feedback-empty"><MessageCircle size={22} /><strong>{copy("공개 여행기에 응원이 쌓여요")}</strong><p>{copy("“너무 좋아요”, “최고예요” 같은 반응과 댓글을 이곳에서 한눈에 볼 수 있습니다.")}</p></div>}</section>

    <section className="profile-journeys"><div className="profile-section-heading"><div><small>MY TRAVEL STORIES</small><h2>{copy("내 여행기")}</h2></div><span>{mine.length}</span></div>{mine.length ? <div>{mine.map((journey) => <button key={journey.id} onClick={() => onOpen(journey.id)}><img src={journey.cover} alt="" /><span><small>{journey.visibility === 'PUBLIC' ? copy("공개 여행기") : copy("비공개 초안")} · {journey.region}</small><strong>{journey.title}</strong><em><Eye size={12} />{(journey.views ?? 0).toLocaleString()} <i /> <Copy size={12} />{journey.saves.toLocaleString()}{copy("명")}{' '}<i /> <MessageCircle size={12} />{comments.filter((comment) => comment.journeyId === journey.id).length}</em></span><ChevronRight size={17} /></button>)}</div> : <div className="profile-feedback-empty"><MapIcon size={22} /><strong>{copy("첫 여행기를 만들어보세요")}</strong><p>{copy("여행을 공개하면 담김 수와 응원으로 창작 등급이 올라갑니다.")}</p></div>}</section>

    <button className="phase-three-profile-settings" onClick={() => setPreferencesOpen(true)}><Settings size={16}/>{locale === 'en' ? 'Profile & preferences' : copy("프로필 · 이용 설정")}</button>
    </details>
    <button className="phase-three-profile-settings" onClick={()=>setPrivacyOpen(true)}><ShieldCheck size={16}/>약관 · 개인정보</button>

    {privacyOpen&&<PrivacySheet onClose={()=>setPrivacyOpen(false)}/>}
    {preferencesOpen && <ProfilePreferencesSheet name={profile.displayName} onClose={() => setPreferencesOpen(false)} onSave={displayName => onProfileChange({...profile,displayName})} />}
    <div className="settings-list"><SettingRow icon={Globe2} label={copy("서비스 화면")} value={copy("모바일웹")} /><SettingRow icon={MapIcon} label={copy("여행 범위")} value={copy("대한민국")} /><SettingRow icon={Route} label={copy("지도·길찾기")} value="네이버 외부 길찾기" /><SettingRow icon={UserRound} label={copy("실행 환경")} value={native ? copy("Expo 앱") : copy("웹 브라우저")} /></div><p className="demo-note">{copy("댓글·응원·프로필 아이콘은 현재 이 기기에 저장됩니다. 실제 사용자 간 동기화는 서버 연결 시 동일한 화면 구조로 전환됩니다.")}</p></div>;
}

function SettingRow({ icon: Icon, label, value, active = false }: { icon: LucideIcon; label: string; value: string; active?: boolean }) {
  return <div><span className="setting-icon"><Icon size={18} /></span><strong>{label}</strong><span className={active ? 'active-value' : ''}>{value}</span><ChevronRight size={16} /></div>;
}

function AppHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return <ScreenHeader title={title} actions={<>{action}<AppMenuButton/></>} />;
}




