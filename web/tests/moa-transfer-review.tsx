// DEV-only, fictional TogetherApp fixture. Product modules load after storage isolation.
import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { GroupDiscoveryFilters } from '../src/together/GroupDiscovery';
import type { CalendarView } from '../src/together/calendarPlans';
import type { TogetherActivity, TogetherState } from '../src/together/model';

const ids = { group: 'test-moa', full: 'test-full', coffee: 'test-coffee', walk: 'test-walk' };
const people = {
  owner: { id: 'moa-review-owner', name: '하린 · 가상 모임장', avatar: '/media/groups/cafe-conversation-20261109.jpg' },
  member: { id: 'moa-review-member', name: '민서 · 가상 모임원', avatar: '/media/groups/neighborhood-bookclub-20261109.jpg' },
  other: { id: 'moa-review-other', name: '도윤 · 가상 참가자', avatar: '/media/groups/coastal-walking-20261109.jpg' },
};
type ReviewRole = 'owner' | 'member';
const destinations = [
  ['모임 찾기', 'together-find'], ['내 모임', 'together'], ['관심 약속·발견 조건', 'together-picks'], ['캘린더', 'together-calendar'],
  ['모임 홈', `group-${ids.group}`], ['정원·대기·반복', `activity-${ids.full}`],
  ['겹치는 첫 약속', `activity-${ids.coffee}`], ['겹치는 두 약속', `activity-${ids.walk}`],
  ['약속 대화', `activitychat-${ids.full}`], ['AI 요약·할 일', `activitysummary-${ids.full}`], ['모임 대화', `groupchat-${ids.group}`],
] as const;
const screens: Record<string, string> = { find: 'together-find', picks: 'together-picks', calendar: 'together-calendar', group: `group-${ids.group}`, activity: `activity-${ids.full}`, chat: `activitychat-${ids.full}`, summary: `activitysummary-${ids.full}` };

function memoryStorage(sharedTogether = false): Storage {
  const values = new Map<string, string>();
  const aliases = new Set(Object.values(people).map(person => `spotlog.together.local.v1:${encodeURIComponent(person.id)}`));
  const keyFor = (key: string) => sharedTogether && aliases.has(String(key)) ? '__moa-transfer-fictional-state__' : String(key);
  return {
    get length() { return values.size; }, key: index => [...values.keys()][index] ?? null,
    getItem: key => values.get(keyFor(key)) ?? null,
    setItem: (key, value) => { values.set(keyFor(key), String(value)); },
    removeItem: key => { values.delete(keyFor(key)); }, clear: () => { values.clear(); },
  };
}

function installIsolation(liveAi: boolean) {
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
    postMessage(_message: unknown) { /* This fixture never delivers to another tab. */ }
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
    // Explicit opt-in permits only the chat gateway, with only fictional text from this page.
    if (liveAi && url.origin === location.origin && url.pathname === '/api/chat-ai' && method === 'POST') return actualFetch(input, init);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(method)) {
      return new Response(JSON.stringify({ error: 'MEMORY_REVIEW_API_BLOCKED' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    }
    return actualFetch(input, init);
  };
  document.body.dataset.qaStorage = 'memory-only';
  document.body.dataset.qaNetwork = liveAi ? 'chat-ai-post-only' : 'no-api-or-write';
  document.body.dataset.qaTogether = 'fictional-role-shared';
  return local;
}

async function boot() {
  if (!import.meta.env.DEV) { document.getElementById('root')!.textContent = '개발 환경에서만 확인할 수 있어요.'; return; }
  const params = new URLSearchParams(location.search), liveAi = params.get('liveAi') === '1';
  const local = installIsolation(liveAi);
  document.body.dataset.embed = params.get('embed') === '1' ? 'true' : 'false';
  const initialRole: ReviewRole = params.get('role') === 'member' ? 'member' : 'owner';
  const initialRoute = location.hash.slice(1) || screens[params.get('screen') || 'find'] || screens.find;
  const [{ default: TogetherApp }, { createEmptyState, setGroupParticipation }, { createTogetherRepository, togetherStorageKey, isTogetherState },
    { DISCOVERY_CATALOG_VERSION }, { koreaDay, shiftDay }, { placeCatalog }, picks] = await Promise.all([
    import('../src/together/TogetherApp'), import('../src/together/model'), import('../src/together/repository'),
    import('../src/together/discoveryExamples'), import('../src/together/discovery'), import('../src/data'), import('../src/together/discoveryPicks'),
  ]);
  const state: TogetherState = createEmptyState(people.owner.id, people.owner.name);
  state.discoveryCatalogVersion = DISCOVERY_CATALOG_VERSION;
  state.exampleMemberAvatarVersion = 1;
  const today = koreaDay(new Date()), date = shiftDay(today, 3), now = Date.now();
  state.members = Object.values(people).map(person => ({ ...person }));
  const group = {
    id: ids.group, name: '성수의 작은 주말 · 가상 모임', kind: 'HOBBY' as const, region: '서울',
    introduction: '동네 카페와 산책길을 함께 발견해요. 이 검수 화면의 사람·대화·예약 이야기는 모두 가상 자료예요.',
    cover: people.owner.avatar, visibility: 'PUBLIC' as const, spaceType: 'GROUP' as const,
    ownerId: people.owner.id, memberIds: Object.values(people).map(person => person.id), managerIds: [], archived: false,
    sourceKind: 'LOCAL' as const, promotionPublished: true, promotionActivityIds: [ids.full, ids.coffee],
    promotionActivitySnapshots: [] as NonNullable<TogetherState['groups'][number]['promotionActivitySnapshots']>,
    discovery: { topics: ['CAFE' as const, 'WALK' as const], subtopics: ['CAFE_COFFEE', 'WALK_PARK'], district: '성동구', style: 'NEIGHBORHOOD' as const,
      recruitment: 'OPEN' as const, welcome: '커피 한 잔과 가벼운 산책을 좋아하는 분을 환영해요.', joinGuide: '가상 모임 안내를 확인하고 가입할 수 있어요. 약속 참가는 별도예요.', joinMode: 'DIRECT' as const },
    memberPresentations: Object.fromEntries(Object.values(people).map(person => [person.id, { nickname: person.name, avatar: person.avatar, introduction: '가상 검수 모임에 직접 남긴 소개예요.' }])),
    createdAt: new Date(now - 7 * 86400000).toISOString(),
  };
  state.groups.push(group);
  const makeActivity = (id: string, title: string, startTime: string, endTime: string, full = false): TogetherActivity => ({
    id, groupId: ids.group, title, date, endDate: date, startTime, endTime, kind: 'MEETUP',
    meetingPoint: '가상 카페 앞 안내판 · 실제 방문 장소 아님', description: '공개 일정과 내부 참가 상태를 구분해 확인하는 가상 약속이에요.',
    status: 'PLANNED', leadId: people.owner.id, editorIds: [], cover: full ? people.owner.avatar : people.other.avatar,
    participants: full ? { [people.other.id]: 'JOINED' } : { [people.owner.id]: 'JOINED', [people.member.id]: 'JOINED' },
    arrivedIds: [], revision: 1, capacity: full ? 1 : 6, waitlist: [],
  });
  const full = makeActivity(ids.full, '커피와 산책 준비 · 정원 1명', '10:30', '12:00', true);
  const coffee = makeActivity(ids.coffee, '골목 카페에서 만나요', '11:30', '13:00');
  const walk = makeActivity(ids.walk, '숲길에서 사진 산책', '12:30', '14:00');
  const publicSnapshot = ({ id, groupId, title, date, endDate, description, status, kind, startTime, endTime }: TogetherActivity) =>
    ({ id, groupId, title, date, endDate, description, status, kind, startTime, endTime });
  state.activities.push(full, coffee);
  group.promotionActivitySnapshots.push(publicSnapshot(full), publicSnapshot(coffee));
  // Each account gets its own explicit save and baseline; adding walk afterwards produces one new match.
  for (const person of [people.owner, people.member]) {
    picks.saveDiscoveryCondition(local, person.id, state, { name: '서울 성동구 · 낮의 커피 모임', region: '서울', district: '성동구', topic: 'CAFE', subtopic: 'CAFE_COFFEE', query: '', weekday: 'ALL', timeBand: 'AFTERNOON' });
    picks.toggleSavedPublicAppointment(local, person.id, state, { groupId: ids.group, activityId: ids.full }, true);
    picks.toggleSavedPublicAppointment(local, person.id, state, { groupId: ids.group, activityId: ids.coffee }, true);
  }
  state.activities.push(walk); group.promotionActivityIds.push(walk.id); group.promotionActivitySnapshots.push(publicSnapshot(walk));
  const dialogue = [
    [people.owner.id, `${date} 모임은 오전 10시에 만나서 커피를 마시고 산책할까요?`],
    [people.member.id, '준비물은 각자 물과 편한 신발을 챙기면 좋겠어요. 저는 우산도 가져갈게요.'],
    [people.other.id, '사진 찍을 때 쓸 작은 삼각대는 제가 가져갈게요.'],
    [people.owner.id, '시간을 바꿀게요. 오전 10시가 아니라 10시 30분에 모이는 것으로 정했어요.'],
    [people.member.id, '네, 변경된 10시 30분에 맞춰 갈게요. 만나는 곳은 가상 카페 앞 안내판 맞죠?'],
    [people.owner.id, '맞아요. 가상 카페 앞 안내판에서 만나요. 다만 카페 예약은 아직 확정되지 않았어요.'],
    [people.other.id, '예약은 누가 확인하나요? 담당자와 예약 가능 여부를 정해야 해요. 아직 제가 예약한 건 아니에요.'],
    [people.member.id, '예약 여부는 미정으로 남겨 주세요. 물·우산·편한 신발을 챙기고, 비가 오면 실내로 바꿀지는 더 이야기해요.'],
  ];
  for (const [index, [authorId, body]] of dialogue.entries()) state.messages.push({ id: `moa-review-message-${index + 1}`, roomId: `activity:${ids.full}`, authorId, body, createdAt: new Date(now - (10 - index) * 60000).toISOString() });
  const beforeDialogue = new Date(now - 11 * 60000).toISOString();
  state.readCursors[`activity:${ids.full}`] = beforeDialogue;
  state.messages.push({ id: 'moa-review-group-message', roomId: `group:${ids.group}`, authorId: people.owner.id,
    body: '공개 모임 안에서도 관심 약속 저장과 실제 참가 선택은 별개예요. 약속 대화에서 준비 사항을 확인해 주세요.', createdAt: beforeDialogue });
  state.notices.push({ id: 'moa-review-notice', groupId: ids.group, activityId: ids.full, title: '시간 변경과 준비 안내', body: '만남은 10시 30분이에요. 예약은 미정이며 실제 예약이나 발송을 하지 않는 가상 검수 자료예요.', createdAt: new Date(now - 60000).toISOString() });
  if (!isTogetherState(state)) throw new Error('가상 검수 자료의 형식을 확인하지 못했어요.');
  local.setItem(togetherStorageKey(people.owner.id), JSON.stringify(state));
  await import('../src/styles.css'); await import('../src/theme.css'); await import('../src/product-ux-refinement.css');
  await import('../src/navigation-spacing.css'); await import('../src/consumer-density.css');
  history.replaceState(null, '', `${location.pathname}${location.search}#${initialRoute}`);

  function Review() {
    const [role, setRole] = useState<ReviewRole>(initialRole), [route, setRoute] = useState(initialRoute), [status, setStatus] = useState('');
    const [filters, setFilters] = useState<GroupDiscoveryFilters>({ region: '서울', district: '성동구', view: 'MEETUPS' });
    const [calendar, setCalendar] = useState<CalendarView>({ month: date.slice(0, 7), date });
    const person = people[role];
    const repository = useMemo(() => createTogetherRepository(person.id, person.name, placeCatalog, local, null), [person.id]);
    useEffect(() => { document.body.dataset.qaRole = role; document.body.dataset.qaViewer = person.id; }, [role, person.id]);
    useEffect(() => {
      const changed = () => { setRoute(location.hash.slice(1) || 'together-find'); setStatus(''); };
      window.addEventListener('hashchange', changed); return () => window.removeEventListener('hashchange', changed);
    }, []);
    const navigate = (next: string, nextFilters?: GroupDiscoveryFilters) => {
      if (nextFilters) setFilters(nextFilters);
      setRoute(next); if (location.hash !== `#${next}`) location.hash = next;
    };
    const changeRole = (next: ReviewRole) => {
      const url = new URL(location.href); url.searchParams.set('role', next); history.replaceState(null, '', url); setRole(next); setStatus('');
    };
    return <><details className="moa-transfer-toolbar"><summary>MOA 기능 검수 · 페이지 메모리만 사용</summary>
      <p>실제 앱 화면을 가상 모임으로 확인해요. 새로고침하면 초기화되고, 실제 계정 자료·가입·예약·알림은 건드리지 않아요.</p>
      <small>{liveAi ? 'AI 요청 허용: 같은 서버의 POST /api/chat-ai만, 요약 버튼을 눌렀을 때 가상 대화가 전달돼요.' : 'AI 요청 차단 중: 실제 모델을 호출하지 않아요. 연결 검수는 liveAi=1을 직접 선택한 별도 링크에서만 가능해요.'}</small>
      <label>검수 역할<select aria-label="MOA 기능 검수 역할" value={role} onChange={event => changeRole(event.target.value === 'member' ? 'member' : 'owner')}><option value="owner">하린 · 모임장</option><option value="member">민서 · 모임원</option></select></label>
      <nav aria-label="MOA 기능 검수 화면">{destinations.map(([label, target]) => <a key={target} href={`#${target}`} aria-current={route === target ? 'page' : undefined}>{label}</a>)}</nav>
      <button type="button" onClick={() => { const ok = repository.update(draft => setGroupParticipation(draft, ids.full, people.other.id, 'DECLINED')); setStatus(ok ? '가상 참가자가 자리를 비웠어요. 대기자는 약속에서 직접 참가를 확인해야 해요.' : repository.getError() || '가상 상태를 바꾸지 못했어요.'); }}>가상 참가자 자리 비우기</button>
      {status && <p role="status">{status}</p>}
      <small>일정: {date} · 카페 11:30–13:00 / 산책 12:30–14:00. 두 역할 모두 모임원이며 두 약속에 참석 중이에요. 정원 1명 약속에는 도윤만 참석 중이에요. 저장과 발견 조건은 계정별로 분리돼요.</small>
    </details><div className="moa-transfer-app" id="moa-transfer-app"><main className="app-shell detail-open"><section className="content">
      <TogetherApp key={role} repository={repository} route={route} viewer={person} places={placeCatalog} journeys={[]}
        discoveryFilters={filters} onDiscoveryFiltersChange={setFilters} calendarView={calendar} onCalendarViewChange={setCalendar}
        onNavigate={navigate} onBack={fallback => navigate(fallback)} onLogin={() => setStatus('가상 모임원으로 로그인한 검수 화면이에요.')}
        onOpenJourney={() => setStatus('이 검수 자료에는 개인 여행이 없어요.')} onSavePlace={() => setStatus('실제 관심 장소 자료에는 저장하지 않아요.')} onCopyJourney={() => setStatus('실제 여행 자료에는 복사하지 않아요.')}/>
    </section></main></div></>;
  }
  const root = (import.meta.hot?.data.moaTransferReviewRoot as Root | undefined) ?? createRoot(document.getElementById('root')!);
  if (import.meta.hot) import.meta.hot.dispose(data => { data.moaTransferReviewRoot = root; });
  root.render(<StrictMode><Review/></StrictMode>);
}

void boot().catch(error => { document.getElementById('root')!.textContent = error instanceof Error ? error.message : '메모리 검수 화면을 열지 못했어요.'; });
