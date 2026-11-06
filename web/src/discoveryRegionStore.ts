/** A manually chosen discovery area, separate from places, trips, addresses and GPS. */
export const MY_REGION_OPTIONS = ['서울', '경기', '인천', '강원', '충북', '충남', '대전', '세종', '전북', '전남', '광주', '경북', '경남', '대구', '울산', '부산', '제주'] as const;
export type MyRegionName = typeof MY_REGION_OPTIONS[number];
export interface MyRegionEntry { id: string; region: MyRegionName; district?: string }
export interface MyRegionsState {
  schemaVersion: 1;
  owner: string;
  revision: number;
  regions: MyRegionEntry[];
  activeId: string | null;
}
export type MyRegionsStorage = Pick<Storage, 'getItem' | 'setItem'>;
export interface MyRegionsRead { state: MyRegionsState; status: 'ready' | 'invalid' | 'unavailable'; message: string }
export const MY_REGION_STORAGE_PREFIX = 'spotlog.discovery-regions.v1:';

function regionOwner(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 300 || /[\u0000-\u001f\u007f]/u.test(value)) throw new Error('지역을 저장할 계정을 확인해 주세요.');
  return value.trim();
}
export function myRegionStorageKey(owner: string): string { return MY_REGION_STORAGE_PREFIX + encodeURIComponent(regionOwner(owner)); }
export function emptyMyRegions(owner: string): MyRegionsState { return { schemaVersion: 1, owner: regionOwner(owner), revision: 0, regions: [], activeId: null }; }
const knownKeys = (value: object, allowed: readonly string[]) => Object.keys(value).every(key => allowed.includes(key));
const plainText = (value: unknown, maximum: number): value is string => typeof value === 'string' && value.length > 0 && value.length <= maximum && value === value.trim() && !/[\u0000-\u001f\u007f]/u.test(value);
const areaKey = (entry: MyRegionEntry) => `${entry.region}\n${(entry.district || '').normalize('NFKC').replace(/\s+/gu, ' ').trim()}`;

function validState(value: unknown, owner: string): value is MyRegionsState {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !knownKeys(value, ['schemaVersion', 'owner', 'revision', 'regions', 'activeId'])) return false;
  const state = value as MyRegionsState;
  if (state.schemaVersion !== 1 || state.owner !== owner || !Number.isSafeInteger(state.revision) || state.revision < 0 || !Array.isArray(state.regions) || state.regions.length > 3) return false;
  const ids = new Set<string>(), areas = new Set<string>();
  for (const entry of state.regions) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || !knownKeys(entry, ['id', 'region', 'district']) || !plainText(entry.id, 160)
      || !(MY_REGION_OPTIONS as readonly unknown[]).includes(entry.region) || (entry.district !== undefined && !plainText(entry.district, 40))) return false;
    if (ids.has(entry.id) || areas.has(areaKey(entry))) return false;
    ids.add(entry.id); areas.add(areaKey(entry));
  }
  return state.regions.length === 0 ? state.activeId === null : typeof state.activeId === 'string' && ids.has(state.activeId);
}

/** Invalid, foreign-owner and future-version bytes are never repaired or replaced on read. */
export function readMyRegions(storage: MyRegionsStorage | null, owner: string): MyRegionsRead {
  const state = emptyMyRegions(owner);
  if (!storage) return { state, status: 'unavailable', message: '이 기기에서 지역 설정을 저장할 수 없어요.' };
  let raw: string | null;
  try { raw = storage.getItem(myRegionStorageKey(state.owner)); }
  catch { return { state, status: 'unavailable', message: '지역 설정을 읽을 수 없어요. 기존 자료는 변경하지 않았어요.' }; }
  if (raw === null) return { state, status: 'ready', message: '' };
  try {
    const parsed: unknown = JSON.parse(raw);
    return validState(parsed, state.owner) ? { state: parsed, status: 'ready', message: '' }
      : { state, status: 'invalid', message: '저장한 지역 설정을 읽지 못했어요. 기존 자료는 그대로 보관했어요.' };
  } catch { return { state, status: 'invalid', message: '저장한 지역 설정을 읽지 못했어요. 기존 자료는 그대로 보관했어요.' }; }
}

/** Compare the current revision before writing; no other storage key is read or written. */
export function writeMyRegions(storage: MyRegionsStorage | null, next: MyRegionsState, expectedRevision: number): MyRegionsState {
  const owner = regionOwner(next?.owner);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || expectedRevision >= Number.MAX_SAFE_INTEGER || !validState(next, owner)) throw new Error('지역 설정을 확인해 주세요. 지역은 최대 3개이며 같은 지역을 중복으로 저장할 수 없어요.');
  if (next.revision !== expectedRevision) throw new Error('입력한 지역 설정의 버전이 달라요. 다시 불러온 뒤 저장해 주세요.');
  const current = readMyRegions(storage, owner);
  if (current.status !== 'ready') throw new Error(current.message);
  if (current.state.revision !== expectedRevision) throw new Error('다른 화면에서 지역 설정이 바뀌었어요. 입력 내용은 유지했어요. 다시 불러온 뒤 수정해 주세요.');
  const saved: MyRegionsState = { schemaVersion: 1, owner, revision: expectedRevision + 1, regions: next.regions.map(entry => ({ ...entry })), activeId: next.activeId };
  try { storage!.setItem(myRegionStorageKey(owner), JSON.stringify(saved)); }
  catch { throw new Error('기기 저장 공간이 부족하거나 저장이 차단됐어요. 기존 지역 설정과 입력 내용은 유지했어요.'); }
  return saved;
}
export function activeRegion(state: MyRegionsState): MyRegionEntry | null { return state.regions.find(entry => entry.id === state.activeId) ?? null; }
