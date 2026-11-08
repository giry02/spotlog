import type { TogetherState } from './model.ts';
import { togetherId } from './model.ts';
import { validCalendarDay } from './calendarPlans.ts';
import type { ChallengeCertification, ChallengeCertifyInput, ChallengeCreateInput, ChallengePhoto, ChallengeScope, ChallengeTemplate, TogetherChallenge } from './challengeTypes.ts';
export type { ChallengeCertification, ChallengeCertifyInput, ChallengeCreateInput, ChallengePhoto, ChallengeScope, ChallengeTemplate, TogetherChallenge } from './challengeTypes.ts';

export const CHALLENGE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const challengeTemplates: Array<{ id: ChallengeTemplate; emoji: string; label: string; title: string; description: string; weeklyTarget: number }> = [
  { id: 'WALK', emoji: '🚶', label: '산책', title: '함께 걷는 산책', description: '걸으며 발견한 풍경과 오늘의 한마디를 남겨요.', weeklyTarget: 3 },
  { id: 'READING', emoji: '📖', label: '독서', title: '조금씩 함께 읽기', description: '읽은 책과 기억에 남는 생각을 나눠요.', weeklyTarget: 3 },
  { id: 'FOOD', emoji: '☕', label: '카페·맛집 기록', title: '오늘의 한 곳 기록', description: '직접 다녀온 카페나 음식점 이야기를 남겨요.', weeklyTarget: 1 },
  { id: 'TRAVEL_PHOTO', emoji: '📷', label: '여행 사진', title: '여행의 한 장면', description: '함께 기억하고 싶은 여행 사진과 이야기를 남겨요.', weeklyTarget: 1 },
  { id: 'CUSTOM', emoji: '✍️', label: '직접 만들기', title: '', description: '', weeklyTarget: 3 },
];
const keys = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every(key => allowed.includes(key));
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const text = (value: unknown, max: number, nonempty = false): value is string => typeof value === 'string' && value.length <= max && (!nonempty || value.trim().length > 0);
const identifier = (value: unknown): value is string => text(value, 180, true) && /^[A-Za-z0-9_-]+$/.test(value);
const instant = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
export const challengeToday = (at = new Date()) => {
  if (!Number.isFinite(at.getTime())) throw new Error('챌린지 기준 시각을 확인해 주세요.');
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(at);
};
export function isChallengePhoto(value: unknown): value is ChallengePhoto {
  if (!record(value) || !keys(value, ['name', 'mime', 'size', 'dataUrl']) || !text(value.name, 160, true)
    || !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(String(value.mime))
    || !Number.isInteger(value.size) || Number(value.size) < 1 || Number(value.size) > CHALLENGE_PHOTO_MAX_BYTES || typeof value.dataUrl !== 'string') return false;
  const prefix = `data:${value.mime};base64,`;
  if (!value.dataUrl.startsWith(prefix) || value.dataUrl.length > prefix.length + Math.ceil(CHALLENGE_PHOTO_MAX_BYTES / 3) * 4) return false;
  const data = value.dataUrl.slice(prefix.length);
  return data.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(data)
    && data.length / 4 * 3 - (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0) === value.size;
}
export function isTogetherChallenge(value: unknown): value is TogetherChallenge {
  if (!record(value) || !keys(value, ['id','groupId','activityId','template','title','description','startDate','endDate','frequency','weeklyTarget','participantIds','certifications','closed','createdBy','createdAt','closedAt','revision'])
    || !identifier(value.id) || !identifier(value.groupId) || (value.activityId !== undefined && !identifier(value.activityId))
    || !challengeTemplates.some(item => item.id === value.template) || !text(value.title, 100, true) || !text(value.description, 1000)
    || !validCalendarDay(value.startDate) || !validCalendarDay(value.endDate) || value.endDate < value.startDate
    || value.frequency !== 'WEEKLY' || !Number.isInteger(value.weeklyTarget) || Number(value.weeklyTarget) < 1 || Number(value.weeklyTarget) > 7
    || !Array.isArray(value.participantIds) || value.participantIds.length > 1000 || !value.participantIds.every(identifier) || new Set(value.participantIds).size !== value.participantIds.length
    || typeof value.closed !== 'boolean' || !identifier(value.createdBy) || !instant(value.createdAt) || (value.closed ? !instant(value.closedAt) : value.closedAt !== undefined)
    || !Number.isInteger(value.revision) || Number(value.revision) < 1 || !Array.isArray(value.certifications) || value.certifications.length > 10000) return false;
  const startDate = value.startDate; const endDate = value.endDate;
  const seen = new Set<string>(); const ids = new Set<string>();
  return value.certifications.every(item => {
    if (!record(item) || !keys(item, ['id','userId','date','text','photo','createdAt']) || !identifier(item.id) || !identifier(item.userId)
      || !validCalendarDay(item.date) || item.date < startDate || item.date > endDate || !text(item.text, 1000, true)
      || !instant(item.createdAt) || challengeToday(new Date(item.createdAt)) !== item.date || item.photo !== undefined && !isChallengePhoto(item.photo)) return false;
    const key = `${item.userId}:${item.date}`;
    if (seen.has(key) || ids.has(item.id)) return false;
    seen.add(key); ids.add(item.id); return true;
  });
}
type ChallengeState = TogetherState & { challenges?: TogetherChallenge[] };
const sameScope = (value: ChallengeScope, scope: ChallengeScope) => value.groupId === scope.groupId && value.activityId === scope.activityId;
export function getChallengeContext(state: TogetherState, actorId: string, scope: ChallengeScope, at = new Date()) {
  const today = challengeToday(at);
  const group = state.groups.find(item => item.id === scope.groupId);
  if (!actorId || !state.members.some(item => item.id === actorId) || !group || !group.memberIds.includes(actorId) || group.blockedMemberIds?.includes(actorId)) throw new Error('현재 모임원만 챌린지를 볼 수 있어요.');
  const activity = scope.activityId ? state.activities.find(item => item.id === scope.activityId && item.groupId === group.id) : undefined;
  if (scope.activityId && !activity || !scope.activityId && group.spaceType === 'ACTIVITY') throw new Error('챌린지가 속한 약속을 확인해 주세요.');
  const finalDate = activity && validCalendarDay(activity.endDate) && activity.endDate >= activity.date ? activity.endDate : activity?.date;
  const canWrite = !group.archived && (!activity || activity.status === 'PLANNED' && (!finalDate || !validCalendarDay(finalDate) || finalDate >= today));
  return { group, activity, today, canWrite };
}
function writable(state: TogetherState, actorId: string, scope: ChallengeScope, at: Date) {
  const context = getChallengeContext(state, actorId, scope, at);
  if (!context.canWrite) throw new Error('보관되거나 종료된 모임·약속에서는 챌린지를 바꿀 수 없어요.');
  return context;
}
function current(state: TogetherState, actorId: string, scope: ChallengeScope, id: string, at: Date) {
  const context = writable(state, actorId, scope, at);
  const challenge = (state as ChallengeState).challenges?.find(item => item.id === id && sameScope(item, scope));
  if (!challenge || !isTogetherChallenge(challenge)) throw new Error('현재 대화의 챌린지를 다시 확인해 주세요.');
  return { ...context, challenge };
}
export function challengeIsFinished(challenge: TogetherChallenge, at = new Date()) { return challenge.closed || challenge.endDate < challengeToday(at); }
export function challengeCanClose(state: TogetherState, actorId: string, challenge: TogetherChallenge): boolean {
  const group = state.groups.find(item => item.id === challenge.groupId);
  const activity = challenge.activityId && state.activities.find(item => item.id === challenge.activityId && item.groupId === challenge.groupId);
  return Boolean(group && (challenge.createdBy === actorId || group.ownerId === actorId || group.managerIds.includes(actorId) || activity && (activity.leadId === actorId || activity.editorIds.includes(actorId))));
}
export function selectRoomChallenges(state: TogetherState, actorId: string, scope: ChallengeScope, at = new Date()): TogetherChallenge[] {
  getChallengeContext(state, actorId, scope, at);
  return ((state as ChallengeState).challenges || []).filter(item => sameScope(item, scope) && isTogetherChallenge(item)).sort((a,b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
}
export function createRoomChallenge(state: TogetherState, actorId: string, scope: ChallengeScope, input: ChallengeCreateInput, at = new Date()): string {
  const { today, activity } = writable(state, actorId, scope, at);
  const challenge: TogetherChallenge = { id: input.id, ...scope, template: input.template, title: input.title.trim(), description: input.description.trim(), startDate: input.startDate, endDate: input.endDate,
    frequency: input.frequency, weeklyTarget: input.weeklyTarget, participantIds: [], certifications: [], closed: false, createdBy: actorId, createdAt: at.toISOString(), revision: 1 };
  if (!isTogetherChallenge(challenge) || challenge.startDate < today || Date.parse(`${challenge.endDate}T00:00:00Z`) - Date.parse(`${challenge.startDate}T00:00:00Z`) > 365 * 86400000) throw new Error('이름·기간·주간 목표를 확인해 주세요. 시작일은 오늘 이후, 기간은 1년 이내예요.');
  if (activity && (validCalendarDay(activity.date) && challenge.startDate < activity.date || validCalendarDay(activity.endDate || activity.date) && challenge.endDate > (activity.endDate || activity.date))) throw new Error('이 약속의 기간 안에서 챌린지를 만들어 주세요.');
  const previous = (state as ChallengeState).challenges?.find(item => item.id === input.id);
  if (previous) {
    const fields = ['template','title','description','startDate','endDate','frequency','weeklyTarget','createdBy'] as const;
    if (!sameScope(previous, scope) || fields.some(key => previous[key] !== challenge[key])) throw new Error('다른 챌린지에 사용된 요청이에요.');
    return previous.id;
  }
  const items = (state as ChallengeState).challenges || [];
  if (items.length >= 200) throw new Error('챌린지가 많아요. 기존 기록을 먼저 확인해 주세요.');
  (state as ChallengeState).challenges = [...items, challenge]; return challenge.id;
}
export function joinRoomChallenge(state: TogetherState, actorId: string, scope: ChallengeScope, id: string, at = new Date()): void {
  const { challenge } = current(state, actorId, scope, id, at);
  if (challengeIsFinished(challenge, at)) throw new Error('종료된 챌린지에는 참가할 수 없어요.');
  if (!challenge.participantIds.includes(actorId)) { if (challenge.participantIds.length >= 1000) throw new Error('참가 인원을 확인해 주세요.'); challenge.participantIds.push(actorId); challenge.revision++; }
}
export function leaveRoomChallenge(state: TogetherState, actorId: string, scope: ChallengeScope, id: string, at = new Date()): void {
  const { challenge } = current(state, actorId, scope, id, at);
  if (challenge.participantIds.includes(actorId)) { challenge.participantIds = challenge.participantIds.filter(item => item !== actorId); challenge.revision++; }
}
export function certifyRoomChallenge(state: TogetherState, actorId: string, scope: ChallengeScope, id: string, input: ChallengeCertifyInput, at = new Date()): string {
  const { challenge, today } = current(state, actorId, scope, id, at);
  if (challengeIsFinished(challenge, at) || today < challenge.startDate) throw new Error('챌린지 진행 기간에만 인증할 수 있어요.');
  if (!challenge.participantIds.includes(actorId)) throw new Error('먼저 챌린지에 참가해 주세요.');
  if (challenge.certifications.some(item => item.userId === actorId && item.date === today)) throw new Error('오늘 인증은 이미 남겼어요. 하루에 한 번 인증할 수 있어요.');
  if (!text(input.text, 1000, true) || input.photo !== undefined && !isChallengePhoto(input.photo)) throw new Error('인증 내용과 사진을 확인해 주세요. 사진은 5MB 이하의 이미지예요.');
  if (challenge.certifications.length >= 10000) throw new Error('인증 기록이 많아요. 새 챌린지에서 이어가 주세요.');
  const certification: ChallengeCertification = { id: togetherId('challenge-cert'), userId: actorId, date: today, text: input.text.trim(), ...(input.photo ? { photo: structuredClone(input.photo) } : {}), createdAt: at.toISOString() };
  challenge.certifications.push(certification); challenge.revision++; return certification.id;
}
export function closeRoomChallenge(state: TogetherState, actorId: string, scope: ChallengeScope, id: string, at = new Date()): void {
  const { challenge } = current(state, actorId, scope, id, at);
  if (!challengeCanClose(state, actorId, challenge)) throw new Error('개설자나 운영진만 챌린지를 종료할 수 있어요.');
  if (!challenge.closed) { challenge.closed = true; challenge.closedAt = at.toISOString(); challenge.revision++; }
}
export function challengeProgress(challenge: TogetherChallenge, userId: string, at = new Date()) {
  const today = challengeToday(at); const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  const weekStart = date.toISOString().slice(0,10); date.setUTCDate(date.getUTCDate() + 6); const weekEnd = date.toISOString().slice(0,10);
  const own = challenge.certifications.filter(item => item.userId === userId);
  const weeklyCount = own.filter(item => item.date >= weekStart && item.date <= weekEnd && item.date <= today).length;
  return { weeklyCount, totalCount: own.length, weeklyTarget: challenge.weeklyTarget, weekStart, weekEnd, achieved: weeklyCount >= challenge.weeklyTarget };
}
