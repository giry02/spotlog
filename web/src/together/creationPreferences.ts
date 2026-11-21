import type { Journey } from '../data';
import { creationBriefTopics, validateCreationBrief, type CreationBrief } from './creationPlanner.ts';

const transports = { UNSET: 'undecided', WALK: 'walk', PUBLIC: 'transit', CAR: 'car' } as const;

/** Current creator input only. Public/journal content and old planning input are never used. */
export function attachCreationPreferences(journey: Journey, brief: CreationBrief): Journey {
  if (journey.purpose !== 'PLAN' || journey.visibility !== 'PRIVATE' || journey.status !== 'PLANNING' || journey.trash || brief.purpose === 'GROUP') {
    throw new Error('새 비공개 일정에만 계획 내용을 보관할 수 있어요.');
  }
  const issues = validateCreationBrief(brief);
  if (issues.length) throw new Error(issues.join(' '));
  if (!journey.days.length || journey.days.length > 7) throw new Error('보관할 일정의 일수를 다시 확인해 주세요.');
  const topics = creationBriefTopics(brief);
  const request = [
    brief.prompt.trim(),
    brief.notes.trim() ? `추가 조건\n${brief.notes.trim()}` : '',
    brief.budgetPerPerson !== undefined ? `희망 예산 · 1인 ${brief.budgetPerPerson.toLocaleString('ko-KR')}원 이하 (실제 가격 확인 필요)` : '',
    brief.walkingLimitMinutes !== undefined ? `희망 걷기 · ${brief.walkingLimitMinutes}분 이하 (실제 경로 확인 필요)` : '',
  ].filter(Boolean).join('\n\n');
  const explicitStay = /숙소|숙박|호텔|리조트|펜션|게스트하우스|잠잘/.test(brief.prompt)
    && !/(?:숙소|숙박|호텔|리조트|펜션|게스트하우스)[^.!?\n]{0,18}(?:제외|빼|없이|필요\s*없|안\s*(?:찾|넣|담))/.test(brief.prompt);
  return { ...journey, planningPreferences: {
    mode: 'region', region: brief.region, dayCount: journey.days.length, startDate: brief.date,
    prompt: request, pace: 'balanced', transport: transports[brief.transport],
    arrival: brief.startTime, departure: '', walking: 'normal',
    companions: brief.people === undefined ? '' : `${brief.people}명`,
    meals: topics.includes('FOOD') ? '음식점 후보 희망' : '', accessibility: '',
    // The draft's chosen places are visits, never mandatory anchors or fixed bookings.
    requiredIds: [], excludedIds: [], fixedIds: [],
    suggestFood: topics.includes('FOOD'), suggestStay: explicitStay,
  } };
}

/** Only the owner's private itinerary may expose the retained planning input. */
export function privatePlanningPreferences(journey: Journey): Journey['planningPreferences'] | undefined {
  if (!journey.isMine || journey.purpose !== 'PLAN' || journey.visibility !== 'PRIVATE' || journey.trash) return undefined;
  const preferences = journey.planningPreferences;
  return preferences && (preferences.prompt.trim() || preferences.companions.trim() || preferences.transport !== 'undecided' || preferences.arrival)
    ? preferences : undefined;
}
