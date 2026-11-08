import { canEditActivity, togetherId, type TogetherActivity, type TogetherGroup, type TogetherPoll, type TogetherState } from './model.ts';
import { koreaDay } from './discovery.ts';

export interface PollScope { groupId: string; activityId?: string }
export interface PollOptionInput { label?: string; date?: string; time?: string }
export interface PollInput {
  id?: string; question: string; kind?: 'TEXT' | 'DATE'; options: PollOptionInput[];
  multiple?: boolean; anonymous?: boolean; closesAt?: string;
}
export const POLL_OPTION_LIMIT = 12;
const validDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const validInstant = (value: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  && Number.isFinite(Date.parse(value)) && validDay(value.slice(0, 10)) && validTime(value.slice(11, 16));
/** Additional optional-field checks after the repository's existing base poll validator. */
export function isTogetherPollFields(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const poll = value as Record<string, unknown>;
  if (poll.kind !== undefined && poll.kind !== 'TEXT' && poll.kind !== 'DATE') return false;
  if (poll.multiple !== undefined && typeof poll.multiple !== 'boolean' || poll.anonymous !== undefined && typeof poll.anonymous !== 'boolean') return false;
  if (poll.closesAt !== undefined && (typeof poll.closesAt !== 'string' || !validInstant(poll.closesAt))) return false;
  if (poll.createdAt !== undefined && (typeof poll.createdAt !== 'string' || !validInstant(poll.createdAt))) return false;
  if (poll.creatorId !== undefined && (typeof poll.creatorId !== 'string' || !poll.creatorId.trim() || poll.creatorId.length > 200)) return false;
  if (poll.revision !== undefined && (!Number.isSafeInteger(poll.revision) || (poll.revision as number) < 1)) return false;
  if (!Array.isArray(poll.options)) return false;
  return poll.options.every(value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const option = value as Record<string, unknown>;
    if (poll.kind === 'DATE' && (typeof option.date !== 'string' || !validDay(option.date))) return false;
    if (option.date !== undefined && (typeof option.date !== 'string' || !validDay(option.date))) return false;
    if (option.time !== undefined && (typeof option.time !== 'string' || !validTime(option.time) || !option.date)) return false;
    return true;
  });
}
function clock(at: Date) { if (!Number.isFinite(at.getTime())) throw new Error('현재 시각을 다시 확인해 주세요.'); return at; }

/** Re-read current membership and the exact enclosing activity for every change. */
function context(state: TogetherState, actorId: string, scope: PollScope, at: Date): { group: TogetherGroup; activity?: TogetherActivity } {
  clock(at);
  const group = state.groups.find(item => item.id === scope.groupId);
  if (!actorId || !state.members.some(item => item.id === actorId) || !group || !group.memberIds.includes(actorId) || group.blockedMemberIds?.includes(actorId)) throw new Error('현재 모임의 멤버만 투표를 이용할 수 있어요.');
  if (group.archived) throw new Error('보관한 모임의 투표는 변경할 수 없어요.');
  const activity = scope.activityId ? state.activities.find(item => item.id === scope.activityId && item.groupId === group.id) : undefined;
  if (scope.activityId && !activity || group.spaceType === 'ACTIVITY' && !activity) throw new Error('이 투표가 속한 약속을 다시 확인해 주세요.');
  if (activity) {
    const final = validDay(activity.endDate) && activity.endDate >= activity.date ? activity.endDate : activity.date;
    if (activity.status !== 'PLANNED' || validDay(final) && final < koreaDay(at)) throw new Error('취소되거나 지난 약속의 투표는 변경할 수 없어요.');
  }
  return { group, activity };
}
function currentPoll(state: TogetherState, pollId: string): TogetherPoll {
  const poll = state.polls.find(item => item.id === pollId);
  if (!poll) throw new Error('현재 투표를 찾지 못했어요.');
  return poll;
}
function nextRevision(poll: TogetherPoll) { poll.revision = (poll.revision ?? 0) + 1; }
function normalizedInput(input: PollInput, at: Date) {
  clock(at);
  const kind = input.kind ?? 'TEXT', question = input.question.trim();
  if (!['TEXT', 'DATE'].includes(kind)) throw new Error('투표 종류를 다시 선택해 주세요.');
  if (!question || question.length > 160) throw new Error('투표 제목을 160자 이내로 적어 주세요.');
  if (!Array.isArray(input.options) || input.options.length < 2 || input.options.length > POLL_OPTION_LIMIT) throw new Error(`후보를 2~${POLL_OPTION_LIMIT}개 입력해 주세요.`);
  if (input.multiple !== undefined && typeof input.multiple !== 'boolean' || input.anonymous !== undefined && typeof input.anonymous !== 'boolean') throw new Error('투표 설정을 다시 확인해 주세요.');
  const options = input.options.map(option => {
    if (!option || typeof option !== 'object') throw new Error('투표 후보를 다시 확인해 주세요.');
    if (kind === 'DATE') {
      const date = option.date || '', time = option.time || '';
      if (!validDay(date) || date < koreaDay(at) || time && !validTime(time)) throw new Error('오늘 이후의 날짜와 올바른 시각을 입력해 주세요.');
      return { label: `${date}${time ? ` ${time}` : ' · 시각 미정'} (한국 시각)`, date, ...(time ? { time } : {}) };
    }
    const label = (option.label || '').trim();
    if (!label || label.length > 160) throw new Error('각 후보를 160자 이내로 적어 주세요.');
    return { label };
  });
  if (new Set(options.map(item => item.label.normalize('NFKC').toLocaleLowerCase('ko-KR'))).size !== options.length) throw new Error('같은 후보가 중복됐어요.');
  let closesAt: string | undefined;
  if (input.closesAt) {
    if (!validInstant(input.closesAt) || Date.parse(input.closesAt) <= at.getTime()) throw new Error('마감 시각은 현재보다 이후로 설정해 주세요.');
    closesAt = new Date(input.closesAt).toISOString();
  }
  return { question, kind, options, multiple: input.multiple === true, anonymous: input.anonymous === true, ...(closesAt ? { closesAt } : {}) };
}
export function isPollClosed(poll: TogetherPoll, at = new Date()): boolean {
  return poll.closed || Boolean(poll.confirmedOptionId) || Boolean(poll.closesAt && (!validInstant(poll.closesAt) || Date.parse(poll.closesAt) <= at.getTime()));
}
export function canManagePoll(state: TogetherState, actorId: string, poll: TogetherPoll, at = new Date()): boolean {
  try {
    const { group, activity } = context(state, actorId, poll, at);
    return poll.creatorId === actorId || group.ownerId === actorId || group.managerIds.includes(actorId) || Boolean(activity && canEditActivity(state, actorId, activity));
  } catch { return false; }
}
export function canVotePoll(state: TogetherState, actorId: string, poll: TogetherPoll, at = new Date()): boolean {
  try { context(state, actorId, poll, at); return !isPollClosed(poll, at); } catch { return false; }
}
export function pollInputFrom(poll: TogetherPoll): PollInput {
  return { id: poll.id, question: poll.question, kind: poll.kind ?? 'TEXT', multiple: poll.multiple === true, anonymous: poll.anonymous === true, closesAt: poll.closesAt,
    options: poll.options.map(({ label, date, time }) => ({ label, ...(date ? { date } : {}), ...(time ? { time } : {}) })) };
}
export function createRoomPoll(state: TogetherState, actorId: string, scope: PollScope, input: PollInput, at = new Date()): TogetherPoll {
  context(state, actorId, scope, at);
  const clean = normalizedInput(input, at), id = input.id || togetherId('poll');
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(id)) throw new Error('투표 요청 ID를 다시 확인해 주세요.');
  const previous = state.polls.find(item => item.id === id);
  if (previous) {
    const same = previous.groupId === scope.groupId && previous.activityId === scope.activityId && previous.creatorId === actorId
      && previous.question === clean.question && (previous.kind ?? 'TEXT') === clean.kind && Boolean(previous.multiple) === clean.multiple
      && Boolean(previous.anonymous) === clean.anonymous && previous.closesAt === clean.closesAt
      && JSON.stringify(previous.options.map(({ label, date, time }) => ({ label, ...(date ? { date } : {}), ...(time ? { time } : {}) }))) === JSON.stringify(clean.options);
    if (!same) throw new Error('다른 내용으로 사용한 투표 요청이에요. 다시 확인해 주세요.');
    return previous;
  }
  const poll: TogetherPoll = { id, groupId: scope.groupId, ...(scope.activityId ? { activityId: scope.activityId } : {}), ...clean,
    options: clean.options.map(option => ({ ...option, id: togetherId('option'), voterIds: [] })), creatorId: actorId, createdAt: at.toISOString(), revision: 1, closed: false };
  state.polls.push(poll); return poll;
}
/** null cancels this actor's whole response; multiple choice toggles the selected candidate. */
export function voteRoomPoll(state: TogetherState, actorId: string, pollId: string, optionId: string | null, at = new Date()): TogetherPoll {
  const poll = currentPoll(state, pollId); context(state, actorId, poll, at);
  if (isPollClosed(poll, at)) throw new Error('마감된 투표에는 응답하거나 취소할 수 없어요.');
  const chosen = optionId === null ? undefined : poll.options.find(item => item.id === optionId);
  if (optionId !== null && !chosen) throw new Error('현재 투표 후보를 다시 확인해 주세요.');
  const before = JSON.stringify(poll.options.map(item => item.voterIds));
  const alreadyChosen = Boolean(chosen?.voterIds.includes(actorId));
  for (const option of poll.options) {
    if (!poll.multiple || optionId === null || option.id === optionId) option.voterIds = option.voterIds.filter(id => id !== actorId);
  }
  if (chosen && (!poll.multiple || !alreadyChosen)) chosen.voterIds.push(actorId);
  if (before !== JSON.stringify(poll.options.map(item => item.voterIds))) nextRevision(poll);
  return poll;
}
export function editRoomPoll(state: TogetherState, actorId: string, pollId: string, input: PollInput, expectedRevision: number, at = new Date()): TogetherPoll {
  const poll = currentPoll(state, pollId); context(state, actorId, poll, at);
  if (!canManagePoll(state, actorId, poll, at)) throw new Error('투표 작성자나 운영자만 수정할 수 있어요.');
  if ((poll.revision ?? 0) !== expectedRevision) throw new Error('투표가 변경됐어요. 다시 열어서 확인해 주세요.');
  if (isPollClosed(poll, at) || poll.options.some(item => item.voterIds.length)) throw new Error('응답 전의 진행 중인 투표만 수정할 수 있어요.');
  const clean = normalizedInput(input, at);
  poll.question = clean.question; poll.kind = clean.kind; poll.multiple = clean.multiple; poll.anonymous = clean.anonymous;
  poll.closesAt = clean.closesAt;
  poll.options = clean.options.map(option => ({ ...option, id: togetherId('option'), voterIds: [] }));
  nextRevision(poll); return poll;
}
export function closeRoomPoll(state: TogetherState, actorId: string, pollId: string, at = new Date()): TogetherPoll {
  const poll = currentPoll(state, pollId); context(state, actorId, poll, at);
  if (!canManagePoll(state, actorId, poll, at)) throw new Error('투표 작성자나 운영자만 마감할 수 있어요.');
  if (!poll.closed) { poll.closed = true; nextRevision(poll); }
  return poll;
}
export function confirmRoomPoll(state: TogetherState, actorId: string, pollId: string, optionId: string, at = new Date()): TogetherPoll {
  const poll = currentPoll(state, pollId); context(state, actorId, poll, at);
  if (!canManagePoll(state, actorId, poll, at)) throw new Error('투표 작성자나 운영자만 결과를 확정할 수 있어요.');
  if (!poll.options.some(item => item.id === optionId)) throw new Error('확정할 후보를 다시 확인해 주세요.');
  if (poll.confirmedOptionId && poll.confirmedOptionId !== optionId) throw new Error('이미 확정한 결과는 덮어쓸 수 없어요.');
  if (!poll.confirmedOptionId) { poll.confirmedOptionId = optionId; poll.closed = true; nextRevision(poll); }
  return poll;
}
