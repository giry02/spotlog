import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareQuickCreation } from '../src/together/quickCreation.ts';
import { snapshotCreationPreview, restoreCreationPreview } from '../src/together/creationPreview.ts';
import { commitCreation } from '../src/together/creationCommit.ts';
import { createEmptyState } from '../src/together/model.ts';
import { isTogetherState } from '../src/together/repository.ts';
import { emptyMyRegions, readMyRegions, writeMyRegions } from '../src/discoveryRegionStore.ts';

test('a local walking group is not misclassified as a book club from the last syllable of 산책', () => {
  const draft = prepareQuickCreation({ purpose: 'GROUP', prompt: '주안동 주말 산책 모임', initial: { region: '인천 미추홀구 주안동' } }, []);
  assert.ok(draft.groupDraft.topics.includes('WALK'));
  assert.equal(draft.groupDraft.topics.includes('BOOK'), false);
  assert.doesNotMatch(draft.groupDraft.introduction, /독서/);
});

test('one-line group request retains the ward and town through guest preview and private commit', () => {
  const draft = prepareQuickCreation({ purpose: 'GROUP', prompt: '인천 미추홀구 주안동에서 주말에 걷는 모임', initial: { region: '부산' }, preferPromptRegion: true }, []);
  assert.equal(draft.brief.region, '인천 미추홀구 주안동');
  const preview = restoreCreationPreview(snapshotCreationPreview(draft.brief, null, draft.groupDraft), []);
  assert.equal(preview.ready, true);
  const state = createEmptyState('creator', '가상 모임장');
  const input = { requestId: 'local-group-one', brief: preview.brief, plan: null, groupDraft: preview.groupDraft };
  const created = commitCreation(state, 'creator', input, []);
  const group = state.groups.find(item => item.id === created.id);
  assert.equal(group.region, '인천');
  assert.equal(group.discovery.district, '미추홀구');
  assert.equal(group.discovery.neighborhood, '주안동');
  assert.equal(group.visibility, 'PRIVATE');
  assert.equal(state.invites.length, 0);
  assert.equal(state.activities.length, 0);
  assert.equal(isTogetherState(state), true);
  commitCreation(state, 'creator', input, []);
  assert.equal(state.groups.length, 1);
  assert.throws(() => commitCreation(state, 'creator', { ...input, groupDraft: { ...input.groupDraft, region: '인천 미추홀구 용현동' } }, []));
});

test('town-only input asks for a ward instead of inventing the parent or treating a town as a ward', () => {
  const draft = prepareQuickCreation({ purpose: 'GROUP', prompt: '인천 주안동에서 산책 모임', preferPromptRegion: true }, []);
  const restored = restoreCreationPreview(snapshotCreationPreview(draft.brief, null, draft.groupDraft), []);
  assert.equal(restored.ready, false);
  assert.ok(restored.issues.some(issue => /시·군·구/.test(issue)));
});

test('my areas distinguish two towns in the same ward, preserve old records, and reject missing parents', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const base = { ...emptyMyRegions('viewer'), regions: [{ id: 'legacy', region: '부산', district: '해운대구' }], activeId: 'legacy' };
  const saved = writeMyRegions(storage, base, 0);
  const next = { ...saved, regions: [...saved.regions, { id: 'juan', region: '인천', district: '미추홀구', neighborhood: '주안동' }, { id: 'yonghyeon', region: '인천', district: '미추홀구', neighborhood: '용현동' }], activeId: 'juan' };
  writeMyRegions(storage, next, 1);
  const read = readMyRegions(storage, 'viewer');
  assert.equal(read.status, 'ready');
  assert.deepEqual(read.state.regions, next.regions);
  assert.equal(Object.hasOwn(read.state.regions[0], 'neighborhood'), false);
  const bytes = [...values.entries()];
  assert.throws(() => writeMyRegions(storage, { ...read.state, regions: [{ id: 'bad', region: '인천', neighborhood: '주안동' }], activeId: 'bad' }, 2));
  assert.deepEqual([...values.entries()], bytes);
  assert.equal(readMyRegions(storage, 'another-viewer').state.regions.length, 0);
});
