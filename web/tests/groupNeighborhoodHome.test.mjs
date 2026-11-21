import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { selectDiscoveryHome } from '../src/community/discoveryHomeModel.ts';
import { selectGroupDiscoveryHome, groupHomeListingFilters } from '../src/community/groupDiscoveryHomeModel.ts';
import { selectGroupDiscovery } from '../src/together/groupDiscoveryModel.ts';

const at = new Date('2026-11-19T12:00:00+09:00');
const group = (id, region, district, neighborhood, extra = {}) => ({
  id, name: id, kind: 'HOBBY', region, cover: '', introduction: '공개 소개',
  visibility: 'PUBLIC', promotionPublished: true, archived: false, ownerId: 'owner', memberIds: ['owner'], managerIds: [],
  promotionActivityIds: [id + '-event'], discovery: { topics: ['CAFE'], district, neighborhood, style: 'NEIGHBORHOOD', recruitment: 'OPEN', welcome: '함께 이야기해요', joinGuide: '', joinMode: 'DIRECT' }, ...extra,
});
const event = id => ({ id: id + '-event', groupId: id, title: id + ' 공개 약속', date: '2026-11-20', endDate: '2026-11-20', description: '',
  status: 'PLANNED', leadId: 'owner', editorIds: [], participants: {}, arrivedIds: [], meetingPoint: '내부 주소', revision: 1 });
function state() {
  const value = createEmptyState('', '');
  value.groups.push(group('주안 모임', '인천', '미추홀구', '주안동'), group('옆 동 모임', '인천', '미추홀구', '용현동'),
    group('다른 구 동명 모임', '인천', '남동구', '주안동'), group('다른 시 동명 모임', '부산', '미추홀구', '주안동'),
    group('동 미지정', '인천', '미추홀구', ''), group('비공개 주안', '인천', '미추홀구', '주안동', { visibility: 'PRIVATE' }));
  value.activities.push(...value.groups.map(item => event(item.id)));
  return value;
}
const filters = { region: '인천', district: '미추홀구', neighborhood: '주안동', query: '' };

test('home neighborhood limits groups and approved events within the selected city and district', () => {
  const source = state(), before = structuredClone(source);
  const result = selectDiscoveryHome(source, [], [], filters, '', at);
  assert.deepEqual(result.groups.map(item => item.id), ['주안 모임']);
  assert.deepEqual(result.meetups.map(item => item.group.id), ['주안 모임']);
  assert.equal(result.groups[0].neighborhood, '주안동');
  assert.equal(result.groupFilters.neighborhood, '주안동');
  assert.equal('neighborhood' in result.placeFilters, false);
  assert.equal(JSON.stringify(result).includes('내부 주소'), false);
  assert.deepEqual(source, before);
});

test('home More and interest links preserve neighborhood and resolve the same current public listing', () => {
  const source = state();
  const home = selectGroupDiscoveryHome(source, filters, '', at);
  assert.deepEqual(home.groups.map(item => item.id), ['주안 모임']);
  for (const target of [{ kind: 'GROUPS' }, { kind: 'MEETUPS' }, { kind: 'TOPIC', topic: 'CAFE' }]) {
    const next = groupHomeListingFilters(home.filters, target);
    assert.equal(next.region, '인천'); assert.equal(next.district, '미추홀구'); assert.equal(next.neighborhood, '주안동');
    assert.deepEqual(selectGroupDiscovery(source, next, '', at).groups.map(item => item.id), ['주안 모임']);
  }
});

test('clearing only the neighborhood restores district-wide results and literal neighborhood search still works', () => {
  const source = state();
  const allDistrict = selectDiscoveryHome(source, [], [], { ...filters, neighborhood: '' }, '', at);
  assert.deepEqual(allDistrict.groups.map(item => item.id), ['주안 모임', '옆 동 모임', '동 미지정']);
  const searched = selectDiscoveryHome(source, [], [], { ...filters, neighborhood: '', query: '주안동' }, '', at);
  assert.deepEqual(searched.groups.map(item => item.id), ['주안 모임']);
});
