import type { PlaceKind } from '../data';
import type { ParticipationStatus, TogetherActivity } from './model';

export interface PersonalRouteScope { groupId: string; activityId: string }
/** Stable day + visit identity. Names, branch IDs and ordinal positions never replace a removed visit. */
export interface PersonalRouteStop {
  key: string; dayId: string; visitId: string; day: number; date: string;
  placeId: string; name: string; kind: PlaceKind; area: string; address: string;
  lat?: number; lng?: number; time: string; duration: string; bookingFixed: boolean;
}
export interface PersonalRouteSnapshot {
  date: string; endDate: string; startTime: string; meetingPoint: string;
  venuePlaceId?: string; stops: PersonalRouteStop[];
}
export interface TogetherPersonalRoute extends PersonalRouteScope {
  userId: string; startKey: string; endKey: string; originPlaceId?: string; joinTime?: string;
  snapshot: PersonalRouteSnapshot; revision: number; updatedAt: string;
}
export interface PersonalRouteSaveInput {
  startKey: string; endKey: string; originPlaceId?: string; joinTime?: string;
  expectedRevision: number; routeVersion: string;
}
export interface PersonalRouteChange {
  kind: 'DATE' | 'TIME' | 'MEETING' | 'VENUE' | 'REMOVED' | 'ADDED' | 'ORDER' | 'PLACE' | 'BOOKING';
  label: string; before?: string; after?: string; stopKey?: string;
}
export interface PersonalRouteView extends Omit<TogetherPersonalRoute, 'snapshot'> {
  status: 'CURRENT' | 'CHANGED' | 'INVALID'; stops: PersonalRouteStop[];
  previousStops: PersonalRouteStop[]; changes: PersonalRouteChange[];
  needsReselect: boolean; routeChanged: boolean;
  /** Explicit RSVP, kept separate from saving a route. Missing means no response. */
  participation?: ParticipationStatus;
}
export interface PersonalRouteSelection {
  activity: TogetherActivity;
  route: PersonalRouteSnapshot & { version: string; issues: string[] };
  own?: PersonalRouteView; members: PersonalRouteView[];
  writable: boolean; canWithdraw: boolean; missingMemberIds: string[];
}
export interface PersonalRouteAcknowledgement extends PersonalRouteScope {
  actorId: string; expectedRevision: number; routeVersion: string; key: string;
  changes: PersonalRouteChange[];
}
