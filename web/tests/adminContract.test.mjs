import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { matchesAdminDto } from '../src/admin/contractGuard.ts';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const contracts = path.join(repo, 'docs/contracts/admin-v1');
const read = name => JSON.parse(fs.readFileSync(path.join(contracts, name), 'utf8'));

test('administrator machine contracts stay in sync with the implemented TypeScript DTOs', () => {
  const result = spawnSync(process.execPath, [path.join(contracts, 'build_contract.mjs'), '--check'], { cwd: repo, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('administrator schemas, endpoints and synthetic positive/negative fixtures validate', () => {
  const result = spawnSync('python', [path.join(contracts, 'validate.py')], { cwd: repo, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('OpenAPI describes only the four actual API adapter bindings', () => {
  const spec = read('openapi.json');
  assert.deepEqual(Object.keys(spec.paths), ['/me', '/snapshot', '/resources/{resource}', '/commands']);
  const source = fs.readFileSync(path.join(repo, 'web/src/admin/repository.ts'), 'utf8');
  for (const suffix of ['/me', '/snapshot', '/commands', '/resources/']) assert.ok(source.includes("'" + suffix + "'"), suffix);
  assert.ok(source.includes("'/api/admin/v1'"));
  assert.ok(source.includes("credentials: 'same-origin'"));
  assert.ok(source.includes("params.set('filter.' + key, value)"));
  assert.ok(source.includes('JSON.stringify(command)'));
});

test('AI operation request-summary DTO excludes customer prompt, conversation and private trip fields', () => {
  const schemas = read('schemas.json');
  const summary = schemas.$defs.AiRequestSummary;
  assert.equal(summary.additionalProperties, false);
  for (const field of ['prompt', 'messages', 'conversation', 'trip', 'journey', 'apiKey', 'password']) assert.equal(field in summary.properties, false);
  const tests = schemas.$defs.AiTestFixture;
  assert.deepEqual(tests.properties.source, { const: 'OPERATOR_SYNTHETIC' });
});

test('runtime API guard accepts every committed DTO fixture and enforces revision/privacy policy constraints', () => {
  const fixtures = read('fixtures.json');
  for (const item of fixtures.responses) assert.equal(matchesAdminDto(item.schema, item.body), true, item.name);
  for (const item of fixtures.dtoFixtures) assert.equal(matchesAdminDto(item.schema, item.body), true, item.name);
  for (const item of fixtures.commands) assert.equal(matchesAdminDto('AdminCommand', item.command), true, item.name);
  const command = fixtures.commands[0].command;
  assert.equal(matchesAdminDto('AdminCommand', { ...command, expectedRevision: 1.5 }), false);
  assert.equal(matchesAdminDto('AdminCommand', { ...command, idempotencyKey: '' }), false);
  assert.equal(matchesAdminDto('AdminCommand', { ...command, actor: { role: 'ADMIN' } }), false);
  const journal = fixtures.responses.find(item => item.name === 'snapshot').body.ops.journals[0];
  assert.equal(matchesAdminDto('PublicJournal', { ...journal, ownerVisibility: 'PRIVATE' }), false);
  assert.equal(matchesAdminDto('PublicJournal', { ...journal, ownerVisibility: 'PRIVATE', original: '', english: '', summary: '', cards: [], days: [], tags: [], cover: undefined, metrics: undefined, reactionBreakdown: undefined }), true);
});
