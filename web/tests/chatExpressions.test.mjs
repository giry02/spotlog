import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { chatStickerPacks, packs, chatStickers, getChatSticker, isChatStickerId, emojiCategories } from '../src/together/chatExpressions.ts';
import { chatStickerIds, isChatStickerId as validateStoredSticker } from '../src/together/chatExpressionContract.ts';

test('stored sticker contract accepts exactly the current immutable artwork IDs', () => {
  assert.deepEqual(chatStickerIds, chatStickers.map(sticker => sticker.id));
  assert.equal(isChatStickerId, validateStoredSticker);
  assert.equal(Object.isFrozen(chatStickerIds), true);
  assert.throws(() => { chatStickerIds[0] = 'unknown'; }, TypeError);
  for (const value of [...chatStickerIds, 'bunny-unknown', 'cat-love', 'duck-nope', '__proto__', ' cat-hi', 'cat-hi ', new String('cat-hi'), null, {}, 42]) {
    assert.equal(validateStoredSticker(value), getChatSticker(value) !== null);
  }
});

test('repository and draft/message validation load without initializing chat artwork', () => {
  const entries = ['repository.ts', 'chatActions.ts', 'chatDrafts.ts'].map(name => new URL(`../src/together/${name}`, import.meta.url).href);
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { registerHooks } from 'node:module';
    registerHooks({ resolve(specifier, context, nextResolve) {
      if (/(?:chatExpressions|redCapStickers|companionStickers)(?:\\.ts)?$|\\.(?:svg|webp)$/.test(specifier)) throw new Error('Validation loaded chat artwork');
      return nextResolve(specifier, context);
    } });
    for (const entry of ${JSON.stringify(entries)}) await import(entry);
  `], { encoding: 'utf8', timeout: 10000 });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('the 34 animal stickers and 27 released red cap stickers stay intact as more poses and packs are appended', () => {
  assert.equal(packs,chatStickerPacks);
  const packOrder = ['bunny','cat','bear','duck','redcap','roundglasses','purplescarf'];
  const packSizes = [10,8,8,8,36,9,9];
  assert.deepEqual(chatStickerPacks.map(pack=>pack.id), packOrder);
  assert.deepEqual(chatStickers.map(sticker=>sticker.pack), packOrder.flatMap((pack, i) => Array(packSizes[i]).fill(pack)));
  assert.equal(new Set(chatStickers.map(sticker=>sticker.id)).size,88);
  for(const pack of chatStickerPacks){assert.equal(getChatSticker(pack.coverId).pack,pack.id);assert.ok(pack.name&&pack.shortName&&pack.description);}
  const legacy = chatStickers.slice(0,34).map(x => [x.id,x.name,x.label,x.pack,x.svg]);
  assert.equal(createHash('sha256').update(JSON.stringify(legacy)).digest('hex'), '0e0cae698173ae1799eb79c1a9efd004db139d409ed62c7120deba8192d98c6f');
  const released = chatStickers.slice(34,61).map(x => [
    x.id, x.name, x.label, x.pack, createHash('sha256').update(readFileSync(new URL(x.src))).digest('hex'),
  ]);
  // The approved 27 from the previous release: preserve metadata, order and exact art bytes.
  assert.equal(createHash('sha256').update(JSON.stringify(released)).digest('hex'), 'a981f6a03b975f4a3baad3f89ce51399a78badc28590d6fdd424ac6e3f6d7761');
  assert.deepEqual(chatStickers.slice(61,70).map(sticker=>sticker.id), [
    'confirmed', 'cant-make-it', 'good-night', 'where-are-you', 'ill-call', 'send-photo', 'saved-seat', 'im-home', 'had-fun',
  ].map(id => 'redcap-' + id));
});

test('only catalog IDs resolve; arbitrary URLs, markup, object keys and unknown IDs are refused',()=>{
  for(const id of [null,undefined,{},[],42,'','__proto__','constructor','toString','bunny-unknown','https://example.invalid/image.svg','data:image/svg+xml,<svg/>','<script>alert(1)</script>']){
    assert.equal(isChatStickerId(id),false);assert.equal(getChatSticker(id),null);
  }
  for(const sticker of chatStickers){assert.equal(isChatStickerId(sticker.id),true);assert.equal(getChatSticker(sticker.id),sticker);}
});

test('SVG data is self-contained constant artwork without executable markup or external resources',()=>{
  const vectorStickers = chatStickers.filter(item => typeof item.svg === 'string');
  assert.equal(vectorStickers.length, 34);
  for(const sticker of vectorStickers){
    assert.match(sticker.src,/^data:image\/svg\+xml;charset=utf-8,/);
    assert.equal(decodeURIComponent(sticker.src.split(',').slice(1).join(',')),sticker.svg);
    assert.match(sticker.svg,/<svg[^>]+viewBox="0 0 240 240"/);
    assert.doesNotMatch(sticker.svg,/<(?:script|foreignObject|image|iframe|a)\b|\bon\w+\s*=|(?:xlink:)?href\s*=|javascript:|url\(/i);
    assert.ok(sticker.svg.includes(sticker.label));
    assert.ok(sticker.name.trim()&&sticker.label.trim());
  }
});

test('character packs use unique local, lossless 256px alpha WebP images and Korean labels', () => {
  const assetDirectory = { redcap: 'red-cap', roundglasses: 'round-glasses', purplescarf: 'purple-scarf' };
  const rasterStickers = chatStickers.filter(item => Object.hasOwn(assetDirectory, item.pack));
  assert.equal(new Set(rasterStickers.map(item => item.src)).size, 54);
  for (const item of rasterStickers) {
    assert.ok(Object.isFrozen(item));
    assert.match(item.label, /[가-힣]/);
    assert.equal(item.svg, undefined);
    const source = new URL(item.src);
    assert.equal(source.protocol, 'file:');
    assert.ok(item.id.startsWith(item.pack + '-'), item.id);
    assert.ok(source.pathname.endsWith('/sticker-art/' + assetDirectory[item.pack] + '/' + item.id.slice(item.pack.length + 1) + '.webp'), item.src);
    const bytes = readFileSync(source);
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 16), 'WEBPVP8L');
    assert.equal(bytes[20], 0x2f);
    const flags = bytes.readUInt32LE(21);
    assert.equal((flags & 0x3fff)+1, 256);
    assert.equal(((flags >> 14) & 0x3fff)+1, 256);
    assert.equal((flags >> 28) & 1, 1);
  }
});

test('catalog objects are immutable and lookup preserves original artwork',()=>{
  const sticker=getChatSticker('bunny-hi'),before=sticker.src;
  assert.equal(Object.isFrozen(chatStickers),true);assert.equal(Object.isFrozen(sticker),true);
  assert.throws(()=>{sticker.src='https://example.invalid/replaced';},TypeError);
  assert.equal(getChatSticker('bunny-hi').src,before);
  assert.throws(()=>{chatStickerPacks[0].name='변경';},TypeError);
});

test('Unicode choices carry visible Korean labels and cover expression, reaction, travel and food',()=>{
  assert.deepEqual(emojiCategories.map(category=>category.id),['feelings','reactions','travel','food']);
  assert.equal(emojiCategories.reduce((sum,category)=>sum+category.items.length,0),60);
  for(const category of emojiCategories){
    assert.ok(category.label&&category.emoji);assert.equal(new Set(category.items.map(item=>item.emoji)).size,category.items.length);
    for(const item of category.items){assert.ok(item.label.trim()&&item.emoji);assert.doesNotMatch(item.emoji,/[<>]|https?:|data:/);assert.equal(Object.isFrozen(item),true);}
  }
});
