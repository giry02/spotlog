/** Regenerate contracts from the actual review DTOs. No network or backend calls. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from '../../../node_modules/typescript/lib/typescript.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(dir, '../../..');
const files = ['types.ts', 'aiTypes.ts', 'opsTypes.ts'].map(name => path.join(repo, 'web/src/admin', name));
const program = ts.createProgram(files, { strict: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, noEmit: true });
const checker = program.getTypeChecker();
const excluded = new Set(['AdminAdapter', 'AdminPageProps', 'MutationContext', 'MutationOutcome']);
const types = new Map();
for (const filename of files) {
  const source = program.getSourceFile(filename);
  for (const symbol of checker.getExportsOfModule(checker.getSymbolAtLocation(source))) {
    if (excluded.has(symbol.name) || !(symbol.flags & (ts.SymbolFlags.Interface | ts.SymbolFlags.TypeAlias))) continue;
    types.set(symbol.name, checker.getDeclaredTypeOfSymbol(symbol));
  }
}
const namesByType = new Map([...types].map(([name, type]) => [type.id, name]));
const literal = type => {
  if (type.flags & ts.TypeFlags.StringLiteral) return type.value;
  if (type.flags & ts.TypeFlags.NumberLiteral) return type.value;
  if (type.flags & ts.TypeFlags.BooleanLiteral) return type.intrinsicName === 'true';
  if (type.flags & ts.TypeFlags.Null) return null;
  return undefined;
};
function schema(type, inlineId) {
  if (type.id !== inlineId && namesByType.has(type.id)) return { $ref: '#/$defs/' + namesByType.get(type.id) };
  if (type.isUnion()) {
    const members = type.types.filter(t => !(t.flags & ts.TypeFlags.Undefined));
    if (members.length === 1) return schema(members[0], inlineId);
    const literals = members.map(literal);
    if (literals.every(value => value !== undefined)) return { enum: literals };
    return { anyOf: members.map(t => schema(t, inlineId)) };
  }
  const value = literal(type);
  if (value !== undefined) return { const: value };
  if (type.flags & ts.TypeFlags.String) return { type: 'string' };
  if (type.flags & ts.TypeFlags.Number) return { type: 'number' };
  if (type.flags & ts.TypeFlags.Boolean) return { type: 'boolean' };
  if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.TypeParameter)) return {};
  if (checker.isArrayType(type)) return { type: 'array', items: schema(checker.getTypeArguments(type)[0], inlineId) };
  if (type.getCallSignatures().length) throw new Error('Function is not an HTTP DTO: ' + checker.typeToString(type));
  const properties = {};
  const required = [];
  for (const symbol of checker.getPropertiesOfType(type)) {
    const declaration = symbol.valueDeclaration || symbol.declarations?.[0];
    properties[symbol.name] = schema(checker.getTypeOfSymbolAtLocation(symbol, declaration), inlineId);
    if (!(symbol.flags & ts.SymbolFlags.Optional)) required.push(symbol.name);
  }
  const indexType = type.getStringIndexType();
  return { type: 'object', properties, required, additionalProperties: indexType ? schema(indexType, inlineId) : false };
}
const definitions = Object.fromEntries([...types].map(([name, type]) => [name, schema(type, type.id)]));
// Policy constraints are stricter than TypeScript's structural number/string types.
function applyPolicyConstraints(value) {
  if (!value || typeof value !== 'object') return;
  if (value.properties) {
    for (const [name, property] of Object.entries(value.properties)) {
      if (['revision', 'expectedRevision', 'entityRevision', 'sourceRevision', 'fixtureRevision', 'proposedRevision'].includes(name) && property.type === 'number') Object.assign(property, { type: 'integer', minimum: 0 });
      if (name === 'idempotencyKey') Object.assign(property, { type: 'string', minLength: 1, maxLength: 200 });
    }
  }
  for (const nested of Object.values(value)) {
    if (Array.isArray(nested)) nested.forEach(applyPolicyConstraints);
    else if (nested && typeof nested === 'object') applyPolicyConstraints(nested);
  }
}
applyPolicyConstraints(definitions);
for (const name of ['AdminQuery', 'AdminPageResult']) {
  Object.assign(definitions[name].properties.page, { type: 'integer', minimum: 1 });
  Object.assign(definitions[name].properties.pageSize, { type: 'integer', minimum: 1, maximum: 100 });
}
Object.assign(definitions.AdminPageResult.properties.total, { type: 'integer', minimum: 0 });
Object.assign(definitions.OpsPopularMetric.properties.saveCount, { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER });
definitions.PublicJournal.allOf = [{ if: { properties: { ownerVisibility: { enum: ['PRIVATE', 'TRASHED'] } }, required: ['ownerVisibility'] }, then: { properties: { original: { const: '' }, english: { const: '' }, summary: { const: '' }, cards: { type: 'array', maxItems: 0 }, days: { type: 'array', maxItems: 0 }, tags: { type: 'array', maxItems: 0 }, cover: { enum: [] }, metrics: { enum: [] }, reactionBreakdown: { enum: [] } } } }];
definitions.AdminErrorEnvelope = {
  type: 'object', properties: { error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } }, required: ['code', 'message'], additionalProperties: false } }, required: ['error'], additionalProperties: false,
};
const bundle = { $schema: 'https://json-schema.org/draft/2020-12/schema', $id: 'urn:spotlog:admin-contract:1.0', title: 'Spotlog administrator review DTOs', description: 'Generated from current frontend types, with integer revision/paging, idempotency-key and private-journal body policy constraints. Backend/database integration remains unimplemented.', $defs: definitions };
const json = value => JSON.stringify(value, null, 2) + '\n';
function output(name, value) {
  const filename = path.join(dir, name), expected = json(value);
  if (process.argv.includes('--check')) {
    if (fs.readFileSync(filename, 'utf8').replace(/\r\n/g, '\n') !== expected) throw new Error(name + ' is out of sync with the current frontend types. Regenerate the admin contract.');
  } else fs.writeFileSync(filename, expected);
}
output('schemas.json', bundle);
const components = JSON.parse(JSON.stringify(definitions).replaceAll('#/$defs/', '#/components/schemas/'));
const response = (name, description) => ({ description, content: { 'application/json': { schema: { $ref: '#/components/schemas/' + name } } } });
const errors = Object.fromEntries([401, 403, 409, 422, 429, 500, 502, 503, 504].map(status => [status, response('AdminErrorEnvelope', { 401: 'Server session required', 403: 'Server-side role denied', 409: 'Stale revision or idempotency-key body mismatch', 422: 'Invalid input or domain state', 429: 'Rate limit', 500: 'Server failure', 502: 'Invalid dependency response', 503: 'Dependency unavailable', 504: 'Request timeout' }[status])]));
const spec = {
  openapi: '3.1.0', info: { title: 'Spotlog administrator adapter', version: '1.0.0-review', description: 'Matches the frontend AdminAdapter HTTP bindings. Proposed server contract; production login, PostgreSQL, workers and model integrations are not implemented by this frontend.' },
  servers: [{ url: '/api/admin/v1', description: 'Same-origin Spotlog server' }],
  security: [{ operatorSession: [] }],
  paths: {
    '/me': { get: { operationId: 'adminSession', summary: 'Read authorized server operator session', responses: { 200: response('AdminSession', 'Server-derived operator identity and role'), ...errors } } },
    '/snapshot': { get: { operationId: 'adminLoad', summary: 'Read authorized administrator view model', description: 'Review bootstrap DTO. Contains public/manageable metadata only. Exclude private trips, private journal bodies, customer AI prompts and conversations, and secrets. Production lists must use paginated resources rather than an unrestricted full database snapshot.', responses: { 200: response('AdminState', 'Authorized review-compatible view model'), ...errors } } },
    '/resources/{resource}': { get: { operationId: 'adminQuery', summary: 'Search, filter and page an authorized resource on the server', parameters: [
      { name: 'resource', in: 'path', required: true, schema: { type: 'string' }, description: 'Resource identifier supported by the server and adapter; unsupported names return 422.' },
      { name: 'query', in: 'query', schema: { type: 'string' }, description: 'Search term' },
      { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
      { name: 'pageSize', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
      { name: 'filter.*', in: 'query', schema: { type: 'string' }, description: 'Each AdminQuery.filters entry is encoded as filter.<key>=<value>. This documents the adapter prefix convention, not a literal filter.* key.' },
    ], responses: { 200: response('AdminPageResult', 'Server-filtered page, total count and current state revision'), ...errors } } },
    '/commands': { post: { operationId: 'adminExecute', summary: 'Apply one discriminated administrator command', description: 'expectedRevision is the current global state revision. Ops commands with entityRevision also check the target record revision; sourceRevision protects translation source versions. Idempotency-key reuse with the same command replays one result; reuse with a different command returns 409. Server derives actor/role from the cookie session and must not accept a client actor. Only authorized, validated mutations may enter an atomic transaction.', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/AdminCommand' } } } }, responses: { 200: response('AdminCommandResult', 'Validated resulting view model; replayed marks an idempotent replay'), ...errors } } },
  },
  components: { securitySchemes: { operatorSession: { type: 'apiKey', in: 'cookie', name: 'spotlog_admin_session', description: 'Conceptual same-origin session cookie. Actual cookie name, expiry and CSRF protection are server configuration; no browser-provided role or password simulation.' } }, schemas: components },
};
output('openapi.json', spec);
console.log(`Generated ${types.size} TypeScript DTO definitions and 4 adapter routes.`);
