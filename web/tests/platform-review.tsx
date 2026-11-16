import { StrictMode, useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Journey } from '../src/data';
import type { PolicyBundle } from '../src/accountPolicies';
import type { SocialAccountAdapter, SocialAccountUser, SocialSession } from '../src/socialAccountService';
import { isPlatformReviewRole, readPlatformReviewRoleMessage, PLATFORM_REVIEW_PROTOCOL } from './platform-review-protocol';

const ownerId = 'spotlog-local-review-member';
const memberId = 'example-sibling';
const applicantId = 'review-applicant';
const ids = { group: 'family-busan', activity: 'family-next', past: 'family-past', publicGroup: 'membership-review-club', publicActivity: 'membership-review-coffee', plan: 'platform-review-plan', journal: 'platform-review-journal' };
type ReviewRole = 'owner' | 'member' | 'applicant' | 'guest';
const roles: Record<ReviewRole, SocialAccountUser | null> = {
  owner: { id: ownerId, displayName: '플랫폼 검수 모임장', email: 'owner@platform.example.invalid', provider: 'EMAIL' },
  member: { id: memberId, displayName: '지우', email: 'member@platform.example.invalid', provider: 'EMAIL' },
  applicant: { id: applicantId, displayName: '수아', email: 'applicant@platform.example.invalid', provider: 'EMAIL' },
  guest: null,
};
const routes: Record<string, string> = {
  'shared-route': `activity-${ids.activity}`, 'route-changes': `activity-${ids.activity}`, 'visit-guide': `activity-${ids.activity}`, 'guide-guest': `activity-${ids.activity}`,
  decision: `activity-${ids.activity}`, taste: `group-${ids.group}`,
  oneoff: 'together-oneoff', create: 'together-plan', travelcreate: 'together-plan-trip', home: 'home', travel: 'travel', appointments: 'appointments', together: 'together', records: 'records', profile: 'profile',
  saved: 'saved', directory: 'places-guide', activity: `activity-${ids.activity}`, undated: 'activity-family-undated', past: `activity-${ids.past}`,
  group: `group-${ids.group}`, groupchat: `groupchat-${ids.group}`, chat: `activitychat-${ids.activity}`,
  assistant: `activitychat-${ids.activity}`, find: 'together-find', groupcreate: 'together-find',
  public: `group-${ids.publicGroup}`, plan: `journey-${ids.plan}`, journal: `journey-${ids.journal}`,
};
const labels: Record<string, string> = {
  'shared-route': '내 참여 구간', 'route-changes': '일정 변경 확인', 'visit-guide': '방문 안내 작성', 'guide-guest': '가입 없는 방문 안내',
  decision: '함께 결정하기', taste: '우리 취향 지도',
  oneoff: '일회성 모임', create: 'AI 계획 만들기', travelcreate: '여행 초안 만들기', home: '발견', travel: '여행', appointments: '약속', together: '모임', records: '내 기록', profile: '프로필', saved: '저장 장소',
  directory: '장소 찾기', activity: '개별 약속', undated: '날짜 미정 약속', past: '지난 약속', group: '가족 모임', groupchat: '모임 전체 대화', chat: '약속 대화',
  assistant: '약속 도우미', find: '모임 찾기', groupcreate: '모임 만들기', public: '가입 신청·승인', plan: '개인 일정', journal: '개인 여행기',
};

/** The fixture roles share ONLY their fictional Together state, simulating one server in page memory. */
function memoryStorage(sharedTogether = false): Storage {
  const values = new Map<string, string>();
  const togetherAliases = new Set([ownerId, memberId, applicantId, 'guest'].map(id => `spotlog.together.local.v1:${encodeURIComponent(id)}`));
  const keyFor = (key: string) => sharedTogether && togetherAliases.has(String(key)) ? '__platform-review-shared-together__' : String(key);
  return {
    get length() { return values.size; },
    key: index => [...values.keys()][index] ?? null,
    getItem: key => values.get(keyFor(key)) ?? null,
    setItem: (key, value) => { values.set(keyFor(key), String(value)); },
    removeItem: key => { values.delete(keyFor(key)); },
    clear: () => { values.clear(); },
  };
}

function installIsolation() {
  const local = memoryStorage(true), session = memoryStorage();
  Object.defineProperty(window, 'localStorage', { configurable: true, value: local });
  Object.defineProperty(window, 'sessionStorage', { configurable: true, value: session });
  Object.defineProperty(window, 'indexedDB', { configurable: true, value: undefined });
  Object.defineProperty(window, 'caches', { configurable: true, value: undefined });
  class PageChannel extends EventTarget {
    readonly name: string;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onmessageerror: ((event: MessageEvent) => void) | null = null;
    constructor(name: string) { super(); this.name = name; }
    postMessage(_message: unknown) { /* No delivery to another tab. */ }
    close() { /* Page lifetime only. */ }
  }
  Object.defineProperty(window, 'BroadcastChannel', { configurable: true, value: PageChannel });
  if (window.localStorage !== local || window.sessionStorage !== session || window.indexedDB !== undefined || window.caches !== undefined || window.BroadcastChannel !== (PageChannel as unknown as typeof BroadcastChannel)) throw new Error('실제 저장소와 분리하지 못했어요. 검수 앱을 시작하지 않았어요.');
  window.addEventListener('storage', event => event.stopImmediatePropagation(), true);
  const actualFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href);
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (url.pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(method)) throw new Error('페이지 메모리 검수에서는 실제 API 요청·발송을 실행하지 않아요.');
    return actualFetch(input, init);
  };
  document.body.dataset.qaStorage = 'memory-only';
  document.body.dataset.qaNetwork = 'no-api-or-write';
  document.body.dataset.qaTogether = 'fictional-role-shared';
  return { local, session };
}

async function boot() {
  if (!import.meta.env.DEV) { document.getElementById('root')!.textContent = '개발 환경에서만 확인할 수 있어요.'; return; }
  const { local } = installIsolation();
  const params = new URLSearchParams(location.search);
  document.body.dataset.embed = params.get('embed') === '1' ? 'true' : 'false';
  const requestedRole = params.get('role');
  const initialRole: ReviewRole = params.get('mode') === 'guest' ? 'guest' : isPlatformReviewRole(requestedRole) ? requestedRole : 'owner';
  const requestedScreen = params.get('screen') || 'home';
  let route = routes[requestedScreen] || routes.home;
  const [{ placeCatalog }, { createLocalRepository }, { draftPolicies }, { createSeedState }, { togetherStorageKey, isTogetherState }, { installMoaChatExamples }, { createMembershipReviewState }, { interestStorageKey }] = await Promise.all([
    import('../src/data'), import('../src/localRepository'), import('../src/accountPolicies'), import('../src/together/seed'),
    import('../src/together/repository'), import('./moa-chat-examples'), import('./membershipReviewFixture'), import('../src/interestCollectionStore'),
  ]);
  const state = createSeedState(ownerId, roles.owner!.displayName, placeCatalog);
  installMoaChatExamples(state, ownerId);
  const membership = createMembershipReviewState(new Date(), { multiplePublicActivities: true });
  const publicGroup = membership.groups[0];
  publicGroup.ownerId = ownerId; publicGroup.memberIds = [ownerId, memberId];
  state.groups.push(publicGroup);
  for (const person of membership.members) if (!state.members.some(item => item.id === person.id)) state.members.push(person);
  state.activities.push(...membership.activities.map(item => ({ ...item, leadId: ownerId, participants: { [ownerId]: 'JOINED' as const, [memberId]: 'JOINED' as const } })));
  // The exact source dialogue and these shared IDs drive all eight real assistant panels.
  const activity = state.activities.find(item => item.id === ids.activity)!;
  activity.startTime = '10:30'; activity.kind = 'TRIP';
  const family = state.groups.find(item => item.id === ids.group)!;
  if (['shared-route', 'route-changes', 'visit-guide', 'guide-guest'].includes(requestedScreen)) {
    const [{ selectPersonalRoutes, savePersonalRoute }, { previewVisitGuide, publishVisitGuide, selectVisitGuide }, { createVisitGuidePublicStore, reconcileVisitGuidePublicStore }] = await Promise.all([
      import('../src/together/personalRoutes'), import('../src/together/visitGuides'), import('../src/together/visitGuideStorage'),
    ]);
    const nextDate = (offset: number) => new Date(Date.now() + offset * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
    activity.date = nextDate(3); activity.endDate = nextDate(3 + Math.max(1, activity.journey!.days.length) - 1);
    activity.journey!.days.forEach((day, index) => { day.date = nextDate(3 + index); day.places.forEach((place, placeIndex) => { place.time = ['10:30', '12:00', '15:00'][placeIndex] || '16:00'; }); });
    activity.participants[memberId] = 'MAYBE';
    const scope = { groupId: ids.group, activityId: ids.activity };
    const stops = selectPersonalRoutes(state, ownerId, scope, placeCatalog).route.stops;
    for (const [index, userId] of family.memberIds.entries()) {
      const current = selectPersonalRoutes(state, userId, scope, placeCatalog);
      savePersonalRoute(state, userId, scope, { startKey: stops[index ? 1 : 0].key, endKey: stops[index === 1 ? 1 : index > 1 ? stops.length - 1 : Math.min(2, stops.length - 1)].key, joinTime: index ? '12:00' : '10:30', expectedRevision: 0, routeVersion: current.route.version }, placeCatalog);
    }
    if (requestedScreen === 'route-changes') {
      activity.startTime = '11:00'; activity.journey!.days[0].places[1].time = '13:00'; activity.revision++;
    }
    if (requestedScreen === 'guide-guest') {
      const preview = previewVisitGuide(state, ownerId, scope, { title: '함께 만나는 날 안내', meetingText: '첫 방문 장소의 공개 입구에서 만나요. 검수용 안내입니다.', entry: '도착하면 입구 안내판을 먼저 확인해 주세요.', parking: '주차 가능 여부와 요금은 방문 전에 업체에 확인해 주세요.', preparations: '편한 신발, 개인 물, 예약 확인 메시지를 챙겨 주세요.', selectedStopKeys: selectVisitGuide(state, ownerId, scope, placeCatalog).sourceStops.filter(stop => stop.publicStop).map(stop => stop.key), expectedActivityRevision: activity.revision, expectedGuideRevision: 0, validityHours: 24 }, placeCatalog);
      const token = publishVisitGuide(state, ownerId, preview, placeCatalog);
      reconcileVisitGuidePublicStore(state, placeCatalog, createVisitGuidePublicStore(local));
      route = `visit-guide-${token}`;
    }
  }
  if (requestedScreen === 'decision' || requestedScreen === 'taste') {
    const [{ createMeetingDecision, submitDecisionResponse }, { upsertPlaceFeedback }] = await Promise.all([
      import('../src/together/meetingDecision'), import('../src/together/businessAssessments'),
    ]);
    const options = placeCatalog.filter(place => !place.personal && place.kind === 'FOOD' && place.area.startsWith('부산')).slice(0, 3);
    const nextDay = (offset: number) => new Date(Date.now() + offset * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
    activity.date = nextDay(3); activity.endDate = nextDay(3 + Math.max(1, activity.journey?.days.length || 1) - 1);
    const decisionId = createMeetingDecision(state, ownerId, { groupId: ids.group, activityId: ids.activity }, {
      title: '이번 식사는 어디서 만날까요?', candidates: options.map((place, index) => ({ placeId: place.id, referenceCostKrw: [30000, 20000, 40000][index] })),
      dateOptions: [{ id: 'review-friday', date: nextDay(3), time: '12:30' }, { id: 'review-saturday', date: nextDay(4), time: '12:30' }], expectedActivityRevision: activity.revision,
    }, placeCatalog);
    for (const member of family.memberIds.filter(id => id !== roles[initialRole]?.id)) {
      const revision = state.decisions!.find(item => item.id === decisionId)!.revision;
      submitDecisionResponse(state, member, { groupId: ids.group, activityId: ids.activity }, decisionId, {
        availablePlaceIds: options.slice(0, 2).map(place => place.id), preferredPlaceId: options[0].id,
        availableDateIds: ['review-friday'], budgetMaxKrw: 30000, originPlaceId: options[1].id, expectedRevision: revision,
      }, placeCatalog);
    }
    upsertPlaceFeedback(state, ownerId, { groupId: ids.group, activityId: ids.past, placeId: options[0].id }, {
      rating: 4, note: '기능 확인용 가상 후기입니다. 실제 방문 평가가 아닙니다.', recommended: true, purposes: ['FAMILY'], experienceTags: ['QUIET', 'RETURN_VISIT'],
    }, placeCatalog);
    upsertPlaceFeedback(state, memberId, { groupId: ids.group, placeId: options[1].id }, {
      rating: 5, note: '취향 지도 필터를 확인하기 위한 가상 기록입니다.', recommended: true, purposes: ['TEAM_DINNER'], experienceTags: ['PARKING', 'GROUP_FRIENDLY'],
    }, placeCatalog);
  }
  family.interestPlaceIds = [...new Set([...(family.interestPlaceIds ?? []), ...placeCatalog.filter(place => place.area.startsWith('부산') && ['CAFE', 'FOOD'].includes(place.kind)).slice(0, 4).map(place => place.id)])];
  if (params.get('long') === '1') {
    family.name = '가족과친구가함께사진과동선을공유하며준비하는우리의긴이름모임';
    family.memberPresentations = Object.fromEntries(family.memberIds.map(id => [id, { nickname: '아주긴닉네임과영문ABCDEFGHIJKLMNOPQRSTUVWXYZ123', introduction: '긴 이름과 소개를 사용해 좁은 화면을 검수합니다.' }]));
    activity.title = '가족과친구가함께하는긴이름의부산여행과맛집카페산책일정';
  }
  if (params.get('tools') === '1') {
    const { installParticipationExamples } = await import('./participation-review-fixture'); installParticipationExamples(state, ownerId);
    const { installGroupBenchmarkExamples } = await import('./group-benchmark-fixture'); installGroupBenchmarkExamples(state, ownerId, placeCatalog);
  }
  // Explicit visual states stay inside the existing page-memory fixture.
  const visualPhase = params.get('phase');
  if (visualPhase && ['today','past','upcoming','undated','cancelled','archived'].includes(visualPhase)) {
    const offset = visualPhase === 'past' ? -4 : visualPhase === 'upcoming' ? 3 : 0;
    const date = new Date(Date.now() + offset * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
    activity.date = visualPhase === 'undated' ? '' : date;
    activity.endDate = activity.date;
    if (activity.journey) {
      activity.journey.days.forEach((day,index) => { day.date = visualPhase === 'undated' ? '' : new Date(Date.now() + (offset + index) * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }); });
      activity.endDate = activity.date ? activity.journey.days.at(-1)?.date || activity.date : '';
    }
    activity.status = visualPhase === 'past' ? 'COMPLETED' : visualPhase === 'cancelled' ? 'CANCELLED' : 'PLANNED';
    if (visualPhase === 'archived') family.archived = true;
    if (visualPhase === 'past' || params.get('records') === '1') {
      const photos = placeCatalog.filter(place => place.area.startsWith('부산') && place.image).slice(0,3);
      photos.forEach((place,index) => state.media.push({id:`hierarchy-photo-${index}`,groupId:ids.group,activityId:ids.activity,authorId:index ? memberId : ownerId,kind:'PHOTO',url:place.image,caption:`검수용 공유 사진 · ${place.name}`,createdAt:new Date().toISOString()}));
    }
  }
  if (!isTogetherState(state)) throw new Error('검수 모임 자료의 형식을 확인하지 못했어요.');
  local.setItem(togetherStorageKey(ownerId), JSON.stringify(state));
  if (local.getItem(togetherStorageKey(memberId)) !== local.getItem(togetherStorageKey(ownerId))) throw new Error('검수 역할 자료를 분리된 페이지 안에서 연결하지 못했어요.');

  const sharedJourney = activity.journey;
  if (!sharedJourney) throw new Error('검수 개인 일정을 준비하지 못했어요.');
  const plan: Journey = { ...structuredClone(sharedJourney), id: ids.plan, isMine: true, visibility: 'PRIVATE', author: roles.owner!.displayName, title: '개인으로 준비하는 부산 1박 2일', purpose: 'PLAN', planStage: 'READY' };
  const journal: Journey = { ...structuredClone(plan), id: ids.journal, title: '지난 만남을 남긴 개인 여행기', purpose: 'JOURNAL', status: params.get('records') === '1' ? 'PUBLISHED' : 'PLANNING', summary: '공개하지 않은 페이지 메모리 기록.', story: '실제 고객 자료와 분리된 검수용 글.', planStage: undefined };
  const repository = createLocalRepository(local);
  const saved = (['LANDMARK', 'FOOD', 'CAFE', 'STAY'] as const).flatMap(kind => placeCatalog.filter(place => place.area.startsWith('부산') && place.kind === kind).slice(0, 2));
  if (!repository.setItems({ 'spotlog.web.saved.v3': JSON.stringify(saved.map(place => place.id)), 'spotlog.web.journeys.v4': JSON.stringify([plan, journal]), 'spotlog.web.profile.v1': JSON.stringify({ displayName: roles.owner!.displayName, bio: '페이지 메모리 검수' }) })) throw new Error(repository.getIssue() || '개인 검수 자료를 만들지 못했어요.');
  const timestamp = new Date().toISOString();
  for (const identity of [ownerId, memberId, applicantId, 'guest-device']) local.setItem(interestStorageKey(identity), JSON.stringify({ schemaVersion: 1, owner: identity, revision: 1, collections: [{ id: 'platform-review-busan-folder', title: '부산에서 다시 갈 곳', region: '부산', placeIds: saved.map(place => place.id), createdAt: timestamp, updatedAt: timestamp }] }));

  const { default: App } = await import('../src/App');
  await import('../src/styles.css'); await import('../src/theme.css'); await import('../src/product-ux-refinement.css');
  await import('../src/navigation-spacing.css'); await import('../src/consumer-density.css');
  const unavailable = async (): Promise<never> => { throw new Error('실제 가입·메일·외부 연동은 이 검수 화면에서 실행하지 않아요.'); };
  const makeAdapter = (role: ReviewRole): SocialAccountAdapter => {
    let session: SocialSession = roles[role] ? { state: 'SIGNED_IN', user: roles[role]! } : { state: 'GUEST' };
    return { configured: true, async session(signal) { signal.throwIfAborted(); return session; }, async policies(signal): Promise<PolicyBundle> { signal.throwIfAborted(); return structuredClone(draftPolicies); }, beginSignIn: unavailable, completeSignup: unavailable, signInEmail: unavailable, signUpEmail: unavailable, verifyEmail: unavailable, resendVerification: unavailable, resetPassword: unavailable, removeAccount: unavailable, async signOut(signal) { signal.throwIfAborted(); session = { state: 'GUEST' }; } };
  };
  history.replaceState(null, '', `${location.pathname}${location.search}#${route}`);
  function Review() {
    const [role, setRole] = useState<ReviewRole>(initialRole);
    const adapter = useMemo(() => makeAdapter(role), [role]);
    const changeRole = useCallback((value: unknown) => {
      if (!isPlatformReviewRole(value)) return;
      const target = new URL(location.href);
      target.searchParams.set('role', value); target.searchParams.set('mode', value === 'guest' ? 'guest' : 'member');
      target.hash = location.hash.slice(1) || route;
      history.replaceState(null, '', target);
      setRole(value);
    }, []);
    useEffect(() => {
      if (window.parent === window) return;
      const receive = (event: MessageEvent) => {
        const next = readPlatformReviewRoleMessage(event, location.origin, window.parent);
        if (next) changeRole(next);
      };
      window.addEventListener('message', receive);
      return () => window.removeEventListener('message', receive);
    }, [changeRole]);
    useEffect(() => {
      if (window.parent !== window) window.parent.postMessage({ protocol: PLATFORM_REVIEW_PROTOCOL, type: 'ROLE_CHANGED', role }, location.origin);
    }, [role]);
    useEffect(() => {
      document.body.dataset.qaRole = role;
      if (!['assistant', 'groupcreate'].includes(requestedScreen) || role === 'guest' || requestedScreen === 'assistant' && role === 'applicant') return;
      const appRoot = document.getElementById('platform-review-app');
      if (!appRoot?.isConnected) return;
      let opened = false, scheduled = false, cancelled = false;
      let firstFrame = 0, secondFrame = 0;
      const findTrigger = () => [...appRoot.querySelectorAll<HTMLButtonElement>(requestedScreen === 'groupcreate' ? '[aria-label="모임 만들기"]' : '.tg-room-assistant')]
        .find(button => button.getClientRects().length > 0);
      const open = () => {
        if (opened || scheduled || cancelled || !findTrigger()) return;
        // Wait for the host's route/membership passive effects; opening during its initial
        // DOM commit would be immediately closed by TogetherApp's route reset effect.
        scheduled = true;
        firstFrame = requestAnimationFrame(() => { secondFrame = requestAnimationFrame(() => {
          scheduled = false;
          if (cancelled) return;
          const target = findTrigger();
          if (target) { opened = true; observer.disconnect(); target.click(); if (requestedScreen === 'groupcreate') document.body.dataset.qaGroupCreate = 'opened-existing-action'; else document.body.dataset.qaAssistant = 'opened-existing-action'; }
        }); });
      };
      const observer = new MutationObserver(open);
      observer.observe(appRoot, { childList: true, subtree: true });
      open();
      const timeout = window.setTimeout(() => { observer.disconnect(); if (!opened) document.body.dataset.qaAssistant = 'open-from-activity'; }, 8000);
      return () => { cancelled = true; observer.disconnect(); cancelAnimationFrame(firstFrame); cancelAnimationFrame(secondFrame); window.clearTimeout(timeout); };
    }, [role]);
    return <><details className="platform-review-toolbar"><summary>플랫폼 검수 · 이 페이지 메모리만 사용</summary><p>실제 앱 화면. 고객·관리자·오프라인 저장소와 분리. 실제 인증·가입·메일·AI 연결·전송은 실행하지 않아요.</p><label>검수 역할<select aria-label="플랫폼 검수 역할" value={role} onChange={event => changeRole(event.target.value)}><option value="owner">모임장 · 가족·가입 승인 확인</option><option value="member">모임원 · 준비·대화·투표 확인</option><option value="applicant">가입 신청자 · 공개 소개 확인</option><option value="guest">비로그인 · 공개 발견 확인</option></select></label><nav aria-label="플랫폼 검수 시작 화면">{Object.entries(labels).map(([screen, label]) => { const target = new URL(location.href); target.searchParams.set('screen', screen); target.searchParams.set('role', role); target.searchParams.set('mode', role === 'guest' ? 'guest' : 'member'); target.hash = ''; return <a href={target.href} key={screen}>{label}</a>; })}</nav><small>역할을 바꾸면 가상 모임 자료만 이 페이지에서 이어져 신청→승인을 확인할 수 있어요. 링크로 새로 열면 초기 자료로 시작해요. 단독 화면은 embed=1 사용.</small></details><div className="platform-review-app" id="platform-review-app"><App key={role} accountAdapter={adapter}/></div></>;
  }
  const root = (import.meta.hot?.data.platformReviewRoot as Root | undefined) ?? createRoot(document.getElementById('root')!);
  if (import.meta.hot) import.meta.hot.dispose(data => { data.platformReviewRoot = root; });
  root.render(<StrictMode><Review/></StrictMode>);
}

void boot().catch(error => { document.getElementById('root')!.textContent = error instanceof Error ? error.message : '메모리 검수 화면을 열지 못했어요.'; });
