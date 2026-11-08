import test from 'node:test';
import assert from 'node:assert/strict';
import { groupRegionOptions, groupDistrictOptions } from '../src/together/groupRegions.ts';
import { MY_REGION_OPTIONS, emptyMyRegions } from '../src/discoveryRegionStore.ts';
import { selectGroupDiscovery } from '../src/together/groupDiscoveryModel.ts';
import { createEmptyState } from '../src/together/model.ts';

test('all seventeen regions and their district presets are available before public groups exist', () => {
  assert.deepEqual(groupRegionOptions(), [...MY_REGION_OPTIONS]);
  for (const region of MY_REGION_OPTIONS) {
    const districts=groupDistrictOptions(region);
    assert.ok(districts.length>0,region);
    assert.equal(new Set(districts).size,districts.length);
  }
  const projection=selectGroupDiscovery(createEmptyState('me','나'),{region:'부산'},'',new Date('2026-11-08T12:00:00+09:00'));
  assert.deepEqual(projection.regions,[...MY_REGION_OPTIONS]);
  assert.ok(projection.districts.includes('수영구'));
  assert.deepEqual(projection.groups,[]);
});

test('region selection preserves exact legacy custom values and does not mutate the account region store', () => {
  const previous=emptyMyRegions('member'); previous.regions.push({id:'keep',region:'부산',district:'내가 쓰던 동네'});previous.activeId='keep';
  const snapshot=structuredClone(previous), existing=['부산','부산광역시','해외·직접 입력',' 해외 이름 '];
  assert.deepEqual(groupRegionOptions(existing).slice(-3),['부산광역시','해외·직접 입력',' 해외 이름 ']);
  assert.deepEqual(groupDistrictOptions('해외·직접 입력',['내가 쓰던 동네']),['내가 쓰던 동네']);
  assert.deepEqual(groupDistrictOptions('', ['동네 A','동네 A','동네 B']),['동네 A','동네 B']);
  assert.deepEqual(previous,snapshot);
  assert.deepEqual(existing,['부산','부산광역시','해외·직접 입력',' 해외 이름 ']);
});

test('province aliases only find district presets and never rewrite original selected values', () => {
  assert.deepEqual(groupDistrictOptions('부산광역시'),groupDistrictOptions('부산'));
  assert.deepEqual(groupDistrictOptions('전북특별자치도'),groupDistrictOptions('전북'));
  const projection=selectGroupDiscovery(createEmptyState('me','나'),{region:'부산광역시',district:'직접 동네'},'',new Date('2026-11-08T12:00:00+09:00'));
  assert.ok(projection.regions.includes('부산광역시'));
  assert.ok(projection.districts.includes('수영구'));
  assert.ok(projection.districts.includes('직접 동네'));
});

test('Incheon local presets include reorganized districts while legacy labels remain available only explicitly', () => {
  for (const label of ['제물포구','영종구','검단구','서해구']) assert.ok(groupDistrictOptions('인천').includes(label));
  assert.equal(groupDistrictOptions('인천').includes('중구'),false);
  assert.equal(groupDistrictOptions('인천',['중구']).includes('중구'),true);
  assert.ok(groupDistrictOptions('대구').includes('군위군'));
  assert.equal(groupDistrictOptions('경북').includes('군위군'),false);
});
