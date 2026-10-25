'use client';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  BedDouble,
  Bookmark,
  Check,
  ChevronDown,
  ChevronRight,
  Coffee,
  MessageCircle,
  Images,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  MoreHorizontal,
  Route,
  Sparkles,
  Store,
  Trash2,
  Utensils,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  createTripSession,
  currentTrip,
  isTripSession,
  explanation,
  foodResults,
  nextQuestions,
  nextPendingVisit,
  placeResults,
  stayResults,
  visitName,
  type TripAction,
  type TripSession,
  type TripState,
  type Visit,
} from '@/lib/trip-engine';
import {
  places,
  scenarios,
  findPlace,
  findFood,
  findStay,
  period,
  money,
  REGIONS,
  entityPriceLabel,
  getRegisteredEntity,
} from '@/lib/trip-data';
import { directionsTarget, nearbyMapSearch } from '@/lib/travel-links';
import { knowledgeSource } from '@/lib/rag-catalog';
import credits from '@/lib/photo-credits.json';
import { businessDetails, type BusinessRef } from '@/lib/business-details';
import {
  BusinessPreview,
  BusinessDetailBody,
  BusinessDetailAction,
  type OpenBusiness,
} from '@/components/business-detail';
import './trip-workspace.css';
import { ChatFeatureUnits } from '@/components/chat-feature-units';
import {
  explicitConversationControl,
  type ChatResponse,
} from '@/lib/chat-contract';
import { chatEntityDetail } from '@/lib/trip-chat-features';
import { CommunityUnit, CommunityTripBody } from '@/components/community-trips';
import { findCommunityTrip, type CommunityTrip } from '@/lib/community-trips';
import { TripMap } from '@/components/trip-map';
import { TripHeaderNavigation } from '@/components/trip-header-navigation';
import { placeMapCoordinates } from '@/lib/trip-map-data';
import { PlanEditControls, CandidateProposal, CandidateReview, TripLibraryManager, tripDayDate } from '@/components/trip-edit-controls';
import { SpotlogAppFeaturePanel, SpotlogNavigationCard, TripAppActions } from '@/components/spotlog-app-features';
import { RegisteredPhotoGallery } from '@/components/registered-photo-gallery';
import { EntityPhotoSourceButton } from '@/components/photo-source-modal';
import { TripReorderControls } from '@/components/trip-reorder-controls';
import { EntityShareControls, TripShareControls } from '@/components/trip-share-controls';
import { DiscoveryMediaUnit } from '@/components/discovery-media';
import { PlanLocalTools, OfflineTripUnit, SavedPlaceReferences, RecentTripEntry, type OpenSavedTripDay } from '@/components/trip-local-features';
import { applyOfflineTripClientAction } from '@/lib/offline-trip-client';
import { openSavedTripReferenceDay } from '@/lib/saved-trip-day-client';
import { SocialPanel, SocialSummary, SpotlogSocialLayer } from '@/components/spotlog-social';
import { createClientId } from '@/lib/client-id';

const STORAGE_KEY = 'moa.spotlog.travel.v1';
const kindIcon = {
  place: MapPin,
  food: Utensils,
  cafe: Coffee,
  stay: BedDouble,
  shop: Store,
};
const stageNames = {
  community: '다른 여행자 코스',
  collection: '이번 여행에 담은 곳',
  discover: '장소 찾기',
  place: '장소 선택',
  food: '주변 탐색',
  stay: '숙소 비교',
  saved: '찜한 장소',
  plan: '내 여행',
  route: '방문 순서',
  directions: '길찾기',
  progress: '여행 이어가기',
  external: '실제 주변 검색',
  compare: '후보 비교',
  budget: '여행 예산',
  check: '일정 점검',
  detail: '상세정보',
  library: '저장한 여행',
  history: '대화 이력',
  help: '대화로 할 수 있는 일',
  answer: '안내',
  trash: '삭제한 여행',
  offline: '오프라인 여행',
  media: '사진으로 발견',
  social: '평가와 스레드',
};
type Act = (action: TripAction) => void;

function UnitTitle({
  icon: Icon,
  label,
  title,
  count,
}: {
  icon: typeof MapPin;
  label: string;
  title: string;
  count?: string;
}) {
  return (
    <div className="tr-unit-heading">
      <span>
        <Icon size={15} />
        {label}
      </span>
      <div>
        <h2>{title}</h2>
        {count && <small>{count}</small>}
      </div>
    </div>
  );
}
function RegionButtons({ state, act }: { state: TripState; act: Act }) {
  return (
    <div className="tr-pills" aria-label="여행 지역">
      {REGIONS.map((region) => (
        <button
          key={region}
          aria-pressed={state.region === region}
          onClick={() => act({ type: 'region', region })}
        >
          {region}
        </button>
      ))}
    </div>
  );
}
function BusinessSourceControls({state,act}:{state:TripState;act:Act}){
  const registered=state.businessMode==='registered';
  return <div className="tr-business-source"><div className="tr-pills" aria-label="업체 자료 선택"><button aria-pressed={registered} onClick={()=>act({type:'configure',businessMode:'registered'})}>실제 등록 업체</button><button aria-pressed={!registered} onClick={()=>act({type:'configure',businessMode:'demo'})}>체험 업체</button></div>
    {registered&&<><div className="tr-pills" aria-label="주변 직선거리"><button aria-pressed={!state.nearbyExpanded} onClick={()=>act({type:'configure',nearbyExpanded:false})}>직선 3km</button><button aria-pressed={!!state.nearbyExpanded} onClick={()=>act({type:'configure',nearbyExpanded:true})}>직선 15km로 확대</button></div><p className="tr-meta">등록된 주소·사진·대표 좌표로 찾습니다. 가격·영업·도보 시간은 미확인입니다.</p></>}
  </div>;
}
function PlaceList({
  state,
  act,
  saved = false,
}: {
  state: TripState;
  act: Act;
  saved?: boolean;
}) {
  const results = saved
    ? places.filter(
        (p) =>
          state.savedIds.includes(p.id) &&
          (!state.region || p.region === state.region),
      )
    : placeResults(state);
  return (
    <section className="tr-unit">
      <UnitTitle
        icon={saved ? Bookmark : MapPin}
        label={
          saved ? '찜한 장소' : state.similarTo ? '분위기 비교' : '장소 발견'
        }
        title={
          saved
            ? '내가 담아둔 곳'
            : state.theme === 'sea'
              ? '바다에서 시작할까요?'
              : state.similarTo
                ? '이런 분위기는 어때요?'
                : '어디부터 가볼까요?'
        }
        count={`${results.length}곳`}
      />
      <RegionButtons state={state} act={act} />
      {!results.length && (
        <div className="tr-empty">
          <Bookmark size={24} />
          <p>
            {saved
              ? '이 지역에 찜한 장소가 없어요.'
              : '이 조건에 맞는 체험 장소가 없어요.'}
          </p>
          <Button
            variant="outline"
            onClick={() => act({ type: 'show', stage: 'discover' })}
          >
            장소 둘러보기
          </Button>
        </div>
      )}
      <div className="tr-place-list">
        {results.map((place, index) => (
          <article className="tr-place" key={place.id}>
            <button
              className="tr-place-pick"
              onClick={() => act({ type: 'place', id: place.id })}
              aria-label={`${index + 1}번 ${place.name} 선택`}
            >
              <img
                src={place.image}
                alt={place.imageKind === 'illustration' ? `${place.name} 안내용 공통 일러스트` : `${place.name} 풍경`}
                width={92}
                height={100}
              />
              <span>
                <small>
                  {String(index + 1).padStart(2, '0')} ·{' '}
                  {place.district ?? place.region}
                  {place.imageKind === 'illustration' && ' · 안내 일러스트'}
                </small>
                <strong>{place.name}</strong>
                <span>
                  {place.tags.slice(0, 2).join(' · ')}
                  {place.durationMinutes
                    ? ` · ${place.durationMinutes}분 체류 예시`
                    : ''}
                </span>
              </span>
              <ChevronRight size={16} />
            </button>
            <div className="tr-place-actions">
              <span>
                {state.similarTo ? '체험용 분위기 매칭' : place.description}
              </span>
              {!state.editingId && !state.plan.length && (
                <button
                  className="tr-place-collect"
                  aria-label={`${place.name} ${state.collectedIds?.includes(place.id) ? '담은 곳 보기' : '여행에 담기'}`}
                  onClick={() =>
                    act(
                      state.collectedIds?.includes(place.id)
                        ? { type: 'show', stage: 'collection' }
                        : { type: 'collect-entity', id: place.id },
                    )
                  }
                >
                  {state.collectedIds?.includes(place.id) ? '담았어요' : '담기'}
                </button>
              )}
              <button
                aria-label={`${place.name} ${state.savedIds.includes(place.id) ? '찜 해제' : '찜하기'}`}
                aria-pressed={state.savedIds.includes(place.id)}
                onClick={() => act({ type: 'bookmark', id: place.id })}
              >
                <Bookmark
                  size={17}
                  fill={
                    state.savedIds.includes(place.id) ? 'currentColor' : 'none'
                  }
                />
              </button>
            </div>
          </article>
        ))}
      </div>
      {saved && results.length > 0 && (
        <Button
          className="tr-primary"
          onClick={() => act({ type: 'build', savedOnly: true })}
        >
          이 장소로 {period(state.days)} 만들기
          <ArrowRight size={16} />
        </Button>
      )}
      {!saved && (
        <button
          className="tr-text-link"
          onClick={() => act({ type: 'show', stage: 'community' })}
        >
          <Users size={15} />
          다른 여행자 코스 둘러보기
          <ArrowRight size={14} />
        </button>
      )}
    </section>
  );
}
function SelectedPlace({ state, act }: { state: TripState; act: Act }) {
  const place = findPlace(state.anchorId);
  if (!place) return <PlaceList state={state} act={act} />;
  return (
    <section className="tr-unit tr-selected-place">
      <img className="tr-cover" src={place.image} alt={place.name + ' 풍경'} />
      <div className="tr-selected-copy">
        <span className="tr-eyebrow">{place.region} · 여행의 기준 장소</span>
        <h2>{place.name}</h2>
        <p>{place.tags.join(' · ')}</p>
        <SocialSummary target={{kind:'entity',id:place.id}} />
        {!state.plan.length && (
          <Button
            className="tr-primary"
            onClick={() =>
              act(
                state.collectedIds?.includes(place.id)
                  ? { type: 'show', stage: 'collection' }
                  : { type: 'collect-entity', id: place.id },
              )
            }
          >
            {state.collectedIds?.includes(place.id)
              ? '담은 곳 보기'
              : '이 장소 여행에 담기'}
            <ArrowRight size={16} />
          </Button>
        )}
        <div className="tr-context-actions">
          <Button onClick={() => act({ type: 'show', stage: 'food' })}>
            <Utensils size={16} />
            주변 식당
          </Button>
          <Button
            variant="outline"
            onClick={() => act({ type: 'show', stage: 'discover' })}
          >
            <MapPin size={16} />
            다른 장소
          </Button>
          <Button
            variant="outline"
            onClick={() => act({ type: 'show', stage: 'food', kind: '카페' })}
          >
            <Coffee size={16} />
            카페 찾기
          </Button>
          <Button
            variant="outline"
            onClick={() => act({ type: 'bookmark', id: place.id })}
          >
            <Bookmark size={16} />
            {state.savedIds.includes(place.id) ? '찜 해제' : '찜하기'}
          </Button>
        </div>
        {state.plan.length > 0 && (
          <button
            className="tr-text-link"
            onClick={() => act({ type: 'add-entity', id: place.id })}
          >
            DAY {state.activeDay}에 이 장소 추가
            <ArrowUpRight size={15} />
          </button>
        )}
      </div>
    </section>
  );
}
function FoodUnit({
  state,
  act,
  onDetail,
}: {
  state: TripState;
  act: Act;
  onDetail: OpenBusiness;
}) {
  const results = foodResults(state);
  const pickedId = state.foodKind === '카페' ? state.cafeId : state.foodId;
  const picked = results.find((r) => r.id === pickedId);
  if (picked)
    return (
      <section className="tr-unit tr-confirm">
        <UnitTitle icon={Check} label="선택한 곳" title={picked.name} />
        <button
          className="tr-chosen-detail"
          onClick={() => onDetail({ kind: 'food', id: picked.id }, state)}
        >
          <img
            src={businessDetails({ kind: 'food', id: picked.id })?.image}
            alt={businessDetails({ kind: 'food', id: picked.id })?.imageAlt ?? picked.name}
          />
          <span>
            {businessDetails({ kind: 'food', id: picked.id })?.headline}
            <strong>메뉴·분위기·방문 정보 보기</strong>
          </span>
        </button>
        <div className="tr-mini-route">
          <span>{findPlace(state.anchorId)?.name ?? getRegisteredEntity(state.anchorId ?? '')?.name ?? state.region}</span>
          <ArrowDown size={16} />
          <small>{picked.registered?'실제 도보 시간 미확인':`도보 ${picked.walk}분 · 예시`}</small>
          <strong>{picked.name}</strong>
        </div>
        <div className="tr-price-row">
          <span>{picked.menu}</span>
          <strong>{entityPriceLabel(picked)}</strong>
        </div>
        <Button
          className="tr-primary"
          onClick={() =>
            state.plan.length
              ? act({ type: 'add-selected' })
              : act(
                  state.collectedIds?.includes(picked.id)
                    ? { type: 'show', stage: 'collection' }
                    : { type: 'collect-entity', id: picked.id },
                )
          }
        >
          {state.plan.length
            ? `DAY ${state.activeDay}에 이 ${state.foodKind} 추가`
            : state.collectedIds?.includes(picked.id)
              ? '담은 곳 보기'
              : `이 ${state.foodKind} 여행에 담기`}
          <ArrowRight size={16} />
        </Button>
        {state.plan.length === 0 && (
          <button
            className="tr-text-link"
            onClick={() => act({ type: 'show', stage: 'discover' })}
          >
            다른 장소 더 찾기
            <ArrowRight size={16} />
          </button>
        )}
        <button
          className="tr-text-link"
          onClick={() =>
            act({ type: 'show', stage: 'food', kind: state.foodKind })
          }
        >
          다른 {state.foodKind} 후보 보기
          <ChevronRight size={14} />
        </button>
      </section>
    );
  return (
    <>
      <section className="tr-unit">
        <UnitTitle
          icon={state.foodKind === '카페' ? Coffee : state.foodKind === '상점' ? Store : Utensils}
          label={`주변 ${state.foodKind}`}
          title={state.anchorId ? `${findPlace(state.anchorId)?.name ?? getRegisteredEntity(state.anchorId)?.name ?? state.region} 근처` : `${state.region}에서 찾아보기`}
          count={`${results.length}곳`}
        />
        {state.anchorId && <div className="tr-linked">
          <MapPin size={14} />
          {findPlace(state.anchorId)?.name ?? getRegisteredEntity(state.anchorId)?.name} 주변을 보고 있어요
        </div>}
        <div className="tr-pills" aria-label="업체 종류">
          {(['식당','카페','상점'] as const).map(kind=><button key={kind} aria-pressed={state.foodKind===kind} onClick={()=>act({type:'show',stage:'food',kind})}>{kind}</button>)}
        </div>
        <BusinessSourceControls state={state} act={act}/>
        {state.businessMode!=='registered'&&<div className="tr-filter">
          <span>걸어서 갈 수 있는 범위</span>
          <div className="tr-pills">
            {[5, 10, 20].map((value) => (
              <button
                key={value}
                aria-pressed={state.walk === value}
                onClick={() => act({ type: 'walk', value })}
              >
                {value}분
              </button>
            ))}
          </div>
        </div>}
        {state.businessMode!=='registered'&&state.foodKind !== '카페' && (
          <div className="tr-pills" aria-label="음식 종류">
            {(['전체', '한식', '양식'] as const).map((value) => (
              <button
                key={value}
                aria-pressed={state.cuisine === value}
                onClick={() => act({ type: 'cuisine', value })}
              >
                {value}
              </button>
            ))}
          </div>
        )}
        {state.foodBudget && (
          <p className="tr-meta">{state.businessMode==='registered'?`요청 예산 ${money(state.foodBudget)} · 가격이 확인된 후보만 표시`:`1인 메뉴 ${money(state.foodBudget)} 이하`}</p>
        )}
        {!results.length && (
          <div className="tr-empty">
            <p>{state.businessMode==='registered'?'이 조건에서 확인된 등록 후보가 없어요.':'이 조건에 맞는 후보가 없어요.'}</p>
            <Button
              variant="outline"
              onClick={() =>
                state.businessMode==='registered'?act({type:'show',stage:'external'}):act({
                  type: 'message',
                  text: '도보 20분, 전체 음식, 10만원 이하로',
                })
              }
            >
              {state.businessMode==='registered'?'외부 지도에서 실제 업체 찾기':'조건을 넓혀 다시 찾기'}
            </Button>
          </div>
        )}
        {results.map((item) => (
          <BusinessPreview
            key={item.id}
            reference={{ kind: 'food', id: item.id }}
            onOpen={() => onDetail({ kind: 'food', id: item.id }, state)}
            selectLabel={
              !state.plan.length && !state.editingId
                ? state.collectedIds?.includes(item.id)
                  ? '담았어요'
                  : '담기'
                : '선택'
            }
            onSelect={() =>
              act(
                !state.plan.length && !state.editingId
                  ? state.collectedIds?.includes(item.id)
                    ? { type: 'show', stage: 'collection' }
                    : { type: 'collect-entity', id: item.id }
                  : { type: 'food', id: item.id },
              )
            }
          />
        ))}
        <CandidateProposal state={state} ids={results.map(item=>item.id)} act={act}/>
        <p className="tr-meta">{state.businessMode==='registered'?'확인일의 등록 정보입니다. 현재 가격·영업 여부는 업체에서 확인해 주세요.':'식당·메뉴·가격·도보 시간은 체험용 예시입니다.'}</p>
      </section>
    </>
  );
}
function StayUnit({
  state,
  act,
  onDetail,
}: {
  state: TripState;
  act: Act;
  onDetail: OpenBusiness;
}) {
  const results = stayResults(state);
  const picked = results.find((item) => item.id === state.stayId);
  if (picked)
    return (
      <section className="tr-unit tr-confirm">
        <UnitTitle icon={BedDouble} label="선택한 숙소" title={picked.name} />
        <button
          className="tr-chosen-detail"
          onClick={() => onDetail({ kind: 'stay', id: picked.id }, state)}
        >
          <img
            src={businessDetails({ kind: 'stay', id: picked.id })?.image}
            alt={businessDetails({ kind: 'stay', id: picked.id })?.imageAlt ?? picked.name}
          />
          <span>
            {businessDetails({ kind: 'stay', id: picked.id })?.headline}
            <strong>객실·시설·체크인 정보 보기</strong>
          </span>
        </button>
        <div className="tr-linked">
          <MapPin size={14} />
          {findPlace(state.anchorId)?.name ?? getRegisteredEntity(state.anchorId??'')?.name ?? state.region} 중심 · {period(state.days)}
        </div>
        <p className="tr-answer">{picked.tags.slice(0, 2).join(' · ')}</p>
        <div className="tr-price-row">
          <span>{picked.registered?'현재 객실 요금':'1객실 1박 예시'}</span>
          <strong>{entityPriceLabel(picked)}</strong>
        </div>
        <div className="tr-choice-chain">
          <span>
            <MapPin size={15} />
            {findPlace(state.anchorId)?.name ?? getRegisteredEntity(state.anchorId??'')?.name ?? state.region}
          </span>
          {state.foodId && (
            <span>
              <Utensils size={15} />
              {findFood(state.foodId)?.name}
            </span>
          )}
          {state.cafeId && (
            <span>
              <Coffee size={15} />
              {findFood(state.cafeId)?.name}
            </span>
          )}
          <span>
            <BedDouble size={15} />
            {picked.name}
          </span>
        </div>
        {state.plan.length > 0 ? <>
          <PlanEditControls state={state} act={act} disabled={false} stayOnly/>
        </> : <Button
          className="tr-primary"
          onClick={() =>
            act(
              state.collectedIds?.includes(picked.id)
                  ? { type: 'show', stage: 'collection' }
                  : { type: 'collect-entity', id: picked.id },
            )
          }
        >
          {state.collectedIds?.includes(picked.id)
              ? '담은 곳 보기'
              : '이 숙소 여행에 담기'}
          <ArrowRight size={16} />
        </Button>}
        <button
          className="tr-text-link"
          onClick={() => act({ type: 'show', stage: 'stay' })}
        >
          다른 숙소 비교하기
          <ChevronRight size={14} />
        </button>
        <p className="tr-meta">
          {picked.registered?'등록된 숙소입니다. 현재 객실·요금·빈방은 확인 전이며 실제 예약은 진행하지 않습니다.':'가상 숙소 · 실제 예약이 아닌 일정에 담을 후보입니다.'}
        </p>
      </section>
    );
  return (
    <section className="tr-unit">
      <UnitTitle
        icon={BedDouble}
        label="숙소 비교"
        title="하루의 끝은 여기서"
        count={`${results.length}곳`}
      />
      <div className="tr-linked">
        <MapPin size={14} />
        {findPlace(state.anchorId)?.name ?? state.region} 중심 · 1객실 1박
      </div>
      <BusinessSourceControls state={state} act={act}/>
      {state.businessMode!=='registered'&&<div className="tr-filter">
        <span>1박 예산</span>
        <div className="tr-pills">
          {[100000, 150000, 200000].map((value) => (
            <button
              key={value}
              aria-pressed={state.stayBudget === value}
              onClick={() => act({ type: 'stay-budget', value })}
            >
              {value / 10000}만원 이하
            </button>
          ))}
        </div>
      </div>}
      {!results.length && (
        <div className="tr-empty">
          <p>{state.businessMode==='registered'?'이 조건에서 확인된 등록 숙소가 없어요.':'이 예산의 체험 숙소가 없어요.'}</p>
          <Button
            variant="outline"
            onClick={() => state.businessMode==='registered'?act({type:'show',stage:'external'}):act({ type: 'stay-budget', value: 200000 })}
          >
            {state.businessMode==='registered'?'외부 지도에서 숙소 찾기':'20만원까지 보기'}
          </Button>
        </div>
      )}
      {results.map((item) => (
        <BusinessPreview
          key={item.id}
          reference={{ kind: 'stay', id: item.id }}
          onOpen={() => onDetail({ kind: 'stay', id: item.id }, state)}
          selectLabel={
            !state.plan.length && !state.editingId
              ? state.collectedIds?.includes(item.id)
                ? '담았어요'
                : '담기'
              : '선택'
          }
          onSelect={() =>
            act(
              !state.plan.length && !state.editingId
                ? state.collectedIds?.includes(item.id)
                  ? { type: 'show', stage: 'collection' }
                  : { type: 'collect-entity', id: item.id }
                : { type: 'stay', id: item.id },
            )
          }
        />
      ))}
      <CandidateProposal state={state} ids={results.map(item=>item.id)} act={act}/>
      {state.stayId && (
        <Button className="tr-primary" onClick={() => act({ type: 'build' })}>
          {period(state.days)} 일정으로 연결
          <ArrowRight size={16} />
        </Button>
      )}
      <button
        className="tr-text-link"
        onClick={() => act({ type: 'message', text: '숙소는 이미 예약했어' })}
      >
        <LockKeyhole size={14} />
        숙소는 이미 예약했어요
      </button>
      <p className="tr-meta">
        {state.businessMode==='registered'?'등록 숙소의 현재 객실·요금·빈방은 미확인입니다.':'객실 요금과 시설은 가상 예시입니다.'} 실제 예약을 진행하지 않습니다.
      </p>
    </section>
  );
}
function PlanUnit({
  state,
  session,
  act,
  route = false,
  archived,
  onDetail,
  controlsDisabled,
}: {
  state: TripState;
  session: TripSession;
  act: Act;
  route?: boolean;
  archived: boolean;
  onDetail: OpenBusiness;
  controlsDisabled: boolean;
}) {
  const [day, setViewDay] = useState(state.activeDay);
  const sourceTrip = findCommunityTrip(state.communitySourceId ?? '');
  const [menu, setMenu] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(true);
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
  const mapId = useId();
  const mapRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const pendingMapRow = useRef<string | null>(null);
  const rows = state.plan.filter((v) => v.day === day);
  const previousStay = state.plan.find(
    (v) => v.day === day - 1 && v.kind === 'stay',
  );
  function selectMapVisit(id: string) {
    const visit = state.plan.find((visit) => visit.id === id);
    if (!visit) return;
    if (visit.day !== day) {
      pendingMapRow.current = id;
      setViewDay(visit.day);
      setSelectedVisitId(id);
      return;
    }
    setSelectedVisitId(id);
    requestAnimationFrame(() =>
      rowRefs.current.get(id)?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : 'smooth',
        block: 'center',
      }),
    );
  }
  useEffect(() => {
    const id = pendingMapRow.current;
    if (!id) return;
    const row = rowRefs.current.get(id);
    if (!row) return;
    pendingMapRow.current = null;
    const frame = requestAnimationFrame(() =>
      row.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : 'smooth',
        block: 'center',
      }),
    );
    return () => cancelAnimationFrame(frame);
  }, [day, selectedVisitId]);
  function showVisitOnMap(id: string) {
    setSelectedVisitId(id);
    setMapOpen(true);
    requestAnimationFrame(() =>
      mapRef.current?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : 'smooth',
        block: 'start',
      }),
    );
  }
  if (!state.plan.length)
    return (
      <section className="tr-unit tr-empty">
        <Route size={26} />
        <h2>여행을 먼저 만들어볼까요?</h2>
        <Button
          disabled={controlsDisabled}
          onClick={() => act({ type: 'build' })}
        >
          선택한 곳으로 일정 만들기
        </Button>
      </section>
    );
  const changeLabel = (v: Visit) =>
    `DAY ${v.day} ${v.label} ${visitName(v)} 수정`;
  return (
    <section className="tr-unit tr-plan">
      <fieldset
        className="tr-plan-controls"
        disabled={controlsDisabled}
        aria-label="일정 날짜와 제목"
      >
        <UnitTitle
          icon={route ? Route : MapPin}
          label={route ? '방문 순서' : state.planStatus==='READY'?'내 여행 · 작성 완료':'내 여행 · 작성 중'}
          title={state.title || `${state.region} ${period(state.days)} 여행`}
          count={`${state.plan.filter((v) => Boolean(v.entityId) || v.locked).length}개 방문`}
        />
        {sourceTrip && (
          <p className="tr-community-source">
            <Users size={13} />
            <span>
              {sourceTrip.author.replace(' · 데모 프로필', '')}의 ‘
              {sourceTrip.title}’에서 가져온 내 일정 · 공개 코스 예시
            </span>
          </p>
        )}
      </fieldset>
      {!archived && <PlanEditControls state={{...state,activeDay:day}} act={act} disabled={controlsDisabled}/>}
      {state.startDate && <p className="tr-meta">출발 {state.startDate} · {period(state.days)}</p>}
      <div className="tr-day-map-heading">
        <h3>여행 전체 동선</h3>
        <button
          type="button"
          aria-label={mapOpen ? '지도 접기' : '전체 동선 지도'}
          aria-expanded={mapOpen}
          aria-controls={mapId}
          onClick={() => setMapOpen((open) => !open)}
        >
          <Route size={15} />
          {mapOpen ? '지도 접기' : '전체 동선 지도'}
        </button>
      </div>
      <div id={mapId} ref={mapRef} className="tr-map-anchor">
        {mapOpen && (
          <TripMap
            state={state}
            archived={archived}
            selectedVisitId={selectedVisitId}
            onSelectVisit={selectMapVisit}
            onViewDay={(nextDay) => {
              setViewDay(nextDay);
              setSelectedVisitId(null);
            }}
          />
        )}
      </div>
      <h3 className="tr-day-detail-title">DAY {day} {tripDayDate(state.startDate, day)} 상세 일정</h3>
      <div className="tr-days" role="group" aria-label="상세 일정 날짜">
        {Array.from({ length: state.days }, (_, i) => i + 1).map((nextDay) => (
          <button
            key={nextDay}
            type="button"
            aria-pressed={day === nextDay}
            onClick={() => {
              setViewDay(nextDay);
              setSelectedVisitId(null);
            }}
          >
            DAY {nextDay}
          </button>
        ))}
      </div>
      <fieldset
        className="tr-plan-controls"
        disabled={controlsDisabled}
        aria-label="일정 내용과 수정"
      >
        {previousStay && (
          <p className="tr-map-departure">
            <BedDouble size={15} />
            <span>
              <strong>1 · {visitName(previousStay)}에서 출발</strong>
              <small>{previousStay.entityId && Object.hasOwn(placeMapCoordinates, previousStay.entityId) ? '전날 숙소를 출발점으로 연결했어요.' : '숙소 위치 미확인 · 지도에서 제외했어요.'}</small>
            </span>
          </p>
        )}
        {!rows.length && (
          <div className="tr-empty">
            <p>이 날에 배치된 방문이 없어요.</p>
            <span>추가 장소를 정하기 전까지 비워두었어요.</span>
          </div>
        )}
        <ol className={'tr-timeline ' + (route ? 'is-route' : '')}>
          {rows.map((visit, i) => {
            const Icon = kindIcon[visit.kind];
            const p = visit.kind === 'place' ? findPlace(visit.entityId) : null;
            return (
              <li
                key={visit.id}
                ref={(node) => {
                  if (node) rowRefs.current.set(visit.id, node);
                  else rowRefs.current.delete(visit.id);
                }}
                className={
                  selectedVisitId === visit.id ? 'is-map-selected' : undefined
                }
                data-visit-id={visit.id}
              >
                <span className="tr-stop-number">
                  {String(i + 1 + (previousStay ? 1 : 0)).padStart(2, '0')}
                </span>
                <div className="tr-stop-body">
                  <div className="tr-stop-label">
                    <span>
                      <Icon size={13} />
                      {visit.label}
                    </span>
                    {visit.locked && (
                      <small>
                        <LockKeyhole size={12} />
                        예약 유지
                      </small>
                    )}
                  </div>
                  <div className="tr-stop-title">
                    {p && <img src={p.image} alt="" width={44} height={44} />}
                    <strong>{visitName(visit)}</strong>
                    {!route && !visit.locked && (
                      <button
                        aria-label={changeLabel(visit)}
                        onClick={() =>
                          setMenu(menu === visit.id ? null : visit.id)
                        }
                        aria-expanded={menu === visit.id}
                      >
                        <MoreHorizontal size={19} />
                      </button>
                    )}
                  </div>
                  {(visit.time || !!visit.durationMinutes) && <div className="tr-visit-metadata">{visit.time && <span>방문 {visit.time}</span>}{!!visit.durationMinutes && <span>체류 {visit.durationMinutes}분</span>}</div>}
                  {visit.note && <p className="tr-visit-note">{visit.note}</p>}
                  {visit.kind !== 'place' && (
                    <p className="tr-stop-note">
                      {visit.locked
                        ? '예약 정보는 별도로 확인해 주세요'
                        : visit.entityId && getRegisteredEntity(visit.entityId) ? 'Spotlog 등록 업체 · 현재 영업·가격 미확인' : `${findPlace(visit.anchorId)?.name ?? '선택 장소'} 주변 · ${visit.entityId ? '체험 후보' : '직접 선택 필요'}`}
                    </p>
                  )}
                  {visit.kind !== 'place' &&
                    visit.entityId &&
                    !visit.locked && (
                      <button
                        className="tr-stop-detail"
                        onClick={() =>
                          onDetail(
                            {
                              kind: visit.kind === 'stay' ? 'stay' : 'food',
                              id: visit.entityId!,
                              visitId: visit.id,
                            },
                            {
                              ...state,
                              anchorId: visit.anchorId,
                              activeDay: visit.day,
                            },
                          )
                        }
                      >
                        {visit.kind === 'stay'
                          ? '객실·시설 상세보기'
                          : '메뉴·방문 정보 상세보기'}
                      </button>
                    )}
                  {menu === visit.id && !route && (
                    <div className="tr-edit-actions">
                      <button
                        onClick={() => act({ type: 'edit', id: visit.id })}
                      >
                        다른 곳으로 교체
                      </button>
                      <button
                        disabled={
                          i === 0 ||
                          visit.kind === 'stay' ||
                          rows[i - 1]?.kind === 'stay'
                        }
                        onClick={() =>
                          act({ type: 'move', id: visit.id, direction: -1 })
                        }
                      >
                        <ArrowUp size={13} />
                        앞으로
                      </button>
                      <button
                        onClick={() => act({ type: 'remove', id: visit.id })}
                      >
                        <Trash2 size={13} />
                        일정에서 빼기
                      </button>
                    </div>
                  )}
                  {visit.entityId && Object.hasOwn(placeMapCoordinates, visit.entityId) && (
                    <a
                      className="tr-stop-map-link"
                      href={'#' + mapId}
                      onClick={(event) => {
                        event.preventDefault();
                        showVisitOnMap(visit.id);
                      }}
                    >
                      <MapPin size={14} />
                      동선 지도에서 보기
                    </a>
                  )}
                  {route && i < rows.length - 1 && (
                    <span className="tr-route-next">
                      <ArrowDown size={12} />
                      다음 방문
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        <p className="tr-meta">
          {route
            ? '지도에서 방문 순서와 확인된 차량 참고 경로를 볼 수 있어요. 실제 이동은 길찾기에서 확인해 주세요.'
            : '체험용 일정 · 영업시간·이동 가능성 확인 전'}
        </p>
        {!archived && (
          <fieldset disabled={controlsDisabled} className="tr-plan-controls"><TripReorderControls state={state} day={day} act={act} disabled={controlsDisabled}/><PlanLocalTools state={state} session={session} act={act}/></fieldset>
        )}
        {!archived && (
          <div className="tr-plan-actions">
            {route ? (
              <Button
                variant="outline"
                onClick={() => act({ type: 'show', stage: 'plan', day })}
              >
                일정 수정으로 돌아가기
              </Button>
            ) : (
              <>
                {state.plan.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      act({ type: 'show', stage: 'discover', day })
                    }
                  >
                    <MapPin size={16} />
                    장소 더 추가하기
                  </Button>
                )}
                <Button variant="outline" disabled={controlsDisabled} onClick={() => act({ type: 'show', stage: 'food', kind: '식당', day })}>
                  <Utensils size={16} />식당 추가하기
                </Button>
                <Button variant="outline" disabled={controlsDisabled} onClick={() => act({ type: 'show', stage: 'food', kind: '카페', day })}>
                  <Coffee size={16} />카페 추가하기
                </Button>
                <Button variant="outline" disabled={controlsDisabled} onClick={() => act({ type: 'show', stage: 'food', kind: '상점', day })}>
                  <Store size={16} />상점 추가하기
                </Button>
                {!state.booked &&
                  state.days > 1 &&
                  Array.from({ length: state.days - 1 }, (_, i) => i + 1).some(
                    (overnight) =>
                      !state.plan.some(
                        (v) => v.day === overnight && v.kind === 'stay' && (Boolean(v.entityId) || v.locked),
                      ),
                  ) && (
                    <Button
                      variant="outline"
                      onClick={() => act({ type: 'show', stage: 'stay', day })}
                    >
                      <BedDouble size={16} />
                      숙소 추가하기 · 선택
                    </Button>
                  )}
                <Button
                  className="tr-primary"
                  onClick={() => act({ type: 'save' })}
                >
                  <Bookmark size={16} />
                  {state.savedPlanId
                    ? '내 여행에 다시 저장'
                    : '이 기기의 내 여행에 저장'}
                </Button>
                <button
                  className="tr-text-link"
                  onClick={() => act({ type: 'show', stage: 'route', day })}
                >
                  <Route size={15} />
                  방문 순서로 보기
                  <ArrowRight size={15} />
                </button>
                <button
                  className="tr-text-link"
                  onClick={() => act({ type: 'show', stage: 'community' })}
                >
                  <Users size={15} />
                  다른 여행자 코스 둘러보기
                  <ArrowRight size={14} />
                </button>
              </>
            )}
            <TripShareControls state={state} day={day}/>
            <TripAppActions state={{...state,activeDay:day}}/>
          </div>
        )}
      </fieldset>
    </section>
  );
}
function DirectionsUnit({
  state,
  act,
  archived,
}: {
  state: TripState;
  act: Act;
  archived: boolean;
}) {
  const target = directionsTarget(state);
  return (
    <section className="tr-unit tr-directions">
      <UnitTitle
        icon={Route}
        label="지도 연결"
        title={
          target.business?.name ??
          (target.unavailable
            ? '방문 위치 확인 필요'
            : (target.place?.name ?? '먼저 장소를 골라주세요'))
        }
      />
      {target.unavailable ? (
        <>
          <p className="tr-feature-note">
            {target.visit?.locked
              ? '예약한 숙소의 실제 위치는 아직 입력하지 않았어요.'
              : '이 업체는 가상 체험 데이터라 실제 위치가 없어요.'}{' '}
            정확한 길찾기를 제공할 수 없어요.
          </p>
          {target.place && (
            <button
              className="tr-feature-secondary"
              onClick={() =>
                act({ type: 'directions', placeId: target.place!.id })
              }
            >
              <MapPin size={15} />
              기준 장소 {target.place.name} 길찾기
              <ChevronRight size={15} />
            </button>
          )}
        </>
      ) : target.links ? (
        <>
          <p className="tr-feature-note">
            목적지를 지도에 전달해요. 출발지와 교통수단을 고르면 실제 경로를
            확인할 수 있어요.
          </p>
          <div className="tr-map-links">
            <a
              aria-disabled={archived}
              tabIndex={archived ? -1 : 0}
              onClick={(e) => {
                if (archived) e.preventDefault();
              }}
              href={target.links.directions}
              target="_blank"
              rel="noopener noreferrer"
            >
              현재 위치에서 길찾기
              <ArrowUpRight size={16} />
            </a>
            <a
              aria-disabled={archived}
              tabIndex={archived ? -1 : 0}
              onClick={(e) => {
                if (archived) e.preventDefault();
              }}
              href={target.links.kakao}
              target="_blank"
              rel="noopener noreferrer"
            >
              카카오지도에서 확인
              <ArrowUpRight size={16} />
            </a>
            <a
              aria-disabled={archived}
              tabIndex={archived ? -1 : 0}
              onClick={(e) => {
                if (archived) e.preventDefault();
              }}
              href={target.links.naver}
              target="_blank"
              rel="noopener noreferrer"
            >
              네이버지도에서 확인
              <ArrowUpRight size={16} />
            </a>
          </div>
          <p className="tr-meta">
            외부 지도에서 열기 · 경로·교통·도착점은 지도에서 확인
          </p>
        </>
      ) : (
        <Button onClick={() => act({ type: 'show', stage: 'discover' })}>
          장소부터 찾기
        </Button>
      )}
    </section>
  );
}
function ExternalSearchUnit({
  state,
  act,
  archived,
}: {
  state: TripState;
  act: Act;
  archived: boolean;
}) {
  const place = findPlace(state.anchorId);
  return (
    <section className="tr-unit">
      <UnitTitle
        icon={MapPin}
        label="실제 주변 업체"
        title={
          place ? `${place.name} 주변 지도 검색` : '기준 장소부터 정해볼까요?'
        }
      />
      {place ? (
        <>
          <p className="tr-feature-note">
            실제 메뉴·위치·방문 정보는 지도에서 살펴보세요. 아래 링크는 체험
            후보와 별개의 외부 검색입니다.
          </p>
          <div className="tr-map-links">
            {(['식당', '카페', '숙소'] as const).map((kind) => (
              <a
                key={kind}
                href={nearbyMapSearch(place.id, kind)!}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={archived}
                tabIndex={archived ? -1 : 0}
                onClick={(e) => {
                  if (archived) e.preventDefault();
                }}
              >
                {kind} 지도에서 찾기
                <ArrowUpRight size={16} />
              </a>
            ))}
          </div>
          <p className="tr-meta">
            검색 결과·영업·예약 정보는 지도 서비스에서 제공해요.
          </p>
        </>
      ) : (
        <Button onClick={() => act({ type: 'show', stage: 'discover' })}>
          장소 찾기
        </Button>
      )}
    </section>
  );
}
function ProgressUnit({ state, act }: { state: TripState; act: Act }) {
  const next = nextPendingVisit(state);
  const checked = state.plan.filter((v) => v.status).length;
  const [expanded, setExpanded] = useState(
    !next || state.notice.includes('여러 DAY'),
  );
  return (
    <section className="tr-unit tr-progress">
      <UnitTitle
        icon={Check}
        label="여행 이어가기"
        title={
          next
            ? `DAY ${next.day} · 다음 방문`
            : state.plan.length
              ? '모든 방문을 확인했어요'
              : '아직 만든 일정이 없어요'
        }
        count={`${checked} / ${state.plan.length} 확인`}
      />
      {next && (
        <div className="tr-next-visit">
          <span>
            {next.label} ·{' '}
            {next.kind === 'place'
              ? '장소'
              : next.kind === 'stay'
                ? '숙박'
                : next.kind === 'cafe'
                  ? '카페'
                  : '식당'}
          </span>
          <h3>{visitName(next)}</h3>
          <div className="tr-progress-actions">
            <Button onClick={() => act({ type: 'directions', id: next.id })}>
              <Route size={15} />
              길찾기
            </Button>
            <Button
              onClick={() =>
                act({ type: 'progress', id: next.id, status: 'done' })
              }
            >
              <Check size={15} />
              다녀왔어요
            </Button>
          </div>
          <button
            className="tr-text-link"
            onClick={() =>
              act({ type: 'progress', id: next.id, status: 'skipped' })
            }
          >
            이번에는 건너뛰기
            <ArrowRight size={14} />
          </button>
        </div>
      )}
      {!state.plan.length && (
        <Button onClick={() => act({ type: 'build' })}>
          선택한 곳으로 일정 만들기
        </Button>
      )}
      {!!state.plan.length && (
        <>
          <button
            className="tr-feature-secondary"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            DAY별 방문 기록
            <ChevronDown size={16} />
          </button>
          {expanded && (
            <ul className="tr-visit-records">
              {state.plan.map((v) => (
                <li key={v.id}>
                  <div>
                    <small>
                      DAY {v.day} · {v.label}
                    </small>
                    <strong>{visitName(v)}</strong>
                    <span>
                      {v.status === 'done'
                        ? '방문 완료'
                        : v.status === 'skipped'
                          ? '건너뜀'
                          : '미방문'}
                    </span>
                  </div>
                  <div className="tr-record-actions">
                    {v.status ? (
                      <button
                        onClick={() =>
                          act({ type: 'progress', id: v.id, status: 'pending' })
                        }
                      >
                        미방문으로
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() =>
                            act({ type: 'progress', id: v.id, status: 'done' })
                          }
                        >
                          완료
                        </button>
                        <button
                          onClick={() =>
                            act({
                              type: 'progress',
                              id: v.id,
                              status: 'skipped',
                            })
                          }
                        >
                          건너뛰기
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="tr-meta">
            방문 상태는 이 기기에 기록돼요. 내 여행 저장본은 다시 저장할 때
            갱신됩니다.
          </p>
        </>
      )}
    </section>
  );
}
function CollectionUnit({
  state,
  act,
  onEntityDetail,
}: {
  state: TripState;
  act: Act;
  onEntityDetail: (id: string, state: TripState) => void;
}) {
  const items = (state.collectedIds ?? []).flatMap((id) => {
    const p = findPlace(id),
      f = findFood(id),
      h = findStay(id);
    const kind: Visit['kind'] = p
      ? 'place'
      : h
        ? 'stay'
        : f?.cuisine === '카페'
          ? 'cafe'
          : String(f?.cuisine) === '상점' ? 'shop' : 'food';
    const item = p ?? f ?? h;
    return item
      ? [
          {
            id,
            name: item.name,
            kind,
            context: p?.region ?? (f ? findPlace(f.placeId)?.name ?? f.region : h?.region),
          },
        ]
      : [];
  });
  const staysCollected = items.filter((item) => item.kind === 'stay').length;
  return (
    <section className="tr-unit tr-collection">
      <UnitTitle
        icon={MapPin}
        label="이번 여행에 담은 곳"
        title="가고 싶은 곳부터 모아보세요"
        count={`${items.length}곳`}
      />
      <p className="tr-collection-intro">
        장소·식당·카페·상점을 여러 곳 담을 수 있어요. 숙소는 필요할 때 찾아도 좋아요.
      </p>
      {items.length ? (
        <ol className="tr-collection-list" aria-label="이번 여행에 담은 목록">
          {items.map((item, index) => {
            const Icon = kindIcon[item.kind];
            return (
              <li key={item.id}>
                <button
                  className="tr-collection-item"
                  onClick={() => onEntityDetail(item.id, state)}
                  aria-label={`${item.name} 상세보기`}
                >
                  <span className="tr-collection-number">{index + 1}</span>
                  <span>
                    <strong>{item.name}</strong>
                    <small>
                      <Icon size={12} />
                      {item.kind === 'place'
                        ? '장소'
                        : item.kind === 'stay'
                          ? '숙소'
                          : item.kind === 'cafe'
                            ? '카페'
                            : item.kind === 'shop' ? '상점' : '식당'}{' '}
                      · {item.context}
                    </small>
                  </span>
                  <ChevronRight size={15} />
                </button>
                {item.kind === 'place' && (
                  <button
                    className="tr-collection-nearby"
                    aria-label={`${item.name} 주변 찾기`}
                    onClick={() => act({ type: 'select-entity', id: item.id })}
                  >
                    주변
                  </button>
                )}
                <button
                  className="tr-collection-remove"
                  aria-label={`${item.name} 담은 목록에서 빼기`}
                  onClick={() => act({ type: 'uncollect-entity', id: item.id })}
                >
                  <X size={17} />
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="tr-meta">
          아직 담은 곳이 없어요. 아래에서 장소부터 찾아보세요.
        </p>
      )}
      <div className="tr-collection-next">
        <Button onClick={() => act({ type: 'show', stage: 'discover' })}>
          <MapPin size={16} />
          다른 장소 더 찾기
        </Button>
        <Button
          variant="outline"
          disabled={!state.anchorId}
          onClick={() => act({ type: 'show', stage: 'food' })}
        >
          <Utensils size={16} />
          주변 식당 찾기
        </Button>
        <Button
          variant="outline"
          disabled={!state.anchorId}
          onClick={() => act({ type: 'show', stage: 'food', kind: '카페' })}
        >
          <Coffee size={16} />
          주변 카페 찾기
        </Button>
        {!state.booked && (
          <Button
            variant="outline"
            onClick={() => act({ type: 'show', stage: 'stay' })}
          >
            <BedDouble size={16} />
            숙소 찾기 · 선택
          </Button>
        )}
      </div>
      {state.anchorId && (
        <p className="tr-meta">
          주변 탐색 기준 · {findPlace(state.anchorId)?.name ?? getRegisteredEntity(state.anchorId)?.name}
        </p>
      )}
      <div className="tr-collection-build">
        <span>여행 기간</span>
        <div className="tr-pills" aria-label="담은 곳으로 만들 여행 기간">
          {[1, 2, 3, 4, 5, 6, 7].map((days) => (
            <button
              key={days}
              aria-pressed={state.days === days}
              onClick={() => act({ type: 'configure', days })}
            >
              {period(days)}
            </button>
          ))}
        </div>
        <Button
          className="tr-primary"
          disabled={!items.length}
          onClick={() => act({ type: 'build' })}
        >
          담은 {items.length}곳으로 일정 만들기
          <ArrowRight size={16} />
        </Button>
        {state.booked ? (
          <p className="tr-meta">
            <LockKeyhole size={12} /> 예약한 숙소는 유지해요.
          </p>
        ) : (
          <p className="tr-meta">
            {state.days === 1
              ? '당일 일정에는 숙박을 넣지 않아요.'
              : staysCollected
                ? '담은 숙소를 숙박 일정에 연결해요.'
                : '숙소를 담지 않아도 일정부터 만들 수 있어요.'}
          </p>
        )}
      </div>
    </section>
  );
}
function Units({
  state,
  act,
  archived,
  onDetail,
  session,
  busy,
  onFullDetail,
  onEntityDetail,
  onCommunityPreview,
  onOpenSavedDay,
  weatherReply = false,
}: {
  state: TripState;
  act: Act;
  archived: boolean;
  onDetail: OpenBusiness;
  onFullDetail: OpenBusiness;
  onEntityDetail: (id: string, state: TripState) => void;
  session: TripSession;
  busy: boolean;
  onCommunityPreview: (trip: CommunityTrip) => void;
  onOpenSavedDay: OpenSavedTripDay;
  weatherReply?: boolean;
}) {
  const showsPlan = state.stage === 'plan' || state.stage === 'route' ||
    (state.stage === 'answer' && weatherReply && state.plan.length > 0);
  if (showsPlan) {
    return (
      <fieldset
        className="tr-units"
        aria-label={archived ? '이전 결과' : '현재 조작할 수 있는 결과'}
      >
        <fieldset
          className="tr-plan-controls"
          disabled={archived || busy}
          aria-label="연결된 기능"
        >
          <ChatFeatureUnits
            state={state}
            session={session}
            act={act}
            onFullDetail={onFullDetail}
            onEntityDetail={onEntityDetail}
            onOpenSavedDay={onOpenSavedDay}
          />
          <CandidateReview state={state} act={act}/>
        </fieldset>
        <PlanUnit
          state={state}
          session={session}
          act={act}
          archived={archived}
          route={state.stage === 'route'}
          onDetail={onDetail}
          controlsDisabled={archived || busy}
        />
      </fieldset>
    );
  }
  return (
    <fieldset
      disabled={archived || busy}
      className="tr-units"
      aria-label={archived ? '이전 결과' : '현재 조작할 수 있는 결과'}
    >
      {state.plan.length > 0 && ['discover', 'place', 'food', 'stay'].includes(state.stage) && (
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => act({ type: 'show', stage: 'plan', day: state.activeDay })}
        >
          <Route size={15} />
          DAY {state.activeDay} 일정으로 돌아가기
        </Button>
      )}
      <ChatFeatureUnits
        state={state}
        session={session}
        act={act}
        onFullDetail={onFullDetail}
        onEntityDetail={onEntityDetail}
        onOpenSavedDay={onOpenSavedDay}
      />
      <SpotlogNavigationCard state={state}/>
      {state.stage === 'social' && state.socialTarget && <section className="tr-unit"><h2>평가와 스레드</h2><SocialPanel key={JSON.stringify(state.socialTarget)} target={state.socialTarget} initialView={state.socialView}/></section>}
      {['food','stay','collection'].includes(state.stage)&&<CandidateReview state={state} act={act}/>}
      {state.stage === 'media' && <DiscoveryMediaUnit state={state} act={act} onEntityDetail={onEntityDetail}/>}
      {state.stage === 'offline' && <OfflineTripUnit session={session} state={state} act={act}/>}
      {state.stage === 'library' && (
        <button
          className="tr-community-entry"
          onClick={() => act({ type: 'show', stage: 'community' })}
        >
          <Users size={21} />
          <span>
            <strong>다른 여행자 코스 둘러보기</strong>
            <small>마음에 드는 코스를 내 여행으로 가져오기</small>
          </span>
          <ChevronRight size={18} />
        </button>
      )}
      {state.stage === 'community' && (
        <CommunityUnit state={state} act={act} onPreview={onCommunityPreview} />
      )}
      {state.stage === 'collection' && (
        <CollectionUnit
          state={state}
          act={act}
          onEntityDetail={onEntityDetail}
        />
      )}
      {state.stage === 'collection' && (
        <button
          className="tr-text-link"
          onClick={() => act({ type: 'show', stage: 'community' })}
        >
          <Users size={15} />
          다른 여행자 코스 둘러보기
          <ArrowRight size={14} />
        </button>
      )}
      {state.stage === 'discover' && <PlaceList state={state} act={act} />}
      {state.stage === 'place' && <SelectedPlace state={state} act={act} />}
      {state.stage === 'food' && (
        <FoodUnit state={state} act={act} onDetail={onDetail} />
      )}
      {state.stage === 'stay' && (
        <StayUnit state={state} act={act} onDetail={onDetail} />
      )}
      {state.stage === 'saved' && <section className="tr-unit"><SavedPlaceReferences session={session} state={state} act={act} onEntityDetail={onEntityDetail} onOpenDay={onOpenSavedDay}/></section>}
      {state.stage === 'directions' && (
        <DirectionsUnit state={state} act={act} archived={archived} />
      )}
      {state.stage === 'external' && (
        <ExternalSearchUnit state={state} act={act} archived={archived} />
      )}
      {state.stage === 'progress' && <ProgressUnit state={state} act={act} />}
      {!state.plan.length &&
        state.stage !== 'collection' &&
        (state.collectedIds?.length ?? 0) > 0 && (
          <button
            className="tr-collection-summary"
            onClick={() => act({ type: 'show', stage: 'collection' })}
          >
            <span>
              <MapPin size={16} />
              <strong>
                이번 여행에 {state.collectedIds!.length}곳 담았어요
              </strong>
            </span>
            <span>
              목록 보기
              <ChevronRight size={14} />
            </span>
          </button>
        )}
    </fieldset>
  );
}

export default function TripWorkspace() {
  const [session, setSession] = useState<TripSession>(() =>
    createTripSession(),
  );
  const [input, setInput] = useState('');
  const [resetNotice, setResetNotice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState('');
  const [failedQuestion, setFailedQuestion] = useState('');
  const [chatError, setChatError] = useState('');
  const sessionRef = useRef(session);
  const chatSessionId = useRef('');
  const chatRequest = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const retryAction = useRef<{ action: TripAction; seed?: TripSession } | null>(
    null,
  );
  const [panel, updatePanel] = useState<
    | 'scenarios'
    | 'library'
    | 'about'
    | 'wiring'
    | 'history'
    | 'business'
    | 'community'
    | 'app'
    | null
  >(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const setPanel = (next: typeof panel) => {
    if (next) {
      updatePanel(next);
      setPanelOpen(true);
    } else setPanelOpen(false);
  };
  const [detail, setDetail] = useState<{
    reference: BusinessRef | { kind: 'place'; id: string };
    state: TripState;
  } | null>(null);
  const [communityPreview, setCommunityPreview] =
    useState<CommunityTrip | null>(null);
  const showCommunityPreview = (trip: CommunityTrip) => {
    setCommunityPreview(trip);
    setPanel('community');
  };
  const showDetailSheet: OpenBusiness = (reference, state) => {
    setDetail({ reference, state });
    setPanel('business');
  };
  const onDetail = showDetailSheet;
  const showEntityDetail = (id: string, state: TripState) => {
    if (findPlace(id)) {
      setDetail({ reference: { kind: 'place', id }, state });
      setPanel('business');
    } else showDetailSheet({ kind: findFood(id) ? 'food' : 'stay', id }, state);
  };
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const blockedStorage = useRef(false);
  const deviceRef = useRef<HTMLDivElement | null>(null);
  const scrollPane = useRef<HTMLElement | null>(null),
    latestRef = useRef<HTMLElement | null>(null),
    pendingRef = useRef<HTMLDivElement | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const anchorPinned = useRef(true);
  const s = currentTrip(session);
  const started = session.turns.length > 1;
  const latestTurnId = session.turns.filter((turn) => turn.state.question).at(-1)?.id;
  const hasPendingTurn = busy || Boolean(failedQuestion);
  const modalEntity = detail
    ? chatEntityDetail({ ...detail.state, detailId: detail.reference.id })
    : undefined;
  const modalPlace =
    detail?.reference.kind === 'place'
      ? findPlace(detail.reference.id)
      : undefined;
  const persistSession = (next: TripSession) => {
    if (blockedStorage.current) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: 1, session: next }),
      );
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  };
  const requestAction = async (action: TripAction, seed?: TripSession) => {
    if (busyRef.current) return;
    anchorPinned.current = true;
    const resetting =
      action.type === 'reset' ||
      (action.type === 'message' &&
        explicitConversationControl(action.text)?.type === 'reset');
    const current = seed ?? sessionRef.current;
    // Reset sends canonical favorites/library, so legacy history cannot block it.
    const previous = resetting
      ? { ...createTripSession(currentTrip(current).savedIds, current.library), ...(current.offlineTrips?{offlineTrips:current.offlineTrips}:{}), ...(current.recentPlanIds?{recentPlanIds:current.recentPlanIds}:{}) }
      : current;
    // Saved offline snapshots remain usable if the API, LLM or network is down.
    // Only explicit offline buttons enter this path; chat messages still use LLM.
    try {
      const offline = applyOfflineTripClientAction(previous, action);
      if (offline) {
        sessionRef.current = offline; persistSession(offline); setSession(offline);
        setChatError(''); setFailedQuestion(''); setResetNotice(false);
        retryAction.current = null;
        return;
      }
    } catch (error) {
      setChatError(error instanceof Error ? error.message : '이 기기의 오프라인 사본을 읽지 못했어요.');
      return;
    }
    let requestId: string;
    try {
      if (resetting) chatSessionId.current = createClientId();
      chatSessionId.current ||= createClientId();
      requestId = createClientId();
    } catch (error) {
      setChatError(error instanceof Error ? error.message : '안전한 요청 번호를 만들지 못했어요. 브라우저를 다시 열어 주세요.');
      setFailedQuestion(action.type === 'message' ? action.text : '');
      return;
    }
    const sessionId = chatSessionId.current;
    const baseRevision = previous.turns.at(-1)!.id;
    const controller = new AbortController();
    chatRequest.current = controller;
    busyRef.current = true;
    setBusy(true);
    setPendingQuestion(action.type === 'message' ? action.text : '');
    setFailedQuestion('');
    setChatError('');
    setResetNotice(false);
    retryAction.current = { action, seed };
    const timeout = setTimeout(() => controller.abort(), 240000);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          protocolVersion: 1,
          requestId,
          sessionId,
          baseRevision,
          session: previous,
          action,
        }),
        signal: controller.signal,
      });
      const result = (await response.json()) as Partial<ChatResponse> & {
        error?: { message?: string };
      };
      if (
        chatRequest.current !== controller ||
        chatSessionId.current !== sessionId
      )
        return;
      if (!response.ok)
        throw new Error(
          typeof result.error?.message === 'string'
            ? result.error.message
            : '답변을 받지 못했어요. 다시 시도해 주세요.',
        );
      if (
        result.protocolVersion !== 1 ||
        result.requestId !== requestId ||
        result.sessionId !== sessionId ||
        result.baseRevision !== baseRevision ||
        !isTripSession(result.session) ||
        result.revision !== result.session.turns.at(-1)?.id
      )
        throw new Error('답변 형식을 확인하지 못했어요. 다시 시도해 주세요.');
      sessionRef.current = result.session;
      persistSession(result.session);
      setSession(result.session);
      if (
        action.type === 'reset' ||
        (action.type === 'message' && result.session.turns.length === 1)
      ) {
        chatSessionId.current = '';
        retryAction.current = null;
        setResetNotice(true);
        setInput('');
        setDetail(null);
        setPanel(null);
      }
    } catch (error) {
      if (chatRequest.current !== controller) return;
      if (resetting) {
        // Reset stays available offline and for legacy libraries beyond API bounds.
        // Every saved trip survives; user storage is never truncated to fit.
        sessionRef.current = previous;
        persistSession(previous);
        setSession(previous);
        chatSessionId.current = '';
        retryAction.current = null;
        setResetNotice(true);
        setInput('');
        setDetail(null);
        setPanel(null);
        return;
      }
      setChatError(
        error instanceof TypeError
          ? '서버에 연결하지 못했어요. 서버가 실행 중인지 확인한 뒤 다시 시도해 주세요.'
          : error instanceof SyntaxError
            ? '서버 응답을 읽지 못했어요. 입력한 내용은 유지했으니 다시 시도해 주세요.'
            : error instanceof Error && error.name !== 'AbortError'
              ? error.message
              : '응답이 늦어지고 있어요. 입력한 내용은 유지했으니 다시 시도해 주세요.',
      );
      setFailedQuestion(action.type === 'message' ? action.text : '');
    } finally {
      clearTimeout(timeout);
      if (chatRequest.current === controller) {
        chatRequest.current = null;
        busyRef.current = false;
        setBusy(false);
        setPendingQuestion('');
      }
    }
  };
  const openSavedDay: OpenSavedTripDay = (planId, day, placeId) => {
    if (busyRef.current) return;
    try {
      const next = openSavedTripReferenceDay(sessionRef.current, planId, day, placeId);
      anchorPinned.current = true;
      sessionRef.current = next; persistSession(next); setSession(next);
      setChatError(''); setFailedQuestion(''); setResetNotice(false);
      retryAction.current = null;
    } catch (error) {
      setChatError(error instanceof Error ? error.message : '저장한 여행의 DAY를 열지 못했어요.');
    }
  };
  const act: Act = (action) => {
    void requestAction(action);
  };
  const say = (text: string) => {
    if (!text.trim() || text.length > 500 || busyRef.current) return;
    act({ type: 'message', text });
    setInput('');
  };
  const latest = (instant = false) => {
    const pane = scrollPane.current,
      turn = pendingRef.current ?? latestRef.current;
    if (!pane || !turn) return;
    // Pin the beginning of the user's message below navigation, independently
    // of the transcript's larger layout padding or the answer's height.
    const style = getComputedStyle(pane);
    const offset = parseFloat(style.getPropertyValue('--tr-chat-anchor-offset')) || 16;
    // Removing the error banner can enlarge the pane during a retry. Give the
    // new turn its full height before scrolling so the browser cannot clamp it
    // to the old, shorter content height and accidentally release the anchor.
    pane.style.setProperty(
      '--tr-chat-turn-height',
      `${Math.max(0, pane.clientHeight - offset - (parseFloat(style.paddingBottom) || 0))}px`,
    );
    anchorPinned.current = true;
    pane.scrollTo({
      top: Math.max(
        0,
        pane.scrollTop +
          turn.getBoundingClientRect().top -
          pane.getBoundingClientRect().top -
          pane.clientTop -
          offset,
      ),
      behavior:
        instant || window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
    });
  };
  useEffect(() => {
    return () => chatRequest.current?.abort();
  }, []);
  useLayoutEffect(() => {
    const pane = scrollPane.current;
    if (!pane) return;
    let frame = 0;
    const resize = () => {
      const style = getComputedStyle(pane);
      const offset = parseFloat(style.getPropertyValue('--tr-chat-anchor-offset')) || 16;
      const paddingBottom = parseFloat(style.paddingBottom) || 0;
      // A short reply still needs enough trailing space to put its question at
      // the top. Recalculate when the composer/keyboard changes the viewport.
      pane.style.setProperty(
        '--tr-chat-turn-height',
        `${Math.max(0, pane.clientHeight - offset - paddingBottom)}px`,
      );
      if (anchorPinned.current) {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => latest(true));
      }
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(pane);
    if (transcriptRef.current) observer.observe(transcriptRef.current);
    if (pendingRef.current) observer.observe(pendingRef.current);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [ready, started, hasPendingTurn]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const value = JSON.parse(raw);
        if (value?.version === 1 && isTripSession(value.session)) {
          sessionRef.current = value.session;
          setSession(value.session);
        } else {
          blockedStorage.current = true;
          setStorageError(true);
        }
      }
    } catch {
      blockedStorage.current = true;
      setStorageError(true);
    }
    setReady(true);
    document.documentElement.classList.add('moa-mobile-open');
    const viewport = window.visualViewport;
    const resize = () => {
      document.documentElement.style.setProperty(
        '--moa-viewport-height',
        `${viewport?.height ?? innerHeight}px`,
      );
      document.documentElement.style.setProperty(
        '--moa-viewport-top',
        `${viewport?.offsetTop ?? 0}px`,
      );
    };
    resize();
    viewport?.addEventListener('resize', resize);
    viewport?.addEventListener('scroll', resize);
    window.addEventListener('resize', resize);
    return () => {
      document.documentElement.classList.remove('moa-mobile-open');
      document.documentElement.style.removeProperty('--moa-viewport-height');
      document.documentElement.style.removeProperty('--moa-viewport-top');
      viewport?.removeEventListener('resize', resize);
      viewport?.removeEventListener('scroll', resize);
      window.removeEventListener('resize', resize);
    };
  }, []);
  useEffect(() => {
    if (ready && !blockedStorage.current) {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ version: 1, session: sessionRef.current }),
        );
        setStorageError(false);
      } catch {
        setStorageError(true);
      }
    }
  }, [ready, session]);
  useLayoutEffect(() => {
    if (!ready) return;
    if (!started && !hasPendingTurn) {
      scrollPane.current?.scrollTo({ top: 0, behavior: 'instant' });
      return;
    }
    // A new question pins before paint; reading older turns while waiting
    // releases the pin, so an arriving answer does not interrupt that reading.
    if (anchorPinned.current) latest(true);
  }, [ready, started, latestTurnId, busy, failedQuestion]);
  const startScenario = (id: string) => {
    const scenario = scenarios.find((x) => x.id === id);
    if (!scenario) return;
    chatRequest.current?.abort();
    chatRequest.current = null;
    busyRef.current = false;
    chatSessionId.current = '';
    const savedIds =
      id === 'saved'
        ? [...new Set([...s.savedIds, 'hyeopjae', 'osulloc'])]
        : s.savedIds;
    void requestAction(
      { type: 'message', text: scenario.prompt },
      { ...createTripSession(savedIds, session.library), ...(session.offlineTrips?{offlineTrips:session.offlineTrips}:{}), ...(session.recentPlanIds?{recentPlanIds:session.recentPlanIds}:{}) },
    );
    setInput('');
    setPanel(null);
  };
  const blank = () => {
    chatRequest.current?.abort();
    chatRequest.current = null;
    busyRef.current = false;
    chatSessionId.current = '';
    void requestAction({ type: 'reset' });
  };
  const scenarioCards = (
    <div className="tr-scenarios">
      {scenarios.map((sc) => (
        <button
          key={sc.id}
          className="tr-scenario"
          onClick={() => startScenario(sc.id)}
        >
          <img src={sc.image} alt="" width={72} height={80} />
          <span>
            <small>{sc.label}</small>
            <strong>{sc.title}</strong>
            <span>{sc.subtitle}</span>
          </span>
          <ChevronRight size={17} />
        </button>
      ))}
    </div>
  );
  return (
    <SpotlogSocialLayer library={session.library}><div className="demo-stage moa-mobile-stage">
      <div
        className="mobile-shell cx-shell moa-device tr-device"
        ref={deviceRef}
        data-spotlog-device
      >
        <header className="topbar tr-topbar">
          <TripHeaderNavigation
            ready={ready}
            busy={busy}
            onHome={blank}
            onHistory={() => act({ type: 'history' })}
            onLibrary={() => act({ type: 'library' })}
            onScenarios={() => setPanel('scenarios')}
          />
        </header>
        {resetNotice && (
          <p className="tr-reset-notice" role="status">
            대화를 초기화했어요. 찜한 장소와 저장한 여행은 유지돼요.
          </p>
        )}
        {storageError && (
          <p className="tr-storage-error" role="status">
            이 브라우저에 저장할 수 없어 현재 화면에서만 유지됩니다.
          </p>
        )}
        <main
          className="cx-page tr-chat"
          ref={scrollPane}
          onScroll={() => {
            const pane = scrollPane.current;
            const turn = pendingRef.current ?? latestRef.current;
            if (!pane || !turn) return;
            const offset = parseFloat(getComputedStyle(pane).getPropertyValue('--tr-chat-anchor-offset')) || 16;
            anchorPinned.current = Math.abs(turn.getBoundingClientRect().top - pane.getBoundingClientRect().top - pane.clientTop - offset) <= 4;
          }}
          aria-label="여행 대화와 기능 카드"
          tabIndex={0}
        >
          {!started ? (
            <div className="tr-welcome">
              <span className="tr-welcome-icon">
                <Sparkles size={23} />
              </span>
              <h1>어디로 떠나볼까요?</h1>
              <p>
                가고 싶은 곳을 담거나,
                <br />
                다른 여행자 코스에서 시작해 보세요.
              </p>
              <RecentTripEntry session={session} act={act} disabled={busy||!ready}/>
              <button
                className="tr-community-entry"
                disabled={busy || !ready}
                onClick={() => act({ type: 'show', stage: 'community' })}
              >
                <Users size={21} />
                <span>
                  <strong>다른 여행자 코스 둘러보기</strong>
                  <small>오전·오후 코스를 내 여행으로 가져오기</small>
                </span>
                <ChevronRight size={18} />
              </button>
              <div className="tr-local-start-grid">
                <button disabled={busy||!ready} onClick={()=>act({type:'media',mode:'photos',region:null,kind:'all'})}><Images size={18}/><span>사진으로 장소 발견</span></button>
                <button disabled={busy||!ready} onClick={()=>act({type:'saved-filter',region:null})}><Bookmark size={18}/><span>찜한 곳과 담긴 여행</span></button>
                <button disabled={busy||!ready} onClick={()=>act({type:'offline-library'})}><WifiOff size={18}/><span>오프라인 사본</span></button>
              </div>
              {scenarioCards}
              <p className="tr-demo-note">
                {REGIONS.join('·')} 등록 자료 · 생성 1~7일 · 예약 연결 전
              </p>
              <Button
                variant="outline"
                className="tr-primary"
                disabled={busy || !ready}
                onClick={() => act({ type: 'help' })}
              >
                <MessageCircle size={17} /> 대화로 할 수 있는 일 보기
              </Button>
            </div>
          ) : (
            <div ref={transcriptRef} className={'tr-transcript' + (hasPendingTurn ? ' is-awaiting' : '')}>
              {session.turns
                .filter((t) => t.state.question)
                .map((turn, i, turns) => {
                  const active = i === turns.length - 1,
                    snap = turn.state;
                  return (
                    <article
                      key={turn.id}
                      className={
                        'tr-turn ' + (active ? 'is-latest' : 'is-archived')
                      }
                      ref={active ? latestRef : undefined}
                      data-turn-id={turn.id}
                      aria-label={`${i + 1}번째 대화`}
                    >
                      <div className="cx-turn-user">
                        <span>나 · {String(i + 1).padStart(2, '0')}</span>
                        <p>{snap.question}</p>
                      </div>
                      <div className="cx-assistant-label">
                        <span className="cx-spark">
                          <Sparkles size={15} />
                        </span>
                        <strong>모아</strong>
                        <span>
                          {active ? (
                            <button
                              className="tr-unit-info"
                              disabled={busy}
                              aria-label="이번 답변에 연결된 기능"
                              onClick={() => setPanel('wiring')}
                            >
                              {stageNames[snap.stage]}
                            </button>
                          ) : (
                            '이전 답변'
                          )}
                        </span>
                      </div>
                      <p className={`tr-answer${turn.answerContext?.weather ? ' tr-answer-weather' : ''}`}>
                        {turn.assistantMessage ?? explanation(snap)}
                      </p>
                      {turn.answerContext?.retrievalStatus === 'unavailable' && <p className="tr-notice">장소 자료 검색에 연결하지 못해 검색 근거 없이 답변했어요.</p>}
                      {turn.answerContext?.modelRouting && turn.answerContext.modelRouting.reason !== 'primary' && (
                        <p className="tr-notice">
                          {turn.answerContext.modelRouting.tier === 'large'
                            ? `${turn.answerContext.modelRouting.provider === 'ollama' ? '큰 로컬 모델' : '외부 AI 모델'}이 ${turn.answerContext.modelRouting.reason === 'rag-insufficient' ? '부족한 자료를 일반 지식으로 보완' : '기본 모델의 응답을 보완'}했어요. 검색으로 확인한 사실과 구분해서 참고해 주세요.`
                            : turn.answerContext.modelRouting.status === 'not-configured'
                              ? '큰 모델이 연결되지 않아 기본 모델로 답변했어요.'
                              : '큰 모델에 연결하지 못해 기본 모델로 답변했어요.'}
                        </p>
                      )}
                      {turn.answerContext?.weather && (
                        <p className="tr-notice">
                          {turn.answerContext.weather.status === 'ready'
                            ? <><a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo 날씨</a> · {turn.answerContext.weather.location} · {new Date(turn.answerContext.weather.retrievedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} 조회 · 모델 기반 현재 상태·예보</>
                            : turn.answerContext.weather.status === 'unavailable' ? '현재 날씨 제공처에 연결하지 못했어요. 날씨 수치를 확인한 답변이 아니에요.' : '날씨를 확인할 지역·날짜를 먼저 확인해 주세요.'}
                        </p>
                      )}
                      {turn.retrieval && turn.retrieval.results.length > 0 && (
                        <details className="tr-notice">
                          <summary>검색한 자료 {turn.retrieval.results.length}개</summary>
                          {turn.retrieval.results.map((evidence) => (
                            <p key={evidence.evidenceId}>
                              <strong>{evidence.title ?? findPlace(evidence.placeId)?.name ?? evidence.placeId}</strong>
                              {turn.evidenceIds?.includes(evidence.evidenceId) ? ' · 설명에 사용' : ' · 검색 참고'}<br />
                              {evidence.text}
                              {knowledgeSource(evidence.documentId)?.sourceUrl && <><br /><a href={knowledgeSource(evidence.documentId)?.sourceUrl} target="_blank" rel="noopener noreferrer">현재 공식 안내 보기</a>{evidence.checkedAt && <> · 자료 확인일 {evidence.checkedAt}</>}</>}
                              {knowledgeSource(evidence.documentId)?.text !== evidence.text && <><br /><small>이전 답변 당시 저장된 자료입니다. 최신 안내를 다시 확인해 주세요.</small></>}
                            </p>
                          ))}
                          <small>공식 안내 요약과 체험 설명 · 운영·통제 정보는 방문 전 다시 확인</small>
                        </details>
                      )}
                      {snap.notice && (
                        <p className="tr-notice">{snap.notice}</p>
                      )}
                      <div className="tr-context">
                        <span>{turn.source === 'large-model' ? '큰 모델 응답' : turn.source === 'ollama' ? '로컬 AI 응답' : turn.source === 'flowise' ? 'AI 응답' : turn.source === 'local-action' ? (snap.stage==='offline'?'이 기기에서 처리':turn.answerContext?.weather ? '날씨 조회' : '일정 조회') : turn.source === 'clarify' ? '조건 확인' : '체험 기능'}</span>
                        {snap.stage === 'social' ? <span>{snap.socialTarget?.kind === 'entity' ? '장소·업체 의견' : '공개 코스 반응'}</span> : snap.stage === 'community' ? (
                          <>
                            <span>{snap.communityRegion ?? '전체 지역'}</span>
                            <span>공개 코스 예시</span>
                          </>
                        ) : (
                          <>
                            {snap.region && <span>{snap.region}</span>}
                            <span>{period(snap.days)}</span>
                          </>
                        )}
                        {snap.stage !== 'community' && snap.stage !== 'social' && snap.anchorId && (
                          <span>
                            <MapPin size={12} />
                            {findPlace(snap.anchorId)?.name}
                          </span>
                        )}
                        {snap.stage !== 'community' && snap.stage !== 'social' && snap.booked && (
                          <span>
                            <LockKeyhole size={12} />
                            예약 숙소 유지
                          </span>
                        )}
                      </div>
                      <Units
                        state={snap}
                        act={act}
                        archived={!active}
                        onDetail={onDetail}
                        onFullDetail={showDetailSheet}
                        onEntityDetail={showEntityDetail}
                        onCommunityPreview={showCommunityPreview}
                        onOpenSavedDay={openSavedDay}
                        session={session}
                        busy={busy}
                        weatherReply={Boolean(turn.answerContext?.weather)}
                      />
                      {!active && (
                        <div className="cx-past-actions">
                          <span>당시 조건과 결과</span>
                          <Button
                            variant="outline"
                            onClick={() => act({ type: 'resume', id: turn.id })}
                          >
                            이 결과에서 이어가기
                            <ArrowUpRight size={14} />
                          </Button>
                        </div>
                      )}
                    </article>
                  );
                })}
              <p className="tr-demo-note">
                등록 정보와 체험 예시를 구분해 표시합니다 · 현재 영업·가격·이동 시간은 확인이 필요해요
              </p>
            </div>
          )}
          {hasPendingTurn && (
            <div className="tr-pending-turn" ref={pendingRef}>
              {(pendingQuestion || failedQuestion) && (
                <div className="cx-turn-user">
                  <span>{failedQuestion && !busy ? '나 · 전송되지 않음' : '나'}</span>
                  <p>{pendingQuestion || failedQuestion}</p>
                </div>
              )}
              {busy && <p className="tr-chat-pending" role="status">
                <LoaderCircle size={16} /> 질문에 맞는 결과를 준비하고 있어요.
              </p>}
            </div>
          )}
          <div
            className="sr-only"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {started
              ? `${session.turns.length - 1}번째 답변. ${explanation(s)}`
              : '여행 질문을 입력하거나 시나리오를 선택하세요.'}
          </div>
        </main>
        {chatError && (
          <div className="tr-chat-error" role="alert">
            <p>{chatError}</p>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => {
                const retry = retryAction.current;
                if (retry) void requestAction(retry.action, retry.seed);
              }}
            >
              다시 시도
            </Button>
          </div>
        )}
        {started && (
          <button
            className="moa-latest"
            onClick={() => latest()}
            aria-label="최근 대화로 이동"
          >
            <ArrowDown size={14} />
            최근 대화
          </button>
        )}
        <footer className="composer-dock cx-conversation-dock">
          {started && (
            <div className="moa-quick-replies" aria-label="다음 질문">
              {nextQuestions(s).map((q) => (
                <button key={q} disabled={busy} onClick={() => say(q)}>
                  {q}
                  <ArrowUpRight size={14} />
                </button>
              ))}
            </div>
          )}
          <form
            className="composer"
            onSubmit={(e) => {
              e.preventDefault();
              say(input);
            }}
          >
            <input
              aria-label="여행 질문"
              placeholder="제주 1박 2일, 바다랑 맛집 가고 싶어"
              value={input}
              maxLength={500}
              enterKeyHint="send"
              autoComplete="off"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.nativeEvent.isComposing)
                  e.preventDefault();
              }}
            />
            <Button
              type="submit"
              aria-label="질문 보내기"
              disabled={!input.trim() || !ready || busy}
            >
              <ArrowUp size={22} />
            </Button>
          </form>
          <div className="dock-caption">
            <span>
              {busy
                ? '모아가 답변을 준비하고 있어요'
                : '원하는 일을 말하면 필요한 카드가 이어져요'}
            </span>
            <button
              disabled={busy || !ready}
              onClick={() => act({ type: 'help' })}
            >
              질문 예시
            </button>
            <button disabled={busy||!ready} onClick={()=>setPanel('app')}>앱 기능</button>
          </div>
        </footer>
      </div>
      <Dialog
        open={panelOpen}
        onOpenChange={setPanelOpen}
        onOpenChangeComplete={(open) => {
          if (!open) updatePanel(null);
        }}
      >
        <DialogContent
          presentation="bottom-sheet"
          portalContainer={deviceRef}
          className={
            'tr-sheet' +
            (panel === 'business' || panel === 'community'
              ? ' tr-detail-sheet'
              : '')
          }
          showCloseButton={false}
        >
          <div className="tr-sheet-handle" aria-hidden="true" />
          <DialogHeader>
            <div className="sheet-title-row">
              <DialogTitle>
                {panel === 'community' && communityPreview
                  ? communityPreview.title
                  : panel === 'business' && detail
                    ? modalEntity?.name
                    : panel === 'scenarios'
                      ? '어떤 여행을 해볼까요?'
                      : panel === 'library'
                        ? '찜한 장소와 내 여행'
                        : panel === 'app'
                          ? 'Spotlog 앱 기능 연결'
                        : panel === 'wiring'
                          ? '이번 답변에 연결된 기능'
                          : panel === 'history'
                            ? '이어온 대화'
                            : 'Spotlog 여행 체험'}
              </DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                aria-label="닫기"
                onClick={() => setPanel(null)}
              >
                <X />
              </Button>
            </div>
            <DialogDescription>
              {panel === 'community'
                ? '공개 코스 예시 · 내 여행으로 가져온 뒤 자유롭게 수정하세요.'
                : panel === 'business'
                  ? '상세정보를 확인해 보세요. 선택하면 대화가 이어져요.'
                  : panel === 'scenarios'
                    ? '새 대화로 시작합니다. 찜과 저장한 여행은 유지돼요.'
                    : panel === 'library'
                      ? '이 브라우저에 저장한 체험 데이터입니다.'
                      : panel === 'wiring'
                        ? '선택한 장소·DAY·조건을 다음 카드가 함께 사용해요.'
                        : panel === 'history'
                          ? '이전 결과의 조건으로 다시 이어갈 수 있어요.'
                          : 'Spotlog의 여행 기능을 대화 속에서 연결하는 체험판입니다.'}
            </DialogDescription>
          </DialogHeader>
          <div className="sheet-body">
            {panel === 'community' && communityPreview && (
              <CommunityTripBody trip={communityPreview} onPreview={showCommunityPreview}/>
            )}
            {panel === 'business' &&
              detail &&
              detail.reference.kind !== 'place' && (
                <BusinessDetailBody
                  reference={detail.reference}
                  state={detail.state}
                />
              )}
            {panel === 'business' &&
              detail?.reference.kind === 'place' &&
              modalEntity && (
                <div className="tr-business-detail">
                  {modalPlace?.registered && modalPlace.photos ? <RegisteredPhotoGallery name={modalPlace.name} photos={modalPlace.photos}/> : <figure className="tr-detail-photo">
                    <img
                      src={modalEntity.image}
                      alt={modalPlace?.imageKind === 'illustration' ? `${modalPlace.name} 안내용 공통 일러스트` : modalEntity.imageAlt}
                      width={600}
                      height={300}
                    />
                  </figure>}
                  {modalPlace && !modalPlace.registered && <EntityPhotoSourceButton entityId={modalPlace.id} image={modalEntity.image} name={modalPlace.name}/>}
                  <section className="tr-detail-intro">
                    <span className="tr-detail-category">장소 정보</span>
                    <h3>{modalEntity.headline}</h3>
                    <p>{modalEntity.description}</p>
                    <SocialSummary target={{kind:'entity',id:detail.reference.id}} />
                    <div className="tr-business-tags">
                      {modalEntity.features.map((feature) => (
                        <span key={feature}>{feature}</span>
                      ))}
                    </div>
                  </section>
                  <section className="tr-detail-section">
                    <h3>방문 정보</h3>
                    <dl className="tr-detail-facts">
                      <div>
                        <dt>지역</dt>
                        <dd>{modalPlace?.district ?? modalEntity.location}</dd>
                      </div>
                      {modalPlace?.registered && modalPlace.address && <div><dt>주소</dt><dd>{modalPlace.address}</dd></div>}
                      {modalPlace?.registered && <div><dt>등록 자료</dt><dd>{modalPlace.sourceProvider} · 확인 {modalPlace.sourceVerifiedAt}</dd></div>}
                      {Boolean(modalPlace?.durationMinutes) && (
                        <div>
                          <dt>체류 시간 예시</dt>
                          <dd>
                            약 {modalPlace?.durationMinutes}분 · 개인별 차이가
                            있어요
                          </dd>
                        </div>
                      )}
                      <div>
                        <dt>운영시간</dt>
                        <dd>{modalEntity.hours}</dd>
                      </div>
                      <div>
                        <dt>입장료</dt>
                        <dd>{modalEntity.price}</dd>
                      </div>
                    </dl>
                  </section>
                  <section className="tr-detail-check">
                    <h3>방문 전에 확인해 주세요</h3>
                    <p>{modalEntity.check}</p>
                    {modalPlace?.planningNote && <p>{modalPlace.planningNote}</p>}
                    {modalPlace?.imageKind === 'illustration' && <p>이미지는 공통 안내 일러스트입니다. 실제 장소 모습은 공식 안내를 확인해 주세요.</p>}
                    {modalPlace?.visitNote && <p>{modalPlace.visitNote}</p>}
                    {modalPlace?.sourceUrl && (
                      <a
                        className="tr-text-link"
                        href={modalPlace.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        공식 장소 정보 보기
                        <ArrowUpRight size={14} />
                      </a>
                    )}
                  </section>
                  <EntityShareControls id={modalEntity.id}/>
                </div>
              )}
            {panel === 'scenarios' && (
              <>
                <button
                  className="tr-community-entry"
                  disabled={busy || !ready}
                  onClick={() => {
                    act({ type: 'show', stage: 'community' });
                    setPanel(null);
                  }}
                >
                  <Users size={21} />
                  <span>
                    <strong>다른 여행자 코스 둘러보기</strong>
                    <small>제주 오전·오후 코스와 여행기 예시</small>
                  </span>
                  <ChevronRight size={18} />
                </button>
                {scenarioCards}
                <Button
                  variant="outline"
                  className="tr-primary"
                  onClick={blank}
                >
                  직접 질문하며 새로 시작
                </Button>
                <button
                  className="tr-text-link"
                  onClick={() => setPanel('about')}
                >
                  체험 안내·사진 출처
                </button>
              </>
            )}
            {panel === 'library' && (
              <>
                <h3 className="tr-sheet-heading">
                  찜한 장소 <span>{s.savedIds.length}</span>
                </h3>
                {s.savedIds.length ? (
                  <>
                    {s.savedIds.map((id) => {
                      const p = findPlace(id);
                      return (
                        p && (
                          <button
                            key={id}
                            className="tr-library-place"
                            onClick={() => {
                              act({ type: 'place', id });
                              setPanel(null);
                            }}
                          >
                            <img src={p.image} alt="" />
                            <span>
                              <strong>{p.name}</strong>
                              <small>{p.region}</small>
                            </span>
                            <ChevronRight size={16} />
                          </button>
                        )
                      );
                    })}
                    <Button
                      variant="outline"
                      className="tr-primary"
                      onClick={() => {
                        act({ type: 'show', stage: 'saved' });
                        setPanel(null);
                      }}
                    >
                      찜한 장소로 일정 만들기
                      <ArrowRight size={15} />
                    </Button>
                  </>
                ) : (
                  <p className="tr-empty-copy">
                    장소 카드의 북마크를 눌러 찜해보세요.
                  </p>
                )}
                <h3 className="tr-sheet-heading">
                  저장한 내 여행 <span>{session.library.filter(p=>!p.deletedAt).length}</span>
                </h3>
                <TripLibraryManager session={session} state={s} act={action=>{act(action);setPanel(null);}}/>
              </>
            )}
            {panel === 'wiring' && (
              <>
                <div className="tr-linked">
                  <MapPin size={15} />
                  {findPlace(s.anchorId)?.name ??
                    s.region ??
                    '지역 선택 전'} ·{' '}
                  {period(s.days)}
                </div>
                <ol className="tr-wiring">
                  {(s.stage === 'community'
                    ? [
                        '공개 여행기 ID·작성자·지역 → 공개 코스 목록',
                        'DAY별 방문 장소 ID·순서 → 코스 미리보기',
                        '공개 코스 원본 → 독립된 내 여행 복사본',
                        '현재는 제작 예시, 실제 연동 시 공개 범위·사용 가능 여부 확인',
                      ]
                    : s.stage === 'collection'
                      ? [
                          '여러 장소·식당·카페 선택 → 이번 여행의 담은 목록',
                          '기준 장소 변경 → 앞서 담은 곳은 그대로 유지',
                          '담은 목록·기간 → DAY별 일정, 숙소는 선택',
                        ]
                      : s.stage === 'food'
                        ? [
                            '선택한 장소 ID → 같은 장소의 식당·카페 검색',
                            `도보 ${s.walk}분·${s.cuisine}·예산 → 후보 필터`,
                            '선택한 업체 ID → 메뉴·도보 정보 → 일정의 식사 자리',
                          ]
                        : s.stage === 'stay'
                          ? [
                              '여행 지역·기준 장소 → 주변 숙소 후보',
                              `1박 ${money(s.stayBudget)} → 비교 결과`,
                              '선택 숙소 ID → 숙박 DAY에 연결',
                            ]
                          : [
                              '장소 검색·찜 목록 → 방문 장소 ID',
                              '지역·기간·식사·예약 조건 → DAY별 초안',
                              '방문 ID를 지정한 수정 → 해당 자리만 교체',
                              '같은 방문 목록 → 일정·방문 순서·내 여행 저장',
                            ]
                  ).map((text, i) => (
                    <li key={text}>
                      <span>0{i + 1}</span>
                      <p>{text}</p>
                    </li>
                  ))}
                </ol>
                <p className="tr-demo-note">
                  서버 연결 설정에 따라 체험 규칙 또는 AI가 질문을 해석하고,
                  검증된 결과를 기능 카드로 보여줍니다. 각 답변에서 사용한 경로를
                  표시합니다. 장소·업체 자료는 체험용이며 실제 예약은 연결되지 않았어요.
                </p>
              </>
            )}
            {panel === 'history' && (
              <div className="tr-history">
                {session.turns.filter((t) => t.state.question).length ? (
                  session.turns
                    .filter((t) => t.state.question)
                    .map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          act({ type: 'resume', id: t.id });
                          setPanel(null);
                        }}
                      >
                        <span>{stageNames[t.state.stage]}</span>
                        <strong>{t.state.question}</strong>
                        <small>이 결과에서 이어가기</small>
                      </button>
                    ))
                ) : (
                  <p>아직 대화가 없어요. 시나리오나 질문으로 시작해 보세요.</p>
                )}
              </div>
            )}
            {panel === 'about' && (
              <div className="tr-about">
                <span className="tr-demo-badge">
                  체험 데이터 · 응답별 연결 경로 표시
                </span>
                <h3>Spotlog에서 가져온 흐름</h3>
                <p>
                  장소 발견과 찜 → 저장한 장소로 여행 만들기 → DAY별 일정 → 주변
                  식당·카페·숙소 선택 → 부분 교체와 순서 조정 → 내 여행 저장.
                </p>
                <h3>두 가지 출발점</h3>
                <p>
                  장소부터 하나씩 선택할 수도 있고, “제주 1박 2일 일정 짜줘”처럼
                  완성 초안부터 받을 수도 있어요. 이미 예약한 숙소는 자동
                  교체하지 않아요.
                </p>
                <h3>이번 체험의 데이터</h3>
                <p>
                  “여기 길찾기 해줘”는 외부 지도 카드, “실제 식당 찾아줘”는 기준
                  장소의 지도 검색, “다녀왔어”와 “다음 어디 가?”는 방문 상태와
                  다음 일정 카드로 이어져요. 가상 업체에는 실제 길찾기를
                  제공하지 않습니다.
                </p>
                <p>
                  등록 장소와 업체는 확인된 주소·좌표·출처가 있는 자료를 사용합니다. 사진이 없으면 없다고 표시하며, 현재 메뉴·가격·영업시간·빈방·도보 시간은 추측하지 않습니다. 장소 탐색은
                  제주·서울·부산·경주·강릉의 등록 자료와 체험 자료를 구분해 보여줍니다. 일정 생성은 최대 7일, 작성 후 DAY 편집은 최대 30일까지 지원합니다.
                </p>
                <p>
                  체험 예시 모드의 식당·카페·숙소는 가상 업체입니다. 해당 모드의 메뉴·객실·시설·가격과 AI 이미지에는 예시 표시가 붙습니다. 등록 정보의 사진에는 출처와 이용 조건을 표시합니다.
                </p>
                <p>
                  대화·찜·내 여행은 이 브라우저에 저장됩니다. 실제 Spotlog
                  계정·실시간 검색·예약·결제와 연결되지 않았어요.
                </p>
                <details>
                  <summary>사진 출처</summary>
                  {credits.map((c) => (
                    <p className="tr-photo-credit" key={c.path}>
                      {c.title} · {c.author}
                      <br />
                      <a href={c.licenseUrl} target="_blank" rel="noreferrer">
                        {c.license}
                      </a>{' '}
                      ·{' '}
                      <a href={c.sourceUrl} target="_blank" rel="noreferrer">
                        원본 출처 보기
                      </a>
                      <br />
                      {c.changes}
                    </p>
                  ))}
                </details>
              </div>
            )}
            {panel === 'app' && <SpotlogAppFeaturePanel state={s}/>}
          </div>
          {panel === 'community' && communityPreview && (
            <div className="tr-detail-action">
              <span>
                <strong>{period(communityPreview.days)}</strong>
                <small>공개 코스 예시</small>
              </span>
              <Button
                disabled={busy}
                onClick={() => {
                  act({ type: 'copy-community', id: communityPreview.id });
                  setPanel(null);
                }}
              >
                <Bookmark size={15} />내 여행에 담기
              </Button>
            </div>
          )}
          {panel === 'business' &&
            detail &&
            detail.reference.kind !== 'place' && (
              <BusinessDetailAction
                reference={detail.reference}
                state={detail.state}
                onChoose={() => {
                  const ref = detail.reference;
                  if (ref.kind === 'place') return;
                  if (ref.visitId) act({ type: 'edit', id: ref.visitId });
                  else if (!detail.state.plan.length && !detail.state.editingId)
                    act(
                      detail.state.collectedIds?.includes(ref.id)
                        ? { type: 'show', stage: 'collection' }
                        : { type: 'collect-entity', id: ref.id },
                    );
                  else act({ type: 'select-entity', id: ref.id });
                  setPanel(null);
                }}
              />
            )}
          {panel === 'business' && detail?.reference.kind === 'place' && (
            <div className="tr-detail-action">
              <span>장소 정보</span>
              <Button
                disabled={busy}
                onClick={() => {
                  act(
                    detail.state.plan.length || detail.state.editingId
                      ? { type: 'select-entity', id: detail.reference.id }
                      : detail.state.collectedIds?.includes(detail.reference.id)
                        ? { type: 'show', stage: 'collection' }
                        : { type: 'collect-entity', id: detail.reference.id },
                  );
                  setPanel(null);
                }}
              >
                {detail.state.plan.length || detail.state.editingId
                  ? '이 장소 선택'
                  : detail.state.collectedIds?.includes(detail.reference.id)
                    ? '담은 곳 보기'
                    : '이 장소 여행에 담기'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div></SpotlogSocialLayer>
  );
}
