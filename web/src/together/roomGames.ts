import type { TogetherState } from './model.ts';
import { koreaDay } from './discovery.ts';
import type { RoomGameBar, RoomGameInput, RoomGameMember, RoomGameOption, RoomGameScope, TogetherGame } from './gameTypes.ts';
export type { GameCreateInput, RoomGameInput, RoomGameScope, TogetherGame } from './gameTypes.ts';

type GameState = TogetherState & { games?: TogetherGame[] };
export type GameRandomUint32 = () => number;
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const text = (value: unknown, max = 200): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const gameId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9:_-]{0,199}$/.test(value);
const exactKeys = (row: Record<string, unknown>, keys: string[]) => Object.keys(row).every(key => keys.includes(key));
const unique = (values: string[]) => new Set(values).size === values.length;
const key = (value: string) => value.normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/\s+/g, ' ').trim();
const dateValid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00+09:00`)) && koreaDay(new Date(`${value}T12:00:00+09:00`)) === value;
const scopeEqual = (a: RoomGameScope, b: RoomGameScope) => a.groupId === b.groupId && (a.activityId || undefined) === (b.activityId || undefined);

export function getRoomGameContext(state: GameState, actorId: string, scope: RoomGameScope, at = new Date()) {
  if (!Number.isFinite(at.getTime())) throw new Error('기준 시간을 다시 확인해 주세요.');
  const group = state.groups.find(item => item.id === scope.groupId);
  if (!group || !actorId || !state.members.some(member => member.id === actorId) || !group.memberIds.includes(actorId) || group.blockedMemberIds?.includes(actorId)) throw new Error('현재 모임원만 이 방의 놀이를 확인할 수 있어요.');
  const activity = scope.activityId ? state.activities.find(item => item.id === scope.activityId && item.groupId === group.id) : undefined;
  if (scope.activityId && !activity || group.spaceType === 'ACTIVITY' && !activity) throw new Error('놀이가 속한 약속을 다시 확인해 주세요.');
  const lastDate = activity && (activity.endDate || activity.date);
  const readOnlyReason = group.archived ? '보관한 모임의 결과는 읽기만 가능해요.'
    : activity && activity.status !== 'PLANNED' ? '취소하거나 마친 약속의 결과는 읽기만 가능해요.'
    : lastDate && (!dateValid(lastDate) || lastDate < koreaDay(at)) ? '지난 약속의 결과는 읽기만 가능해요.' : '';
  const members: RoomGameMember[] = group.memberIds.flatMap(id => {
    const member = state.members.find(item => item.id === id);
    return member && !group.blockedMemberIds?.includes(id) ? [{ id, name: member.name.trim().slice(0, 100) || '모임원' }] : [];
  });
  return { group, activity, members, canWrite: !readOnlyReason, readOnlyReason };
}

/** Rejection sampling avoids modulo bias for lengths that do not divide 2^32. */
export function uniformGameIndex(length: number, random: GameRandomUint32 = secureUint32): number {
  if (!Number.isInteger(length) || length < 2 || length > 12) throw new Error('선택 항목은 2~12개로 정해 주세요.');
  const limit = Math.floor(0x100000000 / length) * length;
  for (let attempt = 0; attempt < 1024; attempt++) {
    const value = random();
    if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) throw new Error('추첨 난수 값을 확인하지 못했어요.');
    if (value < limit) return value % length;
  }
  throw new Error('추첨을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.');
}
function secureUint32(): number {
  if (!globalThis.crypto?.getRandomValues) throw new Error('이 환경에서는 안전한 추첨을 사용할 수 없어요.');
  return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
}
function newGameId(): string {
  if (!globalThis.crypto?.randomUUID) throw new Error('새 놀이 번호를 만들지 못했어요.');
  return `room-game-${globalThis.crypto.randomUUID()}`;
}
function normalizedOptions(input: string[] | undefined): RoomGameOption[] {
  if (!Array.isArray(input) || input.length < 2 || input.length > 12 || input.some(value => !text(value, 80))) throw new Error('항목을 2~12개, 각각 80자 안으로 적어 주세요.');
  const labels = input.map(value => value.trim().replace(/\s+/g, ' '));
  if (!unique(labels.map(key))) throw new Error('같은 항목이 중복되어 있어요. 서로 다르게 적어 주세요.');
  return labels.map((label, index) => ({ id: `option-${index + 1}`, label }));
}
function normalizedInput(state: GameState, actorId: string, scope: RoomGameScope, input: RoomGameInput, at: Date) {
  const context = getRoomGameContext(state, actorId, scope, at);
  if (!context.canWrite) throw new Error(context.readOnlyReason);
  if (!gameId(input.id) || !['WHEEL', 'DRAW', 'LADDER'].includes(input.type) || !text(input.title, 100)) throw new Error('놀이 종류와 제목을 다시 확인해 주세요.');
  const ids = input.memberIds ?? [];
  if (!Array.isArray(ids) || !ids.every(id => text(id)) || !unique(ids)) throw new Error('참여자를 중복 없이 다시 골라 주세요.');
  const source = ids.length ? 'MEMBERS' as const : 'OPTIONS' as const;
  if (source === 'MEMBERS' && (ids.length < 2 || ids.length > 12)) throw new Error('함께할 모임원을 2~12명 골라 주세요.');
  if (input.type !== 'WHEEL' && source !== 'MEMBERS') throw new Error('함께할 모임원을 먼저 골라 주세요.');
  const members = ids.map(id => {
    const member = context.members.find(item => item.id === id);
    if (!member) throw new Error('선택한 모임원의 가입 상태가 바뀌었어요. 참여자를 다시 확인해 주세요.');
    return { ...member };
  });
  let options: RoomGameOption[] = [];
  if (input.type === 'DRAW') {
    if (input.options?.length) throw new Error('당첨 뽑기는 선택한 모임원 중 한 명을 뽑아요.');
  } else if (input.type === 'WHEEL' && source === 'MEMBERS') {
    if (input.options?.length) throw new Error('돌림판의 직접 항목과 모임원 선택 중 하나만 이용해 주세요.');
    options = members.map((member, index) => ({ id: `option-${index + 1}`, label: member.name }));
  } else options = normalizedOptions(input.options);
  if (input.type === 'LADDER' && options.length !== members.length) throw new Error('준비 역할은 참여자 수와 같게 적어 주세요.');
  return { context, source, title: input.title.trim(), members, options };
}

function ladderResult(members: RoomGameMember[], options: RoomGameOption[], random: GameRandomUint32) {
  const shuffled = options.map((_, index) => index);
  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = uniformGameIndex(index + 1, random);
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  const target = shuffled.map((_, bottom) => shuffled.indexOf(bottom));
  const wires = members.map((_, index) => index);
  const bars: RoomGameBar[] = [];
  for (let position = 0; position < target.length; position++) {
    let found = wires.indexOf(target[position]);
    while (found > position) {
      bars.push({ left: found - 1, level: bars.length });
      [wires[found - 1], wires[found]] = [wires[found], wires[found - 1]];
      found--;
    }
  }
  // Identity is an equally valid draw. Cancelled swap pairs make that route a
  // visible ladder without changing its assignment or consuming extra entropy.
  if (!bars.length) for (let left = 0; left < members.length - 1; left++) {
    bars.push({ left, level: bars.length }, { left, level: bars.length + 1 });
  }
  return { assignments: members.map((member, index) => ({ memberId: member.id, optionId: options[shuffled[index]].id })), bars };
}

function createRun(state: GameState, actorId: string, scope: RoomGameScope, input: RoomGameInput, at: Date, random: GameRandomUint32, previous?: TogetherGame): TogetherGame {
  const values = normalizedInput(state, actorId, scope, input, at);
  const base = { version: 1 as const, id: input.id, groupId: scope.groupId, ...(scope.activityId ? { activityId: scope.activityId } : {}),
    title: values.title, source: values.source, createdBy: actorId, createdAt: at.toISOString(), round: previous ? previous.round + 1 : 1,
    ...(previous ? { previousGameId: previous.id } : {}), members: values.members, options: values.options };
  const duplicate = state.games?.find(game => game.id === input.id);
  if (duplicate) {
    const sameMembers = duplicate.members.map(item => item.id).join('\0') === base.members.map(item => item.id).join('\0');
    const sameOptions = values.source === 'MEMBERS' && input.type === 'WHEEL' || JSON.stringify(duplicate.options) === JSON.stringify(base.options);
    if (isTogetherGame(duplicate) && scopeEqual(duplicate, scope) && duplicate.createdBy === actorId && duplicate.type === input.type && duplicate.title === base.title
      && duplicate.source === base.source && sameMembers && sameOptions && duplicate.previousGameId === base.previousGameId && duplicate.round === base.round) return structuredClone(duplicate);
    throw new Error('이미 저장한 놀이 번호예요. 새 놀이로 다시 만들어 주세요.');
  }
  let game: TogetherGame;
  if (input.type === 'WHEEL') game = { ...base, type: 'WHEEL', result: { optionId: values.options[uniformGameIndex(values.options.length, random)].id } };
  else if (input.type === 'DRAW') game = { ...base, type: 'DRAW', result: { memberId: values.members[uniformGameIndex(values.members.length, random)].id } };
  else game = { ...base, type: 'LADDER', result: ladderResult(values.members, values.options, random) };
  if (!isTogetherGame(game)) throw new Error('놀이 결과를 확인하지 못했어요. 입력을 다시 확인해 주세요.');
  state.games = [...(state.games ?? []), game];
  return structuredClone(game);
}

export function createRoomGame(state: GameState, actorId: string, scope: RoomGameScope, input: RoomGameInput, at = new Date(), random: GameRandomUint32 = secureUint32): TogetherGame {
  return createRun(state, actorId, scope, input, at, random);
}
export function rerunRoomGame(state: GameState, actorId: string, id: string, at = new Date(), random: GameRandomUint32 = secureUint32, newId?: string): TogetherGame {
  const previous = state.games?.find(game => game.id === id);
  if (!previous || !isTogetherGame(previous)) throw new Error('이전 놀이 결과를 찾지 못했어요.');
  const input: RoomGameInput = { id: newId ?? newGameId(), type: previous.type, title: previous.title,
    ...(previous.members.length ? { memberIds: previous.members.map(member => member.id) } : {}),
    ...(previous.type === 'LADDER' || previous.source === 'OPTIONS' ? { options: previous.options.map(option => option.label) } : {}) };
  return createRun(state, actorId, previous, input, at, random, previous);
}

/** Current room membership gates reads, but archived/cancelled runs remain readable. Returned snapshots are detached. */
export function getRoomGames(state: GameState, actorId: string, scope: RoomGameScope, at = new Date()): TogetherGame[] {
  try { getRoomGameContext(state, actorId, scope, at); } catch { return []; }
  return (state.games ?? []).filter(game => isTogetherGame(game) && scopeEqual(game, scope))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)).map(game => structuredClone(game));
}

/** Strict persisted DTO validation: foreign results and misleading ladder paths fail closed. */
export function isTogetherGame(value: unknown): value is TogetherGame {
  if (!object(value) || !exactKeys(value, ['version', 'id', 'type', 'source', 'groupId', 'activityId', 'title', 'createdBy', 'createdAt', 'round', 'previousGameId', 'members', 'options', 'result'])
    || value.version !== 1 || !gameId(value.id) || !text(value.groupId) || (value.activityId !== undefined && !text(value.activityId))
    || !text(value.title, 100) || !text(value.createdBy) || typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt))
    || !Number.isInteger(value.round) || Number(value.round) < 1 || Number(value.round) > 1000000
    || (value.previousGameId !== undefined && (!gameId(value.previousGameId) || value.previousGameId === value.id))
    || (Number(value.round) === 1 ? value.previousGameId !== undefined : value.previousGameId === undefined)
    || !['OPTIONS', 'MEMBERS'].includes(String(value.source)) || !Array.isArray(value.members) || value.members.length > 12
    || !value.members.every(member => object(member) && exactKeys(member, ['id', 'name']) && text(member.id) && text(member.name, 100))
    || !unique(value.members.map(member => member.id)) || !Array.isArray(value.options) || value.options.length > 12
    || !value.options.every(option => object(option) && exactKeys(option, ['id', 'label']) && text(option.id) && text(option.label, 100))
    || !unique(value.options.map(option => option.id)) || !object(value.result)) return false;
  const members = value.members as RoomGameMember[], options = value.options as RoomGameOption[], result = value.result;
  if (value.source === 'MEMBERS' ? members.length < 2 : members.length !== 0) return false;
  if ((value.source === 'OPTIONS' || value.type === 'LADDER') && (!unique(options.map(option => key(option.label))) || options.some(option => option.label.length > 80))) return false;
  if (value.type === 'WHEEL') return options.length >= 2 && (value.source !== 'MEMBERS' || options.length === members.length)
    && (value.source !== 'MEMBERS' || options.every((option, index) => option.label === members[index].name))
    && exactKeys(result, ['optionId']) && options.some(option => option.id === result.optionId);
  if (value.type === 'DRAW') return value.source === 'MEMBERS' && options.length === 0 && exactKeys(result, ['memberId']) && members.some(member => member.id === result.memberId);
  if (value.type !== 'LADDER' || value.source !== 'MEMBERS' || options.length !== members.length || options.length < 2 || !exactKeys(result, ['assignments', 'bars'])
    || !Array.isArray(result.assignments) || result.assignments.length !== members.length || !Array.isArray(result.bars) || result.bars.length > 66
    || !result.assignments.every(pair => object(pair) && exactKeys(pair, ['memberId', 'optionId']) && members.some(member => member.id === pair.memberId) && options.some(option => option.id === pair.optionId))
    || !unique(result.assignments.map(pair => pair.memberId)) || !unique(result.assignments.map(pair => pair.optionId))) return false;
  const wires = members.map(member => member.id);
  const assignments = result.assignments;
  for (const [index, bar] of result.bars.entries()) {
    if (!object(bar) || !exactKeys(bar, ['left', 'level']) || !Number.isInteger(bar.left) || Number(bar.left) < 0 || Number(bar.left) >= members.length - 1 || bar.level !== index) return false;
    const left = Number(bar.left); [wires[left], wires[left + 1]] = [wires[left + 1], wires[left]];
  }
  return options.every((option, index) => assignments.some(pair => pair.memberId === wires[index] && pair.optionId === option.id));
}
