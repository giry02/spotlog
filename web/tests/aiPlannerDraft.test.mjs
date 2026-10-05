import test from 'node:test';
import assert from 'node:assert/strict';
import { aiPlannerDraftKey, createAiPlannerDraftStore, isAiPlannerDraft } from '../src/aiPlannerDraft.ts';
import { catalogVersion, defaultPlannerConditions, generatePlannerSample } from '../src/aiPlanner.ts';
import { upsertPlannerBusiness, applyPlannerSelections } from '../src/aiPlannerSelections.ts';

const spot=(id,extra={})=>({id,kind:'LANDMARK',name:id,area:'제주 한림',address:'제주',lat:33.39,lng:126.24,image:'',description:'바다',note:'',duration:'1시간',...extra});
const places=Array.from({length:5},(_,i)=>spot(`spot${i}`));
const food=spot('food',{kind:'FOOD'}),stay=spot('stay',{kind:'STAY'});
const context=(patch={})=>({ownerId:'local-profile',catalog:[...places,food,stay],savedPlaces:places,journeyIds:[],...patch});
const conditions=()=>({...defaultPlannerConditions(),region:'제주',dayCount:3,prompt:'제주에서 2박 3일 바다 여행',startDate:'2026-12-31',companions:'가족'});
function setupDraft(ctx=context()) {
  const c=conditions(),preview=generatePlannerSample({requestId:'draft-1',sourceVersion:catalogVersion(ctx.catalog),language:'ko',selectedPlaceIds:[],dayIds:[],lockedVisitIds:[],conditions:c,catalog:ctx.catalog,savedPlaces:ctx.savedPlaces,author:'나'});
  const first=preview.data.journey.days[0],last=preview.data.journey.days.at(-1);
  return {conditions:c,preview,selectedDay:1,excludedVisits:[last.places[0].visitId],businesses:[{dayId:first.dayId,anchorId:first.places[0].visitId,place:structuredClone(food),nights:1},{dayId:first.dayId,anchorId:first.places[0].visitId,place:structuredClone(stay),nights:2}],businessForm:{dayId:first.dayId,anchorId:first.places[0].visitId,kind:'CAFE',name:'입력 중 카페',address:'제주 주소 입력 중'}};
}
function memory() {
  const values=new Map();
  const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>{values.set(key,value);},removeItem:key=>{values.delete(key);}};
  return {values,storage};
}

test('refresh and a new store instance restore all conditions, preview, DAY, exclusions, businesses and typed registration',()=>{
  const {storage}=memory(),draft=setupDraft(),ctx=context();
  assert.equal(createAiPlannerDraftStore(storage).write(draft,ctx).ok,true);
  const restored=createAiPlannerDraftStore(storage).read(ctx);
  assert.equal(restored.status,'ready');assert.deepEqual(restored.draft,JSON.parse(JSON.stringify(draft)));
  restored.draft.conditions.prompt='변경';assert.equal(createAiPlannerDraftStore(storage).read(ctx).draft.conditions.prompt,draft.conditions.prompt);
});
test('incomplete or invalid form input is retained without pretending it is a valid generated plan',()=>{
  const {storage}=memory(),draft={conditions:{...conditions(),startDate:'2026-02-30',region:'',arrival:'23:00',departure:'01:00'},preview:null,selectedDay:1,excludedVisits:[],businesses:[]};
  assert.equal(createAiPlannerDraftStore(storage).write(draft,context()).ok,true);
  assert.deepEqual(createAiPlannerDraftStore(storage).read(context()).draft,draft);
});
test('out-of-range duration text remains in unfinished inputs while non-finite numbers are rejected',()=>{
  for(const dayCount of [0,-2,9,365]) {const {storage}=memory(),store=createAiPlannerDraftStore(storage),draft={conditions:{...conditions(),dayCount},preview:null,selectedDay:1,excludedVisits:[],businesses:[]};assert.equal(store.write(draft,context()).ok,true);assert.equal(store.read(context()).draft.conditions.dayCount,dayCount);}
  for(const dayCount of [Infinity,NaN,2.5]) assert.equal(isAiPlannerDraft({conditions:{...conditions(),dayCount},preview:null,selectedDay:1,excludedVisits:[],businesses:[]}),false);
});
test('saved-place mode including personal missing-coordinate places survives JSON null conversion',()=>{
  const personal=spot('personal',{personal:true,lat:NaN,lng:NaN}),ctx=context({savedPlaces:[personal]}),c={...conditions(),mode:'saved'};
  const preview=generatePlannerSample({requestId:'saved',sourceVersion:catalogVersion(ctx.savedPlaces),language:'ko',selectedPlaceIds:[],dayIds:[],lockedVisitIds:[],conditions:c,catalog:ctx.catalog,savedPlaces:ctx.savedPlaces,author:'나'});
  const draft={conditions:c,preview,selectedDay:1,excludedVisits:[],businesses:[]},{storage}=memory();
  assert.equal(createAiPlannerDraftStore(storage).write(draft,ctx).ok,true);
  const result=createAiPlannerDraftStore(storage).read(ctx);assert.equal(result.status,'ready');assert.equal(result.draft.preview.data.journey.days[0].places[0].lat,null);
});
test('a removed catalog landmark keeps the old preview and exact selections, but marks regeneration required',()=>{
  const {storage}=memory(),store=createAiPlannerDraftStore(storage),draft=setupDraft();store.write(draft,context());
  const result=store.read(context({catalog:[food,stay]}));
  assert.equal(result.status,'catalog-changed');assert.deepEqual(result.draft,JSON.parse(JSON.stringify(draft)));assert.match(result.message,/다시/);
});
test('a changed business address invalidates the context even though recommendation catalogVersion ignores it',()=>{
  const {storage}=memory(),store=createAiPlannerDraftStore(storage),draft=setupDraft(),ctx=context();store.write(draft,ctx);
  const changed=context({catalog:ctx.catalog.map(p=>p.id==='food'?{...p,address:'바뀐 주소'}:p)});
  assert.equal(catalogVersion(changed.catalog),catalogVersion(ctx.catalog));assert.equal(store.read(changed).status,'catalog-changed');
  assert.equal(store.write(draft,changed).ok,true);assert.equal(createAiPlannerDraftStore(storage).read(changed).status,'catalog-changed','autosave must not erase the original context version');
});
test('regeneration uses a new request id and clears the stale context after it is saved',()=>{
  const {storage}=memory(),store=createAiPlannerDraftStore(storage);store.write(setupDraft(),context());
  const changed=context({catalog:[...places,{...food,address:'새 주소'},stay]}),next=setupDraft(changed);next.preview.requestId='fresh-generation';
  assert.equal(store.write(next,changed).ok,true);assert.equal(createAiPlannerDraftStore(storage).read(changed).status,'ready');
});
test('malformed JSON is retained and protected from automatic writes until explicit reset',()=>{
  const {storage,values}=memory(),key=aiPlannerDraftKey('local-profile');values.set(key,'{broken');const store=createAiPlannerDraftStore(storage);
  assert.equal(store.read(context()).status,'corrupt');assert.equal(store.write(setupDraft(),context()).ok,false);assert.equal(values.get(key),'{broken');
  assert.equal(store.clear('local-profile').ok,true);assert.equal(store.read(context()).status,'empty');assert.equal(store.write(setupDraft(),context()).ok,true);
});
test('unsupported older or newer schemas are protected without invented migrations',()=>{
  for(const schemaVersion of [0,2]) {const {storage,values}=memory(),key=aiPlannerDraftKey('local-profile'),raw=JSON.stringify({schemaVersion,ownerId:'local-profile',draft:setupDraft()});values.set(key,raw);const store=createAiPlannerDraftStore(storage);
    assert.equal(store.read(context()).status,'unsupported');assert.equal(store.write(setupDraft(),context()).ok,false);assert.equal(values.get(key),raw);}
});
test('invalid preview or business references cannot replace the last complete valid snapshot',()=>{
  const mutations=[d=>{d.preview.data.journey.days={};},d=>{d.businesses[0].anchorId='missing';},d=>{d.businesses[1].nights=3;},d=>{d.selectedDay=7;},d=>{d.excludedVisits=['foreign-visit'];},d=>{d.businessForm.dayId='missing';},d=>{d.businesses.push(d.businesses[0]);}];
  for(const mutate of mutations){const {storage,values}=memory(),store=createAiPlannerDraftStore(storage),draft=setupDraft(),key=aiPlannerDraftKey('local-profile');store.write(draft,context());const original=values.get(key),bad=structuredClone(draft);mutate(bad);assert.equal(store.write(bad,context()).ok,false);assert.equal(values.get(key),original);}
});
test('shape errors in photos, conditions, or source envelopes are rejected before recovery UI renders',()=>{
  for(const mutate of [d=>{d.preview.data.journey.days[0].places[0].photos={};},d=>{d.conditions.requiredIds={};},d=>{d.preview.sources={};},d=>{d.businessForm.kind='LANDMARK';},d=>{d.businesses[0].place.address={};}]){const draft=setupDraft();mutate(draft);assert.equal(isAiPlannerDraft(draft),false);}
});
test('an unfinished business form cannot restore under a different selected DAY',()=>{
  const draft=setupDraft();draft.selectedDay=2;assert.equal(isAiPlannerDraft(draft),false);
  draft.businessForm=undefined;assert.equal(isAiPlannerDraft(draft),true);
});
test('quota failure preserves the previous snapshot and does not report success',()=>{
  const {storage,values}=memory(),store=createAiPlannerDraftStore(storage),draft=setupDraft(),key=aiPlannerDraftKey('local-profile');store.write(draft,context());const original=values.get(key);
  storage.setItem=()=>{throw new DOMException('full','QuotaExceededError');};
  const next=structuredClone(draft);next.businessForm.name='새 입력';assert.equal(store.write(next,context()).ok,false);assert.equal(values.get(key),original);assert.equal(store.read(context()).draft.businessForm.name,'입력 중 카페');
});
test('storage access failures return recoverable state rather than crashing or changing user data',()=>{
  const storage={getItem(){throw new Error('denied');},setItem(){throw new Error('denied');},removeItem(){throw new Error('denied');}},store=createAiPlannerDraftStore(storage);
  assert.equal(store.read(context()).status,'unavailable');assert.equal(store.write(setupDraft(),context()).ok,false);assert.equal(store.clear('local-profile').ok,false);
});
test('successful creation suppresses a persisted draft even if clearing it failed',()=>{
  const {storage}=memory(),store=createAiPlannerDraftStore(storage),draft=setupDraft();store.write(draft,context());
  storage.removeItem=()=>{throw new Error('denied');};storage.setItem=()=>{throw new Error('denied');};assert.equal(store.clear('local-profile').ok,false);
  const result=createAiPlannerDraftStore(storage).read(context({journeyIds:[draft.preview.data.journey.id]}));assert.equal(result.status,'completed');assert.equal(result.draft,null);
});
test('clear removes persisted content; empty marker fallback contains no private inputs',()=>{
  const {storage,values}=memory(),store=createAiPlannerDraftStore(storage);store.write(setupDraft(),context());assert.equal(store.clear('local-profile').ok,true);assert.equal(values.size,0);
  store.write(setupDraft(),context());storage.removeItem=()=>{throw new Error('remove unavailable');};assert.equal(store.clear('local-profile').ok,true);
  const raw=values.get(aiPlannerDraftKey('local-profile'));assert.equal(raw.includes('가족'),false);assert.equal(store.read(context()).status,'empty');
});
test('account boundaries isolate reads, writes, and clearing; mismatched owners never restore',()=>{
  const {storage,values}=memory(),store=createAiPlannerDraftStore(storage),a=context(),b=context({ownerId:'other-profile'}),draft=setupDraft();store.write(draft,a);
  assert.equal(store.read(b).status,'empty');store.write(draft,b);store.clear(a.ownerId);assert.equal(store.read(b).status,'ready');
  values.set(aiPlannerDraftKey(a.ownerId),values.get(aiPlannerDraftKey(b.ownerId)));assert.equal(store.read(a).status,'corrupt');assert.equal(store.read(a).draft,null);
});
test('no arbitrary retention period deletes or expires an unfinished draft',()=>{
  const {storage,values}=memory(),store=createAiPlannerDraftStore(storage),key=aiPlannerDraftKey('local-profile');store.write(setupDraft(),context());const envelope=JSON.parse(values.get(key));envelope.updatedAt='2000-01-01T00:00:00Z';values.set(key,JSON.stringify(envelope));assert.equal(store.read(context()).status,'ready');
});
test('split hotel nights retain their original landmark context through refresh',()=>{
  const draft=setupDraft(),journey=draft.preview.data.journey,first=journey.days[0];
  draft.businesses=upsertPlannerBusiness(draft.businesses,journey,{dayId:first.dayId,anchorId:first.places[0].visitId,place:spot('other-stay',{kind:'STAY'}),nights:1});
  const {storage}=memory(),store=createAiPlannerDraftStore(storage);assert.equal(store.write(draft,context()).ok,true);
  const result=createAiPlannerDraftStore(storage).read(context());assert.equal(result.status,'ready');
  const applied=applyPlannerSelections(result.draft.preview.data.journey,result.draft.excludedVisits,result.draft.businesses);
  assert.deepEqual(applied.days.map(day=>day.places.filter(p=>p.kind==='STAY').map(p=>p.id)),[['other-stay'],['stay'],[]]);
});
test('overlapping persisted hotel choices are rejected rather than silently hiding a selection',()=>{
  const draft=setupDraft(),journey=draft.preview.data.journey,day=journey.days[1];draft.businesses.push({dayId:day.dayId,anchorId:day.places[0].visitId,place:spot('other-stay',{kind:'STAY'}),nights:1});assert.equal(isAiPlannerDraft(draft),false);
});
test('legacy landmark-only previews preserve conditions and manual choices but require regeneration',()=>{
  const draft=setupDraft(),journey=draft.preview.data.journey;
  delete draft.preview.data.compositionVersion;delete draft.preview.data.intent;
  journey.days.forEach(day=>{day.places=day.places.filter(p=>p.kind==='LANDMARK');day.places.forEach(p=>delete p.planningSlot);day.blocks=day.blocks.filter(b=>day.places.some(p=>p.visitId===b.visitId));delete day.planningGaps;});
  const {storage}=memory(),store=createAiPlannerDraftStore(storage);assert.equal(store.write(draft,context()).ok,true);
  const result=store.read(context());assert.equal(result.status,'catalog-changed');assert.deepEqual(result.draft,JSON.parse(JSON.stringify(draft)));assert.match(result.message,/새 생성 기준/);
});
test('generated time slots, missing-business context and booked-hotel markers survive refresh',()=>{
  const ctx=context({catalog:places}),c={...conditions(),prompt:'제주 숙소 예약 완료'},preview=generatePlannerSample({requestId:'slots',sourceVersion:catalogVersion(ctx.catalog),language:'ko',selectedPlaceIds:[],dayIds:[],lockedVisitIds:[],conditions:c,catalog:ctx.catalog,savedPlaces:ctx.savedPlaces,author:'나'});
  const draft={conditions:c,preview,selectedDay:1,excludedVisits:[],businesses:[]},{storage}=memory(),store=createAiPlannerDraftStore(storage);assert.equal(store.write(draft,ctx).ok,true);
  const restored=store.read(ctx);assert.equal(restored.status,'ready');assert.deepEqual(restored.draft.preview.data.journey.days,JSON.parse(JSON.stringify(preview.data.journey.days)));assert.ok(restored.draft.preview.data.journey.days[0].planningGaps.some(g=>g.reason==='booked'));
  const bad=structuredClone(draft);bad.preview.data.journey.days[0].planningGaps[0].afterVisitId='deleted-visit';assert.equal(store.write(bad,ctx).ok,false);
});
test('lunch and dinner edits may use the same known business with distinct slot identity',()=>{
  const draft=setupDraft(),first=draft.preview.data.journey.days[0],anchorId=first.places[0].visitId;
  draft.businesses=[{dayId:first.dayId,anchorId,place:{...food,planningSlot:'lunch'},nights:1},{dayId:first.dayId,anchorId,place:{...food,planningSlot:'dinner'},nights:1}];
  draft.businessForm.planningSlot='afternoon';
  const {storage}=memory(),store=createAiPlannerDraftStore(storage);assert.equal(store.write(draft,context()).ok,true);assert.equal(store.read(context()).draft.businesses.length,2);
  const malformed=structuredClone(draft);malformed.businessForm.planningSlot='tomorrow';assert.equal(store.write(malformed,context()).ok,false);
});
