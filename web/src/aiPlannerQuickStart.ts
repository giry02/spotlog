import type { Place } from './data';
import type { PlannerConditions } from './aiPlanner';
import { interpretTravelPrompt } from './aiTravelDraft.ts';
import { distanceBetween } from './tripPlan.ts';
import { readPlannerIntent } from './plannerIntent.ts';
import { plannerRegionOf } from './itineraryComposer.ts';

/** Clear removed creation inputs without changing visible choices or a generated preview. */
export function normalizeQuickPlannerConditions(current: PlannerConditions): PlannerConditions {
  const intent = readPlannerIntent(current.prompt, current.dayCount);
  return {
    ...current,
    startDate: '', arrival: '', departure: '', walking: 'normal',
    companions: '', meals: '', accessibility: '',
    requiredIds: [], excludedIds: [], fixedIds: [],
    suggestFood: intent.food === 'include', suggestStay: intent.stay === 'include',
  };
}

/** Only supported, explicit phrases are inferred. No claim of model understanding. */
export function readQuickPlannerPrompt(prompt: string, current: PlannerConditions, catalog: Place[]): PlannerConditions {
  const parsed = interpretTravelPrompt({ prompt }, catalog).conditions;
  const durationText = prompt.replace(/\d{4}[-./]\d{1,2}[-./]\d{1,2}|\d+\s*월\s*\d+\s*일/g, '');
  const duration = /\d+\s*(?:박|일|days?|nights?)|당일|하루|일주일|day trip/i.test(durationText);
  const englishDays = durationText.match(/\b(\d+)\s*days?\b/i);
  const englishNights = durationText.match(/\b(\d+)\s*nights?\b/i);
  const mentionsRegion = /서울|부산|제주|경기|인천|강원|충북|충남|대전|세종|전북|전남|광주|경북|경남|대구|울산|seoul|busan|jeju|incheon|daejeon|gwangju|daegu|ulsan/i.test(prompt) || catalog.some(p=>p.area.split(' ').slice(1).some(part=>part.length>1&&prompt.includes(part)));
  const region = mentionsRegion ? parsed.region : current.region;
  const dayCount = duration ? englishDays ? Number(englishDays[1]) : englishNights ? Number(englishNights[1]) + 1 : /day trip/i.test(prompt) ? 1 : parsed.dayCount : current.dayCount;
  const intent=readPlannerIntent(prompt,dayCount,current.meals);
  return {
    ...current, prompt,
    region,
    dayCount,
    suggestFood:intent.food==='include',suggestStay:intent.stay==='include',
    pace: /천천히|여유|덜\s*걷|느리|적게\s*걷|알차|많이\s*보|빼곡|빡빡/.test(prompt) ? parsed.pace : current.pace,
    transport: /대중교통|지하철|버스|렌[트터]|자동차|차량|드라이브|자차|도보|걸어서/.test(prompt) ? parsed.transport : current.transport,
    requiredIds: region !== current.region && current.mode==='region' ? [] : current.requiredIds,
    fixedIds: region !== current.region && current.mode==='region' ? [] : current.fixedIds,
    excludedIds: region !== current.region && current.mode==='region' ? [] : current.excludedIds,
  };
}

/** Match each business to its nearest included landmark, across the selected DAY. */
export function dayBusinessSuggestions(anchors: Place[], catalog: Place[], kind: 'FOOD'|'CAFE'|'STAY', savedIds?: Set<string>, query='') {
  const term=query.trim().toLocaleLowerCase();
  return [...new Map(catalog.map(p=>[p.id,p])).values()]
    .filter(p=>p.kind===kind && (!savedIds||savedIds.has(p.id)) && (!term||`${p.name} ${p.address}`.toLocaleLowerCase().includes(term)))
    .flatMap(place=>{
      const region=plannerRegionOf(place);
      const nearest=anchors.filter(anchor=>region&&plannerRegionOf(anchor)===region).map(anchor=>({anchor,km:distanceBetween(anchor,place)})).filter((item):item is {anchor:Place;km:number}=>item.km!==null&&item.km<=15).sort((a,b)=>a.km-b.km)[0];
      return nearest?[{place,...nearest}]:[];
    }).sort((a,b)=>a.km-b.km);
}
