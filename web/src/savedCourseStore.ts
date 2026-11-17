export type SavedCourseStorage = Pick<Storage, 'getItem' | 'setItem'>;
type SavedCourseReady = { ids: string[]; status: 'ready'; message: '' };
export type SavedCourseRead = SavedCourseReady | { ids: string[]; status: 'invalid' | 'unavailable'; message: string };

const prefix = 'spotlog.saved-courses.v1:';
const limit = 200;
const maxRawLength = 128_000;
const invalidOwner = '코스를 저장할 계정을 확인해 주세요.';
const invalidData = '저장한 코스를 읽지 못했어요. 기존 자료는 그대로 보관했어요.';

function boundedText(value: unknown, allowEmpty = false): value is string {
  return typeof value === 'string' && (allowEmpty || value.length > 0) && value.length <= 300
    && value === value.trim() && !/[\u0000-\u001f\u007f-\u009f\ud800-\udfff]/u.test(value);
}

/** The empty owner denotes this device's guest scope, separate from every signed-in ID. */
export function savedCourseStorageKey(owner: string): string {
  if (!boundedText(owner, true)) throw new Error(invalidOwner);
  return prefix + (owner ? `account:${encodeURIComponent(owner)}` : 'guest');
}

function ready(ids: string[]): SavedCourseReady { return { ids, status: 'ready', message: '' }; }
function parseIds(raw: string, owner: string): string[] | null {
  if (raw.length > maxRawLength) return null;
  const state = JSON.parse(raw) as { schemaVersion?: unknown; owner?: unknown; ids?: unknown } | null;
  if (!state || typeof state !== 'object' || Array.isArray(state)
    || Object.keys(state).some(key => !['schemaVersion', 'owner', 'ids'].includes(key))
    || state.schemaVersion !== 1 || state.owner !== owner || !Array.isArray(state.ids)
    || state.ids.length > limit || !state.ids.every(id => boundedText(id))
    || new Set(state.ids).size !== state.ids.length) return null;
  return state.ids;
}

/** Resolve display and use against the current public catalogue; persist references only. */
export function readSavedCourses(storage: SavedCourseStorage | null, owner: string): SavedCourseRead {
  let key: string;
  try { key = savedCourseStorageKey(owner); }
  catch { return { ids: [], status: 'unavailable', message: invalidOwner }; }
  if (!storage) return { ids: [], status: 'unavailable', message: '이 기기에서는 코스를 저장할 수 없어요.' };
  let raw: string | null;
  try { raw = storage.getItem(key); }
  catch { return { ids: [], status: 'unavailable', message: '기기의 코스 저장 공간을 읽지 못했어요.' }; }
  if (raw === null) return ready([]);
  try {
    const ids = parseIds(raw, owner);
    if (ids !== null) return ready(ids);
  } catch { /* Leave malformed and future records intact. */ }
  return { ids: [], status: 'invalid', message: invalidData };
}

/** Re-read before changing one ID; explicit intent avoids reversing a stale same-ID tap. */
export function toggleSavedCourse(storage: SavedCourseStorage | null, owner: string, id: string,
  currentlyPublicAllowed: boolean, desiredSaved?: boolean): SavedCourseReady {
  if (!boundedText(id)) throw new Error('저장할 코스를 다시 선택해 주세요.');
  const current = readSavedCourses(storage, owner);
  if (current.status !== 'ready') throw new Error(current.message);
  const has = current.ids.includes(id);
  const next = desiredSaved ?? !has;
  if (next === has) return current;
  if (next && currentlyPublicAllowed !== true) throw new Error('현재 볼 수 있는 코스만 저장할 수 있어요.');
  if (next && current.ids.length >= limit) throw new Error(`코스는 ${limit}개까지 저장할 수 있어요.`);
  const ids = next ? [id, ...current.ids] : current.ids.filter(item => item !== id);
  try { storage!.setItem(savedCourseStorageKey(owner), JSON.stringify({ schemaVersion: 1, owner, ids })); }
  catch { throw new Error('코스 저장 상태를 바꾸지 못했어요. 기존 목록은 그대로 보관했어요.'); }
  return ready(ids);
}
