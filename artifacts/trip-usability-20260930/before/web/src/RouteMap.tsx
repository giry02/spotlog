import { useUiCopy } from './frontendCopy';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Map as MapIcon, MapPin, Footprints, Car, Check } from 'lucide-react';
import type { Place } from './data';
import { hasLocation } from './tripPlan';
import { distanceKm, makeEstimatedRoute, fetchRoadRoute,fetchServiceRoute, scheduleCheckForLeg, type RouteResult } from './routeData';
import { useLocale } from './locale';
import { NaverRouteCanvas } from './NaverRouteCanvas';
import 'maplibre-gl/dist/maplibre-gl.css';
export default function RouteMap({ places, selectedVisitId, onSelectVisit }: { places: Place[]; selectedVisitId?: string; onSelectVisit?: (id: string) => void }) {
  const copy=useUiCopy();
  const {locale}=useLocale(),en=locale==='en';
  const naverClientId=import.meta.env.VITE_NAVER_MAP_CLIENT_ID?.trim()??'';
  const routeEndpoint=import.meta.env.VITE_ROUTE_ENDPOINT?.trim()??'';
  const containerRef = useRef<HTMLDivElement>(null);
  const routeKey = JSON.stringify(places.map(place=>[place.visitId,place.id,place.lat,place.lng,place.time,place.duration,place.locationVerified,place.name,place.move]));
  const mappablePlaces = useMemo(() => places.filter(hasLocation), [routeKey]);
  const markerNumbers=useMemo(()=>places.flatMap((p,index)=>hasLocation(p)?[index+1]:[]),[routeKey]);
  const selection = useRef({ selectedVisitId, onSelectVisit });
  selection.current = { selectedVisitId, onSelectVisit };
  const markerNodes = useRef(new Map<string, HTMLElement>());
  const [mapError, setMapError] = useState(false);
  const estimatedRoute = useMemo(() => makeEstimatedRoute(mappablePlaces), [mappablePlaces]);
  const [routeResult, setRouteResult] = useState<RouteResult>(estimatedRoute);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeAttempt,setRouteAttempt]=useState(0);

  useEffect(() => {
    setRouteResult(estimatedRoute);
    if (mappablePlaces.length < 2 || naverClientId&&!routeEndpoint) {
      setRouteLoading(false);
      return;
    }
    const controller = new AbortController();
    setRouteLoading(true);
    const timeout=window.setTimeout(()=>{controller.abort();setRouteResult(estimatedRoute);setRouteLoading(false);},8000);
    void (routeEndpoint?fetchServiceRoute(routeEndpoint,mappablePlaces,controller.signal):fetchRoadRoute(mappablePlaces, controller.signal))
      .then((result) => { if (!controller.signal.aborted) setRouteResult(result); })
      .catch((error: unknown) => {
        if (!controller.signal.aborted && !(error instanceof DOMException && error.name === 'AbortError')) setRouteResult(estimatedRoute);
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (!controller.signal.aborted) setRouteLoading(false);
      });
    return () => { window.clearTimeout(timeout);controller.abort(); };
  }, [estimatedRoute, mappablePlaces,routeAttempt]);

  useEffect(() => {
    if (!containerRef.current || !mappablePlaces.length || naverClientId) return;
    const container = containerRef.current;
    markerNodes.current.clear();
    setMapError(false);
    let disposed = false;
    let map: { remove: () => void } | null = null;
    let animationFrame: number | null = null;
    let routeOverlay: SVGSVGElement | null = null;
    let detachOverlayListeners: (() => void) | null = null;
    void import('maplibre-gl').then(({ AttributionControl, LngLatBounds, Map: MapLibreMap, Marker }) => {
      if (disposed) return;
      const instance = new MapLibreMap({
        container,
        style: {
          version: 8,
          sources: {
            osm: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '© OpenStreetMap contributors',
            },
          },
          layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
        },
        center: [mappablePlaces[0].lng, mappablePlaces[0].lat],
        zoom: 11,
        attributionControl: false,
      });
      map = instance;
      instance.on('error', () => { if (!disposed) setMapError(true); });
      instance.addControl(new AttributionControl({ compact: true }), 'bottom-right');
      const bounds = new LngLatBounds();
      routeResult.coordinates.forEach((coordinate) => {
        if (Number.isFinite(coordinate[0]) && Number.isFinite(coordinate[1])) bounds.extend(coordinate);
      });
      mappablePlaces.forEach((place, index) => {
        bounds.extend([place.lng, place.lat]);
        const marker = document.createElement(onSelectVisit ? 'button' : 'div');
        marker.className = 'route-marker';
        const number = places.findIndex(item => place.visitId ? item.visitId === place.visitId : item.id === place.id) + 1;
        marker.textContent = String(number);
        marker.title = `${number}. ${place.name}`;
        marker.setAttribute('aria-label', `${number}. ${place.name}`);
        if (place.visitId) {
          markerNodes.current.set(place.visitId, marker);
          marker.dataset.selected = String(selection.current.selectedVisitId === place.visitId);
          marker.addEventListener('click', () => selection.current.onSelectVisit?.(place.visitId!));
        }
        const closeToPrevious = index > 0 && distanceKm(mappablePlaces[index - 1], place) < 0.8;
        const closeToNext = index < mappablePlaces.length - 1 && distanceKm(place, mappablePlaces[index + 1]) < 0.8;
        const offset: [number, number] = closeToPrevious ? [15, -8] : closeToNext ? [-15, 8] : [0, 0];
        new Marker({ element: marker, anchor: 'center', offset }).setLngLat([place.lng, place.lat]).addTo(instance);
      });
      instance.on('load', () => {
        if (routeResult.coordinates.length > 1) {
          instance.addSource('route', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: routeResult.coordinates } } });
          instance.addLayer({ id: 'route-shadow', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#241f1c', 'line-width': 13, 'line-opacity': 0.16, 'line-blur': 2 } });
          instance.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 10, 'line-opacity': 0.98 } });
          instance.addLayer({ id: 'route-line', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ff4f35', 'line-width': 5.5, 'line-opacity': 1 } });

          const route = routeResult.coordinates;
          const svgNamespace = 'http://www.w3.org/2000/svg';
          routeOverlay = document.createElementNS(svgNamespace, 'svg');
          routeOverlay.classList.add('route-map-overlay');
          routeOverlay.setAttribute('aria-hidden', 'true');
          const overlayCasing = document.createElementNS(svgNamespace, 'path');
          overlayCasing.classList.add('route-overlay-casing');
          const overlayLine = document.createElementNS(svgNamespace, 'path');
          overlayLine.classList.add('route-overlay-line');
          routeOverlay.append(overlayCasing, overlayLine);
          container.append(routeOverlay);
          const updateRouteOverlay = () => {
            const path = route.map((coordinate, index) => {
              const point = instance.project(coordinate);
              return `${index ? 'L' : 'M'}${point.x.toFixed(1)},${point.y.toFixed(1)}`;
            }).join(' ');
            overlayCasing.setAttribute('d', path);
            overlayLine.setAttribute('d', path);
          };
          instance.on('move', updateRouteOverlay);
          instance.on('resize', updateRouteOverlay);
          detachOverlayListeners = () => {
            instance.off('move', updateRouteOverlay);
            instance.off('resize', updateRouteOverlay);
          };

          const traveler = document.createElement('div');
          traveler.className = 'route-traveler';
          traveler.innerHTML = '<span>➜</span>';
          traveler.setAttribute('aria-hidden', 'true');
          const travelerMarker = new Marker({ element: traveler, anchor: 'center' }).setLngLat(route[0]).addTo(instance);
          const segmentLengths = route.slice(1).map((coordinate, index) => {
            const [fromLng, fromLat] = route[index];
            const [toLng, toLat] = coordinate;
            const latitudeScale = Math.cos(((fromLat + toLat) / 2) * Math.PI / 180);
            return Math.hypot((toLng - fromLng) * latitudeScale, toLat - fromLat);
          });
          const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0) || 1;
          const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          const startedAt = performance.now();
          const animateTraveler = (now: number) => {
            if (disposed) return;
            let distanceAt = reduceMotion ? totalLength * 0.5 : (((now - startedAt) % 12000) / 12000) * totalLength;
            let segmentIndex = 0;
            while (segmentIndex < segmentLengths.length - 1 && distanceAt > segmentLengths[segmentIndex]) {
              distanceAt -= segmentLengths[segmentIndex];
              segmentIndex += 1;
            }
            const from = route[segmentIndex];
            const to = route[segmentIndex + 1];
            const ratio = Math.min(1, distanceAt / (segmentLengths[segmentIndex] || 1));
            travelerMarker.setLngLat([from[0] + (to[0] - from[0]) * ratio, from[1] + (to[1] - from[1]) * ratio]);
            const arrow = traveler.firstElementChild as HTMLElement | null;
            if (arrow) arrow.style.transform = `rotate(${-Math.atan2(to[1] - from[1], to[0] - from[0])}rad)`;
            if (!reduceMotion) animationFrame = requestAnimationFrame(animateTraveler);
          };
          animationFrame = requestAnimationFrame(animateTraveler);
        }
        instance.fitBounds(bounds, { padding: 34, maxZoom: 13, duration: 0 });
        window.requestAnimationFrame(() => instance.triggerRepaint());
      });
    }).catch(() => { if (!disposed) setMapError(true); });

    return () => {
      disposed = true;
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      detachOverlayListeners?.();
      routeOverlay?.remove();
      map?.remove();
    };
  }, [mappablePlaces, routeResult]);

  useEffect(() => { markerNodes.current.forEach((node,id) => { node.dataset.selected = String(id === selectedVisitId); }); }, [selectedVisitId]);

  const routeStatus = routeLoading
    ? copy("도로 경로 계산 중")
    : routeResult.legs.length
      ? `${routeResult.distanceKm.toFixed(1)}km · ${en?'reference route':'경로 참고'}`
      : `${places.length}${en?' places':'개 장소'}`;
  const scheduleChecks = routeResult.legs.map(scheduleCheckForLeg).filter((check): check is NonNullable<typeof check> => check !== null);
  const conflictCount = scheduleChecks.filter((check) => check.margin < 0).length;

  return <section className="map-card"><div className="map-label"><MapIcon size={15} /><span>DAY ROUTE</span><strong aria-live="polite">{routeStatus}</strong></div>{mappablePlaces.length ? naverClientId?<NaverRouteCanvas places={mappablePlaces} numbers={markerNumbers} coordinates={routeResult.coordinates} selectedVisitId={selectedVisitId} onSelectVisit={onSelectVisit} clientId={naverClientId}/>:<div className="route-map" ref={containerRef} aria-label={en?'Trip map':copy("여행 지도")} /> : <div className="route-map-unavailable"><MapPin size={24} /><strong>{en?'No verified locations yet':copy("위치가 확인된 장소가 없어요")}</strong><span>{en?'Check the addresses to find these places on a map.':copy("주소를 확인한 뒤 지도에서 찾아볼 수 있어요.")}</span></div>}
    {mapError && <p className="route-data-note" role="status">{copy("지도 일부를 불러오지 못했어요. 장소 목록은 계속 사용할 수 있어요.")}</p>}
    {mappablePlaces.length < places.length && <p className="route-data-note">{copy("위치가 미확인인")}{' '}{places.length-mappablePlaces.length}{copy("곳은 지도에서 제외했어요.")}</p>}
    {routeResult.legs.length > 0 && <div className="route-leg-list">{routeResult.legs.map((leg) => {
      const schedule = scheduleCheckForLeg(leg);
      return <div className="route-leg" key={`${leg.from.id}-${leg.to.id}`}><span className="route-leg-icon">{leg.mode === 'WALK' ? <Footprints size={15} /> : <Car size={15} />}</span><div><small>{leg.from.time ?? '--:--'} → {leg.to.time ?? '--:--'} · {leg.mode === 'WALK' ? copy("도보 경로 미확인") : copy("차량 추정")}</small><strong>{leg.from.name} → {leg.to.name}</strong>{schedule && <span className={`route-leg-schedule ${schedule.margin < 0 ? 'conflict' : 'okay'}`}>{en?`${Math.abs(schedule.margin)} min ${schedule.margin<0?'short':'spare'} · arrival ${schedule.arrival}`:schedule.text}</span>}</div><em>{leg.mode==='WALK'?copy("시간 미확인"):en?`Est. ${leg.minutes} min`:`추정 ${leg.minutes}분`}<br />{leg.distanceKm.toFixed(1)}km</em></div>;
    })}</div>}
    {routeResult.legs.length > 0 && <div className={`route-schedule-summary ${conflictCount ? 'conflict' : 'okay'}`}><Check size={15} /><span>{scheduleChecks.length === 0 ? copy("도착 시각과 체류시간을 입력하면 일정 충돌을 확인합니다.") : conflictCount ? en?`${conflictCount} estimated connections need more time.`:`추정 계산상 ${conflictCount}개 구간의 시간이 부족합니다.` : en?`${scheduleChecks.length} connections have estimated spare time. Check actual travel conditions.`:`추정 계산상 ${scheduleChecks.length}개 구간에 여유가 있습니다. 실제 이동은 확인이 필요합니다.`}</span></div>}
    {routeResult.legs.length > 0 && <p className="route-data-note">{routeLoading?copy("도로 경로를 확인하는 동안 직선 연결을 보여줘요."):naverClientId&&!routeEndpoint?(en?'Places are linked in visit order. Driving routes and travel times are not verified.':'방문 순서를 직선으로 연결했어요. 도로 경로와 이동 시간은 확인 전이에요.'):routeResult.source === 'ROAD' ? copy("자동차 도로 기준의 참고 경로입니다. 도보 경로와 시간은 미확인입니다. 실시간 교통·운영 정보는 길찾기에서 확인하세요.") : copy("도로 경로를 불러오지 못해 직선거리로 추정했습니다. 실제 이동 경로·시간이 아닙니다.")}</p>}
    {!routeLoading&&(!naverClientId||routeEndpoint)&&mappablePlaces.length>1&&routeResult.source==='ESTIMATE'&&<button className="outline wide" onClick={()=>setRouteAttempt(current=>current+1)}>{copy("도로 경로 다시 확인")}</button>}
  </section>;
}

