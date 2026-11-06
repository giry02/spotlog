import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';

/** Compile source in memory; assets keep their identity, no product storage/files are touched. */
function loadPublicSource() {
  const cache = new Map(), nativeRequire = createRequire(import.meta.url);
  const load = path => {
    if (extname(path) === '.json') return JSON.parse(readFileSync(path, 'utf8'));
    if (!['.ts', '.tsx', '.js'].includes(extname(path))) return path;
    if (cache.has(path)) return cache.get(path).exports;
    const module = { exports: {} }; cache.set(path, module);
    const localRequire = specifier => {
      if (!specifier.startsWith('.')) return nativeRequire(specifier);
      let target = resolve(dirname(path), specifier);
      if (!extname(target)) target = ['.ts', '.tsx', '.js'].map(extension => target + extension).find(existsSync) ?? target;
      return load(target);
    };
    const compiled = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    new Function('require', 'module', 'exports', compiled)(localRequire, module, module.exports);
    return module.exports;
  };
  return load(fileURLToPath(new URL('../src/consumerPublicSeed.ts', import.meta.url)));
}
test('all active bundled public journeys and eight public sample comments preserve public identities and sources', () => {
  const { publishedJourneySeeds, getConsumerPublicSeedProjection } = loadPublicSource(), projection = getConsumerPublicSeedProjection();
  const expected = publishedJourneySeeds.filter(j => j.visibility === 'PUBLIC' && j.status === 'PUBLISHED' && j.purpose !== 'PLAN' && !j.trash).map(j => j.id);
  assert.deepEqual(projection.publicJournals.map(j => j.journalId), expected);
  assert.equal(projection.comments.length, 8); assert.equal(projection.reports.length, 0);
  for (const journal of projection.publicJournals) { assert.equal(journal.ownerVisibility, 'PUBLIC'); assert.ok(journal.cards.every(card => !!card.cardId && !!card.placeId)); }
  for (const comment of projection.comments) { assert.ok(comment.commentId && comment.authorId); assert.equal(comment.moderation, 'VISIBLE'); assert.ok(expected.includes(comment.journalId)); }
  assert.ok(projection.publicJournals.some(j => j.cover?.sourceCredit || j.cards.some(c => c.sourceCredit)));
});
test('public template DAY and block identities remain stable across fresh source evaluations', () => {
  const first = loadPublicSource().getConsumerPublicSeedProjection(), second = loadPublicSource().getConsumerPublicSeedProjection();
  assert.deepEqual(first, second);
});
