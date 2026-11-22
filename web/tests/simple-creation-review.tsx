// DEV-only full TogetherApp creation flow. All identities and writes are page-local.
import { StrictMode, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Journey } from '../src/data';
import type { GroupDiscoveryFilters } from '../src/together/GroupDiscovery';
import type { TogetherState } from '../src/together/model';
import type { TogetherRepository } from '../src/together/repository';
import type { MyRegionsState } from '../src/discoveryRegionStore';
import type { EmptyPersonalTripRequest } from '../src/emptyPersonalTrip';

const people = {
  owner: { id: 'simple-review-owner', name: '하린 · 가상 모임장', avatar: '/media/groups/cafe-conversation-20261109.jpg' },
  member: { id: 'simple-review-member', name: '민서 · 가상 모임원', avatar: '/media/groups/neighborhood-bookclub-20261109.jpg' },
};
const groupIds = { family: 'test-simple', hobby: 'test-simple-hobby' };
const localityGroupIds = ['review-locality-juan', 'review-locality-yonghyeon', 'review-locality-busan'];
const localityActivityIds = localityGroupIds.map(id => `${id}-meeting`);
const destinations = [
  ['약속 만들기', 'together-plan'], ['여행 만들기', 'together-plan-trip'], ['모임 초안 만들기', 'together-plan-group'],
  ['내 모임 · 기본 모임 만들기', 'together'], ['가족 모임', `group-${groupIds.family}`],
  ['취미 모임', `group-${groupIds.hobby}`], ['저장한 개인 여행', 'review-personal-plans'],
] as const;
const screens: Record<string, string> = { appointment: 'together-plan', trip: 'together-plan-trip', group: 'together-plan-group', family: `group-${groupIds.family}`, hobby: `group-${groupIds.hobby}`, together: 'together' };

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; }, key: index => [...values.keys()][index] ?? null,
    getItem: key => values.get(String(key)) ?? null,
    setItem: (key, value) => { values.set(String(key), String(value)); },
    removeItem: key => { values.delete(String(key)); }, clear: () => { values.clear(); },
  };
}

type GeoReviewMode = 'unsupported' | 'success' | 'denied' | 'timeout' | 'pending' | 'abroad' | 'coarse' | 'inaccurate';
function installGeoReview(value: string | null) {
  const modes: GeoReviewMode[] = ['success','denied','timeout','pending','abroad','coarse','inaccurate'];
  const mode: GeoReviewMode = modes.includes(value as GeoReviewMode) ? value as GeoReviewMode : 'unsupported';
  const pending = new Set<() => void>();
  let requests = 0, reverseRequests = 0;
  const report = () => {
    document.body.dataset.qaGeoMode = mode; document.body.dataset.qaGeoRequests = String(requests);
    document.body.dataset.qaReverseRequests = String(reverseRequests); document.body.dataset.qaPendingGeo = String(pending.size);
  };
  const position = (): GeolocationPosition => ({ timestamp: Date.now(), coords: {
    latitude: mode === 'abroad' ? 35.68 : 37.46, longitude: mode === 'abroad' ? 139.76 : 126.68,
    accuracy: mode === 'inaccurate' ? 15000 : mode === 'coarse' ? 2000 : 25,
    altitude: null, altitudeAccuracy: null, heading: null, speed: null,
    toJSON: () => ({}),
  }, toJSON: () => ({}) });
  const fake = mode === 'unsupported' ? undefined : {
    getCurrentPosition: (success: PositionCallback, failure?: PositionErrorCallback | null) => {
      requests += 1; report();
      if (mode === 'pending') { pending.add(() => success(position())); report(); return; }
      queueMicrotask(() => {
        if (mode === 'denied' || mode === 'timeout') {
          failure?.({ code: mode === 'denied' ? 1 : 3, message: 'FICTIONAL_LOCATION_ERROR', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
        } else success(position());
      });
    },
    watchPosition: () => { throw new Error('이 검수에서는 위치 추적을 지원하지 않아요.'); }, clearWatch: () => {},
  };
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: fake });
  if (navigator.geolocation !== fake) throw new Error('실제 GPS와 분리하지 못해 검수를 시작하지 않았어요.');
  report();
  return { mode, completePending: () => { const tasks = [...pending]; pending.clear(); report(); tasks.forEach(task => task()); },
    reverse: () => {
      reverseRequests += 1; report();
      return mode === 'abroad'
        ? { lookupSource: 'reverseGeocoding', countryCode: 'JP', countryName: '日本', principalSubdivision: '東京都', city: '千代田区', locality: '丸の内', localityInfo: { administrative: [] } }
        : { lookupSource: 'reverseGeocoding', countryCode: 'KR', countryName: '대한민국', principalSubdivision: '인천광역시', principalSubdivisionCode: 'KR-28', city: '인천광역시', locality: '주안동', localityInfo: { administrative: [
          { name: '대한민국', adminLevel: 2 }, { name: '인천광역시', adminLevel: 4 }, { name: '미추홀구', adminLevel: 6 }, { name: '주안동', adminLevel: 8 },
        ] } };
    } };
}

function installIsolation(liveAi: boolean, geo: ReturnType<typeof installGeoReview>): Storage {
  const local = memoryStorage(), session = memoryStorage();
  Object.defineProperty(window, 'localStorage', { configurable: true, value: local });
  Object.defineProperty(window, 'sessionStorage', { configurable: true, value: session });
  Object.defineProperty(window, 'indexedDB', { configurable: true, value: undefined });
  Object.defineProperty(window, 'caches', { configurable: true, value: undefined });
  class PageChannel extends EventTarget {
    readonly name: string;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onmessageerror: ((event: MessageEvent) => void) | null = null;
    constructor(name: string) { super(); this.name = name; }
    postMessage(_message: unknown) { /* No communication with real app tabs. */ }
    close() { /* Page memory only. */ }
  }
  Object.defineProperty(window, 'BroadcastChannel', { configurable: true, value: PageChannel });
  if (window.localStorage !== local || window.sessionStorage !== session || window.indexedDB !== undefined || window.caches !== undefined
    || window.BroadcastChannel !== (PageChannel as unknown as typeof BroadcastChannel)) throw new Error('실제 저장소와 분리하지 못해 검수 앱을 시작하지 않았어요.');
  window.addEventListener('storage', event => event.stopImmediatePropagation(), true);
  const actualFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href);
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    // Every reverse-geocoding response is fictional. No provider receives even the fake coordinates.
    if (url.hostname.endsWith('bigdatacloud.net') || url.pathname.includes('reverse-geocode') || url.searchParams.has('latitude') && url.searchParams.has('longitude')) {
      return new Response(JSON.stringify(geo.reverse()), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    // Opt-in is intentionally limited to fictional planning requests and the public catalogue.
    if (liveAi && url.origin === location.origin && url.pathname === '/api/planning-ai' && method === 'POST') return actualFetch(input, init);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(method)) {
      return new Response(JSON.stringify({ error: 'MEMORY_REVIEW_API_BLOCKED' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    }
    return actualFetch(input, init);
  };
  document.body.dataset.qaStorage = 'memory-only';
  document.body.dataset.qaNetwork = liveAi ? 'planning-ai-post-only' : 'no-api-or-write';
  document.body.dataset.qaViewer = people.owner.id;
  document.body.dataset.qaRole = 'owner';
  return local;
}

function counts(state: TogetherState, plans: Journey[]) {
  const addedGroups = state.groups.filter(group => !Object.values(groupIds).includes(group.id) && !localityGroupIds.includes(group.id));
  return {
    groups: state.groups.length, addedGroups: addedGroups.length,
    activities: state.activities.filter(activity => !localityActivityIds.includes(activity.id)).length, personalPlans: plans.length,
    invites: state.invites.length, messages: state.messages.length,
    publicGroups: addedGroups.filter(group => group.visibility === 'PUBLIC' || group.promotionPublished).length,
    rsvps: state.activities.reduce((count, activity) => count + Object.keys(activity.participants).length, 0),
  };
}

async function boot() {
  if (!import.meta.env.DEV) { document.getElementById('root')!.textContent = '개발 환경에서만 확인할 수 있어요.'; return; }
  const params = new URLSearchParams(location.search), liveAi = params.get('liveAi') === '1', localityReview = params.get('locality') === '1';
  const geo = installGeoReview(params.get('geo'));
  const local = installIsolation(liveAi, geo);
  document.body.dataset.embed = params.get('embed') === '1' ? 'true' : 'false';
  const initialRole = params.get('role') === 'guest' ? 'guest' : 'owner';
  const initialRoute = location.hash.slice(1) || screens[params.get('screen') || 'appointment'] || screens.appointment;
  // Product modules must not observe the browser's real storage before isolation is installed.
  const [{ default: TogetherApp }, { createEmptyState }, { createTogetherRepository, togetherStorageKey, isTogetherState },
    { DISCOVERY_CATALOG_VERSION }, { placeCatalog }, { PersonalTrip }, { copyPersonalPlan }, { default: MyRegionSheet }, { readMyRegions, activeRegion }, { buildEmptyPersonalTrip }] = await Promise.all([
    import('../src/together/TogetherApp'), import('../src/together/model'), import('../src/together/repository'),
    import('../src/together/discoveryExamples'), import('../src/data'), import('../src/PersonalTrip'), import('../src/tripPlan'), import('../src/MyRegionSheet'), import('../src/discoveryRegionStore'), import('../src/emptyPersonalTrip'),
  ]);
  const state: TogetherState = createEmptyState(people.owner.id, people.owner.name);
  state.discoveryCatalogVersion = DISCOVERY_CATALOG_VERSION;
  state.exampleMemberAvatarVersion = 1;
  state.members = Object.values(people).map(person => ({ ...person }));
  const now = new Date().toISOString();
  state.groups.push({
    id: groupIds.family, name: '우리 가족 · 가상 검수', kind: 'FAMILY', region: '부산',
    introduction: '부산의 가족 약속과 여행을 만들어 보는 가상 모임이에요.', cover: people.member.avatar,
    visibility: 'PRIVATE', spaceType: 'GROUP', ownerId: people.owner.id,
    memberIds: Object.values(people).map(person => person.id), managerIds: [], archived: false,
    sourceKind: 'LOCAL', promotionPublished: false, interestPlaceIds: [], createdAt: now,
  }, {
    id: groupIds.hobby, name: '주말 취미 · 가상 검수', kind: 'HOBBY', region: '서울',
    introduction: '취미 모임에서도 최소 입력으로 약속을 시작할 수 있는지 확인해요.', cover: people.owner.avatar,
    visibility: 'PRIVATE', spaceType: 'GROUP', ownerId: people.owner.id,
    memberIds: Object.values(people).map(person => person.id), managerIds: [], archived: false,
    sourceKind: 'LOCAL', promotionPublished: false, interestPlaceIds: [], createdAt: now,
    discovery: { topics: ['CAFE', 'WALK'], subtopics: ['CAFE_COFFEE', 'WALK_PARK'], district: '성동구',
      style: 'NEIGHBORHOOD', recruitment: 'PAUSED', welcome: '', joinGuide: '', joinMode: 'DIRECT' },
  });
  if (localityReview) {
    const organizer = { id: 'locality-review-organizer', name: '수현 · 가상 운영자', avatar: people.owner.avatar };
    state.members.push(organizer);
    const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date(Date.now() + 2 * 86400000));
    const samples = [
      { id: localityGroupIds[0], name: '주안동 저녁 산책 · 가상', region: '인천', district: '미추홀구', neighborhood: '주안동' },
      { id: localityGroupIds[1], name: '용현동 커피 친구 · 가상', region: '인천', district: '미추홀구', neighborhood: '용현동' },
      { id: localityGroupIds[2], name: '부산 중앙동 산책 · 가상', region: '부산', district: '중구', neighborhood: '중앙동' },
    ];
    for (const sample of samples) {
      const activityId = `${sample.id}-meeting`;
      state.groups.push({ id: sample.id, name: sample.name, kind: 'HOBBY', region: sample.region,
        introduction: `${sample.region} ${sample.district} ${sample.neighborhood}에서 가까운 사람들과 만나는 가상 검수 모임이에요.`,
        cover: people.member.avatar, visibility: 'PUBLIC', spaceType: 'GROUP', ownerId: organizer.id,
        memberIds: [organizer.id], managerIds: [], archived: false, sourceKind: 'LOCAL', promotionPublished: true,
        promotionActivityIds: [activityId], interestPlaceIds: [], createdAt: now,
        discovery: { topics: ['SOCIAL', 'WALK', 'CAFE'], district: sample.district, neighborhood: sample.neighborhood,
          style: 'NEIGHBORHOOD', recruitment: 'OPEN', welcome: '같은 동네에서 편하게 만나요.', joinGuide: '실제 모집이 아닌 메모리 검수용 자료예요.', joinMode: 'DIRECT' },
      });
      state.activities.push({ id: activityId, groupId: sample.id, title: `${sample.neighborhood} 산책과 커피 · 가상`, date: day,
        endDate: '', startTime: '19:00', meetingPoint: '', description: '구·동 조건과 공개 약속 저장을 확인하는 가상 일정이에요.',
        status: 'PLANNED', kind: 'MEETUP', leadId: organizer.id, editorIds: [], participants: {}, arrivedIds: [], revision: 1 });
    }
    document.body.dataset.qaLocality = 'incheon-michuhol-juan-yonghyeon';
  }
  if (!isTogetherState(state)) throw new Error('가상 만들기 검수 자료의 형식을 확인하지 못했어요.');
  local.setItem(togetherStorageKey(people.owner.id), JSON.stringify(state));
  const sourceRepository = createTogetherRepository(people.owner.id, people.owner.name, placeCatalog, local, null);
  const failSave = { enabled: params.get('failSave') === '1', rejected: false };
  const repository: TogetherRepository = {
    ...sourceRepository,
    update(recipe) {
      if (failSave.enabled) { failSave.rejected = true; return false; }
      failSave.rejected = false;
      return sourceRepository.update(recipe);
    },
    getError: () => failSave.rejected ? '가상 저장 실패예요. 실제 저장소에는 접근하지 않았어요.' : sourceRepository.getError(),
  };
  await import('../src/styles.css'); await import('../src/theme.css'); await import('../src/product-ux-refinement.css');
  await import('../src/navigation-spacing.css'); await import('../src/consumer-density.css');
  history.replaceState(null, '', `${location.pathname}${location.search}#${initialRoute}`);

  function Review() {
    const [route, setRoute] = useState(initialRoute), [status, setStatus] = useState('');
    const [role, setRole] = useState<'owner' | 'guest'>(initialRole);
    const [myRegionsOpen, setMyRegionsOpen] = useState(false);
    const [myRegions, setMyRegions] = useState<MyRegionsState>(() => readMyRegions(local, initialRole === 'owner' ? people.owner.id : 'guest-device').state);
    const [shouldFailSave, setShouldFailSave] = useState(failSave.enabled);
    const [filters, setFilters] = useState<GroupDiscoveryFilters>(localityReview ? { region: '인천', district: '미추홀구' } : { region: '부산' });
    const [planScopes, setPlanScopes] = useState<Record<'owner' | 'guest', Journey[]>>({ owner: [], guest: [] });
    const plans = planScopes[role];
    const setPlans = (next: Journey[]) => setPlanScopes(current => ({ ...current, [role]: next }));
    const regionOwner = role === 'owner' ? people.owner.id : 'guest-device';
    const currentRegions = myRegions.owner === regionOwner ? myRegions : readMyRegions(local, regionOwner).state;
    const currentMyRegion = activeRegion(currentRegions);
    const myRegionLabel = currentMyRegion ? [currentMyRegion.region, currentMyRegion.district, currentMyRegion.neighborhood].filter(Boolean).join(' ') : '';
    const applyMyRegion = (next: MyRegionsState) => {
      if (next.owner !== regionOwner) return;
      const selected = activeRegion(next);
      setFilters(current => ({ ...current, region: selected?.region || '', district: selected?.district || '', neighborhood: selected?.neighborhood || '', useMyRegion: false }));
    };
    useEffect(() => { setMyRegionsOpen(false); }, [role]);
    const savedPlanScopes = useRef({ owner: new Map<string, Journey>(), guest: new Map<string, Journey>() });
    const savedPlans = { current: savedPlanScopes.current[role] };
    const snapshot = useSyncExternalStore(repository.subscribe, repository.getSnapshot, repository.getSnapshot);
    const tally = counts(snapshot, plans);
    useEffect(() => {
      document.body.dataset.qaRole = role;
      document.body.dataset.qaViewer = role === 'owner' ? people.owner.id : '';
    }, [role]);
    useEffect(() => {
      const changed = () => { setRoute(location.hash.slice(1) || screens.appointment); setStatus(''); };
      window.addEventListener('hashchange', changed); return () => window.removeEventListener('hashchange', changed);
    }, []);
    useEffect(() => {
      for (const [key, value] of Object.entries(tally)) document.body.dataset[`qa${key.charAt(0).toUpperCase()}${key.slice(1)}`] = String(value);
    }, [snapshot, plans]);
    const navigate = (next: string, nextFilters?: GroupDiscoveryFilters) => {
      if (nextFilters) setFilters(nextFilters);
      setRoute(next); if (location.hash !== `#${next}`) location.hash = next;
    };
    const savePlan = (journey: Journey): boolean => {
      if (failSave.enabled) { setStatus('가상 저장 실패예요. 입력과 초안이 유지되는지 확인해 주세요.'); return false; }
      const personal = savedPlans.current.get(journey.id) ?? copyPersonalPlan(journey, people.owner.name);
      savedPlans.current.set(journey.id, personal);
      setPlans([...savedPlans.current.values()]);
      setStatus(`개인 여행 ${savedPlans.current.size}개를 이 페이지 메모리에 저장했어요.`);
      navigate(`review-personal-plan-${personal.id}`);
      return true;
    };
    const startPlan = (request: EmptyPersonalTripRequest): boolean => {
      if (failSave.enabled) { setStatus('가상 저장 실패예요. 이름은 그대로 유지돼요.'); return false; }
      const trip = buildEmptyPersonalTrip(request, role === 'owner' ? people.owner.name : '게스트 여행자');
      if (!savedPlans.current.has(trip.id)) savedPlans.current.set(trip.id, trip);
      setPlans([...savedPlans.current.values()]);
      navigate(`review-personal-plan-${trip.id}`);
      return true;
    };
    const updatePlan = (next: Journey): boolean => {
      if (failSave.enabled || !next.isMine || next.visibility !== 'PRIVATE') return false;
      const entry = [...savedPlans.current.entries()].find(([, plan]) => plan.id === next.id);
      if (!entry) return false;
      savedPlans.current.set(entry[0], next); setPlans([...savedPlans.current.values()]); return true;
    };
    const changeRole = (next: 'guest' | 'owner') => {
      const url = new URL(location.href); url.searchParams.set('role', next);
      history.replaceState(null, '', url); setRole(next);
    };
    const login = () => { changeRole('owner'); setStatus('가상 계정으로 전환했어요. 로그인만으로 저장하지 않으며, 복원한 초안의 저장 버튼을 다시 눌러야 해요.'); };
    const personalRoute = route === 'review-personal-plans' || route.startsWith('review-personal-plan-');
    const openedPlan = route.startsWith('review-personal-plan-') ? plans.find(plan => plan.id === route.slice('review-personal-plan-'.length)) : undefined;
    return <><details className="simple-creation-toolbar"><summary>간단 만들기 검수 · 모임 +{tally.addedGroups} / 약속 {tally.activities} / 개인 여행 {tally.personalPlans}</summary>
      <p>가상 계정의 실제 만들기 화면이에요. 초안 생성·편집 중에는 아래 개수가 늘지 않아야 해요. 마지막 저장 후 선택한 대상만 하나 늘어나는지 확인해요.</p>
      <output aria-label="간단 만들기 저장 개수" data-testid="creation-counts">
        전체 모임 {tally.groups} · 새 공간 {tally.addedGroups} · 약속 {tally.activities} · 개인 여행 {tally.personalPlans}<br/>
        초대 {tally.invites} · 대화 카드 {tally.messages} · 새 공개 모임 {tally.publicGroups} · 참가 응답 {tally.rsvps}
      </output>
      <small>{localityReview ? '지역 검수 초기값: 비공개 모임 2개 + 공개 가상 모임 3개(주안동·용현동·부산 중앙동)와 가상 약속 3개. 위 추가 생성 카운터에서는 이 기본 자료를 제외해요.' : '초기값: 비공개 모임 2개 / 약속·개인 여행·초대·대화 0개. 단독 약속은 비공개 공간도 함께 생성해요. 새 약속의 참가 여부는 모두 미선택이어야 해요.'}</small>
      <label>검수 역할 <select aria-label="간단 만들기 검수 역할" value={role} onChange={event => changeRole(event.target.value === 'guest' ? 'guest' : 'owner')}><option value="owner">가상 모임장</option><option value="guest">비로그인</option></select></label>
      <label><input type="checkbox" checked={shouldFailSave} onChange={event => { failSave.enabled = event.target.checked; failSave.rejected = false; setShouldFailSave(event.target.checked); setStatus(event.target.checked ? '이후 저장을 실패로 처리해요. 초안은 그대로 확인할 수 있어요.' : '가상 저장 실패를 해제했어요. 같은 초안을 다시 저장할 수 있어요.'); }}/> 가상 저장 실패</label>
      <p>현재 위치 검수: {geo.mode} · 실제 GPS와 주소 변환 서버는 호출하지 않아요. 동의 전 요청 횟수는 본문 데이터의 qaGeoRequests·qaReverseRequests에서 확인해요.</p>{geo.mode === 'pending' && <button type="button" onClick={() => { geo.completePending(); setStatus('가상 대기 위치 응답을 완료했어요. 닫거나 수정한 초안은 바뀌지 않아야 해요.'); }}>대기 위치 응답 완료</button>}
      <nav aria-label="간단 만들기 검수 화면">{destinations.map(([label, target]) => <a key={target} href={`#${target}`} aria-current={route === target ? 'page' : undefined}>{label}</a>)}</nav>
      <small>{liveAi ? '직접 누른 AI 요청에 한해 같은 서버의 POST /api/planning-ai만 허용해요. 입력은 가상 내용으로만 작성해 주세요.' : '실제 AI·API·외부 쓰기 요청은 차단돼요. 일반 초안은 모델 없이 확인할 수 있어요.'} 새로고침하면 페이지 메모리는 초기화돼요.</small>
      {status && <p role="status">{status}</p>}
    </details><div className="simple-creation-app"><main className="app-shell detail-open"><section className="content">
      {openedPlan ? <PersonalTrip key={openedPlan.id} journey={openedPlan} catalog={placeCatalog} savedPlaces={[]}
        onBack={() => navigate('review-personal-plans')} onChange={updatePlan}
        onAddLandmark={() => setStatus('이 페이지 메모리의 일정에서만 장소를 선택해요.')}
        onSaveBusiness={() => { setStatus('실제 관심 장소 저장은 이 검수에서 하지 않아요.'); return false; }}
        onCopy={() => setStatus('이 검수에서는 추가 복사를 하지 않아요.')}
        onJournal={() => setStatus('이 검수에서는 여행기를 만들지 않아요.')}
        renderMap={places => <p className="plan-help">동선 {places.length}곳 · 이 검수는 작성 내용 보관을 확인하며 실제 지도는 표시하지 않아요.</p>}/>
      : personalRoute ? <section className="simple-creation-personal"><h1>저장한 개인 여행 · 검수</h1>
        <p>이 페이지 메모리에만 저장됐어요. 실제 내 여행에는 추가하지 않아요.</p>
        {plans.length ? plans.map(plan => <article key={plan.id}><h2>{plan.title}</h2><p>{plan.region} · {plan.days.length}일</p>{plan.days.map((day, index) => <p key={day.dayId ?? index}>DAY {index + 1} · {day.places.length}곳</p>)}<button type="button" onClick={() => navigate(`review-personal-plan-${plan.id}`)}>내 여행 열기</button></article>) : <p>아직 저장한 개인 여행이 없어요.</p>}
        <button type="button" onClick={() => navigate('together-plan-trip')}>여행 만들기로</button>
      </section> : <TogetherApp repository={repository} route={route} viewer={role === 'owner' ? people.owner : null} places={placeCatalog} journeys={plans}
        discoveryFilters={filters} onDiscoveryFiltersChange={setFilters} onNavigate={navigate} onBack={fallback => navigate(fallback)}
        myRegionLabel={myRegionLabel} onManageMyRegions={() => setMyRegionsOpen(true)} onUseMyRegion={() => applyMyRegion(currentRegions)}
        onLogin={login} onCreatePersonalPlan={savePlan} onStartPersonalPlan={startPlan}
        onOpenJourney={id => navigate(`review-personal-plan-${id}`)} onSavePlace={() => setStatus('실제 관심 장소 자료에는 저장하지 않아요.')}
        onCopyJourney={savePlan}/>}
    </section></main></div>{myRegionsOpen && <MyRegionSheet ownerId={regionOwner} submitLabel="이 동네로 모임 찾기" onClose={() => setMyRegionsOpen(false)} onSaved={next => { setMyRegions(next); applyMyRegion(next); navigate('together-find'); setStatus('내 지역을 이 검수 페이지의 메모리에만 저장했어요.'); }}/>}</>;
  }
  const root = (import.meta.hot?.data.simpleCreationReviewRoot as Root | undefined) ?? createRoot(document.getElementById('root')!);
  if (import.meta.hot) import.meta.hot.dispose(data => { data.simpleCreationReviewRoot = root; });
  root.render(<StrictMode><Review/></StrictMode>);
}

void boot().catch(error => { document.getElementById('root')!.textContent = error instanceof Error ? error.message : '간단 만들기 검수 화면을 열지 못했어요.'; });
