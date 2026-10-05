/** Deterministic sample rules, not a language-model interpretation. Explicit exclusions win. */
export interface PlannerIntent {
  food: 'include' | 'exclude'; cafe: 'include' | 'exclude'; stay: 'include' | 'exclude' | 'booked';
  lunch: boolean; dinner: boolean; reasons: string[];
}
const food = '(?:음식점|식당|맛집|식사|음식|밥|restaurants?|food|meals?)';
const cafe = '(?:카페|커피|caf[eé]s?|coffee)';
const stay = '(?:숙소|숙박|호텔|펜션|리조트|hotels?|accommodation|lodging)';
function excludes(text: string, subject: string): boolean {
  // "Do not leave out restaurants" asks for inclusion, not exclusion.
  text=text.replace(new RegExp(`(${subject})(?:은|는|도|를|을)?\\s*(?:빼지\\s*마|제외하지\\s*마|빼면\\s*안|제외하면\\s*안)[^,.!?\\n]{0,3}`,'gi'),'$1 포함');
  const any=`(?:${food}|${cafe}|${stay}|점심|저녁|lunch|dinner)`;
  const joined=`${subject}(?:(?:와|과|랑|하고|및|and|,|\\s)+${any})+(?:은|는|도|를|을)?\\s*(?:빼|제외|없이|알아서|따로)`;
  if(new RegExp(joined,'i').test(text))return true;
  return new RegExp(`${subject}(?:은|는|도|를|을|만)?\\s*(?:추천\\s*)?(?:빼|제외|말고|없이|안\\s*(?:넣|가|해|먹|추천)|넣지\\s*(?:마|않)|추천하지\\s*(?:마|않)|필요\\s*없|알아서|따로)|(?:no|without|exclude|skip)\\s+(?:any\\s+)?${subject}|${subject}\\s+(?:not needed|on my own|separately)`, 'i').test(text);
}
export function readPlannerIntent(prompt: string, dayCount: number, meals = ''): PlannerIntent {
  const text = `${prompt} ${meals}`.toLocaleLowerCase();
  const onlySights = /(?:관광지|랜드마크|명소)(?:만|\s*위주로만)|(?:landmarks?|sights?|sightseeing)\s+only|only\s+(?:landmarks?|sights?|sightseeing)/i.test(text);
  const excludeFood = onlySights || excludes(text, food);
  const excludeCafe = onlySights || excludes(text, cafe);
  const excludeStay = onlySights || excludes(text, stay);
  // A negated reservation must not become an existing booking.
  const unbooked = /예약(?:은|는|을)?\s*(?:안|못|하지\s*않|전|아직|취소)|아직\s*(?:예약|숙소|호텔)|not\s+(?:yet\s+)?booked|haven['’]?t\s+booked/i.test(text);
  const booked = !unbooked && new RegExp(`${stay}[^,.!?\\n]{0,16}(?:이미\\s*예약(?=\\s|$|[,.!?])|예약(?:은|는|을)?\\s*(?:완료|했|해|됨|돼|되어)|잡아\\s*(?:놨|뒀|놓|두)|정해\\s*(?:놨|뒀|놓)|already\\s*booked|is\\s*booked)|(?:이미\\s*예약한|예약한|예약해\\s*둔|booked|reserved)\\s*${stay}`, 'i').test(text);
  const lunch = !excludeFood && !excludes(text, '(?:점심|lunch)');
  const dinner = !excludeFood && !excludes(text, '(?:저녁|dinner)');
  const result: PlannerIntent = {
    food: lunch || dinner ? 'include' : 'exclude', lunch, dinner,
    cafe: !excludeCafe && new RegExp(cafe, 'i').test(text) ? 'include' : 'exclude',
    stay: dayCount < 2 || excludeStay ? 'exclude' : booked ? 'booked' : 'include', reasons: [],
  };
  if (onlySights) result.reasons.push('관광지만 요청해 식사·카페·숙박을 제외했어요.');
  else {
    if (result.food === 'exclude') result.reasons.push('요청에 따라 식당 추천을 제외했어요.');
    if (result.cafe === 'exclude' && new RegExp(cafe, 'i').test(text)) result.reasons.push('요청에 따라 카페를 제외했어요.');
    if (result.stay === 'booked') result.reasons.push('예약한 숙소는 유지하고 새 숙소를 추천하지 않아요.');
    else if (excludeStay) result.reasons.push('요청에 따라 숙소 추천을 제외했어요.');
  }
  return result;
}
