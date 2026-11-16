import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, BarChart3, Bell, BellOff, BookOpen, CalendarDays, Check, ChevronDown, ChevronRight, ClipboardList, Dices, Flag, Heart, ImagePlus, MapPin, MessageCircle, MoreHorizontal, Plus, Send, Smile, Sparkles, Trophy, Users, X } from 'lucide-react';
import type { Journey, Place } from '../data';
import { BottomSheet } from '../BottomSheet';
import { AppMenuButton } from '../AppMenu';
import { ScreenHeader, ScreenTabs } from '../ScreenHeader';
import { getPlacePhotos } from '../PhotoPlaceCard';
import { PhotoCredit } from '../PublicTourismCredit';
import { naverDirectionsUrl } from '../placeDirections';
import { addPlanDay, appendPlanPlace, canDragPlanVisit, movePlanVisitBefore, planVisitGroups, removePlanVisit, setPlanDates, setPlanStay } from '../tripPlan';
import { createTogetherRepository, type TogetherRepository } from './repository';
import GroupDiscovery, { PublicGroupHome, type GroupDiscoveryFilters } from './GroupDiscovery';
import { discoveryProfile, isDiscoverableGroup, publicActivities, publicActivityTimeKey, topicOptions, upcomingPublicActivities } from './discovery';
import { acceptInvite, canEditActivity, copyJourneyForGroup, createGroupFromJourney, removeGroupMember, restoreGroupMemberAccess, approveGroupApplication, rejectGroupApplication, setGroupParticipation, countGroupParticipants, unpublishActivityFromGroup, isShareableJourney, snapshotJourneyForGroup, isMember, memberName, roomIdForActivity, roomIdForGroup, togetherId, type GroupKind, type TogetherActivity, type TogetherGroup, type TogetherState } from './model';
import { createPublicActivityIntent, isPublicActivityIntent, joinPublicGroup, publicGroupJoinVersion, requestGroupApplication, resolvePublicActivityIntent } from './publicActivityIntent';
import { navigateAfterPublicJoin } from './joinNavigation';
import { captureWorkspaceReturn, navigateFromChat, resolveWorkspaceReturn, type WorkspaceReturn } from './workspaceReturn';
import { selectJoinOnboarding, selectPendingMemberships, type DirectJoinEntry } from './joinOnboarding';
import type { PublicActivityIntent } from './model';
import ChatWorkspace from './ChatWorkspace';
import { pageChatDraftMemory } from './chatDrafts';
import ConversationSummary from './ConversationSummary';
import { canReplyToMessage, postTogetherMessage, toggleMessageReaction } from './chatActions';
import { assertCurrentActivityEditor, changeActivityLifecycle } from './activityLifecycle';
import TemporaryRoomsPanel from './TemporaryRoomsPanel';
import { closeTemporaryRoom, restoreTemporaryRoom, temporaryRoomPurposeLabel } from './temporaryRooms';
import RoomBusinessWorkspace, { RoomBusinessDetail, type RoomBusinessWorkspaceProps } from './RoomBusinessWorkspace';
import TogetherDecisionPanel from './TogetherDecisionPanel';
import GroupTasteMap from './GroupTasteMap';
import PersonalRouteSummary from './PersonalRouteSummary';
import PersonalRoutePanel from './PersonalRoutePanel';
import { savePersonalRoute, removePersonalRoute, acknowledgePersonalRoute, selectPersonalRoutes } from './personalRoutes';
import VisitGuidePanel from './VisitGuidePanel';
import VisitGuideLink from './VisitGuideLink';
import { saveVisitGuide, publishVisitGuide, revokeVisitGuide } from './visitGuides';
import { createVisitGuidePublicStore, reconcileVisitGuidePublicStore } from './visitGuideStorage';
import { applyMeetingDecision, createMeetingDecision, submitDecisionResponse } from './meetingDecision';
import { upsertPlaceFeedback, withdrawPlaceFeedback, savePlaceMenu, withdrawPlaceMenu, type PlaceAssessmentScope } from './businessAssessments';
import { applyPollActivityApplication, previewPollActivityApplication, type PollActivityApplicationPreview } from './pollActivityApplication';
import { resolveJournalOrigin, type JournalShareRequest } from './journalOrigin';
import ActivityAssistant from './ActivityAssistantPanel';
import { applyActivityAssistantAction } from './activityAssistant';
import { buildMyGroupDirectory, type MyGroupDirectoryItem, type MyGroupKindFilter, type MyGroupSort } from './myGroupDirectory';
import { calendarIncludes, calendarMonthIntersects, calendarRange, normalizeCalendarView, selectPersonalCalendarPlans, type CalendarView } from './calendarPlans';
import CreationPlannerPanel from './CreationPlannerPanel';
import { holdCreationHandoff, peekCreationHandoff, retainCreationHandoff, takeCreationHandoff } from './creationHandoff';
import type { CreationPreviewDraft } from './creationPreview';
import PlanningSupportPanel from './PlanningSupportPanel';
import PlanningPlacePicker from './PlanningPlacePicker';
import { addPlanningPlaceCandidate } from './planningPlaces';
import { buildCreationJourney, commitCreation, createPlanningPoll, savePlanningFeedback } from './creationCommit';
import type { CreationBrief, CreationGroupDraft, CreationPlan } from './creationPlanner';
import { getPlanningSupportContext } from './planningSupport';
import { readRoomTask, shareChatEntity, toggleRoomTask, voteChatPoll, toggleChatTask } from './chatEntities';
import { closeRoomPoll, confirmRoomPoll, createRoomPoll, editRoomPoll, pollInputFrom, voteRoomPoll } from './polls';
import PollComposer from './PollComposer';
import PollView from './PollView';
import RoomGamesPanel from './RoomGamesPanel';
import { createRoomGame, rerunRoomGame } from './roomGames';
import ChallengesPanel from './ChallengesPanel';
import GroupCreationForm from './GroupCreationForm';
import GroupJoinForm from './GroupJoinForm';
import GroupProfileDetails from './GroupProfileDetails';
import GroupJoinSettingsForm from './GroupJoinSettingsForm';
import GroupSetupChecklist from './GroupSetupChecklist';
import RoomResourcesPanel from './RoomResourcesPanel';
import { selectRoomResources } from './roomResources';
import { readRecentGroups, rememberRecentGroup, clearRecentGroups, selectRecentGroups } from './recentGroups';
import { normalizeGroupJoinFields } from './groupJoining';
import { createConfiguredGroup, joinGroupWithProfile, approveGroupWithProfile } from './groupOnboarding';
import { groupSubtopicsFor, getGroupSubtopic, normalizeGroupSubtopics } from './groupTaxonomy';
import { createRoomChallenge, joinRoomChallenge, leaveRoomChallenge, certifyRoomChallenge, closeRoomChallenge, selectRoomChallenges } from './challenges';
import './creation-entry.css';
import './together.css';
import './group-workspace.css';
import './group-manage-menu.css';
import './publishing-workspaces.css';
import './participation-tools.css';
import { useConsumerDensity } from '../consumerDensity';
import MemberRecordsPanel, { MemberRecordMedia, MemberRecordSharePanel } from './MemberRecordsPanel';
import MemberProfileEditor from './MemberProfileEditor';
import { updateOwnMemberPresentation } from './memberProfile';
import { assertMemberRecordWriteAccess, resolveMemberRecordDestination, selectMemberRecords, shareMemberJournal, type MemberRecordTarget } from './memberRecords';
import ActivityPlacesRoute, { ActivityPlaceDetail } from './ActivityPlacesRoute';
import { applyActivityPlaceAction } from './activityPlaces';
import ReviewPostComposer, { PostPhotoGallery, TogetherPhotoPicker } from './ReviewPostComposer';
import GroupMembersPanel, { GroupManagersPanel, MemberAvatar } from './GroupMembersPanel';
import PublicGroupIntroduction from './PublicGroupIntroduction';
import { addGroupPost, changeGroupRole, selectReviewDraftFacts, setOwnMemberAvatar, withdrawPublicReviewPreview } from './groupContent';
import { isSafeTogetherImageUrl } from './contentMedia';
import { generateScopedReviewDraft } from './reviewAiDraft';
import GroupHomeDashboard from './GroupHomeDashboard';
import { selectActivityWorkspace } from './activityWorkspace';
import { resolveMyOwnRecordDestination } from '../community/myHubModel';
import { ActivityPhaseHeading, ActivityRecordShelf, ActivityRecordActions } from './ActivityWorkspaceView';
import { selectAssignedTasks, toggleAssignedTask } from './assignedTasks';
import { commitReviewPostWithExperiences } from './reviewPlaceExperience';
import { groupDashboardRecordDestination, selectGroupHomeDashboard } from './groupHomeDashboardModel';
import './together-content-integration.css';

interface Props {
  repository?: TogetherRepository;
  /** Development-only fixture injection; normal account repositories stay independent. */
  reviewRepository?: TogetherRepository;
  discoveryFilters?: GroupDiscoveryFilters; onDiscoveryFiltersChange?: (filters: GroupDiscoveryFilters) => void;
  route: string; onNavigate: (hash: string, filters?: GroupDiscoveryFilters) => void; onBack?: (fallback: string) => void; viewer: { id: string; name: string } | null; onLogin: () => void;
  places: Place[]; journeys: Journey[]; onOpenJourney: (id: string) => void; onSavePlace: (place: Place) => void; onCopyJourney: (journey: Journey) => void; onCreateJournal?: (journey: Journey, origin?: { groupId: string; activityId: string }) => void;
  journalShareRequest?: JournalShareRequest | null; onJournalShareRequestHandled?: (id: string) => void;
  onCreateTemporaryRoom?: () => void;
  decisionRequest?: { id: string; actorId: string; activityId: string } | null; onDecisionRequestHandled?: (id: string) => void;
  personalRouteRequest?: { id: string; actorId: string; groupId: string; activityId: string } | null; onPersonalRouteRequestHandled?: (id: string) => void;
  memberRecordRequest?: { id: string; actorId: string; groupId: string; activityId?: string; record?: { type: 'POST' | 'MEDIA' | 'JOURNAL' | 'COMMENT'; id: string; commentId?: string } } | null; onMemberRecordRequestHandled?: (id: string) => void;
  onCreatePersonalPlan?: (journey: Journey) => boolean;
  myRegionLabel?: string; onManageMyRegions?: () => void; onUseMyRegion?: () => void;
  calendarView?: CalendarView; onCalendarViewChange?: (view: CalendarView) => void;
}
type Modal = 'personal-route' | 'visit-guide' | 'decide' | 'taste-map' | 'taste-place' | 'temporary-manage' | 'businesses' | 'create-group' | 'create-activity' | 'creation' | 'planning' | 'poll-apply' | 'members' | 'managers' | 'group-introduction' | 'place-detail' | 'member-records' | 'member-profile-edit' | 'share-record' | 'applications' | 'review-application' | 'apply' | 'manage' | 'promotion' | 'invite' | 'post' | 'task' | 'poll' | 'games' | 'challenges' | 'notice' | 'ai' | 'assistant' | 'places' | 'edit-activity' | 'upload' | 'report' | 'share' | 'itinerary' | 'remove-member' | 'restore-member' | 'withdraw-shares' | 'resources' | 'room-tasks' | 'notice-view' | 'recent-groups' | 'join-settings' | 'edit-group';
const TogetherInterestMap = lazy(() => import('../InterestPlacesMap'));
const kindNames: Record<GroupKind, string> = { FAMILY: '가족', FRIENDS: '친구', HOBBY: '취미·지역', GUIDE: '가이드' };
const directoryKinds: GroupKind[] = ['FAMILY', 'FRIENDS', 'HOBBY', 'GUIDE'];
type MyGroupView = { accountId: string; kind: MyGroupKindFilter; sort: MyGroupSort };
const initialMyGroupView = (accountId: string): MyGroupView => ({ accountId, kind: 'ALL', sort: 'KIND' });
const placeNames: Record<string, string> = { LANDMARK: '랜드마크', FOOD: '음식점', CAFE: '카페', STAY: '숙소', SHOP: '쇼핑', LEISURE: '레저' };
const now = () => new Date().toISOString();
const dateLabel = (value: string) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }) : '날짜 미정';
const dayKey = (date = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(date);
const dateTimeLabel = (value?: string) => value ? new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '신청 시각 미기록';
// Page-memory public identifiers only. Login may remount this component; it resumes confirmation, never joining.
let pendingGuestJoin: { groupId: string; intent?: PublicActivityIntent; expiresAt: number } | null = null;
const dismissedJoinWelcomes = new Set<string>();
const activityKind = (item: TogetherActivity) => item.kind || (item.journey ? 'TRIP' : 'MEETUP');
const activityWhen = (item: Pick<TogetherActivity, 'date' | 'endDate' | 'startTime'>) => `${dateLabel(item.date)}${item.startTime ? ` · ${item.startTime}` : ''}${item.endDate && item.endDate !== item.date ? ` ~ ${dateLabel(item.endDate)}` : ''}`;
const groupIdForUpload = (route: string) => route;
const scrollChatTo = (messageId?: string) => {
  const target = messageId ? document.getElementById(`tg-message-${messageId}`) : null;
  const stream = (target?.closest('.tg-room-stream') || document.querySelector('.tg-room-stream')) as HTMLElement | null;
  if (!stream) return;
  let container = stream.parentElement;
  while (container && !['auto', 'scroll'].includes(getComputedStyle(container).overflowY)) container = container.parentElement;
  if (!container) return;
  const workspace = stream.closest('.tg-chat-workspace');
  const headerHeight = workspace?.querySelector('.tg-chat-header')?.getBoundingClientRect().height || 0;
  const contextHeight = workspace?.querySelector('.tg-chat-context')?.getBoundingClientRect().height || 0;
  const dockHeight = workspace?.querySelector('.tg-composer-dock')?.getBoundingClientRect().height || 0;
  const visibleHeight = container.clientHeight - headerHeight - contextHeight - dockHeight;
  container.scrollTop = target ? container.scrollTop + target.getBoundingClientRect().top - container.getBoundingClientRect().top - headerHeight - contextHeight - Math.max(0, (visibleHeight - target.clientHeight) / 2) : container.scrollHeight;
};

export function TogetherHomePreview({ viewer, places, onNavigate, onExplore, regionMemory }: { viewer: Props['viewer']; places: Place[]; onNavigate: Props['onNavigate']; onExplore: (filters?: GroupDiscoveryFilters) => void; regionMemory?: { value: string } }) {
  const repository = useMemo(() => createTogetherRepository(viewer?.id ?? '', viewer?.name ?? '', places), [viewer?.id]);
  const [state, setState] = useState(() => repository.getSnapshot());
  const [summaryRoom, setSummaryRoom] = useState('');
  useEffect(() => { setState(repository.getSnapshot()); return repository.subscribe(() => setState(repository.getSnapshot())); }, [repository]);
  const joinedGroups = viewer ? state.groups.filter(item => isMember(state, viewer.id, item.id) && !item.archived) : [];
  const joinedActivities = state.activities.filter(item => joinedGroups.some(group => group.id === item.groupId) && item.status !== 'CANCELLED');
  const next = joinedActivities.filter(item => item.status === 'PLANNED' && item.date >= dayKey()).sort((a, b) => publicActivityTimeKey(a.date, a.startTime).localeCompare(publicActivityTimeKey(b.date, b.startTime)))[0];
  const summaryRooms = joinedGroups.flatMap(group => [
    { route: `groupsummary-${group.id}`, label: `${group.name} · 전체 채팅` },
    ...joinedActivities.filter(item => item.groupId === group.id).map(item => ({ route: `activitysummary-${item.id}`, label: `${group.name} › ${item.title}` })),
  ]);
  const selectedSummaryRoom = summaryRooms.find(item => item.route === summaryRoom)?.route || (next ? `activitysummary-${next.id}` : summaryRooms[0]?.route || '');
  return <div className="tg tg-home-groups">{next && <section className="tg-home-preview"><div className="tg-between"><div><span className="tg-kicker">함께하는 다음 약속</span><h2>{next.title}</h2><small>{state.groups.find(item => item.id === next.groupId)?.name} · {activityWhen(next)}</small></div><button className="tg-icon" aria-label="다음 모임 일정 보기" onClick={() => onNavigate(`activity-${next.id}`)}><ArrowRight size={19} /></button></div></section>}
    <section className="tg-home-summary" aria-labelledby="home-chat-summary-title"><div className="tg-ai-heading"><Sparkles size={20} aria-hidden="true"/><div><h2 id="home-chat-summary-title">대화 요약·정리</h2><small>모임 대화에서 준비물과 확인할 일까지</small></div></div>{summaryRooms.length ? <><label htmlFor="home-summary-room">어느 대화를 볼까요?</label><select id="home-summary-room" value={selectedSummaryRoom} onChange={event => setSummaryRoom(event.target.value)}>{summaryRooms.map(item => <option key={item.route} value={item.route}>{item.label}</option>)}</select><button className="tg-primary" onClick={() => onNavigate(selectedSummaryRoom)}>요약 화면 열기<ArrowRight size={16}/></button></> : <><p>{viewer ? '가입한 모임에서 대화를 나눈 뒤 요약 화면을 이용할 수 있어요.' : '로그인한 뒤 내가 가입한 모임의 대화를 선택할 수 있어요.'}</p><button onClick={() => onNavigate('together')}>{viewer ? '내 모임 보기' : '로그인·내 모임 보기'}<ArrowRight size={16}/></button></>}</section>
    <PublicGroupHome state={state} onExplore={onExplore} onOpenGroup={(id, activityId) => onNavigate(`group-${id}`, { view: activityId ? 'MEETUPS' : 'GROUPS', publicActivityIntent: activityId ? createPublicActivityIntent(state, id, activityId) : undefined })} regionMemory={regionMemory} /></div>;
}

function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return <div className="tg-empty"><Users size={30} /><h2>{title}</h2>{children && <p>{children}</p>}{action}</div>;
}
function PlaceRow({ place, onSave }: { place: Place; onSave: (place: Place) => void }) {
  const photos = getPlacePhotos(place, true);
  return <details className="tg-place"><summary>{photos[0] ? <img src={photos[0].image} alt="" /> : <MapPin size={28} />}<div><span className="tg-tag">{placeNames[place.kind]}</span><strong>{place.name}</strong><small>{place.area}</small></div><ChevronDown size={18} /></summary><div className="tg-place-content">{photos[0] && <><img src={photos[0].image} alt={photos[0].alt || place.name} /><PhotoCredit image={photos[0].image} sourceId={photos[0].sourceId} /></>}<p>{place.description || '장소 소개를 준비하고 있어요.'}</p><small>{place.address}</small>{place.duration && <small>방문 참고 · {place.duration}</small>}<div className="tg-row"><button onClick={() => onSave(place)}><Heart size={16} />관심 장소 저장</button><a className="tg-direction" href={naverDirectionsUrl(place)} target="_blank" rel="noreferrer">네이버 길찾기 ↗</a></div></div></details>;
}

export default function TogetherApp({ repository: suppliedRepository, route, onNavigate, onBack, viewer, onLogin, places, journeys, onOpenJourney, onSavePlace, onCopyJourney, onCreateJournal, journalShareRequest, onJournalShareRequestHandled, decisionRequest, onDecisionRequestHandled, personalRouteRequest, onPersonalRouteRequestHandled, memberRecordRequest, onMemberRecordRequestHandled, onCreateTemporaryRoom, onCreatePersonalPlan, discoveryFilters, onDiscoveryFiltersChange, reviewRepository, myRegionLabel, onManageMyRegions, onUseMyRegion, calendarView, onCalendarViewChange }: Props) {
  useConsumerDensity();
  const repository = useMemo(() => suppliedRepository ?? (import.meta.env.DEV && reviewRepository ? reviewRepository : createTogetherRepository(viewer?.id ?? '', viewer?.name ?? '', places)), [suppliedRepository, viewer?.id, reviewRepository]);
  const [state, setState] = useState<TogetherState>(() => repository.getSnapshot());
  const [groupTab, setGroupTab] = useState('home');
  const [activityTab, setActivityTab] = useState('schedule');
  const [recordView, setRecordView] = useState<'posts' | 'media'>('posts');
  const [boardCategory, setBoardCategory] = useState('ALL');
  const [,refreshRecentGroups] = useState(0);
  const groupTabs = useRef<Record<string, string>>({});
  const activityTabs = useRef<Record<string, string>>({});
  const directoryViewMemory = useRef<MyGroupView>(initialMyGroupView(viewer?.id ?? ''));
  const [directoryView, setDirectoryView] = useState(directoryViewMemory.current);
  const [activityFilter, setActivityFilter] = useState('upcoming');
  const [modal, setModal] = useState<Modal | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [pollApplication, setPollApplication] = useState<PollActivityApplicationPreview | null>(null);
  const [planningPicker, setPlanningPicker] = useState<{ actorId: string; groupId: string; activityId?: string } | null>(null);
  const handledJournalRequest = useRef('');
  const handledDecisionRequest = useRef('');
  const handledPersonalRouteRequest = useRef('');
  const [tastePlaceScope, setTastePlaceScope] = useState<{ actorId: string; groupId: string; activityId?: string } | null>(null);
  const pendingPlanningReturn = useRef(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [withdrawIds, setWithdrawIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [aiPreview, setAiPreview] = useState(false);
  const [highlight, setHighlight] = useState('');
  const [calendarDate, setCalendarDate] = useState(() => normalizeCalendarView(calendarView, dayKey().slice(0, 7)).date);
  const [creationInitial, setCreationInitial] = useState<Partial<CreationBrief>>({});
  const [creationResume, setCreationResume] = useState<CreationPreviewDraft | undefined>(() => peekCreationHandoff(viewer?.id || '', route));
  const [creationRequestId, setCreationRequestId] = useState(() => togetherId('creation'));
  const [creationGroupId, setCreationGroupId] = useState('');
  const [creationReturn, setCreationReturn] = useState<Modal | null>(null);
  const [creationTarget, setCreationTarget] = useState<'PERSONAL' | 'TOGETHER'>('TOGETHER');
  const [placeDetail, setPlaceDetail] = useState<Place | null>(null);
  const sharedRouteSection = useRef<HTMLDivElement>(null);
  const [dashboardRecordHighlight, setDashboardRecordHighlight] = useState('');
  const [dashboardRecordRequest, setDashboardRecordRequest] = useState(0);
  const pendingDashboardRecord = useRef<{ viewerId: string; groupId: string; type: 'POST' | 'MEDIA' | 'JOURNAL'; id: string } | null>(null);
  const pendingMemberComment = useRef<{ viewerId: string; groupId: string; authorId: string; activityId?: string; postId: string; commentId: string } | null>(null);
  const [month, setMonth] = useState(() => normalizeCalendarView(calendarView, dayKey().slice(0, 7)).month);
  useEffect(() => {
    if (!calendarView) return;
    const next = normalizeCalendarView(calendarView, dayKey().slice(0, 7));
    setMonth(next.month); setCalendarDate(next.date);
  }, [calendarView?.month, calendarView?.date]);
  const uploadRef = useRef<HTMLInputElement>(null);
  const uploadEpoch = useRef(0);
  const pendingSourceJump = useRef('');
  const pendingAssistantRoom = useRef('');
  const chatReturn = useRef<WorkspaceReturn | null>(null);
  const pendingWorkspaceRestore = useRef<WorkspaceReturn | null>(null);
  const [, refreshJoinWelcome] = useState(0);
  const [directJoinEntry, setDirectJoinEntry] = useState<DirectJoinEntry | null>(null);
  const pendingJoin = useRef<{ groupId: string; intent?: PublicActivityIntent } | null>(null);
  const pendingJoinNavigation = useRef<(() => void) | null>(null);
  const activeReader = useRef<FileReader | null>(null);
  useEffect(() => { uploadEpoch.current += 1; return () => { uploadEpoch.current += 1; activeReader.current?.abort(); }; }, [modal, viewer?.id, groupIdForUpload(route)]);
  const uid = viewer?.id ?? '';
  const recentStorage = useMemo(() => { try { return window.localStorage; } catch { return null; } }, []);
  const guidePublicStore = useMemo(() => recentStorage ? createVisitGuidePublicStore(recentStorage) : null, [recentStorage]);
  const creationAccount = useRef(uid);
  useEffect(() => {
    retainCreationHandoff(route);
    if (creationAccount.current !== uid) {
      const wasGuest = !creationAccount.current;
      creationAccount.current = uid;
      const restored = wasGuest && uid ? takeCreationHandoff(uid, route) : undefined;
      setCreationResume(restored);
      if (restored) setCreationRequestId(togetherId('creation'));
    } else if (uid) {
      const restored = takeCreationHandoff(uid, route);
      if (restored) setCreationResume(restored);
    }
    if (!/^together-plan(?:-trip)?$/.test(route)) setCreationResume(undefined);
  }, [uid, route]);
  useEffect(() => () => { pendingJoinNavigation.current?.(); pendingJoinNavigation.current = null; }, [uid, route]);
  useEffect(() => { if (modal && modal !== 'apply') { pendingJoinNavigation.current?.(); pendingJoinNavigation.current = null; } }, [modal]);
  const currentDirectoryView = directoryView.accountId === uid ? directoryView : initialMyGroupView(uid);
  useEffect(() => {
    if (directoryViewMemory.current.accountId !== uid) {
      directoryViewMemory.current = initialMyGroupView(uid);
      setDirectoryView(directoryViewMemory.current);
    }
  }, [uid]);
  const changeDirectoryView = (next: Partial<Pick<MyGroupView, 'kind' | 'sort'>>) => {
    const updated = { ...currentDirectoryView, ...next };
    directoryViewMemory.current = updated;
    setDirectoryView(updated);
  };
  pageChatDraftMemory.activate(uid);
  pageChatDraftMemory.reconcile(state, uid);
  const nav = (target: string, filters?: GroupDiscoveryFilters) => onNavigate(target, filters);
  useEffect(() => { setState(repository.getSnapshot()); return repository.subscribe(() => setState(repository.getSnapshot())); }, [repository]);
  const workspaceIdentity = useRef({ route, uid });
  useEffect(() => {
    if (workspaceIdentity.current.route === route && workspaceIdentity.current.uid === uid) return;
    workspaceIdentity.current = { route, uid };
    setModal(null); setError(''); setHighlight(''); setPlaceDetail(null); setPollApplication(null); setPlanningPicker(null);
  }, [route, uid]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 3200); return () => window.clearTimeout(timer); }, [toast]);
  const summaryRoute = route.startsWith('groupsummary-') || route.startsWith('activitysummary-');
  const activityId = route.startsWith('activitysummary-') ? route.slice(16) : route.startsWith('activitychat-') ? route.slice(13) : route.startsWith('activity-') ? route.slice(9) : '';
  const activity = state.activities.find(item => item.id === activityId);
  const groupId = activity?.groupId ?? (route.startsWith('groupsummary-') ? route.slice(13) : route.startsWith('groupchat-') ? route.slice(10) : route.startsWith('group-') && !route.startsWith('group-invite-') ? route.slice(6) : '');
  const group = state.groups.find(item => item.id === groupId);
  useEffect(() => { setGroupTab(groupTabs.current[groupId] || 'home'); setActivityTab(activityTabs.current[activityId] || 'schedule'); }, [groupId, activityId]);
  const member = group ? isMember(state, uid, group.id) && !group.blockedMemberIds?.includes(uid) : false;
  const canWriteRoom = Boolean(member && !group?.archived && (!activity || activity.status === 'PLANNED' && (!(activity.endDate || activity.date) || (activity.endDate || activity.date) >= dayKey())));
  const manager = Boolean(group && member && (group.ownerId === uid || group.managerIds.includes(uid)) && !group.archived);
  const editor = Boolean(activity && canEditActivity(state, uid, activity));
  const roomId = activity ? roomIdForActivity(activity.id) : group ? roomIdForGroup(group.id) : '';
  const inChat = route.startsWith('groupchat-') || route.startsWith('activitychat-');
  useEffect(() => { setDashboardRecordHighlight(''); }, [uid, groupId]);
  useLayoutEffect(() => {
    const pending = pendingDashboardRecord.current;
    if (!pending) return;
    const destination = groupDashboardRecordDestination(repository.getSnapshot(), uid, pending.groupId, pending.type, pending.id);
    if (pending.viewerId !== uid || pending.groupId !== groupId || !destination) { pendingDashboardRecord.current = null; return; }
    if (destination.route !== route || (destination.activityId ? activityTab !== 'record' || recordView !== destination.recordView : groupTab !== destination.view)) return;
    let secondFrame = 0;
    const frame = requestAnimationFrame(() => { secondFrame = requestAnimationFrame(() => {
      const current = groupDashboardRecordDestination(repository.getSnapshot(), uid, pending.groupId, pending.type, pending.id);
      if (!current || current.route !== route) { pendingDashboardRecord.current = null; return; }
      const element = document.getElementById(current.elementId);
      if (!element) return;
      const detail = element.querySelector<HTMLDetailsElement>('.tg-post-detail');
      if (detail) detail.open = true;
      setDashboardRecordHighlight(current.elementId);
      element.scrollIntoView({ block: 'center' });
      pendingDashboardRecord.current = null;
    }); });
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(secondFrame); };
  }, [route, uid, groupId, groupTab, activityTab, recordView, repository, state.posts, state.media, state.sharedJournals, dashboardRecordRequest]);
  useLayoutEffect(() => {
    const pending = pendingMemberComment.current;
    if (!pending) return;
    const resolve = () => resolveMemberRecordDestination(repository.getSnapshot(), uid, pending.groupId, pending.authorId, pending.activityId, { kind: 'COMMENT', postId: pending.postId, commentId: pending.commentId });
    const destination = resolve();
    if (pending.viewerId !== uid || pending.groupId !== groupId || destination?.kind !== 'COMMENT') { pendingMemberComment.current = null; return; }
    if (modal || route !== destination.route || (destination.activityId ? activityTab !== 'record' || recordView !== 'posts' : groupTab !== 'board')) return;
    let secondFrame = 0;
    const frame = requestAnimationFrame(() => { secondFrame = requestAnimationFrame(() => {
      const current = resolve();
      if (current?.kind !== 'COMMENT' || current.route !== route) { pendingMemberComment.current = null; return; }
      const element = document.getElementById(current.elementId);
      if (!element) return;
      for (let parent = element.parentElement; parent; parent = parent.parentElement) if (parent instanceof HTMLDetailsElement) parent.open = true;
      setDashboardRecordHighlight(current.elementId);
      element.scrollIntoView({ block: 'center' });
      pendingMemberComment.current = null;
    }); });
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(secondFrame); };
  }, [route, uid, groupId, groupTab, activityTab, recordView, modal, repository, state.posts, state.groups]);
  useEffect(() => {
    setBoardCategory('ALL');
    if (recentStorage && uid && group && !group.blockedMemberIds?.includes(uid) && (member || isDiscoverableGroup(group))) {
      rememberRecentGroup(recentStorage, uid, group.id);
    }
  }, [uid, groupId]);
  useLayoutEffect(() => {
    const origin = pendingWorkspaceRestore.current;
    if (!origin || inChat) return;
    const restored = resolveWorkspaceReturn(repository.getSnapshot(), uid, groupId, activityId || undefined, origin);
    if (!restored || restored.route !== route) { pendingWorkspaceRestore.current = null; return; }
    let nextFrame = 0;
    // The host restores its route position in a frame too. Restore this narrower tab after it.
    const frame = requestAnimationFrame(() => { nextFrame = requestAnimationFrame(() => {
      if (!resolveWorkspaceReturn(repository.getSnapshot(), uid, groupId, activityId || undefined, origin)) return;
      document.querySelector<HTMLElement>('.content')?.scrollTo({ top: restored.scrollTop, behavior: 'instant' });
      pendingWorkspaceRestore.current = null;
    }); });
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(nextFrame); };
  }, [route, uid, groupId, activityId, groupTab, activityTab, repository, inChat]);
  useEffect(() => { if (!inChat || !pendingSourceJump.current) return; const id = pendingSourceJump.current; pendingSourceJump.current = ''; const timer = window.setTimeout(() => { setHighlight(id); scrollChatTo(id); }, 80); return () => window.clearTimeout(timer); }, [route, inChat]);
  const myGroups = state.groups.filter(item => item.spaceType !== 'ACTIVITY' && isMember(state, uid, item.id) && !item.blockedMemberIds?.includes(uid));
  const myGroupDirectory = buildMyGroupDirectory(state, uid, currentDirectoryView);
  const groupActivities = state.activities.filter(item => item.groupId === group?.id);
  const pendingApplications = state.applications.filter(item => item.groupId === group?.id && item.status === 'PENDING');
  const visibleActivities = state.activities.filter(item => isMember(state, uid, item.groupId));
  const messages = state.messages.filter(item => item.roomId === roomId && !item.deleted);
  const notices = state.notices.filter(item => item.groupId === group?.id && (activity ? item.activityId === activity.id : !item.activityId));
  const sourceJourney = journeys.find(item => item.id === (route.startsWith('together-share-') ? route.slice(15) : ''));
  const set = (key: string, value: string) => setForm(current => ({ ...current, [key]: value }));
  const open = (type: Modal, initial: Record<string, string> = {}) => { setModal(type); setForm(type === 'promotion' && group ? { introduction: group.introduction, region: group.region, cover: group.cover, ...discoveryProfile(group), topics: discoveryProfile(group).topics.join(','), subtopics: (discoveryProfile(group).subtopics || []).join(','), ...initial } : initial); setError(''); setSelectedIds(type === 'promotion' ? [...(group?.promotionActivityIds || [])] : type === 'edit-activity' ? [...(activity?.editorIds || [])] : []); setAiPreview(false); };
  const checkRoomItem = (item?: { groupId: string; activityId?: string }) => {
    if (!group || !item || item.groupId !== group.id || item.activityId !== activity?.id) throw new Error('이 대화방의 항목을 다시 확인해 주세요.');
  };
  const closePoll = (id: string) => mutate(draft => { checkRoomItem(draft.polls.find(item => item.id === id)); closeRoomPoll(draft, uid, id); });
  const confirmPoll = (id: string, optionId: string) => mutate(draft => { checkRoomItem(draft.polls.find(item => item.id === id)); confirmRoomPoll(draft, uid, id, optionId); }, '결과를 확정했어요. 일정·예약·참석은 그대로예요.');
  const editPoll = (id: string) => { const poll = state.polls.find(item => item.id === id); if (poll) open('poll', { editId: id, revision: String(poll.revision ?? 0) }); };
  const openPollApplication = (pollId: string) => {
    if (!group || !activity) return setToast('이 투표가 속한 약속에서 다시 확인해 주세요.');
    try {
      const preview = previewPollActivityApplication(repository.getSnapshot(), uid, { groupId: group.id, activityId: activity.id, pollId }, places);
      setPollApplication(preview); open('poll-apply');
    } catch (reason) { setError(reason instanceof Error ? reason.message : '현재 일정에 반영할 수 있는지 다시 확인해 주세요.'); }
  };
  const startActivityJournal = () => {
    if (!group || !activity || !onCreateJournal) return;
    const latest = repository.getSnapshot();
    try {
      assertMemberRecordWriteAccess(latest, uid, group.id, activity.id);
      const source = latest.activities.find(item => item.id === activity.id && item.groupId === group.id)?.journey;
      if (!source) throw new Error('기록할 약속 동선을 다시 확인해 주세요.');
      onCreateJournal(source, { groupId: group.id, activityId: activity.id });
    } catch (reason) { setToast(reason instanceof Error ? reason.message : '이 약속을 다시 확인해 주세요.'); }
  };
  useEffect(() => {
    if (!journalShareRequest || handledJournalRequest.current === journalShareRequest.id) return;
    if (journalShareRequest.actorId !== uid) {
      handledJournalRequest.current = journalShareRequest.id;
      onJournalShareRequestHandled?.(journalShareRequest.id); return;
    }
    const target = resolveJournalOrigin(repository.getSnapshot(), uid, journalShareRequest, journeys);
    if (!target) {
      handledJournalRequest.current = journalShareRequest.id;
      setToast('여행기는 내 기록에 남아 있어요. 원래 약속의 현재 공유 권한을 다시 확인해 주세요.');
      onJournalShareRequestHandled?.(journalShareRequest.id); return;
    }
    if (route !== target.route) return;
    handledJournalRequest.current = journalShareRequest.id;
    open('share-record', { recordActivityId: target.activityId, sourceJourneyId: target.journeyId });
    onJournalShareRequestHandled?.(journalShareRequest.id);
  }, [journalShareRequest, uid, route, repository, journeys]);
  useEffect(() => {
    if (modal !== 'planning') setPlanningPicker(null);
  }, [modal]);
  useLayoutEffect(() => {
    if (modal !== 'planning' || planningPicker || !pendingPlanningReturn.current) return;
    pendingPlanningReturn.current = false;
    const target = document.querySelector<HTMLElement>('.planning-support-update button') || document.querySelector<HTMLElement>('.planning-support [role="tabpanel"] h3');
    target?.scrollIntoView({ block: 'center' });
    if (target instanceof HTMLButtonElement) target.focus({ preventScroll: true });
  }, [modal, planningPicker]);
  const openParticipation = (tool: 'poll' | 'games' | 'challenges', id?: string) => open(tool, id ? { id, mode: 'list' } : tool === 'poll' ? { mode: 'list' } : {});
  const joinForm = (target: TogetherGroup, intent?: PublicActivityIntent): Record<string, string> => ({ joinMode: discoveryProfile(target).joinMode || 'APPROVAL', joinVersion: publicGroupJoinVersion(target), ...(intent ? { intentGroupId: intent.groupId, intentActivityId: intent.activityId, intentDate: intent.date } : {}) });
  const openPublicJoin = (id: string) => {
    const target = repository.getSnapshot().groups.find(item => item.id === id);
    if (!target || !isDiscoverableGroup(target) || discoveryProfile(target).recruitment !== 'OPEN') return setToast('현재 가입을 받을 수 없는 모임이에요.');
    const intent = intentForGroup(id);
    const selectedIntent = intent && resolvePublicActivityIntent(repository.getSnapshot(), intent, uid) ? intent : undefined;
    if (!viewer) { pendingGuestJoin = { groupId: id, intent: selectedIntent, expiresAt: Date.now() + 5 * 60_000 }; if (route !== `group-${id}`) nav(`group-${id}`); onLogin(); return; }
    if (target.blockedMemberIds?.includes(uid)) return setToast('가입이 제한된 모임이에요.');
    if (target.memberIds.includes(uid)) { if (route !== `group-${id}`) nav(`group-${id}`); return; }
    if (group?.id !== id) { pendingJoin.current = { groupId: id, intent: selectedIntent }; nav(`group-${id}`); return; }
    open('apply', joinForm(target, selectedIntent));
  };
  useEffect(() => {
    if (!viewer || !group) return;
    if (pendingGuestJoin && pendingGuestJoin.expiresAt <= Date.now()) pendingGuestJoin = null;
    const pending = pendingJoin.current || (pendingGuestJoin?.groupId === group.id ? pendingGuestJoin : null);
    if (!pending || pending.groupId !== group.id) return;
    pendingJoin.current = null; pendingGuestJoin = null;
    const latest = repository.getSnapshot(), target = latest.groups.find(item => item.id === pending.groupId);
    if (!target || !isDiscoverableGroup(target) || discoveryProfile(target).recruitment !== 'OPEN' || target.blockedMemberIds?.includes(uid) || target.memberIds.includes(uid)) return;
    const intent = pending.intent && resolvePublicActivityIntent(latest, pending.intent, uid) ? pending.intent : undefined;
    open('apply', joinForm(target, intent));
  }, [route, uid, group?.id, repository]);
  useEffect(() => {
    if (inChat && member && pendingAssistantRoom.current === roomId) {
      pendingAssistantRoom.current = '';
      open('planning');
    }
  }, [route, roomId, member]);
  useEffect(() => {
    if (summaryRoute && member) open('ai', { scope: 'unread', person: 'all' });
  }, [route, member]);
  useEffect(() => {
    if ((modal === 'ai' || modal === 'assistant') && !member) { setModal(null); setAiPreview(false); setSelectedIds([]); setForm({}); }
  }, [modal, member]);
  useEffect(() => {
    if ((modal === 'planning' || modal === 'creation' && creationGroupId) && (!member || group?.archived)) { setModal(null); setError('이 모임의 현재 접근 권한을 확인해 주세요.'); }
  }, [modal, member, creationGroupId, group?.archived]);
  useEffect(() => {
    if (!decisionRequest || handledDecisionRequest.current === decisionRequest.id) return;
    if (decisionRequest.actorId !== uid) { handledDecisionRequest.current = decisionRequest.id; onDecisionRequestHandled?.(decisionRequest.id); return; }
    if (route !== `activity-${decisionRequest.activityId}` || !group || !activity || activity.id !== decisionRequest.activityId) return;
    handledDecisionRequest.current = decisionRequest.id;
    if (member && !group.archived) open('decide');
    onDecisionRequestHandled?.(decisionRequest.id);
  }, [decisionRequest, uid, route, group?.id, activity?.id, member]);
  useEffect(() => {
    if (!personalRouteRequest || handledPersonalRouteRequest.current === personalRouteRequest.id) return;
    const request = personalRouteRequest;
    if (request.actorId !== uid) { handledPersonalRouteRequest.current = request.id; onPersonalRouteRequestHandled?.(request.id); return; }
    if (route !== `activity-${request.activityId}` || group?.id !== request.groupId || activity?.id !== request.activityId) return;
    handledPersonalRouteRequest.current = request.id;
    try {
      const current = selectPersonalRoutes(repository.getSnapshot(), uid, { groupId: request.groupId, activityId: request.activityId }, places);
      if (current.canWithdraw && current.route.stops.length) open('personal-route');
    } catch { setError('현재 참여할 수 있는 일정을 다시 확인해 주세요.'); }
    onPersonalRouteRequestHandled?.(request.id);
  }, [personalRouteRequest, uid, route, group?.id, activity?.id, repository, places]);
  const handledMemberRecordRequest = useRef('');
  useEffect(() => {
    const request = memberRecordRequest;
    if (!request || handledMemberRecordRequest.current === request.id) return;
    if (request.actorId !== uid) { handledMemberRecordRequest.current = request.id; onMemberRecordRequestHandled?.(request.id); return; }
    const destination = request.activityId ? `activity-${request.activityId}` : `group-${request.groupId}`;
    if (route !== destination || group?.id !== request.groupId) return;
    handledMemberRecordRequest.current = request.id;
    if (request.record) {
      const target = resolveMyOwnRecordDestination(repository.getSnapshot(), uid, { groupId: request.groupId, activityId: request.activityId, ...request.record });
      if (!target) setError('현재 볼 수 있는 내 기록 원문을 다시 확인해 주세요.');
      else if (target.type === 'COMMENT') openMemberRecord(uid, target.activityId, { kind: 'COMMENT', postId: target.id, commentId: target.commentId! });
      else openDashboardRecord(target.type, target.id);
    } else if (selectMemberRecords(repository.getSnapshot(), uid, request.groupId, uid, request.activityId)) {
      open('member-records', { memberId: uid, recordActivityId: request.activityId || '' });
    } else setError('현재 볼 수 있는 내 모임 기록을 다시 확인해 주세요.');
    onMemberRecordRequestHandled?.(request.id);
  }, [memberRecordRequest, uid, route, group?.id, repository]);
  const requireUser = () => { if (viewer) return true; onLogin(); return false; };
  useEffect(() => {
    if (!/^together-plan(?:-trip)?$/.test(route)) return;
    setCreationInitial({ region: discoveryFilters?.region || '', ...(route.endsWith('-trip') ? { purpose: 'TRIP', theme: 'TRAVEL' } : {}) });
    setCreationRequestId(togetherId('creation'));
    setCreationGroupId('');
    setCreationTarget(route.endsWith('-trip') ? 'PERSONAL' : 'TOGETHER');
  }, [route, uid]);
  const beginCreation = (initial: Partial<CreationBrief>, returnTo: Modal | null = null) => {
    if (!requireUser()) return;
    if (returnTo && modal !== returnTo && returnTo !== 'planning') setForm({});
    const firstIdea = initial.purpose !== 'GROUP' ? group?.introduction.split('첫 활동 아이디어 · 일정 미정\n')[1]?.trim() || '' : '';
    setCreationInitial({ region: activity?.journey?.region || [group?.region, group?.discovery?.district].filter(Boolean).join(' ') || discoveryFilters?.region || '', ...initial, prompt: initial.prompt?.trim() || firstIdea });
    setCreationRequestId(togetherId('creation'));
    setCreationGroupId(initial.purpose !== 'GROUP' && group && group.spaceType !== 'ACTIVITY' ? group.id : '');
    setCreationReturn(returnTo);
    setCreationTarget('TOGETHER');
    setError('');
    setModal('creation');
  };
  const mutate = (recipe: (draft: TogetherState) => void, success?: string) => {
    try { const ok = repository.update(recipe); if (!ok) { setError(repository.getError() || '저장하지 못했어요. 입력을 유지했으니 다시 시도해 주세요.'); return false; } if (success) setToast(success); setError(''); return true; }
    catch (reason) { setError(reason instanceof Error ? reason.message : '처리하지 못했어요. 다시 시도해 주세요.'); return false; }
  };
  const businessContent = (place?: Place, detailOnly = false, sourceScope?: { actorId: string; groupId: string; activityId?: string }, initialTab?: RoomBusinessWorkspaceProps['initialTab']): ReactNode => {
    const selectedScope = sourceScope || (group ? { actorId: uid, groupId: group.id, activityId: activity?.id } : null);
    if (!selectedScope || selectedScope.actorId !== uid) return null;
    const selectedGroup = state.groups.find(item => item.id === selectedScope.groupId);
    const selectedActivity = selectedScope.activityId ? state.activities.find(item => item.id === selectedScope.activityId && item.groupId === selectedScope.groupId) : undefined;
    if (!selectedGroup || !isMember(state, uid, selectedGroup.id) || selectedGroup.blockedMemberIds?.includes(uid) || selectedScope.activityId && !selectedActivity) return null;
    let writable = false;
    try { writable = getPlanningSupportContext(state, uid, selectedScope).canWrite; } catch { /* Read-only history still has assessments. */ }
    const checkScope = (scope: PlaceAssessmentScope) => {
      if (scope.groupId !== selectedScope.groupId || scope.activityId !== selectedScope.activityId) throw new Error('이 모임·약속의 업체 정보를 다시 확인해 주세요.');
    };
    const props: RoomBusinessWorkspaceProps = {
      state, userId: uid, groupId: selectedGroup.id, activityId: selectedActivity?.id, places, onSavePlace, initialTab,
      onAddCandidate: writable ? (placeId, revision) => mutate(draft => { addPlanningPlaceCandidate(draft, uid, selectedScope, placeId, revision, places); }, '이 공간의 장소 후보로 담았어요.') : undefined,
      onSaveFeedback: (scope, input) => mutate(draft => { checkScope(scope); upsertPlaceFeedback(draft, uid, scope, input, places); }, '우리 모임의 업체 평가를 저장했어요.'),
      onWithdrawFeedback: (scope, revision) => mutate(draft => { checkScope(scope); withdrawPlaceFeedback(draft, uid, scope, revision); }, '내 업체 평가를 철회했어요.'),
      onSaveMenu: (scope, input) => mutate(draft => { checkScope(scope); savePlaceMenu(draft, uid, scope, input, places); }, '확인한 메뉴·가격 정보를 공유했어요.'),
      onWithdrawMenu: (scope, menuId, revision) => mutate(draft => { checkScope(scope); withdrawPlaceMenu(draft, uid, scope, menuId, revision); }, '내가 공유한 메뉴 정보를 내렸어요.'),
    };
    return detailOnly && place ? <RoomBusinessDetail key={`${uid}:${selectedGroup.id}:${selectedActivity?.id || ''}:${place.id}`} {...props} place={place} onBack={sourceScope ? () => open('taste-map') : undefined} backLabel={sourceScope ? '취향 지도로' : undefined}/> : <RoomBusinessWorkspace key={`${uid}:${selectedGroup.id}:${selectedActivity?.id || ''}`} {...props} initialPlace={place}/>;
  };
  const showChatResult = (destination: string, messageId?: string) => {
    const target = destination.startsWith('activity:') ? `activitychat-${destination.slice(9)}` : `groupchat-${destination.slice(6)}`;
    setModal(null);
    if (target === route) {
      pendingSourceJump.current = '';
      setHighlight(messageId || '');
      window.setTimeout(() => scrollChatTo(messageId), 80);
    } else {
      pendingSourceJump.current = messageId || '';
      nav(target);
    }
  };
  const publishAssistantAction = (action: Parameters<typeof applyActivityAssistantAction>[2]) => {
    let destination = action.activityId ? roomIdForActivity(action.activityId) : roomIdForGroup(action.groupId);
    let messageId: string | undefined;
    const ok = mutate(draft => {
      if (!getPlanningSupportContext(draft, uid, action).canWrite && action.type !== 'CREATE_ACTIVITY_DRAFT') throw new Error('현재 공간의 상태를 다시 확인해 주세요.');
      const existingMessages = new Set(draft.messages.map(item => item.id));
      const id = applyActivityAssistantAction(draft, uid, action, places);
      const type = action.type === 'CREATE_POLL' ? 'POLL' : action.type === 'CREATE_TASK' ? 'TASK' : 'ACTIVITY';
      const entityId = action.type === 'UPDATE_ACTIVITY_TIME' ? action.activityId : id;
      const matching = draft.messages.filter(item => item.entity?.type === type && item.entity.id === entityId && !item.deleted && (action.type !== 'UPDATE_ACTIVITY_TIME' || item.roomId === destination));
      const message = matching.find(item => !existingMessages.has(item.id)) || matching.at(-1);
      if (message) { destination = message.roomId; messageId = message.id; }
    });
    if (ok) showChatResult(destination, messageId);
    return ok;
  };
  const finishCreation = (brief: CreationBrief, plan: CreationPlan | null, groupDraft?: CreationGroupDraft): boolean => {
    if (!requireUser()) return false;
    if (!creationGroupId && brief.purpose !== 'GROUP' && creationTarget === 'PERSONAL') {
      try {
        if (!onCreatePersonalPlan || !plan) throw new Error('개인 일정 저장을 사용할 수 없어요.');
        const journey = buildCreationJourney(brief, plan, places, viewer!.name);
        const ok = onCreatePersonalPlan(journey);
        if (!ok) { setError('저장하지 못했어요. 입력과 선택은 그대로예요.'); return false; }
        setModal(null);
        return true;
      } catch (cause) { setError(cause instanceof Error ? cause.message : '일정을 만들지 못했어요.'); return false; }
    }
    let result: ReturnType<typeof commitCreation> | undefined;
    if (!mutate(draft => { result = commitCreation(draft, uid, { requestId: creationRequestId, brief, plan, groupDraft, groupId: creationGroupId || undefined }, places); }, brief.purpose === 'GROUP' ? '비공개 모임을 만들었어요.' : '선택한 일정으로 약속을 만들었어요.')) return false;
    setModal(null);
    if (result!.kind !== 'GROUP' && creationReturn === 'planning') {
      const message = repository.getSnapshot().messages.find(item => item.entity?.type === 'ACTIVITY' && item.entity.id === result!.id && !item.deleted);
      if (message) { showChatResult(message.roomId, message.id); return true; }
    }
    nav(result!.kind === 'GROUP' ? `group-${result!.id}` : `activity-${result!.id}`);
    return true;
  };
  const creationReviewOptions = !creationGroupId && onCreatePersonalPlan ? <fieldset className="tg-creation-destination"><legend>어디에 저장할까요?</legend><label><input type="radio" name="creation-destination" checked={creationTarget === 'PERSONAL'} onChange={() => setCreationTarget('PERSONAL')}/><span>내 일정<small>개인 여행·동선으로 저장</small></span></label><label><input type="radio" name="creation-destination" checked={creationTarget === 'TOGETHER'} onChange={() => setCreationTarget('TOGETHER')}/><span>함께할 약속<small>만든 뒤 필요한 사람을 초대</small></span></label></fieldset> : undefined;
  const creationPanel = () => <CreationPlannerPanel key={`${uid}:${creationRequestId}`} places={places} initial={creationInitial} previewOnly={!viewer} resumeDraft={viewer && creationAccount.current === uid && !creationGroupId && /^together-plan(?:-trip)?$/.test(route) ? creationResume : undefined} onLoginRequired={draft => { if (!viewer && holdCreationHandoff(route, draft)) onLogin(); }} allowedPurposes={creationInitial.purpose === 'GROUP' ? ['GROUP'] : creationGroupId ? ['MEETUP', 'OUTING', 'TRIP'] : undefined} cancelLabel={modal === 'creation' && creationReturn && creationReturn !== 'planning' ? '직접 입력할게요' : '나가기'} onReview={finishCreation} reviewOptions={creationReviewOptions} submitLabel={creationGroupId ? '이 모임의 일정으로 만들기' : creationTarget === 'PERSONAL' ? '내 일정으로 만들기' : '함께할 약속 만들기'} onCancel={() => modal === 'creation' ? setModal(creationReturn) : onBack ? onBack('home') : nav('home')}/>;
  const toggleSelected = (id: string) => setSelectedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const unread = (id: string) => { const cursor = state.readCursors[id]; return state.messages.filter(message => message.roomId === id && message.authorId !== uid && !message.deleted && (!cursor || message.createdAt > cursor)).length; };
  const openTaskSource = (id: string) => {
    const latest = repository.getSnapshot();
    const source = latest.messages.find(item => item.id === id && !item.deleted);
    const targetGroupId = source?.roomId.startsWith('group:') ? source.roomId.slice(6) : latest.activities.find(item => `activity:${item.id}` === source?.roomId)?.groupId;
    const targetGroup = latest.groups.find(item => item.id === targetGroupId);
    if (!source || !targetGroup || !isMember(latest, uid, targetGroup.id) || targetGroup.blockedMemberIds?.includes(uid)) return setToast('현재 볼 수 있는 원문을 찾을 수 없어요.');
    rememberChatOrigin(); pendingSourceJump.current = id; nav(source.roomId.startsWith('activity:') ? `activitychat-${source.roomId.slice(9)}` : `groupchat-${source.roomId.slice(6)}`);
  };
  const openPlaceDetail = (place: Place) => { setPlaceDetail(place); open('place-detail'); };
  const report = (type: string, id: string) => { if (requireUser()) open('report', { targetType: type, targetId: id }); };
  const header = (title: string, subtitle: string, back: string, actions?: ReactNode) => <ScreenHeader variant="detail" title={title} context={subtitle} leading={<button type="button" aria-label="뒤로" onClick={() => onBack ? onBack(back) : nav(back)}><ArrowLeft size={20} /></button>} actions={actions} />;
  const tabs = (items: [string, string][], value: string, change: (value: string) => void) => <ScreenTabs label="화면 내용" items={items.map(([id, label]) => ({ id, label }))} value={value} onChange={change} />;
  const changeGroupView = (value: string) => {
    if (!group) return;
    if (value === 'chat') { rememberChatOrigin(); return nav(`groupchat-${group.id}`); }
    groupTabs.current[group.id] = value; setGroupTab(value);
    if (inChat) nav(`group-${group.id}`);
  };
  const changeActivityView = (value: string) => {
    if (!activity) return;
    if (value === 'chat') { rememberChatOrigin(); return nav(`activitychat-${activity.id}`); }
    activityTabs.current[activity.id] = value; setActivityTab(value);
    if (inChat) nav(`activity-${activity.id}`);
  };
  const openDashboardRecord = (type: 'POST' | 'MEDIA' | 'JOURNAL', id: string) => {
    if (!group) return;
    const destination = groupDashboardRecordDestination(repository.getSnapshot(), uid, group.id, type, id);
    if (!destination) return setToast('현재 모임에서 볼 수 있는 기록을 다시 확인해 주세요.');
    setModal(null);
    pendingMemberComment.current = null;
    pendingDashboardRecord.current = { viewerId: uid, groupId: group.id, type, id };
    setDashboardRecordRequest(value => value + 1);
    setBoardCategory('ALL'); setRecordView(destination.recordView);
    if (destination.activityId) { activityTabs.current[destination.activityId] = 'record'; setActivityTab('record'); }
    else { groupTabs.current[group.id] = destination.view; setGroupTab(destination.view); }
    if (destination.route !== route) nav(destination.route);
  };
  const openDashboardActivity = (id: string) => {
    if (!group) return;
    const latest = repository.getSnapshot();
    if (!selectGroupHomeDashboard(latest, uid, group.id, places) || !latest.activities.some(item => item.id === id && item.groupId === group.id)) return setToast('현재 모임의 약속을 다시 확인해 주세요.');
    activityTabs.current[id] = 'schedule'; setActivityTab('schedule');
    nav(`activity-${id}`);
  };
  const openMemberRecord = (authorId: string, scopeId: string | undefined, target: MemberRecordTarget) => {
    if (!group) return;
    const destination = resolveMemberRecordDestination(repository.getSnapshot(), uid, group.id, authorId, scopeId, target);
    if (!destination) return setToast('현재 모임에서 볼 수 있는 멤버 활동을 다시 확인해 주세요.');
    pendingDashboardRecord.current = null;
    setModal(null);
    if (destination.kind === 'ACTIVITY') {
      activityTabs.current[destination.activityId] = 'schedule'; setActivityTab('schedule');
    } else {
      if (target.kind !== 'COMMENT') return;
      pendingMemberComment.current = { viewerId: uid, groupId: group.id, authorId, activityId: scopeId, postId: target.postId, commentId: target.commentId };
      setBoardCategory('ALL'); setRecordView('posts');
      if (destination.activityId) { activityTabs.current[destination.activityId] = 'record'; setActivityTab('record'); }
      else { groupTabs.current[group.id] = 'board'; setGroupTab('board'); }
    }
    if (destination.route !== route) nav(destination.route);
  };
  const rememberChatOrigin = () => {
    if (!group || inChat) return;
    chatReturn.current = captureWorkspaceReturn(repository.getSnapshot(), uid, group.id, activity?.id, activity ? activityTab : groupTab, document.querySelector('.content')?.scrollTop || 0);
  };
  const returnFromChat = () => {
    if (!group) return;
    navigateFromChat(repository.getSnapshot(), uid, group.id, activity?.id, chatReturn.current, {
      restore: origin => {
        pendingWorkspaceRestore.current = origin;
        if (activity) { activityTabs.current[activity.id] = origin.view; setActivityTab(origin.view); }
        else { groupTabs.current[group.id] = origin.view; setGroupTab(origin.view); }
        nav(origin.route);
      },
      onHostBack: onBack,
      fallback: view => { if (activity) changeActivityView(view); else changeGroupView(view); },
    });
  };
  const openActivitySettings = () => { if (activity) open('edit-activity', { title: activity.title, date: activity.date, endDate: activity.endDate, meetingPoint: activity.meetingPoint, cover: activity.cover || '', description: activity.description, startTime: activity.startTime || '', capacity: activity.capacity ? String(activity.capacity) : '', expectedRevision: String(activity.revision) }); };
  const spaceChrome = (chat = false) => group && <div className="tg-space-chrome">
    {header(activity?.title || group.name, activity ? group.spaceType === 'ACTIVITY' ? '내 약속' : group.name : `${kindNames[group.kind]} · ${[group.region, group.discovery?.district].filter(Boolean).join(' ')}`, activity ? group.spaceType === 'ACTIVITY' ? 'appointments' : `group-${group.id}` : 'together',
      <button type="button" className="tg-icon" aria-label={activity ? '약속 메뉴' : '모임 메뉴'} onClick={() => activity ? openActivitySettings() : open('manage')}><MoreHorizontal size={22}/></button>)}
    {activity ? tabs([['schedule', '일정'], ['prep', '준비'], ['record', '기록'], ['chat', '대화']], chat ? 'chat' : activityTab === 'album' ? 'record' : activityTab, changeActivityView)
      : tabs([['home', '홈'], ['activities', '약속'], ['board', '게시판'], ['album', '앨범'], ['chat', '대화']], chat ? 'chat' : groupTab, changeGroupView)}
  </div>;
  const pinnedNotices = () => notices.length > 0 && <details className="tg-pinned-notices"><summary><Bell size={16}/><span>{notices.at(-1)!.title}</span><small>공지 {notices.length}</small><ChevronDown size={16}/></summary><div>{notices.slice().reverse().map(item => <article key={item.id}><h3>{item.title}</h3><p>{item.body}</p></article>)}</div></details>;
  const assistantEntry = () => <div className="tg-context-tools"><button type="button" className="tg-inline-tool tg-room-assistant-link" onClick={() => { rememberChatOrigin(); pendingAssistantRoom.current = canWriteRoom ? roomId : ''; nav(activity ? `activitychat-${activity.id}` : `groupchat-${group!.id}`); }}><ClipboardList size={17}/><span>{canWriteRoom ? '대화에서 함께 정하기' : '대화·기록 보기'}</span><ChevronRight size={16}/></button>{activity && group?.spaceType === 'ACTIVITY' && manager && <button type="button" onClick={() => open('invite', { name: activity.title })}><Users size={17}/>초대</button>}</div>;
  const joinWelcome = () => {
    if (!group || !member) return null;
    const welcome = selectJoinOnboarding(state, uid, group.id, directJoinEntry);
    if (!welcome || dismissedJoinWelcomes.has(welcome.key)) return null;
    const dismiss = () => { dismissedJoinWelcomes.add(welcome.key); refreshJoinWelcome(value => value + 1); };
    return <section className="tg-join-welcome" aria-label="가입 완료 안내"><div className="tg-between"><div><h2>{welcome.mode === 'DIRECT' ? '가입했어요. 반가워요!' : '가입이 승인됐어요. 반가워요!'}</h2><p>대화에서 인사하고 다음 약속·여행을 살펴보세요.</p></div><button type="button" className="tg-icon" aria-label="가입 안내 닫기" onClick={dismiss}><X size={18}/></button></div><div className="tg-row"><button type="button" className="tg-primary" onClick={() => { dismiss(); rememberChatOrigin(); nav(`groupchat-${group.id}`); }}><MessageCircle size={16}/>대화에서 인사하기</button><button type="button" onClick={() => { dismiss(); groupTabs.current[group.id] = 'activities'; setGroupTab('activities'); if (activity) nav(`group-${group.id}`); }}>다음 약속 보기</button></div></section>;
  };
  const activityCard = (item: TogetherActivity, withGroup = false) => <button key={item.id} className="tg-activity" onClick={() => nav(`activity-${item.id}`)}>{item.cover && isSafeTogetherImageUrl(item.cover) && <img className="tg-activity-thumb" src={item.cover} alt=""/>}<span className="tg-date">{item.date ? <><small>{Number(item.date.slice(5, 7))}월</small>{Number(item.date.slice(8, 10))}</> : <CalendarDays size={23} />}</span><div>{withGroup && <small>{state.groups.find(value => value.id === item.groupId)?.name}</small>}<span className="tg-tag">{activityKind(item) === 'TRIP' ? '함께 가는 여행' : '번개·정모'}</span><h3>{item.title}</h3><small>{activityWhen(item)}</small><small>참석 {countGroupParticipants(state, item.id)}{item.capacity ? `/${item.capacity}` : ''}명{item.meetingPoint ? ` · ${item.meetingPoint}` : ''}</small>{item.status === 'CANCELLED' && <span className="tg-tag coral">취소</span>}{item.status === 'COMPLETED' && <span className="tg-tag green">완료</span>}</div><ChevronRight size={18} /></button>;
  const gallery = (activityOnly: boolean, authorId?: string, recordScopeId?: string, embeddedHeader = false) => {
    const media = authorId && group ? selectMemberRecords(state, uid, group.id, authorId, activityOnly ? recordScopeId || activity?.id : undefined)?.media || [] : state.media.filter(item => item.groupId === group?.id && (!activityOnly || item.activityId === activity?.id));
    return <div className="tg-stack">{!authorId && !embeddedHeader && <div className="tg-section"><h2>{activityOnly ? '이 일정의 사진·영상' : '모임의 사진·영상'}</h2>{member && !group?.archived && <button onClick={() => open('upload')}><ImagePlus size={16} />올리기</button>}</div>}{media.length ? <div className="tg-gallery">{media.map(item => <figure key={item.id} id={`tg-media-${item.id}`} data-dashboard-record-highlight={dashboardRecordHighlight === `tg-media-${item.id}` ? 'true' : undefined}>{authorId ? <MemberRecordMedia item={item}/> : item.kind === 'VIDEO' ? <video src={item.url} controls preload="metadata" /> : <a href={item.url} target="_blank" rel="noreferrer"><img src={item.url} alt={item.caption || '모임 사진'} /></a>}<figcaption>{item.caption || memberName(state, item.authorId, group?.id)}</figcaption>{authorId && <small>{dateTimeLabel(item.createdAt)}</small>}{item.kind === 'PHOTO' && <PhotoCredit image={item.url} />}{item.authorId !== uid && <button className="tg-text-button" onClick={() => report('MEDIA', item.id)}>신고</button>}</figure>)}</div> : <Empty title="아직 사진이 없어요">함께한 순간을 사진이나 영상으로 남겨보세요.</Empty>}</div>;
  };
  const postList = (activityOnly: boolean, authorId?: string, recordKind?: 'JOURNAL' | 'POST', recordScopeId?: string, embeddedHeader = false) => {
    const authored = authorId && group ? selectMemberRecords(state, uid, group.id, authorId, activityOnly ? recordScopeId || activity?.id : undefined) : null;
    const allPosts = authorId ? authored?.posts || [] : state.posts.filter(item => item.groupId === group?.id && (!activityOnly || item.activityId === activity?.id));
    const posts = recordKind === 'JOURNAL' ? [] : allPosts.filter(item => authorId || boardCategory === 'ALL' || item.category === boardCategory).slice().sort((a,b) => Number(b.category === 'NOTICE') - Number(a.category === 'NOTICE') || b.createdAt.localeCompare(a.createdAt));
    const journals = recordKind === 'POST' ? [] : authorId ? authored?.journals || [] : boardCategory === 'ALL' || boardCategory === 'JOURNAL' ? state.sharedJournals.filter(item => item.groupId === group?.id && (!activityOnly || item.activityId === activity?.id)) : [];
    const boardFilters = activityOnly ? [['ALL','전체'],['REVIEW','후기'],['JOURNAL','여행기']] : [['ALL','전체'],['NOTICE','공지'],['FREE','이야기'],['QUESTION','질문'],['REVIEW','후기'],['JOURNAL','여행기']];
    const boardNotices = !authorId && (boardCategory === 'ALL' || boardCategory === 'NOTICE') ? state.notices.filter(item => item.groupId === group?.id && (activityOnly ? item.activityId === activity?.id : !item.activityId)) : [];
    return <div className="tg-stack">{!authorId && !embeddedHeader && <div className="tg-section"><h2>{activityOnly ? '함께 남긴 기록' : '모임 게시판'}</h2>{member && !group?.archived && <button onClick={() => open('post', { category: activityOnly ? 'REVIEW' : 'FREE' })}><Plus size={16} />글쓰기</button>}</div>}{!authorId && <div className="tg-board-filters" role="group" aria-label="게시판 분류">{boardFilters.map(([id,label]) => <button key={id} type="button" aria-pressed={boardCategory === id} onClick={() => setBoardCategory(id)}>{label}</button>)}</div>}{boardNotices.length > 0 && <div className="tg-board-notices">{boardNotices.slice().reverse().map(item => <details key={item.id}><summary><Bell size={14}/><strong>{item.title}</strong><ChevronDown size={15}/></summary><p>{item.body}</p></details>)}</div>}{journals.map(item => <article className="tg-card tg-shared-journal" key={item.id} id={`tg-journal-${item.id}`} data-dashboard-record-highlight={dashboardRecordHighlight === `tg-journal-${item.id}` ? 'true' : undefined}><small>공유 여행기 · {memberName(state, item.authorId, group?.id)}</small><h3>{item.journey.title}</h3><p>{item.journey.summary}</p><details><summary>여행기 내용 보기</summary><div className="tg-stack">{item.journey.story && <p>{item.journey.story}</p>}{item.journey.days.map(day => <section className="tg-stack" key={day.dayId || day.day}><h3>DAY {day.day} · {day.title}</h3>{day.story && <p>{day.story}</p>}{day.blocks.filter(block => block.type !== 'PLACE').map(block => <div key={block.id}>{block.heading && <h3>{block.heading}</h3>}{block.body && <p>{block.body}</p>}{block.image && <><img className="tg-journal-image" src={block.image} alt={block.caption || ''} /><PhotoCredit image={block.image} /></>}{block.images?.map(image => <figure key={image.id}><img className="tg-journal-image" src={image.image} alt={image.caption || ''} /><figcaption>{image.caption}</figcaption><PhotoCredit image={image.image} /></figure>)}</div>)}</section>)}</div></details><details><summary>공유된 동선 보기</summary><div className="tg-stack">{item.journey.days.map(day => <div key={day.dayId || day.day}><h3>DAY {day.day}</h3>{day.places.map(place => <PlaceRow key={place.visitId || place.id} place={place} onSave={onSavePlace} />)}</div>)}</div></details><div className="tg-row"><button onClick={() => onCopyJourney(item.journey)}>내 여행으로 만들기</button>{(item.authorId === uid || manager) && <button className="tg-text-button" onClick={() => mutate(draft => { draft.sharedJournals = draft.sharedJournals.filter(value => value.id !== item.id); }, '모임 공유를 해제했어요.')}>공유 해제</button>}</div></article>)}{!posts.length && !journals.length && !boardNotices.length && <Empty title={boardCategory === 'ALL' ? '첫 이야기를 남겨보세요' : '이 분류의 글이 없어요'}>질문이나 모임 후기, 함께 볼 내용을 나눌 수 있어요.</Empty>}{posts.map(post => <article className="tg-post" key={post.id} id={`tg-post-${post.id}`} data-dashboard-record-highlight={dashboardRecordHighlight === `tg-post-${post.id}` ? 'true' : undefined}><div className="tg-between"><small className="tg-post-author"><MemberAvatar name={memberName(state, post.authorId, group?.id)} avatar={state.members.find(item => item.id === post.authorId)?.avatar}/>{memberName(state, post.authorId, group?.id)} · {post.category === 'REVIEW' ? '후기' : post.category === 'QUESTION' ? '질문' : post.category === 'NOTICE' ? '공지' : '자유글'}</small>{post.authorId !== uid && <button className="tg-text-button" onClick={() => report('POST', post.id)}><Flag size={14} />신고</button>}</div><PostPhotoGallery attachments={post.attachments}/>{post.publicPreview && (post.authorId === uid || manager) && <button type="button" className="tg-public-review-withdraw" onClick={() => mutate(draft => { withdrawPublicReviewPreview(draft, uid, post.id); }, '모임 소개에서 짧은 후기를 내렸어요. 게시글은 유지돼요.')}>소개에 공개 중 · 공개 해제</button>}<details className="tg-post-detail"><summary><span><h3>{post.title}</h3><span className="tg-post-preview">{post.body}</span><small>좋아요 {post.likes.length} · 댓글 {post.comments.length}</small></span><ChevronDown size={16}/></summary><div className="tg-post-expanded"><p>{post.body}</p><button className="tg-text-button" aria-pressed={post.likes.includes(uid)} disabled={group?.archived} onClick={() => mutate(draft => { const target = draft.posts.find(item => item.id === post.id)!; target.likes = target.likes.includes(uid) ? target.likes.filter(id => id !== uid) : [...target.likes, uid]; })}><Heart size={16} fill={post.likes.includes(uid) ? 'currentColor' : 'none'} />{post.likes.length} · 댓글 {post.comments.length}</button><details><summary>댓글 보기·남기기</summary><div className="tg-stack">{post.comments.map(comment => <div key={comment.id} id={`tg-comment-${post.id}-${comment.id}`} data-dashboard-record-highlight={dashboardRecordHighlight === `tg-comment-${post.id}-${comment.id}` ? 'true' : undefined}><small>{memberName(state, comment.authorId, group?.id)}</small><p>{comment.body}</p>{comment.authorId !== uid && <button className="tg-text-button" onClick={() => report('COMMENT', comment.id)}>댓글 신고</button>}</div>)}<form className="tg-row" onSubmit={event => { event.preventDefault(); const input = event.currentTarget.elements.namedItem('comment') as HTMLInputElement; const body = input.value.trim(); if (!body || group?.archived) return; if (mutate(draft => { draft.posts.find(item => item.id === post.id)!.comments.push({ id: togetherId('comment'), authorId: uid, body, createdAt: now() }); })) input.value = ''; }}><input name="comment" disabled={group?.archived} aria-label="댓글" placeholder="댓글을 남겨주세요" maxLength={1000} required /><button type="submit" disabled={group?.archived}>등록</button></form></div></details></div></details></article>)}</div>;
  };

  const mainScreen = () => {
    const temporaryView = route === 'together-oneoff';
    const finding = route === 'together-find' || !viewer && !temporaryView;
    const groupRow = ({ group: item, nextActivity: next, unreadCount: count, lastMessage }: MyGroupDirectoryItem) => <button type="button" key={item.id} className="tg-my-group-row" onClick={() => nav(`group-${item.id}`)}><span className="tg-my-group-photo">{item.cover ? <img src={item.cover} alt=""/> : <Users size={28}/>}</span><span className="tg-my-group-copy"><small>{kindNames[item.kind] || '기타'}{item.region ? ` · ${item.region}` : ''}{item.archived ? ' · 보관됨' : ''}</small><strong>{item.name}</strong><span>{lastMessage ? `${memberName(state, lastMessage.authorId, item.id)} · ${lastMessage.body}` : item.introduction || '아직 나눈 대화가 없어요.'}</span>{next && <small className="tg-my-group-next"><CalendarDays size={12}/>{activityWhen(next)} · {next.title}</small>}</span>{count > 0 ? <span className="tg-unread-count" aria-label={`안 읽은 대화 ${count}개`}>{count > 99 ? '99+' : count}</span> : <ChevronRight size={18}/>}</button>;
    const directorySections = [...directoryKinds.map(kind => ({ id: kind as string, label: kindNames[kind], entries: myGroupDirectory.groups.filter(item => item.group.kind === kind) })), { id: 'other', label: '기타', entries: myGroupDirectory.groups.filter(item => !directoryKinds.includes(item.group.kind)) }];
    const archivedGroups = myGroups.filter(item => item.archived && (currentDirectoryView.kind === 'ALL' || item.kind === currentDirectoryView.kind));
    const pendingMemberships = selectPendingMemberships(state, uid);
    return <><ScreenHeader title={finding ? '모임 찾기' : temporaryView ? '일회성 모임' : '모임'} actions={<>{finding && <button type="button" className="screen-header__text-action" onClick={() => viewer ? nav('together') : onLogin()}>내 모임</button>}{!temporaryView && <button type="button" aria-label="모임 만들기" onClick={() => requireUser() && open('create-group', { kind: 'HOBBY', region: discoveryFilters?.region || '' })}><Plus size={22}/></button>}<AppMenuButton/></>}/>
      {!finding && <ScreenTabs label="모임에서 볼 내용" idPrefix="together-root" items={[{ id: 'together', label: '내 모임' }, { id: 'together-find', label: '모임 찾기' }, { id: 'together-oneoff', label: '일회성' }]} value={temporaryView ? 'together-oneoff' : 'together'} onChange={nav}/>}
      <div className="tg-pad tg-stack tg-groups-root">{temporaryView ? <TemporaryRoomsPanel state={state} userId={uid} onCreate={() => onCreateTemporaryRoom?.()} onLogin={onLogin} onOpen={id => nav(`activity-${id}`)} onRestore={(groupId, activityId, revision) => mutate(draft => { restoreTemporaryRoom(draft, uid, groupId, activityId, revision); }, '종료한 모임의 기록을 보관함으로 복원했어요.')}/> : finding ? <GroupDiscovery showCreate={false} state={state} viewerId={uid} onJoinGroup={openPublicJoin} myRegionLabel={myRegionLabel} onManageMyRegions={onManageMyRegions} onUseMyRegion={onUseMyRegion} onOpenGroup={(id, activityId) => nav(`group-${id}`, { ...discoveryFilters, publicActivityIntent: activityId ? createPublicActivityIntent(state, id, activityId) : undefined })} onCreate={() => requireUser() && open('create-group', { kind: 'HOBBY', region: discoveryFilters?.region || '' })} initialFilters={discoveryFilters} onFiltersChange={onDiscoveryFiltersChange}/>
        : <>
          {onCreateTemporaryRoom && <button type="button" className="temporary-room-business-entry" onClick={() => nav('together-oneoff')}><CalendarDays size={20}/><span><strong>회식·고객 미팅은 일회성으로</strong><small>이번 만남만 준비하고, 끝나면 기록을 선택해요.</small></span><ChevronRight size={17}/></button>}
          {pendingMemberships.length > 0 && <section className="tg-pending-memberships" aria-labelledby="pending-memberships-title"><h2 id="pending-memberships-title">가입 신청 중 <span>{pendingMemberships.length}</span></h2>{pendingMemberships.map(item => <div className="tg-pending-membership" key={item.id}><button type="button" disabled={!item.publicNow} onClick={() => nav(`group-${item.groupId}`)}><span><strong>{item.title}</strong><small>운영진 승인 기다리는 중</small></span><ChevronRight size={17}/></button><button type="button" className="tg-text-button" aria-label={`${item.title} 가입 신청 취소`} onClick={() => mutate(draft => { draft.applications = draft.applications.filter(value => !(value.id === item.id && value.userId === uid && value.status === 'PENDING')); }, '가입 신청을 취소했어요.')}>신청 취소</button></div>)}</section>}
          <div className="tg-my-group-filters" role="group" aria-label="내 모임 종류">{(['ALL', ...directoryKinds] as MyGroupKindFilter[]).map(kind => <button type="button" key={kind} aria-pressed={currentDirectoryView.kind === kind} onClick={() => changeDirectoryView({ kind })}>{kind === 'ALL' ? '전체' : kind === 'HOBBY' ? '취미' : kindNames[kind]}<span>{myGroupDirectory.counts[kind]}</span></button>)}</div>
          <div className="tg-my-group-sort"><span className="ui-sr-only" role="status">{currentDirectoryView.kind === 'ALL' ? '내 모임' : kindNames[currentDirectoryView.kind]} {myGroupDirectory.groups.length}개</span><div className="tg-group-utilities"><button type="button" aria-label="최근 본 모임" onClick={() => open('recent-groups')}><Heart size={17}/><span>최근</span></button><button type="button" aria-label="초대·가입 신청" title="초대·가입 신청" onClick={() => nav('together-invites')}><Users size={17}/><span>초대</span></button><button type="button" aria-label="모임의 내 할 일" title="모임의 내 할 일" onClick={() => nav('together-tasks')}><ClipboardList size={18}/><span>할 일</span></button><button type="button" aria-label="모임 일정 캘린더" title="모임 일정 캘린더" onClick={() => nav('together-calendar')}><CalendarDays size={18}/><span>일정</span></button></div><label><span className="ui-sr-only">정렬</span><select aria-label="내 모임 정렬" value={currentDirectoryView.sort} onChange={event => changeDirectoryView({ sort: event.target.value as MyGroupSort })}><option value="KIND">종류별</option><option value="UPCOMING">다음 약속순</option><option value="UNREAD">안 읽은 순</option><option value="NAME">이름순</option></select></label></div>
          {myGroupDirectory.groups.length ? currentDirectoryView.kind === 'ALL' && currentDirectoryView.sort === 'KIND' ? <div className="tg-my-group-sections">{directorySections.map(section => section.entries.length > 0 && <section key={section.id} aria-labelledby={`my-group-section-${section.id}`}><h2 id={`my-group-section-${section.id}`}>{section.label}<span>{section.entries.length}</span></h2><div className="tg-my-group-list">{section.entries.map(groupRow)}</div></section>)}</div> : <div className="tg-my-group-list">{myGroupDirectory.groups.map(groupRow)}</div> : myGroupDirectory.counts.ALL > 0 ? <Empty title={`${currentDirectoryView.kind === 'ALL' ? '선택한' : kindNames[currentDirectoryView.kind]} 모임이 아직 없어요`} action={<button type="button" onClick={() => changeDirectoryView({ kind: 'ALL' })}>전체 모임 보기</button>}>다른 종류를 선택하면 가입한 모임을 볼 수 있어요.</Empty> : <Empty title="함께할 모임을 찾아보세요" action={<button type="button" className="tg-primary" onClick={() => nav('together-find')}>모임 찾기</button>}>친구·가족끼리 초대하거나 관심사가 맞는 모임에 참여할 수 있어요.</Empty>}
          {archivedGroups.length > 0 && <details className="tg-my-group-archives"><summary><span>보관한 모임 {archivedGroups.length}</span><ChevronDown size={16}/></summary><div className="tg-my-group-list">{archivedGroups.map(group => groupRow({ group, nextActivity: null, unreadCount: 0 }))}</div></details>}</>}
      </div></>;
  };

  const intentForGroup = (id: string): PublicActivityIntent | undefined => {
    const application = state.applications.find(item => item.groupId === id && item.userId === uid && item.status !== 'DECLINED');
    // A pending request keeps its original destination, even while browsing another public card.
    if (application?.status === 'PENDING' && application.publicActivityIntent) return application.publicActivityIntent;
    const navigationIntent = discoveryFilters?.publicActivityIntent;
    if (isPublicActivityIntent(navigationIntent) && navigationIntent.groupId === id) return navigationIntent;
    return application?.publicActivityIntent;
  };
  const goToSelectedActivity = (intent: PublicActivityIntent) => {
    const current = resolvePublicActivityIntent(repository.getSnapshot(), intent, uid);
    if (!current?.canOpen) return setToast('선택한 정모의 공개 안내나 가입 상태가 바뀌었어요. 모임에서 다시 확인해 주세요.');
    nav(`activity-${current.activity.id}`);
  };
  const selectedPublicActivity = (id: string) => {
    const intent = intentForGroup(id);
    if (!intent) return null;
    const selected = resolvePublicActivityIntent(state, intent, uid);
    const selectedGroup = state.groups.find(item => item.id === id);
    const directJoin = selectedGroup && discoveryProfile(selectedGroup).joinMode === 'DIRECT';
    const pending = !directJoin && state.applications.some(item => item.groupId === id && item.userId === uid && item.status === 'PENDING');
    if (!selected) return <section className="tg-summary" aria-label="선택한 정모 안내 변경"><h3>선택한 정모의 공개 안내가 바뀌었어요</h3><p>취소·일정 변경·모집 중단 여부를 모임 소개에서 다시 확인해 주세요. 다른 정모로 자동 신청되지 않아요.</p></section>;
    return <section className="tg-card tg-stack" aria-label="선택한 정모"><div className="tg-tags"><span className="tg-tag coral">{pending ? '가입 신청 때 선택한 정모' : '선택한 정모'}</span>{pending && <span className="tg-tag">가입 승인 대기</span>}</div><h2>{selected.activity.title}</h2><p>{activityWhen(selected.activity)}</p>{selected.canOpen ? <><button className="tg-primary" onClick={() => goToSelectedActivity(intent)}>선택한 정모로 가기<ArrowRight size={16} /></button><small>모임 가입과 정모 참가는 달라요. 정모에서 참가 여부를 직접 선택해 주세요.</small></> : <p>{pending ? '가입 승인을 받으면 이 정모로 돌아갈 수 있어요. 참석 여부는 그다음에 선택해요.' : directJoin ? '모임 안내를 확인하고 가입하면 이 정모를 볼 수 있어요. 참석은 따로 선택해요.' : '먼저 모임 소개를 확인하고 가입을 신청해 주세요. 승인 후 이 정모로 돌아갈 수 있어요.'}</p>}</section>;
  };
  const publicGroupScreen = (item: TogetherGroup) => {
    const profile = discoveryProfile(item);
    const selected = publicActivities(state, item), upcoming = upcomingPublicActivities(state, item);
    const undated = selected.filter(value => value.status === 'PLANNED' && !value.date);
    const past = selected.filter(value => value.status === 'COMPLETED' || Boolean((value.endDate || value.date) && (value.endDate || value.date) < dayKey()));
    const pending = state.applications.some(value => value.groupId === item.id && value.userId === uid && value.status === 'PENDING');
    const blocked = Boolean(item.blockedMemberIds?.includes(uid));
    const joinLabel = blocked ? '가입이 제한된 모임' : pending && profile.joinMode !== 'DIRECT' ? '가입 승인 기다리는 중' : profile.recruitment === 'PAUSED' ? '지금은 모집을 쉬고 있어요' : profile.joinMode === 'DIRECT' ? viewer ? '모임 가입하기' : '로그인하고 가입하기' : viewer ? '가입 신청하기' : '로그인하고 가입 신청';
    const renderEvent = (value: typeof upcoming[number]) => <article className="tg-public-event" key={value.id}><span className="tg-date"><small>{Number(value.date.slice(5, 7))}월</small>{Number(value.date.slice(8, 10))}</span><div><h3>{value.title}</h3><small>{activityWhen(value)}</small>{value.description && <p>{value.description}</p>}</div></article>;
    const selectedIntent = intentForGroup(item.id);
    const otherUpcoming = selectedIntent ? upcoming.filter(value => value.id !== selectedIntent.activityId) : upcoming.slice(1);
    const preview = <>{selectedPublicActivity(item.id)}{!selectedIntent && upcoming.length > 0 && <section className="tg-public-intro__section"><h3>다가오는 번개·정모</h3>{renderEvent(upcoming[0])}</section>}{otherUpcoming.length > 0 && <details className="tg-public-intro__section"><summary>다른 일정 {otherUpcoming.length}개 보기<ChevronDown size={15}/></summary>{otherUpcoming.map(renderEvent)}</details>}</>;
    return <>{header(item.name, '가입 전 모임 소개', 'together-find')}<div className="tg-pad tg-public-introduction-page"><PublicGroupIntroduction state={state} groupId={item.id} viewerId={uid} onJoin={() => openPublicJoin(item.id)} joinLabel={joinLabel} joinDisabled={blocked || pending && profile.joinMode !== 'DIRECT'} activityPreview={preview}>
      {undated.length > 0 && <details className="tg-public-intro__section"><summary>날짜를 함께 정할 만남 {undated.length}개<ChevronDown size={15}/></summary>{undated.map(value => <article key={value.id}><h4>{value.title}</h4><p>{value.description}</p></article>)}</details>}
      {past.length > 0 && <details className="tg-public-intro__section"><summary>지난 활동 {past.length}개 보기<ChevronDown size={15}/></summary>{past.map(value => <article key={value.id}><h4>{value.title}</h4><small>{dateLabel(value.date)}</small><p>{value.description}</p></article>)}</details>}
      {pending && <button type="button" className="tg-text-button" onClick={() => mutate(draft => { draft.applications = draft.applications.filter(value => !(value.groupId === item.id && value.userId === uid && value.status === 'PENDING')); }, '가입 신청을 취소했어요.')}>가입 신청 취소</button>}
    </PublicGroupIntroduction></div></>;
  };

  const groupScreen = () => {
    if (!group) return missing();
    if (!member) return isDiscoverableGroup(group) ? publicGroupScreen(group) : denied();
    if (group.spaceType === 'ACTIVITY') { const target = state.activities.find(item => item.groupId === group.id); return <>{header(group.name, '개인 약속', 'appointments')}<div className="tg-pad tg-stack">{target ? activityCard(target) : <Empty title="연결된 약속이 없어요">내 약속에서 다시 확인해 주세요.</Empty>}</div></>; }
    const upcoming = groupActivities.filter(item => item.status === 'PLANNED' && (!item.date || (item.endDate || item.date) >= dayKey())).sort((a,b) => publicActivityTimeKey(a.date,a.startTime).localeCompare(publicActivityTimeKey(b.date,b.startTime)));
    const filtered = activityFilter === 'past' ? groupActivities.filter(item => item.status !== 'PLANNED' || Boolean(item.date && (item.endDate || item.date) < dayKey())) : upcoming;
    const dashboard = selectGroupHomeDashboard(state, uid, group.id, places);
    return <>{spaceChrome()}<div className="tg-pad tg-stack tg-group-content">{joinWelcome()}
      {group.archived && <small className="tg-archive-label">보관된 모임 · 기록은 계속 볼 수 있어요.</small>}
      {selectedPublicActivity(group.id)}{groupTab !== 'home' && groupTab !== 'board' && pinnedNotices()}
      {groupTab === 'home' && dashboard && <GroupHomeDashboard value={dashboard}
        onIntroduction={() => open('group-introduction')} onChat={() => { rememberChatOrigin(); nav(`groupchat-${group.id}`); }}
        onActivities={() => changeGroupView('activities')} onCreateActivity={() => beginCreation({ purpose: 'MEETUP' }, 'create-activity')} onActivity={openDashboardActivity}
        onPlaces={() => open('places')} onPlace={id => { const latest = repository.getSnapshot(); const target = places.find(place => place.id === id && !place.personal); if (target && selectGroupHomeDashboard(latest, uid, group.id, places) && latest.groups.find(item => item.id === group.id)?.interestPlaceIds?.includes(id)) openPlaceDetail(target); else setToast('현재 모임에 공유한 장소를 다시 확인해 주세요.'); }}
        onTasteMap={() => open('taste-map')} onMembers={() => open('members')} onMemberRecords={id => open('member-records', { memberId: id || uid, recordActivityId: '' })}
        onBoard={() => { setBoardCategory('ALL'); changeGroupView('board'); }} onPost={id => openDashboardRecord('POST', id)} onWritePost={() => open('post', { category: 'FREE' })} onWriteReview={() => open('post', { category: 'REVIEW' })}
        onAlbum={() => changeGroupView('album')} onPhoto={(type, id) => openDashboardRecord(type, id)} onUpload={() => open('upload')} onJournals={() => { setBoardCategory('JOURNAL'); changeGroupView('board'); }}
        onNotice={id => open('notice-view', { id })} onApplications={() => open('applications')} onParticipation={openParticipation}
        onPlanning={() => { rememberChatOrigin(); if (!group.archived) pendingAssistantRoom.current = roomIdForGroup(group.id); nav(`groupchat-${group.id}`); }}/>}
      {groupTab === 'activities' && <><div className="tg-between"><div className="tg-segments"><button type="button" aria-pressed={activityFilter === 'upcoming'} onClick={() => setActivityFilter('upcoming')}>예정</button><button type="button" aria-pressed={activityFilter === 'past'} onClick={() => setActivityFilter('past')}>지난 약속</button></div>{!group.archived && <button type="button" className="tg-icon" aria-label="약속 만들기" onClick={() => open('create-activity')}><Plus size={20}/></button>}</div>{filtered.length ? <div className="tg-activity-list">{filtered.map(item => activityCard(item))}</div> : <Empty title={activityFilter === 'past' ? '지난 약속이 없어요' : '예정된 약속이 없어요'}>날짜 미정의 약속도 만들어 함께 의견을 모을 수 있어요.</Empty>}{assistantEntry()}<button type="button" className="tg-inline-tool" onClick={() => nav('together-calendar')}><CalendarDays size={17}/><span>전체 캘린더에서 보기</span><ChevronRight size={16}/></button></>}
      {groupTab === 'board' && postList(false)}{groupTab === 'album' && gallery(false)}
    </div></>;
  };

  const prepScreen = () => <div className="tg-stack">{!canWriteRoom && <p className="tg-muted" role="note">지난·완료·취소·보관된 약속은 새 준비물이나 투표·놀이·챌린지를 만들 수 없어요. 기존 항목과 결과는 계속 볼 수 있어요.</p>}<div className="tg-section"><h2>준비물·담당 할 일</h2>{editor && <button disabled={!canWriteRoom} onClick={() => open('task')}><Plus size={16}/>추가</button>}</div>{state.tasks.filter(item => item.groupId === group?.id && item.activityId === activity?.id).slice().sort((a,b) => (a.completed ? 3 : a.assigneeId === uid ? 0 : !a.assigneeId ? 1 : 2) - (b.completed ? 3 : b.assigneeId === uid ? 0 : !b.assigneeId ? 1 : 2)).map(task => <div key={task.id}><label className={`tg-checkrow ${task.completed ? 'done' : ''}`}><input type="checkbox" checked={task.completed} disabled={!readRoomTask(state, uid, roomId, task.id)?.canInteract} onChange={() => mutate(draft => { toggleRoomTask(draft, uid, roomId, task.id); })}/><div><p>{task.title}</p><small>{task.assigneeId ? memberName(state, task.assigneeId, group?.id) : '공동 준비'}{task.dueDate ? ` · ${dateLabel(task.dueDate)}까지` : ''}</small></div></label>{task.sourceMessageIds?.[0] && <button className="tg-text-button" onClick={() => openTaskSource(task.sourceMessageIds![0])}>관련 대화 보기<ArrowRight size={14}/></button>}</div>)}{!state.tasks.some(item => item.groupId === group?.id && item.activityId === activity?.id) && <p className="tg-muted">{canWriteRoom ? '챙길 물건이나 확인할 일을 등록해요.' : '등록한 준비물·할 일이 없어요.'}</p>}<div className="tg-section"><h2>함께 고르기</h2><button disabled={!canWriteRoom} onClick={() => open('poll')}><Plus size={16}/>투표</button></div>{state.polls.filter(item => item.groupId === group?.id && item.activityId === activity?.id).map(poll => <PollView key={poll.id} state={state} userId={uid} poll={poll} places={places} onVote={optionId => mutate(draft => { checkRoomItem(draft.polls.find(item => item.id === poll.id)); voteRoomPoll(draft, uid, poll.id, optionId); })} onClosePoll={() => closePoll(poll.id)} onConfirm={optionId => confirmPoll(poll.id, optionId)} onEdit={() => editPoll(poll.id)} onApplyToActivity={openPollApplication}/>)}<div className="tg-participation-links"><button type="button" onClick={() => openParticipation('games')}><Dices size={16}/>{canWriteRoom ? '함께 놀기' : '놀이 기록'}</button><button type="button" onClick={() => openParticipation('challenges')}><Trophy size={16}/>{canWriteRoom ? '챌린지' : '챌린지 기록'}</button><button type="button" onClick={() => openParticipation('poll')}><BarChart3 size={16}/>{canWriteRoom ? '투표 모아보기' : '투표 기록'}</button></div></div>;

  const activityScreen = () => {
    if (!activity || !group) return missing(); if (!member) return denied();
    const workspace = selectActivityWorkspace(state, uid, group.id, activity.id);
    if (!workspace) return denied();
    const joined = activity.participants[uid] === 'JOINED', active = canWriteRoom;
    const before = workspace.phase === 'UNSCHEDULED' || workspace.phase === 'UPCOMING';
    const participants = Object.entries(activity.participants).filter(([id, status]) => status === 'JOINED' && group.memberIds.includes(id) && !group.blockedMemberIds?.includes(id));
    const openRoute = () => sharedRouteSection.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    const openChat = () => { rememberChatOrigin(); nav(`activitychat-${activity.id}`); };
    const openRecords = (view: 'posts' | 'media' = 'posts') => { setBoardCategory('ALL'); setRecordView(view); changeActivityView('record'); };
    const openPhoto = (source: 'POST' | 'MEDIA', id: string) => openDashboardRecord(source, id);
    const arrival = () => mutate(draft => { const target = draft.activities.find(item => item.id === activity.id)!; if (!isMember(draft, uid, group.id) || target.status !== 'PLANNED' || target.participants[uid] !== 'JOINED' || draft.groups.find(item => item.id === group.id)?.archived || selectActivityWorkspace(draft, uid, group.id, activity.id)?.phase !== 'TODAY') throw new Error('참가하기로 한 약속 당일에 도착을 표시할 수 있어요.'); target.arrivedIds = target.arrivedIds.includes(uid) ? target.arrivedIds.filter(id => id !== uid) : [...target.arrivedIds, uid]; });
    const rsvp = <section className="tg-rsvp"><div className="tg-between"><h2>함께할까요?</h2><small>참가 선택 {participants.length}{activity.capacity ? `/${activity.capacity}` : ''}명</small></div><div className="tg-segments">{([['JOINED','참가'],['MAYBE','미정'],['DECLINED','불참']] as const).map(([id,label]) => <button type="button" key={id} aria-pressed={activity.participants[uid] === id} disabled={!active} onClick={() => mutate(draft => { setGroupParticipation(draft,activity.id,uid,id); }, `참가 상태를 ‘${label}’으로 변경했어요.`)}>{activity.participants[uid] === id && <Check size={15}/>} {label}</button>)}</div><small>{!active ? '종료·취소·보관된 약속은 참가 상태를 바꿀 수 없어요.' : activity.capacity && participants.length >= activity.capacity && !joined ? '정원이 찼어요. 다른 약속도 확인해 보세요.' : group.spaceType === 'ACTIVITY' ? '함께할지 직접 선택해 주세요. 실제 참석·예약 완료와는 달라요.' : '모임 가입과 별도로 이 약속의 참가를 선택해요.'}</small></section>;
    const memberRows = <><div className="tg-section"><h2>함께하는 멤버 {participants.length}명</h2></div>{participants.map(([id]) => <button type="button" className="tg-member tg-activity-member" key={id} aria-label={`${memberName(state, id, group.id)}님 프로필 보기`} onClick={() => { if (selectMemberRecords(repository.getSnapshot(), uid, group.id, id, activity.id)) open('member-records', { memberId: id, recordActivityId: activity.id }); }}><MemberAvatar name={memberName(state, id, group.id)} avatar={state.members.find(item => item.id === id)?.avatar}/><span><strong>{memberName(state, id, group.id)}</strong><small>{activity.arrivedIds.includes(id) ? '도착했어요' : '참석 예정'}</small></span><ChevronRight size={16}/></button>)}{!participants.length && <p>첫 참석을 기다리고 있어요.</p>}</>;
    const personal = activity.journey && <PersonalRouteSummary state={state} userId={uid} groupId={group.id} activityId={activity.id} places={places} onOpen={() => open('personal-route')} onMembers={() => open('personal-route', { tab: 'MEMBERS' })} onChanges={() => open('personal-route', { tab: 'CHANGES' })} onGuide={() => open('visit-guide')}/>;
    const records = <ActivityRecordShelf value={workspace} onPhoto={openPhoto} onPosts={() => openRecords('posts')} onMedia={() => openRecords('media')}/>;
    const route = <div ref={sharedRouteSection} className="activity-route-focus"><ActivityPlacesRoute state={state} userId={uid} groupId={group.id} activityId={activity.id} places={places} compactContext={workspace.phase === 'TODAY'} onSavePlace={onSavePlace} renderPlaceDetail={place => businessContent(place, true)} onAction={action => mutate(draft => { applyActivityPlaceAction(draft, uid, action, places); })}/>{activity.journey && <div className="tg-activity-route-tools"><button type="button" onClick={() => onCopyJourney(activity.journey!)}>이 동선을 내 여행으로 만들기</button>{editor && workspace.writable && <button type="button" onClick={() => open('itinerary')}>공동 동선 상세 편집</button>}</div>}</div>;
    return <>{spaceChrome()}<div className="tg-pad tg-stack tg-activity-content" data-activity-phase={workspace.phase}>{joinWelcome()}{pinnedNotices()}
      {activityTab === 'schedule' && <>
        <ActivityPhaseHeading value={workspace} when={activityWhen(activity)} venue={activity.meetingPoint} onChat={openChat} onRoute={openRoute} onRecords={() => openRecords()} onChooseDate={canWriteRoom ? () => editor ? openActivitySettings() : open('planning', { tool: 'dates' }) : undefined}/>
        {before && rsvp}
        {workspace.phase === 'TODAY' && <div className="activity-day-presence"><span>{joined ? '나는 함께하기로 했어요' : '내 참가 상태를 확인해 주세요'}</span><button type="button" disabled={!active || !joined} onClick={arrival}>{activity.arrivedIds.includes(uid) ? '도착 취소' : '도착했어요'}</button></div>}
        {!before && workspace.phase !== 'TODAY' && records}
        {before && personal}
        {before && (canWriteRoom || state.decisions?.some(item => item.groupId === group.id && item.activityId === activity.id)) && <button type="button" className="tg-activity-decide" onClick={() => open('decide')}><Users size={18}/><span><strong>장소·날짜 함께 정하기</strong><small>후보 비교 → 투표 → 확인 후 일정에 반영</small></span><ChevronRight size={16}/></button>}
        {route}
        {!before && personal}
        {before ? memberRows : <details className="activity-rsvp-details"><summary><span>참가 상태·함께한 멤버 {participants.length}명</span><ChevronDown size={16}/></summary><div className="tg-stack">{rsvp}{memberRows}</div></details>}
        {workspace.writable && workspace.pendingCount > 0 && <button type="button" className="tg-inline-tool" onClick={() => changeActivityView('prep')}><ClipboardList size={17}/><span>내 준비 {workspace.ownPending.length} · 공동 준비 {workspace.sharedPending.length}개 남음</span><ChevronRight size={16}/></button>}
        <details className="shared-route-planning"><summary>장소·준비 도구<ChevronDown size={17}/></summary><div><button type="button" onClick={() => open('businesses')}><MapPin size={18}/><span>업체 찾기·추천</span><ChevronRight size={16}/></button><button type="button" onClick={() => open('taste-map')}><Heart size={18}/><span>우리 모임이 좋아했던 곳</span><ChevronRight size={16}/></button>{!before && <button type="button" onClick={() => open('decide')}><Users size={18}/>함께 정한 기록<ChevronRight size={16}/></button>}{assistantEntry()}</div></details>
        {(activity.description || activity.cover) && <details className="tg-activity-description"><summary>약속 소개<ChevronDown size={17}/></summary>{activity.cover && isSafeTogetherImageUrl(activity.cover) && <figure className="tg-appointment-cover"><img src={activity.cover} alt={activity.title}/><PhotoCredit image={activity.cover}/></figure>}{activity.description && <p>{activity.description}</p>}</details>}
        {group.temporaryRoom && <details className="activity-temporary-details"><summary>일회성 모임 · {temporaryRoomPurposeLabel(group.temporaryRoom.purpose)}<ChevronDown size={16}/></summary><div className="temporary-room-banner"><small>{group.archived ? '종료한 모임이에요. 보관한 기록과 업체 평가는 볼 수 있어요.' : group.temporaryRoom.expiresAt ? `자동 종료 ${new Date(group.temporaryRoom.expiresAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : '종료와 기록 보관 여부는 만든 사람이 선택해요.'}</small><div className="temporary-room-controls">{!group.archived && manager && <button type="button" onClick={() => open('invite')}>초대하기</button>}{manager && <button type="button" onClick={() => open('temporary-manage', { expectedRevision: String(activity.revision), disposition: 'ARCHIVE' })}>{group.archived ? '기록 관리' : '종료·기록'}</button>}<button type="button" aria-label="내 일회성 모임" onClick={() => nav('together-oneoff')}><ClipboardList size={18}/></button></div></div></details>}
      </>}
      {activityTab === 'prep' && <><section className="activity-prep-priority"><h2>{canWriteRoom ? '내가 먼저 챙길 일' : '함께 준비했던 내용'}</h2><p>{!canWriteRoom ? `등록한 준비 ${workspace.tasks.length}개 중 미완료 ${workspace.pendingCount}개가 기록되어 있어요.` : workspace.ownPending.length ? `내 담당 ${workspace.ownPending.length}개가 남아 있어요.` : workspace.sharedPending.length ? `공동 준비 ${workspace.sharedPending.length}개를 확인해 주세요.` : workspace.pendingCount ? '내 준비는 끝났어요. 다른 멤버의 준비를 기다리고 있어요.' : workspace.tasks.length ? '등록한 준비를 모두 마쳤어요.' : '아직 등록한 준비물이 없어요.'}</p><small>{canWriteRoom ? '준비물과 담당 할 일을 확인하고, 아래에서 함께 정할 내용을 살펴보세요.' : '당시 준비 항목과 투표 결과를 확인할 수 있어요.'}</small></section>{prepScreen()}<details className="activity-prep-tools"><summary>대화에서 정하기·추가 도구<ChevronDown size={16}/></summary>{assistantEntry()}</details></>}
      {(activityTab === 'record' || activityTab === 'album') && <div className="activity-record-panel">{records}{!workspace.hasRecords && <p className="activity-record-intro">{workspace.phase === 'PAST' ? '함께한 사진과 짧은 후기로 이 약속의 기억을 모아요.' : '이 약속에 남긴 글·사진·여행기를 한곳에서 볼 수 있어요.'}</p>}<div className="tg-segments" role="group" aria-label="약속 기록 종류"><button type="button" aria-pressed={recordView === 'posts'} onClick={() => setRecordView('posts')}>글·후기</button><button type="button" aria-pressed={recordView === 'media'} onClick={() => setRecordView('media')}>사진·영상</button></div><ActivityRecordActions canWrite={!group.archived && activity.status !== 'CANCELLED'} canJournal={Boolean(activity.journey && onCreateJournal)} onPost={() => open('post', { category: 'REVIEW' })} onUpload={() => open('upload')} onJournal={startActivityJournal}/>{recordView === 'media' ? gallery(true, undefined, undefined, true) : postList(true, undefined, undefined, undefined, true)}</div>}
    </div></>;
  };

  const chatScreen = () => {
    if (!group || (route.startsWith('activitychat-') && !activity)) return missing(); if (!member) return denied();
    return <>
      <ChatWorkspace key={`${uid}:${group.id}:${roomId}`} draftMemory={pageChatDraftMemory} places={places} state={state} userId={uid} group={group} activity={activity} roomId={roomId} messages={messages} notices={notices} highlight={highlight} canManage={activity ? editor : manager} error={error}
        onBack={returnFromChat}
        onCheckReply={messageId => canReplyToMessage(repository.getSnapshot(), uid, roomId, messageId)}
        onMemberProfile={memberId => { if (selectMemberRecords(repository.getSnapshot(), uid, group.id, memberId, activity?.id)) open('member-records', { memberId, recordActivityId: activity?.id || '' }); else setToast('현재 모임의 멤버를 다시 확인해 주세요.'); }}
        onResources={() => open('resources')}
        onOpenView={activity ? changeActivityView : changeGroupView}
        onManage={() => activity ? openActivitySettings() : open('manage')}
        onAssistant={() => open('planning')}
        onPersonalRoute={activity ? () => open('personal-route') : undefined}
        onVisitGuide={activity ? () => open('visit-guide') : undefined}
        onTool={tool => tool === 'plan' ? beginCreation({ purpose: activity?.kind === 'TRIP' ? 'TRIP' : 'MEETUP' }, 'planning') : open('planning', { tool })}
        onVotePoll={(pollId, optionId) => mutate(draft => { voteChatPoll(draft, uid, roomId, pollId, optionId); })}
        onClosePoll={closePoll} onConfirmPoll={confirmPoll} onEditPoll={editPoll} onApplyPollToActivity={openPollApplication} onParticipation={openParticipation}
        onToggleTask={taskId => mutate(draft => { toggleChatTask(draft, uid, roomId, taskId); })}
        onToggleMute={() => mutate(draft => { draft.mutedRooms = draft.mutedRooms.includes(roomId) ? draft.mutedRooms.filter(id => id !== roomId) : [...draft.mutedRooms, roomId]; }, state.mutedRooms.includes(roomId) ? '이 기기에 채팅 알림 켜짐 설정을 저장했어요. 알림 발송은 아직 연결 전이에요.' : '이 기기에 채팅 알림 꺼짐 설정을 저장했어요.')}
        onSummary={unreadAfter => open('ai', { scope: 'unread', person: 'all', unreadCaptured: 'yes', ...(unreadAfter ? { unreadAfter } : {}) })}
        onSource={jumpToMessage} onClearHighlight={() => setHighlight('')} onNotice={body => open('notice', body ? { title: '고정 안내', body } : {})} onReport={id => report('MESSAGE', id)} onNavigate={nav}
        onRead={() => mutate(draft => { if (!isMember(draft, uid, group.id)) throw new Error('현재 모임원만 읽음 표시를 할 수 있어요.'); draft.readCursors[roomId] = [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1)?.createdAt || now(); }, '이 채팅을 여기까지 읽음으로 표시했어요.')}
        onSend={(body, sticker, reply, mentions) => mutate(draft => { postTogetherMessage(draft, uid, roomId, body, sticker, reply, mentions); })}
        onReaction={(id, emoji) => mutate(draft => { toggleMessageReaction(draft, uid, roomId, id, emoji); })}/>
    </>;
  };

  const calendarScreen = () => {
    const allowedActivities = visibleActivities.filter(item => !state.groups.find(group => group.id === item.groupId)?.blockedMemberIds?.includes(uid));
    const dates = allowedActivities.filter(item => calendarRange(item.date)).sort((a, b) => a.date.localeCompare(b.date));
    const selectedActivities = dates.filter(item => calendarDate ? calendarIncludes(calendarRange(item.date, item.endDate), calendarDate) : calendarMonthIntersects(calendarRange(item.date, item.endDate), month));
    const plans = selectPersonalCalendarPlans(journeys);
    const selectedPlans = plans.filter(item => calendarDate ? calendarIncludes(item.range, calendarDate) : calendarMonthIntersects(item.range, month));
    const undatedActivities = allowedActivities.filter(item => !item.date);
    const changeCalendarView = (value: CalendarView) => {
      const next = normalizeCalendarView(value, month);
      setMonth(next.month); setCalendarDate(next.date); onCalendarViewChange?.(next);
    };
    const changeCalendarMonth = (offset: number) => {
      const date = new Date(`${month}-15T12:00:00`);
      date.setMonth(date.getMonth() + offset);
      changeCalendarView({ month: dayKey(date).slice(0, 7), date: '' });
    };
    const personalPlanCard = (item: typeof plans[number]) => <button type="button" className="tg-activity" key={item.id} onClick={() => onOpenJourney(item.id)}><CalendarDays size={23}/><div><h3>{item.title}</h3><small>{item.range ? `${dateLabel(item.range.startDate)}${item.range.endDate !== item.range.startDate ? ` ~ ${dateLabel(item.range.endDate)}` : ''}` : '날짜 미정'}</small></div><ChevronRight size={17}/></button>;
    return <>{header('일정 캘린더', '모임·약속과 개인 여행', 'together')}<div className="tg-pad tg-stack">
      <div className="tg-between"><button className="tg-icon" aria-label="이전 달" onClick={() => changeCalendarMonth(-1)}><ArrowLeft size={18}/></button><h2>{month.slice(0, 4)}년 {Number(month.slice(5))}월</h2><button className="tg-icon" aria-label="다음 달" onClick={() => changeCalendarMonth(1)}><ArrowRight size={18}/></button></div>
      <div className="tg-month">{['일', '월', '화', '수', '목', '금', '토'].map(day => <small style={{ textAlign: 'center' }} key={day}>{day}</small>)}{Array.from({ length: new Date(`${month}-01T12:00:00`).getDay() }, (_, index) => <span key={`blank-${index}`}/>)}{Array.from({ length: new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate() }, (_, index) => {
        const key = `${month}-${String(index + 1).padStart(2, '0')}`;
        const hasSchedule = dates.some(item => calendarIncludes(calendarRange(item.date, item.endDate), key)) || plans.some(item => calendarIncludes(item.range, key));
        return <button type="button" className={`tg-month-day ${calendarDate === key ? 'selected' : ''}`} key={key} onClick={() => changeCalendarView({ month, date: calendarDate === key ? '' : key })} aria-pressed={calendarDate === key} aria-label={`${key}${hasSchedule ? ' 일정 있음' : ''}`}>{index + 1}{hasSchedule && <span className="tg-dot"/>}</button>;
      })}</div>
      <label className="tg-form">날짜로 찾기<input type="date" value={calendarDate} onChange={event => { const value = event.target.value; changeCalendarView({ month: calendarRange(value) ? value.slice(0, 7) : month, date: value }); }}/></label>{calendarDate && <button type="button" onClick={() => changeCalendarView({ month, date: '' })}>이번 달 전체 보기</button>}
      {selectedActivities.length > 0 && <section className="tg-stack" aria-label="모임·약속 일정"><h2>모임·약속</h2>{selectedActivities.map(item => activityCard(item, true))}</section>}
      <section className="tg-stack" aria-label="개인 여행 일정"><div className="tg-section"><h2>개인 여행</h2><button type="button" onClick={() => nav('trips')}>전체 보기</button></div>{selectedPlans.map(personalPlanCard)}{!calendarDate && plans.some(item => !item.range) && <><h3>날짜 미정</h3>{plans.filter(item => !item.range).map(personalPlanCard)}</>}{!selectedPlans.length && !calendarDate && <p className="tg-muted">이번 달에는 날짜가 정해진 개인 여행이 없어요.</p>}</section>
      {!calendarDate && undatedActivities.length > 0 && <section className="tg-stack" aria-label="날짜 미정 모임·약속"><h2>날짜 미정 모임·약속</h2>{undatedActivities.map(item => activityCard(item, true))}</section>}
      {calendarDate && !selectedActivities.length && !selectedPlans.length ? <Empty title="이 날짜에는 일정이 없어요">다른 날짜를 선택하거나 이번 달 일정을 확인해 보세요.</Empty> : !selectedActivities.length && !selectedPlans.length && !calendarDate && <Empty title="이번 달에는 일정이 없어요">다른 달을 선택하거나 날짜 미정 목록을 확인해 보세요.</Empty>}
    </div></>;
  };
  const tasksScreen = () => {
    const assigned = selectAssignedTasks(state, uid), today = dayKey();
    const pending = assigned.filter(item => !item.task.completed && item.canInteract).sort((a,b) => (a.task.dueDate || '9999').localeCompare(b.task.dueDate || '9999'));
    const due = pending.filter(item => item.task.dueDate && item.task.dueDate <= today);
    const upcoming = pending.filter(item => !item.task.dueDate || item.task.dueDate > today);
    const records = assigned.filter(item => item.task.completed || !item.canInteract);
    const renderTask = ({ task, canInteract, groupName, route: taskRoute }: typeof assigned[number]) => <article className="tg-assigned-task" key={task.id}><label className={`tg-checkrow ${task.completed ? 'done' : ''}`}><input type="checkbox" checked={task.completed} disabled={!canInteract} onChange={() => mutate(draft => { toggleAssignedTask(draft, uid, task.id); })}/><div><strong>{task.title}</strong><small>{groupName}{task.dueDate && ` · ${dateLabel(task.dueDate)}까지`}{!canInteract && ' · 기록만 볼 수 있어요'}</small></div></label><button type="button" className="tg-text-button" onClick={() => nav(taskRoute)}>원래 일정으로<ArrowRight size={15}/></button></article>;
    return <>{header('내 할 일', '여러 모임의 준비를 한눈에', 'together')}<div className="tg-pad tg-stack"><div className="tg-task-inbox-summary"><strong>내가 챙길 일 {pending.length}개</strong><small>공동 준비가 아닌, 나에게 배정된 항목이에요.</small></div>{due.length > 0 && <section className="tg-task-inbox-section"><h2>오늘까지 확인할 일 <small>{due.length}</small></h2>{due.map(renderTask)}</section>}{upcoming.length > 0 && <section className="tg-task-inbox-section"><h2>다가오는 준비 <small>{upcoming.length}</small></h2>{upcoming.map(renderTask)}</section>}{records.length > 0 && <details className="tg-task-inbox-section"><summary>완료·지난 준비 기록 {records.length}개<ChevronDown size={16}/></summary>{records.map(renderTask)}</details>}{!assigned.length && <Empty title="맡은 할 일이 없어요">모임 일정의 준비 탭에서 담당 할 일을 확인할 수 있어요.</Empty>}</div></>;
  };
  const invitesScreen = () => <>{header('초대·가입 신청', '초대 링크와 가입 신청', 'together')}<div className="tg-pad tg-stack"><h2>확인할 초대</h2>{state.invites.filter(item => item.senderId !== uid && !item.revoked).map(item => <button className="tg-activity" key={item.id} onClick={() => nav(`group-invite-${item.id}`)}><Users size={24} /><div><h3>{item.name}</h3><small>{memberName(state, item.senderId, group?.id)}의 초대</small></div><ChevronRight size={18} /></button>)}<h2>보낸 초대</h2>{state.invites.filter(item => item.senderId === uid).map(item => <div className="tg-card tg-stack" key={item.id}><h3>{item.name}</h3><small>{item.revoked ? '취소됨' : item.groupId ? state.groups.find(group => group.id === item.groupId)?.spaceType === 'ACTIVITY' ? '약속 초대' : '모임 연결됨' : '첫 수락을 기다리는 중'} · 수락 {item.acceptedBy.length}명</small><div className="tg-row"><button onClick={() => nav(`group-invite-${item.id}`)}>초대 보기</button>{!item.revoked && <button onClick={() => mutate(draft => { draft.invites.find(value => value.id === item.id)!.revoked = true; }, '초대를 취소했어요.')}>초대 취소</button>}</div></div>)}<h2>내 가입 신청</h2>{state.applications.filter(item => item.userId === uid).map(item => <div className="tg-card" key={item.id}><h3>{state.groups.find(value => value.id === item.groupId && (isDiscoverableGroup(value) || isMember(state, uid, value.id) && !value.blockedMemberIds?.includes(uid)))?.name || '공개가 종료된 모임'}</h3><small>{item.status === 'PENDING' ? '승인 대기' : item.status === 'APPROVED' ? item.joinMode === 'DIRECT' ? '직접 가입 완료' : '가입 승인됨' : '신청 종료'}</small>{item.message && <p>{item.message}</p>}{item.publicActivityIntent && (() => { const selected = resolvePublicActivityIntent(state, item.publicActivityIntent, uid); return selected ? <div className="tg-stack"><span className="tg-tag coral">선택한 정모</span><strong>{selected.activity.title}</strong><small>{activityWhen(selected.activity)}</small>{item.status === 'APPROVED' && selected.canOpen ? <button className="tg-primary" onClick={() => goToSelectedActivity(item.publicActivityIntent!)}>선택한 정모로 가기<ArrowRight size={16} /></button> : item.status === 'PENDING' ? <small>가입 승인 후 이 정모로 돌아갈 수 있어요. 참석은 별도로 선택해요.</small> : null}</div> : <p>선택한 정모의 공개 안내가 바뀌었어요. 모임에서 다시 확인해 주세요.</p>; })()}<button className="tg-text-button" onClick={() => nav(`group-${item.groupId}`, { ...discoveryFilters, publicActivityIntent: item.publicActivityIntent })}>{item.status === 'APPROVED' ? '모임으로 가기' : '모임 소개 보기'}<ChevronRight size={16} /></button>{item.status === 'PENDING' && <button className="tg-text-button" onClick={() => mutate(draft => { draft.applications = draft.applications.filter(value => value.id !== item.id); }, '가입 신청을 취소했어요.')}>신청 취소</button>}</div>)}{!state.invites.length && !state.applications.length && <Empty title="아직 초대가 없어요">모임에서 함께할 친구를 초대하거나 공개 모임에 가입해 보세요.</Empty>}</div></>;
  const sharesScreen = () => {
    const ownShares = state.sharedJournals.filter(item => item.authorId === uid);
    return <>{header('내 공유 관리', '내 여행기의 모임 공유', 'together')}<div className="tg-pad tg-stack"><div className="tg-summary"><h2>공유 중인 여행기 {ownShares.length}개</h2><p>모임에서 나온 뒤에도 내가 공유한 여행기를 관리할 수 있어요. 공유를 해제해도 개인 원본은 유지돼요.</p></div>{ownShares.map(item => { const targetGroup = state.groups.find(value => value.id === item.groupId); const sourceId = item.sourceJourneyId || item.journey.sourceJourneyId; return <article className="tg-card tg-stack" key={item.id}><label className="tg-checkrow"><input type="checkbox" checked={withdrawIds.includes(item.id)} onChange={() => setWithdrawIds(current => current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id])} /><div><small>{targetGroup?.name || '기존 모임'} · {targetGroup?.memberIds.includes(uid) ? '가입 중' : '나온 모임에 공유 중'}</small><h3>{item.journey.title}</h3></div></label><div className="tg-row">{sourceId && journeys.some(journey => journey.id === sourceId && !journey.trash) && <button onClick={() => onOpenJourney(sourceId)}>개인 원본 보기</button>}<button className="tg-danger" onClick={() => { setWithdrawIds([item.id]); open('withdraw-shares'); }}>이 공유 해제</button></div></article>; })}{ownShares.length > 0 ? <><button className="tg-primary tg-wide" disabled={!withdrawIds.some(id => ownShares.some(item => item.id === id))} onClick={() => open('withdraw-shares')}>선택한 공유 해제</button><button className="tg-danger tg-wide" onClick={() => open('withdraw-shares', { all: 'yes' })}>모든 모임의 내 여행기 공유 해제</button></> : <Empty title="모임에 공유 중인 여행기가 없어요" action={<button onClick={() => nav('trips')}>내 여행 열기</button>}>개인 여행기에서 함께하기를 눌러 모임에 공유할 수 있어요.</Empty>}</div></>;
  };
  const inviteScreen = () => {
    const invite = state.invites.find(item => item.id === route.slice(13)); if (!invite) return missing();
    const invitedGroup = state.groups.find(item => item.id === invite.groupId);
    const standalone = invitedGroup?.spaceType === 'ACTIVITY';
    const targetActivity = standalone ? state.activities.find(item => item.groupId === invitedGroup.id) : undefined;
    const available = !invite.revoked && (invite.acceptedBy.includes(uid) || Date.parse(invite.expiresAt) > Date.now());
    return <>{header('함께해요', standalone ? '약속 초대' : '모임 초대', 'together-invites')}<div className="tg-pad tg-stack"><div className="tg-summary"><span className="tg-kicker">{memberName(state, invite.senderId, group?.id)}의 초대</span><h2>{invite.name}</h2><p>{kindNames[invite.kind]}{invite.region ? ` · ${invite.region}` : ''}</p>{targetActivity && <small>{activityWhen(targetActivity)}</small>}</div>
      {invite.sourceJourney && <div className="tg-card"><small>{invite.sourceJourney.purpose === 'JOURNAL' ? '함께 볼 여행기' : '함께할 일정'}</small><h3>{invite.sourceJourney.title}</h3></div>}
      <p>{standalone ? '수락하면 이 약속의 일정·준비·대화·기록을 볼 수 있어요. 영구 모임에 가입하지 않으며 참가 여부는 약속에서 따로 선택해요.' : <>수락하면 모임의 지난 일정과 채팅·사진을 볼 수 있어요. {invite.groupId ? '이미 만들어진 모임에 가입해요.' : '첫 번째 수락 시 초대자를 모임장으로 모임이 만들어져요.'}</>}</p>
      {invite.senderId === uid ? <><small>이 초대는 현재 기기에 저장되어 있어요. 다른 기기에서 수락하려면 서버 연결이 필요해요.</small><button type="button" onClick={() => { if (navigator.clipboard) navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#group-invite-${invite.id}`).then(() => setToast('이 기기에서 확인할 수 있는 링크를 복사했어요.')).catch(() => setError('링크를 복사하지 못했어요.')); }}>초대 링크 복사</button>{targetActivity && <button type="button" onClick={() => nav(`activity-${targetActivity.id}`)}>약속으로 돌아가기<ChevronRight size={16}/></button>}</>
        : <button type="button" className="tg-primary tg-wide" disabled={!available || standalone && !targetActivity} onClick={() => { if (!requireUser()) return; let id = ''; if (mutate(draft => { id = acceptInvite(draft, invite.id, uid); }, '초대를 수락했어요.')) { const latest = repository.getSnapshot(); const parent = latest.groups.find(item => item.id === id); const target = parent?.spaceType === 'ACTIVITY' ? latest.activities.find(item => item.groupId === id) : undefined; nav(target ? `activity-${target.id}` : `group-${id}`); } }}>{!available ? '만료되거나 취소된 초대' : invite.acceptedBy.includes(uid) ? standalone ? '약속으로 이동' : '모임으로 이동' : '초대 수락'}</button>}
    </div></>;
  };

  const shareScreen = () => {
    if (!sourceJourney) return missing();
    if (!viewer) return <>{header('함께하기', sourceJourney.title, 'trips')}<div className="tg-pad"><Empty title="로그인하고 함께해요" action={<button className="tg-primary" onClick={onLogin}>로그인</button>}>개인 원본을 유지하며 모임에 공유할 수 있어요.</Empty></div></>;
    return <>{header('함께하기', sourceJourney.title, 'trips')}<div className="tg-pad tg-stack"><div className="tg-summary"><h2>{sourceJourney.title}</h2><p>{sourceJourney.purpose === 'JOURNAL' ? '선택한 여행기 버전을 모임에 공유해요. 개인 원본은 그대로 유지돼요.' : '모임 전용 일정 사본을 만들어요. 개인 메모와 예약 정보는 자동 공유하지 않아요.'}</p></div>{!isShareableJourney(sourceJourney) && <div className="tg-error">아직 작성 중이거나 미확정 후보가 있어요. 내 여행에서 장소를 확인하고 완료한 뒤 함께할 수 있어요.<button onClick={() => onOpenJourney(sourceJourney.id)}>내 여행에서 이어서 작성</button></div>}<h2>기존 모임에 {sourceJourney.purpose === 'JOURNAL' ? '공유' : '일정 추가'}</h2>{myGroups.filter(item => !item.archived).map(item => <button className="tg-activity" key={item.id} disabled={!isShareableJourney(sourceJourney)} onClick={() => { if (mutate(draft => { createGroupFromJourney(draft, sourceJourney, uid, { groupId: item.id }); }, '모임에 추가했어요. 개인 원본은 유지돼요.')) nav(`group-${item.id}`); }}><Users size={22} /><div><h3>{item.name}</h3><small>{item.memberIds.length}명</small></div><Plus size={18} /></button>)}<button className="tg-primary tg-wide" disabled={!isShareableJourney(sourceJourney)} onClick={() => open('share', { name: `${sourceJourney.title} 함께하기`, kind: 'FAMILY', region: sourceJourney.region })}>새 모임으로 초대</button><small>새 모임 초대는 상대방이 처음 수락할 때 모임이 생성돼요.</small></div></>;
  };
  const missing = () => <>{header('화면을 찾을 수 없어요', '함께하기', 'together')}<div className="tg-pad"><Empty title="연결된 내용을 찾지 못했어요" action={<button onClick={() => nav('together')}>함께하기로</button>}>삭제되었거나 이 기기에 없는 내용일 수 있어요.</Empty></div></>;
  const denied = () => <>{header('모임원만 볼 수 있어요', '함께하기', 'together')}<div className="tg-pad"><Empty title="이 모임에 접근할 수 없어요" action={<button className="tg-primary" onClick={viewer ? () => nav('together') : onLogin}>{viewer ? '내 모임으로' : '로그인'}</button>}>초대를 수락하거나 가입 승인을 받은 뒤 이용해 주세요.</Empty></div></>;

  const field = (key: string, label: string, type = 'text', required = false) => <label>{label}<input type={type} value={form[key] ?? ''} onChange={event => set(key, event.target.value)} onInput={type === 'date' || type === 'time' ? event => set(key, event.currentTarget.value) : undefined} required={required} maxLength={type === 'text' ? 160 : undefined} /></label>;
  const area = (key: string, label: string) => <label>{label}<textarea value={form[key] ?? ''} onChange={event => set(key, event.target.value)} maxLength={4000} /></label>;
  const submit = (event: React.FormEvent, fn: () => void) => { event.preventDefault(); setError(''); fn(); };
  const activityCoverEditor = () => <section className="tg-activity-cover-editor"><strong>약속 대표 사진 · 선택</strong>{form.cover && isSafeTogetherImageUrl(form.cover) && <img src={form.cover} alt="선택한 약속 대표 사진"/>}<div className="tg-row"><TogetherPhotoPicker key={`${uid}:${group?.id || ''}:${activity?.id || ''}:${modal}`} purpose="COVER" label={form.cover ? '대표 사진 바꾸기' : '대표 사진 고르기'} onSelect={url => set('cover', url)}/>{form.cover && <button type="button" onClick={() => set('cover', '')}>사진 빼기</button>}</div><small>함께할 약속을 알아보기 쉬운 사진을 선택해요.</small></section>;
  const saveActivity = (event: React.FormEvent) => submit(event, () => {
    if (!group || !member || group.archived) return;
    if (form.endDate && (!form.date || form.endDate < form.date)) return setError('종료일은 시작일 이후로 선택해 주세요.');
    if (form.startTime && !form.date) return setError('시작 시간을 정하려면 날짜도 선택해 주세요.');
    if (form.capacity && (!Number.isInteger(Number(form.capacity)) || Number(form.capacity) < 1 || Number(form.capacity) > 500)) return setError('참석 정원은 1~500명 사이로 입력해 주세요.');
    if (form.cover && !isSafeTogetherImageUrl(form.cover)) return setError('대표 사진을 다시 선택해 주세요.');
    const selectedJourney = form.activityKind === 'TRIP' ? journeys.find(item => item.id === form.journeyId) : undefined;
    if (selectedJourney && !isShareableJourney(selectedJourney)) return setError('내 여행의 후보와 방문 장소를 먼저 확정해 주세요.');
    if (selectedJourney && form.date) { const last = setPlanDates(selectedJourney, form.date).days.at(-1)!.date; if (form.endDate && form.endDate !== last) return setError(`가져온 동선은 ${selectedJourney.days.length}일이에요. 종료일을 ${last}로 맞춰주세요.`); }
    let id = '';
    if (mutate(draft => {
      const source = selectedJourney;
      const currentGroup = draft.groups.find(item => item.id === group.id);
      if (!currentGroup || currentGroup.archived || !isMember(draft, uid, group.id)) throw new Error('이 모임에 번개·정모를 만들 수 없어요.');
      id = togetherId('activity');
      draft.activities.push({ id, groupId: group.id, cover: form.cover || undefined, kind: source || form.activityKind === 'TRIP' ? 'TRIP' : 'MEETUP', startTime: form.startTime || undefined, capacity: form.capacity ? Number(form.capacity) : undefined, title: form.title.trim(), date: form.date || '', endDate: selectedJourney && form.date ? setPlanDates(selectedJourney, form.date).days.at(-1)!.date : form.endDate || '', meetingPoint: form.meetingPoint || '', description: form.description || '', status: 'PLANNED', leadId: uid, editorIds: [], participants: {}, arrivedIds: [], journey: source ? setPlanDates(copyJourneyForGroup(source, viewer!.name), form.date || '') : undefined, revision: 1 });
      shareChatEntity(draft, uid, { type: 'ACTIVITY', id });
    }, '번개·정모를 만들었어요.')) { setModal(null); nav(`activity-${id}`); }
  });
  const createInvite = (event: React.FormEvent) => submit(event, () => {
    if (!requireUser()) return; if (sourceJourney && !isShareableJourney(sourceJourney)) return setError('방문 장소와 후보를 확인하고 내 여행에서 먼저 완료해 주세요.'); let id = '';
    if (mutate(draft => { if (!sourceJourney) { const target = draft.groups.find(item => item.id === group?.id); if (!target || target.archived || !target.memberIds.includes(uid) || target.ownerId !== uid && !target.managerIds.includes(uid)) throw new Error('기존 모임의 직접 초대는 모임장과 운영진이 할 수 있어요.'); } id = togetherId('invite'); draft.invites.push({ id, intentId: togetherId('intent'), sourceTripId: sourceJourney?.id, sourceJourney: sourceJourney ? snapshotJourneyForGroup(sourceJourney, viewer!.name) : undefined, groupId: sourceJourney ? undefined : group?.id, senderId: uid, name: form.name || group?.name || '우리 모임', kind: (form.kind || group?.kind || 'FAMILY') as GroupKind, region: form.region || group?.region || '', acceptedBy: [], expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(), revoked: false }); }, '초대를 만들었어요.')) { setModal(null); nav(`group-invite-${id}`); }
  });
  const goToChat = () => { if (!group || !member) return; rememberChatOrigin(); setModal(null); nav(activity ? `activitychat-${activity.id}` : `groupchat-${group.id}`); };
  const jumpToMessage = (id: string) => {
    if (!group || !member || !messages.some(item => item.id === id && !item.deleted)) return;
    setModal(null);
    if (!inChat) { rememberChatOrigin(); pendingSourceJump.current = id; nav(activity ? `activitychat-${activity.id}` : `groupchat-${group.id}`); return; }
    setHighlight(id); window.setTimeout(() => scrollChatTo(id), 60);
  };
  const summaryUnreadAfter = form.unreadCaptured === 'yes' ? form.unreadAfter : state.readCursors[roomId];
  const selectedMessages = messages.filter(item => (form.person === 'all' || !form.person || item.authorId === form.person) && (form.scope !== 'unread' || !summaryUnreadAfter || item.createdAt > summaryUnreadAfter) && (form.scope !== 'today' || dayKey(new Date(item.createdAt)) === dayKey()) && (form.scope !== 'date' || ((!form.from || dayKey(new Date(item.createdAt)) >= form.from) && (!form.to || dayKey(new Date(item.createdAt)) <= form.to))));
  const exampleTemplates: Record<string, { sourceBody: string; category: string; text: string; task?: string; assignee?: string }> = {
    'family-general-1': { sourceBody: '지난 여행 사진은 앨범에 모아 둘게요. 다음 여행 이야기는 부산 가족여행 일정에서 해요.', category: '모임 안내', text: '지난 여행 사진은 앨범에, 다음 여행 대화는 해당 일정 채팅에 모으기' },
    'family-general-2': { sourceBody: '좋아요. 공지와 다음 일정은 모임 홈에서도 볼 수 있어요.', category: '확인할 곳', text: '공지와 다음 일정은 모임 홈에서 확인하기' },
    'friends-chat-1': { sourceBody: '토요일에 읽고 있는 책이나 좋아하는 이야기를 나눠요. 새 정모에 참가 여부를 남겨 주세요.', category: '모임 준비', text: '읽고 있는 책이나 이야기 준비 · 토요일 정모에서 참석 여부 선택' },
    'family-chat-2': { sourceBody: '기차 시간을 확인했어요. 부산역 10시 30분, 2번 출구로 확정해요.', category: '확정된 내용', text: '부산역 2번 출구 · 10시 30분 집합' },
    'family-chat-3': { sourceBody: '계단이 적고 오래 걷지 않는 곳이면 좋겠어. 중간에 카페에서 쉬자.', category: '동행자 요청', text: '계단과 걷는 거리를 줄이고 중간에 카페에서 쉬기', task: '계단·걷는 거리와 카페 휴식 시간을 동선에서 확인' },
    'family-chat-4': { sourceBody: '점심은 식당 A와 식당 B 중 골라요. 아직 결정하지 않았어요.', category: '논의 중인 후보', text: '점심 식당 A / B · 아직 결정하지 않음' },
    'family-chat-5': { sourceBody: '제가 식당 예약이 가능한지 알아볼게요. 아직 예약한 건 아니에요.', category: '확인할 일', text: '식당 예약 가능 여부 확인 · 예약 완료 아님', task: '점심 식당 예약 가능 여부 확인' },
    'family-chat-6': { sourceBody: '각자 보조배터리와 편한 신발을 챙기자.', category: '준비물', text: '각자 보조배터리와 편한 신발 챙기기', task: '보조배터리와 편한 신발 챙기기' },
  };
  // Both the known fixture ID and its unchanged original must match. Customer text is never interpreted here.
  const isExampleMessage = (message: typeof messages[number]) => exampleTemplates[message.id]?.sourceBody === message.body;
  const exampleResults = member ? selectedMessages.filter(isExampleMessage).map(message => ({ message, ...exampleTemplates[message.id] })) : [];
  const canApply = activity ? editor : manager;
  const memberRecordScopeId = form.recordActivityId !== undefined ? form.recordActivityId || undefined : activity?.id;
  const memberRecordActivity = state.activities.find(item => item.id === memberRecordScopeId && item.groupId === group?.id);
  const memberRecordDestination = (kind: string) => form.recordReturn === 'yes' && group ? <div className="tg-member-records__scope"><strong>{group.name}{memberRecordScopeId ? ` › ${memberRecordActivity?.title || '약속을 다시 확인해 주세요'}` : ' · 모임 전체'}</strong><small>이 공간에 내 {kind}을 공유해요.</small></div> : null;
  const modalTitle: Record<Modal, string> = { 'personal-route': '내 구간과 함께하는 일정', 'visit-guide': '방문 안내', decide: '함께 결정하기', 'taste-map': '우리 취향 지도', 'taste-place': '우리 평가', 'temporary-manage': '일회성 모임 종료·기록', businesses: '업체 찾기·추천', 'poll-apply': '일정 변경 확인', 'edit-group': '모임 정보 수정', managers: '운영진 관리', 'group-introduction': '모임 소개·안내', 'place-detail': '장소 상세', 'member-records': '멤버 프로필', 'member-profile-edit': '내 모임 프로필 편집', 'share-record': '내 기록 공유하기', resources: '대화방 자료 모아보기', 'room-tasks': '이 방의 준비물·할 일', 'notice-view': '공지', 'recent-groups': '최근 본 모임', 'join-settings': '새 멤버 가입 안내', creation: '계획 초안 만들기', planning: planningPicker ? '장소 후보 담기' : form.tool === 'dates' ? '날짜 투표' : form.tool === 'places' ? '장소 제안·투표' : form.tool === 'departure' ? '준비물·할 일' : '약속 도우미', 'create-group': '새 모임 만들기', 'create-activity': '새 약속 만들기', members: '모임 멤버', applications: '가입 신청 관리', 'review-application': '가입 신청 확인', apply: form.joinMode === 'DIRECT' ? '모임 가입' : '모임 가입 신청', manage: '모임 메뉴', promotion: '모임 홍보', invite: group?.spaceType === 'ACTIVITY' ? '약속에 초대' : '모임으로 초대', post: '이야기 남기기', task: '준비할 일 추가', poll: form.editId ? '투표 수정' : '투표', games: '함께 놀기', challenges: '챌린지', notice: activity ? '이 일정 공지' : '모임 전체 공지', ai: '대화 요약·정리', assistant: '약속 도우미', places: form.mode === 'append' ? activity && activityKind(activity) === 'MEETUP' ? '모임 장소 찾기' : '일정에 장소 추가' : '모임 관심 장소', 'remove-member': '모임원 내보내기', 'restore-member': '가입 제한 해제', 'withdraw-shares': '여행기 공유 해제', 'edit-activity': activity && activityKind(activity) === 'TRIP' ? '여행 일정 관리' : '번개·정모 관리', itinerary: '공동 동선 수정', upload: '사진·영상 올리기', report: '신고하기', share: '새 모임으로 초대' };

  const moveVisit = (dayNumber: number, index: number, direction: number) => {
    if (!activity || !editor) return;
    mutate(draft => { const target = draft.activities.find(item => item.id === activity.id)!; const day = target.journey?.days.find(item => item.day === dayNumber); const source = day?.places[index]; if (!day || !source?.visitId || !target.journey) return; const groups = planVisitGroups(day); const current = groups.findIndex(items => items.some(item => item.visitId === source.visitId)); const next = current + direction; if (next < 0 || next >= groups.length) return; const before = direction < 0 ? groups[next][0].visitId! : groups[next + 1]?.[0].visitId ?? null; target.journey = { ...movePlanVisitBefore({ ...target.journey, isMine: true }, day.dayId!, source.visitId, before), isMine: false }; target.revision += 1; }, '방문 순서를 변경했어요.');
  };
  const modalContent = () => {
    if (modal === 'poll-apply' && group && activity && member && pollApplication) return <div className="tg-poll-application">
      <p className="tg-muted">{pollApplication.activityTitle} · {pollApplication.kind === 'DATE' ? '날짜·시간 변경' : '만날 장소 변경'}</p>
      <h3>확정한 후보를 일정에 반영할까요?</h3>
      <dl><div><dt>현재 일정</dt><dd>{pollApplication.beforeLabel}</dd></div><div className="tg-poll-proposed"><dt>반영할 내용</dt><dd>{pollApplication.afterLabel}</dd></div></dl>
      {pollApplication.notes.map(note => <p className="tg-muted" key={note}>{note}</p>)}
      <p className="tg-muted">참석 선택과 예약은 그대로예요. 기존 공지 내용은 필요하면 직접 수정해 주세요.</p>
      <button type="button" className="tg-primary" onClick={() => {
        if (pollApplication.groupId !== group.id || pollApplication.activityId !== activity.id) return setError('이 투표가 속한 약속을 다시 확인해 주세요.');
        if (mutate(draft => { applyPollActivityApplication(draft, uid, pollApplication, places); }, '확정안을 일정에 반영했어요. 참석 선택은 유지해요.')) {
          setModal(null); activityTabs.current[activity.id] = 'schedule'; setActivityTab('schedule'); nav(`activity-${activity.id}`);
        }
      }}>일정에 반영</button>
      <button type="button" onClick={() => open('poll', { mode: 'list', id: pollApplication.pollId })}>투표로 돌아가기</button>
    </div>;
    if (modal && ['personal-route','visit-guide','decide','taste-map','taste-place','members','managers','group-introduction','place-detail','member-records','member-profile-edit','share-record','manage','places','upload','post','task','notice','temporary-manage','businesses','poll','poll-apply','games','challenges','resources','room-tasks','notice-view','join-settings','edit-group','applications','review-application','itinerary','edit-activity','ai','assistant','planning','remove-member','restore-member'].includes(modal) && (!group || !member)) return denied();
    if (modal === 'temporary-manage') {
      if (!group?.temporaryRoom || !activity || group.ownerId !== uid && !group.managerIds.includes(uid)) return denied();
      const trash = form.disposition === 'TRASH' && group.ownerId === uid;
      const reviewedRevision = Number(form.expectedRevision);
      return <div className="temporary-room-close">
        <p><strong>{activity.title}</strong><br/>{group.archived ? '종료한 모임의 기록을 어떻게 둘까요?' : '대화와 새 참여를 마치고, 기록을 어떻게 둘까요?'}</p>
        <label><input type="radio" name="temporary-disposition" checked={!trash} onChange={() => set('disposition', 'ARCHIVE')}/><span><strong>기록 보관</strong><small>참석자가 장소·대화·동선을 다시 보고, 다녀온 업체의 후기를 남길 수 있어요. 새 대화와 초대는 종료돼요.</small></span></label>
        {group.ownerId === uid && <label><input type="radio" name="temporary-disposition" checked={trash} onChange={() => set('disposition', 'TRASH')}/><span><strong>휴지통으로 이동</strong><small>다른 멤버에게는 보이지 않아요. 만든 사람은 내 일회성 모임의 휴지통에서 보관함으로 복원할 수 있어요.</small></span></label>}
        {group.ownerId !== uid && <small>휴지통 이동은 모임을 만든 사람만 선택할 수 있어요.</small>}
        {activity.revision !== reviewedRevision && <div className="tg-error" role="alert">일정이 변경됐어요. 창을 닫고 최신 내용을 확인한 뒤 다시 선택해 주세요.</div>}
        <button type="button" className="tg-primary" disabled={activity.revision !== reviewedRevision} onClick={() => {
          if (group.archived && !trash) { setModal(null); return; }
          if (mutate(draft => { closeTemporaryRoom(draft, uid, group.id, activity.id, reviewedRevision, trash ? 'TRASH' : 'ARCHIVE'); }, trash ? '종료한 모임을 휴지통으로 이동했어요. 만든 사람이 복원할 수 있어요.' : '모임을 종료하고 기록을 보관했어요.')) {
            setModal(null); if (trash) nav('together-oneoff');
          }
        }}>{group.archived ? trash ? '휴지통으로 이동' : '보관 유지' : trash ? '종료하고 휴지통으로' : '종료하고 보관'}</button>
        <button type="button" onClick={() => setModal(null)}>돌아가기</button>
      </div>;
    }
    if (modal === 'member-records' && group && member) return <MemberRecordsPanel key={`${uid}:${group.id}:${memberRecordScopeId || ''}:${form.memberId || uid}`} state={state} viewerId={uid} groupId={group.id} activityId={memberRecordScopeId} initialAuthorId={form.memberId || uid} onEditProfile={() => open('member-profile-edit', { recordActivityId: memberRecordScopeId || '' })} onOpenRecord={openDashboardRecord} initialTab={form.recordTab === 'journals' || form.recordTab === 'media' || form.recordTab === 'posts' || form.recordTab === 'comments' || form.recordTab === 'activities' ? form.recordTab : undefined} onScopeChange={(scopeId, authorId, tab) => open('member-records', { memberId: authorId, recordActivityId: scopeId, recordTab: tab })} onShare={() => open('share-record', { recordActivityId: memberRecordScopeId || '' })} onOpenComment={(authorId, postId, commentId) => openMemberRecord(authorId, memberRecordScopeId, { kind: 'COMMENT', postId, commentId })} onOpenActivity={(authorId, activityId) => openMemberRecord(authorId, memberRecordScopeId, { kind: 'ACTIVITY', activityId })} renderRecords={(authorId, tab) => tab === 'media' ? gallery(Boolean(memberRecordScopeId), authorId, memberRecordScopeId) : postList(Boolean(memberRecordScopeId), authorId, tab === 'journals' ? 'JOURNAL' : 'POST', memberRecordScopeId)}/>;
    if (modal === 'member-profile-edit' && group && member) return <MemberProfileEditor state={state} viewerId={uid} groupId={group.id} activityId={memberRecordScopeId} onCancel={() => open('member-records', { memberId: uid, recordActivityId: memberRecordScopeId || '' })} onSave={input => { const ok = mutate(draft => updateOwnMemberPresentation(draft, uid, group.id, input, memberRecordScopeId), '내 모임 프로필을 저장했어요.'); if (ok) open('member-records', { memberId: uid, recordActivityId: memberRecordScopeId || '' }); return ok; }}/>;
    if (modal === 'share-record' && group && member && !group.archived) return <MemberRecordSharePanel key={`${uid}:${group.id}:${memberRecordScopeId || ''}`} journeys={journeys} initialJourneyId={form.sourceJourneyId} sharedSourceIds={state.sharedJournals.filter(item => item.groupId === group.id && item.activityId === memberRecordScopeId && item.authorId === uid).map(item => item.sourceJourneyId || item.journey.sourceJourneyId || '')} scopeLabel={`${group.name}${memberRecordScopeId ? ` › ${memberRecordActivity?.title || '약속을 다시 확인해 주세요'}` : ' · 모임 전체'}`} onShare={source => { const ok = mutate(draft => { shareMemberJournal(draft, uid, group.id, source, memberRecordScopeId); }, '선택한 여행기를 이 공간에 공유했어요. 원본은 유지돼요.'); if (ok) open('member-records', { memberId: uid, recordActivityId: memberRecordScopeId || '' }); return ok; }} onPost={() => open('post', { category: memberRecordScopeId ? 'REVIEW' : 'FREE', recordReturn: 'yes', recordActivityId: memberRecordScopeId || '' })} onUpload={() => open('upload', { recordReturn: 'yes', recordActivityId: memberRecordScopeId || '' })} onBack={() => open('member-records', { memberId: uid, recordActivityId: memberRecordScopeId || '' })}/>;
    if (modal === 'edit-group' && group && manager) return <GroupCreationForm mode="EDIT" initial={{ name: group.name, kind: group.kind, region: group.region, district: discoveryProfile(group).district, topics: discoveryProfile(group).topics, subcategoryIds: discoveryProfile(group).subtopics, introduction: group.introduction, joinMode: discoveryProfile(group).joinMode, joinFields: group.joinFields }} onSubmit={input => { const ok = mutate(draft => { const target = draft.groups.find(item => item.id === group.id); if (!target || target.archived || !target.memberIds.includes(uid) || target.ownerId !== uid && !target.managerIds.includes(uid)) throw new Error('모임 정보를 수정할 수 없어요.'); Object.assign(target, { name: input.name, kind: input.kind, region: input.region, introduction: input.introduction, joinFields: input.joinFields, discovery: { ...discoveryProfile(target), topics: input.topics, subtopics: input.subcategoryIds, district: input.district, joinMode: input.joinMode, welcome: input.joinFields.welcome } }); }, '모임 정보를 저장했어요.'); if (ok) setModal(null); return ok; }}/>;
    if (modal === 'join-settings' && group && manager) return <GroupJoinSettingsForm initial={group.joinFields} onSave={fields => { const ok = mutate(draft => { const target = draft.groups.find(item => item.id === group.id); if (!target || target.archived || !target.memberIds.includes(uid) || target.ownerId !== uid && !target.managerIds.includes(uid)) throw new Error('모임 운영진만 가입 안내를 수정할 수 있어요.'); target.joinFields = fields; target.discovery = { ...discoveryProfile(target), welcome: fields.welcome }; }, '가입 안내를 저장했어요.'); if (ok) setModal(null); return ok; }}/>;
    if (modal === 'resources' && group && member) return <RoomResourcesPanel state={state} userId={uid} groupId={group.id} activityId={activity?.id} canCreate={canWriteRoom}
      onActivity={id => { if (!selectMemberRecords(repository.getSnapshot(), uid, group.id, uid, id)) return setToast('현재 모임의 약속을 다시 확인해 주세요.'); setModal(null); activityTabs.current[id] = 'schedule'; setActivityTab('schedule'); nav(`activity-${id}`); }} onParticipation={openParticipation} onNotice={id => open('notice-view', { id })} onTasks={() => open('room-tasks')} onMembers={() => open('members')}
      onRecord={(type, id) => { setModal(null); openDashboardRecord(type, id); }}
      onMemberRecords={id => { if (selectMemberRecords(repository.getSnapshot(), uid, group.id, id, activity?.id)) open('member-records', { memberId: id, recordActivityId: activity?.id || '' }); else setToast('현재 모임의 멤버를 다시 확인해 주세요.'); }}
      onBoard={() => { if (!selectMemberRecords(repository.getSnapshot(), uid, group.id, uid, activity?.id)) return setToast('현재 모임의 기록을 다시 확인해 주세요.'); setModal(null); setBoardCategory('ALL'); setRecordView('posts'); if (activity) changeActivityView('record'); else changeGroupView('board'); }}
      onCreateActivity={() => { if (canWriteRoom) beginCreation({ purpose: 'MEETUP' }, 'create-activity'); }} onCreatePoll={() => { if (canWriteRoom) open('poll'); }}/>;
    if (modal === 'notice-view' && group && member) { const notice = selectRoomResources(state, uid, group.id, activity?.id)?.notices.find(item => item.id === form.id); return notice ? <div className="tg-stack"><h3>{notice.title}</h3><p className="tg-preserve-lines">{notice.body}</p><button type="button" onClick={() => open('resources')}>자료 모아보기</button></div> : <p>이 방의 공지를 다시 확인해 주세요.</p>; }
    if (modal === 'room-tasks' && group && member) { const tasks = selectRoomResources(state, uid, group.id, activity?.id)?.tasks || []; return <div className="tg-stack"><p className="tg-muted">{activity?.title || group.name} · 이 방에 등록한 항목</p>{tasks.length ? tasks.map(task => <label key={task.id} className="tg-checkrow"><input type="checkbox" checked={task.completed} disabled={!readRoomTask(state, uid, roomId, task.id)?.canInteract} onChange={() => mutate(draft => { toggleRoomTask(draft, uid, roomId, task.id); })}/><span><strong>{task.title}</strong><small>{task.assigneeId ? memberName(state, task.assigneeId, group.id) : '공동 준비'}{task.dueDate ? ` · ${task.dueDate}까지` : ''}</small></span></label>) : <p>아직 준비할 일이 없어요.</p>}<button type="button" onClick={() => open('resources')}>자료 모아보기</button></div>; }
    if (modal === 'recent-groups') { const entries = selectRecentGroups(state, uid, recentStorage ? readRecentGroups(recentStorage, uid) : []); return <div className="tg-stack"><div className="tg-between"><small>최근에 열어본 모임 {entries.length}개</small><button type="button" className="tg-text-button" disabled={!entries.length} onClick={() => { if (recentStorage && clearRecentGroups(recentStorage, uid)) refreshRecentGroups(value => value + 1); else setError('최근 본 기록을 지우지 못했어요.'); }}>전체 지우기</button></div>{entries.length ? entries.map(({ group: item }) => <div className="tg-recent-group-row" key={item.id}><button type="button" onClick={() => { setModal(null); nav(`group-${item.id}`); }}><span>{item.cover ? <img src={item.cover} alt=""/> : <Users size={24}/>}</span><span><strong>{item.name}</strong><small>{[item.region, discoveryProfile(item).district].filter(Boolean).join(' · ')} · {item.memberIds.length}명</small></span><ChevronRight size={16}/></button><button type="button" className="tg-icon" aria-label={`${item.name} 최근 본 기록 삭제`} onClick={() => { if (recentStorage && clearRecentGroups(recentStorage, uid, item.id)) refreshRecentGroups(value => value + 1); else setError('최근 본 기록을 지우지 못했어요.'); }}><X size={16}/></button></div>) : <Empty title="최근 본 모임이 없어요">관심 있는 모임을 열어보면 여기서 다시 찾을 수 있어요.</Empty>}</div>; }
    if (modal === 'visit-guide' && group && activity && member) return <VisitGuidePanel key={`${uid}:${group.id}:${activity.id}`} state={state} userId={uid} groupId={group.id} activityId={activity.id} places={places}
      onSave={input => { const ok = mutate(draft => { saveVisitGuide(draft, uid, { groupId: group.id, activityId: activity.id }, input, places); }, '방문 안내를 이 약속에 저장했어요. 외부 링크는 발급하지 않았어요.'); if (ok && guidePublicStore) try { reconcileVisitGuidePublicStore(repository.getSnapshot(), places, guidePublicStore); } catch { setError('안내는 저장했지만 이전 링크 중단을 확인하지 못했어요. 다시 확인해 주세요.'); return false; } return ok; }}
      onPublish={preview => { if (!guidePublicStore) { setError('브라우저 저장소에 접근할 수 없어 링크를 발급할 수 없어요. 안내 입력은 유지해요.'); return false; } let token = ''; const ok = mutate(draft => { if (preview.actorId !== uid || preview.groupId !== group.id || preview.activityId !== activity.id) throw new Error('현재 약속의 공유 내용을 다시 확인해 주세요.'); token = publishVisitGuide(draft, uid, preview, places); }); if (!ok) return false; try { reconcileVisitGuidePublicStore(repository.getSnapshot(), places, guidePublicStore); if (!guidePublicStore.read(token)) throw new Error('현재 링크를 열 수 없어요.'); setToast('공유할 안내만 담은 로컬 링크를 발급했어요.'); return true; } catch { setError('안내 링크를 저장하지 못했어요. 현재 안내를 다시 확인해 재발급해 주세요.'); return false; } }}
      onRevoke={(guideId, revision) => { const ok = mutate(draft => { revokeVisitGuide(draft, uid, { groupId: group.id, activityId: activity.id }, guideId, revision); }); if (!ok) return false; try { if (!guidePublicStore) throw new Error(); reconcileVisitGuidePublicStore(repository.getSnapshot(), places, guidePublicStore); setToast('이 안내의 로컬 공유 링크를 중단했어요.'); return true; } catch { setError('안내 공유는 중단했지만 브라우저 링크 회수를 확인하지 못했어요. 저장소를 확인해 주세요.'); return false; } }}
      onOpenLink={token => { try { if (!guidePublicStore?.read(token)) throw new Error(); setModal(null); nav(`visit-guide-${token}`); } catch { setError('현재 안내 링크를 다시 확인해 주세요.'); } }}
      getLink={token => { try { if (guidePublicStore?.read(token)) return `${window.location.origin}${window.location.pathname}#visit-guide-${token}`; } catch { /* Never display a successful link before its limited cache is readable. */ } return undefined; }}/>
    if (modal === 'personal-route' && group && activity && member) return <PersonalRoutePanel key={`${uid}:${group.id}:${activity.id}`} state={state} userId={uid} groupId={group.id} activityId={activity.id} places={places}
      initialTab={form.tab === 'MEMBERS' || form.tab === 'CHANGES' ? form.tab : 'MY'}
      onSave={input => mutate(draft => { savePersonalRoute(draft, uid, { groupId: group.id, activityId: activity.id }, input, places); }, '내 참여 구간을 저장했어요. 참석 여부와 공동 동선은 유지해요.')}
      onWithdraw={input => mutate(draft => { removePersonalRoute(draft, uid, { groupId: group.id, activityId: activity.id }, input, places); }, '내 구간 선택을 해제했어요. 참석 여부는 유지해요.')}
      onAcknowledge={reviewed => mutate(draft => { if (reviewed.actorId !== uid || reviewed.groupId !== group.id || reviewed.activityId !== activity.id) throw new Error('이 약속의 변경 내용을 다시 확인해 주세요.'); acknowledgePersonalRoute(draft, uid, reviewed, places); }, '최신 동선의 변경 내용을 확인했어요.')}
      renderPlaceDetail={place => <ActivityPlaceDetail place={place} onSavePlace={onSavePlace}/>}
      onOpenSharedRoute={() => { setModal(null); changeActivityView('schedule'); window.requestAnimationFrame(() => sharedRouteSection.current?.scrollIntoView({ block: 'start' })); }}
      onOpenMember={memberId => { if (selectMemberRecords(repository.getSnapshot(), uid, group.id, memberId, activity.id)) open('member-records', { memberId, recordActivityId: activity.id }); }}/>
    if (modal === 'decide' && group && activity && member) return <TogetherDecisionPanel key={`${uid}:${group.id}:${activity.id}`} state={state} userId={uid} groupId={group.id} activityId={activity.id} places={places}
      onCreate={input => mutate(draft => { createMeetingDecision(draft, uid, { groupId: group.id, activityId: activity.id }, input, places); }, '장소·날짜 후보를 열었어요. 멤버들이 조건을 답할 수 있어요.')}
      onRespond={(id, input) => mutate(draft => { submitDecisionResponse(draft, uid, { groupId: group.id, activityId: activity.id }, id, input, places); }, '가능한 조건을 제출했어요. 참석 응답은 별도예요.')}
      onConfirm={preview => { const ok = mutate(draft => { if (preview.groupId !== group.id || preview.activityId !== activity.id || preview.actorId !== uid) throw new Error('현재 약속의 비교 결과를 다시 확인해 주세요.'); applyMeetingDecision(draft, uid, preview, places); }, '확인한 장소·날짜를 약속에 반영했어요. 방문 동선과 참석 선택은 유지해요.'); if (ok) setModal(null); return ok; }}/>
    if ((modal === 'taste-map' || modal === 'taste-place') && group && member) return <><div hidden={modal === 'taste-place'}><GroupTasteMap state={state} userId={uid} groupId={group.id} places={places}
      onOpenPlace={(place, activityId) => { setTastePlaceScope({ actorId: uid, groupId: group.id, activityId }); setPlaceDetail(place); open('taste-place'); }}
      onBrowse={() => open('businesses')} onOpenActivity={id => { setModal(null); nav(`activity-${id}`); }}/></div>{modal === 'taste-place' && placeDetail && tastePlaceScope?.actorId === uid && tastePlaceScope.groupId === group.id ? businessContent(placeDetail, true, tastePlaceScope, 'REVIEWS') : null}</>;
    if (modal === 'businesses' && group && member) return businessContent();
    if (modal === 'creation') return creationPanel();
    if (modal === 'planning' && group && member) return <div className="tg-stack">{activity && <button type="button" className="temporary-room-business-entry" onClick={() => open('decide')}><Users size={20}/><span><strong>장소·날짜 함께 결정하기</strong><small>가능한 후보와 조건을 모아 약속에 반영해요.</small></span><ChevronRight size={16}/></button>}<div className="tg-stack" hidden={Boolean(planningPicker)} style={{ display: planningPicker ? 'none' : undefined }}><div className="tg-assistant-destination"><MessageCircle size={18}/><div><strong>{activity?.title || group.name} · {activity ? '약속 대화' : '모임 전체 대화'}</strong><small>확인해서 올린 투표와 준비 항목이 이 대화에 남아요.</small></div></div>{!form.tool && <div className="tg-assistant-start"><div><h3>새 약속·여행 계획</h3><small>하고 싶은 일을 적고 초안을 확인해요.</small></div><button type="button" className="tg-primary" onClick={() => beginCreation({}, 'planning')}><Plus size={16}/>만들기</button></div>}<PlanningSupportPanel state={state} userId={uid} groupId={group.id} activityId={activity?.id} places={places} initialTool={form.tool === 'dates' || form.tool === 'departure' || form.tool === 'next' ? form.tool : 'places'}
      onAddPlaces={() => {
        const scope = { groupId: group.id, activityId: activity?.id };
        try {
          if (!getPlanningSupportContext(repository.getSnapshot(), uid, scope).canWrite) return setError('현재 장소를 제안할 수 있는 공간인지 다시 확인해 주세요.');
          setPlanningPicker({ actorId: uid, ...scope }); setError('');
        } catch (reason) { setError(reason instanceof Error ? reason.message : '장소를 제안할 공간을 다시 확인해 주세요.'); }
      }}
      onApply={publishAssistantAction}
      onPlan={initial => beginCreation({ purpose: activity && activityKind(activity) === 'TRIP' ? 'TRIP' : 'OUTING', ...initial }, 'planning')}
      onPoll={(question, options, expectedRevision, dates) => {
        let messageId: string | undefined;
        const ok = mutate(draft => {
          const id = createPlanningPoll(draft, uid, { id: togetherId('planning-poll'), groupId: group.id, activityId: activity?.id, expectedRevision, question, options, dates });
          messageId = draft.messages.find(item => item.entity?.type === 'POLL' && item.entity.id === id && item.roomId === roomId && !item.deleted)?.id;
        });
        if (ok) showChatResult(roomId, messageId);
        return ok;
      }}
      onFeedback={body => mutate(draft => { savePlanningFeedback(draft, uid, { id: togetherId('planning-review'), groupId: group.id, activityId: activity?.id, expectedRevision: activity?.revision, body }); }, '이 모임의 후기로 남겼어요.')}/><details className="tg-assistant-extra"><summary>시간 변경·관련 대화 등 추가 도구<ChevronDown size={16}/></summary><ActivityAssistant state={state} userId={uid} groupId={group.id} activityId={activity?.id} places={places} lockScope features={activity ? ['changes', 'conditions', 'first', 'plan-b', 'language'] : ['conditions', 'first', 'plan-b', 'language']} onApply={publishAssistantAction} onSource={(_roomId, messageId) => openTaskSource(messageId)}/></details></div>{planningPicker && planningPicker.actorId === uid && planningPicker.groupId === group.id && planningPicker.activityId === activity?.id && <PlanningPlacePicker state={state} userId={uid} groupId={planningPicker.groupId} activityId={planningPicker.activityId} places={places}
      onAdd={(placeId, expectedRevision) => mutate(draft => { addPlanningPlaceCandidate(draft, uid, planningPicker, placeId, expectedRevision, places); })}
      onDone={() => {
        try { if (!getPlanningSupportContext(repository.getSnapshot(), uid, planningPicker).canWrite) setError('현재 공간의 장소 제안 권한을 다시 확인해 주세요.'); }
        catch (reason) { setError(reason instanceof Error ? reason.message : '현재 공간의 장소 제안 권한을 다시 확인해 주세요.'); }
        finally { pendingPlanningReturn.current = true; setPlanningPicker(null); }
      }}/>}</div>;
    if (modal === 'assistant'  && group && member) return <ActivityAssistant state={state} userId={uid} groupId={group.id} activityId={activity?.id} places={places} lockScope features={activity ? ['changes', 'conditions', 'first', 'plan-b', 'language'] : ['conditions', 'first', 'plan-b', 'language']} onApply={publishAssistantAction} onSource={(_roomId, messageId) => openTaskSource(messageId)}/>;
    if (modal === 'apply' && group && viewer && !member) {
      const direct = form.joinMode === 'DIRECT';
      return <GroupJoinForm group={group} accountName={viewer.name} joinMode={direct ? 'DIRECT' : 'APPROVAL'} onSubmit={input => {
        const intent = form.intentActivityId ? { groupId: form.intentGroupId, activityId: form.intentActivityId, date: form.intentDate } : undefined;
        let joinedNow = false;
        const ok = mutate(draft => {
          joinedNow = joinGroupWithProfile(draft, group.id, uid, input, form.joinVersion || '', intent);
        }, direct ? '모임에 가입했어요. 약속 참가는 따로 선택해 주세요.' : '이 기기에 가입 신청을 저장했어요. 운영진에게 전송하는 기능은 아직 연결 전이에요.');
        if (ok) {
          if (direct) {
            if (joinedNow) setDirectJoinEntry({ accountId: uid, groupId: group.id, token: togetherId('join-welcome') });
            pendingJoinNavigation.current?.();
            const selected = intent && resolvePublicActivityIntent(repository.getSnapshot(), intent, uid);
            const destination = selected?.canOpen ? `activity-${selected.activity.id}` : `group-${group.id}`;
            pendingJoinNavigation.current = navigateAfterPublicJoin(window, route, destination, () => {
              pendingJoinNavigation.current = null;
              // A withdrawn selection or revoked membership must not revive a stale destination after closing.
              const latest = repository.getSnapshot(), target = latest.groups.find(item => item.id === group.id);
              if (!target?.memberIds.includes(uid) || target.blockedMemberIds?.includes(uid)) return;
              const current = intent && resolvePublicActivityIntent(latest, intent, uid);
              if (selected && !current?.canOpen) return;
              nav(destination);
            });
          }
          setModal(null);
        }
        return ok;
      }} context={form.intentActivityId && <div className="tg-summary"><span className="tg-tag coral">선택한 정모</span>{(() => { const selected = resolvePublicActivityIntent(state, { groupId: form.intentGroupId, activityId: form.intentActivityId, date: form.intentDate }, uid); return selected ? <><strong>{selected.activity.title}</strong><small>{activityWhen(selected.activity)}</small><small>{direct ? '가입 후 이 정모로 이동해요.' : '승인 후 이 정모로 돌아갈 수 있어요.'} 참석 여부는 직접 선택해요.</small></> : <small>공개 안내가 바뀌었어요. 모임 소개를 다시 확인해 주세요.</small>; })()}</div>}/>;
    }
    if (modal === 'applications' && group && manager) {
      const processed = form.status === 'processed';
      const requests = state.applications.filter(item => item.groupId === group.id && (processed ? item.status !== 'PENDING' : item.status === 'PENDING')).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      return <div className="tg-stack"><div className="tg-segments"><button aria-pressed={!processed} onClick={() => set('status', '')}>승인 대기 {pendingApplications.length}</button><button aria-pressed={processed} onClick={() => set('status', 'processed')}>처리 완료</button></div><small>가입 인사와 모임 안내를 확인하고 승인해 주세요. 가입 승인은 개별 번개·정모 참석와 별개예요.</small>{requests.length ? requests.map(item => <button className="tg-application-row" key={item.id} onClick={() => open('review-application', { applicationId: item.id })}><span className="tg-avatar">{(item.joinProfile?.nickname || memberName(state, item.userId, group?.id)).slice(0, 1)}</span><span><strong>{item.joinProfile?.nickname || memberName(state, item.userId, group?.id)}</strong><small>{dateTimeLabel(item.createdAt)} · {item.status === 'PENDING' ? '승인 대기' : item.status === 'APPROVED' ? item.joinMode === 'DIRECT' ? '직접 가입 완료' : '가입 승인' : '신청 종료'}</small><p>{item.message || '가입 인사를 남기지 않았어요.'}</p></span><ChevronRight size={18} /></button>) : <Empty title={processed ? '아직 처리한 신청이 없어요' : '기다리는 가입 신청이 없어요'}>{processed ? '승인하거나 종료한 신청은 여기에 남아요.' : '새로운 신청이 오면 가입 인사를 확인할 수 있어요.'}</Empty>}</div>;
    }
    if (modal === 'review-application' && group && manager) {
      const request = state.applications.find(item => item.id === form.applicationId && item.groupId === group.id);
      if (!request) return <div className="tg-stack"><p>취소되거나 찾을 수 없는 신청이에요.</p><button onClick={() => open('applications')}>신청 목록으로</button></div>;
      return <div className="tg-stack"><button className="tg-text-button" onClick={() => open('applications')}><ArrowLeft size={16} />가입 신청 목록</button><div className="tg-member"><span className="tg-avatar">{(request.joinProfile?.nickname || memberName(state, request.userId, group?.id)).slice(0, 1)}</span><div><h2>{request.joinProfile?.nickname || memberName(state, request.userId, group?.id)}</h2><small>{dateTimeLabel(request.createdAt)} 신청</small></div></div><section className="tg-card tg-stack">{request.joinProfile ? <GroupProfileDetails profile={request.joinProfile} fields={request.joinQuestions ? { questions: request.joinQuestions, welcome: '', availableTimes: [] } : group.joinFields}/> : <><h3>가입 인사</h3><p>{request.message || '가입 인사를 남기지 않았어요.'}</p></>}</section><div className="tg-summary"><h3>{group.name}</h3><p>승인하면 이 모임의 전체 채팅·게시판·앨범과 번개·정모를 볼 수 있어요. 정모 참석는 자동으로 신청되지 않아요.</p></div>{request.status === 'PENDING' ? <div className="tg-row"><button className="tg-primary" aria-label={`${request.joinProfile?.nickname || memberName(state, request.userId, group?.id)}님 가입 승인`} onClick={() => { if (mutate(draft => { approveGroupWithProfile(draft, request.id, uid); }, `${request.joinProfile?.nickname || memberName(state, request.userId, group?.id)}님의 가입을 승인했어요.`)) open('applications', { status: 'processed' }); }}>가입 승인</button><button onClick={() => { if (mutate(draft => { rejectGroupApplication(draft, request.id, uid); }, '가입 신청을 종료했어요.')) open('applications', { status: 'processed' }); }}>신청 거절</button></div> : <div className="tg-notice"><h3>{request.status === 'APPROVED' ? request.joinMode === 'DIRECT' ? '직접 가입 완료' : '가입 승인 완료' : '신청 종료'}</h3><small>{request.decidedAt ? dateTimeLabel(request.decidedAt) : ''}{request.decidedBy ? ` · ${memberName(state, request.decidedBy, group?.id)}` : ''}</small></div>}</div>;
    }
    if (modal === 'create-group') return <GroupCreationForm initial={{ name: form.name, kind: directoryKinds.includes(form.kind as GroupKind) ? form.kind as GroupKind : 'HOBBY', region: form.region, district: discoveryFilters?.district, categoryId: discoveryFilters?.topic, subcategoryIds: discoveryFilters?.subtopic && discoveryFilters.subtopic !== 'ALL' ? [discoveryFilters.subtopic] : undefined, introduction: form.introduction }} onSubmit={input => { if (!requireUser()) return false; let id = ''; const ok = mutate(draft => { id = createConfiguredGroup(draft, uid, input); }, '모임을 만들었어요.'); if (ok) { setModal(null); nav(`group-${id}`); } return ok; }}/>;
    if (modal === 'create-activity') return <form className="tg-form" onSubmit={saveActivity}><button type="button" className="tg-creation-entry" onClick={() => beginCreation({ purpose: form.activityKind === 'TRIP' ? 'TRIP' : 'MEETUP', date: form.date || '', endDate: form.endDate || '', startTime: form.startTime || '', prompt: form.title || '' }, 'create-activity')}><Sparkles size={18}/><span><strong>조건으로 갈 곳부터 고르기</strong><small>맛집·계절 나들이·여행 코스</small></span><ChevronRight size={17}/></button>{activityCoverEditor()}{field('title', '무엇을 함께할까요?', 'text', true)}<div className="tg-promotion-location">{field('date', '모임 날짜 · 나중에 정해도 돼요', 'date')}{field('startTime', '시작 시간 · 선택', 'time')}</div>{field('meetingPoint', '어디서 만날까요? · 선택')}{area('description', '함께할 내용·준비물')}<details><summary>참석 정원 · 선택</summary><label>최대 참석 인원<input type="number" min="1" max="500" step="1" placeholder="정원을 정하지 않아도 돼요" value={form.capacity || ''} onChange={event => set('capacity', event.target.value)} /></label></details><details><summary>여행·여러 날 일정 연결 · 선택</summary><label className="tg-check"><input type="checkbox" checked={form.activityKind === 'TRIP'} onChange={event => { set('activityKind', event.target.checked ? 'TRIP' : 'MEETUP'); if (!event.target.checked) { set('journeyId', ''); set('endDate', ''); } }} /><span>여행·원정 모임으로 만들기</span></label>{form.activityKind === 'TRIP' && <div className="tg-form">{field('endDate', '마지막 날짜 · 선택', 'date')}<label>내 여행 동선 가져오기<select value={form.journeyId || ''} onChange={event => { const item = journeys.find(value => value.id === event.target.value); set('journeyId', event.target.value); if (item) { set('title', item.title); set('date', item.startDate || (/^\d{4}-\d{2}-\d{2}$/.test(item.days[0]?.date || '') ? item.days[0].date : '')); set('endDate', /^\d{4}-\d{2}-\d{2}$/.test(item.days.at(-1)?.date || '') ? item.days.at(-1)!.date : ''); } }}><option value="">동선 없이 직접 만들기</option>{journeys.filter(item => item.purpose === 'PLAN' && isShareableJourney(item)).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><small>개인 원본은 유지하고 이 모임에서 사용할 사본을 만들어요.</small></div>}</details><button className="tg-primary" type="submit">번개·정모 만들기</button></form>;
    if ((modal === 'invite' || modal === 'share')) return <form className="tg-form" onSubmit={createInvite}><section className="tg-publish-context"><small>{sourceJourney ? '여행기에서 새 모임 초대' : activity ? '이 약속에 초대' : '이 모임에 초대'}</small><strong>{sourceJourney?.title || activity?.title || group?.name || form.name || '새 모임'}</strong><p>{sourceJourney ? '첫 수락 때 초대자가 모임장이 돼요. 개인 원본은 그대로 남아요.' : activity ? '초대를 수락해도 참가 상태는 따로 선택해요.' : '초대할 공간을 확인하고 초대장을 만들어요.'}</p></section>{activity && member && <button type="button" className="tg-inline-tool" onClick={() => open('visit-guide')}><MapPin size={17}/><span>가입 없이 보는 입구·주차 안내 만들기</span><ChevronRight size={16}/></button>}{field('name', group?.spaceType === 'ACTIVITY' ? '초대할 약속' : '모임 이름', 'text', true)}{sourceJourney && <><label>모임 종류<select value={form.kind || 'HOBBY'} onChange={event => set('kind', event.target.value)}>{Object.entries(kindNames).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><p>첫 수락 시 모임을 만들고 초대자가 모임장이 돼요. 내 여행 원본은 그대로 유지해요.</p></>}<small>초대 유효기간 7일. 현재는 이 기기에서 초대와 수락 흐름을 확인할 수 있어요. 카카오톡 전송·다른 기기 수락은 서버 연결 후 이용 가능해요.</small><button className="tg-primary" type="submit">초대 만들기</button></form>;
    if (modal === 'manage' && group && group.spaceType !== 'ACTIVITY') {
      const owner = group.ownerId === uid;
      const profile = discoveryProfile(group);
      const publicState = group.visibility === 'PUBLIC' && group.promotionPublished ? profile.recruitment === 'PAUSED' ? '공개 · 모집 쉬는 중' : '공개 · 모집 중' : '비공개';
      const confirmArchive = form.confirmAction === 'ARCHIVE' && manager;
      const confirmLeave = form.confirmAction === 'LEAVE' && !owner;
      if (confirmArchive || confirmLeave) return <div className="tg-manage-confirm">
        <div className="tg-manage-context"><strong>{group.name}</strong><small>{confirmArchive ? '모임 보관' : '모임 나가기'}</small></div>
        <h3>{confirmArchive ? '이 모임을 보관할까요?' : '이 모임에서 나갈까요?'}</h3>
        {confirmArchive ? <><p>기존 글·사진·일정은 남고, 새 대화와 활동 추가는 중단돼요.</p><p>진행 중인 내 모임 목록에서 제외되며 기존 기록은 계속 볼 수 있어요.</p></> : <><p>이 모임의 대화·게시판·앨범을 더 이상 볼 수 없어요. 다시 참여하려면 가입하거나 초대를 받아야 해요.</p><p>모임에 남긴 기록과 개인 여행 원본은 삭제되지 않아요.</p></>}
        <div className="tg-manage-confirm__actions"><button type="button" onClick={() => open('manage')}>모임 메뉴로</button><button type="button" className={confirmLeave ? 'tg-manage-confirm__leave' : 'tg-manage-confirm__primary'} onClick={() => {
          const ok = mutate(draft => {
            const target = draft.groups.find(item => item.id === group.id);
            if (!target || target.spaceType === 'ACTIVITY' || !draft.members.some(item => item.id === uid) || !isMember(draft, uid, target.id) || target.blockedMemberIds?.includes(uid)) throw new Error('현재 참여 중인 모임을 다시 확인해 주세요.');
            if (confirmArchive) {
              if (target.archived || target.ownerId !== uid && !target.managerIds.includes(uid)) throw new Error('현재 모임장과 운영진만 활동 중인 모임을 보관할 수 있어요.');
              target.archived = true;
            } else {
              if (target.ownerId === uid) throw new Error('모임장은 운영진 관리에서 모임장을 위임한 뒤 나갈 수 있어요.');
              target.memberIds = target.memberIds.filter(id => id !== uid);
              target.managerIds = target.managerIds.filter(id => id !== uid);
            }
          }, confirmArchive ? '모임을 보관했어요. 기존 기록은 볼 수 있어요.' : '모임에서 나왔어요. 개인 여행은 유지돼요.');
          if (ok) { setModal(null); if (confirmLeave) nav('together'); }
        }}>{confirmArchive ? '확인하고 모임 보관' : '확인하고 나가기'}</button></div>
      </div>;
      return <div className="tg-manage-menu">
        <div className="tg-manage-context"><strong>{group.name}</strong><small>{owner ? '모임장' : group.managerIds.includes(uid) ? '운영진' : '모임원'} · {group.archived ? '보관 중 · 읽기 전용' : '활동 중'}</small></div>
        <section><h3>함께 보기</h3><div className="tg-manage-nav">
          <button type="button" onClick={() => open('group-introduction')}><BookOpen size={18}/><span>모임 소개·안내</span><ChevronRight size={16}/></button>
          <button type="button" onClick={() => open('members')}><Users size={18}/><span>멤버 보기</span><ChevronRight size={16}/></button>
          <button type="button" onClick={() => open('places')}><MapPin size={18}/><span>모임 관심 장소</span><ChevronRight size={16}/></button>
        </div></section>
        {manager && <><section><h3>모임 운영</h3><div className="tg-manage-nav">
          <button type="button" onClick={() => open('applications')}><Users size={18}/><span>가입 신청 관리</span>{pendingApplications.length > 0 && <b aria-label={`승인 대기 ${pendingApplications.length}건`}>{pendingApplications.length}</b>}<ChevronRight size={16}/></button>
          <button type="button" onClick={() => open('invite', { name: group.name })}><Plus size={18}/><span>멤버 초대하기</span><ChevronRight size={16}/></button>
          <button type="button" onClick={() => open('notice')}><Bell size={18}/><span>전체 공지 작성</span><ChevronRight size={16}/></button>
        </div></section>
        <section><h3>모임 설정</h3><div className="tg-manage-nav">
          <button type="button" onClick={() => open('edit-group')}><span>기본 정보·가입 방식</span><ChevronRight size={16}/></button>
          <button type="button" onClick={() => open('join-settings')}><span>가입 질문·환영 안내</span><ChevronRight size={16}/></button>
          <button type="button" onClick={() => open('promotion', { introduction: group.introduction })}><span>공개 모집·홍보<small>{publicState}</small></span><ChevronRight size={16}/></button>
          {owner && <button type="button" onClick={() => open('managers')}><span>운영진·권한 관리<small>운영진 임명 · 모임장 위임</small></span><ChevronRight size={16}/></button>}
        </div></section></>}
        {(manager || !owner) && <details className="tg-manage-lifecycle"><summary>보관·나가기<ChevronDown size={16}/></summary><div>
          {manager && <button type="button" onClick={() => open('manage', { confirmAction: 'ARCHIVE' })}>모임 보관</button>}
          {!owner && <button type="button" className="tg-manage-lifecycle__leave" onClick={() => open('manage', { confirmAction: 'LEAVE' })}>모임 나가기</button>}
        </div></details>}
      </div>;
    }
    if (modal === 'group-introduction' && group && member) return <div className="tg-stack">{isDiscoverableGroup(group) ? <PublicGroupIntroduction state={state} groupId={group.id} viewerId={uid} mode="member"/> : <><h2>{group.name}</h2><p>{group.introduction || '모임 소개를 준비하고 있어요.'}</p><h3>새 멤버에게 전하는 인사</h3><p>{discoveryProfile(group).welcome || '함께해 주셔서 반가워요.'}</p><h3>모임 이용 안내</h3><p>{discoveryProfile(group).joinGuide || '모임 대화에서 인사하고 함께할 약속을 골라보세요.'}</p></>}<button type="button" onClick={() => open('members')}><Users size={17}/>멤버 {group.memberIds.filter(id => !group.blockedMemberIds?.includes(id)).length}명 보기</button></div>;
    if (modal === 'place-detail' && group && member && placeDetail) return businessContent(placeDetail, true);
    if (modal === 'managers' && group && member) return <GroupManagersPanel state={state} viewerId={uid} groupId={group.id} onChangeRole={(memberId, role) => mutate(draft => { changeGroupRole(draft, uid, group.id, memberId, role); }, role === 'OWNER' ? '모임장을 위임했어요.' : role === 'MANAGER' ? '운영진으로 임명했어요.' : '운영진 권한을 해제했어요.')}/>;
    if (modal === 'members' && group && member) return <div className="tg-stack"><GroupMembersPanel state={state} viewerId={uid} groupId={group.id} onViewRecords={memberId => open('member-records', { memberId, recordActivityId: activity?.id || '' })} onEditProfile={() => open('member-profile-edit', { recordActivityId: activity?.id || '' })} onAvatarChange={url => mutate(draft => { setOwnMemberAvatar(draft, uid, group.id, url, activity?.id); }, '내 프로필 사진을 변경했어요.')} onOpenManagers={() => open('managers')} onManageMember={memberId => open('remove-member', { memberId })} onOpenApplications={() => open('applications')}/>{manager && Boolean(group.blockedMemberIds?.length) && <><h3>가입 제한 중</h3>{group.blockedMemberIds!.map(id => <div className="tg-member" key={id}><div><strong>{memberName(state, id, group.id)}</strong><small>기존 초대로 다시 가입할 수 없어요.</small></div><button type="button" onClick={() => open('restore-member', { memberId: id })}>제한 해제</button></div>)}</>}</div>;
    if ((modal === 'remove-member' || modal === 'restore-member') && group && manager) return <div className="tg-stack"><h3>{memberName(state, form.memberId, group?.id)}</h3><p>{modal === 'remove-member' ? '이 모임에서 내보낼까요? 모임·일정·채팅 접근이 중단되고 기존 초대로 다시 가입할 수 없어요. 작성한 기록과 개인 여행 원본은 유지돼요.' : '가입 제한을 해제할까요? 해제해도 모임에 자동으로 가입되지 않아요. 이후 초대를 수락하거나 새 가입 신청을 해야 해요.'}</p><button className={modal === 'remove-member' ? 'tg-danger' : 'tg-primary'} onClick={() => { if (mutate(draft => { if (modal === 'remove-member') removeGroupMember(draft, group.id, uid, form.memberId); else restoreGroupMemberAccess(draft, group.id, uid, form.memberId); }, modal === 'remove-member' ? '모임에서 내보냈어요.' : '가입 제한을 해제했어요. 자동 가입되지는 않아요.')) open('members'); }}>{modal === 'remove-member' ? '내보내기 확인' : '가입 제한 해제 확인'}</button><button onClick={() => open('members')}>취소하고 멤버로</button></div>;
    if (modal === 'withdraw-shares') {
      const targets = state.sharedJournals.filter(item => item.authorId === uid && (form.all === 'yes' || withdrawIds.includes(item.id)));
      return <div className="tg-stack"><p>{form.all === 'yes' ? '모든 모임에 공유한 내 여행기를 해제할까요?' : '선택한 여행기의 모임 공유를 해제할까요?'} 개인 원본은 삭제하거나 변경하지 않아요.</p>{targets.map(item => <div className="tg-card" key={item.id}><small>{state.groups.find(value => value.id === item.groupId)?.name || '기존 모임'}</small><h3>{item.journey.title}</h3></div>)}<button className="tg-danger" disabled={!targets.length} onClick={() => { const ids = new Set(targets.map(item => item.id)); if (mutate(draft => { draft.sharedJournals = draft.sharedJournals.filter(item => item.authorId !== uid || !ids.has(item.id)); }, `${targets.length}개 공유를 해제했어요. 개인 원본은 유지돼요.`)) { setWithdrawIds([]); setModal(null); } }}>확인 · {targets.length}개 공유 해제</button><button onClick={() => setModal(null)}>취소</button></div>;
    }
    if (modal === 'promotion' && group && manager) {
      const chosenTopics = (form.topics || '').split(',').filter(Boolean);
      const parentTopics = topicOptions.filter(topic => chosenTopics.includes(topic.id)).map(topic => topic.id);
      const chosenSubtopics = normalizeGroupSubtopics(parentTopics, (form.subtopics || '').split(','));
      const covers = [...new Map(places.filter(place => !place.personal && place.image).map(place => [place.image, place])).values()].filter(place => place.area.includes(form.region || group.region)).slice(0, 12);
      return <form className="tg-form" onSubmit={event => submit(event, () => {
        if (!form.region?.trim()) return setError('모집할 지역을 적어 주세요.');
        if (!chosenTopics.length) return setError('어떤 관심사로 모일지 하나 이상 선택해 주세요.');
        if (!form.introduction?.trim()) return setError('가입 전에 볼 모임 소개를 적어 주세요.');
        if (form.confirmPublic !== 'yes') return setError('공개할 내용과 범위를 확인해 주세요.');
        if (mutate(draft => {
          const target = draft.groups.find(item => item.id === group.id)!;
          if (target.archived || !target.memberIds.includes(uid) || target.ownerId !== uid && !target.managerIds.includes(uid)) throw new Error('공개 모집을 변경할 권한이 없어요.');
          target.introduction = form.introduction.trim(); target.region = form.region.trim(); target.cover = form.cover ?? target.cover;
          target.discovery = { topics: parentTopics, subtopics: chosenSubtopics, district: form.district?.trim() || '', style: form.style === 'DESTINATION' ? 'DESTINATION' : 'NEIGHBORHOOD', recruitment: form.recruitment === 'PAUSED' ? 'PAUSED' : 'OPEN', joinMode: form.joinMode === 'DIRECT' ? 'DIRECT' : 'APPROVAL', welcome: form.welcome?.trim() || '', joinGuide: form.joinGuide?.trim() || '' };
          target.joinFields = { ...normalizeGroupJoinFields(target.joinFields), welcome: form.welcome?.trim() || '' };
          target.visibility = 'PUBLIC'; target.promotionPublished = true;
          target.promotionActivityIds = groupActivities.filter(item => selectedIds.includes(item.id) && item.status !== 'CANCELLED').map(item => item.id);
          target.promotionActivitySnapshots = groupActivities.filter(item => target.promotionActivityIds!.includes(item.id)).map(({ id, groupId, title, date, endDate, description, status, kind, startTime }) => ({ id, groupId, title, date, endDate, description, status, kind, startTime }));
        }, '공개 모집을 이 기기에 저장했어요. 홈과 모임 찾기에 반영돼요.')) setModal(null);
      })}>
        <section className="tg-promotion-preview tg-promotion-preview--compact" aria-label="공개 소개 미리보기"><h3>공개 소개 미리보기</h3><div className="tg-card tg-stack">{form.cover && <img className="tg-cover" src={form.cover} alt="모집 대표 사진" />}<span className="tg-tag coral">{form.recruitment === 'PAUSED' ? '모집 쉬는 중' : '새 멤버 모집 중'}</span><span className="tg-tag">{form.joinMode === 'DIRECT' ? '바로 가입' : '승인 후 가입'}</span><h2>{group.name}</h2><small>{[form.region, form.district].filter(Boolean).join(' · ')}</small><p>{form.welcome || form.introduction}</p><div className="tg-tags">{topicOptions.filter(topic => chosenTopics.includes(topic.id)).map(topic => <span className="tg-tag" key={topic.id}>{topic.emoji} {topic.label}</span>)}</div><small>공개할 일정 {groupActivities.filter(item => selectedIds.includes(item.id) && item.status !== 'CANCELLED').length}개 · 아래에서 공개 범위를 확인해요.</small></div></section>
        <details className="tg-promotion-edit"><summary>관심사·세부 분류 수정<ChevronDown size={16}/></summary><div className="tg-form">        <fieldset className="tg-promotion-topics"><legend>어떤 관심사로 만날까요?</legend><div className="tg-tags">{topicOptions.map(topic => <button key={topic.id} type="button" aria-pressed={chosenTopics.includes(topic.id)} className={`tg-topic-choice ${chosenTopics.includes(topic.id) ? 'selected' : ''}`} onClick={() => set('topics', chosenTopics.includes(topic.id) ? chosenTopics.filter(id => id !== topic.id).join(',') : [...chosenTopics, topic.id].join(','))}><span aria-hidden="true">{topic.emoji}</span> {topic.label}</button>)}</div></fieldset>
        {parentTopics.length > 0 && <fieldset className="tg-promotion-topics"><legend>세부 관심사 · 선택</legend><div className="tg-tags">{parentTopics.flatMap(id => groupSubtopicsFor(id)).map(item => <button type="button" key={item.id} className="tg-topic-choice" aria-pressed={chosenSubtopics.includes(item.id)} onClick={() => { if (!chosenSubtopics.includes(item.id) && chosenSubtopics.length >= Math.max(3, discoveryProfile(group).subtopics?.length || 0)) return setError('세부 관심사는 최대 3개 선택해 주세요. 기존에 선택한 항목은 유지할 수 있어요.'); set('subtopics', (chosenSubtopics.includes(item.id) ? chosenSubtopics.filter(id => id !== item.id) : [...chosenSubtopics, item.id]).join(',')); }}>{item.emoji} {item.label}</button>)}</div></fieldset>}
</div></details>
        <details><summary>여행·원정 모임 표시 · 선택</summary><label>활동 범위<select value={form.style || 'NEIGHBORHOOD'} onChange={event => set('style', event.target.value)}><option value="NEIGHBORHOOD">동네·취미 모임</option><option value="DESTINATION">여행·원정 모임</option></select></label></details>
        <details className="tg-promotion-edit"><summary>지역·소개·가입 안내 수정<ChevronDown size={16}/></summary><div className="tg-form">        <div className="tg-promotion-location">{field('region', '지역', 'text', true)}{field('district', '동네·권역 · 선택')}</div>
        {area('introduction', '가입 전에 볼 모임 소개')}{field('welcome', '처음 참여하는 분에게 한마디')}{area('joinGuide', '가입 조건·함께 지킬 약속')}
        <label>가입 방식<select aria-label="모임 가입 방식" value={form.joinMode || 'APPROVAL'} onChange={event => set('joinMode', event.target.value)}><option value="DIRECT">바로 가입 · 기본</option><option value="APPROVAL">운영진 승인 후 가입</option></select><small>가입 방식과 약속 참가 선택은 별개예요.</small></label><label>새 멤버 모집<select value={form.recruitment || 'OPEN'} onChange={event => set('recruitment', event.target.value)}><option value="OPEN">모집 중 · 새 멤버 받기</option><option value="PAUSED">모집 쉬기 · 소개만 공개</option></select></label>
</div></details>
        <details><summary>대표 사진 선택</summary><button type="button" aria-pressed={!form.cover} onClick={() => set('cover', '')}>사진 없이 공개</button><div className="tg-promotion-covers">{group.cover && <button type="button" aria-label="현재 대표 사진" aria-pressed={form.cover === group.cover} onClick={() => set('cover', group.cover)}><img src={group.cover} alt="현재 대표 사진" /></button>}{covers.filter(place => place.image !== group.cover).map(place => <button key={place.id} type="button" aria-label={`${place.name} 사진 선택`} aria-pressed={form.cover === place.image} onClick={() => set('cover', place.image)}><img src={place.image} alt={place.name} /></button>)}</div>{form.cover && <PhotoCredit image={form.cover} />}</details>
        <section className="tg-stack"><h3>소개에 공개할 일정</h3><small>선택한 일정의 제목·날짜·소개만 공개해요. 채팅·참석자·집합 장소·개인 동선·앨범은 공개하지 않아요.</small>{groupActivities.filter(item => item.status !== 'CANCELLED').map(item => <label className="tg-check" key={item.id}><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelected(item.id)} /><span>{item.title}<small>{dateLabel(item.date)}</small></span></label>)}{!groupActivities.filter(item => item.status !== 'CANCELLED').length && <p>일정 없이도 모임 소개만 먼저 공개할 수 있어요.</p>}</section>

        <label className="tg-check"><input type="checkbox" checked={form.confirmPublic === 'yes'} onChange={event => set('confirmPublic', event.target.checked ? 'yes' : '')} /><span>모임 이름·소개·대표 사진과 선택한 일정 정보를 공개할게요.</span></label>
        <button className="tg-primary" type="submit">{group.promotionPublished ? '공개 모집 수정' : '공개 모집 시작'}</button>
        {group.promotionPublished && <details className="tg-promotion-edit"><summary>공개 소개 관리<ChevronDown size={16}/></summary><button type="button" onClick={() => { if (mutate(draft => { const target = draft.groups.find(item => item.id === group.id); if (!target || target.archived || !target.memberIds.includes(uid) || target.ownerId !== uid && !target.managerIds.includes(uid)) throw new Error('공개 소개를 변경할 권한을 다시 확인해 주세요.'); target.promotionPublished = false; }, '공개 소개를 내렸어요. 모임 내부 기록은 유지돼요.')) setModal(null); }}>공개 소개 내리기</button></details>}
      </form>;
    }
    if (modal === 'notice' && group && canApply) return <form className="tg-form" onSubmit={event => submit(event, () => { const id = togetherId('notice'); if (mutate(draft => { draft.notices.push({ id, groupId: group.id, activityId: activity?.id, title: form.title.trim(), body: form.body || '', createdAt: now() }); shareChatEntity(draft, uid, { type: 'NOTICE', id }); }, '공지를 등록했어요.')) open('notice-view', { id }); })}><section className="tg-publish-context"><small>공지가 표시될 공간</small><strong>{activity?.title || group.name}</strong><p>{activity ? '이 약속의 공지와 대화에서 확인해요. 모임 전체 공지에는 표시하지 않아요.' : '모임 홈과 전체 대화에서 함께 확인해요.'}</p></section>{field('title', '공지 제목', 'text', true)}{area('body', '공지 내용')}<small>등록하면 이 공간의 멤버에게 공지 내용을 보여줘요.</small><button className="tg-primary" type="submit">공지 등록하고 확인</button></form>;
    if (modal === 'post' && group && member) {
      const scopeId = form.recordReturn === 'yes' ? memberRecordScopeId : activity?.id;
      const endpoint = import.meta.env.VITE_CHAT_AI_ENDPOINT?.trim() || '';
      return <ReviewPostComposer key={`${uid}:${group.id}:${scopeId || 'group'}`} state={state} places={places} viewerId={uid} groupId={group.id} activityId={scopeId} initialCategory={form.category === 'REVIEW' || form.category === 'QUESTION' || form.category === 'NOTICE' ? form.category : 'FREE'} initialTitle={form.title} initialBody={form.body} onCancel={() => form.recordReturn === 'yes' ? open('member-records', { memberId: uid, recordTab: 'posts', recordActivityId: scopeId || '' }) : setModal(null)} onGenerateDraft={endpoint ? async (facts, signal) => {
        if (facts.scope.groupId !== group.id || facts.scope.activityId !== scopeId || JSON.stringify(facts) !== JSON.stringify(selectReviewDraftFacts(repository.getSnapshot(), uid, group.id, scopeId))) throw new Error('후기를 작성할 공간과 현재 기록을 다시 확인해 주세요.');
        const result = await generateScopedReviewDraft(endpoint, uid, facts, signal);
        if (signal.aborted || creationAccount.current !== uid || JSON.stringify(facts) !== JSON.stringify(selectReviewDraftFacts(repository.getSnapshot(), uid, group.id, scopeId))) throw new Error('기록이나 접근 권한이 바뀌었어요. 현재 내용을 다시 확인해 주세요.');
        return result;
      } : undefined} onSubmit={(input, experiences) => {
        const ok = mutate(draft => { commitReviewPostWithExperiences(draft, uid, group.id, input, experiences || [], places, scopeId); }, input.category === 'REVIEW' ? '후기와 선택한 장소 경험을 등록했어요.' : '글을 등록했어요.');
        if (ok) { if (form.recordReturn === 'yes') open('member-records', { memberId: uid, recordTab: 'posts', recordActivityId: scopeId || '' }); else { setRecordView('posts'); setModal(null); if (activity) changeActivityView('record'); else changeGroupView('board'); } }
        return ok;
      }}/>;
    }
    if (modal === 'task' && activity && !canWriteRoom) return <div className="tg-stack"><p>이 약속은 준비 목록을 읽기만 할 수 있어요. 지난·완료·취소·보관된 약속에는 새 항목을 만들 수 없어요.</p><button type="button" onClick={() => open('room-tasks')}>기존 준비 목록 보기</button></div>;
    if (modal === 'task' && activity && editor) return <form className="tg-form" onSubmit={event => submit(event, () => { if (mutate(draft => { if (!getPlanningSupportContext(draft, uid, { groupId: activity.groupId, activityId: activity.id }).canWrite || !canEditActivity(draft, uid, draft.activities.find(item => item.id === activity.id)!)) throw new Error('현재 편집 가능한 약속에서만 준비할 일을 추가할 수 있어요.'); const id = togetherId('task'); draft.tasks.push({ id, groupId: activity.groupId, activityId: activity.id, title: form.title.trim(), assigneeId: form.assigneeId || undefined, dueDate: form.dueDate || undefined, completed: false }); shareChatEntity(draft, uid, { type: 'TASK', id }); }, '준비할 일을 추가했어요.')) setModal(null); })}>{field('title', '준비물·할 일', 'text', true)}<label>담당자<select value={form.assigneeId || ''} onChange={event => set('assigneeId', event.target.value)}><option value="">공동 준비</option>{group?.memberIds.map(id => <option key={id} value={id}>{memberName(state, id, group?.id)}</option>)}</select></label>{field('dueDate', '기한 · 선택', 'date')}<button className="tg-primary" type="submit">준비 목록에 추가</button></form>;
    if (modal === 'poll' && group && member) {
      if (!canWriteRoom && form.mode !== 'list') return <div className="tg-stack"><p>이 약속은 기존 투표와 결과만 볼 수 있어요. 새 투표를 만들거나 수정할 수 없어요.</p><button type="button" onClick={() => open('poll', { mode: 'list' })}>기존 투표 보기</button></div>;
      const roomPolls = state.polls.filter(item => item.groupId === group.id && item.activityId === activity?.id).slice().reverse();
      const editing = form.editId ? roomPolls.find(item => item.id === form.editId) : undefined;
      const shownPolls = form.id ? roomPolls.filter(item => item.id === form.id) : roomPolls;
      if (form.editId && !editing) return <p role="alert">수정할 투표를 다시 확인해 주세요.</p>;
      if (!canWriteRoom && form.mode !== 'list' && !editing) return <div className="tg-stack"><p>종료·취소·보관된 공간에서는 기존 투표를 확인할 수 있어요.</p><button type="button" onClick={() => open('poll', { mode: 'list' })}>이 방의 투표 보기</button></div>;
      return <div className="tg-stack"><p className="tg-room-scope">{activity?.title || group.name} · {activity ? '약속 대화' : '모임 전체 대화'}</p>{form.mode === 'list' && !editing ? <><button type="button" className="tg-primary" disabled={!canWriteRoom} onClick={() => open('poll')}><Plus size={16}/>새 투표 만들기</button><div className="tg-participation-list">{form.id && <button type="button" onClick={() => open('poll', { mode: 'list' })}>이 방의 투표 전체 보기</button>}{shownPolls.length ? shownPolls.map(poll => <PollView key={poll.id} state={state} userId={uid} poll={poll} places={places} onVote={optionId => mutate(draft => { checkRoomItem(draft.polls.find(item => item.id === poll.id)); voteRoomPoll(draft, uid, poll.id, optionId); })} onClosePoll={() => closePoll(poll.id)} onConfirm={optionId => confirmPoll(poll.id, optionId)} onEdit={() => editPoll(poll.id)} onApplyToActivity={openPollApplication}/>) : <p>이 대화방의 투표가 없어요. 날짜나 장소, 함께 정할 주제를 올려보세요.</p>}</div></> : <PollComposer key={editing?.id || 'new'} initial={editing ? pollInputFrom(editing) : undefined} submitLabel={editing ? '변경 저장' : undefined} onCancel={() => open('poll', { mode: 'list' })} onCreate={input => {
        let messageId: string | undefined;
        const ok = mutate(draft => {
          if (editing) { checkRoomItem(draft.polls.find(item => item.id === editing.id)); editRoomPoll(draft, uid, editing.id, input, Number(form.revision)); }
          else { const poll = createRoomPoll(draft, uid, { groupId: group.id, activityId: activity?.id }, input); messageId = shareChatEntity(draft, uid, { type: 'POLL', id: poll.id }).id; }
        }, editing ? '투표 내용을 수정했어요.' : '이 대화방에 투표를 올렸어요.');
        if (ok) { if (editing) open('poll', { mode: 'list' }); else showChatResult(roomId, messageId); }
        return ok;
      }}/>}</div>;
    }
    if (modal === 'games' && group && member) return <><p className="tg-room-scope">{activity?.title || group.name} · {activity ? '약속 대화' : '모임 전체 대화'}</p><RoomGamesPanel state={state} userId={uid} groupId={group.id} activityId={activity?.id} initialId={form.id} onCreate={input => {
      let id = '';
      const ok = mutate(draft => { const game = createRoomGame(draft, uid, { groupId: group.id, activityId: activity?.id }, input); id = game.id; shareChatEntity(draft, uid, { type: 'GAME', id }); }, '놀이 결과를 이 대화방에 올렸어요.');
      return ok ? id : false;
    }} onRerun={previousId => {
      let id = '';
      const ok = mutate(draft => { checkRoomItem(draft.games?.find(item => item.id === previousId)); const game = rerunRoomGame(draft, uid, previousId); id = game.id; shareChatEntity(draft, uid, { type: 'GAME', id }); }, '이전 결과를 남기고 새 회차를 올렸어요.');
      return ok ? id : false;
    }}/></>;
    if (modal === 'challenges' && group && member) {
      const scope = { groupId: group.id, activityId: activity?.id };
      return <><p className="tg-room-scope">{activity?.title || group.name} · {activity ? '약속 대화' : '모임 전체 대화'}</p><ChallengesPanel state={state} userId={uid} {...scope} initialId={form.id}
        onCreate={input => mutate(draft => { const id = createRoomChallenge(draft, uid, scope, input); shareChatEntity(draft, uid, { type: 'CHALLENGE', id }); }, '챌린지를 이 대화방에 올렸어요. 참가는 직접 선택해요.')}
        onJoin={id => mutate(draft => { joinRoomChallenge(draft, uid, scope, id); })}
        onLeave={id => mutate(draft => { leaveRoomChallenge(draft, uid, scope, id); })}
        onCertify={(id, input) => mutate(draft => { certifyRoomChallenge(draft, uid, scope, id, input); }, '오늘의 인증을 저장했어요.')}
        onClose={id => mutate(draft => { closeRoomChallenge(draft, uid, scope, id); }, '챌린지를 종료했어요. 인증 기록은 계속 볼 수 있어요.')}
      /></>;
    }
    if (modal === 'places' && group && member) {
      if (form.mode === 'append' && activity) return <ActivityPlacesRoute state={state} userId={uid} groupId={group.id} activityId={activity.id} places={places} onSavePlace={onSavePlace} renderPlaceDetail={place => businessContent(place, true)} onAction={action => mutate(draft => { applyActivityPlaceAction(draft, uid, action, places); })}/>;
      const interestIds = group.interestPlaceIds || [];
      const catalogue = places.filter(place => !place.personal && `${place.name} ${place.area} ${place.address}`.includes(form.search || '') && (form.catalogue === 'yes' || interestIds.includes(place.id)));
      const shared = places.filter(place => !place.personal && interestIds.includes(place.id));
      return <div className="tg-stack">{shared.length > 0 && <Suspense fallback={<p>장소 지도를 불러오는 중…</p>}><TogetherInterestMap places={shared} onSelectPlace={openPlaceDetail}/></Suspense>}<div className="tg-row"><input aria-label="장소 검색" placeholder="장소·지역·주소 검색" value={form.search || ''} onChange={event => set('search', event.target.value)}/><button type="button" onClick={() => set('catalogue', form.catalogue === 'yes' ? '' : 'yes')}>{form.catalogue === 'yes' ? '담은 장소' : '장소 찾기'}</button></div><small>모임원이 함께 모으는 관심 장소예요. 개별 약속에서는 사용할 후보를 따로 선택해요.</small>{catalogue.slice(0, 30).map(place => <div className="tg-stack" key={place.id}><PlaceRow place={place} onSave={onSavePlace}/>{!group.archived && <button type="button" className={interestIds.includes(place.id) ? 'tg-soft' : ''} onClick={() => mutate(draft => { const target = draft.groups.find(item => item.id === group.id); if (!target || !isMember(draft, uid, group.id) || target.archived || target.blockedMemberIds?.includes(uid)) throw new Error('현재 모임원만 관심 장소를 변경할 수 있어요.'); target.interestPlaceIds = target.interestPlaceIds?.includes(place.id) ? target.interestPlaceIds.filter(id => id !== place.id) : [...(target.interestPlaceIds || []), place.id]; }, interestIds.includes(place.id) ? '모임 관심 장소에서 뺐어요.' : '모임 관심 장소에 담았어요.')}>{interestIds.includes(place.id) ? '모임 관심 장소에서 빼기' : '모임 관심 장소에 담기'}</button>}</div>)}{!catalogue.length && <Empty title="담은 장소가 없어요" action={<button type="button" onClick={() => set('catalogue', 'yes')}>장소 찾아 담기</button>}>맛집·카페·숙소도 명소 없이 모을 수 있어요.</Empty>}</div>;
    }
    if (modal === 'itinerary' && activity?.journey && editor) return <div className="tg-stack"><p>모임의 공동 동선만 수정해요. 원래 개인 여행은 바뀌지 않아요.</p>{activity.journey.days.map(day => <section className="tg-stack" key={day.dayId || day.day}><h3>DAY {day.day}</h3>{day.places.map((place, index) => <div className="tg-card tg-stack" key={place.visitId || place.id}><div className="tg-between"><div><small>{placeNames[place.kind]}</small><h3>{index + 1}. {place.name}</h3></div></div><div className="tg-row"><button disabled={index === 0 || !canDragPlanVisit(day, place.visitId || '')} onClick={() => moveVisit(day.day, index, -1)}>위로</button><button disabled={index === day.places.length - 1 || !canDragPlanVisit(day, place.visitId || '')} onClick={() => moveVisit(day.day, index, 1)}>아래로</button><button className="tg-danger" disabled={place.bookingFixed} onClick={() => { if (form.remove !== place.visitId) return set('remove', place.visitId || place.id); mutate(draft => { const target = draft.activities.find(item => item.id === activity.id)!; if (place.bookingFixed) throw new Error('고정한 예약은 먼저 확인해야 해요.'); target.journey = { ...removePlanVisit({ ...target.journey!, isMine: true }, place.visitId!, false), isMine: false }; target.revision += 1; }, '공동 동선에서 방문을 뺐어요. 관심 장소와 원본은 유지돼요.'); }}>{form.remove === (place.visitId || place.id) ? '빼기 확인 · 연결 업체 유지' : place.bookingFixed ? '예약 고정됨' : '빼기'}</button></div></div>)}</section>)}<button className="tg-primary" onClick={() => setModal(null)}>닫기</button></div>;
    if (modal === 'edit-activity' && activity) return editor ? <form className="tg-form" onSubmit={event => submit(event, () => { if (form.endDate && (!form.date || form.endDate < form.date)) return setError('종료 날짜를 확인해 주세요.'); if (form.startTime && !form.date) return setError('시간을 정하려면 날짜도 선택해 주세요.'); if (form.capacity && (!Number.isInteger(Number(form.capacity)) || Number(form.capacity) < Math.max(1, countGroupParticipants(state, activity.id)) || Number(form.capacity) > 500)) return setError('정원은 현재 참석 인원 이상, 500명 이하로 입력해 주세요.'); if (mutate(draft => { const target = assertCurrentActivityEditor(draft, uid, group!.id, activity.id, Number(form.expectedRevision)); if (form.capacity && countGroupParticipants(draft, target.id) > Number(form.capacity)) throw new Error('새로 참석한 멤버가 있어요. 정원을 다시 확인해 주세요.'); if (target.date !== (form.date || '') && target.journey?.days.some(day => day.places.some(place => place.bookingFixed))) throw new Error('예약 고정된 방문이 있어 날짜를 바꿀 수 없어요. 예약과 고정 상태를 먼저 확인해 주세요.'); if (target.journey) target.journey = setPlanDates(target.journey, form.date || ''); if (form.cover && !isSafeTogetherImageUrl(form.cover)) throw new Error('대표 사진을 다시 선택해 주세요.'); if (target.meetingPoint !== (form.meetingPoint || '')) delete target.venuePlaceId; if (target.revision !== activity.revision) throw new Error('다른 사람이 먼저 수정했어요. 최신 내용을 다시 확인해 주세요.'); const oldPublic = [target.title, target.date, target.endDate, target.description, target.startTime || ''].join('\u0000'); Object.assign(target, { cover: form.cover || undefined, startTime: form.startTime || undefined, capacity: form.capacity ? Number(form.capacity) : undefined, title: form.title.trim(), date: form.date || '', endDate: target.journey && form.date ? target.journey.days.at(-1)!.date : form.endDate || '', meetingPoint: form.meetingPoint || '', description: form.description || '', editorIds: selectedIds.filter(id => group!.memberIds.includes(id)), revision: target.revision + 1 }); if (oldPublic !== [target.title, target.date, target.endDate, target.description, target.startTime || ''].join('\u0000')) { const parent = draft.groups.find(item => item.id === target.groupId)!; parent.promotionActivityIds = parent.promotionActivityIds?.filter(id => id !== target.id); parent.promotionActivitySnapshots = parent.promotionActivitySnapshots?.filter(item => item.id !== target.id); } }, group?.promotionActivityIds?.includes(activity.id) ? '수정했어요. 공개했던 내용은 모임 관리에서 다시 확인해 주세요.' : '모임 내용을 수정했어요.')) setModal(null); })}>{activityCoverEditor()}{field('title', '모임·활동 이름', 'text', true)}<div className="tg-promotion-location">{field('date', '모임 날짜', 'date')}{field('startTime', '시작 시간 · 선택', 'time')}</div>{activityKind(activity) === 'TRIP' && field('endDate', '마지막 날짜 · 선택', 'date')}{field('meetingPoint', '모임 장소')}{field('capacity', '최대 참석 인원 · 선택', 'number')}{area('description', '일정 소개')}{group?.promotionActivityIds?.includes(activity.id) && <small>제목·날짜·시간·소개를 바꾸면 기존 공개 소개에서 이 일정이 내려가요. 모임 관리에서 내용을 확인하고 다시 공개할 수 있어요.</small>}<h3>함께 수정할 사람</h3><small>일정 담당자와 모임 운영진 외에 편집할 사람을 선택해요.</small>{group?.memberIds.filter(id => id !== activity.leadId).map(id => <label className="tg-check" key={id}><input type="checkbox" checked={selectedIds.includes(id)} onChange={() => toggleSelected(id)} />{memberName(state, id, group?.id)}</label>)}<button className="tg-primary" type="submit">변경 저장</button><details className="tg-activity-management-extra"><summary>일정 상태·다시 만들기<ChevronDown size={16}/></summary><div className="tg-stack">{activity.status === 'PLANNED' && <button type="button" onClick={() => { if (mutate(draft => { changeActivityLifecycle(draft, uid, group!.id, activity.id, Number(form.expectedRevision), 'COMPLETED'); }, '완료한 일정으로 표시했어요. 채팅과 기록은 유지돼요.')) setModal(null); }}>일정 완료로 표시</button>}{activity.status !== 'PLANNED' && <button type="button" onClick={() => { if (mutate(draft => { changeActivityLifecycle(draft, uid, group!.id, activity.id, Number(form.expectedRevision), 'PLANNED'); }, '진행 중 일정으로 되돌렸어요. 대화와 기록은 유지해요.')) setModal(null); }}>진행 중으로 되돌리기</button>}<button type="button" onClick={() => { let id = ''; if (mutate(draft => { const source = assertCurrentActivityEditor(draft, uid, group!.id, activity.id, Number(form.expectedRevision)); id = togetherId('activity'); draft.activities.push({ ...structuredClone(source), id, title: `${source.title} 다시 함께하기`, date: '', endDate: '', startTime: undefined, status: 'PLANNED', participants: {}, arrivedIds: [], leadId: uid, editorIds: [], revision: 1, journey: source.journey ? (() => { const copied = setPlanDates(copyJourneyForGroup(source.journey!, viewer!.name), ''); return { ...copied, days: copied.days.map(day => ({ ...day, places: day.places.map(place => ({ ...place, bookingFixed: undefined })) })) }; })() : undefined }); }, '날짜 미정의 새 일정으로 복사했어요.')) { setModal(null); nav(`activity-${id}`); } }}>같은 모임 다시 열기</button>{activity.status !== 'CANCELLED' && <button className="tg-danger" type="button" onClick={() => { if (form.confirmCancel !== 'yes') return set('confirmCancel', 'yes'); if (mutate(draft => { changeActivityLifecycle(draft, uid, group!.id, activity.id, Number(form.expectedRevision), 'CANCELLED'); }, '일정을 취소했어요. 기존 기록은 유지해요.')) setModal(null); }}>{form.confirmCancel === 'yes' ? '일정 취소 확인' : '일정 취소'}</button>}</div></details></form> : <div className="tg-stack"><p>동선과 일정 수정은 담당자가 할 수 있어요. 바꾸고 싶은 내용을 채팅으로 제안해 주세요.</p><button className="tg-primary" onClick={() => { setModal(null); nav(`activitychat-${activity.id}`); }}>이 모임 채팅에서 제안</button></div>;
    if (modal === 'upload' && group) return <div className="tg-form">{memberRecordDestination('사진·영상')}{field('caption', '사진·영상 설명 · 선택')}<input ref={uploadRef} type="file" accept="image/*,video/*" hidden onChange={async event => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 5 * 1024 * 1024) return setError('현재 기기 저장은 5MB 이하의 파일을 선택해 주세요.'); if (!/^(image|video)\//.test(file.type)) return setError('사진 또는 영상 파일을 선택해 주세요.'); const epoch = uploadEpoch.current; const reader = new FileReader(); activeReader.current = reader; reader.onload = () => { if (epoch !== uploadEpoch.current || typeof reader.result !== 'string') return; const url = reader.result; if (mutate(draft => { assertMemberRecordWriteAccess(draft, uid, group.id, form.recordReturn === 'yes' ? memberRecordScopeId : activity?.id); draft.media.push({ id: togetherId('media'), groupId: group.id, activityId: form.recordReturn === 'yes' ? memberRecordScopeId : activity?.id, authorId: uid, url, kind: file.type.startsWith('video/') ? 'VIDEO' : 'PHOTO', caption: form.caption || file.name, createdAt: now() }); }, '선택한 파일을 이 기기에 저장했어요.')) { if (form.recordReturn === 'yes') open('member-records', { memberId: uid, recordTab: 'media', recordActivityId: memberRecordScopeId || '' }); else setModal(null); } }; reader.onerror = () => { if (epoch === uploadEpoch.current) setError('파일을 읽지 못했어요.'); }; reader.readAsDataURL(file); }} /><button className="tg-primary" onClick={() => uploadRef.current?.click()}><ImagePlus size={18} />기기에서 선택</button><small>현재는 이 브라우저에 저장돼요. 다른 모임원과 파일을 공유하려면 서버 연결이 필요해요.</small></div>;
    if (modal === 'report') {
      const resolveTarget = (snapshot: TogetherState) => {
        const targetGroup = snapshot.groups.find(item => item.id === group?.id);
        if (!targetGroup || !snapshot.members.some(item => item.id === uid) || !targetGroup.memberIds.includes(uid) || targetGroup.blockedMemberIds?.includes(uid)) return undefined;
        const inScope = (item: { groupId: string; activityId?: string }) => item.groupId === targetGroup.id && (!activity || item.activityId === activity.id) && (!item.activityId || snapshot.activities.some(value => value.id === item.activityId && value.groupId === targetGroup.id));
        if (form.targetType === 'MESSAGE') { const message = snapshot.messages.find(item => item.id === form.targetId && item.roomId === roomId && !item.deleted); return message ? { label: '대화', authorId: message.authorId, text: message.body } : undefined; }
        if (form.targetType === 'POST') { const post = snapshot.posts.find(item => item.id === form.targetId && inScope(item)); return post ? { label: '게시글', authorId: post.authorId, text: post.title } : undefined; }
        if (form.targetType === 'MEDIA') { const media = snapshot.media.find(item => item.id === form.targetId && inScope(item)); return media ? { label: media.kind === 'VIDEO' ? '영상' : '사진', authorId: media.authorId, text: media.caption || '공유한 미디어' } : undefined; }
        if (form.targetType === 'COMMENT') { const comment = snapshot.posts.filter(inScope).flatMap(post => post.comments).find(item => item.id === form.targetId); return comment ? { label: '댓글', authorId: comment.authorId, text: comment.body } : undefined; }
        return undefined;
      };
      const target = resolveTarget(state);
      return <form className="tg-form" onSubmit={event => submit(event, () => { if (mutate(draft => { if (!resolveTarget(draft)) throw new Error('지금 신고할 수 있는 내용인지 다시 확인해 주세요.'); draft.reports ??= []; draft.reports.push({ id: togetherId('report'), targetType: form.targetType as 'MESSAGE' | 'POST' | 'COMMENT' | 'MEDIA', targetId: form.targetId, groupId: group?.id || '', reporterId: uid, reason: form.reason, createdAt: now() }); }, '신고 내용을 이 기기에 저장했어요. 운영자 전송은 서버 연결 후 가능해요.')) setModal(null); })}><section className="tg-publish-context"><small>{target ? `${target.label} 신고 · ${memberName(state, target.authorId, group?.id)}` : '신고 대상 확인 필요'}</small><strong>{target ? target.text.slice(0,180) || '선택한 내용' : '지금 이 내용을 확인할 수 없어요.'}</strong><p>{activity?.title || group?.name}</p></section><label>신고 사유<select value={form.reason || ''} required onChange={event => set('reason', event.target.value)}><option value="">사유 선택</option><option>욕설·괴롭힘</option><option>광고·도배</option><option>개인정보 노출</option><option>부적절한 사진·내용</option><option>기타</option></select></label><small>현재는 이 기기에 저장해요. 운영자 접수·처리와는 별개예요.</small><button className="tg-primary" type="submit" disabled={!target}>신고 내용 저장</button></form>;
    }
    if (modal === 'ai') {
      if (!group || !member) return denied();
      return <div className="tg-form">
        <div className="tg-ai-context"><small>선택한 채팅</small><strong>{group.name}{activity ? ` › ${activity.title}` : ' · 전체 채팅'}</strong></div>
        <ConversationSummary key={`${uid}:${roomId}`} state={state} userId={uid} groupId={group.id} roomId={roomId} unreadAfter={summaryUnreadAfter} onSource={jumpToMessage}/>
        <details className="tg-example-summary"><summary>AI 요약·준비 반영 예시</summary><div className="tg-form"><p className="tg-ai-status">AI 모델 연결 전 · 등록된 예시 원문으로 준비·공지 반영을 확인해요.</p>
        {!aiPreview ? <>
          <label>정리할 범위<select value={form.scope || 'unread'} onChange={event => set('scope', event.target.value)}><option value="unread">안 읽은 대화</option><option value="today">오늘</option><option value="date">기간 선택</option><option value="all">이 채팅 전체</option></select></label>
          {form.scope === 'date' && <>{field('from', '시작', 'date')}{field('to', '종료', 'date')}</>}
          <label>특정 사람<select value={form.person || 'all'} onChange={event => set('person', event.target.value)}><option value="all">모든 사람</option>{group.memberIds.map(id => <option key={id} value={id}>{memberName(state, id, group?.id)}</option>)}</select></label>
          <small>선택한 조건의 대화 {selectedMessages.length}개 · 현재 채팅 안에서만 확인해요.</small>
          <button className="tg-primary" onClick={() => { if (form.scope === 'date' && form.from && form.to && form.from > form.to) { setError('종료 날짜를 시작 날짜 이후로 선택해 주세요.'); return; } setError(''); setAiPreview(true); setSelectedIds([]); }}>예시 결과 확인</button>
          <small>요약 화면을 열어도 읽음 위치와 실제 일정은 바뀌지 않아요.</small>
        </> : <>
          <h3 className="tg-ai-results-title">결과 형식 예시</h3>
          {exampleResults.length ? exampleResults.map(result => <div className="tg-result" key={result.message.id}><h3>{result.category}</h3><label><input type="checkbox" checked={selectedIds.includes(result.message.id)} onChange={() => toggleSelected(result.message.id)} /><span>{result.text}</span></label><small>{memberName(state, result.message.authorId, group?.id)}의 예시 원문에 연결됨</small><button className="tg-text-button" onClick={() => jumpToMessage(result.message.id)}>원문 보기 <ArrowRight size={14} /></button>{result.message.id === 'family-chat-4' && editor && <button className="tg-text-button" onClick={() => open('poll', { title: '점심 식당 후보 고르기', options: '식당 A · 후보\n식당 B · 후보' })}>투표 초안 만들기</button>}</div>) : <div className="tg-ai-empty"><h3>{selectedMessages.length ? '이 조건에는 연결된 예시 결과가 없어요' : '선택한 조건에 맞는 대화가 없어요'}</h3><p>{messages.some(isExampleMessage) ? '범위나 사람을 바꾸면 이 채팅의 예시 원문을 확인할 수 있어요.' : '현재 채팅에 준비된 예시 원문이 없어요. 대화와 준비할 내용을 직접 확인해 보세요.'}</p><div className="tg-row"><button disabled={!messages.length} onClick={() => { setForm({ scope: 'all', person: 'all' }); setSelectedIds([]); }}>필터 초기화</button><button onClick={goToChat}>대화로 가기<ArrowRight size={15}/></button></div></div>}
          {exampleResults.length > 0 && (canApply ? <>
            {activity && <button className="tg-primary" disabled={!exampleResults.some(item => item.task && selectedIds.includes(item.message.id))} onClick={() => {
              let added = 0;
              if (mutate(draft => {
                const current = draft.activities.find(item => item.id === activity.id);
                if (!current || !canEditActivity(draft, uid, current)) throw new Error('이 일정의 준비 목록을 바꿀 권한이 없어요.');
                exampleResults.filter(item => item.task && selectedIds.includes(item.message.id)).forEach(result => {
                  const source = draft.messages.find(item => item.id === result.message.id && item.roomId === roomId && !item.deleted);
                  if (!source || source.body !== result.sourceBody) throw new Error('원문이 바뀌었어요. 대화를 다시 확인해 주세요.');
                  if (draft.tasks.some(item => item.activityId === activity.id && item.sourceMessageIds?.includes(result.message.id))) return;
                  draft.tasks.push({ id: togetherId('task'), groupId: activity.groupId, activityId: activity.id, title: result.task!, assigneeId: result.assignee, completed: false, sourceMessageIds: [result.message.id] }); added += 1;
                });
              })) { setToast(added ? `${added}개 항목을 준비 목록에 추가했어요.` : '이미 준비 목록에 있는 항목이에요.'); setModal(null); }
            }}>선택 항목 준비에 추가</button>}
            <button disabled={!selectedIds.length} onClick={() => open('notice', { title: '대화에서 확인한 안내', body: exampleResults.filter(item => selectedIds.includes(item.message.id)).map(item => `[${item.category}] ${item.text}`).join('\n') })}>선택 항목 공지로 편집</button>
          </> : <small>준비 목록·공지 반영은 일정 담당자 또는 모임 운영진이 할 수 있어요.</small>)}
          <button onClick={() => { setAiPreview(false); setError(''); }}>조건 다시 선택</button>
        </>}</div></details>
      </div>;
    }
    return <p>이 기능을 사용할 수 있는 권한이 없어요.</p>;
  };

  let screen: ReactNode;
  if (route.startsWith('visit-guide-')) screen = <VisitGuideLink token={route.slice('visit-guide-'.length)} onBack={() => onBack ? onBack('home') : nav('together')}/>;
  else if (/^together-plan(?:-trip)?$/.test(route)) screen = <><ScreenHeader title="계획 초안 만들기" variant="detail" leading={<button type="button" aria-label="계획 화면 나가기" onClick={() => onBack ? onBack('home') : nav('together')}><ArrowLeft size={20}/></button>}/><div className="tg-pad tg-stack">{creationPanel()}</div></>;
  else if (route === 'together-shares') screen = viewer ? sharesScreen() : denied();
  else if (route === 'together-calendar') screen = viewer ? calendarScreen() : denied();
  else if (route === 'together-tasks') screen = viewer ? tasksScreen() : denied();
  else if (route === 'together-invites') screen = viewer ? invitesScreen() : denied();
  else if (route.startsWith('together-share-')) screen = shareScreen();
  else if (route.startsWith('group-invite-')) screen = inviteScreen();
  else if (summaryRoute) screen = member ? (activity ? activityScreen() : groupScreen()) : denied();
  else if (inChat) screen = chatScreen();
  else if (route.startsWith('activity-')) screen = activityScreen();
  else if (route.startsWith('group-')) screen = groupScreen();
  else screen = mainScreen();
  return <div className="tg">{(error || repository.getError()) && !modal && <div className="tg-pad"><div className="tg-error" role="alert">{error || repository.getError()}</div></div>}{screen}{toast && <div className="tg-toast" role="status">{toast}</div>}{modal && (!['ai','assistant'].includes(modal) || member) && <BottomSheet title={modalTitle[modal]} onClose={() => setModal(null)}><div className="tg-sheet">{error && <div className="tg-error" role="alert" style={{ marginBottom: 16 }}>{error}</div>}{modalContent()}</div></BottomSheet>}</div>;
}
