import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { isTogetherState } from '../src/together/repository.ts';
import { isDiscoverableGroup } from '../src/together/discovery.ts';
import { createStandaloneAppointment, memberAppointments, appointmentRequests, personalPlansForRange } from '../src/community/platformModel.ts';

const place={id:'food',kind:'FOOD',name:'음식점',area:'부산 수영구',address:'주소',lat:35,lng:129,image:'',description:'소개',note:'개인 비밀 메모',duration:'1시간',bookingFixed:true,visitId:'old',anchorVisitId:'private-anchor'};
test('standalone appointment is private, not a discoverable club, and creation does not RSVP',()=>{
 const state=createEmptyState('one','이름');const a=createStandaloneAppointment(state,'one',{title:'금요일 저녁',date:'2026-11-06',startTime:'19:00',placeId:'food'},[place]);
 assert.ok(isTogetherState(state));assert.equal(state.groups[0].spaceType,'ACTIVITY');assert.equal(isDiscoverableGroup(state.groups[0]),false);assert.deepEqual(a.participants,{});
 assert.equal(a.journey.days[0].places[0].note,'');assert.equal(a.journey.days[0].places[0].bookingFixed,false);assert.notEqual(a.journey.days[0].places[0].visitId,'old');assert.equal(a.journey.days[0].places[0].anchorVisitId,undefined);assert.equal(place.note,'개인 비밀 메모');
});
test('invalid dates, missing identities and stale place selections make no state changes',()=>{
 for(const input of [{title:'',date:''},{title:'약속',date:'2026-02-30'},{title:'약속',date:'',startTime:'15:00'},{title:'약속',date:'2026-11-07',placeId:'gone'}]){const state=createEmptyState('one','이름');const before=JSON.stringify(state);assert.throws(()=>createStandaloneAppointment(state,'one',input,[]));assert.equal(JSON.stringify(state),before);}
 assert.throws(()=>createStandaloneAppointment(createEmptyState('one','이름'),'stranger',{title:'약속',date:''}));
});
test('member appointment ranges do not reveal others or promote membership into attendance',()=>{
 const state=createEmptyState('one','이름');state.members.push({id:'two',name:'두번째'});
 const dated=createStandaloneAppointment(state,'one',{title:'다가올 약속',date:'2026-11-07'});const undated=createStandaloneAppointment(state,'one',{title:'날짜 미정',date:''});const past=createStandaloneAppointment(state,'one',{title:'지난 약속',date:'2026-10-30'});
 assert.deepEqual(memberAppointments(state,'two','upcoming','2026-11-03'),[]);assert.deepEqual(memberAppointments(state,'one','upcoming','2026-11-03').map(a=>a.id),[dated.id]);assert.deepEqual(memberAppointments(state,'one','undated','2026-11-03').map(a=>a.id),[undated.id]);assert.deepEqual(memberAppointments(state,'one','past','2026-11-03').map(a=>a.id),[past.id]);
 state.groups[0].memberIds.push('two');assert.equal(appointmentRequests(state,'two','2026-11-03'),1);assert.equal(dated.participants.two,undefined);state.groups[0].blockedMemberIds=['two'];assert.equal(memberAppointments(state,'two','upcoming','2026-11-03').length,0);
});
test('an appointment backing space cannot be published or acquire promotion snapshots',()=>{
 const state=createEmptyState('one','이름');createStandaloneAppointment(state,'one',{title:'개인',date:''});state.groups[0].visibility='PUBLIC';assert.equal(isTogetherState(state),false);state.groups[0].visibility='PRIVATE';state.groups[0].promotionPublished=true;assert.equal(isTogetherState(state),false);
 state.groups[0].promotionPublished=false;state.activities.push({...state.activities[0],id:'second-appointment'});assert.equal(isTogetherState(state),false);
});
test('personal plans remain independent and range by their last calendar day',()=>{
 const plan={id:'p',purpose:'PLAN',isMine:true,days:[{date:'2026-11-02'},{date:'2026-11-04'}]};const before=JSON.stringify(plan);
 assert.equal(personalPlansForRange([plan],'upcoming','2026-11-03').length,1);assert.equal(personalPlansForRange([plan],'past','2026-11-03').length,0);assert.equal(personalPlansForRange([{...plan,trash:{}}],'upcoming','2026-11-03').length,0);assert.equal(JSON.stringify(plan),before);
 const later={...plan,id:'later',days:[{date:'2026-12-01'}]};
 assert.deepEqual(personalPlansForRange([later,plan],'upcoming','2026-11-03').map(p=>p.id),['p','later']);
});
