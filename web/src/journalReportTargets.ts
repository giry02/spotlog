import type { Journey, Place } from './data.ts';
import type { JourneyComment } from './consumerPublicSeed.ts';
import type { CardSocialStore } from './cardSocialState.ts';
import { cardKey } from './cardSocialState.ts';
import type { PublicComment, PublicSourceCredit } from './publicServiceTypes.ts';
import { validateReportTarget, type ReportTarget, type PublicPlaceProjection } from './reviewServiceBridge.ts';

export type ReportChoice = { target: ReportTarget; label: string; english: string; group: 'journal' | 'place' | 'photo' | 'comment' };
export function reportPhotoCredit(image: string, place?: Place): PublicSourceCredit | undefined {
  return (place as PublicPlaceProjection | undefined)?.publicMediaCredits?.find(item => item.image === image);
}

/** One entry point retains each exact public journal/card/photo/comment identity. */
export function journalReportChoices({ journey, comments = [], threads = {}, publicComments = [], hiddenCommentIds = [], selfName = '', selfId = 'local-self', photoCredit = reportPhotoCredit }: { journey: Journey; comments?: JourneyComment[]; threads?: CardSocialStore; publicComments?: PublicComment[]; hiddenCommentIds?: string[]; selfName?: string; selfId?: string; photoCredit?: typeof reportPhotoCredit }): ReportChoice[] {
  if (journey.visibility !== 'PUBLIC' || journey.status !== 'PUBLISHED' || journey.purpose === 'PLAN' || journey.trash) return [];
  const result: ReportChoice[] = [], seen = new Set<string>();
  const add = (choice: ReportChoice) => {
    const key = JSON.stringify([choice.target.type, choice.target.id, choice.target.cardId]);
    if (seen.has(key)) return;
    // Only genuine published identities accepted by the existing report contract.
    try { validateReportTarget(choice.target); } catch { return; }
    seen.add(key); result.push(choice);
  };
  add({ group: 'journal', label: '여행기 전체', english: 'Entire journal', target: { type: 'JOURNAL', id: journey.id, label: journey.title, journey } });
  if (!journey.isMine) add({ group: 'journal', label: `작성자 · ${journey.author}`, english: `Author · ${journey.author}`, target: { type: 'PROFILE', id: journey.publicAuthorId ?? `public-author:${journey.author}`, label: journey.author, journey } });
  if (journey.cover) add({ group: 'photo', label: '표지 사진', english: 'Cover photo', target: { type: 'PHOTO', id: `${journey.id}:cover`, label: `${journey.title} · 표지`, journey, photo: { id: `${journey.id}:cover`, image: journey.cover, caption: '', sourceCredit: photoCredit(journey.cover) } } });
  for (const day of journey.days) {
    for (const block of day.blocks) {
      if (block.type === 'PLACE') {
        const place = day.places.find(item => block.visitId ? item.visitId === block.visitId : item.id === block.placeId);
        if (!place) continue;
        add({ group: 'place', label: `DAY ${day.day} · ${place.name}`, english: `DAY ${day.day} · ${place.name}`, target: { type: 'PLACE', id: place.id, label: place.name, journey, place, cardId: block.id } });
        // All actual place photos remain individually selectable, including the representative photo.
        const photos = [...(place.photos ?? []), ...(place.image && !place.photos?.some(photo => photo.image === place.image) ? [{ image: place.image, caption: '', alt: place.name }] : [])];
        photos.forEach((photo, index) => {
          const id = photo.mediaId ?? (index < (place.photos?.length ?? 0) ? `${place.id}:${index}` : `${place.id}:${photo.image}`);
          add({ group: 'photo', label: `DAY ${day.day} · ${place.name} 사진 ${index + 1}`, english: `DAY ${day.day} · ${place.name} photo ${index + 1}`, target: { type: 'PHOTO', id, label: `${place.name} · 사진 ${index + 1}`, journey, place, cardId: block.id, photo: { id, image: photo.image, caption: photo.caption, sourceCredit: photoCredit(photo.image, place) } } });
        });
        for (const comment of threads[cardKey(journey.id, block.id)]?.comments ?? []) {
          if (comment.deleted || comment.authorId === selfId) continue;
          publicComments = [...publicComments, { commentId: comment.id, revision: 1, journalId: journey.id, cardId: block.id, parentId: comment.parentId, authorId: comment.authorId, authorName: comment.author, authorAvatar: comment.avatar, original: comment.body, english: '', createdAt: comment.createdAt, moderation: 'VISIBLE', sourceKind: 'PUBLIC_SAMPLE' }];
        }
      } else if (block.type === 'IMAGE') {
        const photos = block.images ?? (block.image ? [{ id: `${block.id}:photo`, image: block.image, caption: block.caption ?? '' }] : []);
        photos.forEach((photo, index) => add({ group: 'photo', label: `DAY ${day.day} · 여행 사진 ${index + 1}${photo.caption ? ` · ${photo.caption.slice(0, 28)}` : ''}`, english: `DAY ${day.day} · Journal photo ${index + 1}${photo.caption ? ` · ${photo.caption.slice(0, 28)}` : ''}`, target: { type: 'PHOTO', id: photo.id, label: `${journey.title} · 여행 사진`, journey, cardId: block.id, photo: { ...photo, sourceCredit: photoCredit(photo.image) } } }));
      }
    }
  }
  const byId = new Map(publicComments.filter(comment => comment.journalId === journey.id).map(comment => [comment.commentId, comment]));
  for (const comment of comments.filter(item => item.journeyId === journey.id)) {
    if (byId.has(comment.id)) continue;
    byId.set(comment.id, { commentId: comment.id, revision: 1, journalId: journey.id, authorId: `public-author:${comment.author}`, authorName: comment.author, authorAvatar: comment.avatar, original: comment.body, english: '', createdAt: Number.isFinite(Date.parse(comment.createdAt)) ? new Date(comment.createdAt).toISOString() : new Date().toISOString(), moderation: 'VISIBLE', sourceKind: 'PUBLIC_SAMPLE' });
  }
  for (const comment of byId.values()) {
    if (comment.moderation !== 'VISIBLE' || hiddenCommentIds.includes(comment.commentId) || comment.authorId === selfId || selfName && comment.authorName === selfName) continue;
    if (comment.cardId && !journey.days.some(day => day.blocks.some(block => block.id === comment.cardId && block.type === 'PLACE'))) continue;
    const name = comment.authorName ?? comment.authorId, snippet = comment.original.replace(/\s+/g, ' ').slice(0, 36);
    add({ group: 'comment', label: `${name} · ${snippet}`, english: `${name} · ${snippet}`, target: { type: 'COMMENT', id: comment.commentId, label: `${name} · 댓글`, journey, cardId: comment.cardId, comment } });
  }
  return result;
}
