import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { createStandaloneAppointment } from '../src/community/platformModel.ts';
import { myHubContent, myHubSection } from '../src/community/myHubModel.ts';

const plan=(id,dates,purpose='PLAN')=>({id,title:id,isMine:true,purpose,days:dates.map(date=>({date})),startDate:'',visibility:'PRIVATE'});
test('My groups dated appointments and personal travel chronologically without changing source identity or attendance',()=>{
  const state=createEmptyState('actor','나');
  const later=createStandaloneAppointment(state,'actor',{title:'다음 약속',date:'2026-11-12',startTime:'10:00'});
  const soon=createStandaloneAppointment(state,'actor',{title:'오늘 약속',date:'2026-11-08',startTime:'08:00'});
  const undated=createStandaloneAppointment(state,'actor',{title:'미정',date:''});
  const trip=plan('trip',['2026-11-10','2026-11-11']);
  const before=JSON.stringify({state,trip});
  const content=myHubContent(state,'actor',[trip],[],'2026-11-08');
  assert.deepEqual(content.schedule.map(item=>item.id),[soon.id,'trip',later.id]);
  assert.equal(content.schedule[1].plan,trip);
  assert.equal(content.schedule[0].activity,soon);
  assert.deepEqual(content.undatedActivities.map(item=>item.id),[undated.id]);
  assert.equal(JSON.stringify({state,trip}),before);
  assert.deepEqual(soon.participants,{});
});
test('My never exposes private group schedules to guests, unknown actors, blocked members or archived groups',()=>{
  const state=createEmptyState('actor','나');
  createStandaloneAppointment(state,'actor',{title:'비공개',date:'2026-11-10'});
  for(const userId of ['', 'stranger']) assert.deepEqual(myHubContent(state,userId,[],[],'2026-11-08').schedule,[]);
  state.members=[];
  assert.deepEqual(myHubContent(state,'actor',[],[],'2026-11-08').schedule,[]);
  state.members=[{id:'actor',name:'나'}];
  state.groups[0].blockedMemberIds=['actor'];
  assert.deepEqual(myHubContent(state,'actor',[],[],'2026-11-08').schedule,[]);
  state.groups[0].blockedMemberIds=[];state.groups[0].archived=true;
  assert.deepEqual(myHubContent(state,'actor',[],[],'2026-11-08').schedule,[]);
});
test('device travel and journals stay separate, filter trash and public examples, and do not require joining an account',()=>{
  const state=createEmptyState('','');
  const trip=plan('trip',['2026-11-10']);
  const journal=plan('journal',[],'JOURNAL');
  const legacy=plan('legacy',[]);delete legacy.purpose;
  const hidden={...trip,id:'trash',trash:{deletedAt:'yesterday'}};
  const foreign={...trip,id:'other',isMine:false};
  const content=myHubContent(state,'',[trip,trip,hidden,foreign,journal],[journal,journal,legacy,trip,{...journal,id:'public',isMine:false}],'2026-11-08');
  assert.deepEqual(content.ownPlans.map(item=>item.id),['trip']);
  assert.deepEqual(content.ownJournals.map(item=>item.id),['journal','legacy']);
  assert.deepEqual(content.pastPlans,[]);
  assert.deepEqual(state.members,[]);
});
test('past and cancelled membership activities belong to records and undated drafts remain travel-only',()=>{
  const state=createEmptyState('actor','나');
  const past=createStandaloneAppointment(state,'actor',{title:'지난 약속',date:'2026-11-01'});
  const cancelled=createStandaloneAppointment(state,'actor',{title:'취소',date:'2026-11-20'});cancelled.status='CANCELLED';
  const draft=plan('draft',[]);const old=plan('old',['2026-11-01']);
  const content=myHubContent(state,'actor',[draft,old],[],'2026-11-08');
  assert.deepEqual(content.schedule,[]);
  assert.deepEqual(content.ownPlans.map(item=>item.id),['draft','old']);
  assert.deepEqual(content.pastPlans.map(item=>item.id),['old']);
  assert.deepEqual(new Set(content.pastActivities.map(item=>item.id)),new Set([past.id,cancelled.id]));
});
test('unknown destination sections resolve safely to schedule without changing persisted data',()=>{
  assert.equal(myHubSection('travel'),'travel');assert.equal(myHubSection('records'),'records');
  for(const value of ['appointments','__proto__',null,{},undefined]) assert.equal(myHubSection(value),'schedule');
});
test('schedule sorting uses only real calendar dates and keeps invalid or undated drafts out of upcoming rows',()=>{
  const state=createEmptyState('actor','나');
  const bad=plan('invalid',['2026-02-30']);
  const dated={...plan('dated',['기억해둘 날','2026-02-30','2026-11-11']),startDate:'2026-11-01'};
  const content=myHubContent(state,'actor',[bad,dated],[],'2026-11-08');
  assert.deepEqual(content.schedule.map(item=>[item.id,item.date]),[['dated','2026-11-11']]);
  assert.deepEqual(content.ownPlans.map(item=>item.id),['invalid','dated']);
});
