import busanHaeundaeCover from '../../assets/spotlog/busan-haeundae-blue-hour.webp';
import gangwonEastSeaCover from '../../assets/spotlog/gangwon-east-sea-sunrise.webp';
import seoulForestCover from '../../assets/spotlog/seoul-forest-evening.webp';
import { discoveryLandmarks, initialJourneys, placeCatalog, type Journey, type JourneyDay, type Place, type StoryBlock } from './data';
import { publicTourismJourneys } from './publicTourismContent';
import { distanceKm, roundMinutes, parseDurationMinutes, formatClock } from './routeData';
import { projectPublicJourney } from './reviewServiceBridge';
import { getPhotoSource } from './photoSources';
import type { PublicSourceCredit } from './publicServiceTypes';

export interface JourneyComment {
  id: string;
  journeyId: string;
  author: string;
  authorId?: string;
  body: string;
  createdAt: string;
  avatar?: string;
  authorCopies: number;
}

export const defaultComments: JourneyComment[] = [
  { id: 'comment-jeju-1', journeyId: 'jeju-west-slow', author: '바다수집가', body: '사진만 예쁜 게 아니라 이동 순서가 현실적이라 그대로 담아가고 싶어요.', createdAt: '8월 22일', authorCopies: 86 },
  { id: 'comment-jeju-2', journeyId: 'jeju-west-slow', author: '주말여행러', body: '숙소를 중간에 둔 이유까지 적혀 있어서 정말 유용했습니다. 최고예요!', createdAt: '8월 21일', authorCopies: 14 },
  { id: 'comment-busan-1', journeyId: 'busan-oldtown-to-sea', author: '골목산책', body: '부산의 서로 다른 분위기를 이틀에 나눈 구성이 너무 좋아요.', createdAt: '8월 19일', authorCopies: 238 },
  { id: 'comment-gangwon-1', journeyId: 'gangwon-sea-and-river', author: '느린발걸음', body: '장소를 욕심내지 않는 일정이라 부모님과 가기 좋겠어요.', createdAt: '8월 17일', authorCopies: 32 },
  { id: 'comment-seoul-1', journeyId: 'seoul-seongsu-day', author: '도시산책자', body: '멀리 떠나지 않아도 하루 여행이 된다는 구성이 마음에 들어요.', createdAt: '8월 15일', authorCopies: 54 },
  { id: 'comment-suncheon-1', journeyId: 'suncheon-yeosu-three-days', author: '갈대밭노트', body: '순천의 초록에서 여수의 밤으로 넘어가는 흐름을 그대로 담았습니다.', createdAt: '8월 13일', authorCopies: 127 },
  { id: 'comment-east-1', journeyId: 'east-coast-four-days', author: '파도수집가', body: '강릉부터 고성까지 올라가는 방향이라 매일 풍경이 달라지는 게 좋아요.', createdAt: '8월 11일', authorCopies: 311 },
  { id: 'comment-south-1', journeyId: 'southern-road-five-days', author: '시장과바다', body: '긴 일정인데 하루마다 도시의 성격이 분명해서 따라가기 편해 보여요.', createdAt: '8월 9일', authorCopies: 73 },
];

export interface HomeTripTemplate {
  sourceTripId?: string;
  publicJourney?: Journey;
  id: string;
  region: string;
  eyebrow: string;
  title: string;
  summary: string;
  duration: string;
  dayCount: number;
  cover: string;
  places: Place[];
}

const orderPlacesByDistance = (places: Place[]) => {
  if (places.length < 2) return [...places];
  const remaining = places.slice(1);
  const ordered = [places[0]];
  while (remaining.length) {
    const previous = ordered[ordered.length - 1];
    let nearestIndex = 0;
    remaining.forEach((candidate, index) => {
      if (distanceKm(previous, candidate) < distanceKm(previous, remaining[nearestIndex])) nearestIndex = index;
    });
    ordered.push(remaining.splice(nearestIndex, 1)[0]);
  }
  return ordered;
};

export const buildAiJourneyDraft = (sourcePlaces: Place[], requestedDays: number, isSample: boolean, sourceLabel = '저장한 랜드마크', seedId?: string): Journey => {
  const uniquePlaces = Array.from(new Map(sourcePlaces.map((place) => [place.id, place])).values());
  const orderedPlaces = orderPlacesByDistance(uniquePlaces);
  const dayCount = Math.max(1, Math.min(requestedDays, orderedPlaces.length, 7));
  const broadRegions = Array.from(new Set(orderedPlaces.map((place) => place.area.split(' ')[0])));
  const region = broadRegions.length === 1 ? broadRegions[0] : '국내';
  const id = seedId ?? `journey-ai-${Date.now()}`;
  let offset = 0;

  const days: JourneyDay[] = Array.from({ length: dayCount }, (_, dayIndex) => {
    const remainingPlaces = orderedPlaces.length - offset;
    const remainingDays = dayCount - dayIndex;
    const placesForDay = orderedPlaces.slice(offset, offset + Math.ceil(remainingPlaces / remainingDays));
    offset += placesForDay.length;
    let startMinutes = 9 * 60 + 30;
    const plannedPlaces = placesForDay.map((place, placeIndex) => {
      const previous = placeIndex > 0 ? placesForDay[placeIndex - 1] : undefined;
      let move = '하루 시작';
      if (previous) {
        const distance = distanceKm(previous, place);
        const walk = distance < 1.2;
        const moveMinutes = walk ? roundMinutes((distance / 4.5) * 60) + 5 : roundMinutes((distance / 25) * 60 + 8) + 10;
        startMinutes += (parseDurationMinutes(previous.duration) ?? 60) + moveMinutes;
        move = `${walk ? '도보' : '차량'} 약 ${moveMinutes}분`;
      }
      return { ...place, time: formatClock(startMinutes), move };
    });
    const names = plannedPlaces.map((place) => place.name);
    const blockPrefix = `${id}-day-${dayIndex + 1}`;
    const blocks: StoryBlock[] = [
      {
        id: `${blockPrefix}-intro`,
        type: 'TEXT',
        heading: 'AI가 제안한 하루의 흐름',
        body: `${names.length > 1 ? `${names[0]}에서 시작해 ${names.slice(1, -1).length ? `${names.slice(1, -1).join(', ')}을 지나 ` : ''}${names[names.length - 1]}까지` : names[0]} 이어지는 동선입니다. 장소 수보다 머무는 시간을 우선해 하루가 너무 빡빡해지지 않도록 구성했습니다.\n\n이 글은 ${sourceLabel}의 위치와 체류시간을 바탕으로 만든 초안입니다. 실제 방문 전 운영시간과 현장 상황을 확인하고, 마음에 맞게 사진과 경험을 더해보세요.`,
      },
    ];
    plannedPlaces.forEach((place, placeIndex) => {
      blocks.push({ id: `${blockPrefix}-place-${placeIndex}`, type: 'PLACE', placeId: place.id });
      blocks.push({
        id: `${blockPrefix}-note-${placeIndex}`,
        type: 'TEXT',
        heading: `${place.name}에서 놓치지 않을 것`,
        body: `${place.description}\n\n좋은 점 · ${place.hook ?? `${place.area}의 분위기를 직접 보고 여행의 장면으로 남기기 좋습니다.`}\n\nAI 가이드 메모 · ${place.note}`,
      });
    });
    return {
      day: dayIndex + 1,
      date: `DAY ${dayIndex + 1}`,
      title: `${plannedPlaces[0]?.area ?? region}의 장면을 잇는 날`,
      story: `${names.join(' → ')} 순서로 이동합니다. 장소 사이 거리와 예상 체류시간을 기준으로 만든 편집 가능한 일정입니다.`,
      places: plannedPlaces,
      blocks,
    };
  });

  const duration = dayCount === 1 ? '당일 여행' : `${dayCount - 1}박 ${dayCount}일`;
  return {
    id,
    title: isSample ? '제주 여행 초안' : `${region} 여행 초안`,
    region,
    dateRange: '날짜 미정 · AI 초안',
    duration,
    status: 'PLANNING',
    visibility: 'PRIVATE',
    cover: orderedPlaces[0].image,
    summary: `${sourceLabel} ${orderedPlaces.length}곳을 거리와 체류시간에 맞춰 ${dayCount}일 여행으로 엮었습니다.`,
    story: 'Spotlog AI 여행 만들기가 장소의 위치, 지역, 추천 시간과 체류시간을 읽어 첫 동선을 만들었습니다. 지도 경로를 확인한 뒤 일정과 글, 사진을 자유롭게 고쳐 나만의 여행기로 완성할 수 있습니다.',
    tags: ['AI초안', region, `${orderedPlaces.length}곳`],
    saves: 0,
    days,
    author: 'Spotlog AI · 나',
    isMine: true,
  };
};

const placesById = (ids: string[]) => ids.map((id) => placeCatalog.find((place) => place.id === id)).filter((place): place is Place => Boolean(place));

export const homeTripTemplates: HomeTripTemplate[] = [
  {
    id: 'curation-jeju-west', region: '제주', eyebrow: '바다 · 차밭 · 오름', title: '제주 서쪽의 장면만 천천히', duration: '1박 2일', dayCount: 2,
    summary: '협재의 바다에서 안덕의 차밭과 해안, 새별오름까지 이어지는 느린 제주 일정입니다.',
    cover: discoveryLandmarks[0].image,
    places: placesById(['jeju-hyeopjae', 'jeju-osulloc', 'jeju-sagye', 'jeju-saebyeol']),
  },
  {
    id: 'curation-busan-coast', region: '부산', eyebrow: '원도심 · 해운대 · 기장', title: '부산의 오래된 골목과 새 바다', duration: '1박 2일', dayCount: 2,
    summary: '감천의 골목에서 시작해 해운대의 밤과 기장 해안까지 이동하는 부산 동서 여행입니다.',
    cover: busanHaeundaeCover,
    places: placesById(['busan-gamcheon', 'busan-signiel', 'busan-amso', 'busan-waveon']),
  },
  {
    id: 'curation-gangwon-slow', region: '강원', eyebrow: '동해 · 강변', title: '강릉의 아침, 정선의 느린 오후', duration: '1박 2일', dayCount: 2,
    summary: '안목해변의 아침 산책과 아우라지 강변의 오후를 각각 충분히 머무는 일정입니다.',
    cover: gangwonEastSeaCover,
    places: placesById(['gangneung-anmok', 'jeongseon-rail']),
  },
  {
    id: 'curation-seoul-halfday', region: '서울', eyebrow: '숲 · 골목 · 한강', title: '서울숲에서 한강까지 걷는 하루', duration: '당일 여행', dayCount: 1,
    summary: '서울숲의 초록에서 성수 골목을 지나 뚝섬의 저녁까지, 걸어서 이어지는 도심 하루 여행입니다.',
    cover: seoulForestCover,
    places: placesById(['seoul-seoulforest', 'seoul-seongsu-yeonbang', 'seoul-tukseom-hangang']),
  },
  {
    id: 'curation-suncheon-yeosu', region: '전남', eyebrow: '정원 · 갈대 · 여수 밤바다', title: '초록에서 밤바다로, 순천과 여수', duration: '2박 3일', dayCount: 3,
    summary: '순천의 정원과 갈대밭을 충분히 걷고 여수의 섬과 야경으로 마무리하는 2박 3일입니다.',
    cover: placesById(['suncheon-garden'])[0]?.image ?? gangwonEastSeaCover,
    places: placesById(['suncheon-garden', 'suncheon-bay', 'yeosu-odongdo', 'yeosu-dolsan']),
  },
  {
    id: 'curation-east-coast', region: '강원', eyebrow: '강릉 · 양양 · 속초 · 고성', title: '파도를 따라 북쪽으로 가는 동해안', duration: '3박 4일', dayCount: 4,
    summary: '강릉의 아침부터 양양의 해안, 속초의 시장과 고성의 잔잔한 바다까지 북쪽으로 이어갑니다.',
    cover: gangwonEastSeaCover,
    places: placesById(['gangneung-anmok', 'gangneung-ojukheon', 'yangyang-naksansa', 'yangyang-surfy', 'sokcho-yeonggeumjeong', 'sokcho-central-market', 'goseong-ayajin', 'goseong-cheonjin']),
  },
  {
    id: 'curation-southern-road', region: '남도', eyebrow: '전주 · 담양 · 순천 · 여수 · 통영', title: '골목과 정원, 섬을 잇는 남도 로드트립', duration: '4박 5일', dayCount: 5,
    summary: '전주의 골목에서 출발해 담양과 순천의 초록을 지나 여수와 통영의 바다에 닿는 긴 국내 여행입니다.',
    cover: busanHaeundaeCover,
    places: placesById(['jeonju-hanok', 'jeonju-nambu-market', 'damyang-juknokwon', 'damyang-metasequoia', 'suncheon-garden', 'suncheon-bay', 'yeosu-odongdo', 'yeosu-dolsan', 'tongyeong-dongpirang', 'tongyeong-mireuksan']),
  },
];

export const publishTemplateJourney = (template: HomeTripTemplate, meta: { id: string; title: string; author: string; dateRange: string; saves: number; story: string }): Journey => {
  const generated = buildAiJourneyDraft(template.places, template.dayCount, false, '여행자가 고른 장소', meta.id);
  return {
    ...generated,
    id: meta.id,
    title: meta.title,
    region: template.region,
    duration: template.duration,
    cover: template.cover,
    dateRange: meta.dateRange,
    status: 'PUBLISHED',
    visibility: 'PUBLIC',
    summary: template.summary,
    story: meta.story,
    tags: [template.region, template.duration, '여행자가이드'],
    saves: meta.saves,
    views: Math.round(meta.saves * 8.4),
    author: meta.author,
    isMine: false,
    days: generated.days.map((day) => ({
      ...day,
      blocks: day.blocks.map((block) => block.type !== 'TEXT' ? block : {
        ...block,
        heading: block.heading === 'AI가 제안한 하루의 흐름' ? '이 여행의 하루 흐름' : block.heading,
        body: block.body?.replace('AI 가이드 메모', '여행자 메모').replace('이 글은 여행자가 고른 장소의 위치와 체류시간을 바탕으로 만든 초안입니다.', '이 글은 실제로 고른 장소의 위치와 머문 시간을 바탕으로 정리한 여행 기록입니다.'),
      }),
    })),
  };
};

export const previewTemplateJourney = (template: HomeTripTemplate): Journey => {
  if (template.publicJourney) return { ...template.publicJourney, title: template.title, summary: template.summary, cover: template.cover };
  const preview = publishTemplateJourney(template, {
    id: `preview-${template.id}`,
    title: template.title,
    author: 'Spotlog 큐레이션',
    dateRange: '추천 일정 · 날짜를 정해 담아보세요',
    saves: 0,
    story: `Spotlog가 ${template.eyebrow}을 중심으로 골라 구성한 ${template.region} 추천 일정입니다. 날짜별 장소와 이동 동선을 먼저 살펴보고, 마음에 들면 내 여행에 담아 일정과 기록을 자유롭게 바꿔보세요.`,
  });
  return { ...preview, days: preview.days.map((day) => ({ ...day, date: `${day.day}일차` })) };
};

const homeCommunityJourneys: Journey[] = [
  publishTemplateJourney(homeTripTemplates[0], {
    id: 'jeju-west-weekend', title: '주말에 천천히 만난 제주 서쪽', author: '제주주말러', dateRange: '2026.08.01 — 08.02', saves: 736,
    story: '협재의 바다를 오래 보고 다음 날 차밭과 오름으로 이어갔다. 장소를 많이 넣지 않고 서로 가까운 장면을 묶어, 짧은 주말에도 이동에 쫓기지 않았던 제주 기록이다.',
  }),
  publishTemplateJourney(homeTripTemplates[1], {
    id: 'busan-oldtown-to-sea', title: '골목에서 바다까지, 부산의 두 얼굴', author: '부산산책자', dateRange: '2026.07.11 — 07.12', saves: 842,
    story: '원도심 골목의 높낮이와 해운대의 밤, 다음 날 기장 바다까지 부산의 서로 다른 표정을 이틀에 나눠 걸었다. 유명 장소를 체크하기보다 동네가 바뀌는 방향을 따라간 기록이다.',
  }),
  publishTemplateJourney(homeTripTemplates[2], {
    id: 'gangwon-sea-and-river', title: '동해의 아침과 정선의 느린 오후', author: '느린주말', dateRange: '2026.06.06 — 06.07', saves: 619,
    story: '첫날은 강릉 바다 앞에서 오래 걷고, 둘째 날은 산길을 넘어 정선의 물가에 앉았다. 장소를 많이 넣지 않아 이동 뒤에도 풍경을 충분히 볼 수 있었던 강원 여행이다.',
  }),
  publishTemplateJourney(homeTripTemplates[3], {
    id: 'seoul-seongsu-day', title: '숲과 골목, 한강으로 이어지는 서울 하루', author: '퇴근후서울', dateRange: '2026.07.25 · 당일', saves: 524,
    story: '서울숲에서 아침을 시작해 성수의 작은 가게를 보고, 해가 낮아질 무렵 한강으로 걸었다. 익숙한 도시에서도 걷는 방향을 정하면 한 편의 여행기가 된다는 걸 기록했다.',
  }),
  publishTemplateJourney(homeTripTemplates[4], {
    id: 'suncheon-yeosu-three-days', title: '순천의 초록에서 여수 밤바다까지', author: '남도기록', dateRange: '2026.06.19 — 06.21', saves: 903,
    story: '첫날은 국가정원의 초록, 둘째 날은 갈대밭의 저녁, 마지막은 여수 바다에 시간을 주었다. 순천과 여수를 빠르게 소비하지 않고 자연스럽게 분위기가 바뀌도록 만든 2박 3일이다.',
  }),
  publishTemplateJourney(homeTripTemplates[5], {
    id: 'east-coast-four-days', title: '강릉에서 고성까지 파도를 따라 북쪽으로', author: '해안선수집가', dateRange: '2026.05.02 — 05.05', saves: 1168,
    story: '강릉에서 시작해 양양과 속초를 지나 고성까지, 매일 조금씩 북쪽으로 올라갔다. 같은 동해라도 도시와 해변마다 다른 소리와 빛을 발견한 3박 4일 해안 기록이다.',
  }),
  publishTemplateJourney(homeTripTemplates[6], {
    id: 'southern-road-five-days', title: '전주 골목에서 통영의 섬까지', author: '긴주말여행자', dateRange: '2026.04.29 — 05.03', saves: 1376,
    story: '전주의 오래된 골목, 담양과 순천의 초록, 여수와 통영의 섬을 다섯 날에 나눴다. 이동하는 날에도 한 도시를 기억할 장면이 남도록 하루의 중심 장소를 분명히 한 남도 로드트립이다.',
  }),
];

export const publishedJourneySeeds: Journey[] = [...initialJourneys, ...homeCommunityJourneys, ...publicTourismJourneys];

/** Public bundled samples only. Never reads customer storage or authored private journeys. */
export function getConsumerPublicSeedProjection() {
  const credit = (image?: string): PublicSourceCredit | undefined => {
    const source = image && getPhotoSource(image); return source ? { provider: source.owner, author: source.author, sourceUrl: source.sourceUrl, license: source.license, licenseUrl: source.licenseUrl, checkedAt: source.verifiedAt, changes: source.changes } : undefined;
  };
  return { reports: [], comments: defaultComments.map(c => ({ commentId: c.id, revision: 1, journalId: c.journeyId, authorId: `public-author:${c.author}`, authorName: c.author, authorAvatar: c.avatar, original: c.body, english: '', createdAt: `2026-08-${c.createdAt.match(/(\d+)일/)?.[1].padStart(2, '0') ?? '01'}T00:00:00.000Z`, moderation: 'VISIBLE' as const, sourceKind: 'PUBLIC_SAMPLE' as const })), publicJournals: publishedJourneySeeds.filter(j => j.visibility === 'PUBLIC' && j.status === 'PUBLISHED' && j.purpose !== 'PLAN' && !j.trash).map(j => {
    const projected = projectPublicJourney(j);
    if (projected.cover) projected.cover.sourceCredit = credit(projected.cover.image);
    projected.days?.forEach(day => { day.places.forEach(place => { place.sourceCredit = credit(place.image); place.photos?.forEach(photo => { photo.sourceCredit = credit(photo.image); }); }); day.blocks.forEach(block => { block.sourceCredit = credit(block.image); block.images?.forEach(photo => { photo.sourceCredit = credit(photo.image); }); }); });
    projected.cards.forEach(card => { card.sourceCredit = credit(card.image); card.photos?.forEach(photo => { photo.sourceCredit = credit(photo.image); }); });
    return { ...projected, createdAt: '2026-10-05T00:00:00.000Z', metrics: { cheers: null, copies: j.saves, views: j.views ?? null, source: 'SAMPLE' as const } };
  }) };
}
