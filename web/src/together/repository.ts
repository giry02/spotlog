import { createSeedState } from './seed.ts';
import type { Place } from '../data';
import type { TogetherState } from './model.ts';
import { hydrateDiscoveryCatalog } from './discoveryExamples.ts';
import { isChatStickerId } from './chatExpressions.ts';
import { ALLOWED_MESSAGE_REACTIONS } from './chatActions.ts';
import { isPublicActivityIntent } from './publicActivityIntent.ts';
import { isChatEntityReference } from './chatEntities.ts';

export const TOGETHER_STORAGE_PREFIX = 'spotlog.together.local.v1:';
export const togetherStorageKey = (accountId: string) => `${TOGETHER_STORAGE_PREFIX}${encodeURIComponent(accountId || 'guest')}`;
const arrayFields = ['groups', 'members', 'activities', 'messages', 'notices', 'tasks', 'polls', 'posts', 'media', 'invites', 'applications', 'sharedJournals', 'mutedRooms'] as const;
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string');
const textFields = (value: Record<string, unknown>, keys: string[]) => keys.every(key => typeof value[key] === 'string');
export function isTogetherState(value: unknown): value is TogetherState {
  if (!object(value) || value.schemaVersion !== 1 || !arrayFields.every(key => Array.isArray(value[key])) || !object(value.readCursors) || !Object.values(value.readCursors).every(item => typeof item === 'string') || !strings(value.mutedRooms)) return false;
  if (value.discoveryCatalogVersion !== undefined && (!Number.isInteger(value.discoveryCatalogVersion) || Number(value.discoveryCatalogVersion) < 0)) return false;
  const every = (key: string, check: (row: Record<string, unknown>) => boolean) => (value[key] as unknown[]).every(row => object(row) && check(row));
  const reactions = (row: unknown) => object(row) && Object.entries(row).every(([emoji, voters]) => ALLOWED_MESSAGE_REACTIONS.some(value => value === emoji)
    && strings(voters) && voters.length > 0 && voters.every(id => id.trim().length > 0) && new Set(voters).size === voters.length);
  const discovery = (profile: unknown) => object(profile) && strings(profile.topics) && profile.topics.every(topic => ['TRAVEL', 'FOOD', 'CAFE', 'WALK', 'PHOTO', 'OUTDOOR', 'CULTURE', 'FAMILY', 'SOCIAL', 'SPORTS', 'BOOK', 'GAME', 'MUSIC', 'LANGUAGE', 'CRAFT', 'PETS'].includes(topic)) && textFields(profile, ['district', 'welcome', 'joinGuide']) && ['NEIGHBORHOOD', 'DESTINATION'].includes(String(profile.style)) && ['OPEN', 'PAUSED'].includes(String(profile.recruitment)) && (profile.joinMode === undefined || typeof profile.joinMode === 'string' && ['DIRECT', 'APPROVAL'].includes(profile.joinMode));
  const optionalActivityFields = (row: Record<string, unknown>) => (row.kind === undefined || ['MEETUP', 'TRIP'].includes(String(row.kind)))
    && (row.startTime === undefined || typeof row.startTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(row.startTime))
    && (row.capacity === undefined || typeof row.capacity === 'number' && Number.isInteger(row.capacity) && row.capacity > 0 && row.capacity <= 500);
  const publicSnapshot = (snapshot: unknown) => object(snapshot) && textFields(snapshot, ['id', 'groupId', 'title', 'date', 'endDate', 'description'])
    && ['PLANNED', 'COMPLETED', 'CANCELLED'].includes(String(snapshot.status))
    && optionalActivityFields(snapshot)
    && Object.keys(snapshot).every(key => ['id', 'groupId', 'title', 'date', 'endDate', 'description', 'status', 'kind', 'startTime'].includes(key));
  const validSpace = (row: Record<string, unknown>) => row.spaceType === undefined || row.spaceType === 'GROUP'
    || row.spaceType === 'ACTIVITY' && row.visibility === 'PRIVATE' && row.promotionPublished === false
      && (!Array.isArray(row.promotionActivityIds) || row.promotionActivityIds.length === 0)
      && (!Array.isArray(row.promotionActivitySnapshots) || row.promotionActivitySnapshots.length === 0)
      && (value.activities as unknown[]).filter(activity => object(activity) && activity.groupId === row.id).length <= 1;
  const journey = (row: unknown) => object(row) && textFields(row, ['id', 'title', 'region', 'dateRange', 'duration', 'cover', 'summary', 'story', 'author']) && strings(row.tags)
    && ['PLAN', 'JOURNAL', undefined].includes(row.purpose as string | undefined) && ['PUBLIC', 'PRIVATE'].includes(String(row.visibility))
    && Array.isArray(row.days) && row.days.every(day => object(day) && textFields(day, ['date', 'title', 'story']) && typeof day.day === 'number'
      && Array.isArray(day.places) && day.places.every(place => object(place) && textFields(place, ['id', 'name', 'area', 'address', 'image', 'description', 'note', 'duration']) && ['LANDMARK', 'FOOD', 'CAFE', 'STAY', 'SHOP', 'LEISURE'].includes(String(place.kind)))
      && Array.isArray(day.blocks) && day.blocks.every(block => object(block) && typeof block.id === 'string' && ['PLACE', 'TEXT', 'IMAGE'].includes(String(block.type))));
  return every('members', row => textFields(row, ['id', 'name']))
    && every('groups', row => validSpace(row) && textFields(row, ['id', 'name', 'region', 'introduction', 'cover', 'ownerId']) && ['FAMILY', 'FRIENDS', 'HOBBY', 'GUIDE'].includes(String(row.kind)) && ['PRIVATE', 'PUBLIC'].includes(String(row.visibility)) && strings(row.memberIds) && strings(row.managerIds) && typeof row.archived === 'boolean' && typeof row.promotionPublished === 'boolean' && (row.promotionActivityIds === undefined || strings(row.promotionActivityIds)) && (row.interestPlaceIds === undefined || strings(row.interestPlaceIds)) && (row.blockedMemberIds === undefined || strings(row.blockedMemberIds)) && (row.discovery === undefined || discovery(row.discovery)) && (row.createdAt === undefined || typeof row.createdAt === 'string' && Number.isFinite(Date.parse(row.createdAt))) && (row.sourceKind === undefined || ['EXAMPLE', 'LOCAL', 'SERVER'].includes(String(row.sourceKind))) && (row.promotionActivitySnapshots === undefined || Array.isArray(row.promotionActivitySnapshots) && row.promotionActivitySnapshots.every(publicSnapshot)))
    && every('activities', row => textFields(row, ['id', 'groupId', 'title', 'date', 'endDate', 'meetingPoint', 'description', 'leadId']) && ['PLANNED', 'CANCELLED', 'COMPLETED'].includes(String(row.status)) && optionalActivityFields(row) && strings(row.editorIds) && strings(row.arrivedIds) && object(row.participants) && Object.values(row.participants).every(item => ['JOINED', 'MAYBE', 'DECLINED'].includes(String(item))) && typeof row.revision === 'number' && Number.isInteger(row.revision) && row.revision > 0 && (row.journey === undefined || journey(row.journey)))
    && every('messages', row => textFields(row, ['id', 'roomId', 'authorId', 'body', 'createdAt']) && (row.deleted === undefined || typeof row.deleted === 'boolean') && (row.stickerId === undefined || isChatStickerId(row.stickerId))
      && (row.replyToMessageId === undefined || typeof row.replyToMessageId === 'string' && row.replyToMessageId.trim().length > 0)
      && (row.entity === undefined || isChatEntityReference(row.entity))
      && (row.reactions === undefined || reactions(row.reactions)))
    && every('notices', row => textFields(row, ['id', 'groupId', 'title', 'body', 'createdAt']))
    && every('tasks', row => textFields(row, ['id', 'groupId', 'title']) && typeof row.completed === 'boolean' && (row.sourceMessageIds === undefined || strings(row.sourceMessageIds)))
    && every('polls', row => textFields(row, ['id', 'groupId', 'question']) && typeof row.closed === 'boolean' && Array.isArray(row.options) && row.options.every(option => object(option) && textFields(option, ['id', 'label']) && strings(option.voterIds)))
    && every('posts', row => textFields(row, ['id', 'groupId', 'authorId', 'title', 'body', 'createdAt']) && ['NOTICE', 'REVIEW', 'QUESTION', 'FREE'].includes(String(row.category)) && strings(row.likes) && Array.isArray(row.comments) && row.comments.every(comment => object(comment) && textFields(comment, ['id', 'authorId', 'body', 'createdAt'])))
    && every('media', row => textFields(row, ['id', 'groupId', 'authorId', 'url', 'caption', 'createdAt']) && ['PHOTO', 'VIDEO'].includes(String(row.kind)))
    && every('invites', row => textFields(row, ['id', 'intentId', 'senderId', 'name', 'region', 'expiresAt']) && ['FAMILY', 'FRIENDS', 'HOBBY', 'GUIDE'].includes(String(row.kind)) && strings(row.acceptedBy) && typeof row.revoked === 'boolean' && (row.sourceJourney === undefined || journey(row.sourceJourney)))
    && every('applications', row => textFields(row, ['id', 'groupId', 'userId']) && ['PENDING', 'APPROVED', 'DECLINED'].includes(String(row.status)) && ['message', 'createdAt', 'decidedAt', 'decidedBy'].every(key => row[key] === undefined || typeof row[key] === 'string') && (row.joinMode === undefined || typeof row.joinMode === 'string' && ['DIRECT', 'APPROVAL'].includes(row.joinMode)) && (row.publicActivityIntent === undefined || isPublicActivityIntent(row.publicActivityIntent) && row.publicActivityIntent.groupId === row.groupId))
    && every('sharedJournals', row => textFields(row, ['id', 'groupId', 'authorId']) && (row.sourceJourneyId === undefined || typeof row.sourceJourneyId === 'string') && journey(row.journey))
    && (value.reports === undefined || (Array.isArray(value.reports) && value.reports.every(row => object(row) && textFields(row, ['id', 'targetId', 'groupId', 'reporterId', 'reason', 'createdAt']) && ['MESSAGE', 'POST', 'COMMENT', 'MEDIA'].includes(String(row.targetType)))));
}
function frozen<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(frozen); Object.freeze(value); }
  return value;
}
export interface TogetherRepository {
  getSnapshot(): TogetherState;
  subscribe(listener: () => void): () => void;
  update(recipe: (draft: TogetherState) => void): boolean;
  getError(): string | null;
}
/** Only this account's isolated namespace is accessed. Failed writes never replace the last good snapshot. */
export function createTogetherRepository(accountId: string, displayName: string, places: Place[], storage?: Storage): TogetherRepository {
  const key = togetherStorageKey(accountId);
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach(listener => { try { listener(); } catch { /* One subscriber must not turn a successful save into failure. */ } });
  let error: string | null = null;
  let unavailable = false;
  let lastRaw: string | null = null;
  let selectedStorage: Storage | undefined = storage;
  let state = frozen(createSeedState(accountId, displayName, places));
  try {
    selectedStorage ??= typeof window === 'undefined' ? undefined : window.localStorage;
    if (!selectedStorage) throw new Error('storage-unavailable');
    lastRaw = selectedStorage.getItem(key);
    if (lastRaw !== null) {
      const loaded: unknown = JSON.parse(lastRaw);
      if (!isTogetherState(loaded)) throw new Error('invalid-data');
      state = frozen(loaded);
      const hydrated = hydrateDiscoveryCatalog(loaded, places);
      if (hydrated !== loaded) {
        try {
          const nextRaw = JSON.stringify(hydrated);
          selectedStorage.setItem(key, nextRaw);
          state = frozen(hydrated); lastRaw = nextRaw;
        } catch {
          error = '새 모임 예시를 추가하지 못했어요. 기존 모임 자료는 그대로 유지돼요.';
        }
      }
    }
  } catch {
    unavailable = true;
    error = '이 기기의 모임 자료를 읽지 못했어요. 기존 자료를 보존하고 있어요.';
  }
  return {
    getSnapshot: () => state,
    getError: () => error,
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    update: recipe => {
      if (unavailable || !selectedStorage) { error = '모임 자료를 저장할 수 없어요. 기존 자료를 보존하고 있어요.'; return false; }
      let applyingRecipe = false;
      try {
        const currentRaw = selectedStorage.getItem(key);
        if (currentRaw !== lastRaw) {
          const current: unknown = currentRaw === null ? null : JSON.parse(currentRaw);
          if (!isTogetherState(current)) throw new Error('changed-invalid-data');
          state = frozen(current); lastRaw = currentRaw;
          error = '다른 창에서 자료가 변경됐어요. 최신 내용을 확인하고 다시 시도해 주세요.';
          notify();
          return false;
        }
        const draft = structuredClone(state);
        applyingRecipe = true;
        recipe(draft);
        applyingRecipe = false;
        if (!isTogetherState(draft)) throw new Error('invalid-update');
        const raw = JSON.stringify(draft);
        selectedStorage.setItem(key, raw);
        state = frozen(draft); lastRaw = raw; error = null;
        notify();
        return true;
      } catch (reason) {
        error = applyingRecipe && reason instanceof Error && reason.message.length <= 300 ? reason.message : '저장하지 못했어요. 이전 자료는 그대로 유지돼요. 저장 공간과 입력 내용을 확인해 주세요.';
        return false;
      }
    }
  };
}
