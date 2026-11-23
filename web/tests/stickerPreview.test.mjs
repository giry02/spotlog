import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { previewPacks } from '../src/stickerPreviewCatalog.ts';
import { isChatStickerId } from '../src/together/chatExpressionContract.ts';
import { companionStickers } from '../src/together/companionStickers.ts';
import { redCapStickers } from '../src/together/redCapStickers.ts';

const redCapAdded = [
  'confirmed', 'cant-make-it', 'good-night', 'where-are-you', 'ill-call',
  'send-photo', 'saved-seat', 'im-home', 'had-fun',
].map(name => `redcap-${name}`);

test('standalone preview shows the three requested packs in order, with only the nine new Red Cap poses', () => {
  assert.deepEqual(previewPacks.map(pack => pack.id), ['redcap-extra', 'roundglasses', 'purplescarf']);
  assert.deepEqual(previewPacks.map(pack => pack.stickers.length), [9, 9, 9]);
  assert.deepEqual(previewPacks[0].stickers.map(sticker => sticker.id), redCapAdded);
  for (const pack of previewPacks.slice(1)) {
    assert.deepEqual(pack.stickers.map(sticker => sticker.id), companionStickers.filter(sticker => sticker.pack === pack.id).map(sticker => sticker.id));
  }
  for (const { title, shortTitle, description } of previewPacks) {
    for (const label of [title, shortTitle, description]) assert.match(label, /[가-힣]/);
  }
  const ids = previewPacks.flatMap(pack => pack.stickers.map(sticker => sticker.id));
  assert.equal(new Set(ids).size, 27);
  assert.ok(ids.every(isChatStickerId));
});

test('the preview references the same local artwork and labels as the chat catalogs', () => {
  const originals = new Map([...redCapStickers, ...companionStickers].map(sticker => [sticker.id, sticker]));
  for (const sticker of previewPacks.flatMap(pack => pack.stickers)) {
    const original = originals.get(sticker.id);
    assert.ok(original, sticker.id);
    assert.equal(sticker.label, original.label);
    assert.equal(sticker.src, original.src);
    const source = new URL(sticker.src);
    assert.equal(source.protocol, 'file:');
    assert.match(source.pathname, /\/web\/src\/together\/sticker-art\/.+\.webp$/);
    assert.equal(readFileSync(source).toString('ascii', 8, 12), 'WEBP');
  }
});

test('the preview catalog imports only static sticker data, without account, chat, or storage dependencies', () => {
  const source = new URL('../src/', import.meta.url);
  const entry = new URL('stickerPreviewCatalog.ts', source).href;
  const imports = ['chatExpressionContract.ts', 'companionStickers.ts', 'redCapStickers.ts'].map(name => new URL(`together/${name}`, source).href);
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { registerHooks } from 'node:module';
    const allowed = new Set(${JSON.stringify([entry, ...imports])});
    registerHooks({ resolve(specifier, context, nextResolve) {
      const resolved = nextResolve(specifier, context);
      if (!allowed.has(resolved.url)) throw new Error('Unexpected preview dependency: ' + resolved.url);
      return resolved;
    } });
    for (const key of ['localStorage', 'sessionStorage', 'indexedDB', 'window', 'document', 'fetch']) {
      Object.defineProperty(globalThis, key, { configurable: true, get() { throw new Error('Preview catalog accessed ' + key); } });
    }
    await import(${JSON.stringify(entry)});
  `], { encoding: 'utf8', timeout: 10000 });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
