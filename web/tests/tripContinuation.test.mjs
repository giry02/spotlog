import test from 'node:test';
import assert from 'node:assert/strict';
import { tripContinuation, RECENT_TRIP_KEY } from '../src/tripContinuation.ts';
import { buildPersonalPlan, addPlanDay, appendPlanLandmark, normalizePlan } from '../src/tripPlan.ts';
import { rememberTravelPosition, setVisitProgress } from '../src/tripProgress.ts';
import { createLocalRepository } from '../src/localRepository.ts';

const spot = id => ({id,kind:'LANDMARK',name:id,area:'부산',address:'검수 주소',lat:35.15,lng:129.1,image:'',description:'검수 자료',note:'',duration:'1시간'});
const setup = () => {
  let plan = addPlanDay(buildPersonalPlan([spot('a'),spot('b')],1,'최근 내 여행','나'));
  return appendPlanLandmark(plan,plan.days[1].dayId,spot('a'));
};
const memory = () => { const records=new Map();return {getItem:key=>records.get(key)??null,setItem:(key,value)=>records.set(key,value)}; };

test('resume never chooses journals, public or trashed records and falls back after removal', () => {
  const plan=setup(),other={...setup(),id:'other'},journal={...plan,id:'journal',purpose:'JOURNAL'},published={...plan,id:'public',visibility:'PUBLIC'},trash={...plan,id:'trash',trash:{deletedAt:'2026-10-12'}};
  assert.equal(tripContinuation([journal,published,trash],null),null);
  assert.equal(tripContinuation([plan,other],'other').journey.id,'other');
  assert.equal(tripContinuation([plan,other],'missing').journey.id,plan.id);
  assert.equal(tripContinuation([],null),null);
});

test('last pending visit is preferred and completed DAY advances to the next actual visit ID', () => {
  let plan=setup();const [first,second]=plan.days[0].places;
  plan=rememberTravelPosition(plan,plan.days[0].dayId,second.visitId);
  assert.equal(tripContinuation([plan],plan.id).place.visitId,second.visitId);
  for(const visit of [first,second])plan=setVisitProgress(plan,plan.days[0].dayId,visit.visitId,'done');
  const before=structuredClone(plan),target=tripContinuation([plan],plan.id);
  assert.equal(target.day.day,2);assert.equal(target.place.id,'a');assert.notEqual(target.place.visitId,first.visitId);
  assert.deepEqual(plan,before);assert.equal(target.complete,false);
});

test('skipped visits are not next destinations and a fully checked itinerary remains viewable', () => {
  let plan=setup();
  for(const day of plan.days)for(const place of day.places)plan=setVisitProgress(plan,day.dayId,place.visitId,place.id==='a'?'skipped':'done');
  const target=tripContinuation([plan],plan.id);
  assert.equal(target.complete,true);assert.equal(target.place,undefined);assert.equal(target.day.day,2);
});

test('candidate drafts remain resumable without automatically confirming alternatives', () => {
  const plan={...setup(),planStage:'DRAFT'};
  const before=structuredClone(plan),target=tripContinuation([plan],plan.id);
  assert.equal(target.needsReview,true);assert.deepEqual(plan,before);
  assert.equal(tripContinuation([{...plan,days:[]}],plan.id),null);
});

test('stale cursors use surviving DAY and stored recent ID survives repository backup validation', () => {
  const plan=normalizePlan({...setup(),travelProgress:{dayId:'removed-day',visitId:'removed-visit',visits:{}}});
  assert.equal(tripContinuation([plan],plan.id).day.day,1);
  const storage=memory(),repository=createLocalRepository(storage);
  assert.equal(repository.setItem(RECENT_TRIP_KEY,JSON.stringify(plan.id)),true);
  assert.equal(createLocalRepository(storage).getItem(RECENT_TRIP_KEY),JSON.stringify(plan.id));
  assert.equal(repository.setItem(RECENT_TRIP_KEY,JSON.stringify({privateNote:'unexpected'})),false);
  assert.equal(repository.getItem(RECENT_TRIP_KEY),JSON.stringify(plan.id));
  assert.ok(repository.exportBackup().includes(RECENT_TRIP_KEY));
});
