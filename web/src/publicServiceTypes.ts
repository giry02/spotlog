/** Customer-facing public service contracts. No administrator UI or authentication dependency. */
export type OpsVisibility = 'PUBLIC' | 'PRIVATE' | 'TRASHED';
export type ModerationState = 'VISIBLE' | 'HIDDEN' | 'DELETED';
export type ExposureChannel = 'HOME_TRIP' | 'HOME_JOURNAL' | 'DISCOVERY_PHOTO' | 'DISCOVERY_VIDEO' | 'REGION_GUIDE';
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
export type ReferenceCategory = 'REGION' | 'CATEGORY' | 'TAG' | 'GLOSSARY' | 'GRADE' | 'ANNOUNCEMENT';
export interface OpsReference { referenceId: string; revision: number; category: ReferenceCategory; name: string; value: string; enabled: boolean }

export interface NearbyOverride { anchorPlaceId: string; businessPlaceId: string; mode: 'FEATURED' | 'EXCLUDED'; order: number }
/** Structural source for an approved public projection; editing commands and private data are excluded. */
export interface PublicReviewPlaceContentSource {
  regionId?: string; visitDuration?: string; hook?: string; creatorLabel?: string;
  provenance?: { origin: string; note?: string };
  kind: PublicJournalPlace['kind']; name: string; area: string; address: string; description: string; tags: string[];
  operation: 'OPEN' | 'TEMP_CLOSED' | 'CLOSED' | 'CHECK';
  location: { lat: number | null; lng: number | null; verified: boolean };
  rights: { display: boolean; store: boolean; modify: boolean };
  guide: { bestTime: string; english: string; englishStatus: string; sourceRevision: number };
  media: {
    mediaId: string; type: 'PHOTO' | 'VIDEO' | 'MOTION'; url: string; caption: string; alt: string; cover: boolean;
    provider: string; author: string; sourceUrl: string; license: string; licenseUrl: string; checkedAt: string;
    withdrawn: boolean; rights: { display: boolean; store: boolean; modify: boolean };
    provenance?: { sourceId?: string; changes?: string; objectPosition?: string };
  }[];
}
export interface PublicReviewPlaceSource {
  placeId: string; revision: number; state: 'DRAFT' | 'PUBLISHED' | 'INACTIVE'; revoked: boolean; revokedMediaIds?: string[];
  draft: PublicReviewPlaceContentSource; published?: PublicReviewPlaceContentSource;
}
export interface PublicReviewSource {
  places: PublicReviewPlaceSource[]; nearbyOverrides: NearbyOverride[];
  ops: {
    reports: OpsReport[]; references: OpsReference[]; exposures: ExposureEntry[];
    journals: PublicJournal[]; comments: PublicComment[];
    curatedTrips: { curatedTripId: string; visibility: 'PUBLIC' | 'PRIVATE'; editorialJournal?: PublicJournal }[];
  };
}
