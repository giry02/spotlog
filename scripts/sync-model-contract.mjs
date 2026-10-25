import { readFile, writeFile } from 'node:fs/promises';

const schemaUrl = new URL('../docs/flowise-output.schema.json', import.meta.url);
const fieldsUrl = new URL('../docs/flowise-structured-output.fields.json', import.meta.url);
const schema = JSON.parse(await readFile(schemaUrl, 'utf8'));
const fields = JSON.parse(await readFile(fieldsUrl, 'utf8'));
const variants = schema.properties.actions.items.oneOf;
const names = [...new Set(variants.flatMap(v => v.properties.type.enum ?? [v.properties.type.const]))];
if (names.some(name => typeof name !== 'string')) throw new Error('An action discriminator is missing');
function resolveRef(value) {
  if (!value.$ref) return value;
  const key = value.$ref.replace(/^#\/\$defs\//, '');
  if (!schema.$defs?.[key]) throw new Error('Unresolved local schema reference');
  return { ...schema.$defs[key], ...value, $ref: undefined };
}
const properties = new Map();
for (const variant of variants) {
  const actions = variant.properties.type.enum ?? [variant.properties.type.const];
  for (const [key, value] of Object.entries(variant.properties)) {
    if (!properties.has(key)) properties.set(key, []);
    properties.get(key).push({ actions, required: variant.required.includes(key), schema: resolveRef(value) });
  }
}
const native = {};
for (const [key, definitions] of properties) {
  const types = [...new Set(definitions.map(v => v.schema.type ?? (typeof v.schema.const === 'string' || v.schema.enum ? 'string' : undefined)))];
  const type = types.length === 1 && ['string', 'number', 'integer', 'boolean', 'array'].includes(types[0]) ? types[0] === 'integer' ? 'number' : types[0] : 'any';
  native[key] = {
    type, ...(key !== 'type' ? { optional: true } : {}),
    description: key === 'type' ? `허용된 ${names.length}개 행동 중 하나: ${names.join('|')}. 아래 다른 필드는 해당 행동에 허용된 것만 사용한다.` : definitions.map(v => `${v.actions.join('/')}: ${v.required ? '필수' : '선택'} ${JSON.stringify(v.schema)}`).join('; '),
  };
}
const actions = fields.find(field => field.key === 'actions');
if (!actions) throw new Error('Native action field is missing');
actions.jsonSchema = JSON.stringify(native, null, 2);
actions.description = `최대 ${schema.properties.actions.maxItems}개 행동. 허용 ${names.length}개 행동의 닫힌 전체 계약은 flowise-output.schema.json이다. 각 행동의 필수 필드·후보·예약·사용자 의도는 서버가 다시 검증한다.`;
await writeFile(fieldsUrl, JSON.stringify(fields, null, 2) + '\n');
console.log(JSON.stringify({ actions: names.length, fields: Object.keys(native).length, generated: 'docs/flowise-structured-output.fields.json' }));
