// Development-only entry. No localStorage, user records, or production route.
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LandmarkGuideCard } from '../src/LandmarkGuideCard';
import { AiTravelSheet } from '../src/AiTravelSheet';
import { PhotoLandmarkFeed } from '../src/PhotoLandmarkFeed';
import { buildLocalTravelDraft, type TravelDraftProvider } from '../src/aiTravelDraft';
import { publicTourismPlaces, publicTourismSources } from '../src/publicTourismContent';
import type { Place } from '../src/data';
import '../src/styles.css';

const source = publicTourismPlaces[0];
const photos = Array.from({ length: 5 }, (_, index) => ({ mediaId: `fixture-${index}`, placeId: source.id,
  image: index === 2 ? '/tests/missing-photo-for-qa.jpg' : source.image,
  alt: `검수용 사진 ${index + 1}`, caption: `검수용 캡션 ${index + 1}`,
  sourceId: publicTourismSources.find((entry) => entry.image === source.image)?.id }));
const slowProvider: TravelDraftProvider = { id: 'qa-delayed', generate: (input, places) => new Promise((resolve) => window.setTimeout(() => resolve(buildLocalTravelDraft(input, places)), 1800)) };

function Fixture() {
  const [place, setPlace] = useState<Place>({ ...source, photos });
  const [sheet, setSheet] = useState<'saved' | 'slow' | null>(null);
  const [fail, setFail] = useState(true);
  const [saved, setSaved] = useState(0);
  const [feed, setFeed] = useState(false);
  return <>
    <main className="app-shell"><section className="content"><div className="page">
      <h1>1차 격리 검수</h1><p>실제 사용자 데이터와 연결되지 않은 검수 화면입니다.</p>
      <div className="ui-stack">
        <button onClick={() => setPlace({ ...source, photos: [] })}>사진 0장</button>
        <button onClick={() => setPlace({ ...source, photos: photos.slice(0, 1) })}>사진 1장</button>
        <button onClick={() => setPlace({ ...source, photos })}>사진 5장</button>
        <button onClick={() => setPlace((current) => ({ ...current, photos: [...(current.photos ?? [])].reverse() }))}>사진 순서 뒤집기</button>
        <button onClick={() => setPlace((current) => ({ ...current, photos: current.photos?.filter((photo) => photo.mediaId !== 'fixture-1') }))}>사진 2 회수</button>
        <button onClick={() => setSheet('saved')}>저장 초안 열기</button>
        <button onClick={() => setSheet('slow')}>지연 추천 열기</button>
        <button aria-pressed={fail} onClick={() => setFail((current) => !current)}>저장 실패 {fail ? '켜짐' : '꺼짐'}</button>
        <button onClick={() => setFeed((current) => !current)}>사진 피드 전환</button>
      </div>
      <output aria-label="저장 횟수">저장 횟수 {saved}</output>
      {!feed && <LandmarkGuideCard place={place} actions={null} />}
    </div>{feed && <div style={{ height: 650 }}><PhotoLandmarkFeed places={[place]} savedIds={[]} onToggle={() => {}} onShare={() => {}} /></div>}</section></main>
    {sheet && <AiTravelSheet key={sheet} places={[place]} savedDayCount={sheet === 'saved' ? 7 : undefined} initialPrompt={`${source.area.split(' ')[0]} 2일`} provider={sheet === 'slow' ? slowProvider : undefined}
      onClose={() => setSheet(null)} onCreate={(journey) => { if (fail) return null; setSaved((current) => current + 1); return journey.id; }} />}
  </>;
}

if (import.meta.env.DEV) createRoot(document.getElementById('root')!).render(<StrictMode><Fixture /></StrictMode>);
