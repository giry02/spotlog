import test from 'node:test';
import assert from 'node:assert/strict';
import '../scripts/evaluate-chat.mjs';
const {createTripSession,appendTrip,currentTrip}=await import('../lib/trip-engine.ts');
const {buildModelInput}=await import('../lib/model-input.ts');
const {localFeatureTask}=await import('../lib/local-feature-intent.ts');
const {needsTravelRetrieval}=await import('../lib/chat-resources.ts');
const {predictLargeModel,readLargeModelConfig}=await import('../lib/large-model-adapter.ts');
const {applyModelReply}=await import('../lib/chat-contract.ts');
const config=readLargeModelConfig({LARGE_MODEL_PROVIDER:'ollama',LARGE_MODEL_NAME:'qwen3:14b'});
const resources={retrievalStatus:'empty',coverage:{sufficient:false,reason:'missing-evidence'},retrieval:{dataMode:'curated-travel-data',indexVersion:'idx:remaining-local',embeddingModel:'test',results:[]}};
function fixture(){let s=createTripSession();for(const a of [{type:'region',region:'부산'},{type:'configure',days:2,meals:false,cafes:false,lodging:false},{type:'build',visits:[{day:1,placeId:'public-busan-haeundae'},{day:1,placeId:'public-busan-dongbaek'},{day:2,placeId:'public-busan-gwangalli'}]},{type:'save'}])s=appendTrip(s,a);s=appendTrip(s,{type:'visit-details',id:currentTrip(s).plan[0].id,note:'PRIVATE_REMAINING_NOTE',time:'09:00',durationMinutes:60});return s;}
const request=(session,text)=>({protocolVersion:1,requestId:'remaining-model',sessionId:'remaining-model',baseRevision:session.turns.at(-1).id,session,action:{type:'message',text}});
async function predict(input,actions){return predictLargeModel(input,config,async(url,init)=>{if(String(url).endsWith('/api/show'))return Response.json({details:{format:'gguf',parameter_size:'14.8B',quantization_level:'Q4_K_M'}});assert.ok(String(url).endsWith('/api/chat'));return Response.json({done:true,done_reason:'stop',message:{content:JSON.stringify({message:'확인한 기능 화면으로 이어갈 수 있어요.',actions})}});},resources);}
const navCases=[
 ['공개 장소 카드 좋아요 반응 창만 열어줘. 반응은 직접 누를게.','community','place-reaction'],
 ['공개 여행기 전체 댓글 창을 보여줘. 댓글 전송은 하지 마.','community','journey-comment'],
 ['다른 사람의 공개 여행기 응원 창만 열어줘.','community','journey-cheer'],
 ['내 프로필 요약 화면 열어줘.','profile','profile-summary'],
 ['내 기기 활동 통계 화면 보여줘.','profile','profile-activity'],
];
test('social/profile requests use app-only model context before public-course discovery, without private notes or fabricated counts',()=>{
 const s=fixture();for(const [text] of navCases){const r=request(s,text);assert.equal(localFeatureTask(r),'app');assert.equal(needsTravelRetrieval(r),false);const context=buildModelInput(r).question.context;assert.deepEqual(context.allowedToolTypes,['open_spotlog']);assert.ok(context.appEntries.length>=16);assert.ok(!('publicCourses'in context));assert.ok(!('offlineTrips'in context));assert.ok(!JSON.stringify(context).includes('PRIVATE_REMAINING_NOTE'));assert.ok(!('memberStatistics'in context));}
});
test('preserving other visit order does not steal a metadata or DAY edit request',()=>{
 const s=fixture();for(const text of ['여행 이름을 부산 검수로 바꿔줘. 다른 방문과 순서는 그대로 둬.','DAY 1 첫 방문 메모를 산책으로 수정해줘. 나머지 방문과 날짜별 순서는 그대로 유지해줘.']){const r=request(s,text);assert.notEqual(localFeatureTask(r),'reorder');assert.equal(buildModelInput(r).question.context.task,'known-trip-editor');}
});
test('no-RAG app destination requests preserve private itinerary, saved originals and favorites',async()=>{
 const s=fixture(),before=structuredClone(s);for(const [text,target,entry] of navCases){const r=request(s,text),reply=await predict(r,[{type:'open_spotlog',target,entry}]);const next=applyModelReply(r,reply,'large-model');assert.deepEqual(currentTrip(next).spotlogNavigation,{target,entry});assert.deepEqual(currentTrip(next).plan,currentTrip(s).plan);assert.deepEqual(next.library,s.library);assert.deepEqual(currentTrip(next).savedIds,currentTrip(s).savedIds);}assert.deepEqual(s,before);
});
test('app navigation cannot acquire a different reaction, original mutation, source ID or automatic submission',async()=>{
 const s=fixture(),r=request(s,'내 프로필 요약 화면 열어줘.');for(const action of [{type:'open_spotlog',target:'community',entry:'journey-cheer'},{type:'open_spotlog',target:'profile',entry:'profile-summary',journeyId:'invented-source'},{type:'trip-meta',title:'무관한 원본 변경'}])await assert.rejects(predict(r,[action]),{code:'LARGE_MODEL_READONLY_VIOLATION'});
 await assert.rejects(predict(r,[{type:'open_spotlog',target:'profile',entry:'profile-summary',submit:true}]),{code:'MODEL_OUTPUT_INVALID'});
});
test('reordering known visits uses only current state, without unrelated catalogs or tourism retrieval',async()=>{
 const s=fixture(),r=request(s,'DAY 1 방문 순서를 반대로 바꿔줘. 여행명과 메모는 그대로 둬.');assert.equal(localFeatureTask(r),'reorder');assert.equal(needsTravelRetrieval(r),false);const context=buildModelInput(r).question.context;assert.deepEqual(context.allowedToolTypes,['show','reorder-visits']);assert.ok(!('media'in context));assert.ok(!('savedTrips'in context));
 const ids=currentTrip(s).plan.filter(v=>v.day===1).map(v=>v.id).reverse();const reply=await predict(r,[{type:'reorder-visits',day:1,ids}]);const next=applyModelReply(r,reply,'large-model');assert.deepEqual(currentTrip(next).plan.filter(v=>v.day===1).map(v=>v.id),ids);assert.deepEqual(currentTrip(next).plan.filter(v=>v.day===2),currentTrip(s).plan.filter(v=>v.day===2));for(const visit of currentTrip(s).plan)assert.deepEqual(currentTrip(next).plan.find(v=>v.id===visit.id),visit);assert.deepEqual(next.library,s.library);
 await assert.rejects(predict(r,[{type:'build',visits:[{day:1,placeId:'hallasan'}]}]),{code:'LARGE_MODEL_READONLY_VIOLATION'});
});
