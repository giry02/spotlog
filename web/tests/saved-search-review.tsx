/** DEV-only sample list. Original customer saves/trips are never read or written. */
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import InterestCollections from '../src/InterestCollections';
import InterestPlacesMap from '../src/InterestPlacesMap';
import { placeCatalog, placeKindLabel } from '../src/data';
import '../src/styles.css';
import '../src/theme.css';
import '../src/product-ux-refinement.css';
import '../src/navigation-spacing.css';
const samples = [
  ...placeCatalog.filter(p=>p.area.startsWith('부산')&&p.kind==='FOOD').slice(0,2),
  ...placeCatalog.filter(p=>p.area.startsWith('부산')&&p.kind==='STAY').slice(0,2),
  ...placeCatalog.filter(p=>p.area.startsWith('서울')&&p.kind==='CAFE').slice(0,2),
];
function Review(){
  const [ids,setIds] = useState<string[]|null>(null);
  const [view,setView] = useState('list');
  const visible=ids===null?samples:samples.filter(p=>ids.includes(p.id));
  return <main className="app-shell tab-saved"><section className="content"><div className="page saved-page"><header className="app-header"><div><small>고객 저장 자료와 별도인 확인용 목록</small><h1>관심 장소 검색</h1></div></header><InterestCollections places={samples} viewerId="qa-saved-search-20261029" onAddToTrip={()=>{}} onCreateTrip={()=>{}} onExplore={()=>{}} onVisiblePlaceIdsChange={setIds}/><div className="saved-place-toolbar"><div className="interest-view-toggle" aria-label="관심 장소 보기"><button aria-pressed={view==='list'} onClick={()=>setView('list')}>목록</button><button aria-pressed={view==='map'} onClick={()=>setView('map')}>지도</button></div><span role="status">{visible.length}곳 표시</span></div>{view==='map'?<InterestPlacesMap places={visible} onSelectPlace={()=>{}}/>:<div className="ui-stack">{visible.map(p=><article key={p.id} style={{background:'white',border:'1px solid var(--line)',borderRadius:12,padding:16}}><small>{placeKindLabel[p.kind]} · {p.area}</small><h2 style={{fontSize:16,margin:'8px 0'}}>{p.name}</h2><p style={{fontSize:14,margin:0}}>{p.address}</p></article>)}{!visible.length&&<p>현재 조건에 맞는 장소가 없어요.</p>}</div>}</div></section></main>;
}
if(import.meta.env.DEV)createRoot(document.getElementById('root')!).render(<Review/>);
