import { findFood, findPlace, findStay, getNearbyRegisteredBusinesses, getKnownEntityPrice } from './trip-data';
import type { TripSession, TripState, Visit } from './trip-engine';

export type CandidateGroup = {
  id: string;
  day: number;
  anchorId: string;
  kind: 'food' | 'cafe' | 'shop' | 'stay';
  slot: string;
  optionIds: string[];
  selectedId?: string;
};
export type TripExtensionAction =
  | { type: 'trip-meta'; title?: string; startDate?: string | null }
  | { type: 'visit-details'; id: string; note?: string; time?: string; durationMinutes?: number }
  | { type: 'stay-placement'; stayId: string; startDay: number; nights: number }
  | { type: 'day-add'; afterDay?: number }
  | { type: 'day-copy'; day: number; toDay?: number }
  | { type: 'day-delete'; day: number }
  | { type: 'visit-copy'; id: string; day?: number }
  | { type: 'candidate-propose'; ids: string[]; day?: number; anchorId?: string; slot?: string }
  | { type: 'candidate-select'; groupId: string; id: string }
  | { type: 'candidate-apply'; selections?: { groupId: string; id: string }[] }
  | { type: 'candidate-reject' | 'trash-list' }
  | { type: 'trash' | 'restore'; id: string }
  | { type: 'delete-permanent'; id: string; confirmed: true };

export const MAX_GENERATED_DAYS = 7;
export const MAX_EDITED_DAYS = 30;
export const MAX_PLAN_VISITS = 180;
export const stayCheckoutExceedsTrip = (visit: Pick<Visit, 'kind' | 'day' | 'nights'>, days: number, day = visit.day) => visit.kind === 'stay' && day + (visit.nights ?? 1) > days;
/** Keep the existing final-DAY stay exclusion, but validate every included
 * legacy multi-night stay against the expanded trip before copying any visit. */
export const dayCopyCheckoutExceedsTrip = (plan: Visit[], days: number, sourceDay: number, destinationDay: number) => destinationDay <= days && plan.some(visit => visit.day === sourceDay && stayCheckoutExceedsTrip(visit, days + 1, destinationDay));
export function validTravelDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && value >= '2000-01-01' && value <= '2100-12-31';
}

/** Calendar-month retention in Korea, including month-end clamping. */
export function trashExpiry(now: Date): string {
  const korea = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const day = korea.getUTCDate();
  korea.setUTCDate(1);
  korea.setUTCMonth(korea.getUTCMonth() + 6);
  const end = new Date(Date.UTC(korea.getUTCFullYear(), korea.getUTCMonth() + 1, 0)).getUTCDate();
  korea.setUTCDate(Math.min(day, end));
  return new Date(korea.getTime() - 9 * 60 * 60 * 1000).toISOString();
}

const extensions = new Set(['trip-meta', 'visit-details', 'stay-placement', 'day-add', 'day-copy', 'day-delete', 'visit-copy', 'candidate-propose', 'candidate-select', 'candidate-apply', 'candidate-reject', 'trash-list', 'trash', 'restore', 'delete-permanent']);
export const isTripExtension = (action: { type: string }): action is TripExtensionAction => extensions.has(action.type);
const kindOf = (id: string): CandidateGroup['kind'] | undefined => findStay(id) ? 'stay' : findFood(id) ? findFood(id)!.cuisine === '카페' ? 'cafe' : String(findFood(id)!.cuisine) === '상점' ? 'shop' : 'food' : undefined;
const nextId = (visits: Visit[]) => `visit-${Math.max(0, ...visits.map(v => Number(v.id.replace('visit-', '')) || 0)) + 1}`;
export const CANDIDATE_SLOTS = ['morning','lunch','afternoon','dinner','stay','cafe','shop','오전 방문','오후 방문','아침','점심','저녁','카페에서 쉬기','쇼핑','숙박','추가 식사'] as const;
export function candidateSlot(kind: CandidateGroup['kind'], raw: string): string {
  if (kind === 'stay') return '숙박';
  if (kind === 'shop') return '쇼핑';
  if (kind === 'cafe') return '카페에서 쉬기';
  const slots: Record<string,string> = { morning:'오전 방문', lunch:'점심', afternoon:'오후 방문', dinner:'저녁', stay:'숙박', cafe:'카페에서 쉬기', shop:'쇼핑' };
  return slots[raw] ?? raw;
}
const sameSlot = (visit: Visit, group: CandidateGroup) => visit.day === group.day && visit.kind === group.kind && (group.kind === 'stay' || visit.anchorId === group.anchorId) && candidateSlot(group.kind, visit.label) === candidateSlot(group.kind, group.slot);

/** Pure snapshot update: proposals never mutate a trip until every group is selected. */
export function applyTripExtension(session: TripSession, action: { type: string }, now = new Date()): TripSession | undefined {
  if (!isTripExtension(action)) return;
  const before = session.turns.at(-1)!.state;
  const state: TripState = { ...before, plan: before.plan.map(v => ({ ...v })), pendingCandidates: before.pendingCandidates?.map(group => ({ ...group, optionIds: [...group.optionIds] })), notice: '', question: '' };
  let library = session.library.filter(plan => !plan.purgeAfter || Date.parse(plan.purgeAfter) > now.getTime());
  const blocked = (notice: string) => { state.notice = notice; };
  const findVisit = (id: string) => state.plan.find(visit => visit.id === id);
  const mutable = (id: string) => { const visit = findVisit(id); if (!visit || visit.locked) { blocked('예약한 숙소는 변경하지 않아요. 편집할 방문을 확인해 주세요.'); return; } return visit; };
  const insert = (visit: Visit) => { const index = state.plan.findIndex(row => row.day > visit.day || (row.day === visit.day && row.kind === 'stay' && visit.kind !== 'stay')); state.plan.splice(index < 0 ? state.plan.length : index, 0, visit); };
  if (action.type === 'trip-meta') {
    if (action.title !== undefined) state.title = action.title.trim();
    if (action.startDate !== undefined) state.startDate = action.startDate;
    state.question = '여행 이름·시작일 변경';
    state.notice = '여행 이름과 시작일을 바꿨어요. 실제 예약 날짜는 변경하지 않아요.';
  } else if (action.type === 'visit-details') {
    const visit = mutable(action.id);
    if (visit) {
      if (action.note !== undefined) visit.note = action.note.trim();
      if (action.time !== undefined) visit.time = action.time;
      if (action.durationMinutes !== undefined) visit.durationMinutes = action.durationMinutes;
      state.notice = '이 방문의 메모·시간·체류시간을 저장했어요. 예상 체류시간이며 실제 영업·소요시간은 확인하지 않았어요.';
    }
    state.question = '방문 세부 정보 편집'; state.stage = 'plan';
  } else if (action.type === 'stay-placement') {
    const stay = findStay(action.stayId);
    const end = action.startDay + action.nights;
    if (!stay || stay.region !== state.region || action.startDay < 1 || end > state.days) blocked('여행 지역과 체크인 날짜·박수를 확인해 주세요. 체크아웃은 여행 마지막 날 이내여야 해요.');
    else if (state.booked || state.plan.some(visit => visit.kind === 'stay' && visit.locked)) blocked('예약한 숙소의 날짜·박수는 변경하지 않았어요.');
    else if (state.stayBudgetExplicit && (getKnownEntityPrice(stay) === null || stay.price > state.stayBudget)) blocked('현재 요금을 확인하지 못해 명시한 숙박 예산을 충족한다고 배치하지 않았어요.');
    else if (state.plan.length + action.nights > MAX_PLAN_VISITS) blocked('방문 항목이 너무 많아요. 필요 없는 항목부터 정리해 주세요.');
    else {
      // Explicit range replaces only unbooked stays inside that range.
      state.plan = state.plan.filter(visit => visit.kind !== 'stay' || visit.day < action.startDay || visit.day >= end);
      for (let day = action.startDay; day < end; day++) insert({ id: nextId(state.plan), day, kind: 'stay', entityId: stay.id, anchorId: stay.near[0], label: '숙박', locked: false, nights: 1 });
      state.stayId = stay.id; state.lodging = true; state.notice = `DAY ${action.startDay}부터 ${action.nights}박에 숙소를 배치했어요. 실제 예약은 하지 않았어요.`;
    }
    state.question = '숙소 체크인·박수 선택'; state.stage = 'plan';
  } else if (action.type === 'visit-copy') {
    const visit = mutable(action.id), day = action.day ?? visit?.day ?? state.activeDay;
    if (visit && stayCheckoutExceedsTrip(visit, state.days, day)) blocked('숙박은 체크아웃이 여행 마지막 날 이내인 DAY에만 복사할 수 있어요. DAY를 먼저 추가하거나 다른 날짜를 골라 주세요.');
    else if (visit && day >= 1 && day <= state.days && state.plan.length < MAX_PLAN_VISITS) { const duplicate = { ...visit, id: nextId(state.plan), day }; delete duplicate.status; insert(duplicate); state.notice = `방문을 DAY ${day}에 복사했어요.`; }
    else if (visit) blocked('복사할 날짜 또는 방문 개수를 확인해 주세요.');
    state.question = '방문 복사'; state.stage = 'plan';
  } else if (action.type === 'day-add' || action.type === 'day-copy' || action.type === 'day-delete') {
    const day = action.type === 'day-add' ? action.afterDay ?? state.days : action.day;
    const insertDay = action.type === 'day-copy' ? action.toDay ?? state.days + 1 : day + 1;
    if (day < 1 || day > state.days || (action.type !== 'day-delete' && (state.days >= MAX_EDITED_DAYS || insertDay < 1 || insertDay > state.days + 1))) blocked('DAY 편집은 1~30일 범위에서 가능해요.');
    else if (action.type === 'day-delete' && state.days === 1) blocked('여행에는 적어도 하루가 필요해요.');
    else if (state.plan.some(visit => visit.locked && (action.type === 'day-delete' ? visit.day >= day : visit.day >= insertDay))) blocked('예약 숙소의 DAY가 달라지는 편집은 적용하지 않았어요.');
    else if (action.type === 'day-copy' && (state.plan.some(v => v.day === day && v.locked) || state.plan.length + state.plan.filter(v => v.day === day).length > MAX_PLAN_VISITS)) blocked('예약 숙소가 있는 DAY는 복사하지 않아요. 방문 개수도 확인해 주세요.');
    else if (action.type === 'day-copy' && dayCopyCheckoutExceedsTrip(state.plan, state.days, day, insertDay)) blocked('이 DAY를 복사하면 숙박의 체크아웃이 여행 기간을 넘어요. 숙박 날짜·박수를 먼저 조정해 주세요. 일정은 그대로 유지했어요.');
    else if (action.type === 'day-delete') {
      const remaining = state.plan.filter(v => v.day !== day).map(v => ({ ...v, day: v.day > day ? v.day - 1 : v.day }));
      if (remaining.some(visit => stayCheckoutExceedsTrip(visit, state.days - 1))) blocked('이 DAY를 삭제하면 남은 숙박의 체크아웃이 여행 기간을 넘어요. 숙박 날짜·박수를 먼저 조정해 주세요. 일정은 그대로 유지했어요.');
      else { state.plan = remaining; state.days--; state.activeDay = Math.min(state.activeDay, state.days); state.notice = `DAY ${day}를 삭제하고 뒤 날짜를 당겼어요.`; }
    } else {
      const copied = action.type === 'day-copy' ? state.plan.filter(v => v.day === day && (v.kind !== 'stay' || insertDay <= state.days)).map(v => ({ ...v })) : [];
      state.plan = state.plan.map(v => ({ ...v, day: v.day >= insertDay ? v.day + 1 : v.day })); state.days++;
      for (const visit of copied) { const duplicate = { ...visit, id: nextId(state.plan), day: insertDay }; delete duplicate.status; insert(duplicate); }
      state.activeDay = insertDay; state.notice = action.type === 'day-copy' ? `DAY ${day}를 새 DAY ${insertDay}에 복사했어요.${insertDay === state.days ? ' 마지막 날의 숙박은 체크아웃이 여행 기간을 넘지 않도록 복사하지 않았어요.' : ''}` : `빈 DAY ${insertDay}를 추가했어요.`;
    }
    if (state.days !== before.days) state.pendingCandidates = []; state.question = '여행 DAY 편집'; state.stage = 'plan';
  } else if (action.type === 'candidate-propose') {
    const kind = kindOf(action.ids[0]), day = action.day ?? state.activeDay;
    const food = findFood(action.ids[0]), stay = findStay(action.ids[0]);
    const anchorId = action.anchorId ?? food?.placeId ?? stay?.near[0];
    const near = anchorId && state.businessMode === 'registered' ? new Set(getNearbyRegisteredBusinesses(anchorId, kind === 'stay' ? 'STAY' : kind === 'cafe' ? 'CAFE' : kind === 'shop' ? 'SHOP' : 'FOOD', {expanded:state.nearbyExpanded}).map(item=>item.entity.id)) : null;
    if (near && anchorId && kindOf(anchorId) === kind) near.add(anchorId);
    if (!kind || !anchorId || !action.ids.length || action.ids.some(id => kindOf(id) !== kind || (near ? !near.has(id) : findFood(id) ? findFood(id)!.placeId !== anchorId : !findStay(id)?.near.includes(anchorId)))) blocked('같은 종류·장소 주변의 대안을 한 그룹으로 골라 주세요.');
    else {
      const slot = candidateSlot(kind, action.slot ?? (kind === 'stay' ? '숙박' : kind === 'cafe' ? '카페에서 쉬기' : kind === 'shop' ? '쇼핑' : '점심'));
      const group: CandidateGroup = { id: `candidate-${session.nextId}-${day}-${kind}-${(state.pendingCandidates?.length ?? 0) + 1}`, day, anchorId, kind, slot, optionIds: [...new Set(action.ids)] };
      if (day < 1 || day > state.days || (kind === 'stay' && day >= state.days) || state.plan.some(v => sameSlot(v, group) && v.locked)) blocked('이 DAY·슬롯에는 후보를 제안할 수 없어요. 예약 숙소는 유지해요.');
      else { state.pendingCandidates = [...(state.pendingCandidates ?? []).filter(row => !(row.day === day && row.anchorId === anchorId && row.kind === kind && row.slot === slot)), group]; state.notice = '대안을 묶어 두었어요. 각 그룹에서 고른 뒤 ‘선택 적용’을 누르면 일정에 반영돼요.'; }
    }
    state.question = '주변 후보 그룹 비교'; state.stage = 'plan';
  } else if (action.type === 'candidate-select') {
    const group = state.pendingCandidates?.find(row => row.id === action.groupId);
    if (!group?.optionIds.includes(action.id)) blocked('이 후보 그룹에 있는 항목을 선택해 주세요.');
    else { group.selectedId = action.id; state.notice = '선택을 표시했어요. 최종 적용 전까지 기존 일정은 유지돼요.'; }
    state.question = '후보 선택'; state.stage = 'plan';
  } else if (action.type === 'candidate-reject') {
    state.pendingCandidates = []; state.question = '후보 제안 닫기'; state.notice = '후보 제안을 닫았어요. 일정은 유지했어요.'; state.stage = 'plan';
  } else if (action.type === 'candidate-apply') {
    const groups = state.pendingCandidates ?? [];
    if (action.selections) {
      const valid = action.selections.length === groups.length && new Set(action.selections.map(row => row.groupId)).size === groups.length && action.selections.every(row => groups.some(group => group.id === row.groupId && group.optionIds.includes(row.id)));
      if (valid) for (const row of action.selections) groups.find(group => group.id === row.groupId)!.selectedId = row.id;
      else { state.question = '선택한 후보 일정에 적용'; state.notice = '모든 후보 그룹의 선택을 확인해 주세요. 기존 일정은 유지했어요.'; return { ...session, turns: [...session.turns, { id: session.nextId, state }], nextId: session.nextId + 1 }; }
    }
    if (!groups.length || groups.some(g => !g.selectedId || !g.optionIds.includes(g.selectedId) || g.day > state.days || state.plan.some(v => sameSlot(v, g) && v.locked)) || state.plan.length + groups.length > MAX_PLAN_VISITS) blocked('모든 후보 그룹에서 하나씩 선택해 주세요. 예약 숙소와 기존 일정은 그대로 유지했어요.');
    else {
      for (const group of groups) {
        const index = state.plan.findIndex(visit => sameSlot(visit, group));
        const previous = index >= 0 ? state.plan[index] : undefined;
        const replacement: Visit = {
          ...previous, id: previous?.id ?? nextId(state.plan), day: group.day,
          kind: group.kind, entityId: group.selectedId!, anchorId: group.anchorId,
          label: group.slot, locked: false,
        };
        delete replacement.status;
        if (index < 0) insert(replacement);
        else state.plan = state.plan.flatMap((visit, position) => position === index ? [replacement] : sameSlot(visit, group) ? [] : [visit]);
      }
      state.pendingCandidates = []; state.notice = '선택한 후보를 한 번에 일정에 적용했어요. 다른 DAY·방문·예약 숙소는 유지했어요.';
    }
    state.question = '선택한 후보 일정에 적용'; state.stage = 'plan';
  } else if (action.type === 'trash' || action.type === 'restore' || action.type === 'delete-permanent') {
    const saved = library.find(plan => plan.id === action.id);
    if (!saved) blocked('저장 여행을 찾을 수 없거나 보관 기간이 지났어요.');
    else if (action.type === 'trash' && !saved.deletedAt) { library = library.map(plan => plan.id === saved.id ? { ...plan, deletedAt: now.toISOString(), purgeAfter: trashExpiry(now) } : plan); state.notice = '저장본을 휴지통으로 옮겼어요. 6개월 동안 복원할 수 있고 현재 편집 중인 여행은 유지돼요.'; }
    else if (action.type === 'restore' && saved.deletedAt) { library = library.map(plan => { if (plan.id !== saved.id) return plan; const restored = { ...plan }; delete restored.deletedAt; delete restored.purgeAfter; return restored; }); state.notice = '저장 여행을 복원했어요.'; }
    else if (action.type === 'delete-permanent' && saved.deletedAt && action.confirmed === true) { library = library.filter(plan => plan.id !== saved.id); state.notice = '확인한 저장본을 영구 삭제했어요. 현재 편집 중인 여행은 유지돼요.'; }
    else blocked('휴지통에 있는 저장 여행을 확인해 주세요.');
    state.question = action.type === 'restore' ? '저장 여행 복원' : '저장 여행 삭제'; state.stage = action.type === 'trash' ? 'library' : 'trash';
  } else if (action.type === 'trash-list') { state.stage = 'trash'; state.question = '여행 휴지통 보여줘'; state.notice = '이 기기에서 삭제한 저장 여행이에요. 삭제 후 6개월 동안 복원할 수 있어요.'; }
  if (state.stage === 'library' || state.stage === 'trash') state.librarySnapshot = library.map(plan => ({ ...plan, visits: plan.visits.map(v => ({ ...v })) }));
  if (state.editingId && !findVisit(state.editingId)) state.editingId = null;
  if (state.directionsVisitId && !findVisit(state.directionsVisitId)) state.directionsVisitId = null;
  state.activeDay = Math.max(1, Math.min(state.days, state.activeDay));
  return { ...session, turns: [...session.turns, { id: session.nextId, state }], nextId: session.nextId + 1, library };
}
