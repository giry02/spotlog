import {places,monitors,restaurants,getPlace,getMonitor,getRestaurant,won,type Domain} from './connected-data';

export type UnitId='similarity'|'mood'|'nearby'|'map'|'route'|'products'|'comparison'|'price';
export type SharedState={domain:Domain;revision:number;anchorId:string;selectedPlaceId:string|null;selectedRestaurantId:string|null;selectedMonitorId:string|null;compareIds:string[];placeRegion:'all'|'제주'|'서울';walkMinutes:number;cuisine:'전체'|'한식'|'양식'|'카페';foodBudget:number|null;quiet:boolean;maxPrice:number;gaming:boolean;eyeComfort:boolean;nearby:boolean;showMap:boolean;showComparison:boolean;question:string;notice:string;lastAction:string;focus:UnitId|null;};
export type Binding={id:UnitId;title:string;input:string;output:string;resourceId:string;reason:string;variant:'full'|'compact';rank:number};
export type Resources={placeIds:string[];restaurantIds:string[];monitorIds:string[];placeResultId:string;restaurantResultId:string;monitorResultId:string;};
export type Workspace={state:SharedState;resources:Resources;units:Binding[];explanation:string;decisionMode:'demo'|'jev';narrationMode:'sample'|'llm';decisionMs?:number;notice?:string;};
export type Action={type:'message';message:string}|{type:'select-place';id:string}|{type:'nearby-place';id:string}|{type:'select-restaurant';id:string}|{type:'walk';minutes:number}|{type:'cuisine';value:SharedState['cuisine']}|{type:'price';value:number}|{type:'priority';key:'gaming'|'eyeComfort';value:boolean}|{type:'compare';id:string}|{type:'use-anchor';id:string}|{type:'region';value:SharedState['placeRegion']}|{type:'map';value:boolean}|{type:'food-budget';value:number|null}|{type:'quiet';value:boolean}|{type:'clear-food-filters'};
export const registry:{id:UnitId;title:string;input:string;output:string;purpose:string}[]=[
 {id:'similarity',title:'비슷한 장소',input:'기준 장소 · 분위기 · 지역',output:'선택한 장소 ID',purpose:'Choose places similar to the reference. Keep compact when nearby restaurants are the current task.'},
 {id:'mood',title:'분위기 비교',input:'기준 장소 · 후보 특성',output:'유사점과 차이점',purpose:'Compare the reference place atmosphere with selected or ranked candidates.'},
 {id:'nearby',title:'주변 맛집',input:'선택 장소 · 도보 범위 · 음식 조건',output:'선택한 식당 ID',purpose:'Search restaurants near the selected place. Must share the same result resource as the map.'},
 {id:'map',title:'주변 지도',input:'식당 검색 결과 · 선택 장소',output:'선택한 식당 ID',purpose:'Plot the same restaurant results as the list; clicking a pin selects a restaurant.'},
 {id:'route',title:'이동과 메뉴',input:'선택 장소 · 선택 식당',output:'도보 시간 · 메뉴 · 비용',purpose:'Show the route and menu of the selected restaurant only.'},
 {id:'products',title:'비슷한 모니터',input:'기준 제품 · 예산 · 우선순위',output:'비교할 제품 ID',purpose:'Rank similar monitor candidates with gaming and eye-comfort feature priorities.'},
 {id:'comparison',title:'직접 비교',input:'비교 제품 ID · 중요 항목',output:'스펙 차이',purpose:'Compare selected products against the reference, emphasizing requested criteria.'},
 {id:'price',title:'예산과 조건',input:'제품 검색 조건',output:'예산 · 게임 · 눈 편의 조건',purpose:'Interactive controls that update product results and comparison together.'},
];
export function initialShared(domain:Domain='places'):SharedState{return {domain,revision:0,anchorId:domain==='places'?'osulloc':'view27',selectedPlaceId:null,selectedRestaurantId:null,selectedMonitorId:null,compareIds:domain==='monitors'?['play27']:[],placeRegion:'all',walkMinutes:15,cuisine:'전체',foodBudget:null,quiet:false,maxPrice:450000,gaming:false,eyeComfort:false,nearby:false,showMap:true,showComparison:domain==='monitors',question:domain==='places'?'여기랑 분위기가 비슷한 다른 장소가 있을까?':'이 모니터랑 비슷한 제품이 있을까?',notice:'',lastAction:'대화로 시작',focus:null};}
export function getResources(s:SharedState):Resources{
 const placeAnchor=getPlace(s.domain==='places'?s.anchorId:'osulloc');
 const placeIds=places.filter(p=>p.id!==placeAnchor.id&&(s.placeRegion==='all'||p.region===s.placeRegion)).sort((a,b)=>{const delta=(p:typeof a)=>p.mood.reduce((n,v,i)=>n+Math.abs(v-placeAnchor.mood[i]),0);return delta(a)-delta(b);}).map(p=>p.id);
 const restaurantIds=s.nearby&&s.selectedPlaceId?restaurants.filter(r=>r.placeId===s.selectedPlaceId&&r.walk<=s.walkMinutes&&(s.cuisine==='전체'||r.cuisine===s.cuisine)&&(!s.foodBudget||r.price<=s.foodBudget)&&(!s.quiet||r.quiet)).sort((a,b)=>a.walk-b.walk).map(r=>r.id):[];
 const anchor=getMonitor(s.domain==='monitors'?s.anchorId:'view27');
 const productScore=(p:typeof anchor)=>(p.size===anchor.size?40:0)+(p.resolution===anchor.resolution?40:0)+(s.gaming?p.hz/3:0)+(s.eyeComfort?(Number(p.flickerFree)+Number(p.lowBlue)+Number(p.ergonomic))*15:0)-p.price/100000;
 const monitorIds=monitors.filter(p=>p.id!==anchor.id&&p.price<=s.maxPrice).sort((a,b)=>productScore(b)-productScore(a)).map(p=>p.id);
 return {placeIds,restaurantIds,monitorIds,placeResultId:`places:${s.anchorId}:${s.placeRegion}`,restaurantResultId:`nearby:${s.selectedPlaceId}:${s.walkMinutes}:${s.cuisine}:${s.foodBudget}:${s.quiet}`,monitorResultId:`monitors:${s.anchorId}:${s.maxPrice}:${s.gaming}:${s.eyeComfort}`};
}
export function bindUnits(s:SharedState,r:Resources,scores?:Partial<Record<UnitId,number>>):Binding[]{
 const active:Partial<Record<UnitId,[number,string,string]>>=s.domain==='places'?{similarity:[s.nearby?25:90,r.placeResultId,s.nearby?'장소를 바꿔도 주변 기능이 함께 따라가요.':'기준 장소의 분위기를 유지하며 후보를 찾아요.'],mood:[s.nearby?0:65,r.placeResultId,'유사한 점과 다른 점을 같은 기준으로 비교해요.'],nearby:[s.nearby?95:0,r.restaurantResultId,'선택 장소를 기준으로 같은 검색 결과를 공유해요.'],map:[s.nearby&&s.showMap?80:0,r.restaurantResultId,'식당 목록과 같은 결과를 지도에 표시해요.'],route:[s.selectedRestaurantId?100:0,r.restaurantResultId,'지도와 목록에서 고른 같은 식당의 상세예요.']}:{products:[90,r.monitorResultId,'예산과 우선순위를 함께 적용한 후보예요.'],comparison:[s.showComparison?85:0,'compare:'+s.anchorId+':'+s.compareIds.join(','),'선택한 제품을 유지하고 비교 항목을 바꿔요.'],price:[75,r.monitorResultId,'조절한 조건이 제품 목록과 비교에 함께 반영돼요.']};
 return registry.filter(d=>(active[d.id]?.[0]??0)>0).map(d=>{const [rank,resourceId,reason]=active[d.id]!;return {...d,rank:rank+(s.focus===d.id?25:0)+(scores?.[d.id]??0)*3,resourceId,reason,variant:s.nearby&&d.id==='similarity'?'compact' as const:'full' as const};}).sort((a,b)=>b.rank-a.rank);
}
export function explain(s:SharedState,r:Resources):string{
 if(s.notice)return s.notice;
 if(s.domain==='places'){
  const anchor=getPlace(s.anchorId);if(s.selectedRestaurantId){const x=getRestaurant(s.selectedRestaurantId);return `${getPlace(s.selectedPlaceId!).name}에서 도보 ${x.walk}분인 ${x.name}을 골랐어요. ${x.menu} 가격은 ${won(x.price)}이고, 목록과 지도에서 같은 장소가 선택됐어요.`;}
  if(s.nearby&&s.selectedPlaceId){const selected=getPlace(s.selectedPlaceId);return r.restaurantIds.length?`${selected.name}을 기준으로 도보 ${s.walkMinutes}분 안의 ${s.cuisine==='전체'?'식당':s.cuisine} ${r.restaurantIds.length}곳을 찾았어요. 범위를 바꾸면 아래 목록과 지도도 함께 바뀝니다.`:`${selected.name} 주변에서 도보 ${s.walkMinutes}분 · ${s.cuisine}${s.foodBudget?' · '+won(s.foodBudget)+' 이하':''}${s.quiet?' · 조용한 곳':''} 조건에 맞는 결과가 없어요. 아래에서 적용한 조건을 풀어보세요.`;}
  if(s.selectedPlaceId){const picked=getPlace(s.selectedPlaceId);return `${picked.name}을 선택했어요. 분위기 비교도 이 장소를 기준 장소와 나란히 보여줍니다. 이어서 ‘거기 근처 맛집은?’이라고 물어보세요.`;}
  const first=getPlace(r.placeIds[0]);return first?`${anchor.name}의 분위기를 기준으로 ${first.name}부터 살펴보세요. 아래 예시에서는 초록 풍경·차분함·산책을 비교했고, 지역은 ${s.placeRegion==='all'?'제한하지 않았어요':s.placeRegion+'로 좁혔어요'}.`:'선택한 지역에 비교할 다른 장소가 없어요. 지역 범위를 넓혀보세요.';
 }
 const first=getMonitor(r.monitorIds[0]);return first?`${getMonitor(s.anchorId).name}을 기준으로 ${won(s.maxPrice)} 이하 ${r.monitorIds.length}개를 찾았어요. ${first.name}은 ${first.size}인치 ${first.resolution} · ${first.hz}Hz예요.${s.gaming?' 게임을 고려해 주사율 비중을 높였어요.':''}${s.eyeComfort?' 플리커프리·로우블루 모드·높이 조절을 비교에 꺼냈어요.':''}`:'지금 예산에 맞는 제품이 없어요. 기준 제품과 비교 선택은 유지했으니 예산을 조금 높여보세요.';
}
export function workspace(s:SharedState,scores?:Partial<Record<UnitId,number>>):Workspace{const resources=getResources(s);return {state:s,resources,units:bindUnits(s,resources,scores),explanation:explain(s,resources),decisionMode:'demo',narrationMode:'sample'};}
function normalizeQuestion(raw:string){return raw.replace(/\d{1,3}(?:,\d{3})+/g,x=>x.replaceAll(',','')).replace(/상관\s+없/g,'상관없').replace(/\s+/g,' ').trim();}
export function reduceShared(previous:SharedState,action:Action):SharedState{
 let s:SharedState={...previous,compareIds:[...previous.compareIds],revision:previous.revision+1,notice:'',focus:null};
 const priorResults=getResources(previous);
 const compareMonitor=(id:string,toggle=false)=>{if(!monitors.some(p=>p.id===id)||id===s.anchorId)return;const exists=s.compareIds.includes(id);if(exists&&toggle){s.compareIds=s.compareIds.filter(x=>x!==id);if(s.selectedMonitorId===id)s.selectedMonitorId=s.compareIds.at(-1)??null;}else if(!exists&&s.compareIds.length>=2){s.notice='비교는 기준 제품과 후보 2개까지 가능해요. 하나를 해제한 뒤 선택해 주세요.';return;}else{if(!exists)s.compareIds.push(id);s.selectedMonitorId=id;}s.showComparison=true;s.focus='comparison';};
 const selectPlace=(id:string,nearby=false)=>{if(!places.some(p=>p.id===id)){s.notice='장소를 다시 선택해 주세요.';return;}s.selectedPlaceId=id;s.selectedRestaurantId=null;if(nearby)s.nearby=true;};
 if(action.type==='select-place'||action.type==='nearby-place'){selectPlace(action.id,action.type==='nearby-place');s.lastAction=`${getPlace(action.id)?.name??'장소'} 선택`;s.question=`${getPlace(action.id)?.name??'이 장소'}${action.type==='nearby-place'?' 근처 맛집은?':' 선택'}`;}
 else if(action.type==='select-restaurant'){if(priorResults.restaurantIds.includes(action.id)){s.selectedRestaurantId=action.id;s.lastAction='식당 선택 → 지도·이동 정보 연결';s.question=`${getRestaurant(action.id).name}으로 갈래`;}else s.notice='현재 범위의 식당을 선택해 주세요.';}
 else if(action.type==='walk'){s.walkMinutes=Math.max(1,Math.min(20,action.minutes));s.lastAction='도보 범위 → 목록·지도 갱신';s.question=`도보 ${s.walkMinutes}분 안에서만 보여줘`;s.focus='nearby';}
 else if(action.type==='cuisine'){s.cuisine=action.value;s.lastAction='음식 종류 → 목록·지도 갱신';s.question=`${action.value==='전체'?'모든 음식 종류':action.value+'만'} 보여줘`;}
 else if(action.type==='price'){s.maxPrice=Math.max(100000,Math.min(500000,action.value));s.lastAction='예산 → 후보·비교 조건 갱신';s.question=`${won(s.maxPrice)} 이하로 보여줘`;s.focus='price';}
 else if(action.type==='priority'){s[action.key]=action.value;s.lastAction='우선순위 → 추천 순서·비교 항목 갱신';s.question=`${action.key==='gaming'?'게임 성능':'눈 편의 기능'}${action.value?'도 중요해':'은 상관없어'}`;s.focus='comparison';}
 else if(action.type==='compare'){compareMonitor(action.id,true);s.lastAction=s.notice?'비교 선택 유지':'선택한 제품 → 비교표 갱신';s.question=`${getMonitor(action.id)?.name??'제품'} 비교 선택`;}
 else if(action.type==='region'){s.placeRegion=action.value;s.lastAction='비슷한 장소의 지역 범위 갱신';s.question=`${action.value==='all'?'지역 제한 없이':action.value+'에서만'} 비슷한 장소 보여줘`;}
 else if(action.type==='food-budget'){s.foodBudget=action.value;s.lastAction='식당 예산 조건 변경';s.question=action.value?`음식은 ${won(action.value)} 이하로`:'음식 가격은 상관없어';}
 else if(action.type==='quiet'){s.quiet=action.value;s.lastAction='분위기 조건 변경';s.question=action.value?'조용한 식당으로':'식당 분위기는 상관없어';}
 else if(action.type==='clear-food-filters'){s.walkMinutes=20;s.cuisine='전체';s.foodBudget=null;s.quiet=false;s.lastAction='식당 조건 전체 해제 · 장소는 유지';s.question='이 장소 주변에서 조건을 풀고 다시 보여줘';}
 else if(action.type==='map'){s.showMap=action.value;s.lastAction=action.value?'지도 표시':'지도 접기';}
 else if(action.type==='use-anchor'){const valid=s.domain==='places'?places.some(p=>p.id===action.id):monitors.some(p=>p.id===action.id);if(valid){s.anchorId=action.id;s.selectedRestaurantId=null;s.selectedPlaceId=null;s.selectedMonitorId=null;s.nearby=false;s.compareIds=[];s.lastAction='선택한 대상을 새로운 비교 기준으로';s.question='이걸 기준으로 비슷한 다른 후보를 보여줘';}}
 else if(action.type==='message'){
  const q=normalizeQuestion(action.message);s.question=q;s.lastAction='대화 → 공유 조건 갱신';let recognized=false;
  const ordinal=q.match(/(첫\s*번째|두\s*번째|세\s*번째|네\s*번째|[1-4]\s*번(?:째)?)/);const index=ordinal?(/첫|1/.test(ordinal[1])?0:/두|2/.test(ordinal[1])?1:/세|3/.test(ordinal[1])?2:3):null;
  const compound=q.match(/(\d+(?:\.\d+)?)\s*만\s*(?:(\d+(?:\.\d+)?)\s*천\s*)?(?:(\d+)\s*)?원/);
  const amount=q.match(/(\d+(?:\.\d+)?)\s*(천\s*원|원)/);const price=compound?Number(compound[1])*10000+Number(compound[2]??0)*1000+Number(compound[3]??0):amount?Number(amount[1])*(amount[2].includes('천')?1000:1):null;
  if(price!==null&&(!Number.isFinite(price)||price<=0||price>10000000)){s.notice='금액은 0원 초과 1천만원 이하로 입력해 주세요.';return s;}
  if(s.domain==='places'){
   if(/제주(만|에서| 안)|제주로/.test(q)){s.placeRegion='제주';recognized=true;}else if(/서울(만|에서| 안)|서울로/.test(q)){s.placeRegion='서울';recognized=true;}else if(/지역.{0,5}(제한 없|상관없)|전국|다른 지역/.test(q)){s.placeRegion='all';recognized=true;}
   const named=places.find(p=>q.includes(p.name));
   if(named){selectPlace(named.id);recognized=true;}
   const namedFood=restaurants.find(x=>q.includes(x.name));if(namedFood){if(priorResults.restaurantIds.includes(namedFood.id)){s.selectedRestaurantId=namedFood.id;recognized=true;}else{s.notice='현재 조건에 보이는 식당을 선택해 주세요.';return s;}}
   if(index!==null){const isRestaurant=s.nearby&&!/(장소|풍경|분위기|근처|주변)/.test(q);const ids=isRestaurant?priorResults.restaurantIds:priorResults.placeIds;if(ids[index]){if(isRestaurant)s.selectedRestaurantId=ids[index];else selectPlace(ids[index]);recognized=true;}else{s.notice='그 순서의 후보는 없어요. 화면에 보이는 후보를 선택해 주세요.';return s;}}
   if(/근처|주변|맛집|식당|밥|먹을/.test(q)){if(!s.selectedPlaceId){if(/여기/.test(q))selectPlace(s.anchorId);else{s.notice='어느 장소 주변을 볼까요? 아래 장소에서 하나를 선택해 주세요.';return s;}}s.nearby=true;s.focus='nearby';recognized=true;}
   const minutes=q.match(/(?:도보|걸어서|걷기)\s*(\d+)\s*분|(\d+)\s*분\s*(안|이내)/);if(minutes){s.walkMinutes=Math.max(1,Math.min(20,Number(minutes[1]??minutes[2])));recognized=true;}
   if(/한식/.test(q)&&!/한식\s*(말고|빼고|제외)/.test(q)){s.cuisine='한식';recognized=true;}else if(/양식|파스타/.test(q)&&!/(양식|파스타)\s*(말고|빼고|제외)/.test(q)){s.cuisine='양식';recognized=true;}else if(/카페|커피/.test(q)&&!/(카페|커피)\s*(말고|빼고|제외)/.test(q)){s.cuisine='카페';recognized=true;}else if(/종류.{0,5}(상관없|전체)|아무거나|전체 음식/.test(q)){s.cuisine='전체';recognized=true;}
   if(price&&s.nearby){s.foodBudget=price;recognized=true;}if(/음식.{0,5}예산.{0,5}(없|상관)|가격 상관없/.test(q)){s.foodBudget=null;recognized=true;}
   if(/조용한|차분한/.test(q)&&s.nearby){s.quiet=true;recognized=true;}if(/조용.{0,5}상관없/.test(q)){s.quiet=false;recognized=true;}
   if(/지도/.test(q)){s.showMap=!/지도.{0,5}(빼|말고|숨겨|없어도)/.test(q);recognized=true;}
   if(/(여기|이곳|거기).{0,8}(기준|비슷)/.test(q)&&s.selectedPlaceId){s.anchorId=s.selectedPlaceId;s.selectedPlaceId=null;s.selectedRestaurantId=null;s.nearby=false;recognized=true;}
   if(/분위기|비슷|유사/.test(q))recognized=true;
  }else{
   const named=monitors.find(p=>q.toLowerCase().includes(p.name.toLowerCase()));if(named){if(/비교|선택|골라/.test(q))compareMonitor(named.id);else s.selectedMonitorId=named.id;recognized=true;}
   if(index!==null){if(priorResults.monitorIds[index]){compareMonitor(priorResults.monitorIds[index]);recognized=true;}else{s.notice='그 순서의 제품은 없어요. 현재 후보에서 선택해 주세요.';return s;}}
   if(price){s.maxPrice=Math.max(100000,Math.min(500000,price));s.focus='price';recognized=true;}
   if(/예산.{0,6}(제한 없|상관없)|가격 상관없/.test(q)){s.maxPrice=500000;recognized=true;}
   if(/게임|주사율/.test(q)){s.gaming=!/(게임|주사율).{0,12}(상관없|필요 없|빼|안 해|말고)/.test(q);recognized=true;}
   if(/눈|플리커|블루라이트|편의/.test(q)){s.eyeComfort=!/(눈|편의).{0,12}(상관없|필요 없|빼)/.test(q);recognized=true;}
   if(/비교|차이|게임|눈/.test(q)){s.showComparison=true;s.focus='comparison';recognized=true;}
   if(/(이거|이걸|그 제품).{0,8}(기준|비슷)/.test(q)&&s.selectedMonitorId){s.anchorId=s.selectedMonitorId;s.selectedMonitorId=null;s.compareIds=[];recognized=true;}
   if(/비슷|유사|모니터/.test(q))recognized=true;
  }
  if(!recognized)s.notice='이 표현은 체험 모드에서 이해하지 못했어요. 후보를 선택하거나, 장소·도보 범위·예산·비교 조건을 구체적으로 알려주세요.';
 }
 const next=getResources(s);if(s.selectedRestaurantId&&!next.restaurantIds.includes(s.selectedRestaurantId)){s.selectedRestaurantId=null;s.lastAction+=' · 조건 밖 식당 선택 해제';}
 return s;
}
