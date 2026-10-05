import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPersonalPlan,addPlanDay,removePlanDay,setPlanDates,insertNearby,transferVisit,copyPlanDay,makeJournalFromPlan,setPlanStay,reorderPlanVisit,appendPlanLandmark} from '../src/tripPlan.ts';
import {journalDraftValue,stashJournalDraft,finishJournalDraft,moveJournalBlock,patchJournalDay} from '../src/journalDraft.ts';
import {cardKey,emptyThread,saveCardComment,deleteCardComment,getCardCommentGroups,isCardSocialStore,CARD_SOCIAL_KEY} from '../src/cardSocialState.ts';
import {createLocalRepository,REPOSITORY_KEY,PLACE_DIRECTORY_KEY} from '../src/localRepository.ts';
const place=(id,kind='LANDMARK')=>({id,kind,name:id,area:'제주',address:'제주 제주시',image:'',description:'',note:'자료의 예시 메모',time:'12:30',lat:33.4,lng:126.3,duration:'1시간'});
const plan=()=>buildPersonalPlan([place('A'),place('B')],2,'검수','검수 사용자');
class Storage {data=new Map();fail=false;getItem(key){return this.data.get(key)??null;}setItem(key,value){if(this.fail&&key===REPOSITORY_KEY)throw new DOMException('Full','QuotaExceededError');this.data.set(key,value);}removeItem(key){this.data.delete(key);}}
test('place comments show newest roots first and chronological replies without moving edited roots',()=>{
  const comments=Array.from({length:12},(_,i)=>({id:`root-${i}`,authorId:'me',author:'나',body:`댓글 ${i}`,createdAt:new Date(Date.UTC(2026,8,15,0,i)).toISOString()}));
  comments.push({...comments[0],id:'reply-new',parentId:'root-0',createdAt:'2026-09-15T01:00:00Z'}, {...comments[0],id:'reply-old',parentId:'root-0',createdAt:'2026-09-15T00:30:00Z'});
  const original=structuredClone(comments),groups=getCardCommentGroups(comments);
  assert.deepEqual(groups.slice(0,10).map(item=>item.comment.id),Array.from({length:10},(_,i)=>`root-${11-i}`));
  assert.deepEqual(groups.at(-1).replies.map(item=>item.id),['reply-old','reply-new']);
  assert.deepEqual(comments,original);
  const edited=saveCardComment({likes:[],comments},{id:'me',name:'나'},'오래된 댓글 수정',undefined,'root-0');
  assert.equal(getCardCommentGroups(edited.comments).at(-1).comment.id,'root-0');
  const sameTime=[{...comments[0],id:'first'},{...comments[0],id:'second'}];
  assert.deepEqual(getCardCommentGroups(sameTime).map(item=>item.comment.id),['second','first']);
});
test('profile icons persist on new comments and legacy comments remain compatible',()=>{
  const user={id:'me',name:'여행자',avatar:'data:image/png;base64,aWNvbg=='},key=cardKey('journey','place');
  let thread=saveCardComment(emptyThread(),user,'아이콘이 있는 댓글');
  assert.equal(thread.comments[0].avatar,user.avatar);
  thread=saveCardComment(thread,user,'답글',thread.comments[0].id);
  const repo=createLocalRepository(new Storage());
  assert.equal(repo.setItem(CARD_SOCIAL_KEY,JSON.stringify({[key]:thread})),true);
  assert.equal(JSON.parse(repo.getItem(CARD_SOCIAL_KEY))[key].comments[1].avatar,user.avatar);
  assert.equal(isCardSocialStore({[key]:{...thread,comments:thread.comments.map(({avatar,...comment})=>comment)}}),true);
  assert.equal(isCardSocialStore({[key]:{...thread,comments:[{...thread.comments[0],avatar:123}]}}),false);
  assert.equal(isCardSocialStore({[key]:{...thread,likes:[{...user,avatar:123}]}}),false);
});
test('calendar dates survive DAY addition, copy and removal across year boundary',()=>{
  let j=setPlanDates(plan(),'2026-12-31');const first=j.days[0].dayId;
  j=addPlanDay(j);assert.equal(j.days[2].date,'2027-01-02');
  j=copyPlanDay(j,first);assert.equal(j.days[3].date,'2027-01-03');
  j=removePlanDay(j,j.days[1].dayId);assert.equal(j.dateRange,'2026-12-31 ~ 2027-01-02');assert.equal(j.days[0].dayId,first);
  assert.throws(()=>setPlanDates(j,'2026-02-30'));assert.deepEqual(setPlanDates(j,'').days.map(day=>day.date),['DAY 1','DAY 2','DAY 3']);
});
test('new plans never inherit invented arrival times and authored sample notes',()=>{
  const j=plan();assert.equal(j.days[0].places[0].time,undefined);assert.equal(j.days[0].places[0].note,'');
});
test('legacy journal day labels and dates are not rewritten when a DAY is added or removed',()=>{
  const j={...plan(),purpose:'JOURNAL',dateRange:'2025년 여름 여행'};j.days[0].date='여름의 첫날';j.days[1].date='다음 날';
  const next=removePlanDay(addPlanDay(j),j.days[1].dayId);assert.equal(next.dateRange,j.dateRange);assert.deepEqual(next.days.map(day=>day.date),['여름의 첫날','DAY 2']);
});
test('journal card reordering updates route order while preserving cards and media identity',()=>{
  const j=makeJournalFromPlan(buildPersonalPlan([place('A'),place('B')],1,'여행','나'),'나'),day=j.days[0];
  const next=patchJournalDay(j,1,{blocks:[...day.blocks].reverse()});assert.deepEqual(next.days[0].places.map(place=>place.id),['B','A']);assert.equal(next.days[0].blocks[0].id,day.blocks[1].id);assert.deepEqual(j.days[0].places.map(place=>place.id),['A','B']);
});
test('saving a personal place and membership is atomic and its coordinates remain unknown after reload',()=>{
  const storage=new Storage(),repo=createLocalRepository(storage),saved='spotlog.web.saved.v3',entry={...place('personal','FOOD'),lat:null,lng:null,locationVerified:false,personal:true};
  assert.equal(repo.setItems({[saved]:JSON.stringify(['personal']),[PLACE_DIRECTORY_KEY]:JSON.stringify([entry])}),true);
  const reload=createLocalRepository(storage);assert.deepEqual(JSON.parse(reload.getItem(PLACE_DIRECTORY_KEY)),[entry]);storage.fail=true;
  assert.equal(repo.setItems({[saved]:JSON.stringify(['personal','another']),[PLACE_DIRECTORY_KEY]:JSON.stringify([entry,place('another','FOOD')])}),false);assert.deepEqual(JSON.parse(repo.getItem(saved)),['personal']);
});
test('linked text and multiple photos move with exact visit and copies start independent threads',()=>{
  let j=plan();const from=j.days[0],to=j.days[1],anchor=from.places[0];
  j=insertNearby(j,from.dayId,anchor.visitId,place('cafe','CAFE'));
  j.days[0].blocks.push({id:'text',type:'TEXT',body:'내 기록',visitId:anchor.visitId},{id:'photos',type:'IMAGE',visitId:anchor.visitId,images:[{id:'p1',image:'data:image/png;base64,a',caption:'1'},{id:'p2',image:'data:image/png;base64,b',caption:'2'}]});
  const before=structuredClone(j),moved=transferVisit(j,from.dayId,anchor.visitId,to.dayId,false);
  assert.deepEqual(j,before);assert.equal(moved.days[0].places.length,0);assert.ok(moved.days[1].blocks.some(block=>block.id==='photos'));
  const copied=transferVisit(j,from.dayId,anchor.visitId,to.dayId,true),block=copied.days[1].blocks.find(block=>block.type==='IMAGE');
  assert.notEqual(block.id,'photos');assert.notEqual(block.images[0].id,'p1');assert.equal(block.visitId,copied.days[1].places.find(p=>p.id==='A').visitId);
  assert.notEqual(cardKey(j.id,'photos'),cardKey(j.id,block.id));
});
test('standalone photo move preserves card identity while releasing an unavailable visit link',()=>{
  const j=plan();j.days[0].blocks.push({id:'photo',type:'IMAGE',visitId:j.days[0].places[0].visitId,images:[{id:'media',image:'photo.jpg',caption:'사진'}]});
  const next=moveJournalBlock(j,j.days[0].dayId,'photo',j.days[1].dayId,false),block=next.days[1].blocks.at(-1);
  assert.equal(block.id,'photo');assert.equal(block.images[0].id,'media');assert.equal(block.visitId,undefined);assert.equal(j.days[0].blocks.length,2);
});
test('stays remain at the end when landmarks are inserted, reordered or moved in',()=>{
  let j=plan();j=setPlanStay(j,place('hotel','STAY'),j.days[0].dayId,1,true);
  j=appendPlanLandmark(j,j.days[0].dayId,place('C'));assert.equal(j.days[0].places.at(-1).kind,'STAY');
  j=reorderPlanVisit(j,j.days[0].dayId,j.days[0].places[1].visitId,1);assert.equal(j.days[0].places.at(-1).id,'hotel');
  j=transferVisit(j,j.days[1].dayId,j.days[1].places[0].visitId,j.days[0].dayId,false);assert.deepEqual(j.days[0].places.map(p=>p.id),['A','C','B','hotel']);
});
test('copying an overnight DAY preserves the original booking and adds a departure DAY without claiming another reservation',()=>{
  let j=plan();j=setPlanStay(j,place('hotel','STAY'),j.days[0].dayId,1,true);const copy=copyPlanDay(j,j.days[0].dayId);
  assert.equal(copy.days.length,4);assert.equal(copy.days[0].places.at(-1).bookingFixed,true);assert.equal(copy.days[2].places.at(-1).bookingFixed,false);assert.equal(copy.days[3].places.length,0);
  assert.throws(()=>removePlanDay(j,j.days[1].dayId));assert.equal(j.days.length,2);
});
test('autosaved journal drafts survive reload without modifying published content; quota failure retains the last draft',()=>{
  const storage=new Storage(),repo=createLocalRepository(storage),key='spotlog.web.journeys.v4';
  const original={...makeJournalFromPlan(plan(),'나'),status:'PUBLISHED',visibility:'PUBLIC',story:'발행한 본문'};
  const edited={...original,title:'작성 중 제목',story:'작성 중 본문'};
  const stashed=stashJournalDraft(original,edited);assert.equal(stashed.story,'발행한 본문');assert.equal(stashed.status,'PUBLISHED');
  assert.equal(repo.setItem(key,JSON.stringify([stashed])),true);
  const reloaded=JSON.parse(createLocalRepository(storage).getItem(key))[0];assert.equal(journalDraftValue(reloaded).story,'작성 중 본문');
  storage.fail=true;assert.equal(repo.setItem(key,JSON.stringify([stashJournalDraft(original,{...edited,story:'실패한 저장'})])),false);assert.equal(JSON.parse(repo.getItem(key))[0].editorDraft.value.story,'작성 중 본문');
  assert.equal(finishJournalDraft(edited).editorDraft,undefined);assert.throws(()=>finishJournalDraft({...edited,title:' '}));assert.throws(()=>stashJournalDraft(original,{...edited,id:'different'}));
});
test('card comments, replies, drafts and likes remain isolated per journey and block after reload',()=>{
  const storage=new Storage(),repo=createLocalRepository(storage),user={id:'me',name:'나'},other={id:'other',name:'다른 여행자'};
  let thread=saveCardComment(emptyThread(),other,'원댓글'),root=thread.comments[0].id;
  thread=saveCardComment(thread,user,'답글',root);thread={...thread,likes:[{id:'me',name:'나'}],draft:{body:'아직 작성 중',parentId:root}};
  const store={[cardKey('journal1','card1')]:thread,[cardKey('journal2','card1')]:emptyThread(),[cardKey('journal1','card2')]:emptyThread()};
  assert.equal(repo.setItem(CARD_SOCIAL_KEY,JSON.stringify(store)),true);assert.deepEqual(JSON.parse(createLocalRepository(storage).getItem(CARD_SOCIAL_KEY)),JSON.parse(JSON.stringify(store)));
  assert.throws(()=>deleteCardComment(thread,'me',root));assert.throws(()=>saveCardComment(thread,user,'수정',undefined,root));
  const deleted=deleteCardComment(thread,'other',root);assert.equal(deleted.comments[0].body,'');assert.equal(deleted.comments[1].body,'답글');assert.equal(deleted.comments.filter(c=>!c.deleted).length,1);
  const edited=saveCardComment(thread,user,'답글 수정',root,thread.comments[1].id);assert.equal(edited.comments.length,2);assert.equal(edited.comments[1].body,'답글 수정');assert.equal(edited.draft,undefined);
});
test('malformed draft and photo shapes cannot overwrite the repository',()=>{
  const repo=createLocalRepository(new Storage()),key='spotlog.web.journeys.v4',j=plan();assert.equal(repo.setItem(key,JSON.stringify([j])),true);
  const bad=structuredClone(j);bad.days[0].blocks.push({id:'bad',type:'IMAGE',images:[{image:123}]});assert.equal(repo.setItem(key,JSON.stringify([bad])),false);
  assert.equal(repo.setItem(key,JSON.stringify([{...j,editorDraft:{updatedAt:'now',value:{...j,id:'wrong'}}}])),false);assert.deepEqual(JSON.parse(repo.getItem(key)),JSON.parse(JSON.stringify([j])));
});
