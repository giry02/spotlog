import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { Journey, Place } from '../src/data';
import type { SocialAccountAdapter } from '../src/socialAccountService';

/**
 * DEV-only whole-app layout fixture. No production component is exported or changed.
 * Install isolated browser facilities BEFORE importing any customer module: App's
 * module-level repository and all its descendants can see only these page Maps.
 */
function memoryStorage(): Storage {
  const entries = new Map<string, string>();
  return {
    get length() { return entries.size; },
    key: index => [...entries.keys()][index] ?? null,
    getItem: key => entries.get(String(key)) ?? null,
    setItem: (key, value) => { entries.set(String(key), String(value)); },
    removeItem: key => { entries.delete(String(key)); },
    clear: () => entries.clear(),
  };
}

function installIsolation() {
  const local = memoryStorage(), session = memoryStorage();
  // Never access the original getters or copy entries from a device store.
  Object.defineProperty(window, 'localStorage', { configurable: true, value: local });
  Object.defineProperty(window, 'sessionStorage', { configurable: true, value: session });
  Object.defineProperty(window, 'indexedDB', { configurable: true, value: undefined });
  Object.defineProperty(window, 'caches', { configurable: true, value: undefined });
  class PageChannel extends EventTarget {
    readonly name: string;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onmessageerror: ((event: MessageEvent) => void) | null = null;
    constructor(name: string) { super(); this.name = name; }
    postMessage(_value: unknown) { /* No cross-tab channel. */ }
    close() { /* Page lifetime only. */ }
  }
  Object.defineProperty(window, 'BroadcastChannel', { configurable: true, value: PageChannel });
  if (window.localStorage !== local || window.sessionStorage !== session
    || window.indexedDB !== undefined || window.caches !== undefined
    || window.BroadcastChannel !== (PageChannel as unknown as typeof BroadcastChannel)) {
    throw new Error('실제 저장소와 분리하지 못해 검수 앱을 실행하지 않았어요.');
  }
  // Native storage events from other same-origin tabs must not enter this fixture.
  window.addEventListener('storage', event => event.stopImmediatePropagation(), true);
  document.body.dataset.qaStorage = 'memory-only';
  return { local, session };
}

const planId = 'layout-review-plan';
const journalId = 'layout-review-journal';
const folderId = 'layout-review-long-folder';
const longFolderName = 'LayoutReview' + 'A'.repeat(68); // Exactly 80, no spaces.
const routes: Record<string, string> = {
  home: 'home', places: 'places-guide', together: 'together', find: 'together-find',
  photos: 'places-photo', video: 'places-video',
  saved: 'saved', trips: 'trips', plan: `journey-${planId}`,
  journal: `journey-${journalId}`, editor: `edit-${journalId}`, profile: 'profile',
};

async function boot() {
  if (!import.meta.env.DEV) {
    document.getElementById('root')!.textContent = '개발 환경에서만 확인할 수 있어요.';
    return;
  }
  const { local } = installIsolation();
  const params = new URLSearchParams(location.search);
  document.body.dataset.embed = params.get('embed') === '1' ? 'true' : 'false';

  const [{ placeCatalog }, { createLocalRepository, PLACE_DIRECTORY_KEY }, { draftPolicies }, { interestStorageKey }] = await Promise.all([
    import('../src/data'), import('../src/localRepository'),
    import('../src/accountPolicies'), import('../src/interestCollectionStore'),
  ]);
  const reference = placeCatalog.find(place => place.kind === 'LANDMARK' && place.area.startsWith('부산') && place.image)
    ?? placeCatalog.find(place => Boolean(place.image));
  if (!reference) throw new Error('검수용 공개 카탈로그 자료가 없어요.');
  const fictional = (id: string, kind: Place['kind'], name: string): Place => ({
    id, kind, name, personal: true, locationVerified: false,
    area: '부산 검수 지역', address: '주소 미확인 · 페이지 메모리의 가상 업체',
    lat: Number.NaN, lng: Number.NaN, image: '', photos: [],
    description: '긴 업체명과 설명 줄바꿈 확인용 가상 자료. 실제 영업·위치·예약 정보 아님.',
    note: '작성 중인 문장과 화면 폭을 확인하는 메모', duration: '시간 미정',
  });
  const food = fictional('layout-review-food', 'FOOD', 'LayoutReviewRestaurantWithoutWhitespace' + 'R'.repeat(42));
  const stay = fictional('layout-review-stay', 'STAY', 'LayoutReviewHotelWithAnExtremelyLongBranchName' + 'H'.repeat(32));
  const day1 = 'layout-plan-day-1', day2 = 'layout-plan-day-2';
  const plan: Journey = {
    id: planId, purpose: 'PLAN', planStage: 'READY', isMine: true,
    title: '레이아웃 검수 · 긴 장소명을 담은 부산 1박 2일', region: '부산',
    dateRange: '날짜 미정', duration: '1박 2일', status: 'PLANNING', visibility: 'PRIVATE',
    cover: reference.image, summary: '실제 고객 자료와 분리된 개인 일정.', story: '',
    author: '레이아웃 확인 사용자', saves: 0, tags: ['메모리 검수'],
    days: [
      { dayId: day1, day: 1, date: '', title: '긴 장소명과 숙박 확인', story: '', blocks: [], places: [
        { ...reference, visitId: 'layout-plan-visit-landmark', planningSlot: 'morning' },
        { ...food, visitId: 'layout-plan-visit-food', planningSlot: 'lunch' },
        { ...stay, visitId: 'layout-plan-visit-stay', planningSlot: 'stay', stayDayIds: [day1], bookingFixed: false },
      ] },
      { dayId: day2, day: 2, date: '', title: '두 번째 DAY', story: '', blocks: [], places: [
        { ...reference, visitId: 'layout-plan-visit-landmark-2', planningSlot: 'morning' },
      ] },
    ],
  };
  const journal: Journey = {
    id: journalId, purpose: 'JOURNAL', isMine: true,
    title: '레이아웃 검수 여행기 · 긴 제목과 입력 필드', region: '부산', duration: '1박 2일',
    dateRange: '날짜 미정', status: 'PLANNING', visibility: 'PRIVATE',
    cover: reference.image, summary: '지역·기간 2열과 DAY 편집, 글·장소 카드 도구를 확인하는 여행기.',
    story: '이 문장과 날짜·장소는 검수용 페이지 메모리 안에서만 변경됨.',
    author: '레이아웃 확인 사용자', sourceAuthor: 'LayoutReviewSourceAuthorWithoutWhitespace' + 'A'.repeat(32),
    saves: 0, tags: ['메모리 검수'],
    days: [{ dayId: 'layout-journal-day-1', day: 1, date: '', title: '날짜 제목', story: '여행기 소개 입력 확인',
      places: [{ ...food, visitId: 'layout-journal-visit-food' }],
      blocks: [
        { id: 'layout-journal-text-1', type: 'TEXT', heading: '글 소제목', body: '본문 입력은 16px 유지. 글자 크기와 도구 간격, 작성 중 내용을 확인해 보세요.' },
        { id: 'layout-journal-place-1', type: 'PLACE', placeId: food.id, visitId: 'layout-journal-visit-food' },
      ],
    }],
  };
  const repository = createLocalRepository(local);
  if (!repository.setItems({
    'spotlog.web.saved.v3': JSON.stringify([reference.id, food.id, stay.id]),
    'spotlog.web.journeys.v4': JSON.stringify([plan, journal]),
    'spotlog.web.profile.v1': JSON.stringify({ displayName: '레이아웃 확인 사용자', bio: '페이지 메모리 검수' }),
    [PLACE_DIRECTORY_KEY]: JSON.stringify([food, stay]),
  })) throw new Error(repository.getIssue() || '메모리 예시 자료를 만들지 못했어요.');
  const timestamp = new Date().toISOString();
  local.setItem(interestStorageKey('guest-device'), JSON.stringify({
    schemaVersion: 1, owner: 'guest-device', revision: 1,
    collections: [{ id: folderId, title: longFolderName, region: '부산',
      placeIds: [food.id, stay.id], createdAt: timestamp, updatedAt: timestamp }],
  }));

  const unavailable = async (): Promise<never> => { throw new Error('이 메모리 검수 화면은 실제 인증·발송을 실행하지 않아요.'); };
  const guest: SocialAccountAdapter = {
    configured: true,
    async session(signal) { signal.throwIfAborted(); return { state: 'GUEST' }; },
    async policies(signal) { signal.throwIfAborted(); return structuredClone(draftPolicies); },
    beginSignIn: unavailable, completeSignup: unavailable, signInEmail: unavailable,
    signUpEmail: unavailable, verifyEmail: unavailable, resendVerification: unavailable,
    resetPassword: unavailable, signOut: unavailable, removeAccount: unavailable,
  };
  // Match the consumer entry: App dependency CSS first, then the main entry's order.
  const { default: App } = await import('../src/App');
  await import('../src/styles.css');
  await import('../src/theme.css');
  await import('../src/product-ux-refinement.css');
  await import('../src/navigation-spacing.css');
  await import('../src/consumer-density.css');

  const requested = params.get('screen') ?? 'saved';
  const route = routes[requested] ?? routes.saved;
  history.replaceState(null, '', `${location.pathname}${location.search}#${route}`);
  const labels: Record<string, string> = {
    home: '추천 홈', places: '장소 둘러보기', together: '함께하기', find: '모임 찾기',
    photos: '사진 둘러보기', video: '영상 둘러보기',
    saved: '관심 장소', trips: '내 여행 목록', plan: '개인 일정', journal: '여행기',
    editor: '여행기 편집', profile: '비로그인 프로필',
  };
  const links = document.getElementById('layout-fixture-links')!;
  for (const [screen, label] of Object.entries(labels)) {
    const link = document.createElement('a'), target = new URL(location.href);
    target.searchParams.set('screen', screen); target.hash = '';
    link.href = target.href; link.textContent = label; links.append(link);
  }
  const status = document.createElement('small');
  status.id = 'layout-fixture-isolation';
  status.textContent = '분리 확인 완료 · local/session Map · 오프라인 DB/캐시/다른 탭 채널 사용 안 함';
  links.after(status);
  createRoot(document.getElementById('root')!).render(<StrictMode><App accountAdapter={guest}/></StrictMode>);
}

void boot().catch(error => {
  document.getElementById('root')!.textContent = error instanceof Error ? error.message : '검수 화면을 실행하지 못했어요.';
});
