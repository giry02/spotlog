import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import * as assistantModel from '../src/placeAssistantModel.ts';
import * as presentation from '../src/placeSearchPresentation.ts';
import * as homeDiscovery from '../src/homeDiscovery.ts';
import * as groupCreation from '../src/together/groupCreation.ts';
import * as groupTaxonomy from '../src/together/groupTaxonomy.ts';
import * as groupJoining from '../src/together/groupJoining.ts';
import * as groupRegions from '../src/together/groupRegions.ts';
import * as creationPlanner from '../src/together/creationPlanner.ts';
import * as discovery from '../src/together/discovery.ts';
import * as tripPlan from '../src/tripPlan.ts';
import * as tripStay from '../src/tripPickerStay.ts';
import * as creationPreview from '../src/together/creationPreview.ts';
import * as quickCreation from '../src/together/quickCreation.ts';
import * as creationAiCandidates from '../src/together/creationAiCandidates.ts';
import { configuredPlanningAiEndpoint } from '../src/planningAiService.ts';
import { interestKindLabels } from '../src/interestCollectionStore.ts';

const require=createRequire(import.meta.url), ts=require('typescript');
const jsx=(type,props)=>({type,props});
const nodes=value=>Array.isArray(value)?value.flatMap(nodes):value&&typeof value==='object'?[value,...nodes(value.props?.children)]:[];
const text=value=>Array.isArray(value)?value.map(text).join(''):value&&typeof value==='object'?text(value.props?.children):typeof value==='string'||typeof value==='number'?String(value):'';
const tick=async()=>{for(let n=0;n<4;n++)await Promise.resolve();};
const place=(id,kind='CAFE')=>({id,kind,name:id,area:'부산 해운대',address:'부산 해운대구',lat:35.16,lng:129.16,image:'',note:'',description:'바다 전망',duration:''});

function fixture(path,exportName,deps,initialProps,endpoint='/api/planning-ai') {
  const states=[], refs=[], effects=[];let stateCursor=0,refCursor=0,effectCursor=0,idCursor=0,props=initialProps,tree,queued=[];
  const react={
    useState(initial){const index=stateCursor++;if(!(index in states))states[index]=typeof initial==='function'?initial():initial;return[states[index],value=>{states[index]=typeof value==='function'?value(states[index]):value;}];},
    useRef(initial){const index=refCursor++;return refs[index]??(refs[index]={current:initial});},useMemo:callback=>callback(),useId:()=>`fixture-${idCursor++}`,
    useEffect(callback,dependencies){const index=effectCursor++,old=effects[index];if(!old||!dependencies||dependencies.some((value,n)=>!Object.is(value,old.dependencies?.[n]))){queued.push(()=>{old?.cleanup?.();effects[index]={dependencies,cleanup:callback()};});}},
    lazy:()=> 'LazyMap',Suspense:'Suspense',
  };
  const dependencies={react,'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'Fragment'},'lucide-react':new Proxy({},{get:(_,name)=>String(name)}),...deps};
  const source=readFileSync(new URL(path,import.meta.url),'utf8').replaceAll('import.meta.env.VITE_PLANNING_AI_ENDPOINT',JSON.stringify(endpoint));
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const module={exports:{}};
  vm.runInNewContext(`(function(require,module,exports){${compiled}\n})`,{AbortController,DOMException,Promise,structuredClone,crypto:globalThis.crypto,requestAnimationFrame:callback=>callback(),cancelAnimationFrame(){},CSS:{escape:value=>value}})(name=>{
    if(name.endsWith('.css'))return{};
    if(!(name in dependencies))throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  },module,module.exports);
  return {
    render(patch={}){props={...props,...patch};stateCursor=refCursor=effectCursor=idCursor=0;tree=module.exports[exportName](props);while(typeof tree?.type==='function')tree=tree.type(tree.props);const pending=queued;queued=[];pending.forEach(run=>run());return tree;},
    find:predicate=>nodes(tree).find(predicate),all:predicate=>nodes(tree).filter(predicate),control:label=>nodes(tree).find(node=>(node.type==='button'||node.type==='Button')&&text(node).trim()===label),
    unmount(){effects.forEach(effect=>effect?.cleanup?.());},
  };
}

function assistantFixture({endpoint='',select=()=>null,scope='trip:first:day1'}={}) {
  const places=[place('바다 카페'),place('동백 식당','FOOD'),{...place('개인 카페'),personal:true}],calls=[];
  const deps={'./BottomSheet':{BottomSheet:'BottomSheet'},'./homeDiscovery':homeDiscovery,'./interestCollectionStore':{interestKindLabels},'./placeAssistantModel':assistantModel,'./placeSearchPresentation':presentation,
    './planningAiService':{configuredPlanningAiEndpoint,requestPlaceAi:async(...args)=>{calls.push(args);return{placeIds:['바다 카페']};}}};
  const props={active:true,inline:true,places,initialRegion:'부산',initialPrompt:'부산 해운대 바다 카페',onClose(){},onOpenPlace(){},selection:{scopeKey:scope,contextLabel:'내 여행 · DAY 1',label:'DAY 1에 담기',onSelect:select}};
  return{app:fixture('../src/PlaceAssistantSheet.tsx','default',deps,props,endpoint),calls,places,props};
}

test('a model request only shows candidates; the current DAY changes only after explicit selection and cannot double-submit',async()=>{
  let finish;const selected=[], pending=new Promise(resolve=>{finish=resolve;});
  const {app,calls}=assistantFixture({endpoint:'/api/planning-ai',select:place=>{selected.push(place.id);return pending;}});
  app.render();await app.find(node=>node.type==='form').props.onSubmit({preventDefault(){}});app.render();
  assert.equal(calls.length,1);assert.deepEqual(calls[0][1].eligiblePlaceIds,['바다 카페']);assert.equal(selected.length,0);
  const action=app.control('DAY 1에 담기');await action.props.onClick();await action.props.onClick();
  assert.deepEqual(selected,['바다 카페']);finish(null);await tick();app.render();
  assert.ok(app.find(node=>node.props?.role==='status'&&/선택을 반영/.test(text(node))));
});

test('catalog fallback stays clearly labelled and failed selection keeps the candidate available for retry',async()=>{
  let attempts=0;const {app,calls}=assistantFixture({select:()=>{attempts++;return '저장 공간 부족';}});
  app.render();assert.ok(app.control('등록 장소로 찾기'));
  await app.find(node=>node.type==='form').props.onSubmit({preventDefault(){}});app.render();
  assert.equal(calls.length,0);assert.ok(app.find(node=>node.type==='small'&&text(node)==='조건에 맞는 등록 장소'));
  app.control('DAY 1에 담기').props.onClick();await tick();app.render();
  assert.equal(attempts,1);assert.equal(app.control('DAY 1에 담기').props.disabled,undefined);
  assert.ok(app.find(node=>node.props?.role==='alert'&&text(node)==='저장 공간 부족'));
});

test('a completed choice from an old scope cannot overwrite the next room feedback and global bookmark actions remain independent',async()=>{
  let finish;const {app,props}=assistantFixture({select:()=>new Promise(resolve=>{finish=resolve;})});
  app.render();await app.find(node=>node.type==='form').props.onSubmit({preventDefault(){}});app.render();
  app.control('DAY 1에 담기').props.onClick();
  app.render({selection:{...props.selection,scopeKey:'trip:second:day2',label:'DAY 2에 담기'}});
  finish('이전 방 오류');await tick();app.render();
  assert.equal(app.find(node=>node.props?.role==='status'&&text(node)==='이전 방 오류'),undefined);
  const saved=[];app.render({selection:undefined,savedIds:[],onToggleSave:id=>saved.push(id)});
  const bookmark=app.find(node=>node.props?.['aria-label']==='바다 카페 보관함에 저장');bookmark.props.onClick();
  assert.deepEqual(saved,['바다 카페']);assert.equal(app.control('DAY 2에 담기'),undefined);
});

test('trip AI selection keeps the exact saved DAY, deduplicates a meal slot and routes a hotel through existing stay review',()=>{
  const cafe=place('바다 카페'),hotel=place('호텔','STAY'),food=place('동백 식당','FOOD'),base=tripPlan.buildPersonalPlan([],3,'내 여행','나');let current=base,adds=0,stays=0;
  const props={journey:current,dayId:base.days[1].dayId,catalog:[cafe,hotel,food],savedPlaces:[],initialMode:'ASSISTANT',onClose(){},onAdd(p,slot){adds++;current=tripPlan.appendPlanPlace(current,base.days[1].dayId,p,slot);return null;},onAddStay(){stays++;return null;}};
  const deps={'./BottomSheet':{BottomSheet:'BottomSheet'},'./candidatePhoto':{},'./tripCandidatePresentation':{candidatePhoto:()=>''},'./publicReview':{usePublicReview:()=>({state:{withdrawnImages:[]}})},'./ui':{Button:'Button',Field:'Field'},'./NearbyBusinessSheet':{StayForm:'StayForm'},'./tripPickerStay':tripStay,'./PlaceAssistantSheet':{__esModule:true,default:'PlaceAssistantSheet'},'./LandmarkGuideCard':{LandmarkGuideCard:'LandmarkGuideCard'},'./community/PublicPlaceFacts':{__esModule:true,default:'PublicPlaceFacts'},'./planningAiAvailability':{planningAiAvailable:true}};
  const app=fixture('../src/TripPlacePicker.tsx','TripPlacePicker',deps,props);app.render();
  const assistant=()=>app.find(node=>node.type==='PlaceAssistantSheet');
  assert.match(assistant().props.selection.scopeKey,new RegExp(base.days[1].dayId));
  assert.equal(assistant().props.selection.onSelect(cafe),null);app.render({journey:current});
  assert.equal(current.days[0].places.length,0);assert.equal(current.days[1].places[0].id,cafe.id);assert.equal(adds,1);
  assistant().props.selection.onSelect(cafe);assert.equal(adds,1);
  const meals=()=>app.find(node=>node.props?.['aria-label']==='추천 음식점 담을 식사 시간');
  assert.ok(meals());
  nodes(meals()).find(node=>node.type==='button'&&text(node)==='저녁').props.onClick();app.render();
  assert.match(assistant().props.selection.actionLabel(food),/저녁/);
  assistant().props.selection.onSelect(food);app.render({journey:current});
  assistant().props.selection.onSelect(food);assert.equal(adds,2);
  assert.equal(current.days[1].places.find(p=>p.id===food.id).planningSlot,'dinner');
  nodes(meals()).find(node=>node.type==='button'&&text(node)==='점심').props.onClick();app.render();
  assert.equal(assistant().props.selection.selectedIds.includes(food.id),false);
  assistant().props.selection.onSelect(food);app.render({journey:current});
  assert.deepEqual(current.days[1].places.filter(p=>p.id===food.id).map(p=>p.planningSlot),['dinner','lunch']);
  assert.equal(adds,3);assert.equal(current.days[0].places.length,0);
  assistant().props.selection.onSelect(hotel);app.render();assert.equal(stays,0);
  assert.ok(app.find(node=>node.type==='StayForm'));assert.equal(current.days[1].places.some(p=>p.kind==='STAY'),false);
  app.control('직접 찾기').props.onClick();app.render();assert.equal(app.find(node=>node.props?.className==='trip-picker-manual').props.hidden,false);
});

function groupFixture({endpoint='/api/planning-ai',response}={}) {
  const calls=[],saved=[];const deps={'./model':{togetherId:()=> 'question'},'./discovery':discovery,'./groupTaxonomy':groupTaxonomy,'./GroupLocalityFields':{__esModule:true,default:'GroupLocalityFields'},'./groupJoining':groupJoining,'./groupCreation':groupCreation,'./creationPlanner':creationPlanner,'./groupRegions':groupRegions,
    '../planningAiService':{configuredPlanningAiEndpoint,requestGroupDraftAi:async(...args)=>{calls.push(args);return response instanceof Promise?await response:response??{name:'AI 산책 모임',introduction:'AI가 제안한 소개',firstActivityIdea:'산책 후 카페에서 이야기하기',joinMode:'APPROVAL'};}}};
  const app=fixture('../src/together/GroupCreationForm.tsx','default',deps,{initial:{kind:'FAMILY',region:'인천',district:'미추홀구',neighborhood:'주안동'},onSubmit:value=>{saved.push(value);return true;}},endpoint);
  return{app,calls,saved};
}

test('a one-line group proposal works without a pretyped name and never creates or changes access until explicit final save',async()=>{
  const {app,calls,saved}=groupFixture();app.render();app.control('한 줄로 AI 모임 초안 받기').props.onClick();app.render();
  app.find(node=>node.props?.['aria-label']==='AI 모임 요청').props.onChange({target:{value:'부산 해운대구에서 주말 산책하는 가족 모임'}});app.render();
  app.control('AI 초안 제안받기').props.onClick();await tick();app.render();
  assert.equal(calls.length,1);assert.match(calls[0][1].region,/부산/);assert.equal(saved.length,0);
  assert.equal(app.find(node=>node.props?.['aria-label']==='모임 이름').props.value,'');
  app.control('이 초안으로 계속').props.onClick();app.render();
  assert.equal(app.find(node=>node.props?.['aria-label']==='모임 이름').props.value,'AI 산책 모임');
  assert.equal(saved.length,0);app.find(node=>node.type==='form').props.onSubmit({preventDefault(){}});await tick();
  assert.equal(saved.length,1);assert.equal(saved[0].kind,'FAMILY');assert.equal(saved[0].joinMode,'DIRECT');
  assert.equal(saved[0].region,'부산');assert.equal(saved[0].neighborhood,'');assert.match(saved[0].introduction,/첫 활동 아이디어 · 일정 미정/);
});

test('typing after a group AI request prevents its late result from replacing the current draft',async()=>{
  let finish;const response=new Promise(resolve=>{finish=resolve;});const {app}=groupFixture({response});app.render();
  app.control('한 줄로 AI 모임 초안 받기').props.onClick();app.render();
  app.find(node=>node.props?.['aria-label']==='AI 모임 요청').props.onChange({target:{value:'주말 산책 모임'}});app.render();app.control('AI 초안 제안받기').props.onClick();
  app.find(node=>node.props?.['aria-label']==='모임 이름').props.onChange({target:{value:'직접 정한 이름'}});app.render();
  finish({name:'늦은 이름',introduction:'늦은 소개'});await tick();app.render();
  assert.equal(app.find(node=>node.props?.['aria-label']==='적용 전 AI 모임 초안'),undefined);
  assert.equal(app.find(node=>node.props?.['aria-label']==='모임 이름').props.value,'직접 정한 이름');
});

test('a town-only AI proposal asks only for its missing parent and keeps the town, name and idea when the person selects it',async()=>{
  const {app,saved}=groupFixture();app.render();app.control('한 줄로 AI 모임 초안 받기').props.onClick();app.render();
  app.find(node=>node.props?.['aria-label']==='AI 모임 요청').props.onChange({target:{value:'인천 주안동에서 주말에 산책하는 모임'}});app.render();
  app.control('AI 초안 제안받기').props.onClick();await tick();app.render();app.control('이 초안으로 계속').props.onClick();app.render();
  const locality=()=>app.find(node=>node.type==='GroupLocalityFields');
  assert.equal(locality().props.region,'인천');assert.equal(locality().props.district,'');assert.equal(locality().props.neighborhood,'주안동');
  assert.equal(app.find(node=>node.props?.className==='group-quick-create__location').props.open,true);
  assert.ok(app.find(node=>node.props?.role==='status'&&/주안동의 시·군·구만 선택/.test(text(node))));
  assert.equal(saved.length,0);
  locality().props.onChange({region:'인천',district:'미추홀구',neighborhood:''});app.render();
  assert.equal(locality().props.neighborhood,'주안동');assert.equal(locality().props.district,'미추홀구');
  assert.equal(app.find(node=>node.props?.['aria-label']==='모임 이름').props.value,'AI 산책 모임');
  app.find(node=>node.type==='form').props.onSubmit({preventDefault(){}});await tick();
  assert.equal(saved.length,1);assert.equal(saved[0].neighborhood,'주안동');assert.equal(saved[0].district,'미추홀구');assert.match(saved[0].introduction,/산책 후 카페/);
  locality().props.onChange({region:'인천',district:'부평구',neighborhood:''});app.render();
  assert.equal(locality().props.neighborhood,'');assert.equal(saved[0].neighborhood,'주안동');
});

test('an unconnected group model does not call a service or pretend a local template is AI',async()=>{
  const {app,calls,saved}=groupFixture({endpoint:''});app.render();
  assert.ok(app.find(node=>text(node)==='AI 제안은 연결 후 사용할 수 있어요.'));
  assert.equal(app.control('한 줄로 AI 모임 초안 받기'),undefined);
  app.find(node=>node.props?.['aria-label']==='모임 이름').props.onChange({target:{value:'직접 정한 이름'}});app.render();
  app.find(node=>node.type==='form').props.onSubmit({preventDefault(){}});app.render();
  app.find(node=>node.type==='form').props.onSubmit({preventDefault(){}});await tick();app.render();
  assert.equal(saved[0].name,'직접 정한 이름');assert.equal(calls.length,0);
  assert.equal(app.find(node=>node.props?.['aria-label']==='적용 전 AI 모임 초안'),undefined);
});

test('a trip AI suggestion preserves the typed title and applies only the chosen days',async()=>{
  const cafe=place('바다 카페'),park=place('해변 공원','LANDMARK'),food=place('동백 식당','FOOD');
  const saved=[];
  const deps={
    '../PhotoPlaceCard':{getPlacePhotos:()=>[]},'../PublicTourismCredit':{PhotoCredit:'PhotoCredit'},
    '../placeDirections':{naverDirectionsUrl:()=>''},'./discovery':discovery,'./creationPlanner':creationPlanner,
    './creationPreview':creationPreview,'./quickCreation':quickCreation,'./creationAiCandidates':creationAiCandidates,
    './GroupLocalityFields':{__esModule:true,default:'GroupLocalityFields'},'./groupRegions':groupRegions,
    '../planningAiService':{
      configuredPlanningAiEndpoint,PLANNING_AI_CANDIDATE_LIMIT:30,
      requestTripDraftAi:async()=>({title:'다른 제목',days:[{day:1,placeIds:[food.id]},{day:2,placeIds:[cafe.id]}]}),
    },
  };
  const initialName='바다를 보러 가고 싶어';
  const app=fixture('../src/together/CreationPlannerPanel.tsx','default',deps,{
    places:[park,food,cafe], initial:{purpose:'TRIP',region:'부산'},initialName,initialPrompt:initialName,
    onReview:(_brief,plan)=>{saved.push(plan);return true;},
  });
  app.render();app.control('AI로 여행 일정 짜기').props.onClick();await tick();app.render();
  const proposal=app.find(node=>node.props?.['aria-label']==='적용 전 AI 제안');
  const choices=nodes(proposal).filter(node=>node.type==='input'&&node.props.type==='checkbox');
  assert.equal(choices[0].props.checked,false,'a populated DAY remains unchecked');
  assert.equal(choices[1].props.checked,true,'an empty DAY can accept the proposal by default');
  app.control('선택한 DAY 적용').props.onClick();app.render();
  app.control('여행 만들기').props.onClick();await tick();app.render();
  assert.equal(saved[0].title,initialName);
  assert.equal(saved[0].days[0].placeIds[0],park.id);
  assert.equal(saved[0].days[1].placeIds[0],cafe.id);
});
