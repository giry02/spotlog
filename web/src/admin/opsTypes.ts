export type OpsVisibility = 'PUBLIC' | 'PRIVATE' | 'TRASHED';
export type ModerationState = 'VISIBLE' | 'HIDDEN' | 'DELETED';
export type ExposureChannel = 'HOME_TRIP' | 'HOME_JOURNAL' | 'HOME_PLACE' | 'DISCOVERY_PHOTO' | 'DISCOVERY_VIDEO' | 'REGION_GUIDE';
export interface ExposureEntry {
  exposureId: string; revision: number; channel: ExposureChannel; targetId: string;
  title: string; introduction: string; coverMediaId: string; startsAt: string; endsAt: string;
  enabled: boolean; order: number;
}
export type PublicRecordSource = 'SERVER' | 'PUBLIC_SAMPLE' | 'EDITORIAL' | 'SYNTHETIC';
export interface PublicSourceCredit { provider: string; author?: string; sourceUrl: string; license?: string; licenseUrl?: string; checkedAt?: string; changes?: string }
export interface PublicJournalPhoto { id: string; image: string; caption: string; sourceCredit?: PublicSourceCredit }
/** A public reading projection. Private planning preferences, bookings and progress are excluded. */
export interface PublicJournalPlace {
  id: string; visitId?: string; kind: 'LANDMARK' | 'FOOD' | 'CAFE' | 'STAY' | 'SHOP'; name: string; area: string; address: string;
  image: string; description: string; note: string; duration: string; planningSlot?: 'morning' | 'lunch' | 'afternoon' | 'dinner' | 'stay';
  photos?: PublicJournalPhoto[]; sourceCredit?: PublicSourceCredit;
}
export interface PublicJournalBlock {
  id: string; type: 'TEXT' | 'IMAGE' | 'PLACE'; heading?: string; body?: string; image?: string; caption?: string;
  images?: PublicJournalPhoto[]; visitId?: string; placeId?: string; sourceCredit?: PublicSourceCredit;
}
export interface PublicJournalDay { dayId?: string; day: number; date: string; title: string; story: string; places: PublicJournalPlace[]; blocks: PublicJournalBlock[] }
export interface PublicJournalCard {
  cardId: string; placeId: string; name: string; original: string; english: string;
  day?: number; visitId?: string; kind?: PublicJournalPlace['kind']; address?: string; description?: string;
  image?: string; photos?: PublicJournalPhoto[]; sourceCredit?: PublicSourceCredit; likes?: number | null;
  /** Read-only response projection; no administrator command changes individual reactions. */
  likeUsers?: PublicReactionMember[] | null;
}
export interface PublicReactionMember { memberId: string; name: string | null; avatarUrl: string | null; source: 'SERVER' | 'SAMPLE' }
export interface CuratedVisit { visitId: string; placeId: string; slot: 'morning' | 'lunch' | 'afternoon' | 'dinner' | 'stay'; introduction: string; mediaId?: string }
export interface CuratedDay { dayId: string; day: number; title: string; introduction: string; visits: CuratedVisit[] }
export interface CuratedTrip {
  curatedTripId: string; revision: number; title: string; introduction: string; placeIds: string[]; visibility: 'PUBLIC' | 'PRIVATE';
  regionId?: string; dayCount?: number; days?: CuratedDay[]; coverMediaId?: string; editorialJournal?: EditorialJournalDraft;
  sourceTemplateId?: string; sourceKind?: 'PUBLIC_SAMPLE' | 'EDITORIAL';
  generation?: { method: 'LOCAL_RULES'; requestedAt: string; notes: string[] };
}
export interface PublicJournal {
  journalId: string; revision: number; title: string; original: string; english: string;
  authorId: string; ownerVisibility: OpsVisibility; moderation: ModerationState;
  createdAt: string; cards: PublicJournalCard[];
  sourceKind?: PublicRecordSource; sourceJournalId?: string; sourceTemplateId?: string; authorName?: string; authorAvatar?: string;
  region?: string; summary?: string; tags?: string[]; cover?: PublicJournalPhoto; days?: PublicJournalDay[];
  metrics?: { cheers: number | null; copies: number | null; views: number | null; source: 'SERVER' | 'SAMPLE' };
  reactionBreakdown?: { LOVE: number | null; BEST: number | null; HELPFUL: number | null; source: 'SERVER' | 'SAMPLE' };
  translation: { sourceRevision: number; status: 'SAMPLE' | 'REVIEW' | 'APPROVED' | 'FAILED'; note: string };
}
/** Operator-owned draft text is permitted here; customer private projections remain redacted. */
export type EditorialJournalDraft = Omit<PublicJournal, 'ownerVisibility'> & { ownerVisibility: 'PUBLIC' | 'PRIVATE' };
export interface PublicComment {
  commentId: string; revision: number; journalId: string; cardId?: string; parentId?: string;
  authorId: string; original: string; english: string; createdAt: string; moderation: ModerationState;
  authorName?: string; authorAvatar?: string; sourceKind?: PublicRecordSource;
}
export interface OpsReport {
  reportId: string; revision: number; targetType: 'JOURNAL' | 'COMMENT' | 'PROFILE' | 'PLACE' | 'PHOTO';
  targetId: string; journalId?: string; cardId?: string; category: 'CONTENT' | 'COPYRIGHT' | 'INFORMATION' | 'TRANSLATION';
  original: string; status: 'OPEN' | 'RESOLVED' | 'DISMISSED'; createdAt: string; decision: string;
  reporterId?: string; reason?: string; receivedAt?: string; localReview?: boolean;
  reasonCode?: 'SPAM' | 'ABUSE' | 'PRIVACY' | 'COPYRIGHT' | 'INFORMATION' | 'OTHER'; source?: 'LOCAL_REVIEW'; mediaId?: string; reasonDetail?: string;
  placeId?: string; targetLabel?: string; photoSnapshot?: PublicJournalPhoto;
}
export interface OpsMember {
  memberId: string; revision: number; name: string; publicIntroduction: string; icon: string;
  avatarUrl?: string; grade?: string | null; sourceKind?: PublicRecordSource;
  state: 'ACTIVE' | 'SUSPENDED'; suspendedUntil?: string; warnings: { at: string; reason: string }[];
  deletionRequest?: { requestedAt: string; status: 'RECEIVED' | 'VERIFYING' | 'READY' | 'WITHDRAWN' };
  publicActivity: { journals: number | null; followers: number | null; copies?: number | null; views?: number | null; source?: 'SERVER' | 'SAMPLE' }; notificationOptOut: boolean;
}
export interface OpsInquiry {
  inquiryId: string; revision: number; subject: string; original: string; memberId: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'; assigneeId: string;
  replyRecords: { at: string; operatorId: string; body: string }[];
}
export interface OpsOperator { operatorId: string; revision: number; name: string; role: 'OPERATOR' | 'ADMIN'; active: boolean; sessions: { sessionId: string; status: 'ACTIVE' | 'REVOKED' }[] }
export type ReferenceCategory = 'REGION' | 'CATEGORY' | 'TAG' | 'GLOSSARY' | 'GRADE' | 'ANNOUNCEMENT';
export interface OpsReference { referenceId: string; revision: number; category: ReferenceCategory; name: string; value: string; enabled: boolean }
export interface OpsNotificationTemplate { templateId: string; revision: number; title: string; body: string; enabled: boolean }
export interface OpsNotification {
  notificationId: string; revision: number; memberId: string; templateId: string; dedupeKey: string;
  status: 'FAILED' | 'RETRY_REVIEWED' | 'OPTED_OUT' | 'DUPLICATE'; attempts: number; error: string;
}
export interface OpsConnection { connectionId: string; name: string; configured: boolean; status: 'UNCONNECTED' | 'PREPARING' | 'CONNECTED' | 'DEGRADED' | 'FAILED'; limit: number | null; unit: string; checkedAt?: string; detail?: string; scope?: 'CURRENT' | 'FOLLOW_UP' }
export interface OpsSupplyJob { jobId: string; source: string; status: 'REVIEW' | 'FAILED' | 'UNCONNECTED'; error: string; retryReviews: number }
export interface OpsTrash {
  trashId: string; revision: number; kind: 'TRIP' | 'JOURNAL'; ownerId: string;
  deletedAt: string; status: 'TRASHED' | 'RESTORED_PRIVATE' | 'EXPIRED'; publicJournalId?: string;
  mediaIds: string[];
}
export interface OpsMediaCleanup { mediaId: string; revision: number; references: { targetId: string; kind: 'TRIP' | 'JOURNAL' | 'PLACE' }[]; status: 'WAITING' | 'REVIEWED'; note: string }
/** Read-only aggregate; the exposure commands never accept or change popularity counts. */
export interface OpsPopularMetric { targetType: 'PLACE' | 'JOURNAL'; targetId: string; saveCount: number }
export interface OpsPopularitySnapshot { basis: 'SAVES'; source: 'SERVER' | 'SAMPLE'; observedAt: string; items: OpsPopularMetric[] }
export interface OpsState {
  popularity?: OpsPopularitySnapshot;
  exposures: ExposureEntry[]; curatedTrips: CuratedTrip[]; journals: PublicJournal[]; comments: PublicComment[];
  reports: OpsReport[]; members: OpsMember[]; inquiries: OpsInquiry[]; operators: OpsOperator[];
  references: OpsReference[]; templates: OpsNotificationTemplate[]; notifications: OpsNotification[];
  connections: OpsConnection[]; supplyJobs: OpsSupplyJob[]; trash: OpsTrash[]; mediaCleanup: OpsMediaCleanup[];
}
export type OpsCommand =
  | { kind: 'ops.curated.save'; payload: Omit<CuratedTrip, 'revision'>; entityRevision?: number }
  | { kind: 'ops.exposure.save'; payload: Omit<ExposureEntry, 'revision'>; entityRevision?: number }
  | { kind: 'ops.exposure.move'; exposureId: string; direction: -1 | 1 }
  | { kind: 'ops.content.moderate'; targetType: 'JOURNAL' | 'COMMENT'; targetId: string; action: 'HIDE' | 'UNHIDE' | 'DELETE'; reason: string; entityRevision: number }
  | { kind: 'ops.report.resolve'; reportId: string; status: 'RESOLVED' | 'DISMISSED'; reason: string; entityRevision: number }
  | { kind: 'ops.translation.review'; journalId: string; english: string; note: string; status: 'REVIEW' | 'APPROVED'; sourceRevision: number; entityRevision: number }
  | { kind: 'ops.member.action'; memberId: string; action: 'WARN' | 'SUSPEND' | 'REINSTATE'; reason: string; until?: string; entityRevision: number }
  | { kind: 'ops.member.deletion'; memberId: string; status: 'RECEIVED' | 'VERIFYING' | 'READY' | 'WITHDRAWN'; reason: string; entityRevision: number }
  | { kind: 'ops.inquiry.save'; inquiryId: string; status: OpsInquiry['status']; assigneeId: string; reply: string; entityRevision: number }
  | { kind: 'ops.operator.role'; operatorId: string; role: OpsOperator['role']; entityRevision: number }
  | { kind: 'ops.operator.create'; payload: { operatorId: string; name: string; role: OpsOperator['role'] } }
  | { kind: 'ops.operator.session'; operatorId: string; sessionId: string; entityRevision: number }
  | { kind: 'ops.reference.save'; payload: Omit<OpsReference, 'revision'>; entityRevision?: number }
  | { kind: 'ops.template.save'; payload: Omit<OpsNotificationTemplate, 'revision'>; entityRevision: number }
  | { kind: 'ops.notification.retry'; notificationId: string; entityRevision: number }
  | { kind: 'ops.connection.limit'; connectionId: string; limit: number }
  | { kind: 'ops.supply.retry'; jobId: string }
  | { kind: 'ops.trash.restore'; trashId: string; reason: string; entityRevision: number }
  | { kind: 'ops.cleanup.review'; mediaId: string; reason: string; entityRevision: number };
