import { defaultComments, homeTripTemplates, previewTemplateJourney, publishedJourneySeeds, type JourneyComment } from './consumerPublicSeed';
import { cardKey, type CardSocialStore, isCardSocialStore } from './cardSocialState';

// Bundled public examples only. Never seed a customer's private or copied trip.
const publicSamples = [...new Map([...publishedJourneySeeds, ...homeTripTemplates.map(previewTemplateJourney)]
  .filter(journey => journey.visibility === 'PUBLIC' && journey.status === 'PUBLISHED' && journey.purpose !== 'PLAN' && !journey.isMine && !journey.trash)
  .map(journey => [journey.id, journey])).values()];

export const sampleJournalComments: JourneyComment[] = publicSamples
  .filter(journey => !defaultComments.some(comment => comment.journeyId === journey.id))
  .flatMap(journey => [
    { id: `sample-journal:${journey.id}:1`, journeyId: journey.id, author: '느린여행자', body: `${journey.region} 여행을 계획 중인데 DAY별로 나뉜 동선이 참고가 되네요. 저장해 두고 살펴볼게요.`, createdAt: '10월 5일', authorCopies: 24 },
    { id: `sample-journal:${journey.id}:2`, journeyId: journey.id, author: '주말기록', body: '장소 사진과 이동 순서를 함께 볼 수 있어서 좋아요. 제 일정에 맞춰 조금씩 바꿔 보고 싶어요.', createdAt: '10월 4일', authorCopies: 12 },
  ]);

export function journalCommentTime(comment: JourneyComment): number {
  const localId = /^comment-(\d{13})$/.exec(comment.id);
  if (localId) return Number(localId[1]);
  const timestamp = Date.parse(comment.createdAt);
  if (Number.isFinite(timestamp)) return timestamp;
  // Existing bundled examples use Korean month/day labels from 2026.
  const sampleDate = /(\d{1,2})월\s*(\d{1,2})일/.exec(comment.createdAt);
  return sampleDate ? Date.UTC(2026, Number(sampleDate[1]) - 1, Number(sampleDate[2])) : 0;
}

const cardSamples: CardSocialStore = Object.fromEntries(publicSamples.flatMap(journey => journey.days.flatMap(day => {
  const block = day.blocks.find(item => item.type === 'PLACE' && item.placeId && day.places.some(place => place.id === item.placeId));
  if (!block) return [];
  const place = day.places.find(item => item.id === block.placeId)!;
  const parentId = `sample-card:${journey.id}:${block.id}:root`;
  return [[cardKey(journey.id, block.id), { likes: [], comments: [
    { id: parentId, authorId: 'sample-slow-traveler', author: '느린여행자', body: `${place.name} 사진을 보니 이 장소를 일정에 담아 보고 싶어요.`, createdAt: '2026-10-05T01:00:00.000Z' },
    { id: `${parentId}:reply`, parentId, authorId: 'sample-weekend-notes', author: '주말기록', body: '저도 저장해 뒀어요. 여행 전에 운영 정보를 확인하고 동선을 다듬어 보려고요.', createdAt: '2026-10-05T02:00:00.000Z' },
  ] }]];
})));

export function withSampleCardThreads(value: unknown): CardSocialStore {
  const stored = isCardSocialStore(value) ? value : {};
  const merged = { ...stored };
  for (const [key, sample] of Object.entries(cardSamples)) {
    const current = stored[key];
    merged[key] = { ...sample, ...current, comments: [...new Map([...sample.comments, ...(current?.comments ?? [])].map(comment => [comment.id, comment])).values()] };
  }
  return merged;
}
