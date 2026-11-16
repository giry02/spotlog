import test from 'node:test';
import assert from 'node:assert/strict';
import { createTogetherRepository, togetherStorageKey } from '../src/together/repository.ts';

function storage() {
  const values = new Map(); let writes = 0;
  return { values, getItem: key => values.get(key) ?? null,
    setItem(key, value) { writes++; values.set(key, value); },
    removeItem: key => values.delete(key), get writes() { return writes; } };
}
function lifecycle() {
  const tracked = () => {
    const target = new EventTarget(), listeners = new Map();
    return {
      addEventListener(type, listener) { const values = listeners.get(type) || new Set(); values.add(listener); listeners.set(type, values); target.addEventListener(type, listener); },
      removeEventListener(type, listener) { listeners.get(type)?.delete(listener); target.removeEventListener(type, listener); },
      emit(type, fields = {}) { const event = new Event(type); Object.assign(event, fields); target.dispatchEvent(event); },
      count: type => listeners.get(type)?.size ?? 0,
    };
  };
  return { window: tracked(), document: Object.assign(tracked(), { visibilityState: 'visible' }) };
}
const emitStorage = (events, disk, account = 'a', fields = {}) => events.window.emit('storage', { key: togetherStorageKey(account), storageArea: disk, ...fields });

test('a same-account storage event refreshes a subscribed reader without a write or trusting event contents', () => {
  const disk = storage(), events = lifecycle();
  const writer = createTogetherRepository('a', '가', [], disk, null);
  const reader = createTogetherRepository('a', '가', [], disk, events);
  let updates = 0; const unsubscribe = reader.subscribe(() => updates++);
  assert.equal(writer.update(state => { state.members[0].name = '다른 창에서 수정'; }), true);
  assert.equal(reader.getSnapshot().members[0].name, '가');
  emitStorage(events, disk, 'a', { newValue: '{forged payload' });
  assert.equal(reader.getSnapshot().members[0].name, '다른 창에서 수정');
  assert.equal(updates, 1); assert.equal(disk.writes, 1);
  emitStorage(events, disk); assert.equal(updates, 1);
  unsubscribe();
});

test('refresh immediately revokes removed group access while keeping old snapshots immutable', () => {
  const disk = storage(), events = lifecycle();
  const writer = createTogetherRepository('a', '가', [], disk, null);
  writer.update(state => { state.groups.push({ id: 'private', name: '비공개', kind: 'FAMILY', region: '', introduction: '', cover: '', visibility: 'PRIVATE', ownerId: 'other', memberIds: ['a', 'other'], managerIds: [], archived: false, promotionPublished: false }); });
  const reader = createTogetherRepository('a', '가', [], disk, events), before = reader.getSnapshot();
  const unsubscribe = reader.subscribe(() => {});
  writer.update(state => { state.groups.find(group => group.id === 'private').memberIds = ['other']; });
  emitStorage(events, disk);
  assert.equal(reader.getSnapshot().groups.find(group => group.id === 'private').memberIds.includes('a'), false);
  assert.equal(before.groups.find(group => group.id === 'private').memberIds.includes('a'), true);
  assert.equal(Object.isFrozen(reader.getSnapshot()), true); unsubscribe();
});

test('different account keys and storage areas never load or notify this account', () => {
  const disk = storage(), otherDisk = storage(), events = lifecycle();
  const reader = createTogetherRepository('a', '가', [], disk, events);
  let updates = 0; const unsubscribe = reader.subscribe(() => updates++);
  const before = reader.getSnapshot();
  createTogetherRepository('b', '나', [], disk, null).update(state => { state.members[0].name = '다른 계정'; });
  emitStorage(events, disk, 'b'); emitStorage(events, otherDisk);
  assert.equal(reader.getSnapshot(), before); assert.equal(updates, 0);
  assert.equal(disk.getItem(togetherStorageKey('a')), null); unsubscribe();
});

test('hidden windows catch up on visible or focus without background reads or duplicate notification', () => {
  const disk = storage(), events = lifecycle();
  const writer = createTogetherRepository('a', '가', [], disk, null);
  const reader = createTogetherRepository('a', '가', [], disk, events);
  let updates = 0; const unsubscribe = reader.subscribe(() => updates++);
  events.document.visibilityState = 'hidden';
  writer.update(state => { state.members[0].name = '백그라운드 변경'; });
  emitStorage(events, disk); events.window.emit('focus'); events.document.emit('visibilitychange');
  assert.equal(updates, 0); assert.equal(reader.getSnapshot().members[0].name, '가');
  events.document.visibilityState = 'visible'; events.document.emit('visibilitychange');
  assert.equal(updates, 1); assert.equal(reader.getSnapshot().members[0].name, '백그라운드 변경');
  events.window.emit('focus'); assert.equal(updates, 1);
  writer.update(state => { state.members[0].name = '포커스 변경'; }); events.window.emit('focus');
  assert.equal(updates, 2); assert.equal(reader.getSnapshot().members[0].name, '포커스 변경'); unsubscribe();
});

test('observers exist only while subscribed and resubscription catches changes made while detached', () => {
  const disk = storage(), events = lifecycle(), reader = createTogetherRepository('a', '가', [], disk, events);
  assert.equal(events.window.count('storage'), 0);
  const stopOne = reader.subscribe(() => {}), stopTwo = reader.subscribe(() => {});
  assert.equal(events.window.count('storage'), 1); assert.equal(events.window.count('focus'), 1); assert.equal(events.document.count('visibilitychange'), 1);
  stopOne(); assert.equal(events.window.count('storage'), 1); stopTwo(); stopTwo();
  assert.equal(events.window.count('storage'), 0); assert.equal(events.window.count('focus'), 0); assert.equal(events.document.count('visibilitychange'), 0);
  createTogetherRepository('a', '가', [], disk, null).update(state => { state.members[0].name = '구독 중지 동안'; });
  emitStorage(events, disk); assert.equal(reader.getSnapshot().members[0].name, '가');
  const stopThree = reader.subscribe(() => {});
  assert.equal(reader.getSnapshot().members[0].name, '구독 중지 동안'); assert.equal(events.window.count('storage'), 1); stopThree();
});

test('external corruption or read failure preserves previous bytes and blocks writes until valid recovery', () => {
  const disk = storage(), events = lifecycle(), writer = createTogetherRepository('a', '가', [], disk, null);
  writer.update(state => { state.members[0].name = '정상 원본'; });
  const reader = createTogetherRepository('a', '가', [], disk, events), before = reader.getSnapshot();
  const unsubscribe = reader.subscribe(() => {}), valid = disk.getItem(togetherStorageKey('a'));
  disk.values.set(togetherStorageKey('a'), '{broken'); emitStorage(events, disk);
  assert.equal(reader.getSnapshot(), before); assert.match(reader.getError(), /읽지 못/);
  assert.equal(reader.update(state => { state.members[0].name = '덮어쓰기 금지'; }), false);
  assert.equal(disk.getItem(togetherStorageKey('a')), '{broken');
  disk.values.set(togetherStorageKey('a'), valid); events.window.emit('focus');
  assert.equal(reader.getError(), null); assert.equal(reader.update(state => { state.members[0].name = '복구 후 수정'; }), true);
  const recovered = reader.getSnapshot(), getItem = disk.getItem; disk.getItem = () => { throw new Error('denied'); };
  events.window.emit('focus'); assert.equal(reader.getSnapshot(), recovered); assert.match(reader.getError(), /읽지 못/);
  disk.getItem = getItem; events.window.emit('focus'); assert.equal(reader.getError(), null); unsubscribe();
});

test('external removal clears old private state without rewriting storage or touching another account', () => {
  const disk = storage(), events = lifecycle(), writer = createTogetherRepository('a', '가', [], disk, null);
  writer.update(state => { state.messages.push({ id: 'private', roomId: 'group:old', authorId: 'a', body: '보존하면 안 되는 이전 기록', createdAt: '2026-11-16T00:00:00Z' }); });
  disk.values.set(togetherStorageKey('b'), 'untouched-other-account');
  const reader = createTogetherRepository('a', '가', [], disk, events), unsubscribe = reader.subscribe(() => {}), writes = disk.writes;
  disk.removeItem(togetherStorageKey('a')); emitStorage(events, disk, 'a', { key: null });
  assert.equal(reader.getSnapshot().messages.some(item => item.id === 'private'), false);
  assert.equal(disk.getItem(togetherStorageKey('a')), null); assert.equal(disk.writes, writes);
  assert.equal(disk.getItem(togetherStorageKey('b')), 'untouched-other-account'); unsubscribe();
});

test('initial corruption can recover only from new valid account bytes and one subscriber cannot block another', () => {
  const disk = storage(), events = lifecycle(); disk.values.set(togetherStorageKey('a'), '{bad');
  const reader = createTogetherRepository('a', '가', [], disk, events); let updates = 0;
  const one = reader.subscribe(() => { throw new Error('subscriber failed'); }), two = reader.subscribe(() => updates++);
  assert.equal(reader.update(() => {}), false); assert.equal(disk.getItem(togetherStorageKey('a')), '{bad');
  const replacement = createTogetherRepository('b', '새 이름', [], storage(), null).getSnapshot();
  disk.values.set(togetherStorageKey('a'), JSON.stringify(replacement)); emitStorage(events, disk);
  assert.equal(updates, 1); assert.equal(reader.getError(), null); assert.equal(disk.writes, 0);
  one(); two();
});
