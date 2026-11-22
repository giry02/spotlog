import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createPlanningAiHandler } from '../server/planningAiGateway.mjs';

const origin = 'http://127.0.0.1:5212';
const request = () => ({ schemaVersion:1, feature:'CHAT_SEARCH', requestId:'search-fixture',
  scope:{userId:'fictional-self',groupId:'fictional-group',roomId:'group:fictional-group'},
  payload:{question:'예약 담당자는 정해졌어?',filters:{scope:'all'},cutoff:'2026-11-23T03:00:00Z',sources:[
    {id:'ask',roomId:'group:fictional-group',authorId:'fictional-a',body:'예약은 누가 확인하나요?',createdAt:'2026-11-23T01:00:00Z'},
    {id:'undecided',roomId:'group:fictional-group',authorId:'fictional-b',body:'아직 담당자를 정하지 않았어요. 예약도 미정이에요.',createdAt:'2026-11-23T02:00:00Z'},
  ]} });

async function serve(t, output, options={}) {
  const calls=[];
  const handler=createPlanningAiHandler({catalog:[{id:'public-park',name:'가상 공원',kind:'LANDMARK',area:'서울'}],
    modelUrl:'http://127.0.0.1:8120/v1/chat/completions',allowedOrigin:origin,enableLocalChatSummary:true,...options,
    fetchImpl:async (_url, init)=>{calls.push(JSON.parse(init.body));return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(output)}}]});},
  });
  const server=createServer(async (req,res)=>{if(!await handler(req,res))res.writeHead(404).end();});
  t.after(()=>{server.closeAllConnections();return new Promise(resolve=>server.close(resolve));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {calls,post:(body, suppliedOrigin=origin)=>fetch(`http://127.0.0.1:${server.address().port}/api/chat-ai`,{
    method:'POST',headers:{'Content-Type':'application/json',Origin:suppliedOrigin},body:JSON.stringify(body),
  })};
}

test('question search reaches the model and returns exact cited message IDs in a scoped uncached response',async t=>{
  const app=await serve(t,{answer:'예약과 담당자는 아직 미정이에요.',unknown:false,refs:[2]});
  const response=await app.post(request());
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  assert.deepEqual(await response.json(),{schemaVersion:1,requestId:'search-fixture',scope:request().scope,
    output:{answer:'예약과 담당자는 아직 미정이에요.',unknown:false,sourceIds:['undecided']}});
  const data=JSON.parse(app.calls[0].messages[1].content);
  assert.equal(data.question,request().payload.question);
  assert.deepEqual(data.sources.map(source=>source.ref),[1,2]);
  assert.equal(data.cutoff,undefined);
  assert.equal(data.sources[0].writtenAt,request().payload.sources[0].createdAt);
  assert.ok(data.sources.every(source=>!('authorId' in source)&&/^p\d+$/.test(source.speaker)));
  assert.equal(app.calls[0].response_format.json_schema.name,'chat_search');
});

test('unknown answers remain explicitly unknown and carry no invented citation',async t=>{
  const app=await serve(t,{answer:'모델의 임의 설명',unknown:true,refs:[]});
  assert.deepEqual((await(await app.post(request())).json()).output,
    {answer:'선택한 대화에서는 확인하지 못했어요.',unknown:true,sourceIds:[]});
});

test('a known answer with no evidence or foreign reference fails closed',async t=>{
  const app=await serve(t,{answer:'예약 완료',unknown:false,refs:[999]});
  const response=await app.post(request());assert.equal(response.status,502);
  assert.deepEqual(await response.json(),{error:'INVALID_MODEL_RESULT'});
});

test('cross-room sources and more than 80 originals are rejected before model work',async t=>{
  const app=await serve(t,{answer:'irrelevant',unknown:true,refs:[]});
  const foreign=request();foreign.payload.sources[0].roomId='group:elsewhere';
  assert.equal((await app.post(foreign)).status,400);
  const large=request();large.payload.sources=Array.from({length:81},(_,i)=>({...large.payload.sources[0],id:`source-${i}`}));
  assert.equal((await app.post(large)).status,413);assert.equal(app.calls.length,0);
});

test('chat search stays local-only, explicitly enabled and origin-bound',async t=>{
  const app=await serve(t,{answer:'unknown',unknown:true,refs:[]});
  assert.equal((await app.post(request(),'https://unrelated.example')).status,403);
  const disabled=await serve(t,{}, {enableLocalChatSummary:false});
  assert.equal((await disabled.post(request())).status,404);assert.equal(disabled.calls.length,0);
  assert.throws(()=>createPlanningAiHandler({catalog:[{id:'park',name:'공원',area:'서울',kind:'LANDMARK'}],
    modelUrl:'http://127.0.0.1:8120/v1/chat/completions',allowedOrigin:'https://public.example',enableLocalChatSummary:true}),/loopback/);
});
