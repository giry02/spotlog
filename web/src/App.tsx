import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Bookmark,
  CalendarDays,
  Car,
  Check,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Coffee,
  Compass,
  Copy,
  Edit3,
  Eye,
  Footprints,
  Globe2,
  Hotel,
  ImagePlus,
  Lock,
  Map as MapIcon,
  MapPin,
  MoreHorizontal,
  Navigation,
  Plus,
  Save,
  Route,
  Search,
  Share2,
  Store,
  Trash2,
  UserRound,
  Utensils,
  Volume2,
  VolumeX,
  type LucideIcon,
} from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { type ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  discoveryLandmarks,
  initialJourneys,
  placeCatalog,
  placeKindLabel,
  type Journey,
  type JourneyDay,
  type Place,
  type PlaceKind,
  type StoryBlock,
} from './data';
import { isNativeShell, notifyReady, openExternal, shareContent } from './nativeBridge';

type Tab = 'discover' | 'trips' | 'saved' | 'profile';

const tabItems: Array<{ id: Tab; icon: LucideIcon; label: string }> = [
  { id: 'discover', icon: Compass, label: '발견' },
  { id: 'trips', icon: MapIcon, label: '내 여행' },
  { id: 'saved', icon: Bookmark, label: '저장' },
  { id: 'profile', icon: UserRound, label: '프로필' },
];

const statusLabel = { PLANNING: '계획 중', TRAVELING: '여행 중', PUBLISHED: '여행일기' } as const;
const storageKeys = { saved: 'spotlog.web.saved.v3', journeys: 'spotlog.web.journeys.v4' };

const readSavedIds = () => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKeys.saved) ?? '[]');
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

const readJourneys = (): Journey[] => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKeys.journeys) ?? 'null');
    if (!Array.isArray(value) || !value.length) return initialJourneys;
    const stored = value as Journey[];
    const publishedGuides = initialJourneys.filter((journey) => !journey.isMine && journey.status === 'PUBLISHED');
    const guideById = new Map(publishedGuides.map((journey) => [journey.id, journey]));
    const refreshed = stored.map((journey) => !journey.isMine && guideById.has(journey.id) ? structuredClone(guideById.get(journey.id)!) : journey);
    const storedIds = new Set(refreshed.map((journey) => journey.id));
    return [...publishedGuides.filter((journey) => !storedIds.has(journey.id)), ...refreshed];
  } catch {
    return initialJourneys;
  }
};

const makePlaceShareText = (place: Place) => `${place.name}\n${place.address}\n${place.description}\n\n카카오맵 길찾기\n${kakaoDirectionsUrl(place)}\n\nSpotlog 여행 기록에서 공유`;
const kakaoDirectionsUrl = (place: Place) => Number.isFinite(place.lat) && Number.isFinite(place.lng)
  ? `https://map.kakao.com/link/to/${encodeURIComponent(place.name)},${place.lat},${place.lng}`
  : `https://map.kakao.com/?q=${encodeURIComponent(`${place.name} ${place.address}`)}`;
const journeyPlaceCount = (journey: Journey) => journey.days.reduce((sum, day) => sum + day.places.length, 0);

const resizeImageFile = (file: File, maxWidth = 1600, quality = 0.82) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('사진을 읽을 수 없습니다.'));
  reader.onload = () => {
    const source = new Image();
    source.onerror = () => reject(new Error('사진 형식을 확인해 주세요.'));
    source.onload = () => {
      const scale = Math.min(1, maxWidth / source.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(source.width * scale));
      canvas.height = Math.max(1, Math.round(source.height * scale));
      canvas.getContext('2d')?.drawImage(source, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    source.src = String(reader.result);
  };
  reader.readAsDataURL(file);
});

type RouteSource = 'ROAD' | 'ESTIMATE';

interface RouteLeg {
  from: Place;
  to: Place;
  distanceKm: number;
  minutes: number;
  mode: 'WALK' | 'DRIVE';
}

interface RouteResult {
  source: RouteSource;
  coordinates: Array<[number, number]>;
  distanceKm: number;
  minutes: number;
  legs: RouteLeg[];
}

interface OsrmRoutePayload {
  code?: string;
  routes?: Array<{
    distance?: number;
    duration?: number;
    geometry?: { coordinates?: Array<[number, number]> };
    legs?: Array<{ distance?: number; duration?: number }>;
  }>;
}

const distanceKm = (from: Place, to: Place) => {
  const toRadians = (value: number) => value * Math.PI / 180;
  const latitudeDelta = toRadians(to.lat - from.lat);
  const longitudeDelta = toRadians(to.lng - from.lng);
  const fromLatitude = toRadians(from.lat);
  const toLatitude = toRadians(to.lat);
  const value = Math.sin(latitudeDelta / 2) ** 2 + Math.sin(longitudeDelta / 2) ** 2 * Math.cos(fromLatitude) * Math.cos(toLatitude);
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

const routeMode = (place: Place): RouteLeg['mode'] => place.move?.includes('도보') ? 'WALK' : 'DRIVE';
const roundMinutes = (value: number) => Math.max(5, Math.ceil(value / 5) * 5);

const parseDurationMinutes = (value: string) => {
  if (value.includes('숙박') || value.includes('박')) return null;
  const hourMatch = value.match(/(\d+)\s*시간/);
  const minuteMatch = value.match(/(\d+)\s*분/);
  const minutes = Number(hourMatch?.[1] ?? 0) * 60 + Number(minuteMatch?.[1] ?? 0);
  return minutes > 0 ? minutes : null;
};

const timeToMinutes = (value?: string) => {
  if (!value) return null;
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const formatClock = (value: number) => {
  const normalized = ((value % (24 * 60)) + (24 * 60)) % (24 * 60);
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
};

const scheduleCheckForLeg = (leg: RouteLeg) => {
  const fromStart = timeToMinutes(leg.from.time);
  const nextStart = timeToMinutes(leg.to.time);
  const stay = parseDurationMinutes(leg.from.duration);
  if (fromStart === null || nextStart === null || stay === null) return null;
  const arrival = fromStart + stay + leg.minutes;
  const margin = nextStart - arrival;
  return {
    margin,
    text: margin < 0
      ? `${Math.abs(margin)}분 부족 · ${formatClock(arrival)} 도착 예상`
      : `${margin}분 여유 · ${formatClock(arrival)} 도착 예상`,
  };
};

const makeEstimatedRoute = (places: Place[]): RouteResult => {
  const legs = places.slice(1).map((place, index) => {
    const from = places[index];
    const distance = distanceKm(from, place);
    const mode = routeMode(place);
    const minutes = mode === 'WALK' ? roundMinutes((distance / 4.5) * 60) : roundMinutes((distance / 25) * 60 + 8);
    return { from, to: place, distanceKm: distance, minutes, mode };
  });
  return {
    source: 'ESTIMATE',
    coordinates: places.map((place) => [place.lng, place.lat]),
    distanceKm: legs.reduce((sum, leg) => sum + leg.distanceKm, 0),
    minutes: legs.reduce((sum, leg) => sum + leg.minutes, 0),
    legs,
  };
};

const fetchRoadRoute = async (places: Place[], signal: AbortSignal): Promise<RouteResult> => {
  const coordinates = places.map((place) => `${place.lng},${place.lat}`).join(';');
  const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?alternatives=false&steps=false&overview=full&geometries=geojson`, { signal });
  if (!response.ok) throw new Error(`Route HTTP ${response.status}`);
  const payload = await response.json() as OsrmRoutePayload;
  const route = payload.code === 'Ok' ? payload.routes?.[0] : undefined;
  const geometry = route?.geometry?.coordinates;
  if (!route || !Array.isArray(geometry) || geometry.length < 2) throw new Error('Road route unavailable');
  const legs = places.slice(1).map((place, index) => {
    const roadLeg = route.legs?.[index];
    const from = places[index];
    const distance = Number(roadLeg?.distance ?? 0) / 1000 || distanceKm(from, place);
    const mode = routeMode(place);
    const minutes = mode === 'WALK' ? roundMinutes((distance / 4.5) * 60) : roundMinutes(Number(roadLeg?.duration ?? 0) / 60 || (distance / 25) * 60 + 8);
    return { from, to: place, distanceKm: distance, minutes, mode };
  });
  return {
    source: 'ROAD',
    coordinates: geometry,
    distanceKm: legs.reduce((sum, leg) => sum + leg.distanceKm, 0),
    minutes: legs.reduce((sum, leg) => sum + leg.minutes, 0),
    legs,
  };
};

export default function App() {
  const [tab, setTab] = useState<Tab>('discover');
  const [savedIds, setSavedIds] = useState<string[]>(readSavedIds);
  const [journeys, setJourneys] = useState<Journey[]>(readJourneys);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null);
  const [editingJourneyId, setEditingJourneyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState('');
  const native = isNativeShell();
  const savedPlaces = useMemo(() => discoveryLandmarks.filter((place) => savedIds.includes(place.id)), [savedIds]);
  const selectedJourney = journeys.find((journey) => journey.id === selectedJourneyId) ?? null;
  const editingJourney = journeys.find((journey) => journey.id === editingJourneyId) ?? null;

  useEffect(() => notifyReady(), []);
  useEffect(() => localStorage.setItem(storageKeys.saved, JSON.stringify(savedIds)), [savedIds]);
  useEffect(() => localStorage.setItem(storageKeys.journeys, JSON.stringify(journeys)), [journeys]);
  useEffect(() => {
    document.querySelector<HTMLElement>('.content')?.scrollTo({ top: 0, behavior: 'instant' });
  }, [tab, selectedJourneyId, editingJourneyId]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2200);
  };
  const toggleSaved = (id: string) => setSavedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const sharePlace = async (place: Place) => {
    try {
      const mode = await shareContent({ title: place.name, message: makePlaceShareText(place) });
      if (mode === 'clipboard') showToast('장소 정보와 길찾기 링크를 복사했습니다.');
    } catch {
      showToast('공유를 취소했습니다.');
    }
  };
  const shareJourney = async (journey: Journey) => {
    const routeText = journey.days.map((day) => `${day.date} · ${day.places.map((place) => place.name).join(' → ')}`).join('\n');
    try {
      const mode = await shareContent({ title: journey.title, message: `${journey.title}\n${journey.summary}\n\n${routeText}\n\nSpotlog 공개 여행일기` });
      if (mode === 'clipboard') showToast('여행일기 내용을 복사했습니다.');
    } catch {
      showToast('공유를 취소했습니다.');
    }
  };
  const addToPlanningJourney = (place: Place) => {
    const target = journeys.find((journey) => journey.status === 'PLANNING') ?? journeys[0];
    const alreadyAdded = target.days.some((day) => day.places.some((item) => item.id === place.id));
    if (alreadyAdded) {
      showToast(`${target.title}에 이미 담겨 있습니다.`);
      return;
    }
    setJourneys((current) => current.map((journey) => journey.id !== target.id ? journey : {
      ...journey,
      days: journey.days.map((day, index) => index ? day : {
        ...day,
        places: [...day.places, { ...place, move: '이동시간 확인 필요' }],
        blocks: [...day.blocks, { id: `place-${place.id}-${Date.now()}`, type: 'PLACE' as const, placeId: place.id }],
      }),
    }));
    showToast(`${target.title}에 담았습니다.`);
  };
  const createJourney = (title: string, region: string) => {
    const id = `journey-${Date.now()}`;
    const journey: Journey = {
      id, title, region, dateRange: '날짜 미정', duration: '일정 미정', status: 'PLANNING', visibility: 'PRIVATE', cover: placeCatalog.find((place) => place.area.includes(region))?.image ?? discoveryLandmarks[0].image,
      summary: `${region}에서의 장면과 이야기를 담을 새 여행입니다.`, story: '아직 출발 전입니다. 장소를 담고 날짜별 이동 순서를 만들어보세요.', tags: [region, '새여행'], saves: 0,
      days: [{ day: 1, date: 'DAY 1', title: '첫날의 기록', story: '이날의 이야기를 기록할 자리입니다.', places: [], blocks: [{ id: `text-${Date.now()}`, type: 'TEXT', heading: '첫 번째 이야기', body: '' }] }],
      author: 'Spotlog 여행자', isMine: true,
    };
    setJourneys((current) => [journey, ...current]);
    setCreating(false);
    setEditingJourneyId(id);
    showToast('새 여행을 만들었습니다.');
  };

  const saveJourney = (updated: Journey) => {
    setJourneys((current) => current.map((journey) => journey.id === updated.id ? updated : journey));
    setEditingJourneyId(null);
    setSelectedJourneyId(updated.id);
    showToast('여행기 초안을 저장했습니다.');
  };

  const deleteJourney = (target: Journey) => {
    if (!target.isMine || !window.confirm(`“${target.title}” 여행기를 삭제할까요?\n삭제한 여행기는 복구할 수 없습니다.`)) return;
    setJourneys((current) => current.filter((journey) => journey.id !== target.id));
    setSelectedJourneyId(null);
    setEditingJourneyId(null);
    showToast('여행기를 삭제했습니다.');
  };

  const copyJourney = (source: Journey) => {
    const id = `journey-copy-${Date.now()}`;
    const copied: Journey = {
      ...structuredClone(source),
      id,
      title: `${source.title} · 내 버전`,
      status: 'PLANNING',
      visibility: 'PRIVATE',
      saves: 0,
      author: 'Spotlog 여행자',
      isMine: true,
      sourceJourneyId: source.id,
      sourceAuthor: source.author,
    };
    setJourneys((current) => [copied, ...current]);
    setSelectedJourneyId(null);
    setEditingJourneyId(id);
    showToast('내 여행으로 복사했습니다.');
  };

  const selectTab = (next: Tab) => {
    setSelectedJourneyId(null);
    setEditingJourneyId(null);
    setTab(next);
  };

  return (
    <main className={`app-shell tab-${tab} ${selectedJourney || editingJourney ? 'detail-open' : ''}`}>
      <section className="content">
        {editingJourney ? (
          <JourneyEditor journey={editingJourney} onBack={() => setEditingJourneyId(null)} onSave={saveJourney} />
        ) : selectedJourney ? (
          <JourneyDetail journey={selectedJourney} onBack={() => setSelectedJourneyId(null)} onShare={() => void shareJourney(selectedJourney)} onSharePlace={(place) => void sharePlace(place)} onEdit={() => setEditingJourneyId(selectedJourney.id)} onDelete={() => deleteJourney(selectedJourney)} onCopy={() => copyJourney(selectedJourney)} />
        ) : (
          <>
            {tab === 'discover' && <Discover savedIds={savedIds} onToggle={toggleSaved} onShare={sharePlace} />}
            {tab === 'trips' && <Trips journeys={journeys} onOpen={setSelectedJourneyId} onCreate={() => setCreating(true)} onShare={(journey) => void shareJourney(journey)} />}
            {tab === 'saved' && <Saved places={savedPlaces} onRemove={toggleSaved} onAdd={addToPlanningJourney} onGoDiscover={() => selectTab('discover')} />}
            {tab === 'profile' && <Profile native={native} journeys={journeys} />}
          </>
        )}
      </section>

      {!selectedJourney && !editingJourney && <nav className="tabbar" aria-label="주요 메뉴">
        {tabItems.map((item) => {
          const Icon = item.icon;
          return <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => selectTab(item.id)}><Icon size={21} strokeWidth={tab === item.id ? 2.3 : 1.8} /><span>{item.label}</span></button>;
        })}
      </nav>}
      {creating && <CreateJourneySheet onClose={() => setCreating(false)} onCreate={createJourney} />}
      {toast && <div className="toast"><Check size={15} />{toast}</div>}
    </main>
  );
}

function Discover({ savedIds, onToggle, onShare }: { savedIds: string[]; onToggle: (id: string) => void; onShare: (place: Place) => void }) {
  return <div className="feed">{discoveryLandmarks.map((place) => <FeedCard key={place.id} place={place} saved={savedIds.includes(place.id)} onToggle={() => onToggle(place.id)} onShare={() => onShare(place)} />)}</div>;
}

function FeedCard({ place, saved, onToggle, onShare }: { place: Place; saved: boolean; onToggle: () => void; onShare: () => void }) {
  const cardRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const card = cardRef.current;
    const video = videoRef.current;
    if (!card || !video) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && entry.intersectionRatio > 0.65) void video.play().catch(() => undefined);
      else video.pause();
    }, { threshold: [0.65] });
    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  return <article className="feed-card" ref={cardRef}>
    <video ref={videoRef} src={place.video} poster={place.image} autoPlay muted={muted} loop playsInline preload="metadata" />
    <div className="video-shade" />
    <header className="feed-header"><strong className="wordmark">spotlog</strong><div className="feed-switch"><button className="active">국내</button><button>팔로잉</button></div><button className="ghost-icon" aria-label="검색"><Search size={21} /></button></header>
    <div className="feed-copy">
      <div className="creator-row"><span className="creator-avatar">{place.creator?.slice(0, 1).toUpperCase()}</span><strong>{place.creator}</strong><button>팔로우</button></div>
      <h1>{place.hook}</h1><p>{place.description}</p>
      <div className="tags">{place.tags?.map((tag) => <span key={tag}>#{tag}</span>)}</div>
      <button className="place-pill" onClick={onToggle}><span><MapPin size={16} /></span><span className="place-pill-copy"><strong>{place.name}</strong><small>{place.area} · {saved ? '저장됨' : '여행에 담기'}</small></span><ChevronRight size={17} /></button>
    </div>
    <div className="feed-actions"><ActionButton label={saved ? '저장됨' : '저장'} onClick={onToggle} active={saved} icon={Bookmark} /><ActionButton label="공유" onClick={onShare} icon={Share2} /><ActionButton label={muted ? '소리 켜기' : '음소거'} onClick={() => setMuted((value) => !value)} icon={muted ? VolumeX : Volume2} /><button className="more-button" aria-label="더보기"><MoreHorizontal size={23} /></button></div>
  </article>;
}

function ActionButton({ label, onClick, icon: Icon, active = false }: { label: string; onClick: () => void; icon: LucideIcon; active?: boolean }) {
  return <div className="action-item"><button className={active ? 'active' : ''} onClick={onClick} aria-label={label}><Icon size={23} fill={active ? 'currentColor' : 'none'} /></button><span>{label}</span></div>;
}

function Trips({ journeys, onOpen, onCreate, onShare }: { journeys: Journey[]; onOpen: (id: string) => void; onCreate: () => void; onShare: (journey: Journey) => void }) {
  const myTrips = journeys.filter((journey) => journey.isMine);
  const guideTrips = journeys.filter((journey) => !journey.isMine && journey.status === 'PUBLISHED');
  return <div className="page trips-page">
    <AppHeader title="여행" subtitle="계획하고, 기록하고, 다시 나누는 여행" action={<button className="header-action solid" onClick={onCreate} aria-label="새 여행"><Plus size={20} /></button>} />
    <section className="journey-intro"><div><span>PLAN · WRITE · SHARE</span><h2>동선 위에 이야기를 쓰는<br />나만의 여행 가이드</h2></div><Edit3 size={32} /></section>
    {myTrips.length > 0 && <JourneySection title="내 여행과 여행기" description="계획 중인 초안과 내가 발행한 글" journeys={myTrips} onOpen={onOpen} onShare={onShare} />}
    <JourneySection title="다른 여행자의 가이드" description="읽어보고 내 여행으로 복사할 수 있어요" journeys={guideTrips} onOpen={onOpen} onShare={onShare} />
    <button className="primary wide create-trip-button" onClick={onCreate}><Edit3 size={18} />새 여행기 만들기</button>
  </div>;
}

function JourneySection({ title, description, journeys, onOpen, onShare }: { title: string; description: string; journeys: Journey[]; onOpen: (id: string) => void; onShare: (journey: Journey) => void }) {
  return <section className="journey-section"><div className="section-heading"><div><h2>{title}</h2><p>{description}</p></div><span>{journeys.length}</span></div><div className="journey-list">{journeys.map((journey) => <article className="journey-card" key={journey.id}>
    <button className="journey-main" onClick={() => onOpen(journey.id)}><img src={journey.cover} alt="" /><span className={`status-badge status-${journey.status.toLowerCase()}`}>{journey.visibility === 'PUBLIC' ? <Globe2 size={11} /> : <Lock size={11} />}{journey.isMine ? statusLabel[journey.status] : `${journey.author}의 가이드`}</span><span className="journey-gradient" /><span className="journey-copy"><small>{journey.region} · {journey.duration}</small><strong>{journey.title}</strong><em>{journey.summary}</em><span><CalendarDays size={13} />{journey.dateRange}<i />{journeyPlaceCount(journey)}곳</span></span></button>
    <button className="journey-share" onClick={() => onShare(journey)} aria-label={`${journey.title} 공유`}><Share2 size={17} /></button>
  </article>)}</div></section>;
}

function Saved({ places, onRemove, onAdd, onGoDiscover }: { places: Place[]; onRemove: (id: string) => void; onAdd: (place: Place) => void; onGoDiscover: () => void }) {
  return <div className="page"><AppHeader title="저장한 장면" subtitle={`${places.length}개의 국내 랜드마크 영상`} />
    {places.length ? <div className="saved-list">{places.map((place) => <article className="saved-card" key={place.id}><img src={place.image} alt="" /><div className="saved-card-copy"><span>{place.area}</span><h3>{place.name}</h3><p>{place.hook}</p><div><Clock3 size={13} />{place.bestTime}</div><button className="add-to-trip" onClick={() => onAdd(place)}>여행에 담기</button></div><button onClick={() => onRemove(place.id)} aria-label="저장 취소"><Bookmark size={19} fill="currentColor" /></button></article>)}</div> : <div className="empty"><span className="empty-icon"><Bookmark size={28} /></span><h2>아직 저장한 장면이 없습니다</h2><p>국내 랜드마크 영상에서 마음에 드는 곳을 저장하면<br />여행 계획과 일기에 이어 붙일 수 있습니다.</p><button className="outline" onClick={onGoDiscover}><Compass size={17} />영상으로 발견하기</button></div>}
  </div>;
}

function JourneyDetail({ journey, onBack, onShare, onSharePlace, onEdit, onDelete, onCopy }: { journey: Journey; onBack: () => void; onShare: () => void; onSharePlace: (place: Place) => void; onEdit: () => void; onDelete: () => void; onCopy: () => void }) {
  const [selectedDay, setSelectedDay] = useState(journey.days[0]?.day ?? 1);
  const dayHeadingRef = useRef<HTMLElement>(null);
  const day = journey.days.find((item) => item.day === selectedDay) ?? journey.days[0];
  const selectDay = (dayNumber: number) => {
    setSelectedDay(dayNumber);
    window.requestAnimationFrame(() => dayHeadingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  return <div className="journey-detail">
    <header className="detail-topbar"><button onClick={onBack} aria-label="뒤로"><ArrowLeft size={21} /></button><strong>{journey.isMine ? '내 여행기' : '여행 가이드'}</strong><button onClick={journey.isMine ? onEdit : onShare} aria-label={journey.isMine ? '여행기 편집' : '여행 공유'}>{journey.isMine ? <Edit3 size={19} /> : <Share2 size={20} />}</button></header>
    <section className="detail-hero"><img src={journey.cover} alt="" /><div className="detail-hero-shade" /><div className="detail-title"><span>{journey.region} · {journey.duration}</span><h1>{journey.title}</h1><p>{journey.dateRange}</p></div></section>
    <section className="journal-lead"><div className="author-line"><span>{journey.author.slice(0, 1)}</span><div><strong>{journey.author}</strong><small>{journey.visibility === 'PUBLIC' ? '전체 공개 여행일기' : '나만 보는 여행 초안'}</small></div><button onClick={onShare}><Share2 size={16} />공유</button></div>{journey.sourceAuthor && <div className="copied-source"><Copy size={14} />{journey.sourceAuthor}의 여행기를 복사해 만든 내 버전</div>}<p className="summary">{journey.summary}</p><p className="story">{journey.story}</p><div className="guide-facts"><div><small>전체 일정</small><strong>{journey.duration}</strong></div><div><small>기록 장소</small><strong>{journeyPlaceCount(journey)}곳</strong></div><div><small>가이드 구성</small><strong>{journey.days.length}개 DAY</strong></div></div><div className="journal-meta"><span><Eye size={14} />{journey.saves.toLocaleString()}명이 저장</span><span><MapPin size={14} />{journeyPlaceCount(journey)}개 장소</span></div><div className="journal-tags">{journey.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div></section>
    <nav className="day-tabs" aria-label="여행 날짜">{journey.days.map((item) => <button key={item.day} className={selectedDay === item.day ? 'active' : ''} aria-current={selectedDay === item.day ? 'page' : undefined} onClick={() => selectDay(item.day)}><small>DAY {item.day}</small><strong>{item.date}</strong></button>)}</nav>
    {day && <>
      <section className="day-heading" ref={dayHeadingRef}><small>DAY {day.day} · {day.date}</small><h2>{day.title}</h2><p>{day.story}</p></section>
      {day.blocks.length > 0
        ? <article className="guide-story">{day.blocks.map((block) => block.type === 'TEXT'
          ? <section className="story-text-block" key={block.id}>{block.heading && <h3>{block.heading}</h3>}<p>{block.body}</p></section>
          : block.type === 'IMAGE'
            ? block.image && <figure className="story-image-block" key={block.id}><img src={block.image} alt={block.caption || '여행 사진'} />{block.caption && <figcaption>{block.caption}</figcaption>}</figure>
            : <GuidePlaceEmbed key={block.id} place={day.places.find((place) => place.id === block.placeId)} onShare={onSharePlace} />
        )}</article>
        : !day.places.length && <div className="empty-day"><MapPin size={26} /><strong>아직 작성한 이야기가 없습니다</strong><p>글과 사진을 먼저 넣고, 필요한 장소는<br />직접 등록하거나 목록에서 골라보세요.</p></div>}
      {day.places.length > 0 && <section className="day-route-section"><div className="day-route-title"><small>ROUTE MAP</small><h3>이날의 동선 한눈에 보기</h3></div><RouteMap key={`${journey.id}-${day.day}`} places={day.places} /><section className="route-summary"><Route size={17} /><div><strong>이날의 이동 방향</strong><span>{day.places.map((place) => place.name).join(' → ')}</span></div></section></section>}
    </>}
    <footer className={`detail-footer ${journey.isMine ? 'owner-footer' : 'reader-footer'}`}>{journey.isMine
      ? <><button className="delete-journey" onClick={onDelete}><Trash2 size={17} />삭제</button><button onClick={onEdit}><Edit3 size={18} />이 여행기 이어서 쓰기</button></>
      : <><button className="share-small" onClick={onShare} aria-label="여행기 공유"><Share2 size={18} /></button><button onClick={onCopy}><Copy size={18} />이 여행 복사해서 만들기</button></>
    }</footer>
  </div>;
}

function GuidePlaceEmbed({ place, onShare }: { place?: Place; onShare: (place: Place) => void }) {
  if (!place) return null;
  const Icon = kindIcon[place.kind];
  return <aside className="guide-place-embed"><img src={place.image} alt="" /><div className="guide-place-copy"><div className="place-kind"><Icon size={13} />{placeKindLabel[place.kind]}</div><h3>{place.name}</h3><div className="guide-place-time"><Clock3 size={14} />{place.time ? `${place.time} 도착 · ${place.duration} 체류` : place.duration}</div><p>{place.description}</p><blockquote>“{place.note}”</blockquote><div><button onClick={() => openExternal(kakaoDirectionsUrl(place))}><Navigation size={15} />길찾기</button><button onClick={() => onShare(place)}><Share2 size={15} />공유</button></div></div></aside>;
}

function JourneyEditor({ journey, onBack, onSave }: { journey: Journey; onBack: () => void; onSave: (journey: Journey) => void }) {
  const [draft, setDraft] = useState<Journey>(() => structuredClone(journey));
  const [selectedDay, setSelectedDay] = useState(journey.days[0]?.day ?? 1);
  const [pickerKind, setPickerKind] = useState<PlaceKind | null>(null);
  const day = draft.days.find((item) => item.day === selectedDay) ?? draft.days[0];

  const updateDay = (patch: Partial<JourneyDay>) => setDraft((current) => ({
    ...current,
    days: current.days.map((item) => item.day === selectedDay ? { ...item, ...patch } : item),
  }));
  const updateBlock = (id: string, patch: Partial<StoryBlock>) => updateDay({ blocks: day.blocks.map((block) => block.id === id ? { ...block, ...patch } : block) });
  const updatePlace = (id: string, patch: Partial<Place>) => updateDay({ places: day.places.map((place) => place.id === id ? { ...place, ...patch } : place) });
  const moveBlock = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= day.blocks.length) return;
    const blocks = [...day.blocks];
    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
    updateDay({ blocks });
  };
  const removeBlock = (block: StoryBlock) => {
    const blocks = day.blocks.filter((item) => item.id !== block.id);
    const stillUsed = block.placeId && blocks.some((item) => item.placeId === block.placeId);
    updateDay({ blocks, places: stillUsed ? day.places : day.places.filter((place) => place.id !== block.placeId) });
  };
  const addTextBlock = () => updateDay({ blocks: [...day.blocks, { id: `text-${Date.now()}`, type: 'TEXT', heading: '', body: '' }] });
  const addImageBlock = () => updateDay({ blocks: [...day.blocks, { id: `image-${Date.now()}`, type: 'IMAGE', image: '', caption: '' }] });
  const addPlaceBlock = (place: Place) => {
    const exists = day.places.some((item) => item.id === place.id);
    updateDay({
      places: exists ? day.places : [...day.places, { ...place, move: day.places.length ? '이동시간 확인 필요' : '여행 시작' }],
      blocks: [...day.blocks, { id: `place-${place.id}-${Date.now()}`, type: 'PLACE', placeId: place.id }],
    });
    setPickerKind(null);
  };
  const addDay = () => {
    const nextDay = Math.max(0, ...draft.days.map((item) => item.day)) + 1;
    setDraft((current) => ({ ...current, days: [...current.days, { day: nextDay, date: `DAY ${nextDay}`, title: `${nextDay}일차 이야기`, story: '이날의 이동과 기억을 한 문장으로 정리해 보세요.', places: [], blocks: [] }] }));
    setSelectedDay(nextDay);
  };
  const setPublishing = (status: Journey['status']) => setDraft((current) => ({ ...current, status, visibility: status === 'PUBLISHED' ? 'PUBLIC' : 'PRIVATE' }));

  return <div className="journey-editor">
    <header className="editor-topbar"><button onClick={onBack} aria-label="편집 취소"><ArrowLeft size={20} /></button><div><small>{draft.sourceAuthor ? `${draft.sourceAuthor}의 가이드에서 복사됨` : 'TRAVEL JOURNAL EDITOR'}</small><strong>여행기 작성</strong></div><button className="save-editor" onClick={() => onSave(draft)}><Save size={16} />저장</button></header>
    <section className="editor-cover"><img src={draft.cover} alt="" /><div /><span>{draft.region}</span><p>표지 사진</p></section>
    <section className="editor-basics">
      <label><span>여행기 제목</span><input aria-label="여행기 제목" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} /></label>
      <div className="editor-row"><label><span>지역</span><input aria-label="여행 지역" value={draft.region} onChange={(event) => setDraft((current) => ({ ...current, region: event.target.value }))} /></label><label><span>기간</span><input aria-label="여행 기간" value={draft.duration} onChange={(event) => setDraft((current) => ({ ...current, duration: event.target.value }))} /></label></div>
      <label><span>한 줄 소개</span><textarea aria-label="여행기 한 줄 소개" rows={2} value={draft.summary} onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))} /></label>
      <label><span>여행 전체 이야기</span><textarea aria-label="여행 전체 이야기" rows={4} value={draft.story} onChange={(event) => setDraft((current) => ({ ...current, story: event.target.value }))} /></label>
      <label><span>공개 상태</span><select aria-label="공개 상태" value={draft.status} onChange={(event) => setPublishing(event.target.value as Journey['status'])}><option value="PLANNING">비공개 초안</option><option value="TRAVELING">여행 중</option><option value="PUBLISHED">공개 여행일기로 발행</option></select></label>
    </section>

    <nav className="editor-day-tabs" aria-label="작성할 날짜">{draft.days.map((item) => <button key={item.day} className={item.day === selectedDay ? 'active' : ''} onClick={() => setSelectedDay(item.day)}>DAY {item.day}</button>)}<button className="add-day" onClick={addDay}><Plus size={14} />날짜</button></nav>
    {day && <section className="day-editor">
      <div className="day-editor-heading"><small>DAY {day.day}</small><input aria-label="날짜 제목" value={day.title} onChange={(event) => updateDay({ title: event.target.value })} /><textarea aria-label="날짜 소개" rows={2} value={day.story} onChange={(event) => updateDay({ story: event.target.value })} /></div>
      <div className="composer-guide"><Edit3 size={18} /><div><strong>글·사진·장소를 순서대로 엮어보세요</strong><p>여행 사진을 본문 사이에 넣고, 숙소·맛집·카페는 직접 정보를 적거나 준비된 목록에서 고를 수 있습니다.</p></div></div>
      <div className="editor-blocks">{day.blocks.map((block, index) => block.type === 'TEXT'
        ? <article className="editor-text-block" key={block.id}><div className="block-toolbar"><span>글</span><BlockControls index={index} total={day.blocks.length} onMove={moveBlock} onRemove={() => removeBlock(block)} /></div><input aria-label={`글 ${index + 1} 소제목`} value={block.heading ?? ''} onChange={(event) => updateBlock(block.id, { heading: event.target.value })} placeholder="소제목을 입력하세요" /><textarea aria-label={`글 ${index + 1} 본문`} rows={6} value={block.body ?? ''} onChange={(event) => updateBlock(block.id, { body: event.target.value })} placeholder="이 장소에서 무엇을 보고 느꼈는지, 다음 장소로 왜 이동했는지 써보세요." /></article>
        : block.type === 'IMAGE'
          ? <EditorImageBlock key={block.id} block={block} index={index} total={day.blocks.length} onUpdate={(patch) => updateBlock(block.id, patch)} onMove={moveBlock} onRemove={() => removeBlock(block)} />
          : <EditorPlaceBlock key={block.id} block={block} place={day.places.find((place) => place.id === block.placeId)} index={index} total={day.blocks.length} onUpdate={(patch) => block.placeId && updatePlace(block.placeId, patch)} onMove={moveBlock} onRemove={() => removeBlock(block)} />
      )}</div>
      {!day.blocks.length && <div className="empty-composer"><Edit3 size={24} /><strong>첫 장면을 시작해 보세요</strong><p>글, 사진, 장소 카드를 원하는 순서로 추가할 수 있습니다.</p></div>}
      <div className="insert-toolbar"><span>본문에 삽입</span><div><button onClick={addTextBlock}><Edit3 size={16} />글</button><button onClick={addImageBlock}><ImagePlus size={16} />사진</button><button onClick={() => setPickerKind('LANDMARK')}><MapPin size={16} />장소</button><button onClick={() => setPickerKind('STAY')}><Hotel size={16} />숙소</button><button onClick={() => setPickerKind('FOOD')}><Utensils size={16} />맛집</button><button onClick={() => setPickerKind('CAFE')}><Coffee size={16} />카페</button></div></div>
    </section>}
    <footer className="editor-footer"><button onClick={() => onSave(draft)}><Save size={18} />여행기 저장하고 미리보기</button></footer>
    {pickerKind && <PlacePicker kind={pickerKind} region={draft.region} onClose={() => setPickerKind(null)} onSelect={addPlaceBlock} />}
  </div>;
}

function BlockControls({ index, total, onMove, onRemove }: { index: number; total: number; onMove: (index: number, direction: -1 | 1) => void; onRemove: () => void }) {
  return <div className="block-controls"><button disabled={index === 0} onClick={() => onMove(index, -1)} aria-label="위로 이동"><ArrowUp size={14} /></button><button disabled={index === total - 1} onClick={() => onMove(index, 1)} aria-label="아래로 이동"><ArrowDown size={14} /></button><button onClick={onRemove} aria-label="블록 삭제">×</button></div>;
}

function EditorImageBlock({ block, index, total, onUpdate, onMove, onRemove }: { block: StoryBlock; index: number; total: number; onUpdate: (patch: Partial<StoryBlock>) => void; onMove: (index: number, direction: -1 | 1) => void; onRemove: () => void }) {
  const handleImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      onUpdate({ image: await resizeImageFile(file) });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '사진을 불러오지 못했습니다.');
    }
  };
  return <article className="editor-image-block"><div className="block-toolbar"><span><ImagePlus size={13} />사진</span><BlockControls index={index} total={total} onMove={onMove} onRemove={onRemove} /></div>
    <label className={`image-upload ${block.image ? 'has-image' : ''}`}>{block.image ? <img src={block.image} alt="업로드한 여행 사진" /> : <><ImagePlus size={26} /><strong>여행 사진 선택</strong><small>사진은 저장 전에 모바일용으로 줄여집니다.</small></>}<input type="file" accept="image/*" capture="environment" onChange={(event) => void handleImage(event)} /></label>
    <input aria-label={`사진 ${index + 1} 설명`} value={block.caption ?? ''} onChange={(event) => onUpdate({ caption: event.target.value })} placeholder="사진 설명을 적어주세요 (선택)" />
  </article>;
}

function EditorPlaceBlock({ block, place, index, total, onUpdate, onMove, onRemove }: { block: StoryBlock; place?: Place; index: number; total: number; onUpdate: (patch: Partial<Place>) => void; onMove: (index: number, direction: -1 | 1) => void; onRemove: () => void }) {
  if (!place) return null;
  const Icon = kindIcon[place.kind];
  return <article className="editor-place-block"><div className="block-toolbar"><span><Icon size={13} />{placeKindLabel[place.kind]} 카드</span><BlockControls index={index} total={total} onMove={onMove} onRemove={onRemove} /></div><div className="editor-place-preview"><img src={place.image} alt="" /><div><strong>{place.name}</strong><small>{place.address}</small><p>{place.note}</p></div></div><div className="editor-place-fields"><label><span>도착 시각</span><input type="time" value={place.time ?? ''} onChange={(event) => onUpdate({ time: event.target.value })} /></label><label><span>체류 시간</span><input value={place.duration} onChange={(event) => onUpdate({ duration: event.target.value })} placeholder="예: 1시간 20분" /></label><label className="wide-field"><span>이동 메모</span><input value={place.move ?? ''} onChange={(event) => onUpdate({ move: event.target.value })} placeholder="예: 차량 25분" /></label></div></article>;
}

function PlacePicker({ kind, region, onClose, onSelect }: { kind: PlaceKind; region: string; onClose: () => void; onSelect: (place: Place) => void }) {
  const [mode, setMode] = useState<'CUSTOM' | 'CATALOG'>('CUSTOM');
  const [custom, setCustom] = useState({ name: '', area: region, address: '', description: '', note: '', duration: kind === 'STAY' ? '숙박' : '' , image: '' });
  const candidates = placeCatalog.filter((place) => place.kind === kind).sort((a, b) => Number(b.area.includes(region)) - Number(a.area.includes(region)));
  const updateCustom = (key: keyof typeof custom, value: string) => setCustom((current) => ({ ...current, [key]: value }));
  const handleCustomImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      updateCustom('image', await resizeImageFile(file, 1200, 0.8));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '사진을 불러오지 못했습니다.');
    }
  };
  const addCustomPlace = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!custom.name.trim()) return;
    const fallbackImage = candidates[0]?.image ?? discoveryLandmarks[0].image;
    onSelect({
      id: `custom-${kind.toLowerCase()}-${Date.now()}`,
      kind,
      name: custom.name.trim(),
      area: custom.area.trim() || region,
      address: custom.address.trim(),
      lat: Number.NaN,
      lng: Number.NaN,
      image: custom.image || fallbackImage,
      description: custom.description.trim() || '직접 기록한 여행 장소입니다.',
      note: custom.note.trim() || '다녀온 뒤의 경험과 추천 포인트를 더 적어보세요.',
      duration: custom.duration.trim() || (kind === 'STAY' ? '숙박' : '체류 시간 미입력'),
    });
  };
  return <div className="sheet-backdrop"><section className="place-picker"><div className="sheet-handle" /><header><div><small>ADD TO STORY</small><h2>{placeKindLabel[kind]} 삽입</h2></div><button onClick={onClose} aria-label="장소 선택 닫기">×</button></header>
    <div className="place-picker-tabs"><button className={mode === 'CUSTOM' ? 'active' : ''} onClick={() => setMode('CUSTOM')}>직접 등록</button><button className={mode === 'CATALOG' ? 'active' : ''} onClick={() => setMode('CATALOG')}>목록에서 선택</button></div>
    {mode === 'CUSTOM' ? <form className="custom-place-form" onSubmit={addCustomPlace}>
      <p>모든 업체를 미리 등록할 필요 없이, 직접 다녀온 정보를 여행기에 남기세요.</p>
      <label className={`custom-photo-field ${custom.image ? 'has-image' : ''}`}>{custom.image ? <img src={custom.image} alt="등록할 장소" /> : <><ImagePlus size={22} /><span>{placeKindLabel[kind]} 사진 추가</span></>}<input type="file" accept="image/*" capture="environment" onChange={(event) => void handleCustomImage(event)} /></label>
      <label><span>{placeKindLabel[kind]} 이름 *</span><input required value={custom.name} onChange={(event) => updateCustom('name', event.target.value)} placeholder={kind === 'STAY' ? '예: 바다 앞 작은 펜션' : '장소 이름'} /></label>
      <div className="custom-place-row"><label><span>지역</span><input value={custom.area} onChange={(event) => updateCustom('area', event.target.value)} placeholder="예: 부산 해운대" /></label><label><span>{kind === 'STAY' ? '숙박 형태' : '머문 시간'}</span><input value={custom.duration} onChange={(event) => updateCustom('duration', event.target.value)} placeholder={kind === 'STAY' ? '1박' : '약 1시간'} /></label></div>
      <label><span>주소</span><input value={custom.address} onChange={(event) => updateCustom('address', event.target.value)} placeholder="주소를 입력하면 길찾기 검색에 사용합니다" /></label>
      <label><span>정보 소개</span><textarea rows={2} value={custom.description} onChange={(event) => updateCustom('description', event.target.value)} placeholder={kind === 'STAY' ? '객실, 위치, 주변 동선 등 기본 정보를 적어주세요.' : '어떤 곳인지 간단히 소개해 주세요.'} /></label>
      <label><span>내 경험과 추천 포인트</span><textarea rows={3} value={custom.note} onChange={(event) => updateCustom('note', event.target.value)} placeholder={kind === 'STAY' ? '실제로 묵어보니 좋았던 점, 체크인 팁 등을 적어주세요.' : '직접 다녀와서 알게 된 팁을 적어주세요.'} /></label>
      <button className="primary custom-place-submit" type="submit"><Plus size={17} />{placeKindLabel[kind]} 카드 추가</button>
    </form> : <><p>준비된 항목은 빠르게 고르는 보조 목록입니다. 없으면 직접 등록하세요.</p><div className="picker-list">{candidates.map((place) => <button key={place.id} onClick={() => onSelect(place)}><img src={place.image} alt="" /><span><strong>{place.name}</strong><small>{place.area} · {place.address}</small></span><Plus size={17} /></button>)}</div></>}
  </section></div>;
}

function RouteMap({ places }: { places: Place[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mappablePlaces = useMemo(() => places.filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lng)), [places]);
  const estimatedRoute = useMemo(() => makeEstimatedRoute(mappablePlaces), [mappablePlaces]);
  const [routeResult, setRouteResult] = useState<RouteResult>(estimatedRoute);
  const [routeLoading, setRouteLoading] = useState(false);

  useEffect(() => {
    setRouteResult(estimatedRoute);
    if (mappablePlaces.length < 2) {
      setRouteLoading(false);
      return;
    }
    const controller = new AbortController();
    setRouteLoading(true);
    void fetchRoadRoute(mappablePlaces, controller.signal)
      .then((result) => setRouteResult(result))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setRouteResult(estimatedRoute);
      })
      .finally(() => {
        if (!controller.signal.aborted) setRouteLoading(false);
      });
    return () => controller.abort();
  }, [estimatedRoute, mappablePlaces]);

  useEffect(() => {
    if (!containerRef.current || !mappablePlaces.length) return;
    const container = containerRef.current;
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
      instance.addControl(new AttributionControl({ compact: true }), 'bottom-right');
      const bounds = new LngLatBounds();
      routeResult.coordinates.forEach((coordinate) => {
        if (Number.isFinite(coordinate[0]) && Number.isFinite(coordinate[1])) bounds.extend(coordinate);
      });
      mappablePlaces.forEach((place, index) => {
        bounds.extend([place.lng, place.lat]);
        const marker = document.createElement('div');
        marker.className = 'route-marker';
        marker.textContent = String(index + 1);
        marker.title = `${index + 1}. ${place.name}`;
        marker.setAttribute('aria-label', `${index + 1}번 장소 ${place.name}`);
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
    });
    return () => {
      disposed = true;
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      detachOverlayListeners?.();
      routeOverlay?.remove();
      map?.remove();
    };
  }, [mappablePlaces, routeResult]);

  const routeStatus = routeLoading
    ? '도로 경로 계산 중'
    : routeResult.legs.length
      ? `${routeResult.minutes}분 · ${routeResult.distanceKm.toFixed(1)}km`
      : `${places.length}개 장소`;
  const scheduleChecks = routeResult.legs.map(scheduleCheckForLeg).filter((check): check is NonNullable<typeof check> => check !== null);
  const conflictCount = scheduleChecks.filter((check) => check.margin < 0).length;

  return <section className="map-card"><div className="map-label"><MapIcon size={15} /><span>DAY ROUTE</span><strong aria-live="polite">{routeStatus}</strong></div>{mappablePlaces.length ? <div className="route-map" ref={containerRef} /> : <div className="route-map-unavailable"><MapPin size={24} /><strong>주소로 길찾기할 수 있어요</strong><span>지도 좌표 연결은 장소 검색 기능을 붙일 때 자동화됩니다.</span></div>}
    {routeResult.legs.length > 0 && <div className="route-leg-list">{routeResult.legs.map((leg) => {
      const schedule = scheduleCheckForLeg(leg);
      return <div className="route-leg" key={`${leg.from.id}-${leg.to.id}`}><span className="route-leg-icon">{leg.mode === 'WALK' ? <Footprints size={15} /> : <Car size={15} />}</span><div><small>{leg.from.time ?? '--:--'} → {leg.to.time ?? '--:--'} · {leg.mode === 'WALK' ? '도보' : '차량'}</small><strong>{leg.from.name} → {leg.to.name}</strong>{schedule && <span className={`route-leg-schedule ${schedule.margin < 0 ? 'conflict' : 'okay'}`}>{schedule.text}</span>}</div><em>약 {leg.minutes}분<br />{leg.distanceKm.toFixed(1)}km</em></div>;
    })}</div>}
    {routeResult.legs.length > 0 && <div className={`route-schedule-summary ${conflictCount ? 'conflict' : 'okay'}`}><Check size={15} /><span>{scheduleChecks.length === 0 ? '도착 시각과 체류시간을 입력하면 일정 충돌을 확인합니다.' : conflictCount ? `${conflictCount}개 구간의 시간이 부족합니다.` : `시간을 입력한 ${scheduleChecks.length}개 구간 모두 여유가 있습니다.`}</span></div>}
    {routeResult.legs.length > 0 && <p className="route-data-note">{routeResult.source === 'ROAD' ? '도로 경로 기준 예상치입니다. 실시간 교통은 길찾기에서 다시 확인하세요.' : '도로 경로를 불러오지 못해 직선거리 기준으로 계산했습니다.'}</p>}
  </section>;
}

const kindIcon: Record<PlaceKind, LucideIcon> = { LANDMARK: MapPin, STAY: Hotel, FOOD: Utensils, CAFE: Coffee, SHOP: Store };

function PlaceJournalCard({ place, index, onShare }: { place: Place; index: number; onShare: () => void }) {
  const Icon = kindIcon[place.kind];
  return <article className="place-journal-card"><div className="timeline-rail"><span>{index + 1}</span><i /></div><div className="place-card-body"><div className="move-label"><Footprints size={13} />{place.move}</div><img src={place.image} alt="" /><div className="place-card-copy"><div className="place-kind"><Icon size={13} />{placeKindLabel[place.kind]}</div><h3>{place.name}</h3><p className="address">{place.address}</p><p>{place.description}</p><blockquote>{place.note}</blockquote><div className="place-card-actions"><button onClick={() => openExternal(kakaoDirectionsUrl(place))}><Navigation size={15} />길찾기</button><button onClick={onShare}><Share2 size={15} />장소 공유</button></div></div></div></article>;
}

function CreateJourneySheet({ onClose, onCreate }: { onClose: () => void; onCreate: (title: string, region: string) => void }) {
  const [region, setRegion] = useState('제주');
  const [title, setTitle] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onCreate(title.trim() || `${region}에서 남길 새로운 기록`, region);
  };
  return <div className="sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="create-sheet" onSubmit={submit}><div className="sheet-handle" /><div className="sheet-title"><div><small>NEW DOMESTIC TRIP</small><h2>새 여행 만들기</h2></div><button type="button" onClick={onClose} aria-label="닫기">×</button></div><label><span>국내 지역</span><select value={region} onChange={(event) => setRegion(event.target.value)}><option>제주</option><option>서울</option><option>강릉</option><option>부산</option><option>경주</option><option>전주</option></select></label><label><span>여행 제목</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={`${region}에서 남길 새로운 기록`} /></label><p>여행은 여러 개 만들 수 있습니다. 먼저 비공개 초안으로 만들고, 다녀온 뒤 상세 일기와 동선을 공개할 수 있어요.</p><button className="primary wide" type="submit"><Plus size={18} />여행 만들기</button></form></div>;
}

function Profile({ native, journeys }: { native: boolean; journeys: Journey[] }) {
  const mine = journeys.filter((journey) => journey.isMine);
  return <div className="page"><AppHeader title="프로필" subtitle={`${mine.length}개의 여행 · ${mine.filter((journey) => journey.status === 'PUBLISHED').length}개의 공개 일기`} /><div className="profile-card"><div className="avatar"><CircleUserRound size={30} /></div><div><h3>Spotlog 여행자</h3><p>국내 여행을 기록하는 중</p></div><ChevronRight size={20} /></div><div className="profile-stats"><div><strong>{mine.length}</strong><span>내 여행</span></div><div><strong>{mine.filter((journey) => journey.status === 'PUBLISHED').length}</strong><span>공개 일기</span></div><div><strong>{mine.reduce((sum, journey) => sum + journeyPlaceCount(journey), 0)}</strong><span>기록 장소</span></div></div><div className="settings-list"><SettingRow icon={Globe2} label="서비스 화면" value="모바일웹" /><SettingRow icon={MapIcon} label="여행 범위" value="대한민국" /><SettingRow icon={Route} label="지도·길찾기" value="연결됨" active /><SettingRow icon={UserRound} label="실행 환경" value={native ? 'Expo 앱' : '웹 브라우저'} /></div><p className="demo-note">랜드마크 영상은 현재 UI 검증용 데모 소스이며, 숙소·맛집·카페에는 가격과 예약 기능을 표시하지 않습니다.</p></div>;
}

function SettingRow({ icon: Icon, label, value, active = false }: { icon: LucideIcon; label: string; value: string; active?: boolean }) {
  return <div><span className="setting-icon"><Icon size={18} /></span><strong>{label}</strong><span className={active ? 'active-value' : ''}>{value}</span><ChevronRight size={16} /></div>;
}

function AppHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return <header className="app-header"><div><small>{subtitle}</small><h1>{title}</h1></div>{action ?? <button className="header-action" aria-label="검색"><Search size={20} /></button>}</header>;
}
