import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { topicOptions } from '../src/together/discovery.ts';
import { groupSubtopics } from '../src/together/groupTaxonomy.ts';
import { selectGroupDiscoveryHome, groupHomeListingFilters } from '../src/community/groupDiscoveryHomeModel.ts';
import { selectGroupDiscovery } from '../src/together/groupDiscoveryModel.ts';
import { resolveGroupDiscoveryList } from '../src/together/groupDiscoverySections.ts';

const at = new Date('2026-11-10T12:00:00+09:00');
const profile = (topics = ['SOCIAL'], extra = {}) => ({ topics, district:'수영구', style:'NEIGHBORHOOD', recruitment:'OPEN', welcome:'함께 나누는 시간', joinGuide:'안내를 확인해 주세요.', ...extra });
const group = (id, topics = ['SOCIAL'], extra = {}) => ({ id, name:id, kind:'HOBBY', region:'부산', introduction:'공개 소개', cover:`/${id}.jpg`, visibility:'PUBLIC', promotionPublished:true, archived:false, ownerId:'owner', memberIds:['owner'], managerIds:[], promotionActivityIds:[], discovery:profile(topics), ...extra });
const activity = (id, groupId, extra = {}) => ({ id, groupId, title:id, date:'2026-11-11', endDate:'2026-11-11', description:'공개 설명', status:'PLANNED', leadId:'owner', editorIds:[], participants:{secretMember:'JOINED'}, arrivedIds:['secretMember'], meetingPoint:'내부 만남 장소', revision:1, ...extra });
const select = (state, filters = {}, viewer = '') => selectGroupDiscoveryHome(state,{region:'',query:'',...filters},viewer,at);
const ids = rows => rows.map(item=>item.id);

test('home interest grid exposes the complete existing taxonomy and only its real child definitions',()=>{
  const result = select(createEmptyState('',''));
  assert.equal(result.interests.length,16);
  assert.deepEqual(ids(result.interests).sort(),ids(topicOptions).sort());
  assert.deepEqual(ids(result.interests).slice(0,9),['SOCIAL','FOOD','CAFE','OUTDOOR','SPORTS','BOOK','CULTURE','GAME','TRAVEL']);
  for(const interest of result.interests) assert.deepEqual(ids(interest.subtopics),ids(groupSubtopics.filter(item=>item.parent===interest.id)));
  assert.deepEqual(result.groups,[]); assert.deepEqual(result.meetups,[]); assert.deepEqual(result.topics,[]);
});

test('photo and topic sections admit only public published open groups and exclude blocked viewers',()=>{
  const state = createEmptyState('viewer','사용자');
  state.groups.push(group('visible'),group('private',['SPORTS'],{visibility:'PRIVATE'}),group('unpublished',['BOOK'],{promotionPublished:false}),group('archived',['OUTDOOR'],{archived:true}),group('paused',['MUSIC'],{discovery:profile(['MUSIC'],{recruitment:'PAUSED'})}),group('standalone',['FOOD'],{spaceType:'ACTIVITY',visibility:'PRIVATE',promotionPublished:false}),group('blocked',['SOCIAL'],{blockedMemberIds:['viewer']}));
  assert.deepEqual(ids(select(state).groups),['visible','blocked']);
  assert.deepEqual(ids(select(state,{},'viewer').groups),['visible']);
  assert.deepEqual(ids(select(state,{},'viewer').featured),['visible']);
});

test('discovery sections and public time cards never expose private member, chat, venue or attendance fields',()=>{
  const state=createEmptyState('viewer','사용자');
  state.groups.push(group('public',['SOCIAL'],{memberIds:['owner','viewer'],promotionActivityIds:['event'],memberProfiles:{viewer:{introduction:'비공개 가입 소개'}},blockedMemberIds:['privateBlockedIdentity']}));
  state.activities.push(activity('event','public',{cover:'/private-event-cover.jpg',journey:{privateRoute:'개인 동선 비밀'}}));
  state.messages.push({id:'message',roomId:'group:public',authorId:'viewer',body:'사적인 대화',createdAt:at.toISOString()});
  const before=structuredClone(state),result=select(state),serialized=JSON.stringify(result);
  for(const value of ['secretMember','privateBlockedIdentity','비공개 가입 소개','내부 만남 장소','개인 동선 비밀','사적인 대화','/private-event-cover.jpg']) assert.equal(serialized.includes(value),false,value);
  for(const field of ['memberIds','ownerId','managerIds','blockedMemberIds','memberProfiles']) assert.equal(Object.hasOwn(result.featured[0],field),false,field);
  for(const field of ['participants','arrivedIds','meetingPoint','journey','leadId','editorIds','cover']) assert.equal(Object.hasOwn(result.meetups[0].activity,field),false,field);
  assert.deepEqual(state,before);
});

test('current approval snapshots and time order remain authoritative in compact events',()=>{
  const state=createEmptyState('','');
  state.groups.push(group('g',['SPORTS'],{promotionActivityIds:['late','early','cancelled'],promotionActivitySnapshots:['late','early','cancelled'].map(id=>({id,groupId:'g',title:`승인된 ${id}`,date:'2026-11-11',endDate:'2026-11-11',description:'승인 소개',status:'PLANNED',startTime:id==='early'?'10:00':'19:00'}))}));
  state.activities.push(activity('late','g',{title:'승인 전 편집 제목',startTime:'07:00'}),activity('early','g',{startTime:'21:00'}),activity('cancelled','g',{status:'CANCELLED'}),activity('unapproved','g'));
  assert.deepEqual(select(state).meetups.map(item=>item.activity.title),['승인된 early','승인된 late']);
  state.groups[0].blockedMemberIds=['viewer']; assert.deepEqual(select(state,{},'viewer').meetups,[]);
  state.groups[0].promotionPublished=false; assert.deepEqual(select(state).meetups,[]);
});

test('group and event search remain independent without widening region, district or purpose',()=>{
  const state=createEmptyState('','');
  state.groups.push(group('느긋한 모임',['CAFE'],{promotionActivityIds:['event']}),group('제주 카페',['CAFE'],{region:'제주'}),group('다른 구 모임',['CAFE'],{discovery:profile(['CAFE'],{district:'해운대구'})}));
  state.activities.push(activity('event','느긋한 모임',{title:'새벽 커피 모임'}));
  const result=select(state,{region:'부산',district:'수영구',purpose:'CAFE',query:'새벽'});
  assert.deepEqual(result.groups,[]); assert.deepEqual(result.meetups.map(item=>item.activity.id),['event']);
  assert.deepEqual(select(state,{region:'없는 지역'}).groups,[]);
  assert.deepEqual(select(state,{region:'부산',district:'없는 구'}).meetups,[]);
});

test('photo recommendations and short topic sections preserve catalogue order while avoiding repeated home rows',()=>{
  const state=createEmptyState('','');
  const entries=[['first','FOOD'],['second','CAFE'],['third','PHOTO'],['fourth','WALK'],['sport-a','SPORTS'],['sport-b','SPORTS'],['social','SOCIAL'],['books','BOOK'],['outdoor','OUTDOOR'],['music','MUSIC']];
  state.groups.push(...entries.map(([id,topic])=>group(id,[topic])));
  const before=structuredClone(state),result=select(state);
  assert.deepEqual(ids(result.featured),['first','second','third','fourth']);
  assert.deepEqual(result.topics.slice(0,4).map(item=>item.id),['sports','social','books','outdoor']);
  const homeIds=[...ids(result.featured),...result.topics.flatMap(section=>ids(section.groups))];
  assert.equal(new Set(homeIds).size,homeIds.length);
  for(const section of result.topics) {assert.ok(section.groups.length<=2);assert.ok(section.groups.every(row=>section.topics.some(topic=>row.topics.includes(topic))));}
  assert.deepEqual(state,before);
});

test('every category and child handoff preserves location/query and resolves the selected current public listing',()=>{
  const state=createEmptyState('','');
  state.groups.push(group('라켓 친구',['SPORTS'],{discovery:profile(['SPORTS'],{subtopics:['SPORTS_RACKET']})}),group('달리기 친구',['SPORTS'],{discovery:profile(['SPORTS'],{subtopics:['SPORTS_RUNNING']})}),group('제주 라켓 친구',['SPORTS'],{region:'제주',discovery:profile(['SPORTS'],{subtopics:['SPORTS_RACKET']})}));
  const base={region:'부산',district:'수영구',query:'친구',topic:'CAFE',categoryTopics:['CAFE'],subtopic:'CAFE_COFFEE',useMyRegion:true};
  const before=structuredClone(base),filters=groupHomeListingFilters(base,{kind:'TOPIC',topic:'SPORTS',subtopic:'SPORTS_RACKET'});
  assert.equal(filters.region,'부산');assert.equal(filters.district,'수영구');assert.equal(filters.query,'친구');assert.equal(filters.topic,'SPORTS');assert.equal(filters.subtopic,'SPORTS_RACKET');assert.equal(filters.useMyRegion,false);assert.equal(filters.categoryTopics,undefined);
  assert.deepEqual(ids(selectGroupDiscovery(state,filters,'',at).groups),['라켓 친구']);
  assert.deepEqual(base,before);
  assert.throws(()=>groupHomeListingFilters(base,{kind:'TOPIC',topic:'SPORTS',subtopic:'CAFE_COFFEE'}));
  assert.throws(()=>groupHomeListingFilters(base,{kind:'TOPIC',topic:'UNKNOWN'}));
});

test('topic-section More links use the real collection resolver and meetup More opens meetup results',()=>{
  const state=createEmptyState('','');
  state.groups.push(...['one','two','three','four'].map(id=>group(id,['FOOD'])),group('racket',['SPORTS']),group('book',['BOOK']),group('other-sport',['SPORTS'],{region:'서울'}));
  const result=select(state,{region:'부산'}),sports=result.topics.find(item=>item.id==='sports');
  const filters=groupHomeListingFilters(result.filters,{kind:'COLLECTION',id:sports.id});
  const resolved=resolveGroupDiscoveryList(selectGroupDiscovery(state,filters,'',at),filters);
  assert.equal(filters.collectionId,'sports');assert.equal(filters.region,'부산');assert.deepEqual(ids(resolved.groups),['racket']);
  const meetupFilters=groupHomeListingFilters(result.filters,{kind:'MEETUPS'});assert.equal(meetupFilters.section,'MEETUPS');assert.equal(meetupFilters.view,'MEETUPS');assert.equal(meetupFilters.region,'부산');
  assert.throws(()=>groupHomeListingFilters(result.filters,{kind:'COLLECTION',id:'invented-popular'}));
});
