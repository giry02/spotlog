import type { AiPlannerDraft } from './AiPlannerSheet';
import type { Place } from './data';
import { catalogVersion, validatePlannerConditions, validatePlannerResult, type PlannerConditions, type PlannerRequest } from './aiPlanner.ts';
import { applyPlannerSelections } from './aiPlannerSelections.ts';
import { planningSlots } from './itineraryComposer.ts';

export type AiPlannerDraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export interface AiPlannerDraftContext { ownerId: string; catalog: Place[]; savedPlaces: Place[]; journeyIds?: string[] }
export type AiPlannerDraftStatus = 'empty' | 'ready' | 'catalog-changed' | 'completed' | 'corrupt' | 'unsupported' | 'unavailable';
export interface AiPlannerDraftRead { draft: AiPlannerDraft | null; status: AiPlannerDraftStatus; message: string }
export interface AiPlannerDraftWrite { ok: boolean; message: string }
interface DraftEnvelope { schemaVersion: 1; ownerId: string; updatedAt: string; contextSignature: string; previewContextSignature: string | null; draft: AiPlannerDraft }
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string');
const uniqueStrings = (value: unknown): value is string[] => strings(value) && new Set(value).size === value.length;
const requiredStrings = (value: Record<string, unknown>, keys: string[]) => keys.every(key => typeof value[key] === 'string');
const matches = (value: unknown, allowed: readonly string[]) => typeof value === 'string' && allowed.includes(value);
const hasConditions = (value: unknown): value is PlannerConditions => object(value)
  && requiredStrings(value, ['region', 'startDate', 'prompt', 'arrival', 'departure', 'companions', 'meals', 'accessibility'])
  && Number.isSafeInteger(value.dayCount)
  && matches(value.mode, ['region', 'saved']) && matches(value.pace, ['slow', 'balanced', 'full']) && matches(value.transport, ['undecided', 'walk', 'transit', 'car']) && matches(value.walking, ['normal', 'less'])
  && ['requiredIds', 'excludedIds', 'fixedIds'].every(key => uniqueStrings(value[key])) && typeof value.suggestFood === 'boolean' && typeof value.suggestStay === 'boolean';
const hasPlace = (value: unknown): value is Place => object(value)
  && requiredStrings(value, ['id', 'name', 'area', 'address', 'image', 'description', 'note', 'duration'])
  && matches(value.kind, ['LANDMARK', 'FOOD', 'CAFE', 'STAY', 'SHOP'])
  && (value.lat === null || typeof value.lat === 'number') && (value.lng === null || typeof value.lng === 'number')
  && (value.tags === undefined || strings(value.tags))
  && ['visitId', 'anchorVisitId', 'time', 'move'].every(key => value[key] === undefined || typeof value[key] === 'string')
  && (value.planningSlot===undefined||matches(value.planningSlot,planningSlots))
  && ['personal', 'locationVerified', 'bookingFixed'].every(key => value[key] === undefined || typeof value[key] === 'boolean')
  && (value.photos === undefined || Array.isArray(value.photos) && value.photos.every(photo => object(photo) && requiredStrings(photo, ['image', 'alt', 'caption']) && ['mediaId', 'placeId', 'sourceId', 'objectPosition'].every(key => photo[key] === undefined || typeof photo[key] === 'string')));

/** Account-bound storage key. These are drafts, with no trash retention or automatic expiry policy. */
export const aiPlannerDraftKey = (ownerId: string) => `spotlog.ai-planner-draft.v1:${encodeURIComponent(ownerId)}`;

/** Includes fields not covered by the recommendation version (business address/kind/photos, etc.). */
function contextSignature(context: AiPlannerDraftContext): string {
  const text = JSON.stringify([context.catalog, context.savedPlaces]);
  let a = 2166136261, b = 5381;
  for (let i = 0; i < text.length; i++) { a = Math.imul(a ^ text.charCodeAt(i), 16777619); b = Math.imul(b, 33) ^ text.charCodeAt(i); }
  return `${text.length}:${a >>> 0}:${b >>> 0}`;
}

/** Never repairs a malformed draft by discarding just the user's selected businesses or visits. */
export function isAiPlannerDraft(value: unknown, context?: AiPlannerDraftContext): value is AiPlannerDraft {
  try {
    if (!object(value) || !hasConditions(value.conditions) || !Number.isInteger(value.selectedDay) || Number(value.selectedDay) < 1 || Number(value.selectedDay) > 7 || !uniqueStrings(value.excludedVisits) || !Array.isArray(value.businesses)) return false;
    const conditions=value.conditions,excludedVisits=value.excludedVisits;
    if (!value.businesses.every(choice => object(choice) && requiredStrings(choice, ['dayId', 'anchorId']) && hasPlace(choice.place) && matches(choice.place.kind, ['FOOD', 'CAFE', 'STAY']) && Number.isInteger(choice.nights) && Number(choice.nights) >= 1 && Number(choice.nights) <= 6)) return false;
    const businessKeys = value.businesses.map(choice => `${choice.dayId}\u0000${choice.anchorId}\u0000${choice.place.id}\u0000${choice.place.planningSlot??''}`);
    if (new Set(businessKeys).size !== businessKeys.length) return false;
    if (value.businessForm !== undefined && (!object(value.businessForm) || !requiredStrings(value.businessForm, ['dayId', 'anchorId', 'name', 'address']) || !matches(value.businessForm.kind, ['FOOD', 'CAFE', 'STAY']) || value.businessForm.planningSlot!==undefined&&!matches(value.businessForm.planningSlot,planningSlots))) return false;
    if (value.preview === null) return true;
    if (!object(value.preview) || !object(value.preview.data) || !object(value.preview.data.journey) || !Array.isArray(value.preview.data.journey.days) || !Array.isArray(value.preview.data.alternatives) || !value.preview.data.alternatives.every(hasPlace)) return false;
    const rawDays = value.preview.data.journey.days;
    if (!rawDays.every(day => object(day) && Array.isArray(day.places) && day.places.every(hasPlace))) return false;
    const snapshotPlaces = rawDays.flatMap(day => (day as { places: Place[] }).places);
    const currentVersion = context ? catalogVersion(value.conditions.mode === 'saved' ? context.savedPlaces : context.catalog) : undefined;
    // A stale draft still opens safely for review. Its old source version blocks approval until regeneration.
    const useCurrent = context && value.preview.sourceVersion === currentVersion;
    const request: PlannerRequest = {
      requestId: String(value.preview.requestId), sourceVersion: String(value.preview.sourceVersion), language: 'ko',
      selectedPlaceIds: snapshotPlaces.map(place => place.id), dayIds: [], lockedVisitIds: [], conditions: value.conditions,
      catalog: useCurrent ? context.catalog : [...snapshotPlaces, ...value.preview.data.alternatives],
      savedPlaces: useCurrent ? context.savedPlaces : snapshotPlaces, author: String(value.preview.data.journey.author),
    };
    const legacy=value.preview.data.compositionVersion===undefined;
    const candidates=conditions.mode==='saved'?[...request.savedPlaces,...request.catalog.filter(p=>conditions.fixedIds.includes(p.id)&&p.kind==='STAY')]:request.catalog;
    if (!legacy&&validatePlannerConditions(conditions,candidates).length) return false;
    const preview = validatePlannerResult(request, value.preview, {allowLegacy:true});
    const days = preview.data.journey.days;
    if (!days.some(day => day.day === value.selectedDay)) return false;
    if (excludedVisits.some(id => !snapshotPlaces.some(place => place.visitId === id) || snapshotPlaces.some(place => place.visitId === id && (place.bookingFixed || conditions.requiredIds.includes(place.id))))) return false;
    const selected = applyPlannerSelections(preview.data.journey,excludedVisits,[]);
    const occupiedNights=new Set<string>();
    for (const choice of value.businesses as AiPlannerDraft['businesses']) {
      const day = selected.days.find(day => day.dayId === choice.dayId);
      const anchors=choice.place.kind==='STAY'?selected.days.flatMap(day=>day.places):day?.places??[];
      if (!day || !anchors.some(place => place.visitId === choice.anchorId && place.kind === 'LANDMARK')) return false;
      if(choice.place.kind==='STAY') {
        const start=selected.days.indexOf(day);
        for(const night of selected.days.slice(start,start+choice.nights)) {if(occupiedNights.has(night.dayId!))return false;occupiedNights.add(night.dayId!);}
      }
    }
    applyPlannerSelections(preview.data.journey,excludedVisits,value.businesses as AiPlannerDraft['businesses']);
    if (object(value.businessForm)) {
      const form = value.businessForm;
      if (!days.some(day => day.day === value.selectedDay && day.dayId === form.dayId && day.places.some(place => place.visitId === form.anchorId && place.kind === 'LANDMARK' && !excludedVisits.includes(place.visitId!)))) return false;
    }
    return true;
  } catch { return false; }
}

function parseEnvelope(raw: string | null, ownerId: string): { status: 'empty' | 'ready' | 'corrupt' | 'unsupported'; value?: DraftEnvelope } {
  if (raw === null) return { status: 'empty' };
  try {
    const value: unknown = JSON.parse(raw);
    if (!object(value) || value.ownerId !== ownerId) return { status: 'corrupt' };
    if (value.schemaVersion !== 1) return { status: 'unsupported' };
    if (value.cleared === true) return { status: 'empty' };
    if (typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt)) || typeof value.contextSignature !== 'string' || !(value.previewContextSignature === null || typeof value.previewContextSignature === 'string') || !isAiPlannerDraft(value.draft)) return { status: 'corrupt' };
    return { status: 'ready', value: value as unknown as DraftEnvelope };
  } catch { return { status: 'corrupt' }; }
}
const messages = {
  empty: '', ready: '', completed: '',
  'catalog-changed': '작성하던 내용은 복원했어요. 장소 자료가 바뀌어 초안을 다시 만든 뒤 저장해 주세요.',
  corrupt: '이 기기의 작성 중 초안을 읽지 못했어요. 기존 내용은 덮어쓰지 않았어요. 새로 시작하려면 초안을 초기화해 주세요.',
  unsupported: '다른 버전에서 저장한 초안이에요. 기존 내용은 덮어쓰지 않았어요. 새로 시작하려면 초안을 초기화해 주세요.',
  unavailable: '이 기기에 초안을 저장하거나 불러올 수 없어요. 현재 화면의 입력은 유지되지만 새로고침하면 사라질 수 있어요.',
} satisfies Record<AiPlannerDraftStatus, string>;

export function createAiPlannerDraftStore(storage?: AiPlannerDraftStorage) {
  const getStorage = (): AiPlannerDraftStorage => storage ?? globalThis.localStorage;
  const read = (context: AiPlannerDraftContext): AiPlannerDraftRead => {
    try {
      if (!context.ownerId) return { draft: null, status: 'corrupt', message: messages.corrupt };
      const parsed = parseEnvelope(getStorage().getItem(aiPlannerDraftKey(context.ownerId)), context.ownerId);
      if (!parsed.value) return { draft: null, status: parsed.status, message: messages[parsed.status] };
      const { draft } = parsed.value;
      if (draft.preview && context.journeyIds?.includes(draft.preview.data.journey.id)) return { draft: null, status: 'completed', message: '' };
      const signature = draft.preview ? parsed.value.previewContextSignature : parsed.value.contextSignature;
      const changed = signature !== contextSignature(context) || Boolean(draft.preview && (draft.preview.data.compositionVersion!==2 || draft.preview.sourceVersion !== catalogVersion(draft.conditions.mode === 'saved' ? context.savedPlaces : context.catalog)));
      if (!isAiPlannerDraft(draft, changed?undefined:context)) return { draft: null, status: 'corrupt', message: messages.corrupt };
      const status = changed ? 'catalog-changed' : 'ready';
      return { draft: structuredClone(draft), status, message: draft.preview&&draft.preview.data.compositionVersion!==2?'작성하던 조건과 선택을 복원했어요. 새 생성 기준으로 초안을 다시 만든 뒤 저장해 주세요.':messages[status] };
    } catch { return { draft: null, status: 'unavailable', message: messages.unavailable }; }
  };
  const write = (draft: AiPlannerDraft, context: AiPlannerDraftContext): AiPlannerDraftWrite => {
    try {
      if (!context.ownerId) return { ok: false, message: '초안 내용을 확인하지 못해 기기에 저장하지 않았어요. 현재 입력과 이전 저장 내용은 유지돼요.' };
      const target = getStorage(), key = aiPlannerDraftKey(context.ownerId), raw = target.getItem(key);
      const previous = parseEnvelope(raw, context.ownerId);
      if (previous.status === 'corrupt' || previous.status === 'unsupported') return { ok: false, message: messages[previous.status] };
      const signature = contextSignature(context);
      const stalePreview=draft.preview&&previous.value?.draft.preview?.requestId===draft.preview.requestId&&previous.value.previewContextSignature!==signature;
      if(!isAiPlannerDraft(draft,stalePreview?undefined:context))return {ok:false,message:'초안 내용을 확인하지 못해 기기에 저장하지 않았어요. 현재 입력과 이전 저장 내용은 유지돼요.'};
      const previewContextSignature = draft.preview
        ? previous.value?.draft.preview?.requestId === draft.preview.requestId ? previous.value.previewContextSignature : signature
        : null;
      const envelope: DraftEnvelope = { schemaVersion: 1, ownerId: context.ownerId, updatedAt: new Date().toISOString(), contextSignature: signature, previewContextSignature, draft };
      const next = JSON.stringify(envelope);
      if (!parseEnvelope(next, context.ownerId).value) return { ok: false, message: '초안을 보관할 수 없는 형식이에요. 이전 저장 내용은 유지돼요.' };
      // A single setItem either replaces the complete valid snapshot or leaves the old one intact.
      target.setItem(key, next);
      return { ok: true, message: '' };
    } catch { return { ok: false, message: messages.unavailable }; }
  };
  const clear = (ownerId: string): AiPlannerDraftWrite => {
    if (!ownerId) return { ok: false, message: '초안의 사용자를 확인하지 못했어요.' };
    const key = aiPlannerDraftKey(ownerId);
    try { getStorage().removeItem(key); return { ok: true, message: '' }; }
    catch {
      // Some environments deny removal separately. An empty marker contains no user's draft content.
      try { getStorage().setItem(key, JSON.stringify({ schemaVersion: 1, ownerId, cleared: true })); return { ok: true, message: '' }; }
      catch { return { ok: false, message: '기기에 남은 초안을 지우지 못했어요. 브라우저 저장소 설정을 확인해 주세요.' }; }
    }
  };
  return { read, write, clear };
}
