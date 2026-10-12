import type { AiState, AiCommand } from './aiTypes';
import type { OpsState, OpsCommand } from './opsTypes';

export type AdminMenu = 'overview' | 'places' | 'exposure' | 'community' | 'members' | 'ai' | 'settings';
export type AdminRole = 'OPERATOR' | 'ADMIN';
export interface AdminSession { operatorId: string; name: string; role: AdminRole }
export type AdminKind = 'LANDMARK' | 'FOOD' | 'CAFE' | 'STAY' | 'SHOP';
export interface UsageRights { display: boolean; store: boolean; modify: boolean; ai: boolean }
export type PlaceReviewStatus = 'DRAFT' | 'NEEDS_CHECK' | 'READY';
export interface AdminRegion { regionId: string; name: string; parentId?: string; level: 'COUNTRY' | 'PROVINCE' | 'CITY' | 'DISTRICT'; enabled: boolean; revision: number }
export interface PlaceProvenance { origin: 'CATALOG' | 'CSV' | 'STAFF' | 'SYNTHETIC'; sourcePlaceId?: string; sourceRecordId?: string; scope?: string; note?: string }
export interface MediaProvenance { origin: 'CATALOG' | 'CSV' | 'STAFF' | 'SYNTHETIC'; sourceId?: string; sourcePlaceId?: string; imageSourceUrl?: string; publishedAt?: string; originalTitle?: string; changes?: string; reuseNote?: string; objectPosition?: string }
export interface AdminMedia {
  mediaId: string; type: 'PHOTO' | 'VIDEO' | 'MOTION'; url: string; caption: string; alt: string; cover: boolean;
  provider: string; author: string; sourceUrl: string; license: string; licenseUrl: string; checkedAt: string;
  rights: UsageRights; withdrawn: boolean;
  provenance?: MediaProvenance;
}
export interface PlaceContent {
  regionId?: string; visitDuration?: string; hook?: string; creatorLabel?: string; provenance?: PlaceProvenance;
  kind: AdminKind; name: string; companyId: string; area: string; address: string; description: string; tags: string[];
  operation: 'OPEN' | 'TEMP_CLOSED' | 'CLOSED' | 'CHECK';
  location: { lat: number | null; lng: number | null; verified: boolean; reference: string; sourceUrl: string; checkedAt: string };
  rights: UsageRights; provider: string; sourceUrl: string; checkedAt: string;
  media: AdminMedia[];
  guide: { hours: string; bestTime: string; facilities: string; menu: string; lodging: string; access: string; english: string; englishStatus: 'MISSING' | 'DRAFT' | 'REVIEWED' | 'STALE'; sourceUrl: string; checkedAt: string; sourceRevision: number };
  ai: { text: string; tags: string[]; sourceUrl: string; provider: string; checkedAt: string; allowed: boolean; version: number };
}
export interface AdminPlace {
  placeId: string; revision: number; state: 'DRAFT' | 'PUBLISHED' | 'INACTIVE'; draft: PlaceContent;
  published?: PlaceContent; revoked: boolean; revokedMediaIds?: string[]; updatedAt: string;
  meta?: { createdById: string; assignedToId: string; reviewStatus: PlaceReviewStatus; sourceBatchId?: string; importedAt?: string };
}
export interface NearbyOverride { anchorPlaceId: string; businessPlaceId: string; mode: 'FEATURED' | 'EXCLUDED'; order: number }
export interface AuditEvent { id: string; at: string; actorId: string; actorName: string; action: string; targetId: string; reason: string; before: string; after: string }
export interface AdminServiceMetrics { members: number | null; saves: number | null; generatedTrips: number | null; publicJournals: number | null; observedAt: string | null; source: 'SERVER' }
export interface AdminState {
  regions?: AdminRegion[]; migrations?: string[];
  metrics?: AdminServiceMetrics;
  schemaVersion: 1; revision: number; places: AdminPlace[]; nearbyOverrides: NearbyOverride[]; ai: AiState; ops: OpsState;
  audit: AuditEvent[]; processedCommands: { key: string; fingerprint: string; message: string; revision: number }[];
}
export type PlaceCommand =
  | { kind: 'region.save'; payload: Omit<AdminRegion, 'revision'>; entityRevision?: number }
  | { kind: 'place.workflow'; payload: { placeId: string; assignedToId: string; reviewStatus: PlaceReviewStatus }; entityRevision: number }
  | { kind: 'place.media.revoke'; payload: { placeId: string; mediaId: string; reason: string } }
  | { kind: 'place.create'; payload: { placeId: string; content: PlaceContent; anchorPlaceId?: string } }
  | { kind: 'place.save'; payload: { placeId: string; content: PlaceContent } }
  | { kind: 'place.publish'; payload: { placeId: string } }
  | { kind: 'place.inactivate' | 'place.revoke' | 'place.delete'; payload: { placeId: string; reason: string } }
  | { kind: 'place.nearby'; payload: { anchorPlaceId: string; businessPlaceId: string; mode: 'FEATURED' | 'EXCLUDED' | 'DEFAULT'; order?: number } }
  | { kind: 'place.import'; payload: { rows: PlaceContent[]; batchId?: string; assignedToId?: string; regionId?: string } };
export type AdminCommandInput = PlaceCommand | AiCommand | OpsCommand;
export type AdminCommand = AdminCommandInput & { expectedRevision: number; idempotencyKey: string };
export interface MutationContext { actor: AdminSession; now: string }
export interface MutationOutcome { message: string; targetId: string; before?: string; after?: string; reason?: string }
export interface AdminCommandResult { state: AdminState; message: string; replayed?: boolean }
export interface AdminQuery { resource: string; query?: string; page?: number; pageSize?: number; filters?: Record<string, string> }
export interface AdminPageResult<T = unknown> { items: T[]; total: number; page: number; pageSize: number; revision: number }
export interface AdminAdapter {
  mode: 'LOCAL' | 'API'; session(): Promise<AdminSession>; load(): Promise<AdminState>;
  query<T = unknown>(query: AdminQuery): Promise<AdminPageResult<T>>;
  execute(command: AdminCommand, session: AdminSession): Promise<AdminCommandResult>;
}
export interface AdminPageProps {
  entityId?: string; entryAction?: 'create-place' | 'import' | 'review' | 'review-mine' | 'generate' | 'connections' | 'regions' | 'media-review' | 'failed-notifications' | 'failed-supply' | 'failed-indices'; clearEntryAction?: () => void;
  regionId?: string; setRegionId?: (regionId: string) => void;
  mode: 'LOCAL' | 'API';
  adapter?: AdminAdapter;
  state: AdminState; session: AdminSession; run: (command: AdminCommandInput) => Promise<boolean>;
  navigate: (menu: AdminMenu, entityId?: string, entryAction?: AdminPageProps['entryAction']) => void; busy: boolean;
}
