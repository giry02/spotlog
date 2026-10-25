import type { CommunityTrip } from './community-trips';

/** Authored example using official place records, never a replacement for saved trips. */
export const jejuVerifiedCourse: CommunityTrip = {
  id: 'community-jeju-west-real-11',
  title: '제주 서쪽 실제 장소 11곳',
  author: 'Spotlog · 실제 장소 연결 기획 샘플',
  authorId: 'spotlog-jeju-verified-sample',
  sourceKind: 'demo',
  contentType: 'traveler',
  region: '제주',
  days: 2,
  theme: 'sea',
  coverPlaceId: 'hyeopjae',
  description: '협재·금능·오설록·송악산·새별오름에 실제 식당 3곳, 카페 2곳, 숙소 1곳을 연결한 1박 2일 예시입니다. 각 업체의 공식 주소와 개별 좌표로 전체 11곳을 표시합니다.',
  story: '제주관광공사 VisitJeju의 실제 장소 정보를 연결한 제작 예시입니다. 실제 여행자가 올린 글이나 방문 후기라는 뜻은 아닙니다. 기존 가상 업체 코스와 저장한 여행은 바꾸지 않습니다.\n\nDAY 1은 협재와 금능을 둘러본 뒤 신화월드의 숙소로 이동합니다. DAY 2는 전날 숙소를 출발점으로 오설록, 송악산, 사계리의 카페, 새별오름과 봉성리 식당을 잇습니다. 이 순서는 제안 일정이며 최단 동선이나 영업시간에 맞춘 일정으로 검증한 것은 아닙니다.',
  visits: [
    { day: 1, kind: 'place', entityId: 'hyeopjae', anchorId: 'hyeopjae', label: '오전 방문' },
    { day: 1, kind: 'food', entityId: 'catalog-jeju-hyeopjae-sin-guksu', anchorId: 'hyeopjae', label: '점심' },
    { day: 1, kind: 'place', entityId: 'geumneung', anchorId: 'geumneung', label: '오후 방문' },
    { day: 1, kind: 'cafe', entityId: 'catalog-jeju-paratodos', anchorId: 'geumneung', label: '카페에서 쉬기' },
    { day: 1, kind: 'stay', entityId: 'catalog-jeju-landing-shinhwa', anchorId: 'osulloc', label: '숙박' },
    { day: 2, kind: 'place', entityId: 'osulloc', anchorId: 'osulloc', label: '오전 방문' },
    { day: 2, kind: 'food', entityId: 'catalog-jeju-myeongri-main', anchorId: 'osulloc', label: '점심' },
    { day: 2, kind: 'place', entityId: 'songaksan', anchorId: 'songaksan', label: '오후 방문' },
    { day: 2, kind: 'cafe', entityId: 'catalog-jeju-coffee-sketch', anchorId: 'songaksan', label: '카페에서 쉬기' },
    { day: 2, kind: 'place', entityId: 'saebyeol', anchorId: 'saebyeol', label: '추가 방문' },
    { day: 2, kind: 'food', entityId: 'catalog-jeju-bongseong', anchorId: 'saebyeol', label: '저녁' },
  ],
  notes: [
    '실제 장소를 연결한 제작 예시이며 실제 회원 게시물·후기·좋아요가 아닙니다.',
    '2026-10-22 제주관광공사 VisitJeju의 업체별 이름·주소·좌표를 확인했습니다. 관광지 좌표를 업체 위치로 대신 사용하지 않습니다.',
    '커피스케치는 사계리 용머리해안 인근이며, 숙소는 제주신화월드에 있습니다. 송악산 바로 앞이나 오설록 내부 시설이라는 뜻은 아닙니다.',
    '현재 영업시간·가격·예약 가능 여부는 미확인입니다. 방문 순서는 제안이며 최적화된 동선이 아닙니다.',
  ],
};
