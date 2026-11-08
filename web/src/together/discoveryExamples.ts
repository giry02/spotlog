import type { Place } from '../data';
import type { GroupTopic, TogetherActivity, TogetherGroup, TogetherMember, TogetherState } from './model';
import { koreaDay, shiftDay } from './discovery.ts';

export const DISCOVERY_CATALOG_VERSION = 4;
const legacyExampleIds = new Set(['public-busan-food', 'public-busan-guide']);
const legacyOwners: Record<string, string> = { 'public-busan-food': 'example-walker', 'public-busan-guide': 'example-guide' };
const needsLegacyOrigin = (group: TogetherGroup) => group.sourceKind === undefined && legacyOwners[group.id] === group.ownerId;
type ExampleSpec = {
  id: string; name: string; kind: TogetherGroup['kind']; region: string; district: string; topics: GroupTopic[];
  style: 'NEIGHBORHOOD' | 'DESTINATION'; introduction: string; welcome: string; joinGuide: string; scene: string;
  next: string; past: string; offset: number; paused?: boolean; ownerId?: string; ownerName: string;
  general?: boolean; startTime?: string; capacity?: number; joinMode?: 'DIRECT' | 'APPROVAL';
};
const specs: ExampleSpec[] = [
  { id: 'public-busan-food', name: '남포 한 끼, 골목 한 바퀴', kind: 'HOBBY', region: '부산', district: '중구', topics: ['FOOD', 'WALK'], style: 'NEIGHBORHOOD', scene: '남포', ownerId: 'example-walker', ownerName: '느린 산책', introduction: '식사 한 번으로 가볍게 시작하는 동네 모임. 식당 후보를 함께 고르고 무리 없는 골목 산책을 이어가요.', welcome: '혼자 오는 분도, 부산이 처음인 분도 환영해요.', joinGuide: '좋아하는 음식과 피하고 싶은 메뉴를 가입 인사에 남겨 주세요. 식사비는 각자 부담하는 예시예요.', next: '남포에서 점심 먹고 골목 산책', past: '지난 한 끼와 시장 구경', offset: 0 },
  { id: 'public-busan-guide', joinMode: 'APPROVAL', name: '해운대 바다길 여행 안내', kind: 'GUIDE', region: '부산', district: '해운대구', topics: ['TRAVEL', 'WALK'], style: 'DESTINATION', scene: '해운대', ownerId: 'example-guide', ownerName: '바다길 안내자', introduction: '부산에 머무는 날, 바다와 쉬어 갈 곳을 잇는 동선을 함께 준비해요. 가이드 소개와 여행 전 안내부터 확인해 보세요.', welcome: '빠른 관광보다 풍경과 휴식을 함께 즐길 분.', joinGuide: '희망 날짜와 걷기 선호를 알려 주세요. 이 예시는 모집·일정 공유용이며 상품 결제나 예약을 받지 않아요.', next: '해운대 바다와 여유로운 오후', past: '해변에서 함께 보낸 하루', offset: 3 },
  { id: 'discovery-gwangan-cafe', name: '광안리 커피와 느린 대화', kind: 'FRIENDS', region: '부산', district: '수영구', topics: ['CAFE', 'PHOTO'], style: 'NEIGHBORHOOD', scene: '광안', ownerName: '커피 산책자', introduction: '커피를 마시고 바다 풍경을 잠깐 남겨요. 카페 후보와 만날 시간은 일정에서 함께 정해요.', welcome: '카페에서 조용히 이야기 나누고 싶은 분.', joinGuide: '가입 후 원하는 일정에 별도로 참가해 주세요. 개인 촬영은 서로의 동의를 먼저 구해요.', next: '광안리 카페에서 쉬어 가기', past: '주말 커피와 바다 사진', offset: 1 },
  { id: 'discovery-yeongdo-photo', name: '영도 한 장 산책', kind: 'HOBBY', region: '부산', district: '영도구', topics: ['PHOTO', 'WALK'], style: 'NEIGHBORHOOD', scene: '영도', ownerName: '한 장 기록자', introduction: '장비보다 함께 바라보는 장면을 중요하게 생각해요. 촬영 후 각자가 고른 사진을 앨범에 나눠요.', welcome: '휴대폰 카메라로 시작하는 분도 환영.', joinGuide: '주민과 다른 방문객의 생활을 배려해요. 얼굴이 나온 사진은 동의 후 공유해 주세요.', next: '영도 풍경을 천천히 담는 날', past: '지난 골목 사진 모아 보기', offset: 4 },
  { id: 'discovery-gijang-outdoor', joinMode: 'APPROVAL', name: '기장 바깥 하루', kind: 'HOBBY', region: '부산', district: '기장군', topics: ['OUTDOOR', 'TRAVEL'], style: 'DESTINATION', scene: '기장', ownerName: '바깥 하루', introduction: '바다를 보고 야외에서 쉬는 주말을 준비해요. 활동 강도와 준비물을 확인한 뒤 참가를 선택해요.', welcome: '활동보다 여유로운 야외 시간을 좋아하는 분.', joinGuide: '장비·이동수단은 일정별로 확인해요. 날씨에 따른 변경은 공지에서 확정해요.', next: '기장 해안에서 보내는 하루', past: '해안 풍경과 야외 휴식 기록', offset: 5 },
  { id: 'discovery-seomyeon-culture', name: '서면 문화 한 조각', kind: 'HOBBY', region: '부산', district: '부산진구', topics: ['CULTURE', 'FOOD'], style: 'NEIGHBORHOOD', scene: '서면', ownerName: '문화 기록자', introduction: '전시나 동네 구경 뒤 한 끼로 이야기를 이어가요. 다음 모집을 준비하는 동안 지난 활동을 살펴볼 수 있어요.', welcome: '취향이 다른 사람과 감상을 나누고 싶은 분.', joinGuide: '현재 신규 모집을 쉬고 있어요. 공개 소개와 활동 기록만 확인할 수 있어요.', next: '다음 문화 나들이 후보 모으기', past: '문화 산책 뒤 나눈 이야기', offset: 8, paused: true },
  { id: 'discovery-seoul-forest', name: '서울숲 퇴근 산책', kind: 'HOBBY', region: '서울', district: '성동구', topics: ['WALK', 'PHOTO'], style: 'NEIGHBORHOOD', scene: '서울숲', ownerName: '초록 퇴근길', introduction: '하루를 마친 뒤 짧게 걷고 돌아가는 모임. 부담 없는 시간과 동선을 먼저 공유해요.', welcome: '오래 걷지 않고 기분 전환하고 싶은 분.', joinGuide: '매번 참가할 필요 없어요. 가능한 일정만 골라 참가 상태를 남겨 주세요.', next: '서울숲에서 짧은 저녁 산책', past: '퇴근 뒤 초록 한 바퀴', offset: 0 },
  { id: 'discovery-seoul-culture', name: '서울 전시와 한 잔', kind: 'HOBBY', region: '서울', district: '종로구', topics: ['CULTURE', 'CAFE'], style: 'NEIGHBORHOOD', scene: '서울', ownerName: '감상 나누기', introduction: '같은 전시를 보고 서로 다른 감상을 나눠요. 관람 후보와 티켓 확인 항목을 준비 목록에 정리해요.', welcome: '전시를 잘 몰라도 편하게 이야기할 분.', joinGuide: '전시·티켓은 일정 확정 후 각자 확인해요. 이 화면의 일정은 실제 관람 예약이 아닌 예시예요.', next: '전시 후보 고르고 카페에서 이야기', past: '주말 문화 나들이 돌아보기', offset: 2 },
  { id: 'discovery-jeju-slow', name: '제주 쉬엄쉬엄 여행', kind: 'GUIDE', region: '제주', district: '제주시', topics: ['TRAVEL', 'CAFE'], style: 'DESTINATION', scene: '협재', ownerName: '제주 느린 안내', introduction: '많은 장소를 채우기보다 바다와 카페에서 쉬어 가는 여행을 함께 준비해요.', welcome: '걷는 양과 휴식을 중요하게 생각하는 분.', joinGuide: '여행 날짜와 이동수단을 먼저 알려 주세요. 숙소와 식사 예약은 확정된 것으로 간주하지 않아요.', next: '제주 서쪽 바다와 카페 하루', past: '바람을 피해 쉬었던 여행', offset: 6 },
  { id: 'discovery-gangneung-photo', name: '강릉 바다 기록 모임', kind: 'HOBBY', region: '강원', district: '강릉시', topics: ['PHOTO', 'TRAVEL'], style: 'DESTINATION', scene: '강릉', ownerName: '동해 한 장', introduction: '강릉으로 여행 오는 날을 맞춰 바다를 보고 사진을 남겨요. 출발 지역과 관계없이 함께할 수 있어요.', welcome: '여행 중 잠깐 합류하고 싶은 분.', joinGuide: '집합 시간과 촬영 구간은 해당 일정 공지에서 확인해요. 원본 사진 공개는 작성자가 선택해요.', next: '강릉 바다를 바라보는 주말', past: '해변에서 고른 한 장', offset: 3 },
  { id: 'discovery-family-weekend', name: '속초 가족 주말 나들이', kind: 'FAMILY', region: '강원', district: '속초시', topics: ['FAMILY', 'WALK'], style: 'DESTINATION', scene: '속초', ownerName: '가족 주말 기록', introduction: '가족과 쉬어 갈 장소를 서로 추천하고 나들이를 준비하는 공개 모집 예시. 개인 가족 모임과는 별도예요.', welcome: '부모님·아이와 무리 없는 여행을 고민하는 분.', joinGuide: '공개 소개만 먼저 확인해 주세요. 자녀의 개인정보나 얼굴 사진을 가입 조건으로 요구하지 않아요.', next: '가족과 쉬어 가는 속초 하루', past: '함께 골랐던 쉬운 산책', offset: 4 },
  { id: 'discovery-incheon-taste', name: '인천 골목 맛 이야기', kind: 'HOBBY', region: '인천', district: '중구', topics: ['FOOD', 'CULTURE'], style: 'NEIGHBORHOOD', scene: '인천', ownerName: '골목 한 끼', introduction: '동네 음식과 이야기를 한 번에 만나는 가벼운 모임. 한 끼 후보부터 함께 골라요.', welcome: '익숙한 동네를 새롭게 보고 싶은 분.', joinGuide: '음식 알레르기와 피하고 싶은 메뉴는 직접 확인해요. 방문 업체의 운영 여부는 일정 확정 전에 다시 확인해요.', next: '인천에서 한 끼와 동네 구경', past: '지난 골목 한 끼 기록', offset: 1 },
  { id: 'discovery-busan-books', name: '서면 각자의 책 모임', kind: 'HOBBY', region: '부산', district: '부산진구', topics: ['BOOK', 'SOCIAL'], style: 'NEIGHBORHOOD', scene: '', ownerName: '한 문장 나누기', general: true, startTime: '19:30', capacity: 8, introduction: '같은 책을 읽어 오지 않아도 괜찮아요. 각자 가져온 책을 조용히 읽고 기억에 남은 문장 하나를 나눠요.', welcome: '완독하지 않아도, 처음 독서 모임이어도 환영해요.', joinGuide: '책이나 전자책을 준비해 주세요. 장소 후보와 개인 주문·이용 비용은 정모에서 확인하고 참가를 선택해요.', next: '퇴근 후 각자의 책 읽기', past: '책에서 고른 한 문장', offset: 1 },
  { id: 'discovery-busan-boardgame', name: '연산 보드게임 한 판', kind: 'HOBBY', region: '부산', district: '연제구', topics: ['GAME', 'SOCIAL'], style: 'NEIGHBORHOOD', scene: '', ownerName: '규칙부터 같이', general: true, startTime: '19:30', capacity: 8, introduction: '승부보다 함께 배우고 웃는 시간을 좋아해요. 처음 하는 게임은 규칙부터 천천히 설명해요.', welcome: '보드게임을 몰라도 처음부터 함께할 수 있어요.', joinGuide: '하고 싶은 게임을 제안해 주세요. 진행 시간과 장소·이용료는 정모 확정 전에 별도로 안내해요.', next: '쉬운 규칙으로 시작하는 보드게임', past: '처음 배운 게임 이야기', offset: 2 },
  { id: 'discovery-busan-badminton', name: '사직 가볍게 배드민턴', kind: 'HOBBY', region: '부산', district: '동래구', topics: ['SPORTS'], style: 'NEIGHBORHOOD', scene: '', ownerName: '함께 셔틀콕', general: true, startTime: '19:30', capacity: 12, introduction: '처음 라켓을 잡는 분도 함께 기본 동작을 익히는 모임. 운동 강도와 휴식은 각자의 상태에 맞춰요.', welcome: '경기 실력보다 안전과 배려를 먼저 생각하는 분.', joinGuide: '실내 운동화·물·개인 라켓 준비 여부를 확인해 주세요. 실제 코트 예약과 이용료는 정모별로 확인해요.', next: '기본 동작과 가벼운 배드민턴', past: '서로 배운 배드민턴 시간', offset: 3 },
  { id: 'discovery-busan-running', name: '부산 천천히 달리기', kind: 'HOBBY', region: '부산', district: '부산진구', topics: ['SPORTS', 'WALK'], style: 'NEIGHBORHOOD', scene: '', ownerName: '내 속도로 한 바퀴', general: true, startTime: '08:00', capacity: 12, introduction: '빠른 기록을 목표로 하지 않아요. 가볍게 몸을 풀고 걷기와 달리기를 각자의 속도로 이어가요.', welcome: '중간에 걸어도 괜찮은 초보 러닝 모임을 찾는 분.', joinGuide: '운동화와 물을 준비해 주세요. 거리·날씨·집합 구간을 확인하고 무리한 참여는 피해주세요.', next: '주말 아침 걷기와 가벼운 달리기', past: '내 속도로 움직인 아침', offset: 4 },
  { id: 'discovery-busan-craft', name: '수영 동네 손작업 모임', kind: 'HOBBY', region: '부산', district: '수영구', topics: ['CRAFT', 'CAFE'], style: 'NEIGHBORHOOD', scene: '', ownerName: '조금씩 만드는 즐거움', general: true, startTime: '14:00', capacity: 8, introduction: '뜨개·자수·종이 공예 등 각자의 손작업을 가져와 함께 만들어요. 완성보다 만드는 과정을 나눠요.', welcome: '작은 작업 하나를 시작하고 싶은 분도 환영해요.', joinGuide: '개인 재료·도구를 준비해 주세요. 위험하거나 소음이 큰 작업은 미리 알려 장소와 진행 방식을 확인해요.', next: '각자의 재료로 만드는 오후', past: '작은 작품과 작업 과정 나누기', offset: 3 },
  { id: 'discovery-busan-music', name: '부산 오늘의 플레이리스트', kind: 'HOBBY', region: '부산', district: '남구', topics: ['MUSIC', 'CULTURE'], style: 'NEIGHBORHOOD', scene: '', ownerName: '한 곡 이야기', general: true, startTime: '20:00', capacity: 8, introduction: '좋아하는 곡과 그 곡에 얽힌 이야기를 나눠요. 장르나 악기 경험에 상관없이 서로의 취향을 존중해요.', welcome: '한 곡을 소개하고 새로운 음악을 듣고 싶은 분.', joinGuide: '소개할 곡 제목과 이야기를 준비해 주세요. 음악 재생·연주 가능 여부와 비용은 장소를 정한 뒤 확인해요.', next: '내가 좋아하는 한 곡 소개하기', past: '서로의 취향을 발견한 음악 이야기', offset: 5 },
  { id: 'discovery-busan-language', name: '부산 편안한 언어 교환', kind: 'HOBBY', region: '부산', district: '금정구', topics: ['LANGUAGE', 'SOCIAL'], style: 'NEIGHBORHOOD', scene: '', ownerName: '틀려도 괜찮은 대화', general: true, startTime: '19:00', capacity: 8, introduction: '배우고 싶은 언어로 짧은 일상 대화를 나눠요. 모르는 표현은 함께 찾아보고 서로의 속도에 맞춰요.', welcome: '말하기가 서툴러도 서로 배려하며 연습할 분.', joinGuide: '가능한 언어와 연습하고 싶은 주제를 가입 인사에 남겨 주세요. 연락처 교환은 각자가 선택해요.', next: '일상 주제로 나누는 언어 교환', past: '새로운 표현을 배운 대화', offset: 1 },
  { id: 'discovery-busan-pets', joinMode: 'APPROVAL', name: '부산 배려하는 반려 생활', kind: 'HOBBY', region: '부산', district: '해운대구', topics: ['PETS', 'WALK'], style: 'NEIGHBORHOOD', scene: '', ownerName: '서로의 간격', general: true, startTime: '10:00', capacity: 8, introduction: '반려 생활 이야기를 나누고 조건이 맞는 날 짧은 산책을 준비해요. 사람과 동물 모두 편안한 거리를 지켜요.', welcome: '다른 반려동물의 성향과 보호자 선택을 존중하는 분.', joinGuide: '동반 여부와 성향을 미리 알려 주세요. 목줄·배변 용품을 챙기고 원치 않는 접촉이나 간식 제공은 피해주세요.', next: '반려 생활 이야기와 짧은 산책', past: '서로 배려한 산책 기록', offset: 4 },
];
const generalExampleIds = new Set(specs.filter(spec => spec.general).map(spec => spec.id));
// Authored taxonomy for these fictional catalogue records only. Never infer tags for saved groups.
const exampleSubtopics: Record<string, string[]> = {
  'public-busan-food': ['FOOD_KOREAN', 'WALK_CITY'], 'public-busan-guide': ['TRAVEL_DOMESTIC', 'WALK_COAST'],
  'discovery-gwangan-cafe': ['CAFE_COFFEE', 'PHOTO_LANDSCAPE'], 'discovery-yeongdo-photo': ['PHOTO_SNAP', 'WALK_CITY'],
  'discovery-gijang-outdoor': ['OUTDOOR_PICNIC', 'TRAVEL_DAY'], 'discovery-seomyeon-culture': ['CULTURE_EXHIBITION', 'FOOD_GLOBAL'],
  'discovery-seoul-forest': ['WALK_PARK', 'PHOTO_SNAP'], 'discovery-seoul-culture': ['CULTURE_EXHIBITION', 'CAFE_CHAT'],
  'discovery-jeju-slow': ['TRAVEL_SLOW', 'CAFE_COFFEE'], 'discovery-gangneung-photo': ['PHOTO_LANDSCAPE', 'TRAVEL_DOMESTIC'],
  'discovery-family-weekend': ['FAMILY_OUTING', 'WALK_COAST'], 'discovery-incheon-taste': ['FOOD_MARKET', 'CULTURE_HISTORY'],
  'discovery-busan-books': ['BOOK_FREE', 'SOCIAL_AFTERWORK'], 'discovery-busan-boardgame': ['GAME_BOARD', 'SOCIAL_WELCOME'],
  'discovery-busan-badminton': ['SPORTS_RACKET'], 'discovery-busan-running': ['SPORTS_RUNNING', 'WALK_PARK'],
  'discovery-busan-craft': ['CRAFT_KNIT', 'CAFE_WORK'], 'discovery-busan-music': ['MUSIC_LISTEN', 'CULTURE_PERFORMANCE'],
  'discovery-busan-language': ['LANGUAGE_EXCHANGE', 'SOCIAL_TALK'], 'discovery-busan-pets': ['PETS_WALK', 'WALK_NEIGHBORHOOD'],
};
const activityDescriptions: Record<string, { next: string; past: string }> = {
  'public-busan-food': { next: '먹고 싶은 점심 후보를 함께 고른 뒤, 식사하고 골목을 짧게 걸어요. 식사비는 각자 부담해요.', past: '시장 구경과 한 끼를 묶어 다녀온 동선을 나누고 다음에 먹고 싶은 메뉴를 모았어요.' },
  'public-busan-guide': { next: '해변을 오래 걷기보다 중간에 쉬는 동선을 함께 정해요. 집합 시간과 이동수단은 일정 공지에서 확인해요.', past: '바다를 보고 쉬어 갔던 곳을 기록했어요. 다음 여행에 참고할 이동·휴식 팁을 나눠요.' },
  'discovery-gwangan-cafe': { next: '카페에서 만나 커피를 마시고, 원하면 바다 쪽으로 잠깐 걸어요. 음료는 각자 주문하고 사진 공유는 동의 후 진행해요.', past: '커피를 마시며 여행 이야기를 나눴어요. 각자 고른 바다 사진과 다음 카페 후보를 모았어요.' },
  'discovery-yeongdo-photo': { next: '휴대폰이나 카메라로 마음에 드는 장면을 담아요. 서로의 속도에 맞춰 걷고 촬영한 사진은 원하는 것만 나눠요.', past: '골목과 바다에서 고른 사진을 모아 봤어요. 찍는 동안 발견한 풍경과 걷기 편했던 동선을 기록해요.' },
  'discovery-gijang-outdoor': { next: '날씨와 이동수단을 확인하고 야외에서 쉬는 하루를 준비해요. 물·겉옷 등 함께 챙길 항목부터 정해요.', past: '야외에서 쉬었던 장소와 준비물을 돌아봤어요. 다음 나들이에 필요한 날씨·이동 확인 항목을 남겨요.' },
  'discovery-seomyeon-culture': { next: '관심 있는 전시·문화 공간을 제안하고 다음 모임 날짜를 투표해요. 관람과 식사 비용은 각자 확인해요.', past: '함께 본 장면과 서로 다른 감상을 나눴어요. 다음에 가 보고 싶은 문화 공간을 후보로 저장해요.' },
  'discovery-seoul-forest': { next: '퇴근 후 가능한 시간에 만나 가볍게 걸어요. 오래 걷지 않아도 되고, 각자 편한 지점에서 돌아가요.', past: '퇴근 뒤 짧게 걸으며 하루를 정리했어요. 함께 고른 사진과 다음 산책 시간을 남겨요.' },
  'discovery-seoul-culture': { next: '보고 싶은 전시 후보를 고르고 관람 후 카페에서 감상을 나눠요. 티켓은 확정 안내를 확인한 뒤 각자 준비해요.', past: '기억에 남은 작품과 감상을 기록했어요. 다른 해석을 듣고 다음 관람 후보를 함께 골랐어요.' },
  'discovery-jeju-slow': { next: '제주 서쪽에서 바다와 카페를 여유롭게 잇는 하루를 준비해요. 걷는 양·휴식·이동수단을 먼저 맞춰요.', past: '바람을 피해 쉬었던 곳과 여유로웠던 동선을 나눴어요. 다음 제주 여행에 필요한 휴식 팁을 모아요.' },
  'discovery-gangneung-photo': { next: '여행 오는 날짜를 맞춰 바다를 보고 사진을 남겨요. 촬영 장비는 자유, 사진 공개도 각자가 선택해요.', past: '강릉에서 각자가 고른 바다 사진을 나눴어요. 잠깐 합류해도 좋았던 동선과 만남을 기록해요.' },
  'discovery-family-weekend': { next: '부모님·아이와 쉬어 갈 곳을 고르고 무리 없는 하루 동선을 정해요. 가족별 이동과 준비 항목은 참가 후 확인해요.', past: '쉬는 시간을 충분히 넣었던 나들이를 돌아봤어요. 가족마다 좋았던 점과 다음에 조정할 부분을 나눠요.' },
  'discovery-incheon-taste': { next: '먹고 싶은 메뉴를 함께 고르고 식사 뒤 동네를 짧게 둘러봐요. 식사비는 각자 부담하고 메뉴는 미리 확인해요.', past: '한 끼와 동네 구경을 묶었던 하루를 기록했어요. 다시 먹고 싶은 메뉴와 다음 후보를 저장해요.' },
  'discovery-busan-books': { next: '각자의 책이나 전자책을 읽은 뒤 문장 하나를 소개해요. 장소 후보와 개인 이용 비용을 확인하고 참가해 주세요.', past: '각자 읽은 책과 기억에 남은 문장을 나눴어요. 다음 정모에서 읽고 싶은 주제도 함께 모아요.' },
  'discovery-busan-boardgame': { next: '처음에는 짧고 쉬운 게임부터 함께 배워요. 하고 싶은 게임과 진행 시간, 장소 이용료를 미리 확인해요.', past: '처음 배운 규칙과 재미있었던 순간을 기록했어요. 다음에 해 보고 싶은 게임을 후보로 남겨요.' },
  'discovery-busan-badminton': { next: '준비 운동 후 기본 동작과 가벼운 랠리를 연습해요. 물·실내 운동화·라켓을 챙기고 코트 예약 여부를 확인해요.', past: '함께 연습하며 배운 점과 다음에 익히고 싶은 동작을 나눴어요. 무리하지 않았는지도 돌아봐요.' },
  'discovery-busan-running': { next: '준비 운동 후 걷기와 달리기를 자기 속도로 이어가요. 운동화·물·날씨를 확인하고 필요하면 중간에 쉬어요.', past: '서로의 속도를 존중하며 움직였어요. 편했던 구간과 다음에 조정할 거리·휴식 시간을 기록해요.' },
  'discovery-busan-craft': { next: '각자의 재료와 도구로 손작업을 이어가요. 처음 시작하는 작업도 괜찮고 사용한 재료와 과정은 원하는 만큼 나눠요.', past: '완성한 작품과 아직 진행 중인 작업을 함께 봤어요. 다음에 시도할 재료와 작업 팁을 기록해요.' },
  'discovery-busan-music': { next: '각자 소개할 곡 하나와 이야기를 준비해요. 장르에 상관없이 듣고, 재생·연주 방식은 장소 조건에 맞춰 정해요.', past: '서로 추천한 곡과 새롭게 알게 된 장르를 모았어요. 다음 정모의 음악 주제도 함께 골라요.' },
  'discovery-busan-language': { next: '짧은 자기소개와 일상 주제로 언어를 교환해요. 가능한 언어를 미리 남기고 모르는 표현은 함께 찾아봐요.', past: '대화 중 배운 표현과 다음에 연습하고 싶은 주제를 모았어요. 개인 연락처는 공유를 강요하지 않아요.' },
  'discovery-busan-pets': { next: '동반 여부와 성향을 확인한 뒤 무리 없는 산책을 준비해요. 목줄·배변 용품을 챙기고 서로의 간격을 존중해요.', past: '편안했던 거리와 쉬어 갈 구간을 기록했어요. 보호자와 반려동물이 모두 괜찮았는지 의견을 나눠요.' },
};

export function createDiscoveryCatalog(places: Place[], at = new Date()): { groups: TogetherGroup[]; members: TogetherMember[]; activities: TogetherActivity[] } {
  const today = koreaDay(at);
  const groups: TogetherGroup[] = [], members: TogetherMember[] = [], activities: TogetherActivity[] = [];
  specs.forEach((spec, index) => {
    const ownerId = spec.ownerId ?? `discovery-host-${spec.id}`;
    const regional = places.filter(place => place.area.startsWith(spec.region) && place.image);
    const scene = spec.general ? undefined : regional.find(place => `${place.name} ${place.area}`.includes(spec.scene)) ?? regional.find(place => place.kind === 'LANDMARK') ?? regional[0];
    const ids = [`${spec.id}-next`, `${spec.id}-past`];
    members.push({ id: ownerId, name: spec.ownerName });
    groups.push({ id: spec.id, name: spec.name, kind: spec.kind, region: spec.region, introduction: spec.introduction, cover: scene?.image ?? '',
      createdAt: `2026-10-${String(1 + index % 28).padStart(2, '0')}T00:00:00.000Z`, ownerId, memberIds: [ownerId], managerIds: [], archived: false, visibility: 'PUBLIC', promotionPublished: true, promotionActivityIds: ids, sourceKind: 'EXAMPLE',
      ...(spec.id === 'public-busan-guide' ? { joinFields: { welcome: '서로의 속도를 존중해 주세요.', questions: [{ id: 'preferred-day', label: '어떤 여행을 함께하고 싶나요?' }, { id: 'walking-pace', label: '걷는 양과 쉬는 시간은 어느 정도가 편한가요?' }], availableTimes: ['WEEKEND_DAY' as const] } } : {}),
      discovery: { joinMode: spec.joinMode ?? 'DIRECT', topics: [...spec.topics], subtopics: [...exampleSubtopics[spec.id]], district: spec.district, style: spec.style, recruitment: spec.paused ? 'PAUSED' : 'OPEN', welcome: spec.welcome, joinGuide: spec.joinGuide } });
    ids.forEach((id, position) => {
      const date = shiftDay(today, position === 0 ? spec.offset : -7 - index);
      activities.push({ id, groupId: spec.id, title: position === 0 ? spec.next : spec.past, date, endDate: date, meetingPoint: '',
        description: position === 0 ? activityDescriptions[spec.id].next : activityDescriptions[spec.id].past,
        status: position === 0 ? 'PLANNED' : 'COMPLETED', leadId: ownerId, editorIds: [], participants: {}, arrivedIds: [], revision: 1,
        kind: spec.style === 'DESTINATION' ? 'TRIP' : 'MEETUP', ...(spec.startTime ? { startTime: spec.startTime } : {}), ...(spec.capacity ? { capacity: spec.capacity } : {}) });
    });
  });
  return { groups, members, activities };
}

/** Adds only new example IDs once. Existing group edits, hidden activity selection and earlier deletions stay intact. */
export function hydrateDiscoveryCatalog(state: TogetherState, places: Place[], at = new Date()): TogetherState {
  const version = state.discoveryCatalogVersion ?? 0;
  const needsInitialCatalogue = version < 1;
  const needsDescriptionUpgrade = version < 2;
  const needsGeneralCatalogue = version < 3;
  const needsJoinModeUpgrade = version < 4;
  if (!needsGeneralCatalogue && !needsJoinModeUpgrade && !state.groups.some(needsLegacyOrigin)) return state;
  const next = structuredClone(state), catalogue = createDiscoveryCatalog(places, at);
  next.groups.forEach(group => { if (needsLegacyOrigin(group)) group.sourceKind = 'EXAMPLE'; });
  if (needsInitialCatalogue) {
    const existingIds = new Set(next.groups.map(group => group.id));
    const newlyAdded = catalogue.groups.filter(group => !existingIds.has(group.id) && !legacyExampleIds.has(group.id));
    const addedIds = new Set(newlyAdded.map(group => group.id));
    next.groups.push(...newlyAdded);
    const requiredOwners = new Set(newlyAdded.map(group => group.ownerId));
    catalogue.members.filter(member => requiredOwners.has(member.id) && !next.members.some(existing => existing.id === member.id)).forEach(member => next.members.push(member));
    catalogue.activities.filter(activity => addedIds.has(activity.groupId) && !next.activities.some(existing => existing.id === activity.id)).forEach(activity => next.activities.push(activity));
  }
  if (needsGeneralCatalogue && !needsInitialCatalogue) {
    const added = catalogue.groups.filter(group => generalExampleIds.has(group.id) && !next.groups.some(existing => existing.id === group.id));
    const addedIds = new Set(added.map(group => group.id));
    next.groups.push(...added);
    catalogue.members.filter(member => added.some(group => group.ownerId === member.id) && !next.members.some(existing => existing.id === member.id)).forEach(member => next.members.push(member));
    catalogue.activities.filter(activity => addedIds.has(activity.groupId) && !next.activities.some(existing => existing.id === activity.id)).forEach(activity => next.activities.push(activity));
  }
  if (needsDescriptionUpgrade) {
    specs.forEach(spec => {
      const group = next.groups.find(item => item.id === spec.id);
      if (group?.sourceKind !== 'EXAMPLE') return;
      const regional = places.filter(place => place.area.startsWith(spec.region) && place.image);
      const scene = regional.find(place => `${place.name} ${place.area}`.includes(spec.scene)) ?? regional.find(place => place.kind === 'LANDMARK') ?? regional[0];
      const prior = `일정 구성과 참가 흐름을 살펴보는 예시 활동. ${scene ? `표지의 ${scene.name} 사진은 해당 지역의 참고 장면이며 실제 모임 촬영 사진이 아니에요.` : '실제 개최나 예약이 확정된 일정이 아니에요.'}`;
      for (const suffix of ['next', 'past'] as const) {
        const id = `${spec.id}-${suffix}`;
        const activity = next.activities.find(item => item.id === id && item.groupId === spec.id);
        if (!activity || activity.description !== prior) continue;
        activity.description = activityDescriptions[spec.id][suffix]; activity.revision += 1;
        const snapshot = group.promotionActivitySnapshots?.find(item => item.id === id && item.groupId === spec.id && item.description === prior);
        if (snapshot) snapshot.description = activity.description;
      }
    });
  }
  if (needsJoinModeUpgrade) {
    next.groups.forEach(group => {
      const original = catalogue.groups.find(item => item.id === group.id);
      // Only untouched generated examples receive the new sample policies; operational or edited records keep approval fallback.
      if (group.sourceKind !== 'EXAMPLE' || !original || group.ownerId !== original.ownerId || group.name !== original.name
        || group.introduction !== original.introduction || !group.discovery || group.discovery.joinGuide !== original.discovery?.joinGuide) return;
      group.discovery.joinMode ??= original.discovery!.joinMode;
      group.createdAt ??= original.createdAt;
    });
  }
  if (needsGeneralCatalogue || needsJoinModeUpgrade) next.discoveryCatalogVersion = DISCOVERY_CATALOG_VERSION;
  return next;
}
