'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  ArrowUp,
  ArrowUpRight,
  ArrowLeft,
  ArrowDown,
  Check,
  ChevronRight,
  Coffee,
  Footprints,
  GitBranch,
  History,
  Info,
  Layers3,
  MapPin,
  Monitor,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Utensils,
  X,
  Link2,
  Gamepad2,
  Eye,
  Navigation,
  Signal,
  Wifi,
  BatteryFull,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  getPlace,
  getMonitor,
  getRestaurant,
  places,
  monitors,
  won,
  type Domain,
  type MonitorProduct,
} from '@/lib/connected-data';
import {
  workspace,
  type Action,
  type Binding,
  type SharedState,
  type Workspace,
} from '@/lib/connected-engine';
import credits from '@/lib/photo-credits.json';
import {
  createConversation,
  latestState,
  appendConversation,
  resumeConversation,
  undoConversation,
  type ConversationSession,
} from '@/lib/conversation-session';

type Context = {
  registerTool: (
    tool: {
      name: string;
      title: string;
      description: string;
      inputSchema: object;
      annotations: object;
      execute: (input: unknown) => unknown;
    },
    options?: { signal: AbortSignal },
  ) => unknown;
};
const unitIcons = {
  similarity: MapPin,
  mood: Layers3,
  nearby: Utensils,
  map: Navigation,
  route: Footprints,
  products: Monitor,
  comparison: GitBranch,
  price: SlidersHorizontal,
};

function Wiring({ view }: { view: Workspace }) {
  const s = view.state;
  return (
    <div className="cx-wiring">
      <span className="overline">CONNECTED UNITS</span>
      <h2>
        선택 하나가,
        <br />
        다음 기능의 입력으로.
      </h2>
      <p>
        {s.domain === 'places'
          ? '장소 선택 → 주변 검색 → 목록·지도 → 식당 상세'
          : '예산·우선순위 → 후보 검색 → 제품 선택 → 비교'}
      </p>
      <div className="cx-state">
        <span>지금 공유하는 기준</span>
        <strong>
          {s.domain === 'places'
            ? s.selectedPlaceId
              ? getPlace(s.selectedPlaceId).name
              : getPlace(s.anchorId).name
            : getMonitor(s.anchorId).name}
        </strong>
        <small>
          {s.domain === 'places'
            ? `도보 ${s.walkMinutes}분 · ${s.cuisine}`
            : `${won(s.maxPrice)} 이하 · ${s.gaming ? '게임 우선' : '기본 비교'}`}
        </small>
      </div>
      <div className="cx-wires">
        {view.units.map((u, i) => {
          const Icon = unitIcons[u.id];
          return (
            <div className="cx-wire" key={u.id}>
              <span className="cx-wire-number">
                {String(i + 1).padStart(2, '0')}
              </span>
              <Icon size={18} />
              <div>
                <strong>{u.title}</strong>
                <p>{u.input}</p>
                <small>→ {u.output}</small>
              </div>
            </div>
          );
        })}
      </div>
      <div className="cx-bound-note">
        <Link2 size={16} />
        <span>
          {s.domain === 'places' && s.nearby
            ? '목록과 지도는 같은 검색 결과를 사용합니다. 도보 범위를 바꾸면 둘 다 갱신됩니다.'
            : '대화와 버튼은 같은 상태를 바꿉니다. 선택한 대상과 조건은 다음 말에도 이어집니다.'}
        </span>
      </div>
      <p className="cx-muted">
        이번 체험은 규칙 기반 판단과 샘플 설명을 사용합니다. 실제 Jev·LLM 호출은
        없습니다.
      </p>
    </div>
  );
}

function NearbyMap({
  view,
  onAction,
  prefix,
}: {
  view: Workspace;
  onAction: (a: Action) => void;
  prefix: string;
}) {
  const s = view.state,
    ids = view.resources.restaurantIds;
  return (
    <>
      <div className="cx-map-head">
        <h3>{getPlace(s.selectedPlaceId!).name} 주변</h3>
        <span>
          {ids.length}곳 · 도보 {s.walkMinutes}분
        </span>
      </div>
      <div
        className="cx-distance-map"
        data-resource={view.resources.restaurantResultId}
        aria-label="도보 범위와 식당의 가상 상대 위치 지도"
      >
        <svg viewBox="0 0 360 300" aria-hidden="true">
          <defs>
            <pattern
              id={prefix + '-map-grid'}
              width="30"
              height="30"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 30 0 L 0 0 0 30"
                fill="none"
                stroke="#dce4dc"
                strokeWidth=".6"
              />
            </pattern>
          </defs>
          <rect
            width="360"
            height="300"
            fill={'url(#' + prefix + '-map-grid)'}
          />
          <circle
            cx="180"
            cy="150"
            r="114"
            fill="#e5ede32e"
            stroke="#bbcaba"
            strokeDasharray="3 5"
          />
          <circle
            cx="180"
            cy="150"
            r="76"
            fill="none"
            stroke="#cbd7c9"
            strokeDasharray="3 5"
          />
          <circle
            cx="180"
            cy="150"
            r="38"
            fill="none"
            stroke="#cbd7c9"
            strokeDasharray="3 5"
          />
          <circle
            cx="180"
            cy="150"
            r={30 + (s.walkMinutes / 20) * 90}
            fill="#c6d7c351"
            stroke="#8ea888"
            strokeWidth="1.5"
          />
          {ids.map((id) => {
            const r = getRestaurant(id),
              radius = 30 + (r.walk / 20) * 90,
              x = 180 + Math.cos((r.angle * Math.PI) / 180) * radius,
              y = 150 + Math.sin((r.angle * Math.PI) / 180) * radius;
            return s.selectedRestaurantId === id ? (
              <line
                key={id}
                x1="180"
                y1="150"
                x2={x}
                y2={y}
                stroke="#ff5a3d"
                strokeWidth="2.5"
                strokeDasharray="5 4"
              />
            ) : null;
          })}
        </svg>
        <span className="cx-map-ring-label">가상 상대 위치</span>
        <div className="cx-map-origin">
          <MapPin size={18} />
          <span>기준</span>
        </div>
        {ids.map((id, i) => {
          const r = getRestaurant(id),
            radius = 30 + (r.walk / 20) * 90,
            x =
              ((180 + Math.cos((r.angle * Math.PI) / 180) * radius) / 360) *
              100,
            y =
              ((150 + Math.sin((r.angle * Math.PI) / 180) * radius) / 300) *
              100;
          return (
            <button
              key={id}
              data-restaurant-pin={id}
              className={
                'cx-map-pin ' +
                (id === s.selectedRestaurantId ? 'selected' : '')
              }
              style={{ left: x + '%', top: y + '%' }}
              aria-label={`${r.name} 지도에서 선택`}
              aria-pressed={id === s.selectedRestaurantId}
              onClick={() => onAction({ type: 'select-restaurant', id })}
            >
              {i + 1}
              <span>{r.walk}분</span>
            </button>
          );
        })}
      </div>
      <p className="cx-footnote">
        식당·도보 시간·상대 위치는 가상 데이터입니다.
      </p>
    </>
  );
}

function CommittedRange({
  id,
  label,
  value,
  min,
  max,
  step,
  disabled,
  format,
  onCommit,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  format: (v: number) => string;
  onCommit: (v: number) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <>
      <div className="cx-range-label">
        <label id={id}>{label}</label>
        <strong>{format(draft)}</strong>
      </div>
      <Slider
        disabled={disabled}
        aria-labelledby={id}
        value={[draft]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => setDraft(Array.isArray(v) ? v[0] : v)}
        onValueCommitted={(v) => {
          const next = Array.isArray(v) ? v[0] : v;
          if (next !== value) onCommit(next);
        }}
      />
      <div className="cx-range-ends">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </>
  );
}
function ResponseUnits({
  view,
  archived,
  prefix,
  onAction,
  onPhoto,
}: {
  view: Workspace;
  archived: boolean;
  prefix: string;
  onAction: (a: Action) => void;
  onPhoto: (id: string) => void;
}) {
  const s = view.state,
    r = view.resources;
  const act = (action: Action) => {
    if (!archived) onAction(action);
  };
  const compareProducts = [
    getMonitor(s.anchorId),
    ...s.compareIds.map(getMonitor),
  ].filter(Boolean);
  const rows: {
    label: string;
    value: (m: MonitorProduct) => string;
    highlight?: boolean;
  }[] = [
    ...(s.gaming
      ? [
          {
            label: '주사율',
            value: (m: MonitorProduct) => m.hz + 'Hz',
            highlight: true,
          },
        ]
      : []),
    ...(s.eyeComfort
      ? [
          {
            label: '플리커프리',
            value: (m: MonitorProduct) => (m.flickerFree ? '지원' : '미지원'),
            highlight: true,
          },
          {
            label: '로우블루 모드',
            value: (m: MonitorProduct) => (m.lowBlue ? '지원' : '미지원'),
            highlight: true,
          },
          {
            label: '높이 조절',
            value: (m: MonitorProduct) => (m.ergonomic ? '가능' : '불가'),
            highlight: true,
          },
        ]
      : []),
    { label: '크기', value: (m) => m.size + '인치' },
    { label: '해상도', value: (m) => m.resolution },
    ...(!s.gaming
      ? [{ label: '주사율', value: (m: MonitorProduct) => m.hz + 'Hz' }]
      : []),
    { label: 'USB-C', value: (m) => (m.usbC ? '지원' : '미지원') },
    { label: '가격', value: (m) => won(m.price) },
  ];
  const renderUnit = (u: Binding) => {
    const Icon = unitIcons[u.id];
    return (
      <section
        className={'cx-unit cx-' + u.id + ' ' + u.variant}
        data-unit={u.id}
        data-resource={u.resourceId}
        key={u.id}
      >
        <div className="cx-unit-label">
          <span>
            <Icon size={15} />
            {u.title}
          </span>
          <small>
            {u.id === 'nearby' || u.id === 'map'
              ? '같은 검색 결과 연결'
              : u.id === 'comparison'
                ? '선택 제품 유지'
                : ''}
          </small>
        </div>
        {u.id === 'similarity' && (
          <>
            <div className="cx-unit-title">
              <h2>{s.nearby ? '다른 장소로 이어보기' : '분위기가 닮은 곳'}</h2>
              {!s.nearby && <span>{r.placeIds.length}곳</span>}
            </div>
            {!s.nearby && (
              <RadioGroup
                disabled={archived}
                className="cx-chip-radios"
                aria-label="장소 지역"
                value={s.placeRegion}
                onValueChange={(v) =>
                  act({
                    type: 'region',
                    value: v as SharedState['placeRegion'],
                  })
                }
              >
                {(['all', '제주', '서울'] as const).map((v) => (
                  <label key={v}>
                    <RadioGroupItem
                      value={v}
                      aria-label={v === 'all' ? '지역 전체' : v}
                    />
                    <span>{v === 'all' ? '지역 전체' : v}</span>
                  </label>
                ))}
              </RadioGroup>
            )}
            <div className={s.nearby ? 'cx-place-strip' : 'cx-place-cards'}>
              {r.placeIds.map((id, i) => {
                const p = getPlace(id);
                return (
                  <article
                    key={id}
                    className={
                      'cx-place-card ' +
                      (s.selectedPlaceId === id ? 'selected' : '')
                    }
                  >
                    <button
                      className="cx-place-select"
                      onClick={() => act({ type: 'select-place', id })}
                      aria-label={`${i + 1}번 ${p.name} 선택`}
                      aria-pressed={s.selectedPlaceId === id}
                    >
                      <img src={p.image} alt={p.name + ' 풍경'} />
                      <span className="cx-place-number">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="cx-place-card-copy">
                        <small>{p.region}</small>
                        <strong>{p.name}</strong>
                        {!s.nearby && <span>{p.description}</span>}
                      </span>
                      {s.selectedPlaceId === id && (
                        <span className="cx-selected-check">
                          <Check size={14} />
                        </span>
                      )}
                    </button>
                    {!s.nearby && (
                      <div className="cx-place-actions">
                        <button
                          onClick={() => act({ type: 'nearby-place', id })}
                        >
                          주변 맛집
                          <ArrowUpRight size={15} />
                        </button>
                        <button
                          aria-label={p.name + ' 사진 출처'}
                          onClick={() => onPhoto(id)}
                        >
                          <Info size={15} />
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
            {s.selectedPlaceId && !s.nearby && (
              <Button
                className="cx-primary"
                onClick={() =>
                  act({ type: 'nearby-place', id: s.selectedPlaceId! })
                }
              >
                {getPlace(s.selectedPlaceId).name} 주변 맛집 보기
                <ArrowUpRight />
              </Button>
            )}
            {!r.placeIds.length && (
              <p className="cx-empty">
                이 지역에는 다른 샘플 장소가 없어요. 지역 전체로 바꿔보세요.
              </p>
            )}
          </>
        )}
        {u.id === 'mood' && (
          <>
            <h2>비슷한 이유, 다른 매력.</h2>
            <div className="cx-mood-list">
              {(s.selectedPlaceId
                ? [s.selectedPlaceId]
                : r.placeIds.slice(0, 2)
              ).map((id) => {
                const p = getPlace(id),
                  a = getPlace(s.anchorId);
                return (
                  <div key={id}>
                    <strong>{p.name}</strong>
                    <div>
                      {['초록 풍경', '차분함', '산책'].map((label, i) => (
                        <span key={label}>
                          {label}
                          <span className="cx-mood-track">
                            <i style={{ width: p.mood[i] * 20 + '%' }} />
                            <b style={{ left: a.mood[i] * 20 + '%' }} />
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="cx-footnote">
              막대: 후보 · 세로선: 기준 장소 · 체험용 분위기 평가
            </p>
          </>
        )}
        {u.id === 'nearby' && (
          <>
            <div className="cx-unit-title">
              <h2>{getPlace(s.selectedPlaceId!).name} 근처에서</h2>
              <span>{r.restaurantIds.length}곳</span>
            </div>
            <div className="cx-linked-anchor">
              <Link2 size={14} />
              {getPlace(s.selectedPlaceId!).name}의 선택이 연결됐어요
            </div>
            <CommittedRange
              key={String(archived)}
              id={prefix + '-walk-label'}
              label="걸어서 갈 수 있는 범위"
              value={s.walkMinutes}
              min={1}
              max={20}
              step={1}
              disabled={archived}
              format={(v) => v + '분'}
              onCommit={(minutes) => act({ type: 'walk', minutes })}
            />
            <RadioGroup
              disabled={archived}
              className="cx-chip-radios"
              aria-label="음식 종류"
              value={s.cuisine}
              onValueChange={(v) =>
                act({ type: 'cuisine', value: v as SharedState['cuisine'] })
              }
            >
              {(['전체', '한식', '양식', '카페'] as const).map((v) => (
                <label key={v}>
                  <RadioGroupItem value={v} aria-label={v} />
                  <span>{v}</span>
                </label>
              ))}
            </RadioGroup>
            {(s.foodBudget || s.quiet) && (
              <div className="cx-active-filters">
                {s.foodBudget && (
                  <button
                    onClick={() => act({ type: 'food-budget', value: null })}
                  >
                    {won(s.foodBudget)} 이하
                    <X size={12} />
                  </button>
                )}
                {s.quiet && (
                  <button onClick={() => act({ type: 'quiet', value: false })}>
                    조용한 곳<X size={12} />
                  </button>
                )}
              </div>
            )}
            <div
              className="cx-restaurant-list"
              data-result-ids={r.restaurantIds.join(',')}
            >
              {r.restaurantIds.map((id, i) => {
                const food = getRestaurant(id),
                  selected = s.selectedRestaurantId === id;
                return (
                  <button
                    className={'cx-restaurant ' + (selected ? 'selected' : '')}
                    key={id}
                    onClick={() => act({ type: 'select-restaurant', id })}
                    aria-label={food.name + ' 선택'}
                    aria-pressed={selected}
                  >
                    <span className="cx-restaurant-symbol">
                      {food.cuisine === '카페' ? (
                        <Coffee size={22} />
                      ) : (
                        <Utensils size={22} />
                      )}
                      <small>{i + 1}</small>
                    </span>
                    <span className="cx-restaurant-copy">
                      <strong>{food.name}</strong>
                      <span>
                        {food.menu} · {won(food.price)}
                      </span>
                      <small>
                        {food.cuisine} ·{' '}
                        {food.quiet ? '차분한 분위기' : '활기찬 분위기'} · 가상
                        식당
                      </small>
                    </span>
                    <span className="cx-walk">
                      <Footprints size={14} />
                      {food.walk}분{selected && <Check size={14} />}
                    </span>
                  </button>
                );
              })}
            </div>
            {!r.restaurantIds.length && (
              <div className="cx-empty">
                <p>이 조건의 식당은 없어요.</p>
                <Button
                  variant="outline"
                  onClick={() => act({ type: 'clear-food-filters' })}
                >
                  식당 조건을 모두 풀기
                </Button>
              </div>
            )}
            <label className="cx-switch-row" htmlFor={prefix + '-map-toggle'}>
              <span>지도와 함께 보기</span>
              <Switch
                disabled={archived}
                id={prefix + '-map-toggle'}
                checked={s.showMap}
                onCheckedChange={(value) => act({ type: 'map', value })}
              />
            </label>
          </>
        )}
        {u.id === 'map' && (
          <NearbyMap view={view} onAction={act} prefix={prefix} />
        )}
        {u.id === 'route' &&
          s.selectedRestaurantId &&
          (() => {
            const food = getRestaurant(s.selectedRestaurantId);
            return (
              <>
                <h2>{food.name}으로 이어갈까요?</h2>
                <div className="cx-route-pair">
                  <span>
                    <MapPin size={15} />
                    {getPlace(s.selectedPlaceId!).name}
                  </span>
                  <div>
                    <i />
                    <b>도보 {food.walk}분</b>
                    <i />
                  </div>
                  <span>
                    <Utensils size={15} />
                    {food.name}
                  </span>
                </div>
                <div className="cx-menu-bill">
                  <div>
                    <small>선택 메뉴</small>
                    <strong>{food.menu}</strong>
                  </div>
                  <b>{won(food.price)}</b>
                </div>
                <p className="cx-footnote">
                  가상 동선과 메뉴예요. 실제 길찾기·주문은 실행되지 않습니다.
                </p>
              </>
            );
          })()}
        {u.id === 'products' && (
          <>
            <div className="cx-unit-title">
              <h2>비슷한 조건, 다른 선택.</h2>
              <span>{r.monitorIds.length}개</span>
            </div>
            <div className="cx-product-list">
              {r.monitorIds.map((id, i) => {
                const p = getMonitor(id),
                  checked = s.compareIds.includes(id);
                return (
                  <article
                    className={'cx-product ' + (checked ? 'selected' : '')}
                    key={id}
                  >
                    <div className="cx-product-top">
                      <span className="cx-product-icon">
                        <Monitor size={32} />
                        <small>{p.size}″</small>
                      </span>
                      <div>
                        <small>
                          {String(i + 1).padStart(2, '0')} · {p.series}
                        </small>
                        <h3>{p.name}</h3>
                        <p>
                          {p.size}인치 · {p.resolution} ·{' '}
                          <b className={s.gaming ? 'coral' : ''}>{p.hz}Hz</b>
                        </p>
                      </div>
                      <strong>{won(p.price)}</strong>
                    </div>
                    {s.eyeComfort && (
                      <div className="cx-feature-tags">
                        <span>
                          {p.flickerFree ? '플리커프리' : '플리커프리 미지원'}
                        </span>
                        <span>
                          {p.lowBlue ? '로우블루 모드' : '로우블루 미지원'}
                        </span>
                        <span>{p.ergonomic ? '높이 조절' : '고정 높이'}</span>
                      </div>
                    )}
                    <button
                      className="cx-compare-button"
                      aria-pressed={checked}
                      onClick={() => act({ type: 'compare', id })}
                    >
                      {checked ? <Check size={15} /> : <GitBranch size={15} />}{' '}
                      {checked ? '비교 중 · 해제' : '비교에 추가'}
                      <span>
                        {checked
                          ? '선택 유지'
                          : getMonitor(s.anchorId).name + ' 기준'}
                      </span>
                    </button>
                  </article>
                );
              })}
            </div>
            {!r.monitorIds.length && (
              <div className="cx-empty">
                <p>예산에 맞는 후보가 없어요.</p>
                <Button
                  variant="outline"
                  onClick={() => act({ type: 'price', value: 350000 })}
                >
                  35만원까지 넓히기
                </Button>
              </div>
            )}
          </>
        )}
        {u.id === 'price' && (
          <>
            <CommittedRange
              key={String(archived)}
              id={prefix + '-price-label'}
              label="최대 예산"
              value={s.maxPrice}
              min={100000}
              max={500000}
              step={10000}
              disabled={archived}
              format={won}
              onCommit={(value) => act({ type: 'price', value })}
            />
            <label
              className="cx-switch-row"
              htmlFor={prefix + '-gaming-toggle'}
            >
              <span>
                <Gamepad2 size={17} />
                게임 성능도 중요해요
              </span>
              <Switch
                disabled={archived}
                id={prefix + '-gaming-toggle'}
                checked={s.gaming}
                onCheckedChange={(value) =>
                  act({ type: 'priority', key: 'gaming', value })
                }
              />
            </label>
            <label className="cx-switch-row" htmlFor={prefix + '-eye-toggle'}>
              <span>
                <Eye size={17} />눈 편의 기능을 비교할래요
              </span>
              <Switch
                disabled={archived}
                id={prefix + '-eye-toggle'}
                checked={s.eyeComfort}
                onCheckedChange={(value) =>
                  act({ type: 'priority', key: 'eyeComfort', value })
                }
              />
            </label>
          </>
        )}
        {u.id === 'comparison' && (
          <>
            <div className="cx-unit-title">
              <h2>
                {s.gaming || s.eyeComfort
                  ? '중요한 항목부터 비교해요.'
                  : '기준 제품과 나란히.'}
              </h2>
            </div>
            <Table className="cx-compare-table">
              <TableHeader>
                <TableRow>
                  <TableHead>비교 항목</TableHead>
                  {compareProducts.map((p, i) => (
                    <TableHead key={p.id}>
                      <span>{i === 0 ? '기준' : '선택'}</span>
                      <strong>{p.name}</strong>
                      {i > 0 && (
                        <button
                          className="cx-remove-compare"
                          aria-label={p.name + ' 비교 해제'}
                          onClick={() => act({ type: 'compare', id: p.id })}
                        >
                          <X size={12} />
                          해제
                        </button>
                      )}
                      {i > 0 && p.price > s.maxPrice && (
                        <small>현재 예산 초과</small>
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.label}
                    className={row.highlight ? 'cx-highlight-row' : ''}
                  >
                    <TableCell>{row.label}</TableCell>
                    {compareProducts.map((p) => (
                      <TableCell key={p.id}>{row.value(p)}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {s.compareIds.length === 0 && (
              <p className="cx-footnote">
                후보의 ‘비교에 추가’를 눌러 나란히 볼 수 있어요.
              </p>
            )}
            {s.selectedMonitorId && (
              <Button
                variant="outline"
                className="cx-primary"
                onClick={() =>
                  act({ type: 'use-anchor', id: s.selectedMonitorId! })
                }
              >
                {getMonitor(s.selectedMonitorId).name}을 새 기준으로
                <ArrowUpRight />
              </Button>
            )}
            <p className="cx-footnote">
              모든 제품·스펙·가격은 가상 예시입니다.
              {s.eyeComfort
                ? ' 편의 기능 지원을 비교하며 건강 효과를 평가하지 않습니다.'
                : ''}
            </p>
          </>
        )}
      </section>
    );
  };
  return (
    <fieldset disabled={archived} className="cx-unit-stack cx-response-units">
      {view.units.map(renderUnit)}
    </fieldset>
  );
}

export default function ConnectedWorkspace() {
  const [domain, setDomain] = useState<Domain>('places');
  const [sessions, setSessions] = useState<Record<Domain, ConversationSession>>(
    {
      places: createConversation('places'),
      monitors: createConversation('monitors'),
    },
  );
  const [input, setInput] = useState('');
  const [panel, setPanel] = useState<
    'wiring' | 'about' | 'history' | 'reference' | 'photo' | null
  >(null);
  const [photoId, setPhotoId] = useState('osulloc');
  const current = sessions[domain],
    s = latestState(current),
    view = workspace(s);
  const live = useRef(view);
  live.current = view;
  const act = useCallback(
    (action: Action) => {
      setSessions((old) => ({
        ...old,
        [domain]: appendConversation(old[domain], action),
      }));
    },
    [domain],
  );
  const say = (text: string) => {
    if (!text.trim() || text.length > 500) return;
    act({ type: 'message', message: text });
    setInput('');
  };
  const changeDomain = (value: unknown) => {
    if (value === 'places' || value === 'monitors') {
      setDomain(value);
      setInput('');
    }
  };
  const reset = () => {
    setInput('');
    setSessions((old) => ({ ...old, [domain]: createConversation(domain) }));
    scrollPaneRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  };
  const back = () =>
    setSessions((old) => ({ ...old, [domain]: undoConversation(old[domain]) }));
  const resume = (id: number) =>
    setSessions((old) => ({
      ...old,
      [domain]: resumeConversation(old[domain], id),
    }));
  const latestRef = useRef<HTMLElement | null>(null);
  const scrollPaneRef = useRef<HTMLElement | null>(null);
  const seenTurn = useRef(domain + ':1');
  const lastTurn = current.turns[current.turns.length - 1];
  const scrollToLatest = () => {
    const pane = scrollPaneRef.current;
    const turn = latestRef.current;
    if (!pane || !turn) return;
    pane.scrollTo({
      top:
        pane.scrollTop +
        turn.getBoundingClientRect().top -
        pane.getBoundingClientRect().top -
        16,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
  };
  useEffect(() => {
    document.documentElement.classList.add('moa-mobile-open');
    const viewport = window.visualViewport;
    const resize = () => {
      document.documentElement.style.setProperty(
        '--moa-viewport-height',
        `${viewport?.height ?? window.innerHeight}px`,
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
    const key = domain + ':' + lastTurn.id;
    if (seenTurn.current === key) return;
    seenTurn.current = key;
    const frame = requestAnimationFrame(scrollToLatest);
    return () => cancelAnimationFrame(frame);
  }, [domain, lastTurn.id]);
  useEffect(() => {
    const context = (document as Document & { modelContext?: Context })
      .modelContext;
    if (!context?.registerTool) return;
    const abort = new AbortController();
    const register = (tool: Parameters<Context['registerTool']>[0]) => {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: abort.signal }),
        ).catch(() => {});
      } catch {}
    };
    register({
      name: 'read_connected_workspace',
      title: 'Read shared workspace',
      description:
        'Read shared entity references, filters, resource IDs and active unit bindings. All demo data.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: () => live.current,
    });
    register({
      name: 'send_connected_message',
      title: 'Send a context-aware demo message',
      description:
        'Uses the same reducer as visible controls. No real service calls.',
      inputSchema: {
        type: 'object',
        properties: {
          message: { type: 'string', minLength: 1, maxLength: 500 },
        },
        required: ['message'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: (v) => {
        const msg = (v as { message?: unknown }).message;
        if (typeof msg !== 'string' || !msg.trim() || msg.length > 500)
          throw new Error('Invalid message');
        flushSync(() => act({ type: 'message', message: msg }));
        return live.current;
      },
    });
    register({
      name: 'set_connected_filter',
      title: 'Set a shared demo filter',
      description:
        'Updates the same shared filter used by product results or by restaurant list and map.',
      inputSchema: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['walk', 'price'] },
          value: { type: 'number' },
        },
        required: ['kind', 'value'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: (v) => {
        const a = v as { kind?: unknown; value?: unknown };
        if (
          typeof a.value !== 'number' ||
          !Number.isFinite(a.value) ||
          !['walk', 'price'].includes(String(a.kind))
        )
          throw new Error('Invalid filter');
        flushSync(() =>
          act(
            a.kind === 'walk'
              ? { type: 'walk', minutes: a.value as number }
              : { type: 'price', value: a.value as number },
          ),
        );
        return live.current;
      },
    });
    return () => abort.abort();
  }, [act]);
  const suggestions =
    domain === 'places'
      ? s.nearby
        ? [
            '도보 5분 안에서만',
            '한식만 보여줘',
            '가격 상관없이 전체 음식 보여줘',
          ]
        : [
            '두 번째 장소 근처 맛집은?',
            '제주에서만 비슷한 곳 보여줘',
            '여기 근처 맛집 찾아줘',
          ]
      : [
          '게임도 하고 눈이 편했으면 좋겠어',
          '30만원 이하로 보여줘',
          '게임 성능은 상관없어',
        ];
  const refName =
    domain === 'places'
      ? getPlace(s.anchorId).name
      : getMonitor(s.anchorId).name;
  const credit = credits.find((x) =>
    x.path.endsWith(getPlace(photoId)?.image.split('/').at(-1) ?? 'none'),
  );
  return (
    <div className="demo-stage moa-mobile-stage">
      <div className="mobile-shell cx-shell moa-device">
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
          <a href="/" className="brand">
            moa<span>Spotlog 챗봇</span>
          </a>
          <div className="top-actions">
            <button className="mode-badge" onClick={() => setPanel('about')}>
              체험판
              <Info size={13} />
            </button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="현재 체험 처음부터"
              onClick={reset}
            >
              <RotateCcw size={18} />
            </Button>
          </div>
        </header>
        <Tabs value={domain} onValueChange={changeDomain} className="cx-tabs">
          <TabsList className="cx-tabs-list">
            <TabsTrigger value="places">
              <MapPin size={16} />
              장소 발견
            </TabsTrigger>
            <TabsTrigger value="monitors">
              <Monitor size={16} />
              모니터 비교
            </TabsTrigger>
          </TabsList>
          <TabsContent value={domain} className="moa-chat-panel">
            <main
              className="cx-page"
              ref={scrollPaneRef}
              aria-label="대화와 기능 카드"
              tabIndex={0}
            >
              <div className="cx-reference-label">
                <span>지금 보고 있는 기준</span>
                <button onClick={() => setPanel('reference')}>
                  바꾸기
                  <ChevronRight size={13} />
                </button>
              </div>
              <div className="cx-reference condensed">
                {domain === 'places' ? (
                  <img
                    src={getPlace(s.anchorId).image}
                    alt={refName + '의 기준 사진'}
                  />
                ) : (
                  <span className="cx-reference-monitor">
                    <Monitor size={42} />
                  </span>
                )}
                <div>
                  <span className="cx-reference-overline">
                    {domain === 'places'
                      ? getPlace(s.anchorId).region
                      : '가상 제품 · MOA DISPLAY'}
                  </span>
                  <h1>{refName}</h1>
                  <p>
                    {domain === 'places'
                      ? getPlace(s.anchorId).tags.join(' · ')
                      : `${getMonitor(s.anchorId).size}인치 · ${getMonitor(s.anchorId).resolution} · ${getMonitor(s.anchorId).hz}Hz`}
                  </p>
                </div>
                {domain === 'places' && (
                  <button
                    aria-label="기준 사진 출처"
                    className="cx-photo-info"
                    onClick={() => {
                      setPhotoId(s.anchorId);
                      setPanel('photo');
                    }}
                  >
                    <Info size={15} />
                  </button>
                )}
              </div>
              <div className="cx-conversation-toolbar">
                <div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="마지막 대화 취소"
                    disabled={current.turns.length === 1}
                    onClick={back}
                  >
                    <ArrowLeft />
                  </Button>
                  <Button variant="ghost" onClick={() => setPanel('history')}>
                    <History size={14} />
                    {current.turns.length}개의 대화
                  </Button>
                </div>
                <button onClick={() => setPanel('wiring')}>
                  <Layers3 size={14} />
                  연결 보기
                </button>
              </div>
              <div
                className="cx-transcript"
                aria-label={
                  domain === 'places' ? '장소 발견 대화' : '모니터 비교 대화'
                }
              >
                {current.turns.map((turn, index) => {
                  const snap = workspace(turn.state),
                    state = turn.state,
                    latest = index === current.turns.length - 1;
                  const anchor =
                    domain === 'places'
                      ? getPlace(state.anchorId).name
                      : getMonitor(state.anchorId).name;
                  return (
                    <article
                      className={
                        'cx-turn ' + (latest ? 'is-latest' : 'is-archived')
                      }
                      key={turn.id}
                      data-turn-id={turn.id}
                      data-turn-state={latest ? 'latest' : 'archived'}
                      ref={latest ? latestRef : undefined}
                      aria-label={`${index + 1}번째 대화`}
                    >
                      <div className="cx-turn-user">
                        <span>나 · {String(index + 1).padStart(2, '0')}</span>
                        <p>{state.question}</p>
                      </div>
                      <div className="cx-turn-answer">
                        <div className="cx-assistant-label">
                          <span className="cx-spark">
                            <Sparkles size={15} />
                          </span>
                          <strong>모아</strong>
                          <span>
                            {latest ? '지금 이어가는 대화' : '이전 답변'}
                          </span>
                        </div>
                        {turn.restoredFrom && (
                          <p className="cx-resumed">
                            <History size={13} />
                            {turn.restoredFrom}번째 결과에서 이어왔어요
                          </p>
                        )}
                        <p className="cx-answer-text">{snap.explanation}</p>
                        <div className="cx-turn-context">
                          <span>기준 · {anchor}</span>
                          {state.selectedPlaceId && (
                            <span>
                              <MapPin size={12} />
                              {getPlace(state.selectedPlaceId).name}
                            </span>
                          )}
                          {state.nearby && (
                            <span>도보 {state.walkMinutes}분</span>
                          )}
                          {domain === 'monitors' && (
                            <span>{won(state.maxPrice)} 이하</span>
                          )}
                        </div>
                        <ResponseUnits
                          view={snap}
                          archived={!latest}
                          prefix={domain + '-turn-' + turn.id}
                          onAction={act}
                          onPhoto={(id) => {
                            setPhotoId(id);
                            setPanel('photo');
                          }}
                        />
                        {!latest && (
                          <div className="cx-past-actions">
                            <span>당시의 조건과 결과</span>
                            <Button
                              variant="outline"
                              onClick={() => resume(turn.id)}
                            >
                              이 결과에서 이어가기
                              <ArrowUpRight size={14} />
                            </Button>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
              <div
                className="sr-only"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                {current.turns.length}번째 답변. {view.explanation}
              </div>
              <p className="sample-disclosure">
                {domain === 'places'
                  ? '실제 장소 사진 + 체험용 분위기·식당·거리 데이터'
                  : '가상 모니터 제품·스펙·가격 데이터'}
                <br />
                판단과 설명은 샘플 방식으로 동작합니다.
              </p>
            </main>
          </TabsContent>
        </Tabs>
        {current.turns.length > 1 && (
          <button
            className="moa-latest"
            aria-label="최근 대화로 이동"
            onClick={scrollToLatest}
          >
            <ArrowDown size={14} />
            최근 대화
          </button>
        )}
        <footer className="composer-dock cx-conversation-dock">
          <div className="moa-quick-replies" aria-label="이어서 물어보기">
            {suggestions.map((q) => (
              <button key={q} onClick={() => say(q)}>
                {q}
                <ArrowUpRight size={14} />
              </button>
            ))}
          </div>
          <form
            className="composer"
            onSubmit={(e) => {
              e.preventDefault();
              say(input);
            }}
          >
            <input
              aria-label="원하는 조건이나 다음 질문"
              placeholder={
                domain === 'places'
                  ? '어떤 곳을 찾고 있나요?'
                  : '원하는 모니터 조건을 말해보세요'
              }
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
              disabled={!input.trim()}
            >
              <ArrowUp size={22} />
            </Button>
          </form>
          <div className="dock-caption">
            <span>모아 · 질문에 맞춰 연결되는 기능</span>
            <button onClick={() => setPanel('about')}>체험 안내</button>
          </div>
        </footer>
        <div className="moa-home-indicator" aria-hidden="true">
          <span />
        </div>
      </div>
      <Dialog
        open={panel !== null}
        onOpenChange={(open) => {
          if (!open) setPanel(null);
        }}
      >
        <DialogContent
          className="bottom-sheet moa-mobile-sheet"
          showCloseButton={false}
        >
          <DialogHeader>
            <div className="sheet-title-row">
              <DialogTitle>
                {panel === 'wiring'
                  ? '기능이 연결되는 방식'
                  : panel === 'history'
                    ? '이어지는 대화와 선택'
                    : panel === 'reference'
                      ? '비교 기준 바꾸기'
                      : panel === 'photo'
                        ? '사진 출처'
                        : '이번 체험의 범위'}
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
              {panel === 'reference'
                ? '기준을 바꾸면 그 대상을 중심으로 다시 찾습니다.'
                : panel === 'wiring'
                  ? '하나의 선택을 여러 유닛이 함께 사용합니다.'
                  : panel === 'photo'
                    ? '원본 사진과 이용 조건을 확인하세요.'
                    : '현재 조건과 선택을 함께 유지하는 기능 조합 체험입니다.'}
            </DialogDescription>
          </DialogHeader>
          <div className="sheet-body">
            {panel === 'wiring' && <Wiring view={view} />}
            {panel === 'history' && (
              <ol className="history-list">
                {current.turns.map(({ state: h }, i) => (
                  <li key={i}>
                    <span>{i + 1}</span>
                    <div>
                      <p>{h.question}</p>
                      <small>{h.lastAction}</small>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {panel === 'reference' && (
              <div className="cx-reference-options">
                {(domain === 'places' ? places : monitors).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      act({ type: 'use-anchor', id: item.id });
                      setPanel(null);
                    }}
                  >
                    {'image' in item ? (
                      <img src={item.image} alt="" />
                    ) : (
                      <Monitor size={28} />
                    )}
                    <span>
                      <strong>{item.name}</strong>
                      <small>
                        {'region' in item
                          ? item.region
                          : `${item.size}인치 · ${item.resolution}`}
                      </small>
                    </span>
                    {s.anchorId === item.id ? (
                      <Check size={18} />
                    ) : (
                      <ChevronRight size={18} />
                    )}
                  </button>
                ))}
              </div>
            )}
            {panel === 'photo' && credit && (
              <div className="sheet-prose">
                <img
                  className="credit-photo"
                  src={getPlace(photoId).image}
                  alt={credit.title}
                />
                <strong>{credit.title}</strong>
                <p>{credit.author}</p>
                <a href={credit.sourceUrl} target="_blank" rel="noreferrer">
                  원본 · Wikimedia Commons
                </a>
                <a href={credit.licenseUrl} target="_blank" rel="noreferrer">
                  {credit.license}
                </a>
                <p>{credit.changes}</p>
              </div>
            )}
            {panel === 'about' && (
              <div className="sheet-prose">
                <span className="category food">
                  기능 연결 체험 · 실제 AI 호출 없음
                </span>
                <p>
                  질문을 보내거나 카드를 선택하면 새 답변과 기능 카드가 아래에
                  이어집니다. 이전 답변은 당시 조건 그대로 남고, ‘이 결과에서
                  이어가기’로 다시 사용할 수 있습니다.
                </p>
                <p>
                  현재 판단은 규칙, 설명은 검색 결과를 사용한 샘플 문장입니다.
                  장소 사진은 출처가 있는 실제 사진이며, 분위기
                  평가·식당·모니터·가격·도보 정보는 체험용입니다.
                </p>
                <h3>실제 서비스에 연결할 역할</h3>
                <p>
                  Jev가 필요한 유닛과 표현 방식을 판단하고, 검색 기능이 실제
                  자료를 가져오며, LLM이 그 결과를 근거로 설명하는 구조입니다.
                  이번에는 그 사이의 기능 연결을 체험할 수 있습니다.
                </p>
                <p>
                  ‘두 번째’는 현재 표시된 후보 순서, ‘거기’는 선택한 장소를
                  가리킵니다. 선택할 대상이 없으면 먼저 확인합니다.
                </p>
                <a href="/travel">
                  이전 여행 유닛 체험 보기
                  <ArrowUpRight size={14} />
                </a>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
