'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  BatteryFull,
  BedDouble,
  Bookmark,
  Check,
  ChevronDown,
  ChevronRight,
  Coffee,
  History,
  Info,
  Layers3,
  LockKeyhole,
  MapPin,
  MoreHorizontal,
  Route,
  Signal,
  Sparkles,
  Trash2,
  Utensils,
  Wifi,
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
  appendTrip,
  createTripSession,
  currentTrip,
  isTripSession,
  explanation,
  foodResults,
  nextQuestions,
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
  period,
  money,
} from '@/lib/trip-data';
import credits from '@/lib/photo-credits.json';
import { businessDetails, type BusinessRef } from '@/lib/business-details';
import {
  BusinessPreview,
  BusinessDetailBody,
  BusinessDetailAction,
  type OpenBusiness,
} from '@/components/business-detail';
import './trip-workspace.css';

const STORAGE_KEY = 'moa.spotlog.travel.v1';
const kindIcon = {
  place: MapPin,
  food: Utensils,
  cafe: Coffee,
  stay: BedDouble,
};
const stageNames = {
  discover: '장소 찾기',
  place: '장소 선택',
  food: '주변 탐색',
  stay: '숙소 비교',
  saved: '찜한 장소',
  plan: '내 여행',
  route: '방문 순서',
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
      {(['제주', '서울'] as const).map((region) => (
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
                alt={place.name + ' 풍경'}
                width={92}
                height={100}
              />
              <span>
                <small>
                  {String(index + 1).padStart(2, '0')} · {place.region}
                </small>
                <strong>{place.name}</strong>
                <span>{place.tags.slice(0, 2).join(' · ')}</span>
              </span>
              <ChevronRight size={16} />
            </button>
            <div className="tr-place-actions">
              <span>
                {state.similarTo ? '체험용 분위기 매칭' : place.description}
              </span>
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
        <div className="tr-context-actions">
          <Button onClick={() => act({ type: 'show', stage: 'food' })}>
            <Utensils size={16} />
            주변 식당
          </Button>
          <Button
            variant="outline"
            onClick={() => act({ type: 'show', stage: 'stay' })}
          >
            <BedDouble size={16} />
            근처 숙소
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
        <button className="tr-text-link" onClick={() => act({ type: 'build' })}>
          이 장소부터 일정 만들기
          <ArrowUpRight size={15} />
        </button>
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
            alt="AI 생성 업체 유형 예시"
          />
          <span>
            {businessDetails({ kind: 'food', id: picked.id })?.headline}
            <strong>메뉴·분위기·방문 정보 보기</strong>
          </span>
        </button>
        <div className="tr-mini-route">
          <span>{findPlace(state.anchorId)?.name}</span>
          <ArrowDown size={16} />
          <small>도보 {picked.walk}분 · 예시</small>
          <strong>{picked.name}</strong>
        </div>
        <div className="tr-price-row">
          <span>{picked.menu}</span>
          <strong>{money(picked.price)}</strong>
        </div>
        <Button
          className="tr-primary"
          onClick={() =>
            state.plan.length
              ? act({ type: 'add-selected' })
              : act({ type: 'show', stage: 'stay' })
          }
        >
          {state.plan.length
            ? `DAY ${state.activeDay}에 이 ${state.foodKind} 추가`
            : '이제 숙소 찾아보기'}
          <ArrowRight size={16} />
        </Button>
        {state.plan.length > 0 ? (
          <button
            className="tr-text-link"
            onClick={() => act({ type: 'show', stage: 'plan' })}
          >
            일정으로 돌아가기
            <ArrowRight size={16} />
          </button>
        ) : (
          <button
            className="tr-text-link"
            onClick={() => act({ type: 'build' })}
          >
            선택한 곳으로 일정 만들기
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
          icon={state.foodKind === '카페' ? Coffee : Utensils}
          label={`주변 ${state.foodKind}`}
          title={`${findPlace(state.anchorId)?.name ?? '선택 장소'} 근처`}
          count={`${results.length}곳`}
        />
        <div className="tr-linked">
          <MapPin size={14} />
          {findPlace(state.anchorId)?.name}의 선택이 연결됐어요
        </div>
        <div className="tr-filter">
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
        </div>
        {state.foodKind !== '카페' && (
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
          <p className="tr-meta">1인 메뉴 {money(state.foodBudget)} 이하</p>
        )}
        {!results.length && (
          <div className="tr-empty">
            <p>이 조건에 맞는 후보가 없어요.</p>
            <Button
              variant="outline"
              onClick={() =>
                act({
                  type: 'message',
                  text: '도보 20분, 전체 음식, 10만원 이하로',
                })
              }
            >
              조건을 넓혀 다시 찾기
            </Button>
          </div>
        )}
        {results.map((item) => (
          <BusinessPreview
            key={item.id}
            reference={{ kind: 'food', id: item.id }}
            onOpen={() => onDetail({ kind: 'food', id: item.id }, state)}
            onSelect={() => act({ type: 'food', id: item.id })}
          />
        ))}
        <p className="tr-meta">식당·메뉴·가격·도보 시간은 체험용 예시입니다.</p>
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
            alt="AI 생성 객실 유형 예시"
          />
          <span>
            {businessDetails({ kind: 'stay', id: picked.id })?.headline}
            <strong>객실·시설·체크인 정보 보기</strong>
          </span>
        </button>
        <div className="tr-linked">
          <MapPin size={14} />
          {findPlace(state.anchorId)?.name} 중심 · {period(state.days)}
        </div>
        <p className="tr-answer">{picked.tags.slice(0, 2).join(' · ')}</p>
        <div className="tr-price-row">
          <span>1객실 1박 예시</span>
          <strong>{money(picked.price)}</strong>
        </div>
        <div className="tr-choice-chain">
          <span>
            <MapPin size={15} />
            {findPlace(state.anchorId)?.name}
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
        <Button className="tr-primary" onClick={() => act({ type: 'build' })}>
          이 선택으로 {period(state.days)} 일정 만들기
          <ArrowRight size={16} />
        </Button>
        <button
          className="tr-text-link"
          onClick={() => act({ type: 'show', stage: 'stay' })}
        >
          다른 숙소 비교하기
          <ChevronRight size={14} />
        </button>
        <p className="tr-meta">
          가상 숙소 · 실제 예약이 아닌 일정에 담을 후보입니다.
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
      <div className="tr-filter">
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
      </div>
      {!results.length && (
        <div className="tr-empty">
          <p>이 예산의 체험 숙소가 없어요.</p>
          <Button
            variant="outline"
            onClick={() => act({ type: 'stay-budget', value: 200000 })}
          >
            20만원까지 보기
          </Button>
        </div>
      )}
      {results.map((item) => (
        <BusinessPreview
          key={item.id}
          reference={{ kind: 'stay', id: item.id }}
          onOpen={() => onDetail({ kind: 'stay', id: item.id }, state)}
          onSelect={() => act({ type: 'stay', id: item.id })}
        />
      ))}
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
        객실 요금과 시설은 가상 예시이며 실제 예약을 진행하지 않습니다.
      </p>
    </section>
  );
}
function PlanUnit({
  state,
  act,
  route = false,
  archived,
  onDetail,
}: {
  state: TripState;
  act: Act;
  route?: boolean;
  archived: boolean;
  onDetail: OpenBusiness;
}) {
  const day = state.activeDay;
  const [menu, setMenu] = useState<string | null>(null);
  const rows = state.plan.filter((v) => v.day === day);
  if (!state.plan.length)
    return (
      <section className="tr-unit tr-empty">
        <Route size={26} />
        <h2>여행을 먼저 만들어볼까요?</h2>
        <Button onClick={() => act({ type: 'build' })}>
          선택한 곳으로 일정 만들기
        </Button>
      </section>
    );
  const changeLabel = (v: Visit) =>
    `DAY ${v.day} ${v.label} ${visitName(v)} 수정`;
  return (
    <section className="tr-unit tr-plan">
      <UnitTitle
        icon={route ? Route : MapPin}
        label={route ? '방문 순서' : '내 여행 초안'}
        title={`${state.region} ${period(state.days)} 여행`}
        count={`${state.plan.filter((v) => v.kind === 'place').length}곳 방문`}
      />
      <div className="tr-days" role="group" aria-label="일정 날짜">
        {Array.from({ length: state.days }, (_, i) => (
          <button
            key={i}
            aria-pressed={day === i + 1}
            onClick={() => act({ type: 'day', day: i + 1 })}
          >
            DAY {i + 1}
          </button>
        ))}
      </div>
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
            <li key={visit.id}>
              <span className="tr-stop-number">
                {String(i + 1).padStart(2, '0')}
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
                {visit.kind !== 'place' && (
                  <p className="tr-stop-note">
                    {visit.locked
                      ? '예약 정보는 별도로 확인해 주세요'
                      : `${findPlace(visit.anchorId)?.name} 주변 · ${visit.entityId ? '체험 후보' : '직접 선택 필요'}`}
                  </p>
                )}
                {visit.kind !== 'place' && visit.entityId && !visit.locked && (
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
                    <button onClick={() => act({ type: 'edit', id: visit.id })}>
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
          ? '방문 순서 도식 · 실제 지도·길찾기·이동시간 조회 없음'
          : '체험용 일정 · 영업시간·이동 가능성 확인 전'}
      </p>
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
            </>
          )}
        </div>
      )}
    </section>
  );
}
function Units({
  state,
  act,
  archived,
  onDetail,
}: {
  state: TripState;
  act: Act;
  archived: boolean;
  onDetail: OpenBusiness;
}) {
  return (
    <fieldset
      disabled={archived}
      className="tr-units"
      aria-label={archived ? '이전 결과' : '현재 조작할 수 있는 결과'}
    >
      {state.stage === 'discover' && <PlaceList state={state} act={act} />}
      {state.stage === 'place' && <SelectedPlace state={state} act={act} />}
      {state.stage === 'food' && (
        <FoodUnit state={state} act={act} onDetail={onDetail} />
      )}
      {state.stage === 'stay' && (
        <StayUnit state={state} act={act} onDetail={onDetail} />
      )}
      {state.stage === 'saved' && <PlaceList state={state} act={act} saved />}
      {(state.stage === 'plan' || state.stage === 'route') && (
        <PlanUnit
          state={state}
          act={act}
          archived={archived}
          route={state.stage === 'route'}
          onDetail={onDetail}
        />
      )}
    </fieldset>
  );
}

export default function TripWorkspace() {
  const [session, setSession] = useState<TripSession>(() =>
    createTripSession(),
  );
  const [input, setInput] = useState('');
  const [panel, updatePanel] = useState<
    'scenarios' | 'library' | 'about' | 'wiring' | 'history' | 'business' | null
  >(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const setPanel = (next: typeof panel) => {
    if (next) {
      updatePanel(next);
      setPanelOpen(true);
    } else setPanelOpen(false);
  };
  const [detail, setDetail] = useState<{
    reference: BusinessRef;
    state: TripState;
  } | null>(null);
  const onDetail: OpenBusiness = (reference, state) => {
    setDetail({ reference, state });
    setPanel('business');
  };
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const blockedStorage = useRef(false);
  const deviceRef = useRef<HTMLDivElement | null>(null);
  const scrollPane = useRef<HTMLElement | null>(null),
    latestRef = useRef<HTMLElement | null>(null);
  const s = currentTrip(session);
  const started = session.turns.length > 1;
  const act: Act = (action) =>
    setSession((previous) => appendTrip(previous, action));
  const say = (text: string) => {
    if (!text.trim() || text.length > 500) return;
    if (/내 여행.{0,5}저장|일정.{0,5}저장/.test(text) && s.plan.length)
      act({ type: 'save' });
    else act({ type: 'message', text });
    setInput('');
  };
  const latest = (instant = false) => {
    const pane = scrollPane.current,
      turn = latestRef.current;
    if (!pane || !turn) return;
    pane.scrollTo({
      top: turn.offsetTop - 16,
      behavior:
        instant || window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
    });
  };
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const value = JSON.parse(raw);
        if (value?.version === 1 && isTripSession(value.session))
          setSession(value.session);
        else {
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
          JSON.stringify({ version: 1, session }),
        );
        setStorageError(false);
      } catch {
        setStorageError(true);
      }
    }
  }, [ready, session]);
  useEffect(() => {
    if (!started) {
      scrollPane.current?.scrollTo({ top: 0, behavior: 'instant' });
      return;
    }
    const frame = requestAnimationFrame(() => latest());
    return () => cancelAnimationFrame(frame);
  }, [session]);
  const startScenario = (id: string) => {
    const scenario = scenarios.find((x) => x.id === id);
    if (!scenario) return;
    const savedIds =
      id === 'saved'
        ? [...new Set([...s.savedIds, 'hyeopjae', 'osulloc'])]
        : s.savedIds;
    setSession(
      appendTrip(createTripSession(savedIds, session.library), {
        type: 'message',
        text: scenario.prompt,
      }),
    );
    setInput('');
    setPanel(null);
  };
  const blank = () => {
    setSession(createTripSession(s.savedIds, session.library));
    setInput('');
    setPanel(null);
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
    <div className="demo-stage moa-mobile-stage">
      <div
        className="mobile-shell cx-shell moa-device tr-device"
        ref={deviceRef}
      >
        <div className="moa-statusbar" aria-hidden="true">
          <span>9:41</span>
          <i />
          <div>
            <Signal size={15} />
            <Wifi size={15} />
            <BatteryFull size={21} />
          </div>
        </div>
        <header className="topbar">
          <button
            className="brand tr-brand"
            onClick={() => setPanel('scenarios')}
            aria-label="다른 여행 시나리오"
          >
            moa<span>Spotlog 챗봇</span>
            <ChevronDown size={13} />
          </button>
          <div className="top-actions">
            <Button
              variant="ghost"
              size="icon"
              aria-label="찜한 장소와 내 여행"
              onClick={() => setPanel('library')}
            >
              <Bookmark size={19} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="체험 안내"
              onClick={() => setPanel('about')}
            >
              <Info size={19} />
            </Button>
          </div>
        </header>
        <div className="tr-chat-toolbar">
          <button onClick={() => setPanel('scenarios')}>
            <Sparkles size={14} />
            {started ? '다른 시나리오' : '여행 시나리오'}
          </button>
          <div>
            <button aria-label="대화 이력" onClick={() => setPanel('history')}>
              <History size={15} />
            </button>
            {started && (
              <button onClick={() => setPanel('wiring')}>
                <Layers3 size={14} />
                {stageNames[s.stage]}
              </button>
            )}
          </div>
        </div>
        {storageError && (
          <p className="tr-storage-error" role="status">
            이 브라우저에 저장할 수 없어 현재 화면에서만 유지됩니다.
          </p>
        )}
        <main
          className="cx-page tr-chat"
          ref={scrollPane}
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
                장소부터 찾아도,
                <br />
                여행 일정부터 만들어도 좋아요.
              </p>
              {scenarioCards}
              <p className="tr-demo-note">
                제주·서울 체험 데이터 · 실제 AI·예약 연결 전
              </p>
            </div>
          ) : (
            <div className="tr-transcript">
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
                          {active ? stageNames[snap.stage] : '이전 답변'}
                        </span>
                      </div>
                      <p className="tr-answer">{explanation(snap)}</p>
                      {snap.notice && (
                        <p className="tr-notice">{snap.notice}</p>
                      )}
                      <div className="tr-context">
                        {snap.region && <span>{snap.region}</span>}
                        <span>{period(snap.days)}</span>
                        {snap.anchorId && (
                          <span>
                            <MapPin size={12} />
                            {findPlace(snap.anchorId)?.name}
                          </span>
                        )}
                        {snap.booked && (
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
                실제 장소 사진 · 식당·숙소·금액·도보 정보는 가상 예시
              </p>
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
                <button key={q} onClick={() => say(q)}>
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
              disabled={!input.trim() || !ready}
            >
              <ArrowUp size={22} />
            </Button>
          </form>
          <div className="dock-caption">
            <span>질문과 선택이 다음 기능으로 이어져요</span>
            <button onClick={() => setPanel('about')}>체험 안내</button>
          </div>
        </footer>
        <div className="moa-home-indicator" aria-hidden="true">
          <span />
        </div>
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
            'tr-sheet' + (panel === 'business' ? ' tr-detail-sheet' : '')
          }
          showCloseButton={false}
        >
          <div className="tr-sheet-handle" aria-hidden="true" />
          <DialogHeader>
            <div className="sheet-title-row">
              <DialogTitle>
                {panel === 'business' && detail
                  ? businessDetails(detail.reference)?.name
                  : panel === 'scenarios'
                    ? '어떤 여행을 해볼까요?'
                    : panel === 'library'
                      ? '찜한 장소와 내 여행'
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
              {panel === 'business'
                ? '가상 업체 상세정보 · 방문을 결정하는 흐름을 체험해 보세요.'
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
            {panel === 'business' && detail && (
              <BusinessDetailBody
                reference={detail.reference}
                state={detail.state}
              />
            )}
            {panel === 'scenarios' && (
              <>
                {scenarioCards}
                <Button
                  variant="outline"
                  className="tr-primary"
                  onClick={blank}
                >
                  직접 질문하며 새로 시작
                </Button>
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
                  저장한 내 여행 <span>{session.library.length}</span>
                </h3>
                {session.library.length ? (
                  session.library.map((plan) => (
                    <button
                      className="tr-library-plan"
                      key={plan.id}
                      onClick={() => {
                        act({ type: 'open', id: plan.id });
                        setPanel(null);
                      }}
                    >
                      <MapPin size={20} />
                      <span>
                        <strong>{plan.title}</strong>
                        <small>
                          {plan.visits.length}개 방문·식사·숙박 · 이 기기에 저장
                        </small>
                      </span>
                      <ChevronRight size={16} />
                    </button>
                  ))
                ) : (
                  <p className="tr-empty-copy">
                    일정을 만든 뒤 ‘내 여행에 저장’을 눌러보세요.
                  </p>
                )}
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
                  {(s.stage === 'food'
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
                  지금은 규칙과 샘플 문장으로 동작합니다. 실제 연결 단계에서는
                  Jev가 유닛을 고르고 검색 결과를 LLM이 설명합니다.
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
                  체험판 · 실제 AI 호출 없음
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
                  장소 사진은 출처가 있는 실제 사진입니다.
                  식당·숙소·메뉴·가격·도보 시간은 가상 예시예요. 장소 탐색은
                  제주·서울, 일정은 최대 3일까지 지원합니다.
                </p>
                <p>
                  식당·카페·숙소 상세 화면에는 분위기, 메뉴·객실, 시설, 운영시간
                  예시와 여행에 맞는 이유가 담겨 있어요. 업체 사진은 AI로 만든
                  유형별 예시이며 실제 업체 사진이 아닙니다.
                </p>
                <p>
                  대화·찜·내 여행은 이 브라우저에 저장됩니다. 실제 Spotlog
                  계정·서버·실시간 검색·예약·결제와 연결되지 않았어요.
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
          </div>
          {panel === 'business' && detail && (
            <BusinessDetailAction
              reference={detail.reference}
              state={detail.state}
              onChoose={() => {
                const ref = detail.reference;
                if (ref.visitId) act({ type: 'edit', id: ref.visitId });
                else if (
                  ref.kind === 'stay'
                    ? detail.state.stayId !== ref.id
                    : detail.state.foodId !== ref.id &&
                      detail.state.cafeId !== ref.id
                )
                  act({ type: ref.kind, id: ref.id });
                setPanel(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
