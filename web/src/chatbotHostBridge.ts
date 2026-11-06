import type { Journey, Place } from './data';
import { buildPersonalPlan, normalizePlan } from './tripPlan.ts';

/** Local customer-app connection. This module never opens storage or calls an API. */
export const CHATBOT_CHANNEL = 'spotlog-chatbot-v1' as const;
export const CHATBOT_TARGET_LABELS = {
  discover: '장소 둘러보기', community: '여행기 · 댓글', saved: '앱에 저장한 장소',
  trips: '앱의 내 여행', journal: '내 여행기 작성 · 편집', photos: '사진으로 장소 찾기',
  videos: '영상으로 장소 찾기', profile: '내 프로필', account: '로그인 · 계정 관리',
  privacy: '약관 · 개인정보 · 위치 동의', report: '공개 콘텐츠 신고',
  share_source: '공유한 여행 원본', notifications: '앱 알림 설정',
} as const;
export type ChatbotTarget = keyof typeof CHATBOT_TARGET_LABELS;
export const CHATBOT_ENTRY_LABELS = {
  'journal-text': 'DAY에 글 쓰기', 'journal-photos': 'DAY에 사진 넣기', 'journal-draft': '여행기 초안 이어 쓰기',
  'journal-preview': '여행기 미리보기', 'journal-visibility': '여행기 공개 범위', 'place-comment': '장소 카드 댓글',
  'personal-place': '이름·주소로 개인 장소 등록', 'account-email': '이메일 로그인', 'account-reset': '비밀번호 재설정',
  'account-logout': '로그아웃 확인 화면', 'account-delete': '회원 탈퇴 확인 화면',
  'place-reaction': '장소 카드 좋아요', 'journey-comment': '여행기 전체 댓글', 'journey-cheer': '여행기 응원',
  'profile-summary': '내 프로필 · 창작 등급', 'profile-activity': '이 기기의 활동 미리보기',
} as const;
export type ChatbotEntry = keyof typeof CHATBOT_ENTRY_LABELS;
const entryTargets: Record<ChatbotEntry, ChatbotTarget> = { 'journal-text': 'journal', 'journal-photos': 'journal', 'journal-draft': 'journal', 'journal-preview': 'journal', 'journal-visibility': 'journal', 'place-comment': 'community', 'personal-place': 'trips', 'account-email': 'account', 'account-reset': 'account', 'account-logout': 'account', 'account-delete': 'account', 'place-reaction': 'community', 'journey-comment': 'community', 'journey-cheer': 'community', 'profile-summary': 'profile', 'profile-activity': 'profile' };
export type ChatbotOpenAction = { type: 'open_spotlog'; target: ChatbotTarget; journeyId?: string; day?: number; entry?: ChatbotEntry; placeId?: string };
export type ChatbotDraft = { title: string; region: string; days: { day: number; places: { id: string; name: string; kind: Place['kind']; area: string; address?: string }[] }[] };
export const MAX_CHATBOT_DRAFT_BYTES = 262144;
export type ChatbotContextScope = 'selected-trip' | 'selected-day' | 'saved-places';
export type ChatbotDeviceAccount = 'guest-device' | 'local-review' | 'verified-member';
const hostOrigins = ['http://127.0.0.1:5210', 'http://localhost:5210', 'http://[::1]:5210'];
const chatbotOrigins = ['http://127.0.0.1:3001', 'http://localhost:3001', 'http://[::1]:3001'];
const safeId = (v: unknown): v is string => typeof v === 'string' && /^[\p{L}\p{N}_:-]{1,120}$/u.test(v);
export const isLocalChatbotHost = (origin: string) => hostOrigins.includes(origin);
export function isChatbotOpenAction(value: unknown): value is ChatbotOpenAction {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return Object.keys(v).every(k => ['type', 'target', 'journeyId', 'day', 'entry', 'placeId'].includes(k)) && v.type === 'open_spotlog'
    && typeof v.target === 'string' && Object.hasOwn(CHATBOT_TARGET_LABELS, v.target)
    && (v.journeyId === undefined || safeId(v.journeyId))
    && (v.entry === undefined || (typeof v.entry === 'string' && Object.hasOwn(CHATBOT_ENTRY_LABELS, v.entry) && entryTargets[v.entry as ChatbotEntry] === v.target))
    && (v.placeId === undefined || (safeId(v.placeId) && ['place-comment', 'place-reaction'].includes(String(v.entry))))
    && (v.day === undefined || (Number.isInteger(v.day) && Number(v.day) >= 1 && Number(v.day) <= 30));
}
export const isChatbotPlaceSocialEntry = (entry: ChatbotEntry | undefined) => entry === 'place-comment' || entry === 'place-reaction';
export const isChatbotPublicSocialEntry = (entry: ChatbotEntry | undefined) => isChatbotPlaceSocialEntry(entry) || entry === 'journey-comment' || entry === 'journey-cheer';
/** Resolves a user-selected public target only. It never updates reactions or comments. */
export function resolveChatbotSocialSelection(action: ChatbotOpenAction, journeys: Journey[], journeyId: string, day: number, blockId: string) {
  if (!isChatbotOpenAction(action) || !isChatbotPublicSocialEntry(action.entry)) throw new Error('공개 반응 화면을 다시 선택해 주세요.');
  const journey = journeys.find(item => item.id === journeyId && item.visibility === 'PUBLIC' && item.status === 'PUBLISHED' && item.purpose !== 'PLAN' && !item.trash);
  if (!journey) throw new Error('앱에 있는 공개 여행기를 선택해 주세요.');
  if (!isChatbotPlaceSocialEntry(action.entry)) return { journeyId: journey.id, entry: action.entry };
  const selectedDay = journey.days.find(item => item.day === day), block = selectedDay?.blocks.find(item => item.id === blockId && item.type === 'PLACE');
  const place = block?.type === 'PLACE' ? selectedDay?.places.find(item => block.visitId ? item.visitId === block.visitId : item.id === block.placeId) : undefined;
  if (!place || !block) throw new Error('공개 여행기의 DAY와 실제 장소 카드를 선택해 주세요.');
  return { journeyId: journey.id, entry: action.entry, day, blockId: block.id, placeName: place.name };
}
export function readChatbotLaunch(search: string): ChatbotOpenAction | null {
  const params = new URLSearchParams(search), target = params.get('chatbotTarget');
  if (!target) return null;
  const value = { type: 'open_spotlog', target, ...(params.has('chatbotJourney') ? { journeyId: params.get('chatbotJourney') } : {}), ...(params.has('chatbotDay') ? { day: Number(params.get('chatbotDay')) } : {}), ...(params.has('chatbotEntry') ? { entry: params.get('chatbotEntry') } : {}), ...(params.has('chatbotPlace') ? { placeId: params.get('chatbotPlace') } : {}) };
  return isChatbotOpenAction(value) ? value : null;
}
export function clearChatbotLaunch(url: string) {
  const next = new URL(url);
  ['chatbotTarget', 'chatbotJourney', 'chatbotDay', 'chatbotConnect', 'chatbotEntry', 'chatbotPlace'].forEach(key => next.searchParams.delete(key));
  return next.href;
}
export function isChatbotDraft(value: unknown): value is ChatbotDraft {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  try { if (new TextEncoder().encode(JSON.stringify(value)).byteLength > MAX_CHATBOT_DRAFT_BYTES) return false; } catch { return false; }
  const draft = value as Record<string, unknown>;
  if (Object.keys(draft).some(key => !['title', 'region', 'days'].includes(key)) || typeof draft.title !== 'string' || !draft.title.trim() || draft.title.length > 150 || typeof draft.region !== 'string' || !draft.region.trim() || draft.region.length > 100 || !Array.isArray(draft.days) || !draft.days.length || draft.days.length > 30) return false;
  let total = 0;
  return draft.days.every((value: unknown, index: number) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const day = value as Record<string, unknown>;
    if (Object.keys(day).some(key => !['day', 'places'].includes(key)) || day.day !== index + 1 || !Array.isArray(day.places) || day.places.length > 30) return false;
    total += day.places.length;
    return total <= 900 && day.places.every((value: unknown) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
      const p = value as Record<string, unknown>;
      return Object.keys(p).every(key => ['id', 'name', 'kind', 'area', 'address'].includes(key)) && safeId(p.id) && typeof p.name === 'string' && Boolean(p.name.trim()) && p.name.length <= 150 && typeof p.area === 'string' && p.area.length <= 150 && ['LANDMARK', 'FOOD', 'CAFE', 'STAY', 'SHOP', 'LEISURE'].includes(String(p.kind)) && (p.address === undefined || (typeof p.address === 'string' && p.address.length <= 500));
    });
  }) && total > 0;
}
export function previewChatbotDraft(draft: ChatbotDraft, catalog: Place[]) {
  if (!isChatbotDraft(draft)) throw new Error('가져올 여행의 DAY·장소·크기를 다시 확인해 주세요.');
  const compact = (text: string) => text.normalize('NFKC').replace(/\s+/g, '').toLocaleLowerCase();
  return draft.days.map(day => ({ day: day.day, places: day.places.map(place => {
    const canonical = catalog.find(item => item.id === place.id && !item.personal && item.kind === place.kind && compact(item.name) === compact(place.name));
    return { source: place, canonical, verified: Boolean(canonical), reason: canonical ? '앱에 등록된 장소로 확인했어요' : '앱에서 같은 장소를 확인하지 못했어요 · 개인 입력으로 가져오기' };
  }) }));
}
/** Called only after host confirmation. Every visit and DAY is retained, and all IDs are newly generated. */
export function createChatbotDraftCopy(draft: ChatbotDraft, catalog: Place[], author: string, allowUnverified: boolean): Journey {
  const preview = previewChatbotDraft(draft, catalog);
  if (preview.some(day => day.places.some(place => !place.verified)) && !allowUnverified) throw new Error('미확인 장소를 개인 입력으로 가져올지 직접 확인해 주세요.');
  const plan = buildPersonalPlan([], draft.days.length, draft.title, author);
  plan.region = draft.region; plan.planStage = 'DRAFT'; plan.summary = '챗봇에서 확인 후 가져온 비공개 일정 초안';
  plan.days = plan.days.map((day, index) => {
    const places = preview[index].places.map(item => {
      const visitId = crypto.randomUUID();
      const base: Place = item.canonical ? { ...structuredClone(item.canonical) } : { id: `chatbot-personal-${crypto.randomUUID()}`, kind: item.source.kind, name: item.source.name, area: item.source.area || draft.region, address: item.source.address ?? '', lat: Number.NaN, lng: Number.NaN, locationVerified: false, personal: true, image: '', photos: [], description: '챗봇에서 직접 확인해 가져온 개인 입력 · 장소 정보 미확인', note: '', duration: '체류 시간 미입력' };
      return { ...base, visitId, anchorVisitId: undefined, bookingFixed: undefined, stayDayIds: undefined, planningSlot: undefined, image: '', photos: [], note: '', time: undefined, move: undefined };
    });
    return { ...day, places, blocks: places.map(place => ({ id: crypto.randomUUID(), type: 'PLACE' as const, placeId: place.id, visitId: place.visitId })) };
  });
  return normalizePlan(plan);
}
const contextPlace = (place: Place) => {
  if (!safeId(place.id) || !['LANDMARK', 'FOOD', 'CAFE', 'STAY', 'SHOP', 'LEISURE'].includes(place.kind)) throw new Error('공유할 장소를 다시 확인해 주세요.');
  return { id: place.id, name: place.name.slice(0, 150), kind: place.kind, area: place.area.slice(0, 150) };
};
/** Explicitly selected fields only: no profile, member ID, email, note, booking, times, GPS, photos, narrative, or private preferences. */
export function projectChatbotContext(scope: ChatbotContextScope, account: ChatbotDeviceAccount, input: { journey?: Journey; day?: number; places?: Place[] }) {
  const base = { scope, source: 'spotlog-device' as const, account };
  if (scope === 'saved-places') {
    if (!input.places?.length || input.places.length > 30) throw new Error('공유할 저장 장소를 1~30개 선택해 주세요.');
    return { ...base, places: input.places.map(contextPlace) };
  }
  if (!['selected-trip', 'selected-day'].includes(scope)) throw new Error('공유 범위를 확인해 주세요.');
  const journey = input.journey;
  if (!journey || !safeId(journey.id) || !journey.isMine || journey.trash || journey.purpose !== 'PLAN' || journey.visibility !== 'PRIVATE') throw new Error('내 비공개 여행에서 공유할 여행을 선택해 주세요.');
  const days = scope === 'selected-day' ? journey.days.filter(day => day.day === input.day) : journey.days;
  if (!days.length || days.length > 30 || days.some(day => !Number.isInteger(day.day) || day.day < 1 || day.day > 30 || day.places.length > 30)) throw new Error('공유할 DAY나 장소 수를 확인해 주세요.');
  return { ...base, journey: { id: journey.id, title: journey.title.slice(0, 150), region: journey.region.slice(0, 100), days: days.map(day => ({ day: day.day, places: day.places.map(contextPlace) })) } };
}
type Reply = (value: { ok: true; result?: unknown } | { ok: false; error: string }) => void;
type HostOptions = { onOpen(action: ChatbotOpenAction, reply: Reply): void; onContext(scope: ChatbotContextScope, reply: Reply): void; onDraft?(draft: ChatbotDraft, action: ChatbotOpenAction, reply: Reply): void };
type Session = { source: Window; origin: string; nonce: string; expires: number; used: Set<string> };
/** Pin every request to an allowlisted local origin, known parent/iframe/opener, session nonce, and unreplayed request ID. */
export function installChatbotHostBridge(options: HostOptions, browser: Window = window) {
  if (!isLocalChatbotHost(browser.location.origin)) return () => {};
  const sessions = new Map<string, Session>();
  const knownSource = (source: MessageEventSource | null, origin: string): source is Window => {
    if (!source) return false;
    if ((browser.parent !== browser && source === browser.parent) || source === browser.opener) return true;
    return [...browser.document.querySelectorAll('iframe')].some(frame => {
      try { return frame.contentWindow === source && new URL(frame.src, browser.location.href).origin === origin; } catch { return false; }
    });
  };
  const receive = (event: MessageEvent) => {
    if (!chatbotOrigins.includes(event.origin) || !knownSource(event.source, event.origin)) return;
    const data = event.data;
    if (!data || typeof data !== 'object' || Array.isArray(data) || data.channel !== CHATBOT_CHANNEL || data.version !== 1 || !safeId(data.nonce) || !safeId(data.requestId) || !['hello', 'open', 'context-request', 'draft-handoff'].includes(data.type)) return;
    try { if (new TextEncoder().encode(JSON.stringify(data)).byteLength > MAX_CHATBOT_DRAFT_BYTES + 2048) return; } catch { return; }
    if (Object.keys(data).some(key => !['channel', 'version', 'type', 'nonce', 'requestId', 'payload'].includes(key))) return;
    const now = Date.now();
    for (const [key, value] of sessions) if (value.expires < now) sessions.delete(key);
    if (data.type === 'hello' && !sessions.has(data.nonce)) {
      if (sessions.size >= 8) sessions.delete(sessions.keys().next().value!);
      sessions.set(data.nonce, { source: event.source, origin: event.origin, nonce: data.nonce, expires: now + 600000, used: new Set() });
    }
    const session = sessions.get(data.nonce);
    if (!session || session.source !== event.source || session.origin !== event.origin || session.used.has(data.requestId) || session.used.size >= 128) return;
    session.used.add(data.requestId);
    let answered = false;
    const reply: Reply = result => {
      if (answered || !sessions.has(session.nonce)) return;
      answered = true;
      session.source.postMessage({ channel: CHATBOT_CHANNEL, version: 1, type: 'response', nonce: session.nonce, requestId: data.requestId, ...result }, session.origin);
    };
    if (data.type === 'hello') { reply({ ok: true, result: { capabilities: ['open', 'context-request', ...(options.onDraft ? ['draft-handoff'] : [])], targets: Object.keys(CHATBOT_TARGET_LABELS), scope: 'local-device', auth: 'not-transferred' } }); return; }
    if (data.type === 'open') {
      if (!isChatbotOpenAction(data.payload)) { reply({ ok: false, error: '지원하지 않는 앱 화면이에요.' }); return; }
      options.onOpen(data.payload, reply); return;
    }
    if (data.type === 'draft-handoff') {
      const payload = data.payload;
      if (!payload || typeof payload !== 'object' || Array.isArray(payload) || Object.keys(payload).some(key => !['draft', 'action'].includes(key)) || !isChatbotDraft(payload.draft) || !isChatbotOpenAction(payload.action) || !['trips', 'journal'].includes(payload.action.target) || payload.action.journeyId || (payload.action.day && payload.action.day > payload.draft.days.length) || !options.onDraft) { reply({ ok: false, error: '새 비공개 초안 정보를 확인해 주세요.' }); return; }
      options.onDraft(payload.draft, payload.action, reply); return;
    }
    if (!data.payload || typeof data.payload !== 'object' || Array.isArray(data.payload) || Object.keys(data.payload).length !== 1 || !['selected-trip', 'selected-day', 'saved-places'].includes(data.payload.scope)) { reply({ ok: false, error: '공유 범위를 다시 선택해 주세요.' }); return; }
    options.onContext(data.payload.scope, reply);
  };
  browser.addEventListener('message', receive);
  return () => { sessions.clear(); browser.removeEventListener('message', receive); };
}
