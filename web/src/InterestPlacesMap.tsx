import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { MapPin, RefreshCw } from 'lucide-react';
import type { Map as MapInstance, Marker as MapMarker } from 'maplibre-gl';
import type { Place } from './data';
import { hasLocation } from './tripPlan';
import { interestKindLabels } from './interestCollectionStore';
import 'maplibre-gl/dist/maplibre-gl.css';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import './interest-places-map.css';

export interface InterestPlacesMapProps { places: Place[]; onSelectPlace: (place: Place) => void }
const pinText: Record<Place['kind'], string> = { LANDMARK: '장소', FOOD: '식당', CAFE: '카페', STAY: '숙소', SHOP: '쇼핑', LEISURE: '레저' };

/** Saved positions only: no ordering, route requests, GPS, or map tile caching. */
export default function InterestPlacesMap({ places, onSelectPlace }: InterestPlacesMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const current = useRef({ places, onSelectPlace }); current.current = { places, onSelectPlace };
  const noteId = useId();
  const mapKey = JSON.stringify(places.map(place => [place.id, place.kind, place.name, place.lat, place.lng, place.locationVerified]));
  const unique = useMemo(() => [...new Map(places.map(place => [place.id, place])).values()], [mapKey]);
  const mappable = useMemo(() => unique.filter(hasLocation), [unique]);
  const unknown = unique.filter(place => !hasLocation(place));
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const connected = () => { setOnline(true); setError(false); setAttempt(value => value + 1); };
    const disconnected = () => setOnline(false);
    window.addEventListener('online', connected); window.addEventListener('offline', disconnected);
    return () => { window.removeEventListener('online', connected); window.removeEventListener('offline', disconnected); };
  }, []);
  useEffect(() => {
    if (!online || error || !mappable.length || !container.current) return;
    let disposed = false, instance: MapInstance | null = null;
    const markers: MapMarker[] = [];
    let observer: ResizeObserver | null = null, frame: number | null = null;
    setLoaded(false);
    const fail = () => { if (!disposed) setError(true); };
    const deadline = window.setTimeout(fail, 12000);
    const resize = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => { frame = null; if (!disposed) instance?.resize(); });
    };
    void import('maplibre-gl').then(({ AttributionControl, LngLatBounds, Map: MapLibreMap, Marker, setWorkerUrl }) => {
      if (disposed || !container.current) return;
      setWorkerUrl(mapWorkerUrl);
      const map = new MapLibreMap({
        container: container.current,
        style: {
          version: 8,
          sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap contributors' } },
          layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
        },
        center: [mappable[0].lng, mappable[0].lat], zoom: 12, attributionControl: false,
      });
      instance = map;
      map.addControl(new AttributionControl({ compact: true }), 'bottom-right');
      map.on('error', fail);
      const bounds = new LngLatBounds();
      const samePosition = new Map<string, number>();
      for (const place of mappable) {
        bounds.extend([place.lng, place.lat]);
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'interest-map-pin'; button.dataset.kind = place.kind;
        button.textContent = pinText[place.kind]; button.title = place.name;
        button.setAttribute('aria-label', `${place.name} · ${interestKindLabels[place.kind]} 상세보기`);
        button.addEventListener('click', () => {
          const latest = current.current.places.find(item => item.id === place.id);
          if (latest) current.current.onSelectPlace(latest);
        });
        const position = `${place.lat}:${place.lng}`, offsetIndex = samePosition.get(position) ?? 0;
        samePosition.set(position, offsetIndex + 1);
        // Small visual offsets avoid hiding identical-coordinate pins; the source position stays unchanged.
        const offset: [number, number] = offsetIndex ? [offsetIndex % 2 ? 22 : -22, -Math.ceil(offsetIndex / 2) * 20] : [0, 0];
        markers.push(new Marker({ element: button, anchor: 'bottom', offset }).setLngLat([place.lng, place.lat]).addTo(map));
      }
      map.on('load', () => {
        if (disposed) return;
        window.clearTimeout(deadline);
        map.fitBounds(bounds, { padding: 44, maxZoom: 14, duration: 0 });
        map.resize(); setLoaded(true);
      });
      if (typeof ResizeObserver !== 'undefined' && container.current) { observer = new ResizeObserver(resize); observer.observe(container.current); }
      window.addEventListener('resize', resize);
    }).catch(fail);
    return () => {
      disposed = true; window.clearTimeout(deadline);
      observer?.disconnect(); window.removeEventListener('resize', resize);
      if (frame !== null) cancelAnimationFrame(frame);
      markers.forEach(marker => marker.remove()); instance?.remove();
    };
  }, [mappable, online, error, attempt]);
  const unavailable = !online || error || !mappable.length;
  const placeButton = (place: Place) => <button type="button" key={place.id} onClick={() => onSelectPlace(place)}><MapPin size={16} aria-hidden="true" /><span><strong>{place.name}</strong><small>{interestKindLabels[place.kind]} · {place.area}</small></span><span>상세</span></button>;
  return <section className="interest-places-map" aria-label="관심 장소 지도">
    <div className="interest-map-heading"><strong>저장한 장소 위치</strong><span>{mappable.length}곳 표시</span></div>
    <p className="interest-map-note" id={noteId}>장소를 누르면 상세정보가 열려요. 방문 순서와 이동 경로는 표시하지 않아요.</p>
    {unavailable ? <div className="interest-map-fallback"><MapPin size={28} aria-hidden="true" /><strong>{!mappable.length ? '위치가 확인된 장소가 없어요' : !online ? '인터넷 연결 후 지도를 볼 수 있어요' : '지도를 불러오지 못했어요'}</strong><p>아래 목록에서 사진과 상세정보를 확인할 수 있어요.</p>{online && error && <button type="button" onClick={() => { setError(false); setAttempt(value => value + 1); }}><RefreshCw size={16} />지도 다시 연결</button>}</div> : <div className="interest-map-surface" aria-describedby={noteId}><div ref={container} className="interest-map-canvas" aria-label="저장한 장소 위치 지도" />{!loaded && <p className="interest-map-loading" role="status">지도 불러오는 중</p>}</div>}
    {!!mappable.length && <details className="interest-map-list" open={unavailable}><summary>지도에 표시한 장소 · {mappable.length}곳</summary><div>{mappable.map(placeButton)}</div></details>}
    {!!unknown.length && <details className="interest-map-list interest-map-unknown"><summary>위치 확인이 필요한 장소 · {unknown.length}곳</summary><p>주소·좌표가 확인되지 않아 지도에서 제외했어요.</p><div>{unknown.map(placeButton)}</div></details>}
    {!unique.length && <p className="interest-map-empty">조건에 맞는 저장 장소가 없어요. 목록이나 필터를 바꿔보세요.</p>}
  </section>;
}
