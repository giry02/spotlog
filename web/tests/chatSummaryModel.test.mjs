import test from 'node:test';
import assert from 'node:assert/strict';
import { chatSummaryModelInput, normalizeChatSummaryRequest, validateChatSummaryResult } from '../server/chatSummaryModel.mjs';

const scope = { userId: 'self', groupId: 'reading-group', roomId: 'activity:book-night' };
const request = () => ({
  schemaVersion: 1, requestId: 'summary-test', feature: 'CHAT_SUMMARY', scope,
  payload: { purpose: 'KEY_POINTS', filters: { scope: 'all' }, cutoff: '2026-11-19T03:00:00.000Z',
    sources: [
      { id: 'second', authorId: 'member-secret-b', roomId: scope.roomId, body: '물은 각자 챙겨 주세요.', createdAt: '2026-11-19T02:00:00.000Z', avatar: 'private-avatar', introduction: 'private-intro' },
      { id: 'first', authorId: 'member-secret-a', roomId: scope.roomId, body: '12시에 정문에서 만나요.', createdAt: '2026-11-19T01:00:00.000Z' },
    ] },
});
const goodOutput = () => ({ title: '만남과 준비', sections: [
  { kind: 'TIME_PLACE', items: [{ text: '12시에 정문에서 만나요.', refs: [1] }] },
  { kind: 'PREPARATION', items: [{ text: '물은 각자 챙겨요.', refs: [2, 2] }] },
] });

test('normalization copies only chosen same-room originals in chronological order without mutating the request', () => {
  const input = request(), before = structuredClone(input);
  const normalized = normalizeChatSummaryRequest(input);
  assert.deepEqual(normalized.scope, scope);
  assert.deepEqual(normalized.sources.map(source => source.id), ['first', 'second']);
  assert.deepEqual(Object.keys(normalized.sources[0]), ['id', 'authorId', 'body', 'createdAt']);
  assert.equal(JSON.stringify(normalized).includes('private-'), false);
  assert.deepEqual(input, before);
});

test('the model receives pseudonymous speakers, ref numbers and selected text without account or message metadata', () => {
  const input = normalizeChatSummaryRequest(request());
  const model = chatSummaryModelInput(input);
  assert.equal(model.data.order,'OLDEST_TO_NEWEST');
  assert.deepEqual(model.data.sources.map(source => source.speaker), ['p1', 'p2']);
  assert.deepEqual(model.data.sources.map(source => source.ref), [1, 2]);
  assert.deepEqual(model.data.sources.map(source => source.body), input.sources.map(source => source.body));
  assert.equal(Object.hasOwn(model.data,'cutoff'),false);
  assert.equal(model.data.sources.some(source=>Object.hasOwn(source,'at')),false);
  const serialized = JSON.stringify(model);
  for (const secret of ['member-secret-a', 'member-secret-b', 'reading-group', 'book-night', 'summary-test', 'private-avatar', 'private-intro']) {
    assert.equal(serialized.includes(secret), false, secret);
  }
  assert.equal(model.schema.properties.sections.items.properties.items.items.properties.refs.items.maximum, 2);
});

test('output citations resolve only source refs and deduplicate citations while retaining readable semantic sections', () => {
  const output = validateChatSummaryResult(normalizeChatSummaryRequest(request()), goodOutput());
  assert.deepEqual(output, { title: '만남과 준비', sections: [
    { kind: 'TIME_PLACE', heading: '시간·집결 위치', items: [{ text: '12시에 정문에서 만나요.', sourceIds: ['first'] }] },
    { kind: 'PREPARATION', heading: '준비할 일', items: [{ text: '물은 각자 챙겨요.', sourceIds: ['second'] }] },
  ] });
});

test('invalid scope, other room, duplicate IDs, future originals and unmatched selected author fail before model input', () => {
  const mutations = [
    body => { body.scope = { ...scope, roomId: 'group:some-other-group' }; },
    body => { body.payload.sources[0].roomId = 'activity:other-room'; },
    body => { body.payload.sources[1].id = body.payload.sources[0].id; },
    body => { body.payload.sources[0].createdAt = '2026-11-19T03:00:00.001Z'; },
    body => { body.payload.sources[0].createdAt = 'invalid'; },
    body => { body.payload.filters.authorId = 'member-secret-a'; },
    body => { body.payload.purpose = 'PERSON'; },
    body => { body.payload.filters.scope = 'not-a-scope'; },
    body => { body.payload.sources = []; },
    body => { body.payload.sources[0].body = '\u0000hidden'; },
  ];
  for (const mutate of mutations) {
    const body = request(); mutate(body);
    assert.throws(() => normalizeChatSummaryRequest(body), error => error.status === 400, JSON.stringify(body));
  }
  const selected = request();
  selected.payload.purpose = 'PERSON';
  selected.payload.filters.authorId = 'member-secret-a';
  selected.payload.sources = [selected.payload.sources[1]];
  assert.equal(normalizeChatSummaryRequest(selected).sources.length, 1);
});

test('large source ranges are rejected instead of silently cut before summarizing', () => {
  const tooMany = request();
  tooMany.payload.sources = Array.from({ length: 81 }, (_, index) => ({ ...request().payload.sources[0], id: 'source-' + index }));
  assert.throws(() => normalizeChatSummaryRequest(tooMany), error => error.status === 413 && error.message === 'CHAT_RANGE_TOO_LARGE');
  const tooLong = request();
  tooLong.payload.sources = Array.from({ length: 3 }, (_, index) => ({ ...request().payload.sources[0], id: 'source-' + index, body: '가'.repeat(5000) }));
  assert.throws(() => normalizeChatSummaryRequest(tooLong), error => error.status === 413 && error.message === 'CHAT_RANGE_TOO_LARGE');
});

test('missing, out-of-range, fractional or metadata-shaped references and malformed model text fail closed', () => {
  const input = normalizeChatSummaryRequest(request());
  for (const refs of [[], [0], [3], [1.5], ['first'], [{ id: 'first' }]]) {
    const output = goodOutput(); output.sections[0].items[0].refs = refs;
    assert.throws(() => validateChatSummaryResult(input, output), /INVALID_MODEL_RESULT/);
  }
  for (const mutate of [
    output => { output.title = ''; }, output => { output.sections[0].kind = '__proto__'; },
    output => { output.sections[0].items[0].text = '가'.repeat(241); }, output => { output.sections = []; },
    output => { output.sections = Array.from({ length: 5 }, () => ({ kind: 'OTHER', items: Array.from({ length: 4 }, () => ({ text: '요약', refs: [1] })) })); },
  ]) {
    const output = goodOutput(); mutate(output);
    assert.throws(() => validateChatSummaryResult(input, output), /INVALID_MODEL_RESULT/);
  }
});

test('mixed timestamp offsets are ordered by the instant before model ref numbers are assigned', () => {
  const body = request();
  body.payload.sources = [
    { id: 'later', roomId: scope.roomId, authorId: 'member-secret-b', body: '나중 발언', createdAt: '2026-11-19T00:45:00Z' },
    { id: 'earlier', roomId: scope.roomId, authorId: 'member-secret-a', body: '먼저 발언', createdAt: '2026-11-19T09:30:00+09:00' },
  ];
  assert.deepEqual(normalizeChatSummaryRequest(body).sources.map(source => source.id), ['earlier', 'later']);
});

test('structured speaker references resolve to scoped source authors without exposing names to the model', () => {
  const body = request(); body.payload.sources[0].body = '제가 삼각대를 챙길게요.';
  const input = normalizeChatSummaryRequest(body), output = goodOutput();
  output.sections[1].items[0] = { text: '삼각대 지참', refs: [2], speaker: 'p2', volunteered: true };
  const result = validateChatSummaryResult(input, output);
  assert.deepEqual(result.sections[1].items[0], { text: '삼각대 지참', sourceIds: ['second'], speakerId: 'member-secret-b', volunteered: true });
  assert.deepEqual(chatSummaryModelInput(input).schema.properties.sections.items.properties.items.items.properties.speaker.enum, ['', 'p1', 'p2']);
  for (const speaker of ['p1', 'p3', 'member-secret-b', 'p02']) {
    output.sections[1].items[0].speaker = speaker;
    assert.throws(() => validateChatSummaryResult(input, output), /INVALID_MODEL_RESULT/);
  }
  output.sections[1].items[0].speaker = 'p2';
  input.sources[1].body = '삼각대를 누가 가져오나요?';
  assert.equal(validateChatSummaryResult(input, output).sections[1].items[0].volunteered,undefined);
  output.sections[1].items[0].text='p2가 삼각대를 맡기로 확정';
  assert.throws(() => validateChatSummaryResult(input, output), /INVALID_MODEL_RESULT/);
});

test('an explicit volunteer sentence survives another sentence suggestion without assigning shared preparations',()=>{
  const body=request();body.payload.sources[0].body='준비물은 각자 물과 편한 신발을 챙기면 좋겠어요. 저는 우산도 가져갈게요.';
  const input=normalizeChatSummaryRequest(body),output=goodOutput();
  assert.deepEqual(chatSummaryModelInput(input).data.sources[1].volunteerEvidence,['저는 우산도 가져갈게요.']);
  output.sections[1].items[0]={text:'우산 지참',refs:[2],speaker:'p2',volunteered:true};
  assert.equal(validateChatSummaryResult(input,output).sections[1].items[0].volunteered,true);
  output.sections[1].items[0].text='물과 편한 신발과 우산 준비';
  assert.equal(validateChatSummaryResult(input,output).sections[1].items[0].volunteered,undefined);
  output.sections[1].items[0].text='p2가 예약 담당하기로 확정';
  assert.throws(()=>validateChatSummaryResult(input,output),/INVALID_MODEL_RESULT/);
});

test('unsupported optional volunteering decoration is omitted without changing grounded text or trusting uncited speakers',()=>{
  const input=normalizeChatSummaryRequest(request()),output=goodOutput();
  output.sections[0].items[0]={text:'12시에 정문에서 만나요.',refs:[1],speaker:'p1',volunteered:true};
  const result=validateChatSummaryResult(input,output);
  assert.equal(result.sections[0].items[0].text,'12시에 정문에서 만나요.');
  assert.equal(result.sections[0].items[0].speakerId,'member-secret-a');
  assert.equal(result.sections[0].items[0].volunteered,undefined);
  output.sections[0].items[0].speaker='p2';
  assert.throws(()=>validateChatSummaryResult(input,output),/INVALID_MODEL_RESULT/);
});

test('supported pseudonymous volunteering prose becomes scoped profile attribution, never a literal p label or first person',()=>{
  const body=request();body.payload.sources[0].body='사진 찍을 때 쓸 작은 삼각대는 제가 가져갈게요.';
  const input=normalizeChatSummaryRequest(body),output=goodOutput();
  output.sections[1].items[0]={text:'작은 삼각대는 p2가 가져갈 예정',refs:[2],speaker:'p2',volunteered:true};
  const item=validateChatSummaryResult(input,output).sections[1].items[0];
  assert.equal(item.text,'작은 삼각대는 가져갈 예정');assert.equal(item.speakerId,'member-secret-b');assert.equal(item.volunteered,true);
  output.sections[1].items[0].text='작은 삼각대는 제가 가져갈게요.';
  assert.equal(validateChatSummaryResult(input,output).sections[1].items[0].text,'작은 삼각대는 가져갈게요.');
  output.sections[1].items[0].text='작은 삼각대는 p1가 가져갈 예정';
  assert.throws(()=>validateChatSummaryResult(input,output),/INVALID_MODEL_RESULT/);
});

test('volunteering questions, refusal and an unrelated cited task never grant an assignment',()=>{
  for(const message of ['제가 우산을 가져갈까요?','제가 우산을 가져갈 수 있어요.','제가 우산은 못 가져가요.']){
    const body=request();body.payload.sources[0].body=message;
    const input=normalizeChatSummaryRequest(body),output=goodOutput();
    assert.deepEqual(chatSummaryModelInput(input).data.sources[1].volunteerEvidence,[]);
    output.sections[1].items[0]={text:'우산 지참',refs:[2],speaker:'p2',volunteered:true};
    assert.equal(validateChatSummaryResult(input,output).sections[1].items[0].volunteered,undefined);
  }
});
