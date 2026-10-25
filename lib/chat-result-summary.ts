import type { ChatRequest } from './chat-contract';
import { currentTrip, visitName, type TripState, type TripAction } from './trip-engine';
import { period } from './trip-data';
import { NEARBY_GROUPING_NOTICE } from './itinerary-proximity';

/** A strict display command can use the existing plan without any new inference. */
export function explicitExistingDayView(request: ChatRequest): Extract<TripAction, { type: 'show' }> | null {
  if (request.action.type !== 'message') return null;
  const state = currentTrip(request.session);
  if (!state.plan.length) return null;
  const match = request.action.text.trim().match(
    /^(?:기존\s*)?(?:DAY\s*([1-9]|[12]\d|30)|([1-9]|[12]\d|30)\s*일\s*차)(?:의)?\s*(?:여행\s*)?(?:일정|계획|코스)?\s*만?\s*(?:보여\s*(?:줘|주세요|줄래)|열어\s*줘)([\s\S]*)$/iu,
  );
  if (!match) return null;
  const day = Number(match[1] ?? match[2]);
  if (day > state.days) return null;
  const tail = match[3].replace(/[\s,.!?。！？·]/g, '');
  if (tail) {
    const preserve = tail.match(/^(.*?)(?:그대로)?(?:유지해(?:줘|주세요)?|둬(?:줘)?|두세요)$/u);
    if (!preserve || preserve[1].replace(/(?:예약한숙소|다른날짜일정|나머지일정|나머지방문|다른날짜|전체|여행|기간|일정|숙소|과|와|및|은|는|을|를|그대로)/gu, '') !== '') return null;
  }
  return { type: 'show', stage: 'plan', day };
}

/** Open calculated checks only for a complete, explicit inspection-only request. */
export function explicitExistingItineraryCheck(request: ChatRequest): { type: 'check' } | null {
  if (request.action.type !== 'message' || !currentTrip(request.session).plan.length) return null;
  const text = request.action.text.replace(/[\s.!?。！？]/gu, '');
  const subject = '(?:(?:기존|현재|전체|나머지)?(?:일정|메모|방문시간|시간|체류시간|날짜|여행기간|예약한숙소))';
  const subjects = `${subject}(?:(?:과|와|및|·|,)${subject})*`;
  const preservation = new RegExp(`${subjects}(?:은|는|을|를)?(?:그대로)?(?:유지(?:해줘|해주세요|하고|해)|두고|두세요|둬줘|바꾸지(?:말고|마|말아줘)|변경하지(?:말고|마|말아줘)|수정하지(?:말고|마|말아줘))`, 'gu');
  const remaining = text.replace(preservation, '');
  const existing = '(?:(?:지금|현재|기존|저장된)(?:의)?)?';
  const plan = `${existing}(?:여행)?일정(?:을|은|는)?`;
  const overlap = `(?:${existing}(?:여행)?일정(?:의)?)?(?:방문)?시간(?:이)?겹치는지`;
  const result = '점검결과(?:를|만|만을)?보여(?:줘|주세요|줄래)';
  const inspect = `(?:점검해(?:줘|주세요|줄래)|${result})`;
  return new RegExp(`^(?:${plan}|${overlap})만?${inspect}(?:${result})?$`, 'u').test(remaining)
    ? { type: 'check' }
    : null;
}

export function existingDayViewMessage(state: TripState, day: number): string {
  const visits = state.plan.filter(visit => visit.day === day);
  return [`DAY ${day} 일정이에요.`, visits.length
    ? visits.map(visit => `- ${visit.label}: ${visitName(visit)}${visit.locked ? ' (예약 유지)' : ''}`).join('\n')
    : '이 날짜에 담긴 방문은 아직 없어요.', '전체 여행 기간과 다른 날짜 일정은 그대로 두었어요.'].join('\n\n');
}

/** Describe the committed result, retaining useful caveats rather than an old caption. */
export function builtItineraryMessage(state: TripState, modelMessage: string): string {
  const visits = state.plan.filter(visit => visit.kind === 'place');
  const lines = [`${state.region ? `${state.region} ` : ''}${period(state.days)} 일정 초안을 만들었어요. 방문지 ${visits.length}곳을 배치했어요.`];
  if (state.booked || state.plan.some(visit => visit.locked)) lines.push('예약한 숙소는 그대로 유지했어요.');
  const excluded = [!state.meals && '식당', !state.cafes && '카페', !state.lodging && !state.booked && '숙소'].filter(Boolean);
  if (excluded.length) lines.push(`${excluded.join('·')} 추천은 제외했어요.`);
  if (state.notice.includes(NEARBY_GROUPING_NOTICE)) lines.push(NEARBY_GROUPING_NOTICE);
  const caveats = modelMessage.split(/\n+|[.!?。！？]+(?:\s+|$)/u).map(sentence => sentence.trim()).filter(sentence =>
    sentence.length > 0 && /예약|운항|개방|기상|휴무|입장|통제|탐방|예매|현장|교통|날씨|혼잡|공식\s*(?:자료|안내)|이동\s*시간/u.test(sentence) &&
    [...sentence.matchAll(/(\d{1,2})\s*박\s*(\d{1,2})\s*일/gu)].every(([, nights, days]) => Number(days) === state.days && Number(nights) === state.days - 1),
  );
  for (const caveat of new Set(caveats)) {
    // Keep complete caveats; the resulting persisted assistant message has the
    // same 4,000-character bound as a validated provider reply.
    if (lines.join('\n\n').length + 2 + caveat.length <= 4000) lines.push(caveat);
  }
  return lines.join('\n\n');
}
