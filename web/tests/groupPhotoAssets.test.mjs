import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { exampleGroupPhoto } from '../src/together/groupPhotoAssets.ts';
import { createEmptyState } from '../src/together/model.ts';
import { createDiscoveryCatalog, hydrateDiscoveryCatalog } from '../src/together/discoveryExamples.ts';

const at = new Date('2026-11-09T00:00:00Z');
const scene = { id: 'scene', name: '해운대 바다', area: '부산 해운대구', kind: 'LANDMARK', image: '/old-catalogue-scene.jpg' };

test('all authored group photos exist and resolve under both local and GitHub Pages bases', () => {
  for (const group of createDiscoveryCatalog([scene], at).groups) {
    const local = exampleGroupPhoto(group.id, '/');
    assert.match(local, /^\/media\/groups\/[^/]+\.jpg$/);
    assert.equal(exampleGroupPhoto(group.id, '/spotlog/'), `/spotlog${local}`);
    assert.equal(exampleGroupPhoto(group.id, '/spotlog'), `/spotlog${local}`);
    assert.ok(existsSync(new URL(`../public${local}`, import.meta.url)), local);
  }
  assert.equal(exampleGroupPhoto('visitors-own-group', '/spotlog/'), '');
  assert.equal(exampleGroupPhoto('__proto__'), '');
});

test('cover upgrade changes only original example defaults and preserves all authored content, identities and visibility', () => {
  const state = { ...createEmptyState('me', '나'), ...createDiscoveryCatalog([scene], at), discoveryCatalogVersion: 4 };
  const byId = id => state.groups.find(group => group.id === id);
  byId('public-busan-food').cover = scene.image;
  byId('public-busan-food').memberIds.push('me');
  byId('public-busan-food').visibility = 'PRIVATE';
  byId('public-busan-food').promotionActivityIds = [];
  byId('discovery-busan-books').cover = '';
  byId('discovery-gwangan-cafe').cover = '/my-upload.jpg';
  byId('discovery-gijang-outdoor').cover = scene.image;
  byId('discovery-gijang-outdoor').introduction = '내가 수정한 소개';
  byId('discovery-busan-badminton').cover = '';
  byId('discovery-busan-badminton').sourceKind = 'SERVER';
  byId('discovery-busan-running').cover = '';
  byId('discovery-busan-running').sourceKind = 'LOCAL';
  byId('discovery-busan-craft').cover = '';
  byId('discovery-busan-craft').ownerId = 'real-owner';
  state.groups = state.groups.filter(group => group.id !== 'discovery-jeju-slow');
  state.messages.push({ id: 'private-message', roomId: 'group:public-busan-food', authorId: 'me', body: '내 대화', createdAt: at.toISOString() });
  state.media.push({ id: 'private-photo', groupId: 'public-busan-food', authorId: 'me', url: '/my-photo.jpg', caption: '내 사진', createdAt: at.toISOString(), kind: 'PHOTO' });
  const before = structuredClone(state), next = hydrateDiscoveryCatalog(state, [scene], at);
  assert.deepEqual(state, before);
  assert.equal(next.discoveryCatalogVersion, 5);
  assert.equal(next.groups.find(group => group.id === 'discovery-busan-books').cover, exampleGroupPhoto('discovery-busan-books'));
  assert.equal(next.groups.find(group => group.id === 'public-busan-food').cover, exampleGroupPhoto('public-busan-food'));
  for (const original of before.groups) {
    const upgraded = next.groups.find(group => group.id === original.id);
    assert.equal(upgraded.sourceKind, original.sourceKind);
    assert.deepEqual({ ...upgraded, cover: original.cover }, original);
    if (!['public-busan-food', 'discovery-busan-books'].includes(original.id)) assert.equal(upgraded.cover, original.cover);
  }
  assert.equal(next.groups.some(group => group.id === 'discovery-jeju-slow'), false);
  for (const key of ['activities', 'members', 'messages', 'media', 'posts', 'sharedJournals', 'applications', 'invites']) assert.deepEqual(next[key], before[key]);
  assert.equal(hydrateDiscoveryCatalog(next, [scene], at), next);
});
