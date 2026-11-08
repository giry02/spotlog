import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { isTogetherState, createTogetherRepository, togetherStorageKey } from '../src/together/repository.ts';

const fields = () => ({ questions: [{ id:'welcome',label:'어떤 활동을 함께하고 싶나요?' }], welcome:'서로 배려해요.',availableTimes:['WEEKEND_DAY'] });
const profile = () => ({ nickname:'모임 이름표',introduction:'자기소개',answers:[{questionId:'welcome',question:'어떤 활동을 함께하고 싶나요?',answer:'가볍게 걷고 싶어요.'}],availableTimes:['WEEKEND_DAY'],rulesAccepted:true });
const group = () => ({ id:'g',name:'나의 모임',kind:'HOBBY',region:'부산',introduction:'',cover:'',ownerId:'me',memberIds:['me'],managerIds:[],archived:false,visibility:'PRIVATE',promotionPublished:false });
const state = () => { const value=createEmptyState('me','계정 이름');value.groups.push(group());return value; };
const application = () => ({id:'a',groupId:'g',userId:'applicant',status:'PENDING',joinProfile:profile(),joinQuestions:fields().questions});

test('optional join profiles keep old records valid and explicit group names separate from account identity', () => {
  const value=state();assert.equal(isTogetherState(value),true);
  value.groups[0].joinFields=fields();value.groups[0].memberProfiles={me:profile()};
  const before=structuredClone(value);assert.equal(isTogetherState(value),true);
  assert.equal(value.members[0].name,'계정 이름');assert.deepEqual(value,before);
  value.groups[0].memberProfiles={former:profile()};assert.equal(isTogetherState(value),true);
});

test('question snapshots retain old answer labels after a host changes current questions', () => {
  const value=state();value.groups[0].joinFields={...fields(),questions:[{id:'new-question',label:'새 질문'}]};value.applications.push(application());
  assert.equal(isTogetherState(value),true);
  value.applications[0].joinQuestions[0].label='다른 질문';assert.equal(isTogetherState(value),false);
  value.applications[0].joinQuestions=fields().questions;value.applications[0].joinProfile.answers[0].questionId='unknown';assert.equal(isTogetherState(value),false);
});

test('malformed join rules, unaccepted profiles, excessive answers and identity fields are rejected', () => {
  for (const bad of [null,{...fields(),questions:Array.from({length:4},(_,i)=>({id:`q${i}`,label:'질문'}))},{...fields(),availableTimes:['ANYTHING']},{...fields(),questions:[{id:'same',label:'하나'},{id:'same',label:'둘'}]}]) {
    const value=state();value.groups[0].joinFields=bad;assert.equal(isTogetherState(value),false);
  }
  for (const bad of [null,{...profile(),rulesAccepted:false},{...profile(),nickname:'가'.repeat(31)},{...profile(),answers:[{questionId:'q',answer:'가'.repeat(501)}]},{...profile(),email:'extra@example.invalid'}]) {
    const value=state();value.groups[0].memberProfiles={me:bad};assert.equal(isTogetherState(value),false);
    const applicant=state();applicant.applications.push({...application(),joinProfile:bad});assert.equal(isTogetherState(applicant),false);
  }
});

test('member profile maps are bounded and reject unsafe IDs without requiring currently active membership', () => {
  for (const id of ['', ' space ', 'bad\u0000id','constructor','__proto__']) {
    const value=state();value.groups[0].memberProfiles=Object.fromEntries([[id,profile()]]);assert.equal(isTogetherState(value),false);
  }
  const value=state();value.groups[0].memberProfiles=Object.fromEntries(Array.from({length:1001},(_,i)=>[`former${i}`,profile()]));assert.equal(isTogetherState(value),false);
});

test('rejected profile updates preserve the account snapshot and exact storage bytes', () => {
  const values=new Map([['unrelated-account','keep'],['spotlog.admin.store','admin-keep']]);const disk={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  const repo=createTogetherRepository('join-user','계정 이름',[],disk);
  assert.equal(repo.update(value=>{value.groups.push({...group(),joinFields:fields(),memberProfiles:{me:profile()}});value.applications.push(application());}),true);
  const before=structuredClone(repo.getSnapshot()),bytes=values.get(togetherStorageKey('join-user'));
  assert.equal(repo.update(value=>{value.applications.find(item=>item.id==='a').joinProfile.rulesAccepted=false;}),false);
  assert.deepEqual(repo.getSnapshot(),before);assert.equal(values.get(togetherStorageKey('join-user')),bytes);
  assert.equal(values.get('unrelated-account'),'keep');assert.equal(values.get('spotlog.admin.store'),'admin-keep');
});
