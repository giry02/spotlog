import type { Place } from '../data';
import type { TogetherState } from './model';
import { selectPersonalRoutes } from './personalRoutes.ts';
import type { PersonalRouteScope } from './personalRouteTypes';

/** RSVP belongs to the activity even when this member has not saved a personal route. */
export function selectPersonalRouteSummary(state: TogetherState, actorId: string, scope: PersonalRouteScope, places: Place[], at = new Date()) {
  const selection = selectPersonalRoutes(state, actorId, scope, places, at);
  const participation = selection.activity.participants[actorId];
  return { ...selection, participation,
    participationLabel: participation === 'JOINED' ? '참가 선택' : participation === 'MAYBE' ? '참석 미정' : participation === 'DECLINED' ? '불참 선택' : '참석 응답 전' };
}
