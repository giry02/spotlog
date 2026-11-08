import test from 'node:test';
import assert from 'node:assert/strict';
import { applyGroupIntroductionDraft, buildGroupIntroductionDraft, groupCreationSubtopicLimit, normalizeGroupCreationDraft, validateGroupCreationBasics, validateGroupCreationDraft } from '../src/together/groupCreation.ts';
import { groupSubtopics } from '../src/together/groupTaxonomy.ts';
import { isGroupJoinDraft, isGroupJoinFields, normalizeGroupJoinDraft, normalizeGroupJoinFields, validateGroupJoinDraft } from '../src/together/groupJoining.ts';

const fields=()=>({questions:[{id:'q-one',label:'함께 해보고 싶은 활동은?'}],welcome:'반가워요',availableTimes:['WEEKEND_DAY']});
const creation=extra=>normalizeGroupCreationDraft({name:'우리 모임',kind:'FAMILY',region:'부산',district:'해운대구',categoryId:'TRAVEL',topics:['TRAVEL'],subcategoryIds:['TRAVEL_FAMILY'],joinMode:'APPROVAL',introduction:'내가 직접 쓴 소개',purpose:'가족끼리 시간 보내기',joinFields:fields(),...extra});

test('creation preserves chosen family/friends/guide kinds, joining policy, custom region, exact topics and original purpose',()=>{
 for(const kind of ['FAMILY','FRIENDS','HOBBY','GUIDE']) for(const joinMode of ['DIRECT','APPROVAL']) {
  const draft=creation({kind,joinMode,region:'우리의 해외 지역',district:'사용자가 정한 동네'}),before=structuredClone(draft);
  const valid=validateGroupCreationDraft(draft);assert.equal(valid.kind,kind);assert.equal(valid.joinMode,joinMode);assert.equal(valid.region,'우리의 해외 지역');assert.equal(valid.purpose,'가족끼리 시간 보내기');assert.deepEqual(valid.subcategoryIds,['TRAVEL_FAMILY']);assert.deepEqual(draft,before);
 }
 assert.equal(normalizeGroupCreationDraft().joinMode,'DIRECT');assert.equal(normalizeGroupCreationDraft().region,'');
});
test('the introduction helper uses only explicitly answered questions and never invents time, place, activity or another group',()=>{
 const answers={who:'친구 4명',activities:'직접 정한 관심 활동',atmosphere:'서로 편한 만큼',purpose:'자주 이야기하고 싶어서'};
 const before=structuredClone(answers),text=buildGroupIntroductionDraft(answers);
 for(const value of Object.values(answers))assert.ok(text.includes(value));
 assert.deepEqual(answers,before);assert.equal(/부산|맛집|단풍|토요일|주말|가입/.test(text),false);
 assert.equal(buildGroupIntroductionDraft({who:'',activities:'책 이야기',atmosphere:'',purpose:''}),'함께할 활동\n책 이야기');
 assert.throws(()=>buildGroupIntroductionDraft({who:'',activities:'',atmosphere:'',purpose:''}));
});
test('preview generation cannot overwrite authored introduction; explicit application changes only the introduction',()=>{
 const draft=creation(),before=structuredClone(draft);
 const preview=buildGroupIntroductionDraft({who:'우리 가족',activities:'직접 선택',atmosphere:'편하게',purpose:'가족끼리 시간 보내기'});
 assert.deepEqual(draft,before);assert.equal(draft.introduction,'내가 직접 쓴 소개');
 const applied=applyGroupIntroductionDraft(draft,`${preview}\n직접 수정한 문장`);
 const {introduction,...rest}=applied,{introduction:old,...original}=before;assert.deepEqual(rest,original);assert.equal(old,'내가 직접 쓴 소개');assert.ok(introduction.includes('직접 수정한 문장'));assert.deepEqual(draft,before);
 assert.throws(()=>applyGroupIntroductionDraft(draft,'x'.repeat(2001)));
});
test('creation validation rejects child categories from another parent, unbounded questions and malformed policies without mutating',()=>{
 for(const extra of [{name:' '},{kind:'UNKNOWN'},{joinMode:'UNKNOWN'},{categoryId:'UNKNOWN'},{subcategoryIds:['SPORTS_RUNNING']},{subcategoryIds:['TRAVEL_FAMILY','TRAVEL_FAMILY']},{region:'',district:'해운대구'},{introduction:'x'.repeat(2001)},{joinFields:{...fields(),questions:[1,2,3,4].map(id=>({id:`q-${id}`,label:`질문${id}`}))}}]) {
  const draft={...creation(),...extra},before=structuredClone(draft);assert.throws(()=>validateGroupCreationDraft(draft));assert.deepEqual(draft,before);
 }
 assert.doesNotThrow(()=>validateGroupCreationBasics(creation({region:'',district:''})));
 const dirty={...creation(),privateMemo:'원하지 않은 사적 내용'};assert.equal('privateMemo'in validateGroupCreationDraft(dirty),false);
});
test('all joining profile details are optional while only rule confirmation is required, independent of direct/approval choice',()=>{
 const optional=normalizeGroupJoinFields();const draft=normalizeGroupJoinDraft({},'계정 이름',optional);
 assert.equal(draft.nickname,'계정 이름');assert.equal(draft.introduction,'');assert.deepEqual(draft.answers,[]);assert.deepEqual(draft.availableTimes,[]);assert.equal(draft.rulesAccepted,false);
 assert.throws(()=>validateGroupJoinDraft(draft,optional),/확인/);
 const valid=validateGroupJoinDraft({...draft,nickname:'',rulesAccepted:true},optional);assert.equal(valid.nickname,'');assert.equal(valid.introduction,'');assert.deepEqual(valid.answers,[]);
 assert.equal(isGroupJoinDraft(valid),true);assert.equal(isGroupJoinFields(optional),true);
});
test('joining submission stores a current question-label snapshot and exact voluntary answers without altering global profile names',()=>{
 const settings=fields(),initial={nickname:'모임 별명',introduction:'반가워요',answers:[{questionId:'q-one',answer:'  같이 읽고 싶어요  '}],availableTimes:['FLEXIBLE'],rulesAccepted:true};
 const before=structuredClone(initial),valid=validateGroupJoinDraft(initial,settings);
 assert.equal(valid.nickname,'모임 별명');assert.deepEqual(valid.answers,[{questionId:'q-one',question:'함께 해보고 싶은 활동은?',answer:'같이 읽고 싶어요'}]);assert.deepEqual(initial,before);
 settings.questions[0].label='바뀐 질문';assert.equal(valid.answers[0].question,'함께 해보고 싶은 활동은?');assert.equal(isGroupJoinDraft(valid),true);
});
test('a withdrawn or changed question, duplicate answer, private extra field or invalid availability cannot enter a profile',()=>{
 const base={nickname:'',introduction:'',answers:[],availableTimes:[],rulesAccepted:true};
 for(const extra of [{answers:[{questionId:'removed',answer:'예전 답'}]},{answers:[{questionId:'q-one',answer:'A'},{questionId:'q-one',answer:'B'}]},{phone:'010-secret'},{availableTimes:['GPS_LOCATION']},{nickname:'x'.repeat(31)},{answers:[{questionId:'q-one',answer:'x'.repeat(501)}]}]) assert.throws(()=>validateGroupJoinDraft({...base,...extra},fields()));
 assert.equal(isGroupJoinDraft({...base,answers:[{questionId:'q-one',answer:'A',question:'x'.repeat(121)}]}),false);
 assert.equal(isGroupJoinFields({...fields(),questions:[{id:'q-one',label:'Q'},{id:'q-one',label:'Q2'}]}),false);
 assert.equal(isGroupJoinFields({...fields(),availableTimes:['WEEKEND_DAY','WEEKEND_DAY']}),false);
});
test('editing a legacy group preserves four or up to thirty-two exact subtopics through unrelated name changes without granting that limit to creation',()=>{
 const subtopics=['TRAVEL_FAMILY','TRAVEL_DOMESTIC','TRAVEL_DAY','TRAVEL_OVERSEAS'];
 const initial=creation({subcategoryIds:subtopics}),draft=normalizeGroupCreationDraft(initial);const before=structuredClone(draft);
 assert.deepEqual(draft.subcategoryIds,subtopics);const limit=groupCreationSubtopicLimit(initial,'EDIT');assert.equal(limit,4);
 const renamed=validateGroupCreationDraft({...draft,name:'바꾼 이름'},limit);assert.deepEqual(renamed.subcategoryIds,subtopics);assert.deepEqual(draft,before);
 assert.doesNotThrow(()=>validateGroupCreationDraft({...draft,subcategoryIds:subtopics.slice(0,3)},limit));
 assert.equal(groupCreationSubtopicLimit(initial,'CREATE'),3);assert.throws(()=>validateGroupCreationDraft(draft),/최대 3개/);
 assert.throws(()=>validateGroupCreationDraft({...draft,subcategoryIds:[...subtopics,'TRAVEL_SLOW']},limit),/최대 4개/);
 const large=normalizeGroupCreationDraft({name:'기존 여러 관심사',topics:[...new Set(groupSubtopics.map(item=>item.parent))],subcategoryIds:groupSubtopics.slice(0,32).map(item=>item.id)});
 assert.equal(groupCreationSubtopicLimit(large,'EDIT'),32);assert.equal(validateGroupCreationDraft({...large,name:'이름만 변경'},32).subcategoryIds.length,32);
 assert.throws(()=>validateGroupCreationDraft(large,33));
});
