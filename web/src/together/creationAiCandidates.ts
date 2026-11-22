import type { Place } from '../data';
import { placeAssistantPromptLimit, preparePlaceAssistant } from '../placeAssistantModel.ts';
import { creationCatalogPlaces, type CreationBrief } from './creationPlanner.ts';
import { parseGroupLocality } from './groupRegions.ts';

/** Public, current candidates only. A failed scope never falls back to the whole city. */
export function selectCreationAiCandidates(brief: CreationBrief, places: Place[]): Place[] {
  const base = creationCatalogPlaces(brief, places);
  // Travel can intentionally cross neighborhoods and mix sightseeing, meals, and accommodation.
  if (brief.purpose === 'TRIP') return base;
  if (!['MEETUP', 'OUTING'].includes(brief.purpose) || !base.length) return [];
  const locality = parseGroupLocality(brief.region);
  if (!locality.region) return [];
  const city = creationCatalogPlaces({ region: locality.region }, places);
  const prompt = [brief.prompt, brief.notes].filter(Boolean).join(' ').normalize('NFKC').replace(/\s+/gu, ' ').trim();
  const requested = new Set<Place['kind']>(), excluded = new Set<Place['kind']>(), districts = new Set<string>();
  // The place assistant bounds a search phrase. Overlap keeps normal district/exclusion phrases
  // intact, and combines constraints across the full authored request instead of dropping its end.
  const windows = prompt ? Array.from({ length: Math.ceil(prompt.length / (placeAssistantPromptLimit - 40)) }, (_, index) =>
    prompt.slice(index * (placeAssistantPromptLimit - 40), index * (placeAssistantPromptLimit - 40) + placeAssistantPromptLimit)) : ['함께 만날 장소'];
  for (const phrase of windows) {
    const scope = preparePlaceAssistant({ prompt: phrase, region: locality.region }, city);
    if (scope.issue || scope.region !== locality.region) return [];
    scope.requestedKinds.forEach(kind => requested.add(kind));
    scope.excluded.forEach(kind => excluded.add(kind));
    if (scope.district) districts.add(scope.district);
  }
  if (districts.size > 1) return [];
  const district = [...districts][0];
  const districtIds = district ? new Set(preparePlaceAssistant({ prompt: `${district}에서 만날 장소`, region: locality.region }, city).eligiblePlaces.map(place => place.id)) : null;
  return base.filter(place => !excluded.has(place.kind) && (!requested.size || requested.has(place.kind))
    && (!districtIds || districtIds.has(place.id)));
}
