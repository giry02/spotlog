import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { createConfiguredGroup, joinGroupWithProfile, approveGroupWithProfile } from '../src/together/groupOnboarding.ts';
import { normalizeGroupCreationDraft } from '../src/together/groupCreation.ts';
import { normalizeGroupJoinFields } from '../src/together/groupJoining.ts';
import { publicGroupJoinVersion } from '../src/together/publicActivityIntent.ts';
import { isTogetherState } from '../src/together/repository.ts';
const at=new Date('2026-11-08T03:00:00Z');
const joinFields=()=>({questions:[{id:'question-one',label:'함께 하고 싶은 활동은?'}],welcome:'어서 오세요',availableTimes:['WEEKEND_DAY']});
const joinDraft=(extra={})=>({nickname:'모임 별명',introduction:'직접 쓴 인사',answers:[{questionId:'question-one',answer:'같이 걷고 싶어요'}],availableTimes:['FLEXIBLE'],rulesAccepted:true,...extra});
function fixture(mode='DIRECT'){
 const state=createEmptyState('owner','계정 모임장');state.members.push({id:'applicant',name:'계정 가입자'},{id:'other',name:'다른 계정'});
 state.groups.push({id:'g',name:'함께하는 모임',kind:'HOBBY',region:'부산',introduction:'가입 전 소개',cover:'',visibility:'PUBLIC',ownerId:'owner',memberIds:['owner'],managerIds:[],archived:false,promotionPublished:true,joinFields:joinFields(),discovery:{topics:['WALK'],subtopics:['WALK_PARK'],district:'해운대구',style:'NEIGHBORHOOD',recruitment:'OPEN',joinMode:mode,welcome:'환영',joinGuide:'안내를 확인해 주세요'}});
 state.groups.push({...structuredClone(state.groups[0]),id:'other-group',name:'다른 모임',memberIds:['other'],ownerId:'other'});
 state.activities.push({id:'activity',groupId:'g',title:'약속',date:'2999-11-08',endDate:'',meetingPoint:'개인 장소',description:'',status:'PLANNED',leadId:'owner',editorIds:[],participants:{},arrivedIds:[],revision:1});return state;
}
function deniedUnchanged(state,action){const before=structuredClone(state);assert.throws(action);assert.deepEqual(state,before);}

test('one reviewed creation makes exactly one private group with explicit taxonomy and welcome settings while preserving unrelated originals',()=>{
 const state=fixture(),before=structuredClone(state);
 const input=normalizeGroupCreationDraft({name:'새 가족 모임',kind:'FAMILY',joinMode:'APPROVAL',region:'부산',district:'해운대구',categoryId:'TRAVEL',topics:['TRAVEL'],subcategoryIds:['TRAVEL_FAMILY'],introduction:'사용자가 고친 소개',purpose:'가족끼리 모이기',joinFields:joinFields()});
 const source=structuredClone(input),id=createConfiguredGroup(state,'applicant',input,at);assert.equal(state.groups.length,before.groups.length+1);
 const group=state.groups.at(-1);assert.equal(group.id,id);assert.equal(group.visibility,'PRIVATE');assert.equal(group.promotionPublished,false);assert.equal(group.kind,'FAMILY');assert.deepEqual(group.memberIds,['applicant']);
 assert.deepEqual(group.discovery.topics,['TRAVEL']);assert.deepEqual(group.discovery.subtopics,['TRAVEL_FAMILY']);assert.equal(group.discovery.joinMode,'APPROVAL');assert.equal(group.discovery.recruitment,'PAUSED');assert.equal(group.discovery.district,'해운대구');assert.equal(group.introduction,'사용자가 고친 소개');assert.deepEqual(group.joinFields,joinFields());assert.deepEqual(input,source);
 assert.deepEqual(state.groups.slice(0,-1),before.groups);for(const field of ['members','activities','messages','posts','media','polls','tasks','applications','invites','sharedJournals'])assert.deepEqual(state[field],before[field]);assert.equal(isTogetherState(state),true);
});
test('direct joining saves only a scoped voluntary profile and never edits the global name, other group, RSVP or personal records',()=>{
 const state=fixture(),before=structuredClone(state),input=joinDraft();
 assert.equal(joinGroupWithProfile(state,'g','applicant',input,publicGroupJoinVersion(state.groups[0]),undefined,at),true);
 assert.deepEqual(state.members,before.members);assert.deepEqual(state.groups[1],before.groups[1]);assert.deepEqual(state.activities,before.activities);assert.equal(state.applications.length,0);assert.equal(state.groups[0].memberProfiles.applicant.nickname,'모임 별명');assert.equal(state.members.find(member=>member.id==='applicant').name,'계정 가입자');
 assert.deepEqual(state.groups[0].memberProfiles.applicant.answers,[{questionId:'question-one',question:'함께 하고 싶은 활동은?',answer:'같이 걷고 싶어요'}]);
 input.answers[0].answer='원본 변경';assert.equal(state.groups[0].memberProfiles.applicant.answers[0].answer,'같이 걷고 싶어요');
 const saved=structuredClone(state.groups[0].memberProfiles.applicant);joinGroupWithProfile(state,'g','applicant',joinDraft({nickname:'덮어쓰기 시도'}),publicGroupJoinVersion(state.groups[0]),undefined,at);assert.deepEqual(state.groups[0].memberProfiles.applicant,saved);assert.equal(isTogetherState(state),true);
});
test('blank optional direct profile is accepted only after rule confirmation, with no inferred preferences',()=>{
 const state=fixture();state.groups[0].joinFields=normalizeGroupJoinFields();const input={nickname:'',introduction:'',answers:[],availableTimes:[],rulesAccepted:true};
 deniedUnchanged(state,()=>joinGroupWithProfile(state,'g','applicant',{...input,rulesAccepted:false},publicGroupJoinVersion(state.groups[0]),undefined,at));
 assert.equal(joinGroupWithProfile(state,'g','applicant',input,publicGroupJoinVersion(state.groups[0]),undefined,at),true);assert.deepEqual(state.groups[0].memberProfiles.applicant,input);
});
test('approval request remains nonmember and approval copies the original scoped profile and question snapshot',()=>{
 const state=fixture('APPROVAL'),before=structuredClone(state);assert.equal(joinGroupWithProfile(state,'g','applicant',joinDraft(),publicGroupJoinVersion(state.groups[0]),undefined,at),false);
 const request=state.applications[0];assert.equal(request.status,'PENDING');assert.equal(state.groups[0].memberIds.includes('applicant'),false);assert.equal(state.groups[0].memberProfiles,undefined);assert.deepEqual(request.joinQuestions,joinFields().questions);
 state.groups[0].joinFields.questions[0].label='저장 후 바뀐 질문';approveGroupWithProfile(state,request.id,'owner');
 assert.equal(state.groups[0].memberIds.includes('applicant'),true);assert.equal(request.status,'APPROVED');assert.equal(state.groups[0].memberProfiles.applicant.answers[0].question,'함께 하고 싶은 활동은?');assert.deepEqual(state.groups[0].memberProfiles.applicant,request.joinProfile);assert.notEqual(state.groups[0].memberProfiles.applicant,request.joinProfile);
 assert.deepEqual(state.members,before.members);assert.deepEqual(state.groups[1],before.groups[1]);assert.deepEqual(state.activities,before.activities);assert.equal(isTogetherState(state),true);
});
test('changed joining questions, welcome or subtopic policy invalidates the previous confirmation before any membership write',()=>{
 for(const change of [group=>group.joinFields.questions[0].label='새 질문',group=>group.joinFields.welcome='새 환영',group=>group.discovery.subtopics=['WALK_COAST']]){
  const state=fixture(),version=publicGroupJoinVersion(state.groups[0]);change(state.groups[0]);deniedUnchanged(state,()=>joinGroupWithProfile(state,'g','applicant',joinDraft(),version,undefined,at));
 }
});
test('a duplicate pending request preserves its original id, profile and question labels instead of silently replacing answers',()=>{
 const state=fixture('APPROVAL'),version=publicGroupJoinVersion(state.groups[0]);joinGroupWithProfile(state,'g','applicant',joinDraft(),version,undefined,at);const original=structuredClone(state.applications[0]);
 joinGroupWithProfile(state,'g','applicant',joinDraft({nickname:'새 별명',introduction:'다른 인사',answers:[]}),version,undefined,new Date(at.getTime()+1000));assert.equal(state.applications.length,1);assert.deepEqual(state.applications[0],original);assert.equal(state.groups[0].memberIds.includes('applicant'),false);
});
test('denied actors, blocked/unpublished/archived groups and unauthorized approvals never leave partial membership/profile mutations',()=>{
 for(const userId of ['', 'missing-account']){const state=fixture();deniedUnchanged(state,()=>createConfiguredGroup(state,userId,normalizeGroupCreationDraft({name:'새 모임'}),at));deniedUnchanged(state,()=>joinGroupWithProfile(state,'g',userId,joinDraft(),publicGroupJoinVersion(state.groups[0]),undefined,at));}
 for(const change of [group=>group.blockedMemberIds=['applicant'],group=>group.archived=true,group=>group.promotionPublished=false]){const state=fixture();change(state.groups[0]);deniedUnchanged(state,()=>joinGroupWithProfile(state,'g','applicant',joinDraft(),publicGroupJoinVersion(state.groups[0]),undefined,at));}
 const state=fixture('APPROVAL');joinGroupWithProfile(state,'g','applicant',joinDraft(),publicGroupJoinVersion(state.groups[0]),undefined,at);deniedUnchanged(state,()=>approveGroupWithProfile(state,state.applications[0].id,'other'));
});
test('approval recovers a legacy answer label from its saved question snapshot without copying today\'s edited question or altering the old application',()=>{
 const state=fixture('APPROVAL');joinGroupWithProfile(state,'g','applicant',joinDraft(),publicGroupJoinVersion(state.groups[0]),undefined,at);
 const application=state.applications[0];delete application.joinProfile.answers[0].question;
 const originalProfile=structuredClone(application.joinProfile),snapshot=structuredClone(application.joinQuestions);
 state.groups[0].joinFields.questions[0].label='지금은 전혀 다른 질문';assert.equal(isTogetherState(state),true);
 approveGroupWithProfile(state,application.id,'owner');
 assert.equal(state.groups[0].memberProfiles.applicant.answers[0].question,snapshot[0].label);assert.notEqual(state.groups[0].memberProfiles.applicant.answers[0].question,state.groups[0].joinFields.questions[0].label);
 assert.deepEqual(application.joinProfile,originalProfile);assert.deepEqual(application.joinQuestions,snapshot);assert.equal(isTogetherState(state),true);
});
