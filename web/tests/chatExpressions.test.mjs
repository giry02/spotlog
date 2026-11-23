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
      if (/chatExpressions(?:\\.ts)?$|redCapStickers(?:\\.ts)?$|\\.(?:svg|webp)$/.test(specifier)) throw new Error('Validation loaded chat artwork');
      return nextResolve(specifier, context);
    } });
    for (const entry of ${JSON.stringify(entries)}) await import(entry);
  `], { encoding: 'utf8', timeout: 10000 });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('four original packs keep all 34 stable stickers and red cap adds 27',()=>{
  assert.equal(packs,chatStickerPacks);
  assert.deepEqual(chatStickerPacks.map(pack=>pack.id),['bunny','cat','bear','duck','redcap']);
  assert.equal(chatStickers.length,61);assert.equal(new Set(chatStickers.map(sticker=>sticker.id)).size,61);
  assert.deepEqual(chatStickerPacks.map(pack=>chatStickers.filter(sticker=>sticker.pack===pack.id).length),[10,8,8,8,27]);
  for(const pack of chatStickerPacks){assert.equal(getChatSticker(pack.coverId).pack,pack.id);assert.ok(pack.name&&pack.shortName&&pack.description);}
  const legacy = chatStickers.slice(0,34).map(x => [x.id,x.name,x.label,x.pack,x.svg]);
  assert.equal(createHash('sha256').update(JSON.stringify(legacy)).digest('hex'), '0e0cae698173ae1799eb79c1a9efd004db139d409ed62c7120deba8192d98c6f');
});

test('only catalog IDs resolve; arbitrary URLs, markup, object keys and unknown IDs are refused',()=>{
  for(const id of [null,undefined,{},[],42,'','__proto__','constructor','toString','bunny-unknown','https://example.invalid/image.svg','data:image/svg+xml,<svg/>','<script>alert(1)</script>']){
    assert.equal(isChatStickerId(id),false);assert.equal(getChatSticker(id),null);
  }
  for(const sticker of chatStickers){assert.equal(isChatStickerId(sticker.id),true);assert.equal(getChatSticker(sticker.id),sticker);}
});

test('SVG data is self-contained constant artwork without executable markup or external resources',()=>{
  for(const sticker of chatStickers.filter(item => item.pack !== 'redcap')){
    assert.match(sticker.src,/^data:image\/svg\+xml;charset=utf-8,/);
    assert.equal(decodeURIComponent(sticker.src.split(',').slice(1).join(',')),sticker.svg);
    assert.match(sticker.svg,/<svg[^>]+viewBox="0 0 240 240"/);
    assert.doesNotMatch(sticker.svg,/<(?:script|foreignObject|image|iframe|a)\b|\bon\w+\s*=|(?:xlink:)?href\s*=|javascript:|url\(/i);
    assert.ok(sticker.svg.includes(sticker.label));
    assert.ok(sticker.name.trim()&&sticker.label.trim());
  }
});

test('new stickers use unique local, lossless 256px alpha WebP images and Korean labels', () => {
  const newStickers = chatStickers.filter(item => item.pack === 'redcap');
  assert.equal(new Set(newStickers.map(item => item.src)).size, 27);
  for (const item of newStickers) {
    assert.ok(Object.isFrozen(item));
    assert.match(item.label, /[가-힣]/);
    assert.equal(item.svg, undefined);
    const source = new URL(item.src);
    assert.equal(source.protocol, 'file:');
    assert.ok(source.pathname.endsWith('/sticker-art/red-cap/' + item.id.slice(7) + '.webp'));
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
