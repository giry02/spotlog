import type { Journey } from './data';
import { buildPersonalPlan, initializeCreatedPlan } from './tripPlan.ts';

export interface EmptyPersonalTripRequest { title: string; requestId: string }

/** A private, empty trip. Dates, duration and destinations are chosen in the trip itself. */
export function buildEmptyPersonalTrip(request: EmptyPersonalTripRequest, author: string): Journey {
  if (!request || typeof request.title !== 'string' || request.title.length > 100 || /[\u0000-\u001f\u007f]/u.test(request.title)) throw new Error('여행 이름은 100자 이내로 적어 주세요.');
  if (typeof request.requestId !== 'string' || !/^[a-zA-Z0-9_-]{1,160}$/u.test(request.requestId)) throw new Error('여행 만들기를 다시 열어 주세요.');
  const title = request.title.trim() || '새 여행';
  const journey = initializeCreatedPlan(buildPersonalPlan([], 1, title, author), author);
  return { ...journey, id: `trip-start-${request.requestId}`, title, duration: '기간 미정', summary: '날짜와 가고 싶은 곳을 정하며 여행을 채워보세요.' };
}
