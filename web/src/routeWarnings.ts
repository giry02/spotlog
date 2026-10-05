import type { Place } from './data';
import type { RouteResult } from './routeData';
import { scheduleCheckForLeg } from './routeData.ts';
import { hasLocation } from './tripPlan.ts';

export interface RouteWarning {
  id: string;
  code: 'ESTIMATED_TIME_CONFLICT' | 'TRAVEL_TIME_UNVERIFIED' | 'LOCATION_UNVERIFIED' | 'SCHEDULE_INCOMPLETE';
  visitId: string;
  fromVisitId?: string;
  evidence: 'estimate' | 'unverified';
  source: 'STRAIGHT_LINE' | 'DRIVING_REFERENCE' | 'MISSING_LOCATION';
  shortfallMinutes?: number;
  actions: Array<'edit-time' | 'move-day' | 'replace-business' | 'view-place'>;
}

/** A missing stop must not produce a false direct-leg schedule comparison. */
export function adjacentRouteLeg(places: Place[], from: Place, to: Place): boolean {
  const index = places.findIndex(place => place.visitId ? place.visitId === from.visitId : place === from);
  return index >= 0 && places[index + 1] === to;
}

export function routeWarnings(places: Place[], result: RouteResult): RouteWarning[] {
  const warnings: RouteWarning[] = places.filter(place => !hasLocation(place) && place.visitId).map(place => ({
    id: `location:${place.visitId}`, code: 'LOCATION_UNVERIFIED', visitId: place.visitId!, evidence: 'unverified',
    source: 'MISSING_LOCATION', actions: ['view-place'],
  }));
  for (const leg of result.legs) {
    if (!leg.to.visitId || !adjacentRouteLeg(places, leg.from, leg.to)) continue;
    const check = scheduleCheckForLeg(leg);
    const code = leg.mode === 'WALK' ? 'TRAVEL_TIME_UNVERIFIED' : !check ? 'SCHEDULE_INCOMPLETE' : check.margin < 0 ? 'ESTIMATED_TIME_CONFLICT' : null;
    if (!code) continue;
    warnings.push({ id: `${code}:${leg.from.visitId}:${leg.to.visitId}`, code, visitId: leg.to.visitId,
      fromVisitId: leg.from.visitId, evidence: code === 'ESTIMATED_TIME_CONFLICT' ? 'estimate' : 'unverified',
      source: result.source === 'ROAD' ? 'DRIVING_REFERENCE' : 'STRAIGHT_LINE',
      ...(check && check.margin < 0 ? { shortfallMinutes: -check.margin } : {}),
      actions: ['edit-time', ...(leg.to.kind !== 'STAY' ? ['move-day' as const] : []),
        ...(['FOOD', 'CAFE'].includes(leg.to.kind) ? ['replace-business' as const] : [])],
    });
  }
  return warnings;
}
