import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const schema = JSON.parse(await readFile(new URL('../docs/flowise-output.schema.json', import.meta.url),'utf8'));
const fields = JSON.parse(await readFile(new URL('../docs/flowise-structured-output.fields.json', import.meta.url),'utf8'));
test('native Flowise action field reference includes all closed-schema fields without stale action counts',()=>{
  const variants=schema.properties.actions.items.oneOf;
  const native=JSON.parse(fields.find(field=>field.key==='actions').jsonSchema);
  const propertyNames=[...new Set(variants.flatMap(v=>Object.keys(v.properties)))];
  assert.deepEqual(Object.keys(native).sort(),propertyNames.sort());
  const names=[...new Set(variants.flatMap(v=>v.properties.type.enum??[v.properties.type.const]))];
  for(const name of names)assert.ok(native.type.description.includes(name));
  assert.ok(native.type.description.includes(`${names.length}개`));
  assert.ok(fields.find(field=>field.key==='actions').description.includes(`${schema.properties.actions.maxItems}개`));
  assert.equal(native.type.optional,undefined);
});
