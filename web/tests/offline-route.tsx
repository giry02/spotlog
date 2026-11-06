// DEV-only fixture: no customer/admin records, credentials or location storage.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { placeCatalog, type Place } from '../src/data';
import RouteMap from '../src/RouteMap';
import { draftPolicies, type PolicyBundle } from '../src/accountPolicies';
import '../src/styles.css';
import '../src/theme.css';

const published: PolicyBundle = { ...structuredClone(draftPolicies), status: 'PUBLISHED', locationEnabled: true, operator: { name: 'GPS 시험 운영자', address: '시험 주소', email: 'qa@example.invalid' }, documents: draftPolicies.documents.map(doc => ({ ...doc, version: 'offline-route-fixture-1', ...(doc.id === 'location' ? { sections: [{ heading: '위치도 전경 조회 시험', paragraphs: ['이 시험 화면의 현재 위치 표시를 위해 위도·경도·정확도·측정 시각을 한 번만 사용. 서버 전송·위치 보관·백그라운드 추적 없음.'] }] } : {}) })) };
const landmark = placeCatalog.find(place => place.id === 'public-busan-jagalchi')!;
const next = placeCatalog.find(place => place.id === 'public-busan-gukje')!;
const route: Place[] = [{ ...landmark, visitId: 'offline-visit-a' }, { ...next, visitId: 'offline-visit-b' }, { ...landmark, visitId: 'offline-visit-unknown', name: '위치 미확인 장소', locationVerified: false }];
function Review() {
  const [approved, setApproved] = useState(new URLSearchParams(location.search).get('policy') === 'published');
  const [offline, setOffline] = useState(true), [otherDay, setOtherDay] = useState(false), [selected, setSelected] = useState<string>();
  return <main className="app-shell"><section className="page"><h1>오프라인 위치도 확인</h1><div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}><button className="outline" onClick={() => setOffline(value => !value)}>{offline ? '온라인 지도 확인' : '저장 위치도 확인'}</button><button className="outline" onClick={() => { setOtherDay(value => !value); setSelected(undefined); }}>다른 DAY 열기</button><button className="outline" onClick={() => setApproved(value => !value)}>{approved ? '초안 약관으로 전환' : '공개 시험 약관으로 전환'}</button></div><p>선택 방문: <span data-testid="selected-visit">{selected ?? '없음'}</span></p></section><RouteMap places={otherDay ? route.slice(1) : route} offline={offline} locationPolicy={approved ? published : draftPolicies} selectedVisitId={selected} onSelectVisit={setSelected}/></main>;
}
if (import.meta.env.DEV) createRoot(document.getElementById('root')!).render(<Review/>);
