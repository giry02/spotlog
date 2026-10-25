'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Car,
  ExternalLink,
  LocateFixed,
  Map as MapIcon,
  MapPin,
  RotateCcw,
} from 'lucide-react';
import type { TripState } from '@/lib/trip-engine';
import { getTripMapData } from '@/lib/trip-map-data';
import {
  fetchTripMapRoutes,
  makeTripMapOrderRoutes,
  type TripMapRouteDay,
} from '@/lib/trip-map-route';
import { mapLinks } from '@/lib/travel-links';
import type { LayerGroup, Map as LeafletMap, Marker } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './trip-map.css';

type Leaflet = typeof import('leaflet');
type MapPoint = ReturnType<typeof getTripMapData>['points'][number];
type Runtime = {
  leaflet: Leaflet;
  map: LeafletMap;
  layers: LayerGroup;
  markers: Map<string, Marker>;
};
const routeColor = '#ff4f35';

function fitRoute(
  runtime: Runtime,
  points: MapPoint[],
  routes: readonly TripMapRouteDay[],
) {
  const positions: [number, number][] = [
    ...points.map((p) => [p.latitude, p.longitude] as [number, number]),
    ...routes.flatMap((route) =>
      route.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
    ),
  ];
  if (!positions.length) return;
  runtime.map.invalidateSize({ pan: false });
  if (positions.length === 1)
    runtime.map.setView(positions[0], 13, { animate: false });
  else
    runtime.map.fitBounds(runtime.leaflet.latLngBounds(positions), {
      padding: [42, 38],
      maxZoom: 15,
      animate: false,
    });
}

// Spotlog's 12-second direction guide; never GPS or the user's current location.
function traveler(
  runtime: Runtime,
  route: TripMapRouteDay,
  reducedMotion: boolean,
) {
  const coordinates = route.coordinates;
  if (coordinates.length < 2) return () => {};
  const lengths = coordinates.slice(1).map(([lng, lat], i) => {
    const [fromLng, fromLat] = coordinates[i];
    return Math.hypot(
      (lng - fromLng) * Math.cos((((lat + fromLat) / 2) * Math.PI) / 180),
      lat - fromLat,
    );
  });
  const total = lengths.reduce((sum, value) => sum + value, 0);
  if (!total) return () => {};
  const icon = runtime.leaflet.divIcon({
    className: 'trip-route-traveler',
    html: '<span>➜</span>',
    iconSize: [37, 37],
    iconAnchor: [18.5, 18.5],
  });
  const marker = runtime.leaflet
    .marker([coordinates[0][1], coordinates[0][0]], {
      icon,
      interactive: false,
      keyboard: false,
      zIndexOffset: -200,
    })
    .addTo(runtime.layers);
  marker.getElement()?.setAttribute('aria-hidden', 'true');
  let frame = 0;
  const started = performance.now();
  function animate(now: number) {
    let remaining =
      (reducedMotion ? 0.5 : ((now - started) % 12000) / 12000) * total;
    let i = 0;
    while (i < lengths.length - 1 && remaining > lengths[i]) {
      remaining -= lengths[i];
      i++;
    }
    const from = coordinates[i],
      to = coordinates[i + 1];
    const ratio = Math.min(1, remaining / (lengths[i] || 1));
    marker.setLatLng([
      from[1] + (to[1] - from[1]) * ratio,
      from[0] + (to[0] - from[0]) * ratio,
    ]);
    const arrow = marker.getElement()?.firstElementChild as HTMLElement | null;
    if (arrow)
      arrow.style.transform = `rotate(${-Math.atan2(to[1] - from[1], to[0] - from[0])}rad)`;
    if (!reducedMotion) frame = requestAnimationFrame(animate);
  }
  animate(started);
  return () => {
    cancelAnimationFrame(frame);
    marker.remove();
  };
}

export function TripMap({
  state,
  archived = false,
  selectedVisitId,
  onSelectVisit,
  onViewDay,
}: {
  state: TripState;
  archived?: boolean;
  selectedVisitId?: string | null;
  onSelectVisit?: (visitId: string) => void;
  onViewDay?: (day: number) => void;
}) {
  const descriptionId = useId();
  const target = useRef<HTMLDivElement>(null);
  const runtime = useRef<Runtime | null>(null);
  const [visible, setVisible] = useState(false);
  const [inView, setInView] = useState(false);
  const [mapVersion, setMapVersion] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState(false);
  const [tileError, setTileError] = useState(false);
  const [localSelection, setLocalSelection] = useState<string | null>(null);
  const [filterDay, setFilterDay] = useState<'all' | number>('all');
  const scope = filterDay === 'all' ? 'trip' : 'day';
  const selectedId =
    selectedVisitId === undefined ? localSelection : selectedVisitId;
  const data = useMemo(
    () =>
      getTripMapData(
        {
          ...state,
          activeDay: filterDay === 'all' ? state.activeDay : filterDay,
        },
        { allDays: filterDay === 'all' },
      ),
    [state, filterDay],
  );
  const { points, unlocatedCount, totalCount } = data;
  const hasPoints = points.length > 0;
  const orderRoutes = useMemo(
    () => makeTripMapOrderRoutes(points, { scope }),
    [points, scope],
  );
  const routeKey = JSON.stringify([
    scope,
    attempt,
    points.map((p) => [p.visitId, p.day, p.order, p.latitude, p.longitude]),
  ]);
  const [routeRequest, setRouteRequest] = useState<{
    key: string;
    routes: readonly TripMapRouteDay[];
    loading: boolean;
  } | null>(null);
  const routes =
    routeRequest?.key === routeKey ? routeRequest.routes : orderRoutes;
  const routeLoading = visible && points.length > 1 &&
    (routeRequest?.key === routeKey ? routeRequest.loading : true);
  const selected = points.find((point) => point.visitId === selectedId);
  const selectedLinks = selected ? mapLinks(selected.placeId) : null;
  const latest = useRef({ points, routes, onSelectVisit });

  useEffect(() => {
    latest.current = { points, routes, onSelectVisit };
  }, [points, routes, onSelectVisit]);

  useEffect(() => {
    const visit = state.plan.find((visit) => visit.id === selectedVisitId);
    let cancelled = false;
    if (visit && filterDay !== 'all' && visit.day !== filterDay) {
      void Promise.resolve().then(() => {
        if (!cancelled) setFilterDay(visit.day);
      });
    }
    return () => { cancelled = true; };
  }, [selectedVisitId, state.plan, filterDay]);

  useEffect(() => {
    const element = target.current;
    if (!element || !hasPoints) return;
    if (typeof IntersectionObserver === 'undefined') {
      let cancelled = false;
      void Promise.resolve().then(() => {
        if (!cancelled) { setVisible(true); setInView(true); }
      });
      return () => { cancelled = true; };
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const showing = entries.some((entry) => entry.isIntersecting);
        setInView(showing);
        if (showing) setVisible(true);
      },
      { rootMargin: '80px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasPoints]);

  useEffect(() => {
    if (!visible || points.length < 2) return;
    const controller = new AbortController();
    void fetchTripMapRoutes(points, { scope, signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted)
          setRouteRequest({ key: routeKey, routes: result, loading: false });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setRouteRequest({
            key: routeKey,
            routes: orderRoutes,
            loading: false,
          });
      });
    return () => controller.abort();
  }, [visible, routeKey, points, orderRoutes, attempt, scope]);

  useEffect(() => {
    const element = target.current;
    if (!visible || !hasPoints || !element) return;
    let disposed = false;
    let owned: Runtime | null = null;
    let observer: ResizeObserver | undefined;
    let resizeFrame = 0;
    const failedTiles = new Set<HTMLImageElement>();
    void import('leaflet')
      .then((imported) => {
        if (disposed) return;
        const leaflet = (imported.default ?? imported) as Leaflet;
        const map = leaflet.map(element, {
          center:
            state.region === '서울' ? [37.5445, 127.0374] : [33.38, 126.55],
          zoom: 11,
          scrollWheelZoom: false,
          zoomControl: false,
          minZoom: 3,
          maxZoom: 19,
          keyboard: true,
          zoomAnimation: false,
          fadeAnimation: false,
        });
        owned = {
          leaflet,
          map,
          layers: leaflet.layerGroup().addTo(map),
          markers: new Map(),
        };
        runtime.current = owned;
        map.attributionControl.setPrefix(false);
        map.attributionControl.setPosition('bottomleft');
        leaflet.control
          .zoom({
            position: 'topright',
            zoomInTitle: '지도 확대',
            zoomOutTitle: '지도 축소',
          })
          .addTo(map);
        const tiles = leaflet.tileLayer(
          'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          {
            maxZoom: 19,
            keepBuffer: 1,
            updateWhenIdle: true,
            updateWhenZooming: false,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
          },
        );
        tiles.on('tileerror', (event) => {
          if (!disposed) {
            failedTiles.add(event.tile);
            setTileError(true);
          }
        });
        const clearTileFailure = (event: { tile: HTMLImageElement }) => {
          if (!disposed) {
            failedTiles.delete(event.tile);
            setTileError(failedTiles.size > 0);
          }
        };
        tiles.on('tileload', clearTileFailure);
        tiles.on('tileunload', clearTileFailure);
        tiles.addTo(map);
        if (typeof ResizeObserver !== 'undefined') {
          observer = new ResizeObserver(() => {
            cancelAnimationFrame(resizeFrame);
            resizeFrame = requestAnimationFrame(() => {
              if (!disposed) map.invalidateSize({ pan: false });
            });
          });
          observer.observe(element);
        }
        fitRoute(owned, latest.current.points, latest.current.routes);
        setMapVersion((version) => version + 1);
        setMapError(false);
        setLoading(false);
      })
      .catch(() => {
        if (!disposed) {
          setMapError(true);
          setLoading(false);
        }
      });
    return () => {
      disposed = true;
      observer?.disconnect();
      cancelAnimationFrame(resizeFrame);
      if (runtime.current === owned) runtime.current = null;
      owned?.map.remove();
    };
  }, [visible, hasPoints, attempt, state.region]);

  useEffect(() => {
    const current = runtime.current;
    if (!current || !hasPoints) return;
    current.layers.clearLayers();
    current.markers.clear();
    const { leaflet, layers } = current;
    for (const route of routes) {
      if (route.coordinates.length < 2) continue;
      const positions = route.coordinates.map(
        ([lng, lat]) => [lat, lng] as [number, number],
      );
      leaflet
        .polyline(positions, {
          color: '#241f1c',
          weight: 13,
          opacity: 0.16,
          interactive: false,
          lineCap: 'round',
          lineJoin: 'round',
        })
        .addTo(layers);
      leaflet
        .polyline(positions, {
          color: '#fff',
          weight: 10,
          opacity: 0.98,
          interactive: false,
          lineCap: 'round',
          lineJoin: 'round',
          className: 'trip-route-casing',
        })
        .addTo(layers);
      leaflet
        .polyline(positions, {
          color: routeColor,
          weight: 5.5,
          opacity: 1,
          interactive: false,
          lineCap: 'round',
          lineJoin: 'round',
          className: 'trip-route-line',
        })
        .addTo(layers);
    }
    const counts = new Map<string, number>();
    const seen = new Map<string, number>();
    points.forEach((point) => {
      const key = `${point.latitude},${point.longitude}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    points.forEach((point, i) => {
      const close = (other: MapPoint | undefined) =>
        other &&
        Math.hypot(
          (other.longitude - point.longitude) * 0.84,
          other.latitude - point.latitude,
        ) *
          111 <
          0.8;
      let offset = close(points[i - 1])
        ? [15, -8]
        : close(points[i + 1])
          ? [-15, 8]
          : [0, 0];
      const key = `${point.latitude},${point.longitude}`;
      const repeat = seen.get(key) ?? 0;
      seen.set(key, repeat + 1);
      if ((counts.get(key) ?? 0) > 1) {
        const angle = (repeat * Math.PI * 2) / counts.get(key)!;
        offset = [Math.cos(angle) * 20, Math.sin(angle) * 20];
      }
      const icon = leaflet.divIcon({
        className:
          'trip-map-marker' + (scope === 'trip' ? ' is-whole-trip' : ''),
        html: `${scope === 'trip' ? `<small>D${point.day}</small>` : ''}<span>${point.order}</span>`,
        iconSize: [29, 29],
        iconAnchor: [14.5 - offset[0], 14.5 - offset[1]],
      });
      const marker = leaflet.marker([point.latitude, point.longitude], {
        icon,
        title: `DAY ${point.day} · ${point.order}. ${point.name}`,
        alt: point.name,
        keyboard: true,
        riseOnHover: true,
      });
      marker.on('click', () => {
        setLocalSelection(point.visitId);
        latest.current.onSelectVisit?.(point.visitId);
      });
      marker.addTo(layers);
      current.markers.set(point.visitId, marker);
    });
    fitRoute(current, points, routes);
    return () => {
      current.layers.clearLayers();
      current.markers.clear();
    };
  }, [points, routes, hasPoints, mapVersion, scope]);

  useEffect(() => {
    const current = runtime.current;
    if (!current) return;
    current.markers.forEach((marker, id) => {
      const element = marker.getElement();
      element?.classList.toggle('is-selected', id === selectedId);
      element?.setAttribute('aria-pressed', String(id === selectedId));
    });
    const point = points.find((p) => p.visitId === selectedId);
    if (point)
      current.map.panInside([point.latitude, point.longitude], {
        padding: [42, 42],
        animate: false,
      });
  }, [selectedId, points, routes, mapVersion]);

  useEffect(() => {
    const current = runtime.current;
    if (!current || !inView || !hasPoints) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let cleanups = routes.map((route) =>
      traveler(current, route, motion.matches),
    );
    const changeMotion = () => {
      cleanups.forEach((cleanup) => cleanup());
      cleanups = routes.map((route) =>
        traveler(current, route, motion.matches),
      );
    };
    motion.addEventListener('change', changeMotion);
    return () => {
      motion.removeEventListener('change', changeMotion);
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [routes, inView, hasPoints, mapVersion, attempt, state.region]);

  function retry() {
    setLoading(true);
    setMapError(false);
    setTileError(false);
    setAttempt((value) => value + 1);
  }
  const road =
    routes.length > 0 && routes.every((route) => route.source === 'ROAD');
  const distance = routes.reduce((sum, route) => sum + route.distanceKm, 0);
  return (
    <section
      className="trip-map"
      aria-label={archived ? '이 일정의 동선 지도' : '내 여행 동선 지도'}
    >
      <div className="trip-map-label">
        <MapIcon size={15} />
        <span>
          {scope === 'trip' ? '전체 여행 경로' : `DAY ${filterDay} 경로`}
        </span>
        <output className="trip-map-summary">
          {routeLoading
            ? '도로 경로 계산 중'
            : points.length > 1
              ? `${unlocatedCount > 0 ? '확인된 장소 간 ' : ''}${distance.toFixed(1)}km · ${road ? '차량 경로 참고' : '방문 순서'}`
              : `${points.length}개 장소`}
        </output>
      </div>
      <fieldset className="trip-map-scope" aria-label="경로 표시 범위">
        <button
          type="button"
          aria-pressed={filterDay === 'all'}
          onClick={() => setFilterDay('all')}
        >
          전체 경로
        </button>
        {Array.from({ length: state.days }, (_, i) => i + 1).map((day) => (
          <button
            type="button"
            key={day}
            aria-pressed={filterDay === day}
            onClick={() => {
              setLocalSelection(null);
              setFilterDay(day);
              onViewDay?.(day);
            }}
          >
            DAY {day}
          </button>
        ))}
      </fieldset>
      {hasPoints ? (
        <>
          <div className="trip-map-frame">
            <div
              ref={target}
              className="trip-map-canvas"
              aria-label={`${scope === 'trip' ? '여행 전체 경로' : `DAY ${filterDay}`} 지도. 방향키로 이동, 더하기와 빼기 키로 확대와 축소`}
              aria-describedby={descriptionId}
            />
            {(loading || !visible) && !mapError && (
              <output className="trip-map-loading">
                지도를 불러오고 있어요…
              </output>
            )}
            {mapError && (
              <output className="trip-map-loading trip-map-error">
                <span>
                  지도를 불러오지 못했어요. 장소 목록은 계속 확인할 수 있어요.
                </span>
                <button type="button" onClick={retry}>
                  <RotateCcw size={14} /> 다시 불러오기
                </button>
              </output>
            )}
            {!loading && !mapError && (
              <button
                type="button"
                className="trip-map-fit"
                onClick={() =>
                  runtime.current && fitRoute(runtime.current, points, routes)
                }
                aria-label="모든 방문 장소 모아 보기"
              >
                <LocateFixed size={16} />
              </button>
            )}
          </div>
          {tileError && (
            <output className="trip-map-tile-error">
              배경 지도를 불러오지 못했어요. 장소 목록과 길찾기는 계속 확인할 수
              있어요.
              <button type="button" onClick={retry}>
                다시 불러오기
              </button>
            </output>
          )}
          {routes.some((route) => route.legs.length) && (
            <div className="trip-route-legs" aria-label="장소 사이 이동 구간">
              {routes.flatMap((route) =>
                route.legs.map((leg) => (
                  <div
                    className="trip-route-leg"
                    key={`${leg.from.visitId}-${leg.to.visitId}`}
                  >
                    <span className="trip-route-leg-icon">
                      <Car size={15} />
                    </span>
                    <div>
                      <small>
                        {leg.from.day !== leg.to.day
                          ? `DAY ${leg.from.day} → DAY ${leg.to.day} · 날짜 이동 · `
                          : `DAY ${leg.from.day} · `}
                        {route.source === 'ROAD'
                          ? '차량 경로 참고'
                          : '도로 경로 미확인'}
                        {unlocatedCount > 0 && ' · 미확인 중간 방문 제외'}
                      </small>
                      <strong>
                        {leg.from.name} → {leg.to.name}
                      </strong>
                    </div>
                    <em>
                      {leg.minutes === null
                        ? '시간 미확인'
                        : `차량 참고 ${leg.minutes}분`}
                      <br />
                      {route.source === 'ORDER' && '직선 '}
                      {leg.distanceKm.toFixed(1)}km
                    </em>
                  </div>
                )),
              )}
            </div>
          )}
          {selected && (
            <div className="trip-map-selected" aria-live="polite">
              <strong>
                DAY {selected.day} · {selected.order}. {selected.name}
              </strong>
              <p>{selected.pointNote}</p>
              <div>
                {selectedLinks && (
                  <a
                    href={selectedLinks.naver}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    네이버 지도에서 확인 <ExternalLink size={12} />
                  </a>
                )}
                <a
                  href={selected.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  공식 장소 정보 <ExternalLink size={12} />
                </a>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="trip-map-empty">
          <MapPin size={22} />
          <strong>위치가 확인된 장소가 없어요</strong>
          <span>
            {totalCount
              ? '위치 확인 전인 일정은 아래 목록에서 확인해 주세요.'
              : '이날 가고 싶은 장소를 일정에 담아보세요.'}
          </span>
        </div>
      )}
      <p id={descriptionId} className="trip-route-note">
        {routeLoading
          ? '도로 경로를 확인하는 동안 방문 순서를 연결해 보여줘요.'
          : road
            ? '자동차 도로 기준 참고 경로예요. 실시간 교통·도보 경로는 길찾기에서 확인해 주세요.'
            : '방문 순서를 직선으로 연결했어요. 도로 경로와 이동 시간은 확인 전이에요.'}{' '}
        방향 표시는 실제 현재 위치가 아니에요.
        {unlocatedCount > 0 && ' 위치가 확인된 장소 사이의 참고 경로이며, 미확인 식사·숙소 등 중간 방문을 제외했어요. 전체 여행의 실제 이동거리·시간이 아니에요.'}
      </p>
      {unlocatedCount > 0 && (
        <p className="trip-map-unlocated">
          위치가 미확인인 식사·숙소 등 {unlocatedCount}곳은 지도에서 제외했어요.
        </p>
      )}
      {!routeLoading && !road && points.length > 1 && (
        <button
          className="trip-route-retry"
          type="button"
          onClick={() => setAttempt((value) => value + 1)}
        >
          도로 경로 다시 확인
        </button>
      )}
    </section>
  );
}
