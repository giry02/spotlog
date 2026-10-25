import type { ChatRequest } from './chat-contract';
import { communityTrips } from './community-trips';
import { communityResults, currentTrip } from './trip-engine';
import { isExplicitAppSocialRequest, isSocialFeatureRequest } from './social-intent';

/** Copying only a course title into trip metadata does not import its visits. */
export function isTripTitleCopyRequest(request: ChatRequest): boolean {
  if (request.action.type !== 'message') return false;
  const text = request.action.text.normalize('NFKC').replace(/\s+/g, '');
  return /복사해(?:줘|주세요)?(?:[.!?。]|$)/.test(text) && /여행(?:의)?(?:이름|제목)|여행명/.test(text) &&
    /(?:제목|이름|여행명)만|여행(?:의)?(?:이름|제목)(?:에|으로|로)(?:만)?복사|여행명(?:에|으로|로)(?:만)?복사/.test(text);
}

/** Bounds a model-selected copy to the one public candidate explicitly named
 * by the human. It never creates or executes a copy action. */
export function publicCourseCopyTarget(request: ChatRequest): string | undefined {
  if (request.action.type !== 'message' || isTripTitleCopyRequest(request)) return;
  const text = request.action.text.normalize('NFKC').replace(/\s+/g, '');
  if (!/가져(?:와|오)|복사(?:해|할)|내여행(?:에|으로).{0,20}(?:담아|옮겨)/.test(text) ||
      /방법|어떻게|무슨뜻|설명|가능|할수있|(?:가져(?:오|와)|복사(?:하|해)?)(?:기|는|를|은|도)?(?:아직|절대)?(?:해주|주|하|해)?지(?:는)?(?:마|말|않)|(?:안|아직안)(?:가져|복사)|복사(?:는|를)?안|복사해(?:주)?면안(?:돼|되|됩)/.test(text)) return;
  const state = currentTrip(request.session), candidates = communityResults(state);
  const named = communityTrips.filter(course => text.includes(course.title.replace(/\s+/g, '')) || text.includes(course.id));
  if (named.length) return named.length === 1 && candidates.some(course => course.id === named[0].id) ? named[0].id : undefined;
  if (state.stage !== 'community' || !/코스|내여행/.test(text)) return;
  const ordinals = [...text.matchAll(/첫번째|두번째|세번째|네번째|다섯번째|마지막|([1-9]\d?)번째/g)];
  if (ordinals.length !== 1) return;
  const ordinal = ({ 첫번째: 1, 두번째: 2, 세번째: 3, 네번째: 4, 다섯번째: 5, 마지막: candidates.length } as Record<string, number>)[ordinals[0][0]] ?? Number(ordinals[0][1]);
  return candidates[ordinal - 1]?.id;
}

/** Selects the model's bounded tool context only. This never executes an action
 * or converts a user's sentence to a completed app operation. */
export function localFeatureTask(request: ChatRequest): 'community' | 'media' | 'local-trip' | 'app' | 'reorder' | 'social' | null {
  if (request.action.type !== 'message') return null;
  const text = request.action.text.normalize('NFKC').replace(/\s+/g, '');
  if (isExplicitAppSocialRequest(request.action.text) && /스레드/.test(text)) return 'app';
  if (isSocialFeatureRequest(currentTrip(request.session), request.action.text)) return 'social';
  // Ignore only an explicitly forbidden traffic lookup when choosing a tool.
  // The original message still reaches the model and action validators unchanged.
  const facts = text.replace(/교통(?:은|는|을|를|도)?(?:조회|검색|확인|안내)?하지(?:마(?:세요)?|말(?:아(?:줘|주세요)?)?|않(?:아|고|는)?)/g, '');
  if (/날씨|기온|예보|실시간|영업|입장|교통|새로.{0,12}(?:만들|짜)|일정.{0,12}(?:새로만들|짜줘)/.test(facts)) return null;
  if (isTripTitleCopyRequest(request)) return null;
  // A named public course copied "as my draft" is a public-source operation,
  // not the plan-status editor selected by the later generic "초안으로" rule.
  if (publicCourseCopyTarget(request)) return 'community';
  if (/좋아요|응원|여행기(?:전체)?댓글|전체댓글|내프로필|내등급|내활동|기기활동|활동통계|프로필(?:화면|요약|활동|등급)/.test(text)) return 'app';
  // Keeping another visit/DAY order unchanged is not a reorder request. Preserve
  // the existing metadata/DAY editor when that phrase is only a protection clause.
  const orderRequest = text.replace(/(?:나머지|다른|기존|현재|날짜별|방문과|일정과|방문|일정)*순서(?:는|를|도)?(?:그대로)?(?:유지(?:해줘|해주세요|해|하고)?|둬|두고|바꾸지(?:마|말고|말아줘)|변경하지(?:마|말고|말아줘))/g, '');
  if (/드래그|순서편집|방문순서|방문.{0,10}순서|일정순서/.test(orderRequest)) return 'reorder';
  if (/공개코스|여행자코스|다른사람.{0,12}(?:여행|코스)|다른여행자|AI추천(?:코스|여행)|공공자료(?:추천|기획)|작성자.{0,12}(?:여행|코스|소개)/i.test(text)) return 'community';
  if (/사진피드|사진둘러|등록사진|실제사진|사진으로장소|포토모션|갤러리|사진.{0,8}보여/.test(text)) return 'media';
  // A journal draft is an app destination, distinct from itinerary DRAFT status.
  if (/여행기.{0,12}초안/.test(text)) return 'app';
  if (/오프라인|최근.{0,10}(?:저장|여행)|마지막.{0,8}저장|찜한.{0,10}(?:곳|장소)|찜목록|작성완료|완료(?:로|상태)|초안(?:으로|상태)/.test(text)) return 'local-trip';
  if (/여행기.{0,12}(?:작성|편집|사진|초안|미리보기|공개범위)|사진.{0,8}(?:첨부|업로드)|댓글창|댓글시트|개인장소등록|직접장소등록|비밀번호재설정|로그아웃|계정탈퇴|회원탈퇴|이메일인증/.test(text)) return 'app';
  return null;
}
export const usesLocalFeatureNavigator = (request: ChatRequest) => localFeatureTask(request) !== null;

/** Checks only explicit photo filters; the model still chooses every action. */
export function mediaActionMatchesRequest(action: Extract<ChatRequest['action'], { type: 'media' }>, input: string): boolean {
  const scopes = input.normalize('NFKC').split(/[.!?。\n]/).map(clause => clause.replace(/\s+/g, ''))
    // A forbidden viewing mode is not a positive photo-filter requirement.
    .map(clause => clause.replace(/(?:포토모션|사진(?:피드)?)(?:은|는|을|를|도|으로|로)?(?:아직|절대)?(?:(?:보여주|보여|재생하|표시하|조회하|열|하)지(?:마(?:세요)?|말(?:아(?:줘|주세요)?)?|않(?:아|고|는)?)|안(?:보여|재생|표시|조회|열|해))/g, ''))
    .filter(clause => /사진|포토모션|갤러리/.test(clause))
    .map(clause => clause.replace(/(?:관광지|관광명소|랜드마크|식당|음식점|카페|상점|쇼핑|숙소|호텔|포토모션)(?:은|는|을|를|도)?(?:말고|제외|빼고)/g, ''));
  if (!scopes.length) return true;
  const scope = scopes.join(' ');
  const regions = [...new Set(scope.match(/제주|서울|부산|경주|강릉/g) ?? [])];
  if (/전체지역|모든지역/.test(scope)) { if (action.region !== null) return false; }
  else if (regions.length === 1 && action.region !== regions[0]) return false;
  const kinds = ([
    ['LANDMARK', /관광지|관광명소|랜드마크/],
    ['FOOD', /식당|음식점|맛집/],
    ['CAFE', /카페/],
    ['SHOP', /상점|쇼핑|시장/],
    ['STAY', /숙소|숙박|호텔/],
  ] as const).filter(([, pattern]) => pattern.test(scope)).map(([kind]) => kind);
  if (/전체종류|모든종류/.test(scope)) { if (action.kind !== 'all') return false; }
  else if (kinds.length === 1 && action.kind !== kinds[0]) return false;
  const mode = /포토모션/.test(scope) ? 'motion' : /사진/.test(scope) ? 'photos' : undefined;
  return mode === undefined || action.mode === mode;
}
