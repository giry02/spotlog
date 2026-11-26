import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import * as tripPlan from '../src/tripPlan.ts';
import * as tripProgress from '../src/tripProgress.ts';
import * as tripDates from '../src/personalTripDates.ts';
import * as tripCandidates from '../src/tripCandidates.ts';
import * as timeline from '../src/plannerTimeline.ts';

const require = createRequire(import.meta.url), ts = require('typescript');
const source = readFileSync(new URL('../src/PersonalTrip.tsx',import.meta.url),'utf8');
const compiled = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const jsx = (type,props)=>({type,props});
function nodes(value) {
  if(Array.isArray(value)) return value.flatMap(nodes);
  if(!value||typeof value!=='object') return [];
  return [value,...nodes(value.props?.children)];
}
function text(value) {
  if(Array.isArray(value)) return value.map(text).join('');
  if(value&&typeof value==='object') return text(value.props?.children);
  return typeof value==='string'||typeof value==='number'?String(value):'';
}
function fixture({populated=false,save=true,planStage='DRAFT',initialDay,rememberedDay,locale='ko',traveling=false}={}) {
  const states=[], saved=[]; let cursor=0, mapCalls=0;
  const place={id:'cafe',kind:'CAFE',name:'선택한 카페',area:'부산',address:'부산',lat:35,lng:129,image:'',note:'',description:'',duration:''};
  let journey={...tripPlan.buildPersonalPlan(populated?[place]:[],rememberedDay || 1,'새 여행','나'),planStage};
  if (rememberedDay) journey=tripProgress.rememberTravelPosition(journey, journey.days[rememberedDay-1].dayId);
  if (traveling) journey={...tripProgress.rememberTravelPosition(journey, journey.days[0].dayId),status:'TRAVELING'};
  const dependencies={
    react:{useState(initial){const index=cursor++;if(!(index in states))states[index]=typeof initial==='function'?initial():initial;return [states[index],value=>{states[index]=typeof value==='function'?value(states[index]):value;}];},useEffect(){}},
    'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'Fragment'},
    'lucide-react':new Proxy({}, {get:(_,name)=>String(name)}),
    './frontendCopy':{useUiCopy:()=>value=>value}, './locale':{useLocale:()=>({locale,t:value=>value})},
    './data':{placeKindLabel:{CAFE:'카페'}}, './tripPlan':tripPlan, './tripProgress':tripProgress,
    './personalTripDates':tripDates, './tripCandidates':tripCandidates, './plannerTimeline':timeline,
    './DayNavigation':{DayNavigation:'DayNavigation'}, './BottomSheet':{BottomSheet:'BottomSheet'},
    './TripCandidateReview':{TripCandidateReview:'TripCandidateReview'}, './TripPlacePicker':{TripPlacePicker:'TripPlacePicker'},
    './PublicTourismCredit':{PhotoCredit:'PhotoCredit'}, './ui':{Button:'Button',Field:'Field'},
    './NearbyBusinessSheet':{NearbyBusinessSheet:'NearbyBusinessSheet',StayForm:'StayForm'},
    './usePlanDragOrder':{usePlanDragOrder:()=>({preview:null})},
    './OfflineTripControl':{useOfflineTrip:()=>({busy:false}),OfflineTripControl:'OfflineTripControl',OfflineTripManagement:'OfflineTripManagement'},
    './GoogleDirectionsButton':{__esModule:true,default:'GoogleDirectionsButton'}, './routeData':{parseDurationMinutes:()=>0},
    './coursePreviewModel':{courseDayFacts:()=>({stayMinutes:0}),courseStayLabel:()=>''},
    './together/creationPreferences':{privatePlanningPreferences:()=>null},
    './planningAiAvailability':{placeSearchActionLabel:'AI로 장소 찾기',planningAiAvailable:true},
  };
  const module={exports:{}};
  vm.runInNewContext(`(function(require,module,exports){${compiled}\n})`,{structuredClone,requestAnimationFrame:callback=>callback(),document:{getElementById:()=>null}})(name=>{
    if(name.endsWith('.css'))return {};
    if(!(name in dependencies))throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  },module,module.exports);
  const props={catalog:[place],savedPlaces:[],onBack(){},onCopy(){},onJournal(){},onSaveBusiness:()=>true,
    onChange(next){if(!save)return false;saved.push(next);journey=next;return true;},renderMap(){mapCalls++;return {type:'map',props:{}};}};
  let tree;
  return {
    render(){cursor=0;tree=module.exports.PersonalTrip({...props,journey,initialDay});return tree;},
    find(predicate){return nodes(tree).find(predicate);}, all(predicate){return nodes(tree).filter(predicate);},
    control(label){return nodes(tree).find(node=>(node.type==='button'||node.type==='Button')&&text(node)===label);},
    get saved(){return saved;},get journey(){return journey;},get mapCalls(){return mapCalls;},
  };
}

test('a saved empty trip has one place action and compact date access without a disabled completion or blank map',()=>{
  const app=fixture();app.render();
  assert.ok(app.find(node=>node.props?.className==='plan-date-action'));
  assert.equal(app.all(node=>node.type==='Button'&&text(node)==='장소 담기').length,1);
  assert.equal(app.control('완료'),undefined);assert.equal(app.mapCalls,0);
  assert.equal(app.saved.length,0);
  app.control('장소 담기').props.onClick();app.render();
  const picker=app.find(node=>node.type==='TripPlacePicker');
  assert.equal(picker.props.journey.id,app.journey.id);
  assert.equal(picker.props.dayId,app.journey.days[0].dayId);
  assert.equal(picker.props.initialKind,'ALL');
  assert.equal(app.saved.length,0);
});

test('date access edits the already-saved trip, creates empty DAYs only on save and permits direct DAY addition',()=>{
  const app=fixture();app.render();const originalId=app.journey.id;
  app.find(node=>node.props?.className==='plan-date-action').props.onClick();app.render();
  const start=()=>app.find(node=>node.type==='input'&&node.props['aria-label']==='출발 날짜');
  const end=()=>app.find(node=>node.type==='input'&&node.props['aria-label']==='마지막 날짜');
  start().props.onInput({currentTarget:{value:'2026-12-01'}});app.render();
  assert.equal(end().props.value,'2026-12-01');assert.equal(app.saved.length,0);
  end().props.onInput({currentTarget:{value:'2026-12-03'}});app.render();
  app.control('날짜 저장').props.onClick();app.render();
  assert.equal(app.journey.id,originalId);assert.equal(app.journey.days.length,3);
  assert.ok(app.journey.days.every(day=>!day.places.length));assert.equal(app.journey.visibility,'PRIVATE');
  assert.equal(app.find(node=>node.type==='BottomSheet'),undefined);
  app.control('DAY 추가').props.onClick();app.render();
  assert.equal(app.journey.days.length,4);assert.equal(app.journey.days.at(-1).date,'2026-12-04');
  assert.equal(app.find(node=>node.type==='DayNavigation').props.selectedDay,4);
});

test('a failed date save retains the date draft, error and original trip rather than claiming success',()=>{
  const app=fixture({save:false});app.render();
  app.find(node=>node.props?.className==='plan-date-action').props.onClick();app.render();
  app.find(node=>node.type==='input'&&node.props['aria-label']==='출발 날짜').props.onInput({currentTarget:{value:'2026-12-01'}});app.render();
  app.control('날짜 저장').props.onClick();app.render();
  assert.equal(app.journey.startDate,undefined);assert.equal(app.journey.days.length,1);assert.equal(app.saved.length,0);
  assert.equal(app.find(node=>node.type==='input'&&node.props['aria-label']==='출발 날짜').props.value,'2026-12-01');
  assert.ok(app.find(node=>node.props?.role==='alert'&&/저장하지 못했어요/.test(text(node))));
});

test('moving a start date keeps the range being edited and clearing it returns to date-undecided without deleting DAYs',()=>{
  const app=fixture();app.render();
  app.find(node=>node.props?.className==='plan-date-action').props.onClick();app.render();
  const input=label=>app.find(node=>node.type==='input'&&node.props['aria-label']===label);
  input('출발 날짜').props.onInput({currentTarget:{value:'2026-12-01'}});app.render();
  input('마지막 날짜').props.onInput({currentTarget:{value:'2026-12-03'}});app.render();
  input('출발 날짜').props.onInput({currentTarget:{value:'2026-12-02'}});app.render();
  assert.equal(input('마지막 날짜').props.value,'2026-12-04');
  app.control('날짜 저장').props.onClick();app.render();
  assert.equal(app.journey.days.length,3);
  const dayIds=app.journey.days.map(day=>day.dayId);
  app.find(node=>node.props?.className==='plan-date-action').props.onClick();app.render();
  input('출발 날짜').props.onInput({currentTarget:{value:''}});app.render();
  assert.equal(input('마지막 날짜').props.value,'');
  app.control('날짜 저장').props.onClick();app.render();
  assert.equal(app.journey.startDate,undefined);
  assert.deepEqual(app.journey.days.map(day=>day.dayId),dayIds);
});

test('a trip with places retains completion, route and existing place editing controls',()=>{
  const app=fixture({populated:true});app.render();
  assert.ok(app.control('완료'));
  assert.ok(app.find(node=>node.props?.className==='plan-view-map-toggle'));
  assert.ok(app.find(node=>node.props?.['aria-label']==='선택한 카페 · 장소 수정'));
});

test('one nearby stop can be added and undone in a finished itinerary without opening candidate review', () => {
test('a completed itinerary has directions to the specific stop from its row and its details',()=>{
  const app=fixture({populated:true,planStage:'READY',locale:'en'});app.render();
  const directions=()=>app.all(node=>node.type==='GoogleDirectionsButton');
  assert.equal(directions().length,1);
  assert.equal(directions()[0].props.iconOnly,true);
  assert.equal(directions()[0].props.en,true);
  assert.equal(directions()[0].props.place.id,'cafe');
  app.find(node=>node.props?.['aria-label']==='선택한 카페 · Place information').props.onClick();app.render();
  assert.equal(directions().length,2);
  assert.equal(directions()[1].props.place.visitId,directions()[0].props.place.visitId);
  assert.equal(app.saved.length,0);
});

test('next-stop directions remember progress on launch and block launch when saving fails',()=>{
  for(const save of [true,false]){
    const app=fixture({populated:true,planStage:'READY',traveling:true,save});app.render();
    const next=app.find(node=>node.type==='GoogleDirectionsButton'&&node.props.beforeLaunch);
    assert.equal(next.props.place.visitId,app.journey.days[0].places[0].visitId);
    assert.equal(app.saved.length,0);
    assert.equal(next.props.beforeLaunch(),save);
    app.render();
    assert.equal(app.saved.length,Number(save));
    assert.equal(app.journey.travelProgress.visitId,save?next.props.place.visitId:undefined);
  }
});

  const app = fixture({ populated: true, planStage: 'READY' });
  app.render();
  const nearbyAction = app.find(node => node.type === 'button' && node.props['aria-label'] === 'nearby');
  assert.equal(text(nearbyAction), '');
  assert.equal(nearbyAction.props['aria-haspopup'], 'dialog');
  nearbyAction.props.onClick();
  app.render();
  const nearby = app.find(node => node.type === 'NearbyBusinessSheet');
  const food = { ...app.journey.days[0].places[0], id: 'food', name: '근처 식당', kind: 'FOOD' };
  assert.equal(nearby.props.onAddDirect(food), null);
  app.render();
  assert.equal(app.find(node => node.type === 'NearbyBusinessSheet'), undefined);
  assert.equal(app.find(node => node.type === 'TripCandidateReview'), undefined);
  assert.equal(app.journey.planStage, 'READY');
  assert.equal(app.journey.days[0].places[1].id, 'food');
  assert.ok(app.control('수정'));
  app.control('마지막 변경 취소').props.onClick();
  app.render();
  assert.equal(app.journey.days[0].places.length, 1);
});

test('an explicit DAY destination takes priority over the previously visited DAY', () => {
  const app = fixture({ populated: true, initialDay: 1, rememberedDay: 2 });
  app.render();
  assert.equal(app.find(node => node.type === 'DayNavigation').props.selectedDay, 1);
  const resumed = fixture({ populated: true, rememberedDay: 2 });
  resumed.render();
  assert.equal(resumed.find(node => node.type === 'DayNavigation').props.selectedDay, 2);
});

test('optional AI discovery opens inside the current saved DAY and explicit application uses the existing save path',()=>{
  const app=fixture();app.render();const id=app.journey.id,dayId=app.journey.days[0].dayId;
  app.control('AI로 장소 찾기').props.onClick();app.render();
  const picker=app.find(node=>node.type==='TripPlacePicker');
  assert.equal(picker.props.initialMode,'ASSISTANT');assert.equal(picker.props.dayId,dayId);assert.equal(app.saved.length,0);
  const cafe={id:'ai-cafe',kind:'CAFE',name:'직접 고른 AI 후보',area:'부산',address:'부산',lat:35,lng:129,image:'',note:'',description:'',duration:''};
  assert.equal(picker.props.onAdd(cafe,'afternoon'),null);app.render();
  assert.equal(app.journey.id,id);assert.equal(app.journey.days[0].dayId,dayId);
  assert.equal(app.journey.days[0].places[0].name,cafe.name);assert.equal(app.journey.visibility,'PRIVATE');
  app.find(node=>node.type==='TripPlacePicker').props.onClose();app.render();
  app.control('장소 담기').props.onClick();app.render();
  assert.equal(app.find(node=>node.type==='TripPlacePicker').props.initialMode,'MANUAL');
});
