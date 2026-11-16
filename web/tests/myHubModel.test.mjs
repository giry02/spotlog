import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { createStandaloneAppointment } from '../src/community/platformModel.ts';
import { myHubContent, myHubGroups, myHubOwnGroupRecords, myHubOwnRecordFeed, resolveMyOwnRecordDestination, myHubSection } from '../src/community/myHubModel.ts';

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
  assert.equal(myHubSection('groups'),'groups');assert.equal(myHubSection('travel'),'travel');assert.equal(myHubSection('records'),'records');
  for(const value of ['appointments','__proto__',null,{},undefined]) assert.equal(myHubSection(value),'schedule');
});

const group=(id,extra={})=>({id,name:id,kind:'FAMILY',region:'부산',introduction:'',cover:'',visibility:'PRIVATE',ownerId:'actor',memberIds:['actor'],managerIds:[],archived:false,promotionPublished:false,...extra});
const at=new Date('2026-11-09T12:00:00+09:00');
test('My memberships reuse the current directory and never expose removed accounts, blocked, former or archived groups',()=>{
  const state=createEmptyState('actor','나');
  state.groups=[group('family'),group('friends',{kind:'FRIENDS'}),group('hobby',{kind:'HOBBY',visibility:'PUBLIC',promotionPublished:true}),
    group('blocked',{blockedMemberIds:['actor']}),group('archived',{archived:true}),group('former',{memberIds:['other']}),group('one-off',{spaceType:'ACTIVITY'})];
  const before=JSON.stringify(state);
  const result=myHubGroups(state,'actor',at);
  assert.deepEqual(result.groups.map(item=>item.group.id),['family','friends','hobby']);
  assert.deepEqual(result.counts,{ALL:3,FAMILY:1,FRIENDS:1,HOBBY:1,GUIDE:0});
  assert.equal(result.groups[0].group,state.groups[0]);
  assert.equal(JSON.stringify(state),before);
  for(const id of ['', 'unknown']) assert.deepEqual(myHubGroups(state,id,at).groups,[]);
  state.members=[];
  assert.deepEqual(myHubGroups(state,'actor',at).groups,[]);
  assert.equal(myHubGroups(state,'actor',at).pendingApplicationCount,0);
});
test('My application status counts only the current actor’s pending available group once without treating it as membership',()=>{
  const state=createEmptyState('actor','나');
  state.groups=[group('public',{memberIds:['other'],visibility:'PUBLIC',promotionPublished:true}),
    group('private',{memberIds:['other']}),group('ended',{memberIds:['other'],visibility:'PUBLIC',promotionPublished:false}),
    group('blocked',{memberIds:['other'],visibility:'PUBLIC',promotionPublished:true,blockedMemberIds:['actor']}),group('joined')];
  state.applications=[['a','public','actor','PENDING'],['duplicate','public','actor','PENDING'],['other','public','other','PENDING'],
    ['done','public','actor','APPROVED'],['private','private','actor','PENDING'],['ended','ended','actor','PENDING'],
    ['blocked','blocked','actor','PENDING'],['joined','joined','actor','PENDING'],['removed','removed','actor','PENDING']]
    .map(([id,groupId,userId,status])=>({id,groupId,userId,status}));
  const before=JSON.stringify(state),result=myHubGroups(state,'actor',at);
  assert.equal(result.pendingApplicationCount,1);
  assert.deepEqual(result.groups.map(item=>item.group.id),['joined']);
  assert.equal(JSON.stringify(state),before);
  assert.equal(myHubGroups(state,'unknown',at).pendingApplicationCount,0);
});
test('schedule sorting uses only real calendar dates and keeps invalid or undated drafts out of upcoming rows',()=>{
  const state=createEmptyState('actor','나');
  const bad=plan('invalid',['2026-02-30']);
  const dated={...plan('dated',['기억해둘 날','2026-02-30','2026-11-11']),startDate:'2026-11-01'};
  const content=myHubContent(state,'actor',[bad,dated],[],'2026-11-08');
  assert.deepEqual(content.schedule.map(item=>[item.id,item.date]),[['dated','2026-11-11']]);
  assert.deepEqual(content.ownPlans.map(item=>item.id),['invalid','dated']);
});

const recordPost=(id,groupId,authorId='actor',extra={})=>({id,groupId,authorId,title:id,body:'공유한 본문',category:'FREE',createdAt:'2026-11-09T10:00:00+09:00',likes:[],comments:[],...extra});
const recordActivity=(id,groupId,extra={})=>({id,groupId,title:id,date:'2026-11-08',endDate:'',meetingPoint:'',description:'',status:'COMPLETED',leadId:'actor',editorIds:[],participants:{actor:'JOINED'},arrivedIds:[],revision:1,...extra});

test('own group record entries keep exact group and activity scopes and count only the current author',()=>{
  const state=createEmptyState('actor','나');state.members.push({id:'other',name:'다른 사람'});
  state.groups=[group('family',{memberIds:['actor','other']}),group('friends')];
  state.activities=[recordActivity('outing','family'),recordActivity('empty-activity','family'),recordActivity('friend-outing','friends')];
  state.posts=[recordPost('group-post','family'),recordPost('outing-post','family','actor',{activityId:'outing',attachments:[{id:'photo',url:'/safe-photo.webp',caption:''},{id:'bad',url:'javascript:bad',caption:''}]}),
    recordPost('other-post','family','other',{activityId:'outing',comments:[{id:'own-comment',authorId:'actor',body:'내 댓글',createdAt:'2026-11-09T10:00:00+09:00'}]}),recordPost('friend-post','friends','actor',{activityId:'friend-outing'})];
  state.media=[{id:'album',groupId:'family',activityId:'outing',authorId:'actor',kind:'PHOTO',url:'/album.webp',caption:'',createdAt:'2026-11-09T10:00:00+09:00'}];
  state.sharedJournals=[{id:'journal',groupId:'family',activityId:'outing',authorId:'actor',journey:plan('journal',[],'JOURNAL')}];
  state.sharedJournals[0].journey.status='PUBLISHED';
  const before=JSON.stringify(state),result=myHubOwnGroupRecords(state,'actor',at);
  const family=result.find(item=>item.groupId==='family');
  assert.deepEqual(family.scopes.map(scope=>[scope.activityId,scope.counts]),[
    [undefined,{journals:0,media:0,posts:1,comments:0}],['outing',{journals:1,media:2,posts:1,comments:1}]]);
  assert.equal(family.hasRecords,true);assert.equal(family.scopes[1].title,'outing');
  assert.deepEqual(result.find(item=>item.groupId==='friends').scopes.map(scope=>[scope.activityId,scope.counts.posts]),[[undefined,0],['friend-outing',1]]);
  assert.equal(JSON.stringify(result).includes('공유한 본문'),false);
  assert.equal(JSON.stringify(result).includes('내 댓글'),false);
  assert.equal(JSON.stringify(state),before);
});

test('own record directory excludes inaccessible memberships and unknown actors even when stale records remain',()=>{
  const state=createEmptyState('actor','나');
  state.groups=[group('joined'),group('blocked',{blockedMemberIds:['actor']}),group('former',{memberIds:['other']}),group('archived',{archived:true}),group('one-off',{spaceType:'ACTIVITY'})];
  state.posts=state.groups.map(item=>recordPost(`post-${item.id}`,item.id));
  const before=JSON.stringify(state);
  assert.deepEqual(myHubOwnGroupRecords(state,'actor',at).map(item=>item.groupId),['joined']);
  for(const id of ['', 'unknown']) assert.deepEqual(myHubOwnGroupRecords(state,id,at),[]);
  state.members=[];assert.deepEqual(myHubOwnGroupRecords(state,'actor',at),[]);
  state.members=[{id:'actor',name:'나'}];assert.equal(JSON.stringify(state),before);
});

test('empty shared scope stays visibly empty instead of treating participation or another member content as own records',()=>{
  const state=createEmptyState('actor','나');state.members.push({id:'other',name:'다른 사람'});
  state.groups=[group('family',{memberIds:['actor','other']})];state.activities=[recordActivity('joined-only','family')];
  state.posts=[recordPost('other-post','family','other')];
  const result=myHubOwnGroupRecords(state,'actor',at);
  assert.equal(result[0].hasRecords,false);
  assert.deepEqual(result[0].scopes,[{title:'모임 전체',counts:{journals:0,media:0,posts:0,comments:0},hasRecords:false}]);
});

test('incomplete or trashed journal shares do not make an activity appear to contain completed own records',()=>{
  const state=createEmptyState('actor','나');state.groups=[group('family')];state.activities=[recordActivity('outing','family')];
  state.sharedJournals=[{id:'draft',groupId:'family',activityId:'outing',authorId:'actor',journey:{...plan('draft',[],'JOURNAL'),status:'PLANNING'}},
    {id:'trash',groupId:'family',activityId:'outing',authorId:'actor',journey:{...plan('trash',[],'JOURNAL'),status:'PUBLISHED',trash:{deletedAt:'2026-11-09'}}}];
  const result=myHubOwnGroupRecords(state,'actor',at);
  assert.equal(result[0].hasRecords,false);assert.equal(result[0].scopes.length,1);
});

test('own content feed starts from actual authored records and safe photos, not empty memberships or participation',()=>{
  const state=createEmptyState('actor','나');state.members.push({id:'other',name:'다른 사람'});
  state.groups=[group('family',{memberIds:['actor','other']}),group('empty')];
  state.activities=[recordActivity('outing','family'),recordActivity('participation-only','empty')];
  state.posts=[recordPost('my-post','family','actor',{activityId:'outing',createdAt:'2026-11-09T10:00:00+09:00',attachments:[{id:'safe',url:'/my-photo.webp',caption:'내 사진'},{id:'bad',url:'javascript:alert(1)',caption:'잘못된 사진'}]}),
    recordPost('their-post','family','other',{activityId:'outing',comments:[{id:'my-comment',authorId:'actor',body:'내가 남긴 댓글',createdAt:'2026-11-09T11:00:00+09:00'}]})];
  state.media=[{id:'my-media',groupId:'family',activityId:'outing',authorId:'actor',kind:'PHOTO',url:'/album.webp',caption:'사진첩',createdAt:'2026-11-09T12:00:00+09:00'},
    {id:'their-media',groupId:'family',activityId:'outing',authorId:'other',kind:'PHOTO',url:'/theirs.webp',caption:'다른 사람 사진',createdAt:'2026-11-09T13:00:00+09:00'}];
  state.sharedJournals=[{id:'shared',groupId:'family',activityId:'outing',authorId:'actor',journey:{...plan('journal',[],'JOURNAL'),status:'PUBLISHED',summary:'공유한 요약'}}];
  const before=JSON.stringify(state),feed=myHubOwnRecordFeed(state,'actor',at);
  assert.deepEqual(feed.map(item=>item.key),['media:my-media','comment:their-post:my-comment','post:my-post','journal:shared']);
  assert.deepEqual(feed.flatMap(item=>item.photos.map(photo=>photo.url)),['/album.webp','/my-photo.webp']);
  assert.equal(feed.some(item=>item.groupId==='empty'),false);
  assert.equal(feed.find(item=>item.type==='COMMENT').id,'their-post');
  assert.equal(feed.find(item=>item.type==='COMMENT').commentId,'my-comment');
  assert.equal(feed.find(item=>item.type==='JOURNAL').createdAt,'');
  assert.ok(feed.every(item=>item.activityId==='outing'));
  assert.equal(JSON.stringify(state),before);
});

test('own record original links recheck author, exact scope and current access without changing state',()=>{
  const state=createEmptyState('actor','나');state.groups=[group('family')];state.activities=[recordActivity('outing','family')];
  state.posts=[recordPost('post','family','actor',{activityId:'outing'})];
  const target={groupId:'family',activityId:'outing',type:'POST',id:'post'};
  assert.equal(resolveMyOwnRecordDestination(state,'actor',target)?.tab,'posts');
  assert.equal(resolveMyOwnRecordDestination(state,'actor',{...target,activityId:undefined}),null);
  for(const actor of ['', 'unknown'])assert.equal(resolveMyOwnRecordDestination(state,actor,target),null);
  state.posts[0].authorId='other';assert.equal(resolveMyOwnRecordDestination(state,'actor',target),null);
  state.posts[0].authorId='actor';state.groups[0].blockedMemberIds=['actor'];assert.equal(resolveMyOwnRecordDestination(state,'actor',target),null);
  state.groups[0].blockedMemberIds=[];state.posts=[];assert.equal(resolveMyOwnRecordDestination(state,'actor',target),null);
});

test('own collection keeps inactive scopes and unrelated records out of the content projection',()=>{
  const state=createEmptyState('actor','나');state.groups=[group('joined'),group('archived',{archived:true}),group('blocked',{blockedMemberIds:['actor']}),group('gone',{memberIds:[]}),group('one-off',{spaceType:'ACTIVITY',temporaryRoom:{disposition:'TRASH'}})];
  state.posts=state.groups.map(item=>recordPost(item.id,item.id));
  const before=JSON.stringify(state);
  assert.deepEqual(myHubOwnRecordFeed(state,'actor',at).map(item=>item.groupId),['joined']);
  state.members=[];assert.deepEqual(myHubOwnRecordFeed(state,'actor',at),[]);
  state.members=[{id:'actor',name:'나'}];assert.equal(JSON.stringify(state),before);
});
