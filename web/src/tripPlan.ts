import type { Journey, JourneyDay, Place, PlaceKind } from './data';
import { normalizeVisits } from './visits.ts';
import { clearVisitProgress, reconcileTravelProgress } from './tripProgress.ts';

const id = (): string => crypto.randomUUID();
const planningOrder = ['morning', 'lunch', 'afternoon', 'dinner', 'stay'];
function withoutPlanningSlot(place: Place): Place {
  const { planningSlot: _planningSlot, ...rest } = place;
  return rest;
}
/** Keep unfilled slots on their DAY, with references only to its surviving landmarks. */
function reconcilePlanningGaps(day: JourneyDay): JourneyDay {
  if (!day.planningGaps) return day;
  const landmarks = day.places.filter(place => place.kind === 'LANDMARK' && place.visitId);
  const positions = new Map(landmarks.map((place, index) => [place.visitId, index]));
  const planningGaps = day.planningGaps.map(gap => {
    const after = gap.afterVisitId === undefined ? undefined : positions.get(gap.afterVisitId);
    const before = gap.beforeVisitId === undefined ? undefined : positions.get(gap.beforeVisitId);
    if ((gap.afterVisitId === undefined || after !== undefined) && (gap.beforeVisitId === undefined || before !== undefined) && (after === undefined || before === undefined || after < before)) return gap;
    // Prefer a surviving boundary. If both disappeared, locate the slot among current visits.
    let boundary = before ?? (after === undefined ? undefined : after + 1);
    if (boundary === undefined) {
      const slot = planningOrder.indexOf(gap.slot);
      boundary = landmarks.findIndex(place => {
        const candidate = planningOrder.indexOf(place.planningSlot ?? 'morning');
        return gap.kind === 'CAFE' ? candidate > slot : candidate >= slot;
      });
      if (boundary < 0) boundary = landmarks.length;
    }
    const { afterVisitId: _after, beforeVisitId: _before, ...rest } = gap;
    return { ...rest, ...(landmarks[boundary - 1] ? { afterVisitId: landmarks[boundary - 1].visitId } : {}), ...(landmarks[boundary] ? { beforeVisitId: landmarks[boundary].visitId } : {}) };
  });
  return { ...day, planningGaps };
}
export const isPersonalPlan = (journey: Journey) => journey.isMine && journey.purpose === 'PLAN';
export const hasLocation = (place: Place) => place.locationVerified !== false && Number.isFinite(place.lat) && Number.isFinite(place.lng) && Math.abs(place.lat) <= 90 && Math.abs(place.lng) <= 180;
export function distanceBetween(a: Place, b: Place): number | null {
  if (!hasLocation(a) || !hasLocation(b)) return null;
  const rad = Math.PI / 180;
  const h = Math.sin((b.lat - a.lat) * rad / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lng - a.lng) * rad / 2) ** 2;
  return 12742 * Math.atan2(Math.sqrt(Math.min(1, h)), Math.sqrt(Math.max(0, 1 - h)));
}
export function normalizePlan(journey: Journey): Journey {
  const normalized=normalizeVisits(journey);
  const first=normalized.days[0]?.date;
  const inferred=isPersonalPlan(journey)&&/^\d{4}-\d{2}-\d{2}$/.test(first??'')&&Number.isFinite(Date.parse(first))&&normalized.days.every((day,index)=>day.date===new Date(Date.parse(`${first}T00:00:00Z`)+index*86400000).toISOString().slice(0,10))?first:undefined;
  return reconcileTravelProgress({ ...normalized,...(normalized.startDate||inferred?{startDate:normalized.startDate??inferred}:{}), days: normalized.days.map(day => {
    const order=new Map(day.places.map((place,index)=>[place.visitId,index]));
    const cards=day.blocks.filter(block=>block.type==='PLACE').sort((a,b)=>(order.get(a.visitId)??Infinity)-(order.get(b.visitId)??Infinity));let index=0;
    return {...day,dayId:day.dayId??`${journey.id}:day-${day.day}`,blocks:isPersonalPlan(journey)?day.blocks.map(block=>block.type==='PLACE'?cards[index++]:block):day.blocks};
  }) });
}
export function setPlanDates(journey: Journey, startDate: string): Journey {
  if (startDate && (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !Number.isFinite(Date.parse(`${startDate}T00:00:00Z`)) || new Date(`${startDate}T00:00:00Z`).toISOString().slice(0,10) !== startDate)) throw new Error('출발 날짜를 확인해 주세요.');
  const days = journey.days.map((day, index) => ({ ...day, day: index + 1, date: startDate ? new Date(Date.parse(`${startDate}T00:00:00Z`) + index * 86400000).toISOString().slice(0,10) : `DAY ${index + 1}` }));
  return { ...journey, startDate: startDate || undefined, days, duration: period(days.length), dateRange: startDate ? `${days[0].date} ~ ${days.at(-1)!.date}` : '날짜 미정' };
}
function refreshDates(journey: Journey): Journey {
  if(journey.startDate)return setPlanDates(journey,journey.startDate);
  return {...journey,duration:period(journey.days.length),days:journey.days.map((day,index)=>({...day,day:index+1,date:/^DAY\s+\d+$/i.test(day.date)?`DAY ${index+1}`:day.date}))};
}
export function buildPersonalPlan(places: Place[], days: number, title: string, author: string): Journey {
  if (!Number.isInteger(days) || days < 1 || days > 30) throw new Error('여행 기간을 확인해 주세요.');
  const tripId = `trip-${id()}`;
  const unique = [...new Map(places.map(place => [place.id, place])).values()];
  const region = [...new Set(unique.map(place => place.area.split(' ')[0]))].join(' · ') || '국내';
  const tripDays: JourneyDay[] = Array.from({ length: days }, (_, i) => ({ dayId: id(), day: i + 1, date: `DAY ${i + 1}`, title: `${i + 1}일차`, story: '', places: [], blocks: [] }));
  unique.forEach((source, i) => {
    const day = tripDays[Math.min(days - 1, Math.floor(i * days / Math.max(unique.length, days)))];
    const place = { ...withoutPlanningSlot(structuredClone(source)), visitId: id(), note: source.personal?source.note:'', time:undefined,move:undefined,anchorVisitId: undefined, stayDayIds: undefined, bookingFixed: undefined };
    day.places.push(place);
    day.blocks.push({ id: id(), type: 'PLACE', placeId: place.id, visitId: place.visitId });
  });
  return { id: tripId, purpose: 'PLAN', title: title.trim() || `${region} ${days === 1 ? '당일' : `${days - 1}박 ${days}일`} 여행`, region,
    dateRange: '날짜 미정', duration: days === 1 ? '당일 여행' : `${days - 1}박 ${days}일`, status: 'PLANNING', visibility: 'PRIVATE',
    cover: unique[0]?.image ?? '', summary: `저장한 ${unique.length}곳으로 시작하는 내 여행`, story: '', tags: [], saves: 0, views: 0, author, isMine: true, days: tripDays };
}
export function nearbyCandidates(anchor: Place, catalog: Place[], kind: PlaceKind, radiusKm = 15): Place[] {
  return [...new Map(catalog.filter(place => place.kind === kind && place.id !== anchor.id).map(place => [place.id, place])).values()]
    .filter(place => { const distance = distanceBetween(anchor, place); return distance !== null && distance <= radiusKm; })
    .sort((a, b) => (distanceBetween(anchor, a) ?? Infinity) - (distanceBetween(anchor, b) ?? Infinity));
}
export function appendPlanLandmark(journey: Journey, dayId: string, source: Place): Journey {
  if (!isPersonalPlan(journey)) throw new Error('내 여행에서만 담을 수 있어요.');
  const day = journey.days.find(day => day.dayId === dayId);
  if (!day) throw new Error('날짜가 바뀌었어요. 다시 선택해 주세요.');
  if (day.places.some(place => place.id === source.id)) return journey;
  const place = { ...withoutPlanningSlot(structuredClone(source)), visitId: id(),note:source.personal?source.note:'',time:undefined,move:undefined, anchorVisitId: undefined };
  return { ...journey, cover: journey.cover || source.image, days: journey.days.map(item => item.dayId === dayId ? { ...item, places: [...item.places.filter(place=>place.kind!=='STAY'), place,...item.places.filter(place=>place.kind==='STAY')], blocks: [...item.blocks, { id: id(), type: 'PLACE', placeId: place.id, visitId: place.visitId }] } : item) };
}
export function insertNearby(journey: Journey, dayId: string, anchorId: string, source: Place): Journey {
  if (!isPersonalPlan(journey)) throw new Error('내 여행에서만 담을 수 있어요.');
  const day = journey.days.find(item => item.dayId === dayId);
  const anchor = day?.places.find(place => place.visitId === anchorId);
  if (!day || !anchor) throw new Error('기준 장소가 바뀌었어요. 다시 선택해 주세요.');
  if (day.places.some(place => place.id === source.id && place.anchorVisitId === anchorId)) return journey;
  const visit: Place = { ...withoutPlanningSlot(structuredClone(source)), visitId: id(),note:source.personal?source.note:'',time:undefined,move:undefined, anchorVisitId: anchorId };
  const index = day.places.findIndex(place => place.visitId === anchorId);
  let insertAt = index + 1;
  while (day.places[insertAt]?.anchorVisitId === anchorId) insertAt++;
  const places = [...day.places.slice(0, insertAt), visit, ...day.places.slice(insertAt)];
  const anchorBlock = day.blocks.findIndex(block => block.visitId === anchorId);
  const blocks = [...day.blocks];
  blocks.splice(anchorBlock < 0 ? blocks.length : anchorBlock + insertAt - index, 0, { id: id(), type: 'PLACE', placeId: visit.id, visitId: visit.visitId });
  return { ...journey, days: journey.days.map(item => item.dayId === dayId ? { ...item, places, blocks } : item) };
}
export function reorderPlanVisit(journey: Journey, dayId: string, visitId: string, direction: -1 | 1): Journey {
  if (!isPersonalPlan(journey)) return journey;
  return { ...journey, days: journey.days.map(day => {
    if (day.dayId !== dayId) return day;
    const groups: Place[][] = [];
    for (const place of day.places) {
      const parent = place.anchorVisitId && groups.find(group => group[0].visitId === place.anchorVisitId);
      if (parent) parent.push(place); else groups.push([place]);
    }
    const index = groups.findIndex(group => group.some(place => place.visitId === visitId));
    const next = index + direction;
    if (index < 0 || next < 0 || next >= groups.length || groups[index][0].kind === 'STAY' || groups[next][0].kind === 'STAY') return day;
    [groups[index], groups[next]] = [groups[next], groups[index]];
    const places = groups.flat();
    const positions = new Map(places.map((place, i) => [place.visitId, i]));
    const placeBlocks = day.blocks.filter(block => block.type === 'PLACE').sort((a,b) => (positions.get(a.visitId) ?? Infinity) - (positions.get(b.visitId) ?? Infinity));
    let blockIndex = 0;
    return reconcilePlanningGaps({ ...day, places, blocks: day.blocks.map(block => block.type === 'PLACE' ? placeBlocks[blockIndex++] : block) });
  }) };
}
export function removePlanVisit(journey: Journey, visitId: string, includeRelated: boolean): Journey {
  if (!isPersonalPlan(journey)) return journey;
  const removed = new Set(journey.days.flatMap(day => day.places).filter(place => place.visitId === visitId || (includeRelated && place.anchorVisitId === visitId)).map(place => place.visitId));
  return { ...journey, days: journey.days.map(day => reconcilePlanningGaps({ ...day,
    places: day.places.filter(place => !removed.has(place.visitId)).map(place => place.anchorVisitId === visitId ? { ...place, anchorVisitId: undefined } : place),
    blocks: day.blocks.filter(block => !block.visitId || !removed.has(block.visitId)),
  })) };
}

function period(days: number) { return days === 1 ? '당일 여행' : `${days - 1}박 ${days}일`; }
export function addPlanDay(journey: Journey): Journey {
  if (!journey.isMine || journey.days.length >= 30) throw new Error('여행은 30일까지 만들 수 있어요.');
  const day = journey.days.length + 1;
  return refreshDates({ ...journey, days: [...journey.days, { dayId: id(), day, date: `DAY ${day}`, title: `${day}일차`, story: '', places: [], blocks: [] }] });
}
export function removePlanDay(journey: Journey, dayId: string): Journey {
  if (!journey.isMine || journey.days.length <= 1) throw new Error('DAY는 한 개 이상 있어야 해요.');
  if(isPersonalPlan(journey)&&journey.days.at(-1)?.dayId===dayId&&journey.days.at(-2)?.places.some(place=>place.kind==='STAY'))throw new Error('전날 숙소가 연결돼 있어요. 숙박을 먼저 일정에서 빼거나 다른 DAY를 선택해 주세요.');
  const removedVisits = new Set(journey.days.find(day => day.dayId === dayId)?.places.map(place => place.visitId));
  const remainingDays = journey.days.filter(day => day.dayId !== dayId);
  const days = remainingDays.map((day, i) => reconcilePlanningGaps({ ...day, day: i + 1, ...(isPersonalPlan(journey) && day.planningGaps && i === remainingDays.length - 1 ? { planningGaps: day.planningGaps.filter(gap => gap.kind !== 'STAY') } : {}), places: day.places.map(place => ({ ...place, anchorVisitId: removedVisits.has(place.anchorVisitId) ? undefined : place.anchorVisitId, stayDayIds: place.stayDayIds?.filter(id => id !== dayId) })) }));
  return refreshDates({ ...journey, days });
}
function copiedDays(sourceDays: JourneyDay[], itineraryOnly = false): JourneyDay[] {
  const dayIds = new Map(sourceDays.map(day => [day.dayId, id()]));
  const visitIds = new Map(sourceDays.flatMap(day => day.places).map(place => [place.visitId, id()]));
  return sourceDays.map(day => ({ ...structuredClone(day), dayId: dayIds.get(day.dayId), story: itineraryOnly ? '' : day.story,
    ...(day.planningGaps ? { planningGaps: day.planningGaps.map(gap => {
      const { afterVisitId, beforeVisitId, ...rest } = structuredClone(gap);
      const visitsOnDay = new Set(day.places.map(place => place.visitId));
      return { ...rest, id: id(), ...(afterVisitId && visitsOnDay.has(afterVisitId) ? { afterVisitId: visitIds.get(afterVisitId) } : {}), ...(beforeVisitId && visitsOnDay.has(beforeVisitId) ? { beforeVisitId: visitIds.get(beforeVisitId) } : {}) };
    }) } : {}),
    places: day.places.map(place => ({ ...structuredClone(place), visitId: visitIds.get(place.visitId), anchorVisitId: visitIds.get(place.anchorVisitId), stayDayIds: place.stayDayIds?.map(dayId => dayIds.get(dayId)).filter((value): value is string => Boolean(value)) })),
    blocks: day.blocks.filter(block => !itineraryOnly || block.type === 'PLACE').map(block => ({ ...structuredClone(block), id: id(), visitId: visitIds.get(block.visitId), images: block.images?.map(image => ({ ...image, id: id() })) })),
  }));
}
export function copyPersonalPlan(source: Journey, author: string): Journey {
  const { publicAuthorId: _publicAuthorId, publicSourceKind: _publicSourceKind, ...clean } = normalizePlan(source);
  // Legacy sources are normalized by App before this operation. Authored originals remain untouched.
  return { ...structuredClone(clean), travelProgress: undefined, id: `trip-${id()}`, purpose: 'PLAN', sourceTripId: undefined, editorDraft: undefined, sourceJourneyId: source.id, sourceAuthor: source.author,
    title: `${source.title} · 내 동선`, story: '', summary: '가고 싶은 곳을 내 동선으로 가져왔어요.', status: 'PLANNING', visibility: 'PRIVATE', author, isMine: true, saves: 0, views: 0,
    days: copiedDays(clean.days, true),
  };
}
export function makeJournalFromPlan(source: Journey, author: string): Journey {
  if (!isPersonalPlan(source)) throw new Error('내 여행에서 여행기를 만들 수 있어요.');
  const days = copiedDays(normalizePlan(source).days, true).map(day => {
    const { planningGaps: _planningGaps, ...journalDay } = day;
    return { ...journalDay, places: day.places.map(place => ({ ...withoutPlanningSlot(place), note: '', move:undefined, bookingFixed: undefined })) };
  });
  const { publicAuthorId: _publicAuthorId, publicSourceKind: _publicSourceKind, ...journalSource } = source;
  return { ...structuredClone(journalSource), travelProgress: undefined, id: `journal-${id()}`, purpose: 'JOURNAL', sourceTripId: source.id, planningPreferences: undefined, editorDraft: undefined, title: source.title,
    status: 'PLANNING', visibility: 'PRIVATE', story: '', summary: '', author, isMine: true, saves: 0, views: 0, days };
}
export function copyPlanDay(journey: Journey, dayId: string): Journey {
  const day = journey.days.find(day => day.dayId === dayId);
  const overnight=isPersonalPlan(journey)&&Boolean(day?.places.some(place=>place.kind==='STAY') || day?.planningGaps?.some(gap=>gap.kind==='STAY'));
  if (!journey.isMine || !day || journey.days.length + (overnight?2:1) > 30) throw new Error('이 날짜를 복사할 수 없어요. 여행은 30일까지 가능해요.');
  const nextDay = journey.days.length + 1;
  const copy = copiedDays([day])[0];
  copy.day = nextDay; copy.date = `DAY ${nextDay}`;
  if(overnight)copy.places=copy.places.map(place=>place.kind==='STAY'?{...place,bookingFixed:false}:place);
  const result=refreshDates({ ...journey, days: [...journey.days, copy] });
  return overnight?addPlanDay(result):result;
}
export function transferVisit(journey: Journey, sourceDayId: string, visitId: string, targetDayId: string, copy: boolean, includeRelated = true): Journey {
  if (!journey.isMine) throw new Error('내 여행에서만 바꿀 수 있어요.');
  const from = journey.days.find(day => day.dayId === sourceDayId), to = journey.days.find(day => day.dayId === targetDayId);
  const original = from?.places.find(place => place.visitId === visitId);
  if (!from || !to || !original) throw new Error('이동할 장소나 날짜를 찾을 수 없어요.');
  if (isPersonalPlan(journey) && original.kind === 'STAY') throw new Error('숙소의 숙박일은 숙소 메뉴에서 변경해 주세요.');
  if (!copy && sourceDayId === targetDayId) return journey;
  const selected = from.places.filter(place => place.visitId === visitId || (includeRelated && place.anchorVisitId === visitId));
  const selectedIds = new Set(selected.map(place => place.visitId));
  const slice = { ...from, places: selected, blocks: from.blocks.filter(block => block.visitId && selectedIds.has(block.visitId)) };
  const moved = copy ? copiedDays([slice])[0] : structuredClone(slice);
  moved.places = moved.places.map(place => ({ ...withoutPlanningSlot(place), anchorVisitId: selectedIds.has(place.anchorVisitId) || moved.places.some(parent => parent.visitId === place.anchorVisitId) ? place.anchorVisitId : undefined }));
  return { ...journey, days: journey.days.map(day => {
    let result = day;
    if (!copy && day.dayId === sourceDayId) result = { ...day, places: day.places.filter(place => !selectedIds.has(place.visitId)).map(place => selectedIds.has(place.anchorVisitId) ? { ...place, anchorVisitId: undefined } : place), blocks: day.blocks.filter(block => !block.visitId || !selectedIds.has(block.visitId)) };
    if (day.dayId === targetDayId) result = { ...result, places: isPersonalPlan(journey)?[...result.places.filter(place=>place.kind!=='STAY'), ...moved.places, ...result.places.filter(place=>place.kind==='STAY')]:[...result.places,...moved.places], blocks: [...result.blocks, ...moved.blocks] };
    return reconcilePlanningGaps(result);
  }) };
}
export function setPlanStay(journey: Journey, place: Place, startDayId: string, nights: number, fixed: boolean): Journey {
  const start = journey.days.findIndex(day => day.dayId === startDayId);
  if (!isPersonalPlan(journey) || start < 0 || nights < 1 || !Number.isInteger(nights) || start + nights >= journey.days.length) throw new Error('숙박일과 여행 기간을 확인해 주세요.');
  const selected = journey.days.slice(start, start + nights);
  if (selected.some(day => day.places.some(stay => stay.kind === 'STAY' && stay.bookingFixed && stay.id !== place.id))) throw new Error('예약한 숙소가 고정돼 있어요. 먼저 고정을 해제해 주세요.');
  return { ...journey, days: journey.days.map(day => {
    if (!selected.some(item => item.dayId === day.dayId)) return day;
    const current = day.places.find(item => item.kind === 'STAY' && item.id === place.id);
    const stay = { ...structuredClone(place),note:current?.note??(place.personal?place.note:''),time:current?.time, visitId: current?.visitId ?? id(), kind: 'STAY' as const, anchorVisitId: undefined, stayDayIds: [day.dayId!], bookingFixed: Boolean(current?.bookingFixed||fixed) };
    const oldStays = new Set(day.places.filter(item => item.kind === 'STAY').map(item => item.visitId));
    const oldBlock = current&&day.blocks.find(block => block.visitId === current.visitId && block.type === 'PLACE');
    return { ...day, ...(day.planningGaps ? { planningGaps: day.planningGaps.filter(gap => gap.kind !== 'STAY') } : {}), places: [...day.places.filter(place => place.kind !== 'STAY'), stay], blocks: [...day.blocks.filter(block => block.type!=='PLACE'||!oldStays.has(block.visitId)).map(block=>oldStays.has(block.visitId)&&block.visitId!==current?.visitId?{...block,visitId:undefined}:block), { id: oldBlock?.id ?? id(), type: 'PLACE' as const, placeId: stay.id, visitId: stay.visitId }] };
  }) };
}

/** Replace one food/cafe stop in place, without inheriting the old business's private records. */
export function replacePlanBusiness(journey: Journey, dayId: string, visitId: string, source: Place): Journey {
  if (!isPersonalPlan(journey)) throw new Error('내 여행에서만 교체할 수 있어요.');
  const day = journey.days.find(day => day.dayId === dayId);
  const target = day?.places.find(place => place.visitId === visitId);
  if (!day || !target) throw new Error('교체할 장소가 바뀌었어요. 다시 확인해 주세요.');
  if (!['FOOD', 'CAFE'].includes(target.kind) || target.kind !== source.kind) throw new Error('같은 종류의 음식점·카페로 교체해 주세요.');
  if (source.id === target.id) return journey;
  if (day.places.some(place => place.id === source.id)) throw new Error('이 DAY에 이미 담긴 장소예요. 다른 곳을 골라주세요.');
  if (source.area.split(' ')[0] !== target.area.split(' ')[0]) throw new Error('같은 지역의 장소를 골라주세요.');
  const { visitId: _visit, anchorVisitId: _anchor, stayDayIds: _stay, bookingFixed: _fixed, planningSlot: _slot, ...business } = structuredClone(source);
  const replacement: Place = { ...business, visitId, anchorVisitId: target.anchorVisitId,
    planningSlot: target.planningSlot, time: target.time, move: target.move, note: '' };
  return clearVisitProgress({ ...journey, days: journey.days.map(item => item.dayId !== dayId ? item : {
    ...item, places: item.places.map(place => place.visitId === visitId ? replacement : place),
    blocks: item.blocks.map(block => block.type === 'PLACE' && block.visitId === visitId ? { ...block, placeId: source.id } : block),
  }) }, visitId);
}
