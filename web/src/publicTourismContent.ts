import type { Journey, JourneyDay, Place, StoryBlock } from './data';
import busanGamcheon from '../../assets/spotlog/public-tourism/busan-gamcheon.png';
import busanGukje from '../../assets/spotlog/public-tourism/busan-gukje.png';
import busanGwangalli from '../../assets/spotlog/public-tourism/busan-gwangalli.png';
import busanHaeundae from '../../assets/spotlog/public-tourism/busan-haeundae.png';
import busanIgidae from '../../assets/spotlog/public-tourism/busan-igidae.png';
import busanJagalchi from '../../assets/spotlog/public-tourism/busan-jagalchi.png';
import busanDongbaek from '../../assets/spotlog/public-tourism/busan-dongbaek.jpg';
import gyeongjuCheomseongdae from '../../assets/spotlog/public-tourism/gyeongju-cheomseongdae.jpg';
import gyeongjuDaereungwon from '../../assets/spotlog/public-tourism/gyeongju-daereungwon.jpg';
import gyeongjuDonggung from '../../assets/spotlog/public-tourism/gyeongju-donggung.jpg';
import gyeongjuWoljeonggyo from '../../assets/spotlog/public-tourism/gyeongju-woljeonggyo.jpg';

/** Asset-specific provenance, also used after an image is saved or copied. */
export interface PublicTourismSource {
  id: string;
  placeId: string;
  title: string;
  image: string;
  sourceUrl: string;
  imageSourceUrl: string;
  owner: string;
  author: string;
  license: '공공누리 제1유형';
  licenseUrl: string;
  verifiedAt: string;
  publishedAt?: string;
  coordinateSourceUrl: string;
}

const verifiedAt = '2026-09-10';
const licenseUrl = 'https://www.kogl.or.kr/info/licenseType1.do';
const busanArchive = (id: string) => `https://visitbusan.net/archive/dataSearch/view.nm?dataSid=${id}&menuCd=36`;
const gyeongjuCourse = 'https://gyeongju.go.kr/tour/page.do?mnu_uid=2297';
const gyeongjuPlace = (id: number) => `https://gyeongju.go.kr/tour_bak/page.do?area_uid=${id}&cmd=2&code_uid=1012&mnu_uid=2292`;
type SourceInput = Omit<PublicTourismSource, 'license' | 'licenseUrl' | 'verifiedAt'>;
const source = (entry: SourceInput): PublicTourismSource => ({ ...entry, license: '공공누리 제1유형', licenseUrl, verifiedAt });

export const publicTourismSources: PublicTourismSource[] = [
  source({ id: 'busan-gamcheon', placeId: 'public-busan-gamcheon', title: '감천문화마을', image: busanGamcheon, sourceUrl: busanArchive('METADATA005396'), imageSourceUrl: 'https://visitbusan.net/archive/upload/2025/02/20/20250220170806170847_m.png', owner: '부산광역시', author: '부산광역시 정언모', coordinateSourceUrl: busanArchive('METADATA005396') }),
  source({ id: 'busan-gukje', placeId: 'public-busan-gukje', title: '국제시장', image: busanGukje, sourceUrl: busanArchive('METADATA004398'), imageSourceUrl: 'https://visitbusan.net/archive/upload/2025/02/20/20250220153350589637_m.png', owner: '부산광역시·부산관광공사', author: '(주)써머트리, 이음미디어(주)', publishedAt: '2019', coordinateSourceUrl: busanArchive('METADATA004398') }),
  source({ id: 'busan-gwangalli', placeId: 'public-busan-gwangalli', title: '광안리해수욕장', image: busanGwangalli, sourceUrl: busanArchive('METADATA006340'), imageSourceUrl: 'https://visitbusan.net/archive/upload/2025/02/21/20250221095006231873_m.png', owner: '부산광역시', author: '부산광역시 시민사진기자 정을호', coordinateSourceUrl: busanArchive('METADATA006340') }),
  source({ id: 'busan-haeundae', placeId: 'public-busan-haeundae', title: '해운대해수욕장', image: busanHaeundae, sourceUrl: busanArchive('METADATA007767'), imageSourceUrl: 'https://visitbusan.net/archive/upload/2025/03/10/20250310112932653684_m.png', owner: '부산광역시 관광정책과', author: '써머트리, 임성환', coordinateSourceUrl: busanArchive('METADATA007767') }),
  source({ id: 'busan-igidae', placeId: 'public-busan-igidae', title: '이기대 공원 구름다리(2)', image: busanIgidae, sourceUrl: busanArchive('METADATA006456'), imageSourceUrl: 'https://visitbusan.net/archive/upload/2025/02/21/20250221130807947082_m.png', owner: '부산광역시 관광정책과', author: '써머트리, 정민규', publishedAt: '2024-03-15', coordinateSourceUrl: busanArchive('METADATA006456') }),
  source({ id: 'busan-jagalchi', placeId: 'public-busan-jagalchi', title: '자갈치시장', image: busanJagalchi, sourceUrl: busanArchive('METADATA004615'), imageSourceUrl: 'https://visitbusan.net/archive/upload/2025/02/20/20250220153350682008_m.png', owner: '부산광역시', author: '박경란', publishedAt: '2019', coordinateSourceUrl: busanArchive('METADATA004615') }),
  source({ id: 'busan-dongbaek', placeId: 'public-busan-dongbaek', title: '[2-1코스] 동백섬2', image: busanDongbaek, sourceUrl: 'https://www.busan.go.kr/galmaetgil/notice02/1688203', imageSourceUrl: 'https://www.busan.go.kr/comm/getFile?srvcId=BBSTY3&upperNo=1688203&fileTy=ATTACH&fileNo=1', owner: '부산광역시', author: '개별 촬영자 미표기', publishedAt: '2025-07-08', coordinateSourceUrl: busanArchive('METADATA010728') }),
  source({ id: 'gyeongju-cheomseongdae', placeId: 'public-gyeongju-cheomseongdae', title: '경주 시내권 핵심 바이블 · 첨성대 전경', image: gyeongjuCheomseongdae, sourceUrl: gyeongjuCourse, imageSourceUrl: 'https://gyeongju.go.kr/design/tour2019/img/sub/course01_img3-1.jpg', owner: '경주시청', author: '경주시청', coordinateSourceUrl: gyeongjuPlace(47) }),
  source({ id: 'gyeongju-daereungwon', placeId: 'public-gyeongju-daereungwon', title: '경주 시내권 핵심 바이블 · 대릉원 항공사진', image: gyeongjuDaereungwon, sourceUrl: gyeongjuCourse, imageSourceUrl: 'https://gyeongju.go.kr/design/tour2019/img/sub/course01_img4-1.jpg', owner: '경주시청', author: '경주시청', coordinateSourceUrl: gyeongjuPlace(203) }),
  source({ id: 'gyeongju-donggung', placeId: 'public-gyeongju-donggung', title: '경주 시내권 핵심 바이블 · 동궁과 월지', image: gyeongjuDonggung, sourceUrl: gyeongjuCourse, imageSourceUrl: 'https://gyeongju.go.kr/design/tour2019/img/sub/course01_img5-1.jpg', owner: '경주시청', author: '경주시청', coordinateSourceUrl: gyeongjuPlace(50) }),
  source({ id: 'gyeongju-woljeonggyo', placeId: 'public-gyeongju-woljeonggyo', title: '경주 시내권 핵심 바이블 · 밤의 월정교', image: gyeongjuWoljeonggyo, sourceUrl: gyeongjuCourse, imageSourceUrl: 'https://gyeongju.go.kr/design/tour2019/img/sub/course01_img2-1.jpg', owner: '경주시청', author: '경주시청', coordinateSourceUrl: gyeongjuPlace(49) }),
];

const sourcesByImage = new Map(publicTourismSources.map((entry) => [entry.image, entry]));
export function getPublicTourismSource(image: string): PublicTourismSource | undefined {
  return sourcesByImage.get(image);
}

const editorialAuthor = 'Spotlog 공공자료 가이드';
type EditorialPlace = Pick<Place, 'id' | 'kind' | 'name' | 'area' | 'address' | 'lat' | 'lng' | 'image' | 'description' | 'note' | 'duration' | 'hook' | 'tags'>;
const place = (entry: EditorialPlace): Place => ({ ...entry, creator: editorialAuthor, bestTime: '방문 전 운영·통제 정보 확인' });

// Coordinates are official representative markers, not surveyed entrances.
export const publicTourismPlaces: Place[] = [
  place({ id: 'public-busan-dongbaek', kind: 'LANDMARK', name: '동백섬', area: '부산 해운대', address: '부산 해운대구 우동 710-1', lat: 35.1523895, lng: 129.1526031, image: busanDongbaek, hook: '숲길 사이로 해운대 바다를 만나는 산책', description: '해안 산책로에서 바다와 해운대 풍경을 함께 볼 수 있는 동백섬. 해변 일정에 짧은 숲길 산책을 더하는 장소입니다.', note: '공공자료를 바탕으로 한 산책 제안입니다. 보행로 개방 여부와 계단·경사 구간을 현장 안내에서 확인하세요.', duration: '권장 1시간', tags: ['부산', '해운대', '바다', '산책', '공공자료'] }),
  place({ id: 'public-busan-haeundae', kind: 'LANDMARK', name: '해운대해수욕장', area: '부산 해운대', address: '부산 해운대구 해운대해변로 226', lat: 35.1590004, lng: 129.1600037, image: busanHaeundae, hook: '백사장과 도시를 한 장면으로 보는 해운대', description: '넓게 열린 해변을 따라 걷고 바다를 바라보며 쉬는 해운대 일정. 동백섬과 묶되 이동과 휴식 시간은 여유롭게 남겨둡니다.', note: '사진은 아카이브에 수록된 행사 시기의 전경입니다. 현재 행사, 해수욕 가능 여부, 안전 통제는 별도로 확인하세요.', duration: '권장 1시간 30분', tags: ['부산', '해운대', '해변', '공공자료'] }),
  place({ id: 'public-busan-gamcheon', kind: 'LANDMARK', name: '감천문화마을', area: '부산 사하', address: '부산 사하구 감내2로 203 감천문화마을안내센터', lat: 35.0974998, lng: 129.0110016, image: busanGamcheon, hook: '지붕의 색을 따라 천천히 보는 언덕 마을', description: '언덕을 따라 이어지는 집과 골목이 만드는 풍경. 여러 지점을 급히 순회하기보다 안내된 관람 동선 안에서 마을 전체를 바라보는 시간을 제안합니다.', note: '실제 주민의 생활 공간입니다. 관람 가능 시간과 출입 안내를 먼저 확인하고 주거지 촬영·소음을 배려하세요.', duration: '권장 1시간 30분', tags: ['부산', '감천', '골목', '마을', '공공자료'] }),
  place({ id: 'public-busan-gukje', kind: 'SHOP', name: '국제시장', area: '부산 중구', address: '부산 중구 중구로 36', lat: 35.1011009, lng: 129.0279999, image: busanGukje, hook: '상점 사이를 걸으며 만나는 부산의 일상', description: '생활용품과 먹거리가 모이는 시장 골목. 방문 목적에 맞는 구역을 골라 둘러보고 식사나 간식은 실제 영업 중인 가게에서 직접 선택합니다.', note: '개별 업소의 영업시간과 가격은 이 가이드에서 검증하지 않았습니다. 결제 방법과 알레르기 재료를 주문 전에 확인하세요.', duration: '권장 1시간', tags: ['부산', '남포동', '시장', '공공자료'] }),
  place({ id: 'public-busan-jagalchi', kind: 'SHOP', name: '자갈치시장', area: '부산 중구', address: '부산 중구 자갈치해안로 52 자갈치시장', lat: 35.0966988, lng: 129.0310059, image: busanJagalchi, hook: '부산 바다의 일상을 만나는 시장', description: '수산물을 다루는 상점과 시장 풍경을 살펴보는 장소. 남포동 일정 안에서 국제시장과 서로 다른 분위기를 비교해 볼 수 있습니다.', note: '사진은 과거 기록 사진입니다. 특정 식당의 품질이나 가격을 추천·보장하지 않으며 촬영 전 상인의 의사를 확인하세요.', duration: '권장 1시간', tags: ['부산', '남포동', '시장', '공공자료'] }),
  place({ id: 'public-busan-igidae', kind: 'LANDMARK', name: '이기대 해안산책로', area: '부산 남구', address: '부산 남구 용호동 산122', lat: 35.1156998, lng: 129.1230011, image: busanIgidae, hook: '도시의 바깥쪽에서 바다를 따라 걷는 길', description: '해안의 바위와 산책로가 이어지는 이기대. 체력과 날씨에 맞춰 걸을 구간을 짧게 정하고 돌아오는 방식을 제안합니다.', note: '사진은 구름다리의 야간 전경이지만 이 일정은 낮 산책을 권합니다. 통제·노면·기상 상태를 확인하고 무리한 해안 접근은 피하세요.', duration: '권장 1시간 30분', tags: ['부산', '이기대', '해안산책', '공공자료'] }),
  place({ id: 'public-busan-gwangalli', kind: 'LANDMARK', name: '광안리해수욕장', area: '부산 수영', address: '부산 수영구 광안해변로 219', lat: 35.1537018, lng: 129.1179962, image: busanGwangalli, hook: '광안대교를 바라보며 하루를 느리게 마무리', description: '해변 너머 광안대교가 놓이는 광안리 풍경. 해변 산책과 휴식을 중심에 두고 식사는 취향에 맞는 주변 업소에서 따로 고릅니다.', note: '공연이나 드론쇼를 포함하는 일정이 아닙니다. 조명·행사·해변 이용 조건은 방문일의 공식 안내를 확인하세요.', duration: '권장 1시간 30분', tags: ['부산', '광안리', '해변', '야경', '공공자료'] }),
  place({ id: 'public-gyeongju-daereungwon', kind: 'LANDMARK', name: '대릉원', area: '경북 경주', address: '경북 경주시 황남동 일원', lat: 35.837679010295176, lng: 129.21276094515173, image: gyeongjuDaereungwon, hook: '낮은 능선과 나무 사이를 천천히 걷는 시간', description: '신라 고분이 모여 있는 경주 도심의 유적 공간. 사진 명소만 찾기보다 열린 관람 동선을 따라 지형과 나무를 함께 보는 산책을 제안합니다.', note: '사진은 대릉원 항공 전경입니다. 실제 보행 시야와 다르며 내부 시설의 관람 시간·입장 조건은 방문 전에 확인하세요.', duration: '권장 1시간 30분', tags: ['경주', '신라', '역사', '산책', '공공자료'] }),
  place({ id: 'public-gyeongju-cheomseongdae', kind: 'LANDMARK', name: '첨성대', area: '경북 경주', address: '경북 경주시 인왕동 839-1', lat: 35.8346770719392, lng: 129.219062867048, image: gyeongjuCheomseongdae, hook: '넓은 유적지 안에서 다시 보는 첨성대', description: '신라의 천문 관측 유적으로 알려진 첨성대. 구조물 가까이만 보기보다 주변의 열린 공간과 함께 바라보는 시간을 남깁니다.', note: '잔디와 유적의 출입 제한을 지키고 계절·행사에 따른 현장 동선을 확인하세요. 사진 속 상태가 현재와 같다고 보장하지 않습니다.', duration: '권장 50분', tags: ['경주', '신라', '역사', '공공자료'] }),
  place({ id: 'public-gyeongju-woljeonggyo', kind: 'LANDMARK', name: '월정교', area: '경북 경주', address: '경북 경주시 교동 274', lat: 35.8290792077481, lng: 129.217322613795, image: gyeongjuWoljeonggyo, hook: '남천 위 목조 다리가 만드는 경주의 한 장면', description: '복원된 목조 다리와 남천의 풍경을 함께 보는 장소. 강변에서 전체 모습을 살핀 뒤 개방된 관람 구간을 둘러보도록 구성했습니다.', note: '사진은 야간 전경입니다. 야간 관람·조명 시간과 다리 내부 출입 여부는 방문 전에 확인하세요.', duration: '권장 50분', tags: ['경주', '교동', '다리', '야경', '공공자료'] }),
  place({ id: 'public-gyeongju-donggung', kind: 'LANDMARK', name: '동궁과 월지', area: '경북 경주', address: '경북 경주시 원화로 102', lat: 35.8347937785847, lng: 129.226570245784, image: gyeongjuDonggung, hook: '연못에 비친 전각을 따라 마무리하는 경주', description: '신라 왕궁의 별궁 터와 연못을 둘러보는 경주 유적. 한 지점에서 사진을 찍고 끝내기보다 관람로를 따라 바뀌는 수면의 장면을 살펴봅니다.', note: '사진은 조명이 켜진 시간대의 기록입니다. 입장 마감·요금·행사 및 야간 조명은 현재 공식 운영 안내를 확인하세요.', duration: '권장 1시간 20분', tags: ['경주', '신라', '연못', '야경', '공공자료'] }),
];

const placesById = new Map(publicTourismPlaces.map((entry) => [entry.id, entry]));
const photoNotes: Record<string, string> = {
  'public-busan-haeundae': '아카이브의 행사 시기 해운대 전경. 현재 행사나 이용 상태를 뜻하지 않습니다.',
  'public-busan-igidae': '이기대 구름다리의 야간 기록 사진. 이 가이드는 낮 산책을 제안합니다.',
  'public-gyeongju-daereungwon': '대릉원의 항공 전경. 관람객의 실제 보행 시야와 다릅니다.',
  'public-gyeongju-woljeonggyo': '월정교 야간 전경. 현재 조명·관람 시간은 별도 확인이 필요합니다.',
  'public-gyeongju-donggung': '동궁과 월지의 조명과 연못 전경. 현재 운영 상태를 보장하지 않습니다.',
};

interface VisitPlan { id: string; heading: string; body: string }
function makeDay(journeyId: string, day: number, title: string, story: string, visits: VisitPlan[], practical: string): JourneyDay {
  const places: Place[] = [];
  const blocks: StoryBlock[] = [];
  visits.forEach((visit, index) => {
    const original = placesById.get(visit.id);
    if (!original) throw new Error(`Unknown official-source place: ${visit.id}`);
    const visitId = `${journeyId}-day${day}-visit${index + 1}`;
    places.push({ ...original, visitId });
    blocks.push(
      { id: `${visitId}-text`, visitId, type: 'TEXT', heading: visit.heading, body: visit.body },
      { id: `${visitId}-image`, visitId, type: 'IMAGE', image: original.image, caption: photoNotes[visit.id] || `${original.name}의 공공 관광자료 사진. 촬영 시점과 방문일의 모습은 다를 수 있습니다.` },
      { id: `${visitId}-place`, visitId, type: 'PLACE', placeId: original.id },
    );
  });
  blocks.push({ id: `${journeyId}-day${day}-practical`, type: 'TEXT', heading: '이 하루를 내 일정으로 바꾸려면', body: practical });
  return { day, date: '날짜 미정', title, story, places, blocks };
}

type PublicTourismJourney = Journey & { recommendationKind: 'AI'; recommendationBasis: 'OFFICIAL_SOURCE_SAMPLE' };
type JourneyInput = Pick<Journey, 'id' | 'title' | 'region' | 'duration' | 'cover' | 'summary' | 'tags' | 'days'> & { introduction: string };
function journey({ introduction, ...entry }: JourneyInput): PublicTourismJourney {
  return {
    ...entry, dateRange: '일정 예시 · 날짜 미정', status: 'PUBLISHED', visibility: 'PUBLIC',
    author: editorialAuthor, isMine: false, saves: 0, views: 0,
    recommendationKind: 'AI', recommendationBasis: 'OFFICIAL_SOURCE_SAMPLE',
    story: `${introduction}\n\n공공 관광자료와 사용 조건을 확인한 실제 사진으로 편집한 AI 추천 여행 샘플입니다. 개인의 방문 후기나 외부 AI 서비스로 실시간 생성한 결과가 아닙니다. 체류 시간은 편집상 제안이며 교통편·영업시간·숙소는 확정하지 않았습니다. 방문일을 정한 뒤 공식 안내와 실제 이동 경로를 확인해 조정하세요. 사진별 출처와 공공누리 제1유형 표시를 유지해 사용합니다.`,
  };
}

const coastId = 'public-busan-coast-day';
const oldtownId = 'public-busan-oldtown-2days';
const slowId = 'public-busan-slow-3days';
const heritageId = 'public-gyeongju-2days';

export const publicTourismJourneys: PublicTourismJourney[] = [
  journey({ id: coastId, title: '숲길에서 백사장으로, 해운대의 하루', region: '부산', duration: '당일치기', cover: busanDongbaek, summary: '동백섬의 해안 산책로와 해운대해수욕장. 두 장소만 정하고 바다를 보는 시간을 넉넉히 남긴 당일 가이드.', tags: ['부산', '당일치기', '해운대', '산책', '공공자료'], introduction: '한 번의 부산 여행에 모든 해변을 넣지 않아도 됩니다. 해운대 권역의 두 장소를 중심에 두고, 걷는 길과 쉬는 시간을 번갈아 배치하는 하루를 제안합니다. 오전·오후 시작 모두 가능하며 도착 시간에 맞춰 순서를 조정할 수 있습니다.', days: [
    makeDay(coastId, 1, '나무 사이 바다에서 열린 해변까지', '숲길과 백사장의 서로 다른 표정을 한 권역에서 만나는 하루. 이동 목표보다 오래 머무를 장소를 먼저 정합니다.', [
      { id: 'public-busan-dongbaek', heading: '첫 장면은 해안 산책로', body: '동백섬에서는 바다만 바라보기보다 나무 사이로 도시의 윤곽이 드러나는 순간을 찾아보세요. 지도를 보며 산책 범위를 먼저 정하고, 무리해서 모든 길을 돌기보다 자신의 체력에 맞는 구간을 선택하는 구성이 좋습니다.\n\n사진 속 해안 보행로는 장소의 분위기를 이해하기 위한 자료입니다. 유모차나 휠체어를 이용한다면 계단 없는 접근 경로와 현재 개방 구간을 별도로 확인해야 합니다.' },
      { id: 'public-busan-haeundae', heading: '두 번째 장소는 쉬는 시간을 포함하기', body: '숲길을 걸은 뒤에는 해운대의 넓은 해변에서 일정을 느리게 전환합니다. 백사장 전체를 끝까지 걷는 것보다 앉아 쉴 곳과 돌아갈 방향을 먼저 정해두면 짧은 여행도 덜 급해집니다.\n\n식사나 카페는 아직 정하지 않은 선택으로 남겨두었습니다. 실제 영업 중인 업소의 메뉴와 가격을 보고 결정하고, 귀가 교통편에 맞춰 산책을 마무리하세요.' },
    ], '당일치기 예시입니다. 부산 도착·귀가 시간과 출발지를 입력해 이동 구간을 다시 확인하세요. 기상 악화나 보행로 통제가 있으면 동백섬 구간을 줄이고 공식 안전 안내를 따릅니다. 식당·숙박업소가 검증된 추천으로 자동 포함된 일정은 아닙니다.'),
  ] }),
  journey({ id: oldtownId, title: '부산의 골목과 시장, 바다로 이어지는 이틀', region: '부산', duration: '1박 2일', cover: busanGamcheon, summary: '감천의 언덕, 국제시장과 자갈치의 일상, 광안리 바다. 원도심의 장면에서 해변까지 이어보는 1박 2일.', tags: ['부산', '1박2일', '골목', '시장', '공공자료'], introduction: '첫날은 원도심의 골목과 시장을, 다음 날은 시장과 해변을 연결한 예시입니다. 구역 간 이동 부담이 있으므로 숙소 위치와 실제 교통편을 정한 뒤 조정하는 것을 전제로 합니다. 음식과 숙박은 검증되지 않은 업소를 채워 넣지 않고 사용자가 선택하도록 남겼습니다.', days: [
    makeDay(oldtownId, 1, '언덕의 색과 시장의 골목', '주민의 생활을 배려하는 마을 관람에서 시작해 시장의 일상을 살펴보는 구성입니다.', [
      { id: 'public-busan-gamcheon', heading: '전망보다 먼저, 마을의 관람 안내', body: '감천문화마을은 집들이 모여 만드는 풍경이 매력인 동시에 사람들이 실제로 생활하는 공간입니다. 안내센터에서 관람 가능한 길과 시간을 확인한 뒤, 주민 출입구와 사적인 공간을 피해서 둘러보도록 계획했습니다.\n\n언덕길의 이동은 평지 산책과 다릅니다. 짐이 많거나 걷기 부담이 있다면 마을에 들어가기 전에 이동 수단과 짐 보관 방법부터 결정하세요.' },
      { id: 'public-busan-gukje', heading: '시장에서 내가 좋아하는 것을 찾기', body: '국제시장에서는 모든 골목을 한 번에 보려 하지 않아도 됩니다. 생활용품을 볼지, 간식을 고를지 한 가지 관심사를 정하면 구경의 속도가 생깁니다.\n\n업소별 추천 순위나 실제 후기 점수는 넣지 않았습니다. 먹거리를 고를 때에는 표시 가격, 재료, 결제 방법을 직접 확인하고 쇼핑하지 않는 시간에도 통행을 방해하지 않도록 배려하세요.' },
    ], '오늘 숙소는 미정입니다. 체크인 시각과 위치를 먼저 확인하고 국제시장 이후의 이동을 조정하세요. 여행 중 구입한 물건이나 촬영 사진을 내 여행에 기록하면 이 안내를 자신의 여행기로 바꿀 수 있습니다.'),
    makeDay(oldtownId, 2, '시장 풍경에서 광안리의 수평선으로', '자갈치에서 원도심의 아침을 살펴본 뒤 광안리로 이동하는 예시입니다. 구역을 이동하기 전에 귀가 시간을 확인합니다.', [
      { id: 'public-busan-jagalchi', heading: '구경하는 사람과 일하는 사람 사이', body: '자갈치에서는 시장을 관광 배경만이 아니라 사람들이 일하는 장소로 바라보는 시간을 제안합니다. 생선과 도구, 상점의 모습을 촬영하고 싶다면 먼저 상인의 동의를 구하세요.\n\n식사를 선택하더라도 이 자료가 특정 업소의 현재 가격이나 품질을 확인한 것은 아닙니다. 주문 내용과 비용을 확인한 다음 자신의 선택으로 기록하는 것이 좋습니다.' },
      { id: 'public-busan-gwangalli', heading: '마지막 일정은 바다를 보는 여백', body: '광안리에서는 광안대교가 보이는 해변 풍경을 중심으로 쉬는 시간을 둡니다. 남포동 권역에서 이동하는 구간이 있으므로 실제 도착 시각이 늦어지면 추가 장소를 더하기보다 해변 한 곳에 집중하세요.\n\n행사나 공연을 필수 장면으로 가정하지 않았습니다. 날씨와 귀가 교통편에 맞춰 밝은 시간에 마무리해도 되고, 야간 이용이 가능한지 확인한 후 저녁 풍경을 선택해도 됩니다.' },
    ], '체크아웃·짐 보관·귀가 교통편은 직접 확정해야 합니다. 자갈치에서 광안리까지의 경로와 이동 시간은 날짜와 수단에 따라 다시 조회하세요. 늦은 도착이 예상되면 광안리를 다음 여행에 남기는 선택도 가능합니다.'),
  ] }),
  journey({ id: slowId, title: '골목·해안길·해변으로 보는 부산 3일', region: '부산', duration: '2박 3일', cover: busanGwangalli, summary: '원도심 하루, 이기대와 광안리 하루, 동백섬과 해운대 하루. 권역별로 장면을 나눠 담은 부산 2박 3일.', tags: ['부산', '2박3일', '원도심', '해안산책', '공공자료'], introduction: '서로 떨어진 부산의 장소를 같은 날 모두 순회하지 않도록 세 날로 나눴습니다. 첫날은 원도심, 둘째 날은 남구·수영, 마지막 날은 해운대 권역을 중심으로 구성했습니다. 실제 경로 최적화 결과가 아니라 사용자가 숙소와 이동 수단에 맞춰 편집하는 출발점입니다.', days: [
    makeDay(slowId, 1, '부산 원도심의 세 장면', '마을과 두 시장을 연결한 첫날입니다. 늦게 도착한다면 시장 한 곳을 제외해도 흐름이 유지됩니다.', [
      { id: 'public-busan-gamcheon', heading: '도시의 언덕을 바라보는 시작', body: '감천문화마을은 첫날의 전망 장소로 제안합니다. 마을 안내를 확인하고 열린 관람 길 안에서 풍경을 감상하세요. 계단과 경사가 부담스럽다면 관람 범위를 줄이고, 다음 장소를 위해 체력을 남겨두는 편이 좋습니다.' },
      { id: 'public-busan-gukje', heading: '시장 골목에서 취향대로 고르기', body: '국제시장에서는 골목 구경과 간식 선택을 자유 시간으로 둡니다. 일정에 특정 상호를 채워 넣는 대신 실제 운영 중인 가게에서 직접 고르고, 마음에 드는 곳이 생기면 내 여행에 추가하세요.' },
      { id: 'public-busan-jagalchi', heading: '바다와 이어지는 시장의 일상', body: '자갈치는 국제시장과 다른 시장 풍경을 살펴보는 마지막 장소입니다. 도착 시각에 따라 영업 모습이 달라질 수 있으므로 현장 안내를 확인하고, 사람과 상품을 가까이 촬영할 때에는 동의를 구하는 것을 기본으로 합니다.' },
    ], '늦은 도착일에는 세 곳을 모두 방문하려고 서두르지 않습니다. 감천 관람 가능 시간과 숙소 체크인을 먼저 확인하고 시장 구간을 줄이세요. 숙박·식사는 별도로 선택해야 하며 실제 이동 시간은 확정되지 않았습니다.'),
    makeDay(slowId, 2, '걷는 해안과 쉬는 해변', '이기대는 낮 산책으로, 광안리는 산책 이후의 휴식 장소로 둡니다. 보행량을 줄일 수 있게 출발 전에 구간을 정합니다.', [
      { id: 'public-busan-igidae', heading: '이기대는 날씨와 체력부터 확인', body: '이날의 주된 활동은 해안길 걷기입니다. 아카이브 사진의 야간 분위기와 실제 권장 방문 시간을 구분해 낮 시간에 개방된 구간을 선택하세요.\n\n전 구간 완주를 목표로 하지 않습니다. 비나 강풍, 보행로 통제가 있으면 산책을 취소하거나 범위를 줄이고, 필요한 경우 이 장소를 제외한 뒤 광안리 중심의 일정으로 수정하세요.' },
      { id: 'public-busan-gwangalli', heading: '걷고 난 뒤에는 장소보다 휴식', body: '광안리는 두 번째 코스를 소화하는 장소가 아니라 쉬어가는 해변으로 구성했습니다. 광안대교가 보이는 방향을 따라 짧게 걷고, 앉아서 쉬거나 식사를 고르는 시간을 넉넉히 두세요.\n\n행사 일정이나 야경 점등을 보장하지 않습니다. 방문일 공식 안내를 확인하고 숙소로 돌아가는 교통편에 맞춰 마무리하면 됩니다.' },
    ], '물과 보행에 맞는 신발을 준비하고 현장 안전 안내를 우선합니다. 이기대와 광안리를 잇는 실제 이동편을 확인한 뒤 일정을 확정하세요. 사진 속 구간의 야간 개방을 가정해서는 안 됩니다.'),
    makeDay(slowId, 3, '해운대에서 남기는 마지막 바다', '여행의 마지막 날은 동백섬과 해운대 두 곳만 남겼습니다. 귀가 시간에 따라 한 곳으로 줄일 수 있습니다.', [
      { id: 'public-busan-dongbaek', heading: '마지막 날의 산책은 짧게', body: '체크아웃 이후에는 짐을 가지고 긴 길을 걷기 어렵습니다. 짐 보관과 귀가 준비를 먼저 마친 뒤 동백섬의 개방된 산책로 일부를 선택하세요. 나무와 바다, 도시가 함께 보이는 장면을 여행의 마지막 사진으로 남길 수 있습니다.' },
      { id: 'public-busan-haeundae', heading: '더 채우지 않아도 되는 해변', body: '해운대에서는 추가 관광지보다 귀가 전 여유 시간을 확보합니다. 남은 시간에 맞춰 짧게 걷고, 이번 여행에서 좋았던 장소와 다음에 다시 보고 싶은 장소를 내 여행에 메모해 보세요.\n\n해변 행사와 입수 가능 여부는 사진만으로 판단하지 않습니다. 날씨와 현장 통제, 역·공항까지의 실제 이동 시간을 확인한 뒤 마무리하세요.' },
    ], '돌아가는 열차·항공편의 시간에서 역산해 출발 시각을 정하세요. 이 샘플에는 예약과 실시간 교통이 연결되어 있지 않습니다. 일정 복사 후 숙소, 실제 이동, 방문 사진을 수정해 자신의 여행기로 완성할 수 있습니다.'),
  ] }),
  journey({ id: heritageId, title: '고분의 초록과 연못의 빛, 경주 이틀', region: '경주', duration: '1박 2일', cover: gyeongjuDonggung, summary: '대릉원과 첨성대, 월정교와 동궁과 월지. 경주 시내의 유적 네 곳을 두 날에 나눠 둘러보는 가이드.', tags: ['경주', '1박2일', '신라', '역사산책', '공공자료'], introduction: '경주시의 시내권 관광 안내를 바탕으로 네 장소를 두 날에 나눈 편집 일정입니다. 유적의 설명을 읽는 시간과 쉬는 시간을 함께 두며, 야간 사진은 장면 참고용으로 사용합니다. 관람 시간은 원문 작성 이후 바뀔 수 있으므로 현재 안내를 확인해야 합니다.', days: [
    makeDay(heritageId, 1, '고분 사이 산책과 첨성대', '첫날에는 대릉원과 첨성대를 중심으로 경주의 유적 공간을 살펴봅니다. 각 장소의 실내 관람이나 추가 유적은 선택 사항으로 남깁니다.', [
      { id: 'public-gyeongju-daereungwon', heading: '대릉원은 하나의 사진보다 산책으로', body: '대릉원 항공사진은 고분들이 모여 있는 지형을 이해하는 자료로 봐주세요. 실제 관람은 지상 보행로에서 이루어지므로 사진과 같은 시야를 얻는 일정은 아닙니다.\n\n관람 가능한 길을 따라 걷다가 마음에 드는 나무나 곡선을 찾는 시간을 제안합니다. 시설별 운영 시간과 입장 조건을 미리 확인하고, 햇빛과 비에 대비해 보행 시간을 조정하세요.' },
      { id: 'public-gyeongju-cheomseongdae', heading: '첨성대를 풍경 속에서 바라보기', body: '첨성대는 구조물의 윤곽을 살피는 시간과 주변 열린 공간을 함께 바라보는 시간으로 나눠보세요. 현장 안내를 읽고 자신의 언어로 한 줄을 남기면 단순한 인증 사진과 다른 여행 기록이 됩니다.\n\n유적 보호를 위한 출입 제한을 지키고, 꽃이나 행사 장면은 계절마다 달라진다는 점을 전제로 방문합니다.' },
    ], '숙소는 아직 포함하지 않았습니다. 체크인과 식사를 정한 뒤 두 장소의 순서를 조정하세요. 원문 코스의 2023년 운영 정보를 현재 정보로 옮기지 않았으며 방문일의 공식 관람 안내를 확인해야 합니다.'),
    makeDay(heritageId, 2, '남천의 다리와 월지의 반영', '월정교와 동궁과 월지를 연결합니다. 야경을 선택한다면 귀가 시간을 늦출 수 있는지 먼저 확인하고, 그렇지 않다면 낮 관람으로 바꿉니다.', [
      { id: 'public-gyeongju-woljeonggyo', heading: '강변에서 다리의 전체 모습 보기', body: '월정교에서는 복원된 다리 자체와 남천의 풍경을 함께 살펴봅니다. 사진은 밤에 촬영된 모습이지만 낮에 구조와 색을 관찰하는 일정으로 바꿔도 됩니다.\n\n다리 내부와 강변의 개방 구간을 확인하고, 촬영을 위해 보행로 밖이나 제한 구역으로 내려가지 않도록 계획하세요.' },
      { id: 'public-gyeongju-donggung', heading: '연못을 따라 바뀌는 장면', body: '동궁과 월지는 전각 한 곳만 찍는 장소보다 연못을 따라 시선을 옮기는 관람으로 제안합니다. 수면의 반영과 건물의 배치가 걷는 위치마다 어떻게 달라지는지 살펴보세요.\n\n야간 관람을 원한다면 현재 입장 마감과 귀가 교통편을 먼저 확인해야 합니다. 자료 사진의 조명이 방문일에도 같은 시간에 켜진다고 가정하지 않습니다.' },
    ], '둘째 날의 관람 시각은 미정입니다. 귀가 시간이 이르다면 낮에 둘러보고, 야경을 원한다면 교통편과 현재 운영 시간을 확인한 뒤 순서를 조정하세요. 실제 교통수단·입장권·숙박 예약이 포함된 상품은 아닙니다.'),
  ] }),
];
