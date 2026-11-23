import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { chatStickerPacks, chatStickerPickerPacks, packs, chatStickers, getChatSticker, getChatStickerTheme, isChatStickerId, emojiCategories } from '../src/together/chatExpressions.ts';
import { chatStickerIds, isChatStickerId as validateStoredSticker } from '../src/together/chatExpressionContract.ts';

const mascotPackIds = ['pebble', 'guidebot', 'backpack', 'cloud', 'otter', 'thermos'];
const humanPackIds = ['redcap', 'roundglasses', 'purplescarf'];

test('the picker places featured stickers first and keeps all animal packs at the end', () => {
  assert.deepEqual(chatStickerPickerPacks.map(pack => pack.id), [...humanPackIds, ...mascotPackIds, 'bunny', 'cat', 'bear', 'duck']);
  assert.deepEqual(new Set(chatStickerPickerPacks), new Set(chatStickerPacks));
});

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
      if (/(?:chatExpressions|redCapStickers|companionStickers|mascotStickers)(?:\\.ts)?$|\\.(?:svg|webp)$/.test(specifier)) throw new Error('Validation loaded chat artwork');
      return nextResolve(specifier, context);
    } });
    for (const entry of ${JSON.stringify(entries)}) await import(entry);
  `], { encoding: 'utf8', timeout: 10000 });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('all 322 previous stickers keep their order, metadata and original artwork', () => {
  assert.equal(packs,chatStickerPacks);
  const packOrder = ['bunny','cat','bear','duck','redcap','roundglasses','purplescarf', ...mascotPackIds];
  const packSizes = [10,8,8,8,36,9,9, ...mascotPackIds.map(() => 39)];
  assert.deepEqual(chatStickerPacks.map(pack=>pack.id), packOrder);
  assert.deepEqual(chatStickers.map(sticker=>sticker.pack), [
    ...packOrder.flatMap((pack, i) => Array(packSizes[i]).fill(pack)),
    ...Array(30).fill('roundglasses'), ...Array(30).fill('purplescarf'), ...Array(3).fill('redcap'),
  ]);
  assert.equal(new Set(chatStickers.map(sticker=>sticker.id)).size,385);
  for(const pack of chatStickerPacks){assert.equal(getChatSticker(pack.coverId).pack,pack.id);assert.ok(pack.name&&pack.shortName&&pack.description);}
  const digest = value => createHash('sha256').update(value).digest('hex');
  assert.ok(chatStickers.slice(0,88).every(sticker => !Object.hasOwn(sticker, 'theme')));
  const priorPackDescriptions = chatStickerPacks.map(pack => {
    if (!humanPackIds.includes(pack.id)) return pack;
    assert.match(pack.description, /39(?:종|가지)$/);
    return { ...pack, description: pack.description.replace(/39(?=종$|가지$)/, pack.id === 'redcap' ? '36' : '9') };
  });
  assert.equal(digest(JSON.stringify(priorPackDescriptions)), '9e95376d2b3eded5298ef1ff8dc623ae546400fe4d346169a182952c63def89b');
  assert.equal(digest(JSON.stringify(chatStickers.slice(0,322).map(sticker => [
    sticker.id, sticker.name, sticker.label, sticker.pack, sticker.theme ?? null, sticker.svg ?? digest(readFileSync(new URL(sticker.src))),
  ]))), 'd0040118efd838d6165d87270a4b31c02169a490cf03655f17d6f752ebd6c2ef');
});

test('each expanded human pack has 39 poses: three starters and three 12-item filters', () => {
  const starters = {
    redcap: ['thumbs-up', 'thanks', 'on-my-way'],
    roundglasses: ['thumbs-up', 'hello', 'thanks'],
    purplescarf: ['excited', 'high-five', 'selfie'],
  };
  for (const packId of humanPackIds) {
    const stickers = chatStickers.filter(sticker => sticker.pack === packId);
    assert.equal(stickers.length, 39, packId);
    assert.deepEqual(stickers.filter(sticker => getChatStickerTheme(sticker) === 'starter').map(sticker => sticker.id.slice(packId.length + 1)), starters[packId]);
    for (const theme of ['daily', 'planning', 'outing']) {
      assert.equal(stickers.filter(sticker => getChatStickerTheme(sticker) === theme).length, 12, `${packId}:${theme}`);
    }
  }
  assert.equal(getChatStickerTheme(getChatSticker('bunny-hi')), undefined);
});

test('all six mascots contain the three approved poses first and 12 poses for each of three themes', () => {
  const mascots = mascotPackIds.map(pack => chatStickers.filter(sticker => sticker.pack === pack));
  const expectedThemes = [...Array(3).fill('starter'), ...['daily', 'planning', 'outing'].flatMap(theme => Array(12).fill(theme))];
  const orderedPoses = pack => pack.map(sticker => [sticker.id.slice(sticker.pack.length + 1), sticker.label]);
  for (const pack of mascots) {
    assert.deepEqual(pack.map(sticker => sticker.theme), expectedThemes);
    assert.deepEqual(pack.slice(0,3).map(sticker => [sticker.id.slice(sticker.pack.length + 1), sticker.label]), [
      ['thumbs-up', '엄지척'], ['on-my-way', '가는 중'], ['thanks', '고마워'],
    ]);
    assert.deepEqual(orderedPoses(pack), orderedPoses(mascots[0]));
  }
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
  const assetDirectory = { redcap: 'red-cap', roundglasses: 'round-glasses', purplescarf: 'purple-scarf', pebble: 'pebble', guidebot: 'guide-bot', backpack: 'backpack', cloud: 'cloud', otter: 'otter', thermos: 'thermos' };
  const rasterStickers = chatStickers.filter(item => Object.hasOwn(assetDirectory, item.pack));
  assert.equal(new Set(rasterStickers.map(item => item.src)).size, 351);
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
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    assert.equal(bytes.readUInt32LE(4) + 8, bytes.length);
    let flags;
    for (let offset = 12; offset + 8 <= bytes.length;) {
      const size = bytes.readUInt32LE(offset + 4), body = offset + 8;
      assert.ok(body + size <= bytes.length, item.id);
      if (bytes.toString('ascii', offset, offset + 4) === 'VP8L') {
        assert.ok(size >= 5, item.id);
        assert.equal(bytes[body], 0x2f);
        flags = bytes.readUInt32LE(body + 1);
        break;
      }
      offset = body + size + (size & 1);
    }
    assert.ok(Number.isInteger(flags), 'missing lossless WebP payload: ' + item.id);
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
