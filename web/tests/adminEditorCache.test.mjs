import test from 'node:test';
import assert from 'node:assert/strict';
import { editPlaceEntry, isPlaceEditorContent, mergePlaceEditorChanges, placeEditorConflict, readPlaceEditor, writePlaceEditor } from '../src/admin/placeEditorCache.ts';

const content = () => ({ kind: 'LANDMARK', name: '', companyId: '', area: '', address: '', description: '', tags: [], operation: 'OPEN', location: { lat: null, lng: null, verified: false, reference: '', sourceUrl: '', checkedAt: '' }, rights: { display: false, store: false, modify: false, ai: false }, provider: '', sourceUrl: '', checkedAt: '', media: [], guide: { hours: '', bestTime: '', facilities: '', menu: '', lodging: '', access: '', english: '', englishStatus: 'MISSING', sourceUrl: '', checkedAt: '', sourceRevision: 0 }, ai: { text: '', tags: [], sourceUrl: '', provider: '', checkedAt: '', allowed: false, version: 1 } });
const store = () => { const values = new Map(); return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }; };

test('incomplete draft cache keeps the revision at first edit across later edits and reconnection', () => {
  const storage = store(), first = editPlaceEntry({}, { placeId: 'p', revision: 1 }, { ...content(), name: '수정 중' });
  const second = editPlaceEntry(first, { placeId: 'p', revision: 2 }, { ...content(), name: '추가 수정' });
  assert.equal(second.p.baseRevision, 1);
  assert.equal(writePlaceEditor('LOCAL', 'operator-a', second, storage), true);
  const loaded = readPlaceEditor('LOCAL', 'operator-a', storage);
  assert.equal(loaded.entries.p.content.name, '추가 수정');
  assert.equal(placeEditorConflict(loaded.entries.p, 2), true);
  assert.equal(placeEditorConflict(loaded.entries.p, 1), false);
});

test('API mode neither reads nor writes device drafts and operators use independent keys', () => {
  const storage = store(), entries = editPlaceEntry({}, { placeId: 'p', revision: 1 }, content());
  writePlaceEditor('LOCAL', 'operator-a', entries, storage);
  assert.deepEqual(readPlaceEditor('LOCAL', 'operator-b', storage).entries, {});
  const forbidden = { getItem() { throw new Error('API mode read'); }, setItem() { throw new Error('API mode write'); } };
  assert.deepEqual(readPlaceEditor('API', 'operator-a', forbidden), { entries: {}, error: '' });
  assert.equal(writePlaceEditor('API', 'operator-a', entries, forbidden), false);
});

test('malformed or wrong-principal cache is preserved and rejected before the editor renders nested fields', () => {
  for (const raw of ['null', '{broken', JSON.stringify({ schemaVersion: 2, operatorId: 'other', entries: {} }), JSON.stringify({ schemaVersion: 2, operatorId: 'operator-a', entries: { p: { baseRevision: 1, content: { ...content(), media: null } } } })]) {
    let writes = 0;
    const storage = { getItem: () => raw, setItem: () => writes++ };
    const loaded = readPlaceEditor('LOCAL', 'operator-a', storage);
    assert.deepEqual(loaded.entries, {});
    assert.ok(loaded.error);
    assert.equal(writes, 0);
  }
  assert.equal(isPlaceEditorContent(content()), true);
  assert.equal(isPlaceEditorContent({ ...content(), location: { lat: '35' } }), false);
});

test('optional editor fields and nested provenance are validated before rendering', () => {
  assert.equal(isPlaceEditorContent({...content(),regionId:{broken:true}}),false);
  assert.equal(isPlaceEditorContent({...content(),provenance:{origin:'STAFF',note:{broken:true}}}),false);
  assert.equal(isPlaceEditorContent({...content(),provenance:{origin:'STAFF',note:'미완성 설명'}}),true);
});

test('cache changes from separate tabs preserve unrelated place drafts and simultaneous newer edits', () => {
  const a = editPlaceEntry({}, {placeId:'a',revision:1},{...content(),name:'첫 탭 입력'});
  const b = editPlaceEntry({}, {placeId:'b',revision:1},{...content(),name:'둘째 탭 입력'});
  const merged = mergePlaceEditorChanges(a,{},b);
  assert.equal(merged.a.content.name,'첫 탭 입력');
  assert.equal(merged.b.content.name,'둘째 탭 입력');
  const cleared = mergePlaceEditorChanges(merged,a,{});
  assert.equal(cleared.a,undefined);
  assert.equal(cleared.b.content.name,'둘째 탭 입력');
  const newer = {...merged,a:{...a.a,content:{...a.a.content,name:'동시 추가 입력'}}};
  assert.equal(mergePlaceEditorChanges(newer,a,{}).a.content.name,'동시 추가 입력');
});
