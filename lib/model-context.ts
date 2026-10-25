import type { ChatRequest } from './chat-contract';
import {
  currentTrip,
  communityResults,
  foodResults,
  placeResults,
  stayResults,
} from './trip-engine';
import { places, restaurants, stays } from './trip-data';
import { communityModelCandidates } from './community-discovery';
import { mediaCatalogSummary, mediaModelCandidates } from './discovery-media';
import { recentActiveTrip } from './trip-local-features';
import { socialRequestCandidates, socialRequestedView } from './social-intent';
import { socialModelSamples } from './social-model-samples';

/** A server-owned snapshot of canonical IDs and fields; no client-supplied endpoint is forwarded. */
export function modelContext(request: ChatRequest) {
  const s = currentTrip(request.session);
  const socialCandidates = request.action.type === 'message' ? socialRequestCandidates(s, request.action.text) : [];
  return {
    dataMode: 'authored-demo-data',
    warning:
      '등록 업체는 Spotlog 공식자료 스냅샷이며 현재 영업·가격·도보시간·빈방은 미확인이다. registered:false 업체는 가상 체험 예시다. priceVerified:false의 price:0과 walkVerified:false의 walk:0은 미확인 호환값이며 무료·0분으로 설명하지 않는다. 공개 코스·작성자 프로필은 데모 예시이며 실제 회원 게시물 아님. 실제 예약·결제·계정 DB 연동 없음.',
    state: {
      stage: s.stage,
      region: s.region,
      days: s.days,
      title: s.title ?? '',
      startDate: s.startDate ?? null,
      businessMode: s.businessMode ?? 'demo',
      nearbyExpanded: s.nearbyExpanded ?? false,
      pendingCandidates: s.pendingCandidates ?? [],
      activeDay: s.activeDay,
      theme: s.theme,
      similarTo: s.similarTo,
      anchorId: s.anchorId,
      foodId: s.foodId,
      cafeId: s.cafeId,
      stayId: s.stayId,
      foodKind: s.foodKind,
      cuisine: s.cuisine,
      walk: s.walk,
      foodBudget: s.foodBudget,
      stayBudget: s.stayBudget,
      booked: s.booked,
      meals: s.meals,
      cafes: s.cafes,
      lodging: s.lodging,
      editingId: s.editingId,
      savedIds: s.savedIds,
      collectedIds: s.collectedIds ?? [],
      plan: s.plan,
      comparisonIds: s.comparisonIds ?? [],
      detailId: s.detailId ?? null,
      communitySourceId: s.communitySourceId ?? null,
      communityRegion: s.communityRegion ?? null,
      communityTheme: s.communityTheme ?? 'all',
      communityQuery: s.communityQuery ?? '',
      communityType: s.communityType ?? 'all',
      communityDays: s.communityDays ?? null,
      communityAuthorId: s.communityAuthorId ?? null,
      mediaMode: s.mediaMode ?? 'photos',
      mediaRegion: s.mediaRegion ?? null,
      mediaKind: s.mediaKind ?? 'all',
      planStatus: s.planStatus ?? 'DRAFT',
      savedRegion: s.savedRegion ?? null,
      offlinePackageId: s.offlinePackageId ?? null,
      socialTarget: s.socialTarget ?? null,
      socialView: s.socialView ?? 'overview',
    },
    candidates: {
      places: placeResults(s),
      food: foodResults(s),
      cafes: foodResults({ ...s, foodKind: '카페' }),
      shops: foodResults({ ...s, foodKind: '상점' }),
      stays: s.booked ? [] : stayResults(s),
    },
    // This bounded catalog includes official RAG destinations and enables selecting search parameters before
    // selecting a candidate in the same batch; execution still checks live filters.
    catalog: { places, food: restaurants, stays },
    // Course IDs use a separate namespace from place/business IDs.
    // Only the filtered visible courses may be copied, with their source preserved.
    publicCourses: {
      sourceKind: 'demo',
      notice:
        '공개 여행 화면을 위한 데모 작성자·코스 예시. 실제 Spotlog 회원 기록을 조회한 결과가 아님.',
      candidates: communityModelCandidates(s),
      catalog: communityModelCandidates(),
    },
    media: { ...mediaCatalogSummary(), candidates: mediaModelCandidates(s), catalog: mediaModelCandidates() },
    social: {
      candidates: socialCandidates,
      requestedView: request.action.type === 'message' ? socialRequestedView(request.action.text) : 'overview',
      publicMetrics: { source: 'UNCONNECTED', copies: null, reactions: null, threads: null },
      publicSamples: socialModelSamples(socialCandidates),
      writeMode: 'user-panel-only',
      notice: 'publicSamples는 가상 사용자의 제작 샘플이며 실제 회원 집계·방문 후기가 아니다. 실제 회원 서버 집계는 미연결이다. 이 기기의 댓글·반응·저장 사본은 화면에서만 확인하며 모델에 전달하지 않는다. 업체 전체와 각 코스 방문 카드의 스레드는 서로 별개다.',
    },
    savedTrips: request.session.library.filter(plan => !plan.deletedAt).map(plan => ({id:plan.id,title:plan.title,region:plan.region,days:plan.days,startDate:plan.startDate??null,status:plan.status??'DRAFT',visitCount:plan.visits.length})),
    trashedTrips: request.session.library.filter(plan => Boolean(plan.deletedAt)).map(plan=>({id:plan.id,title:plan.title,region:plan.region,days:plan.days,deletedAt:plan.deletedAt,purgeAfter:plan.purgeAfter})),
    recentTrip: (()=>{const plan=recentActiveTrip(request.session);return plan?{id:plan.id,title:plan.title,region:plan.region,days:plan.days,status:plan.status??'DRAFT'}:null;})(),
    offlineTrips: (request.session.offlineTrips??[]).map(pack=>({id:pack.id,sourcePlanId:pack.sourcePlanId,title:pack.title,region:pack.region,days:pack.days,capturedAt:pack.capturedAt,visitCount:pack.visits.length})),
    allowedToolTypes: [
      'reorder-visits',
      'configure',
      'region',
      'show',
      'place',
      'food',
      'stay',
      'select-entity',
      'collect-entity',
      'uncollect-entity',
      'bookmark',
      'walk',
      'cuisine',
      'stay-budget',
      'compare',
      'detail',
      'budget',
      'check',
      'build',
      'day',
      'add-selected',
      'add-entity',
      'edit',
      'remove',
      'move',
      'transfer',
      'directions',
      'progress',
      'save',
      'open',
      'library',
      'history',
      'help',
      'copy-community',
      'community-filter',
      'trip-meta','visit-details','stay-placement','day-add','day-copy','day-delete','visit-copy','candidate-propose','candidate-select','candidate-apply','candidate-reject','trash-list','trash','restore','open_spotlog',
      'saved-filter','plan-status','continue-trip','offline-save','offline-open','offline-remove','offline-library','media','social',
    ],
    conversationControls:
      'reset/undo/resume는 명시적 사용자 문구를 서버에서 별도 처리하므로 모델 actions에 넣지 말 것.',
  };
}
