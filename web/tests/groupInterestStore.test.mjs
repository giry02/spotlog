import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyGroupInterests, groupInterestStorageKey, isGroupInterestSelection, isGroupInterestsState, matchesSavedGroupInterests, readGroupInterests, writeGroupInterests } from '../src/groupInterestStore.ts';
import { groupSubtopics } from '../src/together/groupTaxonomy.ts';
import { topicOptions } from '../src/together/discovery.ts';
import { createEmptyState } from '../src/together/model.ts';
import { selectGroupDiscoveryHome, selectHomeSavedInterestGroups } from '../src/community/groupDiscoveryHomeModel.ts';

function memory() { const values=new Map(),reads=[],writes=[]; return { values,reads,writes,getItem:key=>{reads.push(key);return values.get(key)??null;},setItem:(key,value)=>{writes.push(key);values.set(key,value);} }; }
const selection={topics:['SPORTS','CAFE'],subtopics:['SPORTS_RACKET']};

test('guest and every current account have isolated keys, including guest-like account names',()=>{
  const storage=memory(),owners=['','guest','guest-device','account:a','a','a:b','a/b'];
  assert.equal(new Set(owners.map(groupInterestStorageKey)).size,owners.length);
  for(const owner of owners) writeGroupInterests(storage,owner,{topics:['SPORTS'],subtopics:[]},0);
  for(const owner of owners) {const before=storage.reads.length,loaded=readGroupInterests(storage,owner);assert.equal(loaded.state.owner,owner);assert.equal(loaded.state.revision,1);assert.deepEqual(storage.reads.slice(before),[groupInterestStorageKey(owner)]);}
  assert.deepEqual(readGroupInterests(storage,'another').state,emptyGroupInterests('another'));
});

test('saved parent and child selections survive reload, are detached from inputs, and clear only on explicit save',()=>{
  const storage=memory(),draft=structuredClone(selection),saved=writeGroupInterests(storage,'me',draft,0);
  draft.topics.length=0;draft.subtopics.length=0;
  assert.deepEqual(readGroupInterests(storage,'me').state.topics,['SPORTS','CAFE']);
  const before=storage.values.get(groupInterestStorageKey('me'));
  const cancelledDraft={topics:[],subtopics:[]};assert.equal(storage.values.get(groupInterestStorageKey('me')),before);
  writeGroupInterests(storage,'me',cancelledDraft,saved.revision);
  assert.deepEqual(readGroupInterests(storage,'me').state,{schemaVersion:1,owner:'me',revision:2,topics:[],subtopics:[]});
});

test('strict selection validation rejects unknown, duplicate, orphan, oversized and private fields',()=>{
  for(const invalid of [{topics:['UNKNOWN'],subtopics:[]},{topics:['CAFE','CAFE'],subtopics:[]},{topics:['CAFE'],subtopics:['SPORTS_RACKET']},{topics:['SPORTS'],subtopics:['SPORTS_RACKET','SPORTS_RACKET']},{topics:['SPORTS'],subtopics:['UNKNOWN_CHILD']},{topics:[],subtopics:[],privateMessage:'secret'},{topics:topicOptions.map(item=>item.id),subtopics:groupSubtopics.slice(0,33).map(item=>item.id)}]) {assert.equal(isGroupInterestSelection(invalid),false);assert.throws(()=>writeGroupInterests(memory(),'me',invalid,0));}
  assert.equal(isGroupInterestSelection({topics:topicOptions.map(item=>item.id),subtopics:groupSubtopics.slice(0,32).map(item=>item.id)}),true);
});

test('invalid, foreign-owner, future-schema and oversized stored bytes never leak or get overwritten',()=>{
  for(const raw of ['{broken',JSON.stringify({...emptyGroupInterests('other'),topics:['PETS']}),JSON.stringify({...emptyGroupInterests('me'),schemaVersion:2}),JSON.stringify({...emptyGroupInterests('me'),revision:-1}),'x'.repeat(12001)]) {
    const storage=memory(),key=groupInterestStorageKey('me');storage.values.set(key,raw);
    const loaded=readGroupInterests(storage,'me');assert.equal(loaded.status,'invalid');assert.deepEqual(loaded.state.topics,[]);assert.equal(storage.writes.length,0);
    assert.throws(()=>writeGroupInterests(storage,'me',selection,0));assert.equal(storage.values.get(key),raw);
  }
  assert.equal(isGroupInterestsState({...emptyGroupInterests('me'),extra:'secret'},'me'),false);
});

test('stale revisions and failed storage preserve the previous preference and caller draft',()=>{
  const storage=memory();writeGroupInterests(storage,'me',selection,0);const before=storage.values.get(groupInterestStorageKey('me')),draft={topics:['BOOK'],subtopics:[]};
  assert.throws(()=>writeGroupInterests(storage,'me',draft,0),/다른 화면/);assert.equal(storage.values.get(groupInterestStorageKey('me')),before);assert.deepEqual(draft,{topics:['BOOK'],subtopics:[]});
  const failed={getItem:storage.getItem,setItem:()=>{throw new Error('quota');}};
  assert.throws(()=>writeGroupInterests(failed,'me',draft,1),/저장하지 못/);assert.equal(storage.values.get(groupInterestStorageKey('me')),before);
  assert.throws(()=>writeGroupInterests(storage,'me',draft,Number.MAX_SAFE_INTEGER));
});

test('missing or denied storage is unavailable without creating a fallback account or write',()=>{
  assert.equal(readGroupInterests(null,'me').status,'unavailable');
  const denied={getItem:()=>{throw new Error('denied');},setItem:()=>assert.fail('must not write')};
  assert.equal(readGroupInterests(denied,'me').status,'unavailable');assert.throws(()=>writeGroupInterests(denied,'me',selection,0));
  for(const owner of [' bad ','x\n','x'.repeat(301),'\ud800']) assert.throws(()=>groupInterestStorageKey(owner));
});

test('a child narrows its own parent, parents are OR, and broad legacy tags are never inferred',()=>{
  assert.equal(matchesSavedGroupInterests({topics:['SPORTS'],subtopics:['SPORTS_RACKET']},selection),true);
  assert.equal(matchesSavedGroupInterests({topics:['SPORTS'],subtopics:['SPORTS_RUNNING']},selection),false);
  assert.equal(matchesSavedGroupInterests({topics:['SPORTS']},selection),false);
  assert.equal(matchesSavedGroupInterests({topics:['CAFE']},selection),true);
  assert.equal(matchesSavedGroupInterests({topics:['BOOK']},selection),false);
  assert.equal(matchesSavedGroupInterests({topics:['SPORTS']},{topics:['SPORTS'],subtopics:[]}),true);
  assert.equal(matchesSavedGroupInterests({topics:['SPORTS']},{topics:[],subtopics:[]}),false);
});

const group=(id,topics,subtopics=[],extra={})=>({id,name:id,kind:'HOBBY',region:'부산',introduction:'소개',cover:'',visibility:'PUBLIC',promotionPublished:true,archived:false,ownerId:'owner',memberIds:['owner'],managerIds:[],discovery:{topics,subtopics,district:'수영구',style:'NEIGHBORHOOD',recruitment:'OPEN',welcome:'환영',joinGuide:'안내'},...extra});
function fixture(){const state=createEmptyState('me','나');state.groups.push(group('라켓 친구',['SPORTS'],['SPORTS_RACKET']),group('러닝 친구',['SPORTS'],['SPORTS_RUNNING']),group('카페 친구',['CAFE']),group('독서 친구',['BOOK']),group('서울 라켓 친구',['SPORTS'],['SPORTS_RACKET'],{region:'서울'}),group('비공개 라켓',['SPORTS'],['SPORTS_RACKET'],{visibility:'PRIVATE'}),group('차단 라켓',['SPORTS'],['SPORTS_RACKET'],{blockedMemberIds:['me']}));return state;}

test('saved-interest section intersects current region/query while the ordinary regional feed remains complete',()=>{
  const state=fixture(),before=structuredClone(state),filters={region:'부산',district:'수영구',query:'친구'};
  const ordinary=selectGroupDiscoveryHome(state,filters,'me'),selected=selectHomeSavedInterestGroups(state,filters,selection,'me');
  assert.deepEqual(selected.map(item=>item.id),['라켓 친구','카페 친구']);
  assert.deepEqual(ordinary.groups.map(item=>item.id),['라켓 친구','러닝 친구','카페 친구','독서 친구']);
  assert.deepEqual(selectHomeSavedInterestGroups(state,{...filters,query:'없는 말'},selection,'me'),[]);
  assert.deepEqual(selectHomeSavedInterestGroups(state,{...filters,district:'없는 구'},selection,'me'),[]);
  assert.deepEqual(state,before);
});

test('dedicated results stay public allowlists and removing preferences never changes membership, photos or source records',()=>{
  const state=fixture(),before=structuredClone(state),filters={region:'부산',query:''};state.groups[0].memberProfiles={owner:{introduction:'private profile'}};
  const result=selectHomeSavedInterestGroups(state,filters,selection,'me');
  assert.equal(JSON.stringify(result).includes('private profile'),false);
  for(const item of result) for(const field of ['memberProfiles','memberIds','ownerId','managerIds','blockedMemberIds']) assert.equal(Object.hasOwn(item,field),false);
  assert.deepEqual(selectHomeSavedInterestGroups(state,filters,{topics:[],subtopics:[]},'me'),[]);
  delete state.groups[0].memberProfiles;assert.deepEqual(state,before);
});
