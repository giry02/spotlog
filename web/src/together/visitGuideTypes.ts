import type { PlaceKind } from '../data';

export interface VisitGuideScope { groupId: string; activityId: string }
/** Deliberately entered guidance only; private activity descriptions are never a default. */
export interface VisitGuideFields {
  title: string; meetingText: string; entry: string; parking: string; preparations: string;
  selectedStopKeys: string[];
}
export interface VisitGuideInput extends VisitGuideFields {
  expectedActivityRevision: number; expectedGuideRevision: number;
  validityHours: number;
}
/** Public catalogue fields only, selected in original order; no private visit identity or notes. */
export interface VisitGuideStop {
  placeId: string; name: string; kind: PlaceKind; address: string;
  day: number; order: number; lat?: number; lng?: number;
}
export interface VisitGuideProjection {
  title: string; date: string; endDate: string; time: string; meetingText: string;
  entry: string; parking: string; preparations: string; stops: VisitGuideStop[];
}
export interface VisitGuidePublication {
  token: string; issuedAt: string; expiresAt: string; revoked: boolean;
  projection: VisitGuideProjection;
}
export interface TogetherVisitGuide extends VisitGuideScope {
  id: string; creatorId: string; revision: number; activityRevision: number;
  updatedAt: string; fields: VisitGuideFields; publication?: VisitGuidePublication;
  /** Old opaque tokens to withdraw from the limited local cache, with no projection history. */
  withdrawnTokens?: string[];
}
/** A page-memory review, never stored as a public object. */
export interface VisitGuidePreview extends VisitGuideScope {
  actorId: string; input: VisitGuideInput; projection: VisitGuideProjection;
  omissions: { label: string; reason: string }[]; key: string;
}
