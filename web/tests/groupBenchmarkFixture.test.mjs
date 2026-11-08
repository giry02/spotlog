import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeedState } from '../src/together/seed.ts';
import { createDiscoveryCatalog, hydrateDiscoveryCatalog, DISCOVERY_CATALOG_VERSION } from '../src/together/discoveryExamples.ts';
import { discoveryProfile, filterDiscoveryGroups } from '../src/together/discovery.ts';
import { validGroupSubtopics } from '../src/together/groupTaxonomy.ts';
import { isTogetherState } from '../src/together/repository.ts';
import { selectRoomResources } from '../src/together/roomResources.ts';
import { createMembershipReviewState } from './membershipReviewFixture.ts';
import { GROUP_BENCHMARK_IDS, GROUP_BENCHMARK_OWNER, installGroupBenchmarkExamples } from './group-benchmark-fixture.ts';

const at=new Date('2026-11-08T12:00:00+09:00');
const places=[{id:'fixture-scene',kind:'LANDMARK',name:'바다',area:'부산',image:'/existing-scene.jpg',address:'',description:'',note:'',duration:'',lat:35,lng:129}];
function fixture() {
  const state=createSeedState(GROUP_BENCHMARK_OWNER,'검수 모임장',places);
  const membership=createMembershipReviewState(at,{multiplePublicActivities:true}), group=membership.groups[0];group.ownerId=GROUP_BENCHMARK_OWNER;group.memberIds=[GROUP_BENCHMARK_OWNER,'example-sibling'];
  state.groups.push(group);state.activities.push(...membership.activities.map(activity=>({...activity,leadId:GROUP_BENCHMARK_OWNER})));
  state.members.push(...membership.members.filter(member=>!state.members.some(existing=>existing.id===member.id)));
  return state;
}

test('fictional catalog children are authored parent-compatible choices, with existing creation dates unchanged',()=>{
  const catalog=createDiscoveryCatalog(places,at);
  assert.ok(catalog.groups.every(group=>group.sourceKind==='EXAMPLE' && group.discovery.subtopics.length>0 && validGroupSubtopics(group.discovery.topics,group.discovery.subtopics)));
  const state={...createSeedState('unjoined','나',[]),...catalog};
  assert.deepEqual(filterDiscoveryGroups(state,{region:'부산',topic:'SPORTS',subtopic:'SPORTS_RUNNING'},at).map(group=>group.id),['discovery-busan-running']);
  assert.deepEqual(filterDiscoveryGroups(state,{region:'부산',topic:'SPORTS',subtopic:'SPORTS_RACKET'},at).map(group=>group.id),['discovery-busan-badminton']);
  const later=createDiscoveryCatalog(places,new Date('2026-12-08T12:00:00+09:00'));
  assert.deepEqual(later.groups.map(group=>[group.id,group.createdAt]),catalog.groups.map(group=>[group.id,group.createdAt]));
  const guide=catalog.groups.find(group=>group.id==='public-busan-guide');assert.equal(guide.discovery.joinMode,'APPROVAL');assert.equal(guide.joinFields.questions.length,2);
  assert.equal(isTogetherState(state),true);
});

test('new example taxonomy never backfills an already saved legacy group or bumps the catalog version',()=>{
  const state=fixture();state.discoveryCatalogVersion=DISCOVERY_CATALOG_VERSION;
  const existing=state.groups.find(group=>group.id==='discovery-busan-running');delete existing.discovery.subtopics;existing.createdAt='2026-10-01T00:00:00Z';
  const before=structuredClone(state),next=hydrateDiscoveryCatalog(state,places,at);
  assert.equal(next,state);assert.equal('subtopics' in discoveryProfile(existing),false);assert.deepEqual(next,before);
});

test('benchmark fixture is isolated and distinguishes explicit sports children from a broad legacy group',()=>{
  const state=fixture(), names=structuredClone(state.members), unrelated=structuredClone(state.groups.find(group=>group.id==='weekend-walk'));
  installGroupBenchmarkExamples(state,GROUP_BENCHMARK_OWNER,places,at);
  assert.equal(isTogetherState(state),true);
  const sports=filterDiscoveryGroups(state,{region:'부산',topic:'SPORTS'},at).map(group=>group.id);
  assert.ok(sports.includes(GROUP_BENCHMARK_IDS.golf));assert.ok(sports.includes(GROUP_BENCHMARK_IDS.legacy));
  assert.deepEqual(filterDiscoveryGroups(state,{region:'부산',subtopic:'SPORTS_GOLF'},at).map(group=>group.id),[GROUP_BENCHMARK_IDS.golf]);
  assert.equal('subtopics' in discoveryProfile(state.groups.find(group=>group.id===GROUP_BENCHMARK_IDS.legacy)),false);
  assert.deepEqual(state.groups.find(group=>group.id==='weekend-walk'),unrelated);
  for(const member of names) assert.deepEqual(state.members.find(item=>item.id===member.id),member);
  const snapshot=structuredClone(state);installGroupBenchmarkExamples(state,GROUP_BENCHMARK_OWNER,places,at);assert.deepEqual(state,snapshot);
  assert.throws(()=>installGroupBenchmarkExamples(state,'real-account',places,at));assert.deepEqual(state,snapshot);
});

test('benchmark review includes questions and a separate pending person without pre-applying the interactive applicant',()=>{
  const state=fixture();installGroupBenchmarkExamples(state,GROUP_BENCHMARK_OWNER,places,at);
  const publicGroup=state.groups.find(group=>group.id==='membership-review-club'), application=state.applications.find(item=>item.id==='benchmark-pending-application');
  assert.equal(publicGroup.joinFields.questions.length,2);assert.equal(application.status,'PENDING');
  assert.equal(application.userId,GROUP_BENCHMARK_IDS.pending);assert.equal(application.joinProfile.answers[0].question,publicGroup.joinFields.questions[0].label);
  assert.equal(state.applications.some(item=>item.userId==='review-applicant'),false);
  assert.equal(publicGroup.memberIds.includes(GROUP_BENCHMARK_IDS.pending),false);
});

test('exact room resources have separate general/current/past photos with guest and wrong-room guards',()=>{
  const state=fixture();installGroupBenchmarkExamples(state,GROUP_BENCHMARK_OWNER,places,at);
  const general=selectRoomResources(state,GROUP_BENCHMARK_OWNER,'family-busan'), current=selectRoomResources(state,GROUP_BENCHMARK_OWNER,'family-busan','family-next'), past=selectRoomResources(state,GROUP_BENCHMARK_OWNER,'family-busan','family-past');
  assert.deepEqual(general.media.map(item=>item.id),['benchmark-general-photo']);
  assert.deepEqual(current.media.map(item=>item.id),['benchmark-activity-photo']);
  assert.ok(past.media.some(item=>item.id==='benchmark-past-photo'));assert.ok(past.media.every(item=>item.activityId==='family-past'));
  assert.equal(selectRoomResources(state,'','family-busan'),null);assert.equal(selectRoomResources(state,GROUP_BENCHMARK_OWNER,'weekend-walk','family-next'),null);
});
