import type { AdminPlace, PlaceContent } from './types';
import { publicationIssues } from './selectors.ts';

export type PlaceWorkflowTab = 'basic' | 'location' | 'media' | 'nearby' | 'guide' | 'ai' | 'history';
export interface PlaceCheckItem { message: string; tab: PlaceWorkflowTab; source: boolean }

/** Navigation follows the existing publication validator; it never approves incomplete data. */
export function placeCheckItems(content: PlaceContent): PlaceCheckItem[] {
  return publicationIssues(content).map(message => {
    if (/사진|미디어/.test(message)) return { message, tab: 'media', source: false };
    if (/좌표/.test(message)) return { message, tab: 'location', source: false };
    if (/방문 안내|번역/.test(message)) return { message, tab: 'guide', source: false };
    if (/AI/.test(message)) return { message, tab: 'ai', source: false };
    return { message, tab: 'basic', source: /자료/.test(message) };
  });
}

/** Publication and the private editing draft are separate states. */
export function placeWorkLabel(place: AdminPlace, dirty = false): string {
  if (place.revoked) return '사용 철회';
  if (place.state === 'INACTIVE') return '비활성';
  if (place.state === 'PUBLISHED') return dirty || JSON.stringify(place.draft) !== JSON.stringify(place.published) ? '공개본 수정 중' : '공개';
  return place.meta?.reviewStatus === 'NEEDS_CHECK' ? '확인 필요' : place.meta?.reviewStatus === 'READY' ? '검수 완료 · 공개 전' : '작성 중';
}
