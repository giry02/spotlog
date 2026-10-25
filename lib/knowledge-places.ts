import type { Place, PlaceArea } from './connected-data';
import { jejuKnowledgeDocuments } from './jeju-knowledge';

type PlanningProfile = {
  id: string;
  area: PlaceArea;
  district: string;
  tags: string[];
  mood: [number, number, number];
  dayScope: 'full-day' | 'half-day' | 'flexible';
};

// Areas are broad itinerary groups; mood and day scope are authored planning
// assumptions. Source descriptions never imply current admission or transport.
const profiles: PlanningProfile[] = [
  { id: 'hallasan', area: 'central', district: '제주 중산간', tags: ['산악 탐방', '코스 선택', '예약 확인'], mood: [5, 3, 5], dayScope: 'full-day' },
  { id: 'udo', area: 'east', district: '제주 동쪽 부속섬', tags: ['바다 풍경', '도항선 이동', '귀항편 확인'], mood: [2, 3, 4], dayScope: 'full-day' },
  { id: 'sehwa', area: 'east', district: '제주 구좌읍', tags: ['바다 풍경', '해안 산책', '물때 확인'], mood: [2, 4, 4], dayScope: 'flexible' },
  { id: 'manjanggul', area: 'east', district: '제주 구좌읍', tags: ['용암동굴', '지질 관람', '개방 확인'], mood: [2, 4, 3], dayScope: 'flexible' },
  { id: 'saryeoni', area: 'central', district: '제주 중산간', tags: ['초록 풍경', '숲 산책', '입구 선택'], mood: [5, 5, 4], dayScope: 'flexible' },
  { id: 'gotjawal', area: 'west', district: '제주 서남부 대정읍', tags: ['초록 풍경', '생태 탐방', '숲 산책'], mood: [5, 5, 4], dayScope: 'flexible' },
  { id: 'aquaplanet', area: 'east', district: '제주 성산읍 섭지코지 인근', tags: ['실내 전시', '해양 생물', '아이와 관람'], mood: [2, 3, 3], dayScope: 'flexible' },
  { id: 'jejumuseum', area: 'north', district: '제주시', tags: ['실내 전시', '역사 문화', '어린이박물관'], mood: [2, 4, 3], dayScope: 'flexible' },
  { id: 'dolculturepark', area: 'central', district: '제주 조천읍 교래리', tags: ['돌 문화', '실내외 전시', '넓은 공원'], mood: [3, 4, 4], dayScope: 'flexible' },
  { id: 'ecoland', area: 'central', district: '제주 조천읍 교래', tags: ['초록 풍경', '관광 기차', '야외 산책'], mood: [5, 3, 4], dayScope: 'half-day' },
  { id: 'yeomiji', area: 'south', district: '서귀포 중문관광단지', tags: ['초록 풍경', '실내 온실', '야외 정원'], mood: [5, 4, 3], dayScope: 'flexible' },
  { id: 'hallimpark', area: 'west', district: '제주 한림읍 협재리', tags: ['초록 풍경', '정원', '동굴 관람'], mood: [5, 4, 4], dayScope: 'flexible' },
  { id: 'jeolmul', area: 'central', district: '제주시 봉개동 중산간', tags: ['초록 풍경', '삼나무 숲', '느린 산책'], mood: [5, 5, 4], dayScope: 'flexible' },
  { id: 'geomunoreum', area: 'central', district: '제주 조천읍 선흘리', tags: ['화산 지형', '숲 생태', '사전 예약'], mood: [5, 4, 5], dayScope: 'half-day' },
  { id: 'yongmeori', area: 'west', district: '제주 산방산·사계리 해안', tags: ['해안 절벽', '지질 관람', '물때·개방 확인'], mood: [2, 3, 4], dayScope: 'flexible' },
  { id: 'sanbangsan', area: 'west', district: '제주 안덕면 사계리', tags: ['산방굴사', '산 외관 조망', '허용 탐방로'], mood: [3, 4, 4], dayScope: 'flexible' },
];

export const knowledgePlaces: Place[] = profiles.map((profile) => {
  const overview = jejuKnowledgeDocuments.find((doc) => doc.id === `jeju-${profile.id}-overview`);
  const visit = jejuKnowledgeDocuments.find((doc) => doc.id === `jeju-${profile.id}-visit`);
  if (!overview || !visit) throw new Error(`Missing official place source: ${profile.id}`);
  return {
    id: profile.id,
    name: overview.title.split('|')[0].trim(),
    region: '제주',
    area: profile.area,
    district: profile.district,
    // Zero means no estimated stay time. Route/entrance choice and ferries are
    // unresolved; the UI deliberately hides a numeric estimate for these cards.
    durationMinutes: 0,
    image: '/images/jeju-knowledge-place.svg',
    imageKind: 'illustration',
    tags: profile.tags,
    mood: profile.mood,
    description: overview.text,
    credit: 'authored-jeju-place-illustration',
    sourceUrl: overview.sourceUrl,
    sourceVerifiedAt: overview.checkedAt,
    visitNote: visit.text,
    knowledgeSource: 'curated-official-summary',
    knowledgeDocumentIds: [overview, visit].map((doc) => `moa-knowledge:${doc.id}`),
    planningNote: `${profile.dayScope === 'full-day' ? '일정 가정: 다른 관광지와 같은 날 묶지 않고 하루를 비워 둡니다. ' : profile.dayScope === 'half-day' ? '일정 가정: 반나절 단위 후보이며 실제 소요 시간은 미산정입니다. ' : ''}정확한 체류·이동 시간은 미산정이며 실제 입구·관람 범위·예약·개방 여부를 확인해야 합니다.`,
    planning: { dayScope: profile.dayScope, conditions: [visit.text] },
  };
});
