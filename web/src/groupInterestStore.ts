import type { GroupTopic } from './together/model';
import { topicOptions } from './together/discovery.ts';
import { getGroupSubtopic, MAX_GROUP_SUBTOPICS } from './together/groupTaxonomy.ts';

export const GROUP_INTEREST_STORAGE_PREFIX = 'spotlog.group-interests.v1:';
export const GROUP_INTERESTS_CHANGED_EVENT = 'spotlog:group-interests-changed';
export const MAX_SAVED_GROUP_TOPICS = 16;
export const MAX_SAVED_GROUP_SUBTOPICS = MAX_GROUP_SUBTOPICS;
export interface GroupInterestSelection { topics: GroupTopic[]; subtopics: string[] }
export interface GroupInterestsState extends GroupInterestSelection { schemaVersion: 1; owner: string; revision: number }
export type GroupInterestsStorage = Pick<Storage, 'getItem' | 'setItem'>;
export interface GroupInterestsRead { state: GroupInterestsState; status: 'ready' | 'invalid' | 'unavailable'; message: string }

function ownerKey(ownerId: string): string {
  if (typeof ownerId !== 'string' || ownerId !== ownerId.trim() || ownerId.length > 300 || /[\u0000-\u001f\u007f]/u.test(ownerId)) throw new Error('관심사를 저장할 계정을 확인해 주세요.');
  try { return ownerId ? `account:${encodeURIComponent(ownerId)}` : 'guest'; } catch { throw new Error('관심사를 저장할 계정을 확인해 주세요.'); }
}
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value)));
const keys = (value: object, allowed: string[]) => Object.keys(value).every(key => allowed.includes(key));
export function groupInterestStorageKey(ownerId: string): string { return GROUP_INTEREST_STORAGE_PREFIX + ownerKey(ownerId); }
export function emptyGroupInterests(ownerId: string): GroupInterestsState { ownerKey(ownerId); return { schemaVersion: 1, owner: ownerId, revision: 0, topics: [], subtopics: [] }; }

export function isGroupInterestSelection(value: unknown): value is GroupInterestSelection {
  if (!record(value) || !keys(value, ['topics', 'subtopics']) || !Array.isArray(value.topics) || !Array.isArray(value.subtopics)
    || value.topics.length > MAX_SAVED_GROUP_TOPICS || value.subtopics.length > MAX_SAVED_GROUP_SUBTOPICS
    || new Set(value.topics).size !== value.topics.length || new Set(value.subtopics).size !== value.subtopics.length) return false;
  const topics = value.topics;
  return topics.every(id => topicOptions.some(topic => topic.id === id))
    && value.subtopics.every(id => typeof id === 'string' && Boolean(getGroupSubtopic(id)) && topics.includes(getGroupSubtopic(id)!.parent));
}
export function isGroupInterestsState(value: unknown, ownerId: string): value is GroupInterestsState {
  return record(value) && keys(value, ['schemaVersion', 'owner', 'revision', 'topics', 'subtopics']) && value.schemaVersion === 1 && value.owner === ownerId
    && Number.isSafeInteger(value.revision) && Number(value.revision) >= 0 && isGroupInterestSelection({ topics: value.topics, subtopics: value.subtopics });
}

/** Reads only the current account/guest key. Invalid and foreign-owner bytes are retained without a repair write. */
export function readGroupInterests(storage: GroupInterestsStorage | null, ownerId: string): GroupInterestsRead {
  const state = emptyGroupInterests(ownerId);
  if (!storage) return { state, status: 'unavailable', message: '이 기기에서 관심사 설정을 저장할 수 없어요.' };
  let raw: string | null;
  try { raw = storage.getItem(groupInterestStorageKey(ownerId)); } catch { return { state, status: 'unavailable', message: '관심사 설정을 읽지 못했어요. 기존 설정은 보존했어요.' }; }
  if (raw === null) return { state, status: 'ready', message: '' };
  if (raw.length > 12000) return { state, status: 'invalid', message: '저장한 관심사 형식을 확인하지 못했어요. 기존 설정은 보존했어요.' };
  try { const parsed: unknown = JSON.parse(raw); return isGroupInterestsState(parsed, ownerId) ? { state: parsed, status: 'ready', message: '' }
    : { state, status: 'invalid', message: '저장한 관심사를 읽지 못했어요. 기존 설정은 보존했어요.' }; }
  catch { return { state, status: 'invalid', message: '저장한 관심사를 읽지 못했어요. 기존 설정은 보존했어요.' }; }
}

/** Explicit, bounded preference write; it never changes discovery filters, membership or another account's key. */
export function writeGroupInterests(storage: GroupInterestsStorage | null, ownerId: string, selection: GroupInterestSelection, expectedRevision: number): GroupInterestsState {
  const key = groupInterestStorageKey(ownerId);
  if (!isGroupInterestSelection(selection) || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || expectedRevision >= Number.MAX_SAFE_INTEGER) throw new Error('관심사 선택을 확인해 주세요. 분야는 16개, 세부 활동은 32개까지 저장할 수 있어요.');
  const current = readGroupInterests(storage, ownerId);
  if (current.status !== 'ready') throw new Error(current.message);
  if (current.state.revision !== expectedRevision) throw new Error('다른 화면에서 관심사가 바뀌었어요. 입력 내용은 유지했어요. 다시 불러온 뒤 저장해 주세요.');
  const saved: GroupInterestsState = { schemaVersion: 1, owner: ownerId, revision: expectedRevision + 1, topics: [...selection.topics], subtopics: [...selection.subtopics] };
  try { storage!.setItem(key, JSON.stringify(saved)); } catch { throw new Error('관심사를 저장하지 못했어요. 기존 설정과 선택한 내용은 유지했어요.'); }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(GROUP_INTERESTS_CHANGED_EVENT, { detail: { ownerId } }));
  return saved;
}

/** Each parent is an OR choice. Explicit child choices narrow that parent, without inferring legacy child tags. */
export function matchesSavedGroupInterests(group: { topics: readonly GroupTopic[]; subtopics?: readonly string[] }, selection: GroupInterestSelection): boolean {
  if (!isGroupInterestSelection(selection) || !selection.topics.length) return false;
  return selection.topics.some(topic => {
    if (!group.topics.includes(topic)) return false;
    const children = selection.subtopics.filter(id => getGroupSubtopic(id)?.parent === topic);
    return !children.length || children.some(id => group.subtopics?.includes(id));
  });
}
