/** Synthetic DTO fixtures; never copies customer storage or calls a service. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from '../../../node_modules/typescript/lib/typescript.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(dir, '../../..');
const bundle = JSON.parse(fs.readFileSync(path.join(dir, 'schemas.json'), 'utf8'));
function readSeed(name, functionName) {
  const source = fs.readFileSync(path.join(repo, 'web/src/admin', name), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  new Function('exports', compiled.outputText)(exports);
  return exports[functionName]();
}
const rights = { display: true, store: true, modify: true, ai: true };
const content = {
  kind: 'LANDMARK', name: '가상 검수 장소', companyId: '', area: '부산 · 검수 자료', address: '가상 검수 주소 — 실제 방문용 아님', description: 'DTO 형식 검사용 가상 자료입니다.', tags: ['검수'], operation: 'OPEN',
  location: { lat: 35.16, lng: 129.16, verified: true, reference: '검수용 가상 좌표', sourceUrl: 'https://example.org/spotlog-review', checkedAt: '2026-10-05' },
  rights, provider: 'Spotlog 검수 자료', sourceUrl: 'https://example.org/spotlog-review', checkedAt: '2026-10-05',
  media: [{ mediaId: 'review-media', type: 'PHOTO', url: '/admin-review.svg', caption: '검수용 도형', alt: '가상 검수 장소 도형', cover: true, provider: 'Spotlog 검수 자료', author: 'Spotlog', sourceUrl: 'https://example.org/spotlog-review', license: '자체 검수용 도형', licenseUrl: 'https://example.org/spotlog-review', checkedAt: '2026-10-05', rights, withdrawn: false }],
  guide: { hours: '', bestTime: '', facilities: '', menu: '', lodging: '', access: '', english: 'Synthetic place for contract review.', englishStatus: 'REVIEWED', sourceUrl: 'https://example.org/spotlog-review', checkedAt: '2026-10-05', sourceRevision: 1 },
  ai: { text: 'DTO 형식 검사용 가상 자료입니다.', tags: ['검수'], sourceUrl: 'https://example.org/spotlog-review', provider: 'Spotlog 검수 자료', checkedAt: '2026-10-05', allowed: true, version: 1 },
};
const state = { schemaVersion: 1, revision: 1, places: [{ placeId: 'review-landmark', revision: 1, state: 'PUBLISHED', draft: content, published: structuredClone(content), revoked: false, updatedAt: '2026-10-05T00:00:00.000Z' }], nearbyOverrides: [], ai: readSeed('aiSeed.ts', 'makeAiSeed'), ops: readSeed('opsSeed.ts', 'makeOpsSeed'), audit: [], processedCommands: [] };
state.regions = [{regionId:'kr',name:'대한민국',level:'COUNTRY',enabled:true,revision:1},{regionId:'kr-busan',name:'부산',parentId:'kr',level:'PROVINCE',enabled:true,revision:1}];
state.places[0].draft.regionId='kr-busan';state.places[0].published.regionId='kr-busan';
state.places[0].meta={createdById:'review-admin',assignedToId:'review-operator',reviewStatus:'READY',sourceBatchId:'fixture-import'};
const journal=state.ops.journals[0];
journal.sourceKind='SYNTHETIC';journal.authorName='가상 공개 여행자';journal.summary='합성 공개 소개';journal.tags=['검수'];
journal.cover={id:'review-cover',image:'/admin-review.svg',caption:'가상 표지',sourceCredit:{provider:'Spotlog',sourceUrl:'https://example.org/review',license:'자체 검수 도형'}};
journal.days=[{dayId:'fixture-public-day',day:1,date:'',title:'가상 DAY 1',story:'합성 하루 글',places:[{id:'review-landmark',kind:'LANDMARK',name:'가상 검수 장소',area:'부산',address:'가상 주소',image:'/admin-review.svg',description:'가상 장소',note:'',duration:'1시간'}],blocks:[{id:'fixture-text',type:'TEXT',heading:'공개 단락',body:'공개 본문'},{id:'review-card-1',type:'PLACE',placeId:'review-landmark'}]}];
journal.metrics={cheers:null,copies:null,views:null,source:'SAMPLE'};
const valueFor = name => ({ expectedRevision: 1, entityRevision: 1, idempotencyKey: 'fixture-command-key', reason: '운영자 합성 검수 사유', note: '운영자 합성 검수 메모', placeId: 'review-landmark', anchorPlaceId: 'review-landmark', businessPlaceId: 'review-food', fixtureId: 'fixture-simple', policyId: 'policy-local-1', indexId: 'idx-local-empty', jobId: 'fixture-job', resultId: 'fixture-result', feedbackId: 'fixture-feedback', memberId: 'review-member-1', journalId: 'review-journal-1', reportId: 'review-report-1', operatorId: 'review-operator', sessionId: 'review-session-operator', inquiryId: 'review-inquiry-1', notificationId: 'review-notification-1', connectionId: 'review-map', mediaId: 'review-media', trashId: 'review-trash-1', sourceRevision: 1, content, rows: [content], title: '운영자 검수 예시', name: '운영자 검수 예시', english: 'Synthetic translation', reply: '합성 답변 기록입니다.', until: '2026-11-05T00:00:00.000Z', createdAt: '2026-10-05T00:00:00.000Z', startsAt: '2026-10-05T00:00:00.000Z', endsAt: '2026-11-05T00:00:00.000Z', query: '검수', resource: 'places', page: 1, pageSize: 20 }[name]);
function resolve(schema) { return schema.$ref ? resolve(bundle.$defs[schema.$ref.split('/').at(-1)]) : schema; }
function sample(input, name) {
  const inputSchema = resolve(input);
  const named = valueFor(name);
  if (named !== undefined) return structuredClone(named);
  if ('const' in inputSchema) return inputSchema.const;
  if (inputSchema.enum) return inputSchema.enum[0];
  if (inputSchema.anyOf) return sample(inputSchema.anyOf[0], name);
  if (inputSchema.type === 'array') return [];
  if (inputSchema.type === 'boolean') return false;
  if (inputSchema.type === 'number' || inputSchema.type === 'integer') return 1;
  if (inputSchema.type === 'string') return 'fixture-' + (name || 'value');
  if (inputSchema.type === 'null') return null;
  if (inputSchema.type === 'object') return Object.fromEntries((inputSchema.required || []).map(key => [key, sample(inputSchema.properties[key], key)]));
  return null;
}
const commands = [];
for (const alternative of bundle.$defs.AdminCommand.anyOf) {
  const shape = resolve(alternative);
  const kind = resolve(shape.properties.kind);
  for (const value of kind.enum || [kind.const]) {
    const command = sample(shape);
    command.kind = value;
    command.idempotencyKey = 'fixture-' + value;
    commands.push({ name: value, schema: 'AdminCommand', command });
  }
}
const fixtures = {
  synthetic: true, source: 'Operator-written contract fixtures; not production data or model measurements.',
  dtoFixtures: [
    { name: 'query-shape', schema: 'AdminQuery', body: { resource: 'places', query: '검수', page: 1, pageSize: 20, filters: { kind: 'FOOD', state: 'PUBLISHED' } } },
    { name: 'server-popularity-shape-synthetic-not-measured', schema: 'OpsPopularitySnapshot', body: { basis: 'SAVES', source: 'SERVER', observedAt: '2026-10-09T00:00:00.000Z', items: [{ targetType: 'PLACE', targetId: 'review-landmark', saveCount: 128 }, { targetType: 'JOURNAL', targetId: 'review-journal-1', saveCount: 42 }] } },
    { name: 'request-summary-shape', schema: 'AiRequestSummary', body: { requestId: 'fixture-request', channel: 'SIMPLE', state: 'FAILED', stage: 'SEARCH', modelProfile: 'small-local-unconnected', policyId: 'policy-local-1', indexId: 'idx-local-empty', errorCode: 'DATA_MISSING', sourcePlaceIds: [], latencyMs: null, externalCostKrw: null, fallbackReason: '자료 부족은 외부 모델 보완 대상이 아님', createdAt: '2026-10-05T00:00:00.000Z', localSimulation: true } },
    { name: 'api-test-result-shape-synthetic-not-measured', schema: 'AiTestResult', body: { ...sample(bundle.$defs.AiTestResult), localSimulation: false, externalCalls: 1, saved: false } },
  ],
  responses: [
    { name: 'session', operationId: 'adminSession', status: 200, schema: 'AdminSession', body: { operatorId: 'review-admin', name: '검수 최고관리자', role: 'ADMIN' } },
    { name: 'snapshot', operationId: 'adminLoad', status: 200, schema: 'AdminState', body: state },
    { name: 'places-page', operationId: 'adminQuery', status: 200, schema: 'AdminPageResult', body: { items: state.places, total: 1, page: 1, pageSize: 20, revision: 1 } },
    { name: 'empty-page', operationId: 'adminQuery', status: 200, schema: 'AdminPageResult', body: { items: [], total: 0, page: 1, pageSize: 20, revision: 1 } },
    { name: 'command-success', operationId: 'adminExecute', status: 200, schema: 'AdminCommandResult', body: { state, message: '합성 응답 형식 예시입니다.' } },
    { name: 'idempotent-replay', operationId: 'adminExecute', status: 200, schema: 'AdminCommandResult', body: { state, message: '합성 중복 응답 예시입니다.', replayed: true } },
    ...[
      [401, 'UNAUTHENTICATED', '관리자 서버 로그인이 필요해요.'], [403, 'FORBIDDEN', '이 작업의 관리자 권한이 없어요.'], [409, 'CONFLICT', '자료가 변경됐어요. 새 자료를 확인해 주세요.'], [409, 'IDEMPOTENCY_CONFLICT', '같은 키로 다른 요청을 처리할 수 없어요.'], [422, 'VALIDATION', '입력과 자료 상태를 확인해 주세요.'], [503, 'DEPENDENCY_UNAVAILABLE', '실제 서비스 연결이 준비되지 않았어요.'], [504, 'TIMEOUT', '입력을 유지했어요. 잠시 후 다시 시도해 주세요.'],
    ].map(([status, code, message]) => ({ name: code.toLowerCase(), operationId: 'adminExecute', status, schema: 'AdminErrorEnvelope', body: { error: { code, message } } })),
  ], commands,
};
fs.writeFileSync(path.join(dir, 'fixtures.json'), JSON.stringify(fixtures, null, 2) + '\n');
console.log(`Built ${commands.length} command shapes, ${fixtures.responses.length} synthetic responses and ${fixtures.dtoFixtures.length} standalone DTO fixtures.`);
