// DEV-only fictional catalogue and page memory. No customer storage, location request or live model call.
import { useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Place } from '../src/data';

const params = new URLSearchParams(location.search);
const simulatedModel = params.get('model') === '1';
const initialMode = params.get('mode') === 'modal' ? 'modal' : 'inline';
const changedEvent = 'spotlog:place-discovery-review-network';
let simulatedRequests = 0;

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return { get length() { return values.size; }, key:index => [...values.keys()][index] ?? null,
    getItem:key => values.get(String(key)) ?? null, setItem:(key,value) => { values.set(String(key),String(value)); },
    removeItem:key => { values.delete(String(key)); }, clear:() => { values.clear(); } };
}

const pictures = ['cafe-conversation-20261109.jpg','coastal-walking-20261109.jpg','friends-shared-meal-20261109.jpg'];
const names = [
  '가상 바다정원 커피 · 해운대 바닷길을 천천히 바라보는 긴 이름의 카페',
  '가상 파도 옆 작은 커피집', '가상 달맞이 바다 산책 카페', '가상 송정 모래길 로스터리',
  '가상 광안 바다창가 카페', '가상 영도 파란잔 카페', '가상 기장 해변 카페와 디저트 공방',
  '가상 사진 없는 바다 카페', '가상 좌표 확인 중인 바다 카페',
  '가상 바다 앞 한 끼 · 가족과 식사하기 좋은 긴 이름의 해산물 음식점', '가상 파도 국밥 식당', '가상 바다테라스 브런치 식당',
];
const districts = ['해운대','해운대','해운대','해운대','수영','영도','기장','해운대','해운대','해운대','수영','기장'];
const catalogue: ReadonlyArray<Place> = names.map((name,index) => ({
  id:`qa-place-discovery-${index + 1}`, name, kind:index < 9 ? 'CAFE' : 'FOOD', area:`부산 ${districts[index]}`,
  address:`부산 ${districts[index]} 가상 바닷길 ${index + 1} · 실제 업체 주소 아님`,
  lat:index === 8 ? Number.NaN : 35.159 + index * 0.003, lng:index === 8 ? Number.NaN : 129.159 - index * 0.004,
  image:index === 7 ? '' : `/media/groups/${pictures[index % pictures.length]}`,
  description:index < 9 ? '바다 전망과 커피, 디저트를 비교하는 가상 카페 자료입니다. 영업시간·주차·가격은 검수 데이터에 없습니다.' : '바다 근처에서 점심과 저녁 식사를 비교하는 가상 음식점 자료입니다. 실제 메뉴·가격·예약 정보는 제공하지 않습니다.',
  hook:index === 8 ? '지도 좌표를 확인 중인 가상 장소' : index === 7 ? '사진이 없어도 장소 정보와 저장 버튼을 사용할 수 있어요.' : '바다를 바라보며 잠시 쉬어 가는 가상 장소',
  note:'', duration:index < 9 ? '머무는 시간 미정' : '식사 시간 미정', tags:['바다','가상 자료',index < 9 ? '커피' : '식사'],
}));

function installIsolation() {
  const local = memoryStorage(), session = memoryStorage();
  Object.defineProperty(window,'localStorage',{configurable:true,value:local});
  Object.defineProperty(window,'sessionStorage',{configurable:true,value:session});
  Object.defineProperty(window,'indexedDB',{configurable:true,value:undefined});
  Object.defineProperty(window,'caches',{configurable:true,value:undefined});
  class PageChannel extends EventTarget {
    readonly name:string; onmessage:((event:MessageEvent)=>void)|null = null; onmessageerror:((event:MessageEvent)=>void)|null = null;
    constructor(name:string) { super(); this.name=name; }
    postMessage(_value:unknown) { /* Never reaches another tab. */ }
    close() { /* Page memory only. */ }
  }
  Object.defineProperty(window,'BroadcastChannel',{configurable:true,value:PageChannel});
  if(window.localStorage!==local || window.sessionStorage!==session || window.indexedDB!==undefined || window.caches!==undefined
    || window.BroadcastChannel !== (PageChannel as unknown as typeof BroadcastChannel)) throw new Error('실제 저장소와 분리하지 못해 검수를 시작하지 않았어요.');
  window.addEventListener('storage',event=>event.stopImmediatePropagation(),true);
  const actualFetch = window.fetch.bind(window);
  window.fetch = async (input,init) => {
    const url = new URL(input instanceof Request ? input.url : String(input),location.href);
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const isPlanning = url.origin===location.origin && url.pathname==='/api/planning-ai' && method==='POST';
    if(isPlanning) {
      if(init?.signal?.aborted) throw new DOMException('Cancelled','AbortError');
      simulatedRequests += 1; window.dispatchEvent(new Event(changedEvent));
      if(!simulatedModel) return Response.json({error:'MEMORY_REVIEW_MODEL_DISABLED'},{status:503});
      let body:unknown;
      try { body=JSON.parse(typeof init?.body==='string' ? init.body : input instanceof Request ? await input.clone().text() : 'null'); }
      catch { return Response.json({error:'INVALID_REVIEW_REQUEST'},{status:400}); }
      const request = body as {schemaVersion?:number; feature?:string; requestId?:string; eligiblePlaceIds?:unknown};
      if(request?.schemaVersion!==1 || request.feature!=='PLACE_SEARCH' || typeof request.requestId!=='string' || !Array.isArray(request.eligiblePlaceIds)
        || request.eligiblePlaceIds.some(id=>typeof id!=='string' || !catalogue.some(place=>place.id===id))) return Response.json({error:'INVALID_REVIEW_REQUEST'},{status:400});
      // A labelled deterministic HTTP fixture, not a model result or a popularity/quality score.
      return Response.json({schemaVersion:1,requestId:request.requestId,feature:'PLACE_SEARCH',source:'LLM',status:'READY',
        result:{placeIds:request.eligiblePlaceIds.slice().reverse().slice(0,12)}},{headers:{'Cache-Control':'no-store'}});
    }
    if(url.pathname==='/api' || url.pathname.startsWith('/api/') || !['GET','HEAD'].includes(method)) return Response.json({error:'MEMORY_REVIEW_API_BLOCKED'},{status:503});
    return actualFetch(input,init);
  };
  document.body.dataset.qaStorage='memory-only'; document.body.dataset.qaNetwork=simulatedModel ? 'deterministic-place-response' : 'no-api-or-write';
}

async function boot() {
  if(!import.meta.env.DEV) { document.getElementById('root')!.textContent='개발 환경에서만 확인할 수 있어요.'; return; }
  installIsolation();
  const [{default:PlaceAssistantSheet},{BottomSheet}] = await Promise.all([import('../src/PlaceAssistantSheet'),import('../src/BottomSheet')]);
  await import('../src/styles.css'); await import('../src/theme.css'); await import('../src/product-ux-refinement.css');
  await import('../src/navigation-spacing.css'); await import('../src/consumer-density.css');

  function Review() {
    const [mode,setMode] = useState<'inline'|'modal'>(initialMode), [active,setActive] = useState(true);
    const [detail,setDetail] = useState<Place|null>(null), [saved,setSaved] = useState<string[]>([]);
    const [status,setStatus] = useState(''), [requests,setRequests] = useState(simulatedRequests);
    useEffect(()=>{const refresh=()=>setRequests(simulatedRequests); window.addEventListener(changedEvent,refresh); return()=>window.removeEventListener(changedEvent,refresh);},[]);
    const toggle=(id:string)=>{setSaved(current=>current.includes(id) ? current.filter(value=>value!==id) : [...current,id]); setStatus('이 페이지 메모리의 보관함만 바꿨어요.');};
    return <><details className="place-discovery-review__tools"><summary>장소 찾기 검수 · 실제 계정과 분리</summary>
      <p>가상 장소 12곳으로 실제 장소 찾기 화면을 확인합니다. 카페 9곳·음식점 3곳이며 사진 없는 곳과 좌표 미정 장소를 포함합니다. 저장은 새로고침하면 초기화됩니다.</p>
      <p>{simulatedModel ? 'AI 응답은 정해진 가상 ID 순서를 반환하는 검수용 HTTP 응답입니다. 실제 모델을 호출하지 않습니다.' : 'AI 요청을 차단합니다. 연결 오류 후 ‘등록 장소로 찾기’를 누르면 실제 등록 장소 검색 흐름을 확인할 수 있습니다.'}</p>
      <nav className="place-discovery-review__controls" aria-label="장소 찾기 검수 방식"><button type="button" aria-pressed={mode==='inline'} onClick={()=>{setMode('inline');setActive(true);}}>화면 안에 보기</button><button type="button" aria-pressed={mode==='modal'} onClick={()=>{setMode('modal');setActive(true);}}>바텀시트로 보기</button><button type="button" onClick={()=>setActive(true)}>검색 다시 열기</button><a href={`?model=${simulatedModel ? '0' : '1'}&mode=${mode}`}>{simulatedModel ? '등록 검색 검수' : '가상 AI 응답 검수'}</a></nav>
      <p role="status">저장 {saved.length}곳 · 가상 API 요청 {requests}회{status ? ` · ${status}` : ''}</p>
      <p>기본 문장 ‘부산 바다 카페’에서는 카페를, ‘부산 바다’에서는 두 종류를 함께 비교합니다. 상세를 열고 닫아도 검색 결과를 유지하는지 확인하세요.</p>
    </details><div className="place-discovery-review__app"><main className="app-shell detail-open"><section className="content"><section className="place-assistant-page"><h1>AI로 장소 찾기</h1>
      {!active && <button type="button" className="outline" onClick={()=>setActive(true)}>장소 찾기 열기</button>}
      <PlaceAssistantSheet active={active && !detail} inline={mode==='inline'} places={catalogue} initialRegion="부산" initialPrompt="부산 바다 카페" savedIds={saved} onToggleSave={toggle} onOpenPlace={setDetail} onClose={()=>setActive(false)}/>
    </section></section></main></div>
    {detail && <BottomSheet title={detail.name} onClose={()=>setDetail(null)}><section className="place-discovery-review__detail">{detail.image ? <img src={detail.image} alt="가상 장소 사진"/> : <p>이 가상 장소에는 사진이 없습니다.</p>}<p>{detail.description}</p><p>{detail.address}</p><p>{Number.isFinite(detail.lat) && Number.isFinite(detail.lng) ? `좌표 ${detail.lat.toFixed(3)}, ${detail.lng.toFixed(3)}` : '지도 좌표 확인 중'}</p><button type="button" onClick={()=>toggle(detail.id)}>{saved.includes(detail.id) ? '가상 보관함에서 빼기' : '가상 보관함에 저장'}</button><button type="button" onClick={()=>setDetail(null)}>장소 상세 닫기</button></section></BottomSheet>}
    </>;
  }
  const root=(import.meta.hot?.data.placeDiscoveryReviewRoot as Root|undefined) ?? createRoot(document.getElementById('root')!);
  if(import.meta.hot) import.meta.hot.dispose(data=>{data.placeDiscoveryReviewRoot=root;});
  root.render(<Review/>);
}

void boot().catch(error=>{document.getElementById('root')!.textContent=error instanceof Error ? error.message : '장소 찾기 검수 화면을 열지 못했어요.';});
