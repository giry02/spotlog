import test from 'node:test';
import assert from 'node:assert/strict';
import { chatStickerPacks, packs, chatStickers, getChatSticker, isChatStickerId, emojiCategories } from '../src/together/chatExpressions.ts';

test('four original character packs expose exactly 34 stable, unique sticker IDs',()=>{
  assert.equal(packs,chatStickerPacks);
  assert.deepEqual(chatStickerPacks.map(pack=>pack.id),['bunny','cat','bear','duck']);
  assert.equal(chatStickers.length,34);assert.equal(new Set(chatStickers.map(sticker=>sticker.id)).size,34);
  assert.deepEqual(chatStickerPacks.map(pack=>chatStickers.filter(sticker=>sticker.pack===pack.id).length),[10,8,8,8]);
  for(const pack of chatStickerPacks){assert.equal(getChatSticker(pack.coverId).pack,pack.id);assert.ok(pack.name&&pack.shortName&&pack.description);}
});

test('only catalog IDs resolve; arbitrary URLs, markup, object keys and unknown IDs are refused',()=>{
  for(const id of [null,undefined,{},[],42,'','__proto__','constructor','toString','bunny-unknown','https://example.invalid/image.svg','data:image/svg+xml,<svg/>','<script>alert(1)</script>']){
    assert.equal(isChatStickerId(id),false);assert.equal(getChatSticker(id),null);
  }
  for(const sticker of chatStickers){assert.equal(isChatStickerId(sticker.id),true);assert.equal(getChatSticker(sticker.id),sticker);}
});

test('SVG data is self-contained constant artwork without executable markup or external resources',()=>{
  for(const sticker of chatStickers){
    assert.match(sticker.src,/^data:image\/svg\+xml;charset=utf-8,/);
    assert.equal(decodeURIComponent(sticker.src.split(',').slice(1).join(',')),sticker.svg);
    assert.match(sticker.svg,/<svg[^>]+viewBox="0 0 240 240"/);
    assert.doesNotMatch(sticker.svg,/<(?:script|foreignObject|image|iframe|a)\b|\bon\w+\s*=|(?:xlink:)?href\s*=|javascript:|url\(/i);
    assert.ok(sticker.svg.includes(sticker.label));
    assert.ok(sticker.name.trim()&&sticker.label.trim());
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
