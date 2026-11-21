import test from 'node:test';
import assert from 'node:assert/strict';
import { groupLocalityIssues, groupNeighborhoodOptions, groupRegionNeedsDistrict, parseGroupLocality } from '../src/together/groupRegions.ts';
import { normalizeGroupCreationDraft, validateGroupCreationDraft } from '../src/together/groupCreation.ts';
import { createConfiguredGroup } from '../src/together/groupOnboarding.ts';
import { createEmptyState } from '../src/together/model.ts';
import { isTogetherState } from '../src/together/repository.ts';
import { discoveryProfile, filterDiscoveryGroups } from '../src/together/discovery.ts';
import { selectGroupDiscovery } from '../src/together/groupDiscoveryModel.ts';
import { publicGroupJoinVersion } from '../src/together/publicActivityIntent.ts';
import { selectPublicGroupIntroduction } from '../src/together/groupContent.ts';
import { conditionDiscoveryFilters, readDiscoveryPicks, saveDiscoveryCondition, selectConditionMatches } from '../src/together/discoveryPicks.ts';

const at = new Date('2026-11-19T10:00:00+09:00');
const input = (patch = {}) => normalizeGroupCreationDraft({ name: '함께 걷는 이웃', region: '인천', district: '미추홀구', neighborhood: '주안동', ...patch });
function publicFixture() {
  const state = createEmptyState('me', '가상 모임장');
  for (const [id, region, district, neighborhood] of [
    ['same', '인천', '미추홀구', '주안동'], ['other-town', '인천', '미추홀구', '용현동'],
    ['other-ward', '인천', '다른구', '주안동'], ['other-city', '서울', '미추홀구', '주안동'],
    ['city-wide', '인천', '', undefined], ['sejong', '세종', '', '고운동'],
  ]) {
    const groupId = createConfiguredGroup(state, 'me', input({ region, district, neighborhood }), at);
    const group = state.groups.find(item => item.id === groupId);
    group.id = id; group.visibility = 'PUBLIC'; group.promotionPublished = true;
    group.discovery.recruitment = 'OPEN';
    group.promotionActivityIds = [`event-${id}`];
    state.activities.push({ id: `event-${id}`, groupId: id, title: '이웃 산책', date: '2026-11-21', endDate: '', meetingPoint: '', description: '', status: 'PLANNED', leadId: 'me', editorIds: [], participants: {}, arrivedIds: [] });
  }
  return state;
}

test('authored full labels split city, combined district and town without guessing old free text', () => {
  assert.deepEqual(parseGroupLocality('인천광역시 미추홀구 주안동'), { region: '인천', district: '미추홀구', neighborhood: '주안동' });
  assert.deepEqual(parseGroupLocality('경기 성남시 분당구 정자동'), { region: '경기', district: '성남시 분당구', neighborhood: '정자동' });
  assert.deepEqual(parseGroupLocality('세종 고운동'), { region: '세종', district: '', neighborhood: '고운동' });
  assert.deepEqual(parseGroupLocality('인천 주안동'), { region: '인천', district: '', neighborhood: '주안동' });
  assert.ok(groupLocalityIssues(parseGroupLocality('인천 주안동')).length);
  assert.deepEqual(parseGroupLocality('부산 홍대·합정'), { region: '부산', district: '홍대·합정' });
  assert.deepEqual(parseGroupLocality('부산 가족 운동'), { region: '부산', district: '가족 운동' });
  assert.deepEqual(parseGroupLocality(''), { region: '', district: '' });
});

test('two-character dong labels retain an explicitly authored city/ward hierarchy without classifying activity prose as a dong', () => {
  assert.deepEqual(parseGroupLocality('경기 안산시 상록구 이동'), { region: '경기', district: '안산시 상록구', neighborhood: '이동' });
  assert.deepEqual(parseGroupLocality('충청북도 청주시 상당구 운동'), { region: '충북', district: '청주시 상당구', neighborhood: '운동' });
  assert.deepEqual(parseGroupLocality('인천 운동'), { region: '인천', district: '운동' });
  assert.deepEqual(parseGroupLocality('부산 가족 운동'), { region: '부산', district: '가족 운동' });
  assert.deepEqual(parseGroupLocality('인천 미추홀구 가족 활동'), { region: '인천', district: '미추홀구 가족 활동' });
});

test('town is optional and scoped; Sejong keeps its actual two-tier structure', () => {
  assert.deepEqual(groupLocalityIssues({ region: '', district: '' }), []);
  assert.deepEqual(groupLocalityIssues({ region: '인천', district: '', neighborhood: '' }), []);
  assert.ok(groupLocalityIssues({ region: '', district: '미추홀구', neighborhood: '주안동' }).length);
  assert.ok(groupLocalityIssues({ region: '인천', district: '', neighborhood: '주안동' }).length);
  assert.deepEqual(groupLocalityIssues({ region: '세종', district: '', neighborhood: '고운동' }), []);
  assert.equal(groupRegionNeedsDistrict('세종특별자치시'), false);
  assert.deepEqual(groupNeighborhoodOptions('인천', '미추홀구', ['주안동', '직접 입력한 동', '주안동']), ['주안동', '직접 입력한 동']);
});

test('private creation retains the full explicit locality through repository serialization without publishing', () => {
  const state = createEmptyState('me', '가상 모임장');
  const id = createConfiguredGroup(state, 'me', input(), at);
  const created = state.groups.find(group => group.id === id);
  assert.equal(created.region, '인천'); assert.equal(created.discovery.district, '미추홀구');
  assert.equal(created.discovery.neighborhood, '주안동');
  assert.equal(created.visibility, 'PRIVATE'); assert.equal(created.promotionPublished, false);
  assert.deepEqual(created.memberIds, ['me']); assert.equal(state.activities.length, 0);
  assert.equal(isTogetherState(JSON.parse(JSON.stringify(state))), true);
  assert.equal(discoveryProfile(created).neighborhood, '주안동');
  assert.throws(() => validateGroupCreationDraft(input({ district: '', neighborhood: '주안동' })));
  const original = input({ neighborhood: undefined });
  assert.equal(Object.hasOwn(validateGroupCreationDraft(original), 'neighborhood'), false);
  const invalid = structuredClone(state); invalid.groups[0].discovery.neighborhood = '주안\u0000동';
  assert.equal(isTogetherState(invalid), false);
  const orphan = structuredClone(state); orphan.groups[0].discovery.district = '';
  assert.equal(isTogetherState(orphan), false);
});

test('matching a town never widens across a ward/city or includes unspecified city-wide groups', () => {
  const state = publicFixture();
  assert.deepEqual(filterDiscoveryGroups(state, { region: '인천', district: '미추홀구', neighborhood: '주안동' }, at).map(group => group.id), ['same']);
  assert.deepEqual(filterDiscoveryGroups(state, { neighborhood: '주안동' }, at), []);
  assert.deepEqual(filterDiscoveryGroups(state, { region: '인천', neighborhood: '주안동' }, at), []);
  assert.deepEqual(filterDiscoveryGroups(state, { region: '세종', neighborhood: '고운동' }, at).map(group => group.id), ['sejong']);
  const ward = filterDiscoveryGroups(state, { region: '인천', district: '미추홀구' }, at).map(group => group.id);
  assert.deepEqual(ward, ['same', 'other-town']);
  assert.deepEqual(filterDiscoveryGroups(state, { query: '용현동' }, at).map(group => group.id), ['other-town']);
});

test('public projections and neighborhood suggestions reveal only selected public locality labels', () => {
  const state = publicFixture();
  const privateId = createConfiguredGroup(state, 'me', input({ neighborhood: '비공개동' }), at);
  const view = selectGroupDiscovery(state, { region: '인천', district: '미추홀구' }, 'me', at);
  assert.deepEqual(view.neighborhoods, ['주안동', '용현동']);
  assert.equal(view.groups.find(group => group.id === 'same').neighborhood, '주안동');
  assert.equal(view.groups.some(group => group.id === privateId), false);
  assert.equal(view.neighborhoods.includes('비공개동'), false);
  assert.deepEqual(selectGroupDiscovery(state, { region: '인천', district: '미추홀구', neighborhood: '직접동' }, 'me', at).neighborhoods, ['주안동', '용현동', '직접동']);
  assert.equal(selectPublicGroupIntroduction(state, 'same', 'me').neighborhood, '주안동');
  const group = state.groups.find(item => item.id === 'same'), before = publicGroupJoinVersion(group);
  group.discovery.neighborhood = '다른동';
  assert.notEqual(publicGroupJoinVersion(group), before);
});

test('saved discovery conditions preserve the same town boundary and legacy records still round trip', () => {
  const state = publicFixture(), values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const condition = { name: '주안동 이웃', region: '인천', district: '미추홀구', neighborhood: '주안동', topic: '', subtopic: '', query: '', weekday: 'ALL', timeBand: 'ALL' };
  const saved = saveDiscoveryCondition(storage, 'me', state, condition, at);
  assert.equal(saved.conditions[0].neighborhood, '주안동');
  assert.equal(readDiscoveryPicks(storage, 'me').status, 'ready');
  assert.deepEqual(selectConditionMatches(state, 'me', condition, at).map(row => row.group.id), ['same']);
  assert.equal(conditionDiscoveryFilters(saved.conditions[0]).neighborhood, '주안동');
  const { neighborhood: _town, ...legacy } = condition;
  saveDiscoveryCondition(storage, 'me', state, legacy, at);
  assert.equal(readDiscoveryPicks(storage, 'me').status, 'ready');
  assert.equal(Object.hasOwn(readDiscoveryPicks(storage, 'me').state.conditions[0], 'neighborhood'), false);
});
