import type { Place } from './data';

export const demoPlaceStoriesEnabled = import.meta.env?.VITE_SPOTLOG_DEMO_PLACES === '1';

type DemoComment = {
  author: string;
  rating: number;
  text: string;
  replies?: ReadonlyArray<{ author: string; text: string }>;
};

type DemoPlaceReview = {
  rating: number;
  reviewCount: number;
  comments: ReadonlyArray<DemoComment>;
};

type ReviewExample = {
  ids: readonly string[];
  comments: ReadonlyArray<DemoComment>;
};

const cafeAuthors = ['바다 보는 민서', '주말산책자', '사진 모으는 지우'] as const;
const foodAuthors = ['한끼지도', '여행하는 지우', '주말의 서윤'] as const;
const hotelAuthors = ['걷는 가족', '파도소리', '여행노트 수빈'] as const;

function example(
  ids: readonly string[],
  authors: readonly [string, string, string],
  scores: readonly [number, number, number],
  texts: readonly [string, string, string],
  reply: readonly [string, string],
): ReviewExample {
  return {
    ids,
    comments: authors.map((author, index) => ({
      author,
      rating: scores[index]!,
      text: texts[index]!,
      replies: index === 0 ? [{ author: '동네여행자', text: reply[0] }, { author, text: reply[1] }] : undefined,
    })),
  };
}

const examples = [
  example(['catalog-busan-waveon', 'busan-waveon'], cafeAuthors, [5, 5, 4], [
    '부모님과 기장 드라이브 중 들렀어요. 바다 보면서 커피를 마시니 여기서 조금 더 쉬었다 가자는 얘기가 나왔어요.',
    '해운대에서 여기까지 한날에 넣는다면 이동 시간을 넉넉히 잡을래요. 카페 한 곳만 들러도 일정이 충분했어요.',
    '바다 쪽 자리를 생각하고 갔는데 바람이 있어서 저희는 실내에서 쉬었어요. 다음엔 산책까지 이어가고 싶어요.',
  ], [
    '어른들과 가려는데 해변 산책이랑 같은 날에 넣을 만할까요?',
    '저희 가족은 기장 쪽끼리 묶으니 여유가 있었어요. 카페 앞뒤로 이동 시간을 먼저 확인하고 날짜를 잡았어요.',
  ]),
  example(['catalog-busan-hanok'], cafeAuthors, [5, 4, 5], [
    '바다가 보고 싶은 가족과 조용히 대화하고 싶은 가족이 있었는데, 이날은 한옥에서 차 마시는 쪽으로 골랐어요.',
    '오후 일정 사이 한 시간만 비워 두고 들르니 사진도 찍고 일행과 느긋하게 이야기했어요.',
    '여기서 잠깐 쉬고 바다를 보러 가니 하루 분위기가 달라졌어요. 한 곳쯤 성격이 다른 후보를 넣어두길 잘했어요.',
  ], [
    '바다 전망 카페하고 고민하면 어떤 기준으로 고를까요?',
    '저희는 이날 여러 번 바다를 봤어서 카페는 대화하기 편한 분위기를 골랐어요.',
  ]),
  example(['catalog-busan-sea-and-tree'], cafeAuthors, [4, 5, 4], [
    '일광 쪽 바다를 보고 나서 커피 시간을 잡았어요. 운전하는 사람도 여기서 한숨 돌리니 좋았다고 했어요.',
    '날이 흐려도 창 너머 바다를 보며 앉아 있으니 다음 목적지를 서두르지 않게 되더라고요.',
    '기장 안에서도 이동 시간이 생각보다 길었어요. 다음에는 점심과 카페를 더 가까운 곳으로 묶어 보려고요.',
  ], [
    '일광 해변을 먼저 들르는 일정으로도 괜찮았나요?',
    '저희 가족은 해변부터 보고 카페에 갔어요. 같은 기장이라도 출발 위치에 따라 이동 시간을 먼저 보는 편이 좋겠어요.',
  ]),
  example(['catalog-busan-bibibidang'], cafeAuthors, [5, 4, 4], [
    '가족끼리 바다 산책하고 나서 차 마시는 시간을 잡았어요. 같이 앉아 여행 얘기하기에 좋은 마무리였어요.',
    '일정에 카페 후보가 두 곳이었는데, 이날은 커피보다 차를 마시고 싶은 사람이 많아 선택했어요.',
    '성인 네 명 일정이라 잠깐 들렀지만 다음엔 차를 천천히 음미할 시간을 더 잡고 싶어요.',
  ], [
    '달맞이길 산책 다음에 갈 때 시간 얼마나 잡았나요?',
    '저희는 차 마시고 쉬는 시간으로 한 시간을 비워 뒀어요.',
  ]),
  example(['catalog-busan-piark'], cafeAuthors, [4, 5, 5], [
    '영도에서 찍은 사진을 정리할 겸 가족끼리 빵과 커피를 나눴어요. 오후 일정 전에 잠깐 쉬기 좋았어요.',
    '차량 이동 시간이 길어져서 다른 카페는 빼고 여기 한 곳만 남겼는데, 여유롭게 앉길 잘했어요.',
    '여행 첫날이 아니라 영도에만 머무는 날에 들르니 일정이 덜 바빴어요.',
  ], [
    '영도에서 산책도 함께 하면 너무 빠듯할까요?',
    '저희는 점심 뒤에 산책 하나만 잡고 카페에 왔어요. 오후를 비워 두면 훨씬 편했어요.',
  ]),
  example(['catalog-busan-choryang1941'], cafeAuthors, [5, 4, 4], [
    '부산역 도착 뒤 점심 전 시간이 비어서 초량 쪽에서 커피를 마셨어요. 부산 첫 일정이 느긋해졌어요.',
    '일행이 각자 기차로 와서 합류 전 시간을 보낼 장소로 확인했어요.',
    '골목을 천천히 보는 코스로 잡으니 좋았어요. 짐이 많은 날은 걷는 구간을 먼저 확인할래요.',
  ], [
    '캐리어 들고 바로 이동하는 일정도 생각 중인데 어땠나요?',
    '저희는 짐을 먼저 맡긴 다음 초량 골목을 걸었어요. 가벼워서 더 즐거웠어요.',
  ]),
  example(['catalog-busan-haemok'], foodAuthors, [5, 5, 4], [
    '해운대에서 일행들이 좋아하는 메뉴가 달라서 후보를 비교했는데, 일본식 장어를 좋아하는 가족 의견이 모였어요.',
    '점심 뒤 해변을 걷는 일정이라 식당을 멀리 잡지 않은 게 좋았어요.',
    '시간이 촉박한 날이면 식사 후보를 하나 더 정해 갈래요. 식사 시간 전후로 일정을 여유 있게 잡으니 편했어요.',
  ], [
    '생선 종류를 잘 안 먹는 일행이 있으면 어떨까요?',
    '저희도 다시 간다면 미리 메뉴를 같이 보고 정할 것 같아요. 취향이 갈리면 다른 후보도 보관함에 담아 두면 편해요.',
  ]),
  example(['catalog-busan-pungwon-gogi'], foodAuthors, [4, 5, 4], [
    '어른들과 같이 먹는 점심이라 각자 원하는 걸 튀지 않게 골라 먹을 수 있는 한식 후보를 찾다가 담았어요.',
    '카페는 일정을 바꾸기 쉽지만 가족 점심은 마음 편한 곳이 좋아서 여기로 의견이 모였어요.',
    '해변 구경을 먼저 하고 생각보다 배가 고파져서, 다음에 올 땐 점심 시간부터 정하고 움직일래요.',
  ], [
    '일행이 다섯 명이면 당일에 정해도 될까요?',
    '저희는 식당에 직접 인원과 시간을 문의하고 정했어요. 다 함께 앉을 수 있는지 알아두니 편했어요.',
  ]),
  example(['busan-amso', 'catalog-busan-amso', 'catalog-busan-geodae'], foodAuthors, [5, 4, 5], [
    '가족여행에서 저녁 한 끼는 고기로 먹자는 의견이 많았어요. 숙소와 식당이 가까운 후보를 남긴 게 편했어요.',
    '식사 뒤 다른 장소를 또 넣으려다가 저녁 하나로 마무리했어요. 일행들 반응이 더 좋았어요.',
    '모임 비용을 미리 맞추려면 메뉴 단위를 각자 생각한 것과 비교해 두는 게 좋겠어요.',
  ], [
    '코스 정할 때 예산은 어떻게 맞췄나요?',
    '저희는 식사 예산부터 정하고, 식당의 최신 메뉴를 직접 확인한 뒤 투표했어요.',
  ]),
  example(['catalog-busan-geumsu', 'catalog-busan-milyang-gukbap'], foodAuthors, [5, 4, 4], [
    '해운대 일정을 시작하기 전에 국물 있는 식사를 하고 싶어 고른 후보예요. 식사 시각을 먼저 정하니 만나기 쉬웠어요.',
    '어른 한 분이 걷는 게 힘들다고 하셔서 식사 끝나고 다음 장소까지 거리부터 봤어요.',
    '간단히 먹고 해변을 볼 때 잘 맞는 일정이었어요. 다음에는 일행의 메뉴 취향을 미리 확인하려고요.',
  ], [
    '여행 첫날 점심에도 괜찮을까요?',
    '도착 시간이 제각각이면 도착 안내부터 공유해 두는 게 좋더라고요.',
  ]),
  example(['catalog-busan-shinbalwon', 'catalog-busan-bonjeon'], foodAuthors, [5, 4, 4], [
    '부산역에서 돌아가기 전에 점심을 먹을 후보를 준비해 뒀어요. 역까지 다시 가는 시간을 생각해 코스를 정했어요.',
    '기차 시간 앞에 식사를 하나만 넣어 두니 할 일이 줄어 들어서 좋았어요.',
    '시간이 촉박한 일행은 역에서 바로 합류했고, 저희는 식사만 하고 함께 이동했어요.',
  ], [
    '출발 직전에 들르면 시간 괜찮을까요?',
    '저희는 기차 출발 시간을 먼저 봤어요. 여유가 없으면 다음 일정에 담아 두는 것도 괜찮아요.',
  ]),
  example(['catalog-busan-ijaemo', 'catalog-busan-gukje-chicken'], foodAuthors, [5, 5, 4], [
    '남포동에서 친구들끼리 나눠 먹을 점심 후보를 골랐어요. 식사 뒤 시장 구경까지 이어가기 편했어요.',
    '점심 자리에서 어디를 먼저 둘러볼지 같이 정하니 나머지 일정이 쉽게 이어졌어요.',
    '다음에는 저녁보다 이른 점심으로 잡아서 시장을 천천히 더 볼래요.',
  ], [
    '남포동에서 여러 명이 모이면 장소 공유는 어떻게 하나요?',
    '일행이 상호하고 주소를 둘 다 볼 수 있도록 약속에 장소 카드로 공유했어요.',
  ]),
  example(['catalog-busan-halme-gaya', 'catalog-busan-sageori-bunsik', 'catalog-busan-seunggi-hotteok', 'catalog-busan-gukbo-miyeok'], foodAuthors, [4, 4, 5], [
    '하루 종일 걷는 일정이라 중간에 음식점 하나를 함께 담았어요. 다음 장소에서 가고 싶은 길을 정하기도 좋았어요.',
    '여행지에서 먹는 한 끼를 빨리 정하니 일행끼리 식당만 오래 찾는 일이 줄었어요.',
    '개인 입맛은 다를 수 있지만 저희 일행은 여행 분위기를 느낄 수 있는 메뉴로 골라 재미있었어요.',
  ], [
    '식당 후보를 고를 때 무엇을 먼저 봤나요?',
    '같이 갈 일행이 먹을 수 있는 메뉴가 있는지부터 보고, 걸어서 이어갈 수 있는 곳을 골랐어요.',
  ]),
  example(['busan-signiel', 'catalog-busan-signiel', 'catalog-busan-paradise'], hotelAuthors, [5, 5, 4], [
    '가족이 한날에 모두 해운대까지 이동해서 숙소에 먼저 짐을 두고 바다를 보러 나갔어요. 긴 이동이 줄었어요.',
    '숙소에서 쉬는 시간도 여행이라고 생각해서 저녁 약속을 가깝게 잡았어요.',
    '객실별 선택지가 다르니 예약 전에는 인원과 침대 유형까지 다시 확인할 거예요.',
  ], [
    '부모님과 아이가 같이 갔는데 객실을 어떻게 정했나요?',
    '저희는 한 방을 전제로 하지 않고 함께 갈 인원과 침대를 확인한 다음 예산을 맞췄어요.',
  ]),
  example(['catalog-busan-shilla-stay', 'catalog-busan-westin', 'catalog-busan-park-hyatt'], hotelAuthors, [5, 4, 4], [
    '아침에 일행이 각자 출발할 수 있어서 이동을 한 권역으로 묶은 숙소를 골랐어요.',
    '여행 날짜를 먼저 정하고 객실을 찾아보니 선택이 쉬웠어요. 일정을 짜기 전에 총액을 확인했어요.',
    '숙소에 오래 머무르기보다는 해변을 자주 오갔어요. 저는 다음에도 저녁 동선부터 볼 것 같아요.',
  ], [
    '차 없이 가는데 숙소 고를 때 무엇을 보셨나요?',
    '기차에서 내려 오는 길하고 밤에 식사 후 돌아가는 길을 둘 다 확인했어요.',
  ]),
  example(['public-busan-haeundae', 'busan-haeundae', 'public-busan-dongbaek'], cafeAuthors, [5, 4, 5], [
    '우리 가족은 해운대 걷는 시간을 따로 두었어요. 바다를 꼭 끝까지 보려고 하지 않으니 사진도 더 여유 있게 찍었어요.',
    '앉아서 쉬는 곳을 일정에 하나 넣으니 사람마다 걷는 속도가 달라도 무리 없었어요.',
    '바닷가 바람이 있던 날이라 가디건 하나씩 챙겼어요. 다음엔 햇볕에 쉴 장소도 찾아둘래요.',
  ], [
    '유모차를 가져갈 때 어떻게 준비했나요?',
    '저희는 길찾기와 현장 안내로 걷기 편한 구간부터 찾아봤어요.',
  ]),
  example(['public-busan-ilgwang', 'public-busan-jukseong', 'busan-haedong-yonggungsa'], cafeAuthors, [5, 4, 4], [
    '바다를 오래 보는 한 곳을 고른 덕에 점심이나 카페를 급하게 결정하지 않아도 됐어요.',
    '근처라고 생각한 곳도 차로 이동 시간이 달랐어요. 같은 날 갈 장소끼리 지도로 먼저 확인했어요.',
    '사진을 찍고 돌아보는 데 여유가 있으면 체류 시간을 더 두고 싶어요.',
  ], [
    '뒤 일정은 얼마나 여유 있게 잡았나요?',
    '저희는 다음 장소 시간을 고정하지 않고, 먼저 바닷가에서 충분히 쉬었어요.',
  ]),
] satisfies ReviewExample[];

function summarize(comments: readonly DemoComment[]): DemoPlaceReview {
  const reviewCount = comments.length;
  const rating = Math.round(comments.reduce((total, comment) => total + comment.rating, 0) / reviewCount * 10) / 10;
  return { rating, reviewCount, comments };
}

const additionalComments: Readonly<Record<string, readonly DemoComment[]>> = {
  'catalog-busan-waveon': [
    { author: '느린 오후', rating: 4, text: '기장 안에서 어디로 차를 타고 갈지 일행하고 먼저 정했어요. 카페 하나로 오후 시간을 여유롭게 썼어요.' },
    { author: '유나의 여행장', rating: 5, text: '바다보다 수다에 더 오래 머문 날이었어요. 신경 써서 넣은 카페 시간이 가족한테도 좋았다고 들었어요.' },
  ],
  'catalog-busan-hanok': [
    { author: '차 한 모금', rating: 5, text: '가족들이 사진을 찍는 동안 저는 차 마시면서 다음에 갈 곳을 찾아봤어요. 비워 둔 한 시간이 잘 쓰였어요.' },
  ],
  'catalog-busan-haemok': [
    { author: '바다 음식지도', rating: 4, text: '음식 메뉴부터 함께 고르니 약속 시간을 정할 때 의견이 빨리 모였어요. 식사 뒤 해변 걷기도 좋았어요.' },
  ],
  'busan-signiel': [
    { author: '두 아이랑 여행', rating: 4, text: '아침에 아이들과 바로 바닷가에 나갔어요. 가까운 동선이 육아 여행에는 제일 중요해요.' },
    { author: '여행한켠', rating: 5, text: '마지막 날 일정이 너무 길어지지 않아 좋았어요. 숙소에서 다음 목적지까지 이동을 미리 정해 놓았어요.' },
  ],
};

const reviews = new Map<string, DemoPlaceReview>();
for (const { ids, comments } of examples) {
  const extra = additionalComments[ids[0]!];
  const review = summarize(extra ? [...comments, ...extra] : comments);
  for (const id of ids) reviews.set(id, review);
}

const businessExamples: Partial<Record<Place['kind'], ReviewExample>> = {
  SHOP: example([], foodAuthors, [5, 4, 4], [
    '여행 끝날 때 집에 가져갈 것을 고르려고 상점 후보에 담아뒀어요. 이동 전에 필요한 품목을 일행과 확인했어요.',
    '구경하는 시간이 생각보다 길었어요. 빡빡한 코스보다 오후에 여유를 두고 들러서 편했어요.',
    '같이 갈 가족이 선물을 고르는 동안 주변 일정에 여유를 둔 게 좋았어요.',
  ], ['짧게 들를 계획이면 시간을 얼마나 잡았나요?', '저희는 품목을 미리 정하고 다른 일정과 시간이 겹치지 않게 잡았어요.']),
  LEISURE: example([], cafeAuthors, [5, 4, 5], [
    '모임에서 장소를 고른 뒤 참가 인원과 이용 시간을 확인했어요. 다 같이 경험할 곳이라 이동 계획부터 공유했어요.',
    '날씨에 따라 바꿀 수 있도록 실내 후보를 하나 더 담아 뒀어요.',
    '활동 뒤 쉬어 갈 장소를 정해두니 같은 권역에서 하루를 차분하게 마무리했어요.',
  ], ['모임 인원이 바뀌면 예약 전에 확인할 게 있을까요?', '이용 가능 인원과 준비물을 장소 안내에서 다시 보고 약속에 올렸어요.']),
};

export function getDemoPlaceReview(place: Place): DemoPlaceReview | undefined {
  if (place.personal) return undefined;
  const known = reviews.get(place.id);
  if (known) return known;
  const category = businessExamples[place.kind];
  if (!category || !place.area.startsWith('부산')) return undefined;
  return summarize(category.comments);
}

export function compareDemoPlaceReviews(left: Place, right: Place): number {
  const leftReview = getDemoPlaceReview(left), rightReview = getDemoPlaceReview(right);
  return (rightReview?.rating ?? 0) - (leftReview?.rating ?? 0)
    || (rightReview?.reviewCount ?? 0) - (leftReview?.reviewCount ?? 0);
}

const sponsoredPlaceIds = [
  'catalog-busan-hanok', 'catalog-busan-sea-and-tree', 'catalog-busan-bibibidang',
  'catalog-busan-piark', 'catalog-busan-choryang1941', 'catalog-busan-paradise',
  'catalog-busan-shilla-stay', 'catalog-busan-park-hyatt', 'catalog-busan-westin',
  'catalog-busan-pungwon-gogi', 'catalog-busan-haemok', 'catalog-busan-geumsu', 'catalog-busan-geodae',
  'catalog-busan-ijaemo', 'catalog-busan-gukje-chicken', 'catalog-busan-halme-gaya', 'catalog-busan-gukbo-miyeok',
] as const;

/** Select one separately labelled demonstration slot without mutating the organic results. */
export function selectDemoSponsoredPlace(organicPlaces: readonly Place[], catalogue: readonly Place[]): Place | undefined {
  const first = organicPlaces[0];
  if (!first || first.personal) return undefined;
  const candidates = sponsoredPlaceIds.flatMap(id => {
    const place = catalogue.find(item => item.id === id && !item.personal && item.kind === first.kind && item.area === first.area);
    return place && place.id !== first.id ? [place] : [];
  });
  return candidates.find(place => !organicPlaces.some(item => item.id === place.id)) ?? candidates[0];
}
