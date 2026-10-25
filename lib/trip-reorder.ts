import type { TripAction, TripSession, TripState, Visit } from './trip-engine';

export type ReorderVisitsAction = { type: 'reorder-visits'; day: number; ids: string[] };
export type VisitOrderGroup = { id: string; visits: Visit[]; fixed: boolean };
const problem = () => new Error('연결된 방문 순서를 확인할 수 없어요. 장소와 주변 식당·카페를 확인한 다음 다시 열어 주세요.');

/** Legacy visits link to an entity anchor, not another visit. Only unambiguous adjacent links are grouped. */
export function visitOrderGroups(plan: Visit[], day: number): VisitOrderGroup[] {
  const visits = plan.filter(visit => visit.day === day);
  if (!Number.isInteger(day) || day < 1 || day > 30 || !visits.length || new Set(plan.map(visit => visit.id)).size !== plan.length) throw problem();
  const landmarks = new Set(visits.filter(visit => visit.kind === 'place').map(visit => visit.entityId ?? visit.anchorId));
  const groups: VisitOrderGroup[] = [];
  for (const visit of visits) {
    const last = groups.at(-1);
    const linkedBusiness = ['food', 'cafe', 'shop'].includes(visit.kind) && landmarks.has(visit.anchorId);
    if (linkedBusiness) {
      const root = last?.visits[0];
      if (!root || root.kind !== 'place' || (root.entityId ?? root.anchorId) !== visit.anchorId) throw problem();
      last.visits.push(visit);
      last.fixed ||= visit.locked;
    } else groups.push({ id: visit.id, visits: [visit], fixed: visit.kind === 'stay' || visit.locked });
  }
  return groups;
}

/** Reorder entire DAY slots atomically. Every Visit object and every other DAY retain their identity. */
export function reorderDayVisits(plan: Visit[], day: number, ids: string[]): Visit[] {
  const groups = visitOrderGroups(plan, day), visits = plan.filter(visit => visit.day === day);
  if (ids.length !== visits.length || new Set(ids).size !== ids.length || ids.some(id => !visits.some(visit => visit.id === id))) throw new Error('이 DAY의 방문 전체를 한 번씩만 포함해야 해요. 다른 날짜나 삭제된 방문은 옮길 수 없어요.');
  const groupsById = new Map(groups.flatMap(group => group.visits.map(visit => [visit.id, group] as const)));
  const nextGroups: VisitOrderGroup[] = [];
  for (let index = 0; index < ids.length;) {
    const group = groupsById.get(ids[index])!;
    if (group.visits.some((visit, offset) => ids[index + offset] !== visit.id)) throw new Error('장소와 연결된 식당·카페·상점은 같은 순서를 유지하며 함께 옮겨 주세요.');
    nextGroups.push(group); index += group.visits.length;
  }
  for (const fixed of groups.filter(group => group.fixed)) {
    const before = groups.slice(0, groups.indexOf(fixed)).map(group => group.id).sort();
    const after = nextGroups.slice(0, nextGroups.indexOf(fixed)).map(group => group.id).sort();
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('숙소와 예약 고정 방문의 앞뒤를 넘어서 옮길 수 없어요. 같은 쪽의 방문끼리 옮겨 주세요.');
  }
  if (ids.every((id, index) => id === visits[index].id)) return plan;
  const byId = new Map(visits.map(visit => [visit.id, visit])), ordered = ids.map(id => byId.get(id)!);
  let index = 0;
  return plan.map(visit => visit.day === day ? ordered[index++] : visit);
}

/** UI insertion slots use group IDs; null means the end of the source's bounded segment. */
export function proposedVisitOrder(plan: Visit[], day: number, sourceId: string, beforeId: string | null): string[] {
  const groups = visitOrderGroups(plan, day), source = groups.find(group => group.visits.some(visit => visit.id === sourceId));
  if (!source || source.fixed) throw new Error('숙소와 예약 고정 방문은 직접 옮길 수 없어요.');
  const position = groups.indexOf(source);
  let first = position, last = position;
  while (first > 0 && !groups[first - 1].fixed) first--;
  while (last + 1 < groups.length && !groups[last + 1].fixed) last++;
  const target = beforeId === null ? groups[last + 1] : groups.find(group => group.visits.some(visit => visit.id === beforeId));
  if (beforeId !== null && !target) throw new Error('놓을 방문이 바뀌었어요. 편집을 다시 열어 주세요.');
  if (target === source) return groups.flatMap(group => group.visits.map(visit => visit.id));
  const targetIndex = target ? groups.indexOf(target) : groups.length;
  if (targetIndex < first || targetIndex > last + 1) throw new Error('숙소와 예약 고정 방문의 앞뒤를 넘어서 옮길 수 없어요.');
  const next = groups.filter(group => group !== source);
  next.splice(target ? next.indexOf(target) : next.length, 0, source);
  const ids = next.flatMap(group => group.visits.map(visit => visit.id));
  reorderDayVisits(plan, day, ids);
  return ids;
}

/** Full snapshot identity cancels a gesture after incoming edits, including notes and reservations. */
export const visitOrderIdentity = (state: TripState, day: number) => JSON.stringify({ day, days: state.days, savedPlanId: state.savedPlanId, planStatus: state.planStatus, plan: state.plan, pendingCandidates: state.pendingCandidates });
/** A DAY named only in a keep-unchanged clause is not an additional editing target. */
export function reorderTargetDays(text: string): number[] {
  const mentions = [...text.matchAll(/DAY\s*(\d{1,2})/gi)];
  const clauses = mentions.map((match, index) => text.slice(match.index! + match[0].length, mentions[index + 1]?.index ?? text.length));
  const edit = /바꿔|바꾸|변경|옮겨|옮기|이동|배치|역순|정반대|반대로|순서.{0,8}(?:수정|조정)/;
  const keep = /그대로\s*(?:유지|보존|둬|두고|두어|둘|놔|놓아)|(?:유지|보존)해|(?:변경|수정|이동|바꾸|옮기)하지\s*(?:마|말)/;
  const protectedDays = clauses.map(clause => {
    const protection = clause.search(keep), operation = clause.search(edit);
    return protection >= 0 && (operation < 0 || protection <= operation);
  });
  // Coordinated nouns such as "DAY 2와 DAY 3은 그대로 유지" share the protection verb.
  for (let index = clauses.length - 2; index >= 0; index--) {
    if (protectedDays[index + 1] && !/[.!?;。！？]/.test(clauses[index]) && !edit.test(clauses[index])) protectedDays[index] = true;
  }
  return mentions.filter((_, index) => !protectedDays[index]).map(match => Number(match[1]));
}
export function finishVisitOrderGesture(state: TripState, day: number, identity: string, ids: string[], reason: 'drop' | 'cancel', inside: boolean): ReorderVisitsAction | null {
  if (reason !== 'drop' || !inside || identity !== visitOrderIdentity(state, day)) return null;
  try { return reorderDayVisits(state.plan, day, ids) === state.plan ? null : { type: 'reorder-visits', day, ids }; }
  catch { return null; }
}

export function applyVisitOrder(session: TripSession, action: TripAction): TripSession | undefined {
  if (action.type !== 'reorder-visits') return;
  const before = session.turns.at(-1)!.state;
  let plan: Visit[], notice: string;
  try { plan = reorderDayVisits(before.plan, action.day, action.ids); notice = `DAY ${action.day}의 방문 순서를 바꿨어요. 연결된 식당·카페·상점과 숙소 경계는 유지했어요. 방문 시각은 자동 조정하지 않았어요.`; }
  catch (error) { plan = before.plan; notice = error instanceof Error ? error.message : '방문 순서를 확인해 주세요.'; }
  if (plan === before.plan && notice.startsWith(`DAY ${action.day}`)) return session;
  const state: TripState = { ...before, plan, stage: 'plan', activeDay: action.day >= 1 && action.day <= before.days ? action.day : before.activeDay, question: `DAY ${action.day} 방문 순서 편집`, notice };
  return { ...session, nextId: session.nextId + 1, turns: [...session.turns, { id: session.nextId, state }] };
}
