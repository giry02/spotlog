import type { GroupTopic, TogetherState } from './model';
import { selectGroupDiscovery, type GroupDiscoveryFilters } from './groupDiscoveryModel.ts';
import { koreaDay, shiftDay, topicOptions, type PublicDiscoveryActivity } from './discovery.ts';
import { validDiscoveryCalendarDate } from './groupDiscoveryCalendar.ts';
import { getGroupSubtopic } from './groupTaxonomy.ts';
import { groupLocalityIssues } from './groupRegions.ts';

export const DISCOVERY_PICKS_CHANGED = 'spotlog:discovery-picks-changed';
export type PicksStorage = Pick<Storage, 'getItem' | 'setItem'>;
export type DiscoveryWeekday = 'ALL' | 'WEEKEND' | 'WEEKDAY' | '0' | '1' | '2' | '3' | '4' | '5' | '6';
export type DiscoveryTimeBand = 'ALL' | 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT';
export interface DiscoveryConditionInput {
  name: string; region: string; district: string; topic: GroupTopic | ''; subtopic: string; query: string;
  neighborhood?: string;
  weekday: DiscoveryWeekday; timeBand: DiscoveryTimeBand;
}
export interface SavedDiscoveryCondition extends DiscoveryConditionInput { id: string; known: string[] }
export interface SavedAppointmentReference { groupId: string; activityId: string }
export interface DiscoveryPicksState { schemaVersion: 1; owner: string; conditions: SavedDiscoveryCondition[]; appointments: SavedAppointmentReference[] }
export type DiscoveryPicksRead = { state: DiscoveryPicksState; status: 'ready' | 'invalid' | 'unavailable'; message: string };
export type PublicDiscoveryEvent = ReturnType<typeof selectGroupDiscovery>['events'][number];
const conditionLimit = 12, appointmentLimit = 200, seenLimit = 300;
const topics = new Set(topicOptions.map(item => item.id));
const weekdays = new Set(['ALL', 'WEEKEND', 'WEEKDAY', '0', '1', '2', '3', '4', '5', '6']);
const timeBands = new Set(['ALL', 'MORNING', 'AFTERNOON', 'EVENING', 'NIGHT']);
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, max: number, empty = false): value is string => typeof value === 'string' && value === value.trim()
  && value.length <= max && (empty || value.length > 0) && !/[\u0000-\u001f\u007f-\u009f]/u.test(value);
const exactKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key));
const conditionKeys = ['name', 'region', 'district', 'topic', 'subtopic', 'query', 'weekday', 'timeBand'];
const localityKeys = (value: Record<string, unknown>) => value.neighborhood === undefined ? conditionKeys : [...conditionKeys, 'neighborhood'];

export function discoveryPicksStorageKey(owner: string): string {
  if (!text(owner, 300, true)) throw new Error('현재 계정을 다시 확인해 주세요.');
  try { return 'spotlog.discovery-picks.v1:' + (owner ? `account:${encodeURIComponent(owner)}` : 'guest'); }
  catch { throw new Error('현재 계정을 다시 확인해 주세요.'); }
}
export function emptyDiscoveryPicks(owner: string): DiscoveryPicksState {
  discoveryPicksStorageKey(owner);
  return { schemaVersion: 1, owner, conditions: [], appointments: [] };
}

function validCondition(value: unknown): value is DiscoveryConditionInput {
  if (!object(value) || !exactKeys(value, localityKeys(value)) || !text(value.name, 50) || !text(value.region, 80, true)
    || !text(value.district, 80, true) || !text(value.query, 120, true) || !text(value.subtopic, 100, true)
    || value.neighborhood !== undefined && !text(value.neighborhood, 80, true)
    || value.topic !== '' && !topics.has(value.topic as GroupTopic) || typeof value.weekday !== 'string' || !weekdays.has(value.weekday)
    || typeof value.timeBand !== 'string' || !timeBands.has(value.timeBand)) return false;
  const child = value.subtopic ? getGroupSubtopic(value.subtopic) : undefined;
  return !groupLocalityIssues({ region: value.region, district: value.district, ...(value.neighborhood !== undefined ? { neighborhood: value.neighborhood as string } : {}) }).length && (!value.subtopic || Boolean(child && value.topic === child.parent));
}
function validState(value: unknown, owner: string): value is DiscoveryPicksState {
  if (!object(value) || !exactKeys(value, ['schemaVersion', 'owner', 'conditions', 'appointments']) || value.schemaVersion !== 1 || value.owner !== owner
    || !Array.isArray(value.conditions) || value.conditions.length > conditionLimit || !Array.isArray(value.appointments) || value.appointments.length > appointmentLimit) return false;
  const ids = new Set<string>();
  for (const condition of value.conditions) {
    if (!object(condition) || !exactKeys(condition, [...localityKeys(condition), 'id', 'known']) || !text(condition.id, 180) || ids.has(condition.id)
      || !Array.isArray(condition.known) || condition.known.length > seenLimit || !condition.known.every(key => typeof key === 'string' && /^[a-f0-9]{16}$/.test(key))
      || new Set(condition.known).size !== condition.known.length) return false;
    const { id, known, ...input } = condition;
    if (!validCondition(input)) return false;
    ids.add(id);
  }
  const refs = new Set<string>();
  for (const reference of value.appointments) {
    if (!object(reference) || !exactKeys(reference, ['groupId', 'activityId']) || !text(reference.groupId, 300) || !text(reference.activityId, 300)) return false;
    const key = JSON.stringify([reference.groupId, reference.activityId]);
    if (refs.has(key)) return false;
    refs.add(key);
  }
  return true;
}
export function readDiscoveryPicks(storage: PicksStorage | null, owner: string): DiscoveryPicksRead {
  let state: DiscoveryPicksState;
  try { state = emptyDiscoveryPicks(owner); }
  catch { return { state: emptyDiscoveryPicks(''), status: 'unavailable', message: '현재 계정을 다시 확인해 주세요.' }; }
  if (!storage) return { state, status: 'unavailable', message: '이 기기에서 관심 약속을 저장할 수 없어요.' };
  let raw: string | null;
  try { raw = storage.getItem(discoveryPicksStorageKey(owner)); }
  catch { return { state, status: 'unavailable', message: '저장한 관심 약속을 읽지 못했어요.' }; }
  if (raw === null) return { state, status: 'ready', message: '' };
  try {
    if (raw.length <= 200_000) {
      const value: unknown = JSON.parse(raw);
      if (validState(value, owner)) return { state: value, status: 'ready', message: '' };
    }
  } catch { /* Keep unreadable and future versions for recovery. */ }
  return { state, status: 'invalid', message: '저장 자료를 읽지 못했어요. 기존 자료는 보관했어요.' };
}
function write(storage: PicksStorage | null, owner: string, update: (state: DiscoveryPicksState) => void): DiscoveryPicksState {
  const current = readDiscoveryPicks(storage, owner);
  if (current.status !== 'ready') throw new Error(current.message);
  const next = structuredClone(current.state);
  update(next);
  if (!validState(next, owner)) throw new Error('저장할 내용을 다시 확인해 주세요.');
  try { storage!.setItem(discoveryPicksStorageKey(owner), JSON.stringify(next)); }
  catch { throw new Error('저장하지 못했어요. 입력을 유지했으니 다시 시도해 주세요.'); }
  return next;
}

function matchesTime(activity: PublicDiscoveryActivity, band: DiscoveryTimeBand) {
  if (band === 'ALL') return true;
  if (!activity.startTime || !/^([01]\d|2[0-3]):[0-5]\d$/.test(activity.startTime)) return false;
  const hour = Number(activity.startTime.slice(0, 2));
  return band === 'MORNING' ? hour >= 6 && hour < 12 : band === 'AFTERNOON' ? hour >= 12 && hour < 18 : band === 'EVENING' ? hour >= 18 : hour < 6;
}
function matchesWeekday(activity: PublicDiscoveryActivity, weekday: DiscoveryWeekday, at: Date) {
  if (weekday === 'ALL') return true;
  if (!validDiscoveryCalendarDate(activity.date)) return false;
  const end = validDiscoveryCalendarDate(activity.endDate) && activity.endDate >= activity.date ? activity.endDate : activity.date;
  let day = activity.date < koreaDay(at) ? koreaDay(at) : activity.date;
  for (let index = 0; index < 7 && day <= end; index++, day = shiftDay(day, 1)) {
    const actual = new Date(`${day}T12:00:00+09:00`).getUTCDay();
    if (weekday === 'WEEKEND' ? actual === 0 || actual === 6 : weekday === 'WEEKDAY' ? actual > 0 && actual < 6 : actual === Number(weekday)) return true;
  }
  return false;
}
export function selectConditionMatches(state: TogetherState, owner: string, condition: DiscoveryConditionInput, at = new Date()): PublicDiscoveryEvent[] {
  const clean = { ...Object.fromEntries(conditionKeys.map(key => [key, condition[key as keyof DiscoveryConditionInput]])), ...(condition.neighborhood !== undefined ? { neighborhood: condition.neighborhood } : {}) };
  if (!validCondition(clean)) return [];
  return selectGroupDiscovery(state, { region: condition.region, district: condition.district, ...(condition.neighborhood !== undefined ? { neighborhood: condition.neighborhood } : {}), topic: condition.topic || undefined,
    subtopic: condition.subtopic || undefined, query: condition.query, sort: 'SOONEST', view: 'MEETUPS' }, owner, at).events
    .filter(item => matchesWeekday(item.activity, condition.weekday, at) && matchesTime(item.activity, condition.timeBand));
}
/** A short fingerprint of approved public facts detects a new or changed announcement without copying its text into storage. */
function fingerprint({ group, activity }: PublicDiscoveryEvent): string {
  const bytes = new TextEncoder().encode(JSON.stringify([group.id, group.region, group.district, group.topics, group.subtopics, activity, ...(group.neighborhood !== undefined ? [group.neighborhood] : [])]));
  let hash = 14695981039346656037n;
  for (const byte of bytes) hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 1099511628211n);
  return hash.toString(16).padStart(16, '0');
}
function knownMatches(items: PublicDiscoveryEvent[]): string[] {
  if (items.length > seenLimit) throw new Error('맞는 약속이 많아요. 지역이나 관심사를 좁혀 주세요.');
  return items.map(fingerprint);
}
export function saveDiscoveryCondition(storage: PicksStorage | null, owner: string, state: TogetherState, input: DiscoveryConditionInput, at = new Date()): DiscoveryPicksState {
  if (!validCondition(input)) throw new Error('조건 이름과 지역·관심사·시간을 다시 확인해 주세요.');
  const known = knownMatches(selectConditionMatches(state, owner, input, at));
  return write(storage, owner, next => {
    if (next.conditions.length >= conditionLimit) throw new Error(`발견 조건은 ${conditionLimit}개까지 저장할 수 있어요.`);
    next.conditions.unshift({ ...input, id: crypto.randomUUID(), known });
  });
}
export function removeDiscoveryCondition(storage: PicksStorage | null, owner: string, id: string): DiscoveryPicksState {
  return write(storage, owner, state => { state.conditions = state.conditions.filter(item => item.id !== id); });
}
export function selectNewDiscoveryMatches(state: TogetherState, owner: string, condition: SavedDiscoveryCondition, at = new Date()) {
  const known = new Set(condition.known);
  const { id, known: _known, ...input } = condition;
  return selectConditionMatches(state, owner, input, at).filter(item => !known.has(fingerprint(item)));
}
export function acknowledgeDiscoveryMatches(storage: PicksStorage | null, owner: string, state: TogetherState, id: string, at = new Date()): DiscoveryPicksState {
  return write(storage, owner, next => {
    const condition = next.conditions.find(item => item.id === id);
    if (!condition) throw new Error('지금 저장한 발견 조건을 다시 선택해 주세요.');
    const { id: _id, known: _known, ...input } = condition;
    condition.known = knownMatches(selectConditionMatches(state, owner, input, at));
  });
}
export function toggleSavedPublicAppointment(storage: PicksStorage | null, owner: string, state: TogetherState, reference: SavedAppointmentReference, desiredSaved: boolean, at = new Date()): DiscoveryPicksState {
  return write(storage, owner, next => {
    const same = (item: SavedAppointmentReference) => item.groupId === reference.groupId && item.activityId === reference.activityId;
    if (!desiredSaved) { next.appointments = next.appointments.filter(item => !same(item)); return; }
    if (next.appointments.some(same)) return;
    if (!selectGroupDiscovery(state, {}, owner, at).events.some(item => item.group.id === reference.groupId && item.activity.id === reference.activityId)) throw new Error('지금 공개된 약속만 저장할 수 있어요.');
    if (next.appointments.length >= appointmentLimit) throw new Error(`관심 약속은 ${appointmentLimit}개까지 저장할 수 있어요.`);
    next.appointments.unshift({ groupId: reference.groupId, activityId: reference.activityId });
  });
}
export function selectSavedPublicAppointments(state: TogetherState, owner: string, references: readonly SavedAppointmentReference[], at = new Date()) {
  const events = selectGroupDiscovery(state, {}, owner, at).events;
  return references.map(reference => ({ reference, event: events.find(item => item.group.id === reference.groupId && item.activity.id === reference.activityId) }));
}
export function conditionDiscoveryFilters(condition: DiscoveryConditionInput): GroupDiscoveryFilters {
  return { region: condition.region, district: condition.district, ...(condition.neighborhood !== undefined ? { neighborhood: condition.neighborhood } : {}), topic: condition.topic || undefined, subtopic: condition.subtopic || undefined,
    query: condition.query, view: 'MEETUPS', section: 'MEETUPS', dateFilter: 'ALL', useMyRegion: false };
}
