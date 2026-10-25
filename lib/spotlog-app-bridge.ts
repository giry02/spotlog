import { createClientId } from './client-id';

/** Local-only, navigation-first connection to the existing Spotlog customer app. */
export const SPOTLOG_BRIDGE_CHANNEL = 'spotlog-chatbot-v1' as const;
export const SPOTLOG_TARGETS = {
  discover: '장소 둘러보기', community: '여행기 · 댓글', saved: '앱에 저장한 장소',
  trips: '앱의 내 여행', journal: '내 여행기 작성 · 편집', photos: '사진으로 장소 찾기',
  videos: '영상으로 장소 찾기', profile: '내 프로필', account: '로그인 · 계정 관리',
  privacy: '약관 · 개인정보 · 위치 동의', report: '공개 콘텐츠 신고',
  share_source: '공유한 여행 원본', notifications: '앱 알림 설정',
} as const;
export type SpotlogTarget = keyof typeof SPOTLOG_TARGETS;
export const SPOTLOG_ENTRIES = {
  'journal-text': 'DAY에 글 쓰기', 'journal-photos': 'DAY에 사진 넣기', 'journal-draft': '여행기 초안 이어 쓰기',
  'journal-preview': '여행기 미리보기', 'journal-visibility': '여행기 공개 범위', 'place-comment': '장소 카드 댓글',
  'personal-place': '이름·주소로 개인 장소 등록', 'account-email': '이메일 로그인', 'account-reset': '비밀번호 재설정',
  'account-logout': '로그아웃 확인 화면', 'account-delete': '회원 탈퇴 확인 화면',
  'place-reaction': '장소 카드 좋아요', 'journey-comment': '여행기 전체 댓글', 'journey-cheer': '여행기 응원',
  'profile-summary': '내 프로필 · 창작 등급', 'profile-activity': '이 기기의 활동 미리보기',
} as const;
export type SpotlogEntry = keyof typeof SPOTLOG_ENTRIES;
export const SPOTLOG_ENTRY_TARGETS: Record<SpotlogEntry, SpotlogTarget> = {
  'journal-text': 'journal', 'journal-photos': 'journal', 'journal-draft': 'journal', 'journal-preview': 'journal', 'journal-visibility': 'journal',
  'place-comment': 'community', 'personal-place': 'trips', 'account-email': 'account', 'account-reset': 'account', 'account-logout': 'account', 'account-delete': 'account',
  'place-reaction': 'community', 'journey-comment': 'community', 'journey-cheer': 'community', 'profile-summary': 'profile', 'profile-activity': 'profile',
};
export type SpotlogOpenAction = { type: 'open_spotlog'; target: SpotlogTarget; journeyId?: string; day?: number; entry?: SpotlogEntry; placeId?: string };
export type SpotlogDraftHandoff = { title: string; region: string; days: { day: number; places: (SpotlogContextPlace & { address?: string })[] }[] };
export const MAX_SPOTLOG_DRAFT_BYTES = 262144;
export type SpotlogContextScope = 'selected-trip' | 'selected-day' | 'saved-places';
export type SpotlogContextPlace = { id: string; name: string; kind: 'LANDMARK' | 'FOOD' | 'CAFE' | 'STAY' | 'SHOP'; area: string };
export type SpotlogContext = {
  scope: SpotlogContextScope; source: 'spotlog-device'; account: 'guest-device' | 'local-review' | 'verified-member';
  journey?: { id: string; title: string; region: string; days: { day: number; places: SpotlogContextPlace[] }[] };
  places?: SpotlogContextPlace[];
};
export const SPOTLOG_LOCAL_HOST_ORIGINS = ['http://127.0.0.1:5210', 'http://localhost:5210', 'http://[::1]:5210'] as const;
export const SPOTLOG_CHATBOT_ORIGINS = ['http://127.0.0.1:3001', 'http://localhost:3001', 'http://[::1]:3001'] as const;
const safeId = (value: unknown): value is string => typeof value === 'string' && /^[\p{L}\p{N}_:-]{1,120}$/u.test(value);
export function validateSpotlogOpenAction(value: unknown): value is SpotlogOpenAction {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const action = value as Record<string, unknown>;
  return Object.keys(action).every(key => ['type', 'target', 'journeyId', 'day', 'entry', 'placeId'].includes(key))
    && action.type === 'open_spotlog' && typeof action.target === 'string' && Object.hasOwn(SPOTLOG_TARGETS, action.target)
    && (action.journeyId === undefined || safeId(action.journeyId))
    && (action.entry === undefined || (typeof action.entry === 'string' && Object.hasOwn(SPOTLOG_ENTRIES, action.entry) && SPOTLOG_ENTRY_TARGETS[action.entry as SpotlogEntry] === action.target))
    && (action.placeId === undefined || (safeId(action.placeId) && ['place-comment', 'place-reaction'].includes(String(action.entry))))
    && (action.day === undefined || (Number.isInteger(action.day) && Number(action.day) >= 1 && Number(action.day) <= 30));
}
export function buildSpotlogAppUrl(action: SpotlogOpenAction): string {
  if (!validateSpotlogOpenAction(action)) throw new Error('지원하지 않는 Spotlog 화면입니다.');
  const url = new URL('http://localhost:5210/spotlog/');
  url.searchParams.set('chatbotTarget', action.target);
  if (action.journeyId) url.searchParams.set('chatbotJourney', action.journeyId);
  if (action.day) url.searchParams.set('chatbotDay', String(action.day));
  if (action.entry) url.searchParams.set('chatbotEntry', action.entry);
  if (action.placeId) url.searchParams.set('chatbotPlace', action.placeId);
  const hash: Record<SpotlogTarget, string> = { discover: 'places-guide', community: 'community', saved: 'saved', trips: 'trips', journal: 'trips', photos: 'places-photo', videos: 'places-video', profile: 'profile', account: 'profile', privacy: 'profile', report: 'community', share_source: 'community', notifications: 'profile' };
  url.hash = hash[action.target];
  return url.href;
}
export function buildSpotlogConnectUrl(): string { return 'http://localhost:5210/spotlog/?chatbotConnect=1#home'; }
export function isSpotlogDraftHandoff(value: unknown): value is SpotlogDraftHandoff {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  try { if (new TextEncoder().encode(JSON.stringify(value)).byteLength > MAX_SPOTLOG_DRAFT_BYTES) return false; } catch { return false; }
  const draft = value as Record<string, unknown>;
  if (Object.keys(draft).some(key => !['title', 'region', 'days'].includes(key)) || typeof draft.title !== 'string' || !draft.title.trim() || draft.title.length > 150 || typeof draft.region !== 'string' || !draft.region.trim() || draft.region.length > 100 || !Array.isArray(draft.days) || !draft.days.length || draft.days.length > 30) return false;
  let total = 0;
  return draft.days.every((row: unknown, index: number) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
    const day = row as Record<string, unknown>;
    if (Object.keys(day).some(key => !['day', 'places'].includes(key)) || day.day !== index + 1 || !Array.isArray(day.places) || day.places.length > 30) return false;
    total += day.places.length;
    return total <= 900 && day.places.every((item: unknown) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
      const p = item as Record<string, unknown>;
      return Object.keys(p).every(key => ['id', 'name', 'kind', 'area', 'address'].includes(key)) && safeId(p.id) && typeof p.name === 'string' && Boolean(p.name.trim()) && p.name.length <= 150 && typeof p.area === 'string' && p.area.length <= 150 && ['LANDMARK', 'FOOD', 'CAFE', 'STAY', 'SHOP'].includes(String(p.kind)) && (p.address === undefined || (typeof p.address === 'string' && p.address.length <= 500));
    });
  }) && total > 0;
}
export function isSpotlogContext(value: unknown): value is SpotlogContext {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (!['selected-trip', 'selected-day', 'saved-places'].includes(String(item.scope)) || item.source !== 'spotlog-device' || !['guest-device', 'local-review', 'verified-member'].includes(String(item.account))) return false;
  if (Object.keys(item).some(key => !['scope', 'source', 'account', 'journey', 'places'].includes(key))) return false;
  const isPlace = (v: unknown) => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
    const p = v as Record<string, unknown>;
    return Object.keys(p).every(key => ['id', 'name', 'kind', 'area'].includes(key)) && safeId(p.id)
      && typeof p.name === 'string' && p.name.length <= 150 && typeof p.area === 'string' && p.area.length <= 150
      && ['LANDMARK', 'FOOD', 'CAFE', 'STAY', 'SHOP'].includes(String(p.kind));
  };
  if (item.scope === 'saved-places') return item.journey === undefined && Array.isArray(item.places) && item.places.length <= 30 && item.places.every(isPlace);
  if (!item.journey || typeof item.journey !== 'object' || item.places !== undefined) return false;
  const j = item.journey as Record<string, unknown>;
  if (Object.keys(j).some(key => !['id', 'title', 'region', 'days'].includes(key)) || !safeId(j.id) || typeof j.title !== 'string' || j.title.length > 150 || typeof j.region !== 'string' || j.region.length > 100 || !Array.isArray(j.days) || !j.days.length || j.days.length > 30 || (item.scope === 'selected-day' && j.days.length !== 1)) return false;
  return j.days.every((day: unknown) => {
    if (!day || typeof day !== 'object' || Array.isArray(day)) return false;
    const d = day as Record<string, unknown>;
    return Object.keys(d).every(key => ['day', 'places'].includes(key)) && Number.isInteger(d.day) && Number(d.day) >= 1 && Number(d.day) <= 30 && Array.isArray(d.places) && d.places.length <= 30 && d.places.every(isPlace);
  });
}

type BridgeReply = { channel: typeof SPOTLOG_BRIDGE_CHANNEL; version: 1; type: 'response'; nonce: string; requestId: string; ok: boolean; result?: unknown; error?: string };
type BridgeWindow = Window & { ReactNativeWebView?: { postMessage(value: string): void } };
/** No wildcard targetOrigin, no auth token, and no storage proxy. A real native host must implement this protocol before its calls can succeed. */
export function createSpotlogBridgeClient(browser: BridgeWindow = window as BridgeWindow) {
  const nonce = createClientId(browser.crypto);
  let peer: Window | null = null, origin = '', native = false, closed = false;
  const pending = new Map<string, { resolve(value: BridgeReply): void; reject(error: Error): void; timer: number }>();
  try {
    const referrer = new URL(browser.document.referrer);
    if ((SPOTLOG_LOCAL_HOST_ORIGINS as readonly string[]).includes(referrer.origin) && browser.parent !== browser) { peer = browser.parent; origin = referrer.origin; }
  } catch { /* Standalone pages have no parent host. */ }
  if (!peer && browser.ReactNativeWebView?.postMessage) native = true;
  const receive = (event: MessageEvent) => {
    if (closed || (!native && (event.source !== peer || event.origin !== origin))) return;
    let data = event.data;
    if (native && typeof data === 'string') { try { data = JSON.parse(data); } catch { return; } }
    if (!data || data.channel !== SPOTLOG_BRIDGE_CHANNEL || data.version !== 1 || data.type !== 'response' || data.nonce !== nonce || typeof data.requestId !== 'string' || typeof data.ok !== 'boolean') return;
    const request = pending.get(data.requestId);
    if (!request) return;
    browser.clearTimeout(request.timer); pending.delete(data.requestId);
    request.resolve(data as BridgeReply);
  };
  browser.addEventListener('message', receive);
  // Some WebView implementations deliver messages to document instead of window.
  if (native) browser.document.addEventListener('message', receive as EventListener);
  const request = (type: 'hello' | 'open' | 'context-request' | 'draft-handoff', payload?: unknown): Promise<BridgeReply> => new Promise((resolve, reject) => {
    if (closed || (!peer && !native)) { reject(new Error('앱 연결 화면에서 사용할 수 있어요.')); return; }
    const requestId = createClientId(browser.crypto);
    const timer = browser.setTimeout(() => { pending.delete(requestId); reject(new Error(type === 'hello' ? 'Spotlog 앱 연결을 확인하지 못했어요.' : '앱에서 확인을 마친 뒤 다시 시도해 주세요.')); }, type === 'hello' ? 2500 : 120000);
    pending.set(requestId, { resolve, reject, timer });
    const message = { channel: SPOTLOG_BRIDGE_CHANNEL, version: 1, type, nonce, requestId, payload };
    try { if (native) browser.ReactNativeWebView!.postMessage(JSON.stringify(message)); else peer!.postMessage(message, origin); }
    catch { browser.clearTimeout(timer); pending.delete(requestId); reject(new Error('Spotlog 앱으로 요청을 보내지 못했어요.')); }
  });
  return {
    connected: Boolean(peer || native),
    async open(action: SpotlogOpenAction) {
      if (!validateSpotlogOpenAction(action)) throw new Error('지원하지 않는 Spotlog 화면입니다.');
      const ready = await request('hello'); if (!ready.ok) throw new Error(ready.error || '앱 연결 전이에요.');
      const reply = await request('open', action); if (!reply.ok) throw new Error(reply.error || '화면 이동을 취소했어요.');
      return reply.result;
    },
    async context(scope: SpotlogContextScope): Promise<SpotlogContext> {
      if (!['selected-trip', 'selected-day', 'saved-places'].includes(scope)) throw new Error('공유 범위를 확인해 주세요.');
      const ready = await request('hello'); if (!ready.ok) throw new Error(ready.error || '앱 연결 전이에요.');
      const reply = await request('context-request', { scope });
      if (!reply.ok) throw new Error(reply.error || '자료 공유를 취소했어요.');
      if (!isSpotlogContext(reply.result) || reply.result.scope !== scope) throw new Error('앱이 보낸 자료를 확인하지 못했어요.');
      return reply.result;
    },
    async handoff(draft: SpotlogDraftHandoff, action: SpotlogOpenAction) {
      if (!isSpotlogDraftHandoff(draft) || !validateSpotlogOpenAction(action) || !['trips', 'journal'].includes(action.target) || action.journeyId || (action.day && action.day > draft.days.length)) throw new Error('새 초안의 DAY와 장소 정보를 확인해 주세요.');
      const ready = await request('hello'); if (!ready.ok) throw new Error(ready.error || '앱 연결 전이에요.');
      const reply = await request('draft-handoff', { draft, action });
      if (!reply.ok) throw new Error(reply.error || '새 초안 가져오기를 취소했어요.');
      return reply.result;
    },
    destroy() { closed = true; browser.removeEventListener('message', receive); if (native) browser.document.removeEventListener('message', receive as EventListener); for (const value of pending.values()) { browser.clearTimeout(value.timer); value.reject(new Error('앱 연결이 종료됐어요.')); } pending.clear(); },
  };
}
export async function executeSpotlogAction(action: SpotlogOpenAction): Promise<{ status: 'opened' | 'blocked' | 'unavailable'; mode: 'app-window' | 'host'; message: string }> {
  if (typeof window === 'undefined' || !validateSpotlogOpenAction(action)) return { status: 'unavailable', mode: 'app-window', message: '지원하지 않는 앱 화면이에요.' };
  if (!(SPOTLOG_CHATBOT_ORIGINS as readonly string[]).includes(window.location.origin)) return { status: 'unavailable', mode: 'app-window', message: '이 기능은 로컬 챗봇에서만 사용할 수 있어요.' };
  const bridge = createSpotlogBridgeClient();
  if (bridge.connected) {
    try { await bridge.open(action); return { status: 'opened', mode: 'host', message: 'Spotlog 앱 화면을 열었어요. 완료는 앱에서 확인해 주세요.' }; }
    catch (error) { return { status: 'unavailable', mode: 'host', message: error instanceof Error ? error.message : '앱 연결을 확인해 주세요.' }; }
    finally { bridge.destroy(); }
  }
  bridge.destroy();
  const popup = window.open(buildSpotlogAppUrl(action), '_blank');
  if (!popup) return { status: 'blocked', mode: 'app-window', message: '팝업이 차단됐어요. 이 사이트의 팝업을 허용한 뒤 다시 눌러 주세요.' };
  // Remove the opener immediately; no account or device record crosses the tabs.
  try { popup.opener = null; } catch { /* The fixed local target owns its own records. */ }
  return { status: 'opened', mode: 'app-window', message: '로컬 Spotlog 앱을 열었어요. 앱에서 화면 이동을 확인해 주세요.' };
}
export async function requestSpotlogContext(scope: SpotlogContextScope): Promise<SpotlogContext> {
  if (typeof window === 'undefined' || !(SPOTLOG_CHATBOT_ORIGINS as readonly string[]).includes(window.location.origin)) throw new Error('로컬 앱 연결 화면에서 사용할 수 있어요.');
  const bridge = createSpotlogBridgeClient();
  try { return await bridge.context(scope); } finally { bridge.destroy(); }
}
/** The customer confirms every DAY and unresolved place in the host before a new private DRAFT is created. */
export async function executeSpotlogDraftHandoff(draft: SpotlogDraftHandoff, action: SpotlogOpenAction = { type: 'open_spotlog', target: 'trips' }): Promise<unknown> {
  if (typeof window === 'undefined' || !(SPOTLOG_CHATBOT_ORIGINS as readonly string[]).includes(window.location.origin)) throw new Error('로컬 앱 연결 화면에서 사용할 수 있어요.');
  const bridge = createSpotlogBridgeClient();
  try { return await bridge.handoff(draft, action); } finally { bridge.destroy(); }
}
