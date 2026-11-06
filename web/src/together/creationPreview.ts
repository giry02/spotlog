import type { Place } from '../data';
import { creationBriefTopics, creationCatalogPlaces, creationCatalogRegions, interpretCreationPrompt, refreshCreationPlan, validateCreationBrief, validateCreationPlan, type CreationBrief, type CreationGroupDraft, type CreationPlan } from './creationPlanner.ts';

/** Page-memory handoff only. No member/group IDs, place objects or prior consent are carried. */
export interface CreationPreviewDraft {
  brief: CreationBrief;
  plan: CreationPlan | null;
  groupDraft?: CreationGroupDraft;
}

/** The caller must supply the public catalog. Strip visit/private metadata defensively. */
export function creationPreviewCatalog(places: Place[]): Place[] {
  return creationCatalogRegions(places).flatMap(region => creationCatalogPlaces({ region }, places)).map(place => ({
    id: place.id, kind: place.kind, name: place.name, area: place.area, address: place.address,
    lat: place.lat, lng: place.lng, locationVerified: place.locationVerified,
    image: place.image, description: place.description, note: '', duration: place.duration,
    ...(place.hook ? { hook: place.hook } : {}), ...(place.bestTime ? { bestTime: place.bestTime } : {}),
    ...(place.tags ? { tags: [...place.tags] } : {}),
    ...(place.photos ? { photos: place.photos.map(photo => ({
      mediaId: photo.mediaId, placeId: photo.placeId, sourceId: photo.sourceId,
      image: photo.image, alt: photo.alt, caption: photo.caption,
      objectPosition: photo.objectPosition, availability: photo.availability,
    })) } : {}),
  }));
}

export function snapshotCreationPreview(brief: CreationBrief, plan: CreationPlan | null, groupDraft?: CreationGroupDraft): CreationPreviewDraft {
  const cleanBrief = interpretCreationPrompt(brief.prompt, brief);
  return {
    brief: cleanBrief,
    plan: plan ? { id: plan.id, source: plan.source, title: plan.title, placeIds: [...plan.placeIds],
      days: plan.days.map(day => ({ day: day.day, placeIds: [...day.placeIds] })),
      explanation: [...plan.explanation], unknowns: [...plan.unknowns] } : null,
    ...(groupDraft ? { groupDraft: {
      name: groupDraft.name, kind: groupDraft.kind, region: groupDraft.region, introduction: groupDraft.introduction,
      topics: creationBriefTopics({ topics: groupDraft.topics, theme: 'OTHER' }),
      welcome: groupDraft.welcome, joinGuide: groupDraft.joinGuide, firstActivityIdea: groupDraft.firstActivityIdea,
      joinMode: groupDraft.joinMode,
    } } : {}),
  };
}

function previewIssues(draft: CreationPreviewDraft, places: Place[]): string[] {
  if (draft.brief.purpose !== 'GROUP') return draft.plan ? validateCreationPlan(draft.brief, draft.plan, places) : ['선택한 초안을 다시 확인해 주세요.'];
  const issues = validateCreationBrief(draft.brief);
  if (!draft.groupDraft?.name.trim() || !draft.groupDraft.introduction.trim() || !draft.groupDraft.region.trim()) issues.push('모임 이름·지역·소개를 다시 확인해 주세요.');
  if (draft.groupDraft && !['FAMILY', 'FRIENDS', 'HOBBY', 'GUIDE'].includes(draft.groupDraft.kind)) issues.push('모임 구분을 다시 확인해 주세요.');
  if (draft.groupDraft?.joinMode && !['DIRECT', 'APPROVAL'].includes(draft.groupDraft.joinMode)) issues.push('가입 방식을 다시 확인해 주세요.');
  return [...new Set(issues)];
}

/** Authentication is not approval to save. Recheck current catalog and reset both confirmations. */
export function restoreCreationPreview(draft: CreationPreviewDraft, places: Place[]) {
  const restored = snapshotCreationPreview(draft.brief, draft.plan, draft.groupDraft);
  const issues = previewIssues(restored, places);
  if (!issues.length && restored.plan) restored.plan = refreshCreationPlan(restored.brief, restored.plan, places);
  return { ...restored, ready: issues.length === 0, issues, checked: false, dateUnconfirmed: false };
}

interface CreationFinalReview extends CreationPreviewDraft {
  previewOnly: boolean;
  checked: boolean;
  dateUnconfirmed: boolean;
}
interface CreationFinalActions {
  onReview: (brief: CreationBrief, plan: CreationPlan | null, groupDraft?: CreationGroupDraft) => boolean | Promise<boolean>;
  onLoginRequired?: (draft: CreationPreviewDraft) => void;
}

/** Called only by the explicit final button; guest mode can request auth, never save/share. */
export async function completeCreationReview(review: CreationFinalReview, places: Place[], actions: CreationFinalActions): Promise<'LOGIN_REQUIRED' | 'SAVED' | 'REJECTED'> {
  if (!review.checked || (review.brief.purpose !== 'GROUP' && !review.brief.date && !review.dateUnconfirmed)) throw new Error('확인 항목을 체크해 주세요.');
  const draft = snapshotCreationPreview(review.brief, review.plan, review.groupDraft);
  const issues = previewIssues(draft, places);
  if (issues.length) throw new Error(issues.join(' '));
  if (review.previewOnly) {
    if (!actions.onLoginRequired) throw new Error('로그인 화면을 열 수 없어요. 잠시 뒤 다시 시도해 주세요.');
    actions.onLoginRequired(draft);
    return 'LOGIN_REQUIRED';
  }
  return await actions.onReview(draft.brief, draft.plan, draft.groupDraft) ? 'SAVED' : 'REJECTED';
}
