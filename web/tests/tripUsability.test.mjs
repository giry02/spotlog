import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPersonalPlan, normalizePlan, addPlanDay, insertNearby, replacePlanBusiness, copyPlanDay, copyPersonalPlan, transferVisit, removePlanDay, removePlanVisit, makeJournalFromPlan, setPlanStay } from '../src/tripPlan.ts';
import { setVisitProgress, visitProgress, rememberTravelPosition, nextPendingInDay, nextPendingDay, tripChangeIdentity } from '../src/tripProgress.ts';
import { makeEstimatedRoute } from '../src/routeData.ts';
import { routeWarnings } from '../src/routeWarnings.ts';
import { createLocalRepository } from '../src/localRepository.ts';
import { answerGuide, guideRequest } from '../src/travelGuide.ts';

const spot=(id,kind='LANDMARK',lng=127.04)=>({id,kind,name:id,area:'서울 성동',address:'검수용 주소',lat:37.54,lng,image:'',description:'검수용',note:'',duration:'1시간'});
const setup=()=>{let trip=addPlanDay(buildPersonalPlan([spot('park'),spot('landmark')],1,'검수','나'));return insertNearby(trip,trip.days[0].dayId,trip.days[0].places[0].visitId,spot('food','FOOD'));};
const mark=(trip,index,status='done')=>setVisitProgress(trip,trip.days[0].dayId,trip.days[0].places[index].visitId,status,new Date('2026-09-30T03:00:00.000Z'));
class Storage {data=new Map();getItem(k){return this.data.get(k)??null;}setItem(k,v){this.data.set(k,v);}}
const key='spotlog.web.journeys.v4';

test('progress is per visit, survives repository reload, and resumes its selected DAY',()=>{
  let trip=setup();trip=transferVisit(trip,trip.days[0].dayId,trip.days[0].places[0].visitId,trip.days[1].dayId,true,false);
  trip=mark(trip,0);assert.equal(visitProgress(trip,trip.days[1].places[0].visitId),'pending');
  trip=rememberTravelPosition(trip,trip.days[1].dayId,trip.days[1].places[0].visitId);
  const store=new Storage(),repository=createLocalRepository(store);assert.equal(repository.setItem(key,JSON.stringify([trip])),true);
  const resumed=normalizePlan(JSON.parse(createLocalRepository(store).getItem(key))[0]);
  assert.equal(resumed.travelProgress.dayId,trip.days[1].dayId);assert.equal(resumed.travelProgress.visitId,trip.days[1].places[0].visitId);
  assert.equal(visitProgress(resumed,trip.days[0].places[0].visitId),'done');
});
test('complete/skip/restore changes no itinerary order, can finish a DAY, and find earlier pending stops',()=>{
  const base=setup();let trip=mark(base,0);trip=mark(trip,1,'skipped');
  assert.equal(nextPendingInDay(trip,trip.days[0]).id,'landmark');
  trip=mark(trip,2);assert.equal(nextPendingInDay(trip,trip.days[0]),undefined);assert.equal(nextPendingDay(trip,trip.days[0].dayId),undefined);
  trip=mark(trip,0,'pending');assert.equal(nextPendingInDay(trip,trip.days[0],trip.days[0].places[2].visitId).id,'park');
  assert.deepEqual(trip.days,base.days);assert.equal(base.travelProgress,undefined);
});
test('copied DAY/visit/trip and journal have no inherited completion; moved visits retain completion',()=>{
  const trip=mark(setup(),0),visit=trip.days[0].places[0].visitId;
  const copied=copyPlanDay(trip,trip.days[0].dayId);assert.equal(visitProgress(copied,copied.days.at(-1).places[0].visitId),'pending');
  const moved=normalizePlan(transferVisit(trip,trip.days[0].dayId,visit,trip.days[1].dayId,false));
  assert.equal(visitProgress(moved,visit),'done');
  assert.equal(copyPersonalPlan(trip,'나').travelProgress,undefined);assert.equal(makeJournalFromPlan(trip,'나').travelProgress,undefined);
  assert.equal(buildPersonalPlan(trip.days[0].places,1,'','나').travelProgress,undefined);
});
test('navigation does not invalidate undo, but subsequent visit progress does',()=>{
  const trip=mark(setup(),0),cursor=rememberTravelPosition(trip,trip.days[1].dayId);
  assert.equal(tripChangeIdentity(trip),tripChangeIdentity(cursor));
  assert.notEqual(tripChangeIdentity(trip),tripChangeIdentity(mark(trip,1)));
});
test('removal prunes progress/cursor and malformed progress never overwrites repository',()=>{
  const trip=mark(setup(),0),removed=normalizePlan(removePlanVisit(trip,trip.days[0].places[0].visitId,true));
  assert.equal(Object.keys(removed.travelProgress.visits).length,0);
  const removedDay=normalizePlan(removePlanDay(trip,trip.days[0].dayId));assert.equal(removedDay.travelProgress.dayId,removedDay.days[0].dayId);
  const repository=createLocalRepository(new Storage());assert.equal(repository.setItem(key,JSON.stringify([trip])),true);
  const before=repository.getItem(key),bad=structuredClone(trip);bad.travelProgress.visits.wrong={status:'done',recordedAt:'bad'};
  assert.equal(repository.setItem(key,JSON.stringify([bad])),false);assert.equal(repository.getItem(key),before);
  assert.throws(()=>setVisitProgress({...trip,isMine:false},trip.days[0].dayId,trip.days[0].places[0].visitId,'done'));
});
test('replace just one business atomically, keep timing/anchor/visit/card identity and clear old private records',()=>{
  const trip=mark(setup(),1),day=trip.days[0],target=day.places[1];target.time='12:30';target.move='도보';target.note='이전 예약 번호';target.planningSlot='lunch';
  const before=structuredClone(trip),candidate={...spot('new-food','FOOD'),note:'다른 장소의 메모',bookingFixed:true,stayDayIds:['other'],image:'/new.jpg',photos:[{image:'/new.jpg',placeId:'new-food',alt:'검수',caption:'검수'}]};
  const next=replacePlanBusiness(trip,day.dayId,target.visitId,candidate),replacement=next.days[0].places[1];
  assert.equal(replacement.id,'new-food');assert.equal(replacement.visitId,target.visitId);assert.equal(replacement.anchorVisitId,target.anchorVisitId);
  assert.equal(replacement.time,'12:30');assert.equal(replacement.move,'도보');assert.equal(replacement.planningSlot,'lunch');assert.equal(replacement.note,'');assert.equal(replacement.bookingFixed,undefined);assert.equal(replacement.stayDayIds,undefined);
  assert.equal(visitProgress(next,target.visitId),'pending');assert.deepEqual(next.days[1],trip.days[1]);assert.deepEqual(next.days[0].places[0],trip.days[0].places[0]);
  assert.equal(next.days[0].blocks[1].id,day.blocks[1].id);assert.equal(next.days[0].blocks[1].placeId,'new-food');assert.deepEqual(trip,before);
});
test('replacement rejects duplicate, wrong kind/region/deleted visit and does not touch a locked stay',()=>{
  const trip=setup(),day=trip.days[0],target=day.places[1],before=structuredClone(trip);
  assert.equal(replacePlanBusiness(trip,day.dayId,target.visitId,target),trip);
  assert.throws(()=>replacePlanBusiness(trip,day.dayId,target.visitId,spot('park','FOOD')),/이미/);
  assert.throws(()=>replacePlanBusiness(trip,day.dayId,target.visitId,spot('cafe','CAFE')),/같은 종류/);
  assert.throws(()=>replacePlanBusiness(trip,day.dayId,target.visitId,{...spot('far','FOOD'),area:'부산'}),/같은 지역/);
  assert.throws(()=>replacePlanBusiness(trip,day.dayId,'missing',spot('new','FOOD')),/바뀌/);
  const booked=setPlanStay(trip,spot('hotel','STAY'),day.dayId,1,true),stay=booked.days[0].places.at(-1);
  assert.throws(()=>replacePlanBusiness(booked,day.dayId,stay.visitId,spot('other','STAY')),/같은 종류/);assert.equal(booked.days[0].places.at(-1).bookingFixed,true);assert.deepEqual(trip,before);
});
test('warnings identify affected visits, stay estimated, and never manufacture a walk conflict or skip missing stops',()=>{
  const trip=setup(),places=trip.days[0].places;places[0].time='10:00';places[1].time='10:15';places[2].time='15:00';
  const warning=routeWarnings(places,makeEstimatedRoute(places))[0];
  assert.equal(warning.code,'ESTIMATED_TIME_CONFLICT');assert.equal(warning.visitId,places[1].visitId);assert.equal(warning.fromVisitId,places[0].visitId);assert.equal(warning.evidence,'estimate');assert.ok(warning.actions.includes('replace-business'));
  const walking=places.map((p,i)=>i===1?{...p,move:'도보'}:p);assert.equal(routeWarnings(walking,makeEstimatedRoute(walking))[0].code,'TRAVEL_TIME_UNVERIFIED');
  const unknown=places.map((p,i)=>i===1?{...p,lat:NaN,locationVerified:false}:p);
  assert.deepEqual(routeWarnings(unknown,makeEstimatedRoute([unknown[0],unknown[2]])).map(w=>w.code),['LOCATION_UNVERIFIED']);
});
test('guide skips completed/skipped visits without hiding their itinerary entries',()=>{
  const base=setup(),trip=mark(base,1,'skipped'),day=trip.days[0];
  const request=guideRequest(trip,day,day.places[0],0,'다음 장소','ko');
  assert.match(answerGuide(request).data.text,/landmark/);assert.doesNotMatch(answerGuide(request).data.text,/food/);
});
