import { findCommunityTrip } from './community-trips';
import { findFood, findPlace, findStay } from './trip-data';
import { resolveSocialTarget, type SocialTarget } from './social-target';

/** Reserved exclusively for immutable demo records, never a device-authored ID. */
export const SAMPLE_SOCIAL_ID_PREFIX = 'sample-social-';
export type SocialSampleAuthor = Readonly<{ id: string; name: string; initial: string; color: string }>;
export type SocialSampleThread = Readonly<{
  id: string;
  author: SocialSampleAuthor;
  body: string;
  parentId: string | null;
  createdAt: string;
}>;
export type SocialSample = Readonly<{
  source: 'SAMPLE';
  copies: number | null;
  reactions: Readonly<{ LIKE: number; LOVE: number; BEST: number; HELPFUL: number }>;
  threads: readonly SocialSampleThread[];
}>;

const authors: readonly SocialSampleAuthor[] = Object.freeze([
  Object.freeze({ id: 'sample-person-minseo', name: '민서의 지도', initial: '민', color: '#e2ece7' }),
  Object.freeze({ id: 'sample-person-haru', name: '하루산책', initial: '하', color: '#f1e7d8' }),
  Object.freeze({ id: 'sample-person-yunseul', name: '윤슬노트', initial: '윤', color: '#e0eaf4' }),
  Object.freeze({ id: 'sample-person-green', name: '초록기록', initial: '초', color: '#e9e5f2' }),
]);

// Fictional planning conversations. These deliberately avoid asserting visits,
// opening hours, prices, availability or other unverified business facts.
const jejuBodies: Readonly<Record<string, readonly [string, string, string, string]>> = Object.freeze({
  hyeopjae: ['첫날 오전은 협재에서 바다를 보며 시작하는 걸로 담았어요. 금능도 같은 날 묶으니 제 여행 취향에 잘 맞네요.', '저도 두 바다를 같이 넣어봤어요. 사진 찍는 시간까지 넉넉하게 비워 두려고요.', '아이와 가는 여행이라 해변 산책 후 쉬는 시간을 일정에 더 넣었어요. 빠듯한 코스보다 이 흐름이 좋아요.', '좋은 생각이에요. 저도 오후 카페 시간을 조금 길게 잡아볼게요.'],
  geumneung: ['협재 다음에 금능을 넣어봤어요. 바다를 두 번 보는 날이라 중간 점심 시간을 넉넉하게 두려고요.', '저는 두 곳 중 한 곳에서 더 오래 쉬는 방향으로 일정 수정해봤어요.', '이번 여행은 장소를 많이 담기보다 금능에서 천천히 걷는 시간을 남겨 두고 싶어요.', '여유 있는 바다 일정 좋네요. 제 여행에도 이 장소를 담아뒀어요.'],
  osulloc: ['둘째 날 시작을 차밭으로 잡으니 전날 바다 일정과 분위기가 달라져서 마음에 들어요.', '저도 초록 풍경을 좋아해서 오전 후보로 담아뒀어요.', '식사와 다음 장소 사이에 여유 시간을 넣어봤어요. 차밭 사진을 찍는 시간을 따로 남겨 두려고요.', '그렇게 수정하니까 일정이 덜 빡빡해 보이네요. 참고할게요.'],
  songaksan: ['둘째 날 오후 풍경 코스로 담았어요. 다음 카페까지 지도에서 함께 보니 하루 흐름을 잡기 편하네요.', '저도 풍경을 보는 시간을 넉넉하게 배분하려고요. 이동 경로를 먼저 확인해 볼게요.', '부모님과 가는 여행이라 산책은 가볍게 하고 쉬는 장소를 하나 더 넣는 쪽으로 계획 중이에요.', '동행에 맞춰 조정할 수 있어서 좋네요. 저도 휴식 시간을 추가했어요.'],
  saebyeol: ['둘째 날에 더 들르고 싶어서 추가 후보로 담았어요. 시간이 부족하면 다음 여행으로 옮기려고요.', '저도 필수 방문보다 선택 일정으로 두니 계획하기 편하더라고요.', '오름 풍경을 좋아해서 제 여행에는 이 장소를 꼭 넣었어요. 다른 방문 시간을 조금 줄여봤어요.', '여행 취향에 맞춰 우선순위를 바꾸는 방법 좋네요. 참고할게요.'],
  'catalog-jeju-hyeopjae-sin-guksu': ['협재 산책 뒤 점심 후보로 협재신국수를 담았어요. 식사 전후 방문 장소를 함께 볼 수 있어 계획하기 편하네요.', '저도 첫날 점심 후보에 넣어봤어요. 출발 전에 메뉴와 운영 안내를 확인하려고요.', '일행이 먹고 싶은 메뉴가 달라서 식당 후보를 두 개 담고 비교 중이에요.', '좋은 방법이에요. 저는 대안 식당을 하나 남겨 두는 쪽으로 수정했어요.'],
  'catalog-jeju-paratodos': ['금능을 본 다음 쉬는 시간으로 파라토도스를 넣어봤어요. 카페까지 한 번에 이어 보니 일정이 구체적이네요.', '저도 오후 일정 사이에 쉬는 시간을 넉넉하게 넣어두려고요.', '카페에서 여행 사진을 정리하는 시간을 갖고 싶어서 제 일정에 담았어요.', '장소만 계속 이동하는 것보다 휴식이 있는 구성이 마음에 드네요.'],
  'catalog-jeju-landing-shinhwa': ['첫날 마지막을 랜딩관 제주신화월드 호텔앤리조트로 잡고, 다음 날 첫 장소까지 동선을 확인해봤어요.', '숙소에서 둘째 날로 이어지는 길을 같이 보니까 계획을 잡기 좋네요.', '일행과 이야기해보고 숙박 후보에 담았어요. 객실과 예약 조건은 따로 확인하려고요.', '저도 아직 예약 전이라 후보로만 남겨 뒀어요. 이동 일정부터 맞춰볼게요.'],
  'catalog-jeju-myeongri-main': ['오설록 다음 점심 후보로 명리동식당 본점을 담았어요. 오후 방문 전 식사 시간을 넉넉하게 잡으려고요.', '저도 이 순서로 계획해봤어요. 일행 취향에 맞는지는 메뉴를 확인해볼게요.', '여행 식당을 정할 때 지도에서 다음 장소와 같이 비교할 수 있어서 도움이 돼요.', '맞아요. 저는 식사 뒤 바로 이동하지 않고 쉬는 시간을 더 넣었어요.'],
  'catalog-jeju-coffee-sketch': ['송악산 다음에 커피스케치를 카페 후보로 넣었어요. 사계리 쪽까지 이동하는 흐름을 지도에서 확인해봤어요.', '저도 카페를 담고 전체 동선을 보면서 오후 방문 순서를 조정 중이에요.', '둘째 날 쉬어 가는 장소로 담았어요. 사진과 위치를 함께 보니 일행에게 설명하기 편하네요.', '저도 공유할 여행 초안에 넣어뒀어요. 방문 전 운영 안내는 확인하려고요.'],
  'catalog-jeju-bongseong': ['새별오름 다음 저녁 후보로 봉성식당을 담았어요. 하루 마지막 식사까지 계획에 넣으니 흐름이 정리돼요.', '저도 마지막 장소 뒤 식사로 두고 전체 경로를 확인해볼게요.', '식당 하나로 확정하기 전 다른 후보도 담아 비교하고 있어요. 일행 의견을 더 받아보려고요.', '여럿이 가는 여행에는 후보를 남겨두는 게 좋네요. 제 일정도 그렇게 수정할게요.'],
});

function hash(text: string, seed: number): number {
  let result = seed;
  for (let index = 0; index < text.length; index++) result = Math.imul(result ^ text.charCodeAt(index), 16777619);
  return result >>> 0;
}
const cache = new Map<string, SocialSample>();

/** Immutable, explicitly fictional community baseline, separate from local writes. */
export function getSocialSample(target: SocialTarget): SocialSample | null {
  const resolved = resolveSocialTarget(target);
  if (!resolved) return null;
  const existing = cache.get(resolved.key);
  if (existing) return existing;
  const firstHash = hash(resolved.key, 2166136261);
  const identifier = [firstHash, hash(resolved.key, 3335557771)].map(value => value.toString(16).padStart(8, '0')).join('');
  const rootId = `${SAMPLE_SOCIAL_ID_PREFIX}${identifier}`;
  let bodies: readonly [string, string, string, string];
  if (target.kind === 'course') {
    const trip = findCommunityTrip(target.id)!;
    bodies = target.id === 'community-jeju-west-real-11'
      ? ['바다와 차밭에 식당·카페·숙소까지 이어져 있어 첫 제주 여행 초안으로 담았어요. 제 여행에서는 오후 휴식 시간을 더 늘려보려고요.', '저도 가져와서 둘째 날 추가 방문을 줄여봤어요. 동행에 맞게 바꾸기 좋네요.', '숙소에서 다음 날 첫 장소까지 전체 경로를 함께 볼 수 있어서 계획을 정리하는 데 도움이 돼요.', '저도 일정 순서를 바꿔 보면서 비교 중이에요. 여행 전에 운영 안내는 따로 확인할게요.']
      : [`${trip.region} 여행 초안을 찾다가 이 코스를 담았어요. ${trip.days > 1 ? '첫날과 다음 날' : '오전과 오후'} 흐름이 보여서 제 여행 취향에 맞게 수정해보려고요.`, '저도 가져온 뒤 쉬는 시간을 더 넣어봤어요. 일행과 이야기하며 조정하기 좋네요.', '장소뿐 아니라 식사와 휴식까지 같이 계획할 수 있어서 마음에 들어요. 동선을 보며 방문 순서를 살펴보고 있어요.', '저도 제 여행에 담아두고 선택 방문을 조금 줄여봤어요.'];
  } else {
    const id = resolved.entityId!;
    const item = findPlace(id) ?? findFood(id) ?? findStay(id);
    const curated = jejuBodies[id];
    if (curated) bodies = curated;
    else {
      const type = findStay(id) ? '숙박 후보' : findFood(id)?.kind === 'CAFE' ? '쉬어 갈 카페' : findFood(id)?.kind === 'SHOP' ? '들러볼 상점' : findFood(id) ? '식사 후보' : '방문 장소';
      bodies = [`${item!.name}도 ${type}로 담았어요. 앞뒤 장소를 함께 보며 제 여행 순서에 맞춰보려고요.`, '저도 여행 후보에 넣어뒀어요. 일행 의견을 듣고 방문 시간을 조정해볼게요.', '일정에 여유 시간을 남겨 두고 이 장소를 계획해봤어요. 다른 후보와 위치를 비교하기 편하네요.', '저도 전체 동선을 보고 쉬는 시간을 조금 더 넣는 쪽으로 수정했어요.'];
    }
    if (target.kind === 'course-place') {
      const visit = findCommunityTrip(target.id)!.visits[target.visitIndex];
      bodies = [`DAY ${visit.day} ${visit.label}에 넣어둔 ${resolved.title} 카드가 마음에 들어요. 이 코스를 가져와서 제 일정에 맞게 시간을 조정해보려고요.`, bodies[1], bodies[2], bodies[3]];
    }
  }
  const authorOffset = firstHash % authors.length;
  const parentIndexes = [null, 0, null, 2] as const;
  const times = ['2026-10-23T03:15:00.000Z', '2026-10-23T04:20:00.000Z', '2026-10-24T01:00:00.000Z', '2026-10-24T01:10:00.000Z'];
  const threads = Object.freeze(bodies.map((body, index): SocialSampleThread => Object.freeze({
    id: `${rootId}-${index + 1}`,
    author: authors[(authorOffset + index) % authors.length], body,
    parentId: parentIndexes[index] === null ? null : `${rootId}-${parentIndexes[index]! + 1}`,
    createdAt: times[index],
  })));
  const likeMode = resolved.reactionMode === 'like';
  const sample: SocialSample = Object.freeze({
    source: 'SAMPLE',
    copies: target.kind === 'course' ? target.id === 'community-jeju-west-real-11' ? 236 : 124 + firstHash % 560 : null,
    reactions: Object.freeze(likeMode
      ? { LIKE: target.kind === 'entity' ? 32 + firstHash % 97 : 9 + firstHash % 38, LOVE: 0, BEST: 0, HELPFUL: 0 }
      : target.id === 'community-jeju-west-real-11' ? { LIKE: 0, LOVE: 82, BEST: 63, HELPFUL: 114 }
        : { LIKE: 0, LOVE: 26 + firstHash % 60, BEST: 17 + firstHash % 43, HELPFUL: 38 + firstHash % 92 }),
    threads,
  });
  cache.set(resolved.key, sample);
  return sample;
}

/** A parent ID is valid only inside this exact entity/course/block scope. */
export function findSampleThread(target: SocialTarget, id: string): SocialSampleThread | null {
  if (typeof id !== 'string' || !id.startsWith(SAMPLE_SOCIAL_ID_PREFIX)) return null;
  return getSocialSample(target)?.threads.find(thread => thread.id === id) ?? null;
}
