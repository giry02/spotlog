import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { upsertPlaceFeedback, withdrawPlaceFeedback } from '../src/together/businessAssessments.ts';
import { selectGroupTasteMemory } from '../src/together/groupTasteMemory.ts';
import { commitReviewPostWithExperiences, selectReviewExperiencePlaces, validateReviewPlaceExperiences } from '../src/together/reviewPlaceExperience.ts';

const place=(id,kind='FOOD',extra={})=>({id,kind,name:id,area:'부산',address:`부산 ${id}`,image:'',description:'공개 소개',note:'',duration:'',lat:35,lng:129,...extra});
const catalogue=[place('food'),place('cafe','CAFE'),place('stay','STAY'),place('elsewhere'),place('personal','CAFE',{personal:true})];
const input={title:'함께한 저녁',body:'후기에만 남길 개인적인 이야기',category:'REVIEW',attachments:[]};
function fixture(){
  const state=createEmptyState('me','나');state.members.push({id:'other',name:'다른 멤버'});
  state.groups.push({id:'group',name:'우리 모임',kind:'FRIENDS',region:'부산',introduction:'',cover:'',visibility:'PUBLIC',promotionPublished:true,ownerId:'me',memberIds:['me','other'],managerIds:[],archived:false,interestPlaceIds:['cafe']});
  state.groups.push({...structuredClone(state.groups[0]),id:'another',interestPlaceIds:['elsewhere']});
  state.activities.push({id:'activity',groupId:'group',title:'저녁 약속',date:'2026-11-10',endDate:'',meetingPoint:'food',description:'',status:'COMPLETED',leadId:'me',editorIds:[],participants:{me:'JOINED'},arrivedIds:[],revision:3,placeCandidateIds:['cafe'],venuePlaceId:'food',
    journey:{id:'route',purpose:'PLAN',title:'공유 동선',days:[{day:1,date:'2026-11-10',places:[place('food','FOOD',{name:'옛 상호'}),place('stay','STAY'),place('personal','CAFE',{personal:true}),place('withdrawn')],blocks:[]}]}});
  state.activities.push({...structuredClone(state.activities[0]),id:'sibling',placeCandidateIds:['elsewhere'],venuePlaceId:undefined,journey:undefined});
  return state;
}
const selected=(state,placeId='food',activityId='activity',extra={})=>({placeId,sourceVersion:selectReviewExperiencePlaces(state,'me','group',catalogue,activityId).find(item=>item.place.id===placeId).sourceVersion,rating:4,note:'이 업체에 따로 적은 경험',recommended:true,experienceTags:['QUIET','RETURN_VISIT'],...extra});
const commit=(state,experiences,post=input,activityId='activity',places=catalogue)=>commitReviewPostWithExperiences(state,'me','group',post,experiences,places,activityId);

test('eligible experiences use only current public IDs shared into this exact scope and never infer visits',()=>{
  const state=fixture(),before=structuredClone(state);
  assert.deepEqual(selectReviewExperiencePlaces(state,'me','group',catalogue,'activity').map(item=>item.place.id),['food','stay','cafe']);
  assert.equal(selectReviewExperiencePlaces(state,'me','group',catalogue,'activity')[0].place.name,'food');
  assert.deepEqual(selectReviewExperiencePlaces(state,'me','group',catalogue).map(item=>item.place.id),['cafe']);
  assert.deepEqual(selectReviewExperiencePlaces(state,'me','group',catalogue,'sibling').map(item=>item.place.id),['elsewhere']);
  assert.deepEqual(state,before);
});

test('one atomic review save creates independent exact-place feedback without copying body, photos or public excerpt',()=>{
  const state=fixture(),draft=selected(state),beforeActivity=structuredClone(state.activities[0]);
  const postId=commit(state,[draft],{...input,publicExcerpt:'사용자가 따로 쓴 공개 요약'});
  assert.equal(state.posts[0].id,postId);assert.equal(state.posts[0].publicPreview.excerpt,'사용자가 따로 쓴 공개 요약');
  const feedback=state.placeFeedback[0];
  assert.equal(feedback.activityId,'activity');assert.equal(feedback.authorId,'me');assert.equal(feedback.note,draft.note);
  assert.deepEqual(feedback.experienceTags,['QUIET','RETURN_VISIT']);assert.deepEqual(feedback.photos,[]);assert.deepEqual(feedback.purposes,[]);
  for(const text of [input.body,'사용자가 따로 쓴 공개 요약']) assert.equal(JSON.stringify(feedback).includes(text),false);
  assert.deepEqual(state.activities[0],beforeActivity);
});

test('completed experience becomes an explicit group taste memory with original assessment source',()=>{
  const state=fixture();commit(state,[selected(state)]);
  const memory=selectGroupTasteMemory(state,'me','group',catalogue,{experienceTag:'QUIET'},new Date('2026-11-16T00:00:00Z'));
  assert.equal(memory.totalRecordCount,1);assert.equal(memory.items[0].place.id,'food');
  assert.equal(memory.items[0].records[0].sourceTitle,'저녁 약속');assert.equal(memory.items[0].records[0].note,'이 업체에 따로 적은 경험');
  assert.equal(JSON.stringify(memory).includes(input.body),false);
});

test('failure in any selected experience leaves every post and evaluation unchanged',()=>{
  const state=fixture(),good=selected(state),bad=selected(state,'stay','activity',{rating:0}),before=structuredClone(state);
  assert.throws(()=>commit(state,[good,bad]),/별점/);assert.deepEqual(state,before);
});

test('post validation failure cannot leave successful experience records behind',()=>{
  for(const patch of [{title:''},{category:'NOTICE',publicExcerpt:'후기 공개로 가장'},{attachments:[{id:'x',url:'javascript:bad',caption:''}]}]){
    const state=fixture(),draft=selected(state),before=structuredClone(state);
    assert.throws(()=>commit(state,[draft],{...input,...patch}));assert.deepEqual(state,before);
  }
});

test('new review cannot overwrite either an existing own assessment or its withdrawn tombstone',()=>{
  for(const withdrawn of [false,true]){
    const state=fixture(),draft=selected(state);
    upsertPlaceFeedback(state,'me',{groupId:'group',activityId:'activity',placeId:'food'},{rating:2,note:'기존 평가',recommended:false,purposes:[],photos:[]},catalogue);
    if(withdrawn) withdrawPlaceFeedback(state,'me',{groupId:'group',activityId:'activity',placeId:'food'},1);
    const existing=selectReviewExperiencePlaces(state,'me','group',catalogue,'activity')[0];
    assert.equal(existing.hasOwnReview,true);assert.equal(existing.ownReview.note,'기존 평가');assert.equal(existing.ownReview.withdrawn,withdrawn);
    const before=structuredClone(state);assert.throws(()=>commit(state,[draft]),/이미 내 평가/);assert.deepEqual(state,before);
  }
});

test('another member or sibling-scope assessment does not become an own record or get overwritten',()=>{
  const state=fixture();
  upsertPlaceFeedback(state,'other',{groupId:'group',activityId:'activity',placeId:'food'},{rating:2,note:'다른 사람 평가',recommended:false,purposes:[]},catalogue);
  upsertPlaceFeedback(state,'me',{groupId:'group',activityId:'sibling',placeId:'food'},{rating:3,note:'다른 약속 평가',recommended:false,purposes:[]},catalogue);
  const before=structuredClone(state.placeFeedback);commit(state,[selected(state)]);
  assert.deepEqual(state.placeFeedback.slice(0,2),before);assert.equal(state.placeFeedback.length,3);
});

test('membership, lifecycle or exact activity revocation rejects the whole save before mutation',()=>{
  for(const mutate of [state=>state.members.splice(0,1),state=>state.groups[0].memberIds=['other'],state=>state.groups[0].blockedMemberIds=['me'],state=>state.groups[0].archived=true,
    state=>state.activities[0].status='CANCELLED',state=>state.groups[0].temporaryRoom={disposition:'TRASH'},state=>state.activities[0].groupId='another']){
    const state=fixture(),draft=selected(state);mutate(state);const before=structuredClone(state);
    assert.throws(()=>commit(state,[draft]));assert.deepEqual(state,before);
  }
  const state=fixture(),before=structuredClone(state);
  for(const actor of ['', 'unknown']) assert.throws(()=>commitReviewPostWithExperiences(state,actor,'group',input,[],catalogue,'activity'));
  assert.deepEqual(state,before);
});

test('source versions bind exact actor/group/activity and selected public label, not a place name parsed from the body',()=>{
  const state=fixture(),draft=selected(state),before=structuredClone(state);
  assert.throws(()=>commitReviewPostWithExperiences(state,'other','group',input,[draft],catalogue,'activity'),/작성 공간/);
  assert.throws(()=>commit(state,[draft],input,'sibling'),/작성 공간/);
  assert.throws(()=>commitReviewPostWithExperiences(state,'me','another',input,[draft],catalogue),/작성 공간/);
  assert.throws(()=>commit(state,[draft],input,'activity',catalogue.map(item=>item.id==='food'?{...item,name:'바뀐 상호'}:item)),/장소/);
  assert.deepEqual(state,before);
});

test('a removed shared source, withdrawn catalogue or personal-only place cannot create an evaluation from stale UI',()=>{
  for(const places of [catalogue.filter(item=>item.id!=='food'),catalogue.map(item=>item.id==='food'?{...item,personal:true}:item)]){
    const state=fixture(),draft=selected(state),before=structuredClone(state);assert.throws(()=>commit(state,[draft],input,'activity',places));assert.deepEqual(state,before);
  }
  const state=fixture(),draft=selected(state);state.activities[0].journey=undefined;state.activities[0].venuePlaceId=undefined;const before=structuredClone(state);
  assert.throws(()=>commit(state,[draft]));assert.deepEqual(state,before);
});

test('duplicate, invalid, foreign and unselected experience fields are rejected without partial saves',()=>{
  for(const patch of [{rating:6},{rating:'5'},{rating:NaN},{recommended:'yes'},{note:'x'.repeat(2001)},{experienceTags:['QUIET','QUIET']},{experienceTags:['GUESS']},{photos:[]},{sourceVersion:'other'}]){
    const state=fixture(),draft=selected(state,'food','activity',patch),before=structuredClone(state);assert.throws(()=>commit(state,[draft]));assert.deepEqual(state,before);
  }
  const state=fixture(),draft=selected(state),before=structuredClone(state);
  for(const drafts of [[draft,draft],Array.from({length:9},()=>draft),[null]]) assert.throws(()=>commit(state,drafts));
  assert.deepEqual(state,before);
});

test('empty selection preserves ordinary post behavior and does not invent feedback, visit or recommendation state',()=>{
  const state=fixture(),before=structuredClone(state.activities);const id=commit(state,[],{...input,category:'FREE'});
  assert.equal(state.posts[0].id,id);assert.equal(Object.hasOwn(state,'placeFeedback'),false);assert.deepEqual(state.activities,before);
  const after=structuredClone(state);assert.throws(()=>commit(state,[selected(state)],{...input,category:'FREE'}),/후기/);assert.deepEqual(state,after);
});

test('preflight is read-only and exact group-wide experience remains separate from appointment feedback',()=>{
  const state=fixture(),draft=selected(state,'cafe',null),before=structuredClone(state);
  validateReviewPlaceExperiences(state,'me','group',input,[draft],catalogue);assert.deepEqual(state,before);
  commitReviewPostWithExperiences(state,'me','group',input,[draft],catalogue);
  assert.equal(state.posts[0].activityId,undefined);assert.equal(state.placeFeedback[0].activityId,undefined);
});
