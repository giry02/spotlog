import type { TogetherPhotoAttachment } from './model';

export type BusinessPurpose = 'TEAM_DINNER' | 'CLIENT_MEETING' | 'FAMILY' | 'FRIENDS' | 'DATE' | 'SOLO' | 'GROUP_TRIP';
/** Voluntary first-hand tags, never inferred from review text, location or another member. */
export type PlaceExperienceTag = 'QUIET' | 'PARKING' | 'CHILD_FRIENDLY' | 'LOW_WALK' | 'RETURN_VISIT' | 'GROUP_FRIENDLY';
/** An explicit room and catalogue ID; ratings never become a public/global business score. */
export interface PlaceAssessmentScope { groupId: string; activityId?: string; placeId: string }
export interface TogetherPlaceFeedback extends PlaceAssessmentScope {
  id: string; authorId: string; rating: number; note: string; recommended: boolean; purposes: BusinessPurpose[];
  photos: TogetherPhotoAttachment[]; revision: number; createdAt: string; updatedAt: string; withdrawnAt?: string;
  experienceTags?: PlaceExperienceTag[];
}
/** Member-supplied information, not an assertion of the business's current official menu or price. */
export interface TogetherPlaceMenu extends PlaceAssessmentScope {
  id: string; authorId: string; name: string; priceText: string; note: string; sourceUrl?: string; checkedOn?: string;
  photos: TogetherPhotoAttachment[]; revision: number; createdAt: string; updatedAt: string; withdrawnAt?: string;
}
export interface PlaceFeedbackInput {
  rating: number; note: string; recommended: boolean; purposes: BusinessPurpose[];
  photos?: TogetherPhotoAttachment[]; expectedRevision?: number;
  experienceTags?: PlaceExperienceTag[];
}
export interface PlaceMenuInput {
  id?: string; name: string; priceText: string; note: string; sourceUrl?: string; checkedOn?: string;
  photos?: TogetherPhotoAttachment[]; expectedRevision?: number;
}
