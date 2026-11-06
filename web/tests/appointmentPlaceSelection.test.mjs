import test from 'node:test';
import assert from 'node:assert/strict';
import { selectAppointmentPlace } from '../src/community/appointmentPlaceSelection.ts';

const places = [
  { id: 'a', name: 'A 음식점', address: '부산 수영구 A지점' },
  { id: 'b', name: 'B 카페', address: '부산 중구 B지점' },
  { id: 'branch-a', name: '같은 상호', address: '부산 수영구 1' },
  { id: 'branch-b', name: '같은 상호', address: '부산 중구 2' },
];

test('selecting another exact place updates only its automatically filled meeting point', () => {
  const input = { title: '함께 식사', date: '2026-11-10', placeId: 'a', meetingPoint: 'A 음식점', description: '직접 작성한 안내', kind: 'FAMILY' };
  const before = structuredClone(input), catalogBefore = structuredClone(places);
  assert.deepEqual(selectAppointmentPlace(input, 'b', places), { ...input, placeId: 'b', meetingPoint: 'B 카페' });
  assert.deepEqual(input, before); assert.deepEqual(places, catalogBefore);
});

test('a manually specified station exit or venue detail survives changing or clearing the saved place', () => {
  for (const meetingPoint of ['수영역 3번 출구', 'A 음식점 입구 옆 벤치']) {
    const input = { title: '약속', date: '', placeId: 'a', meetingPoint };
    assert.equal(selectAppointmentPlace(input, 'b', places).meetingPoint, meetingPoint);
    assert.equal(selectAppointmentPlace(input, '', places).meetingPoint, meetingPoint);
  }
});

test('clearing an automatic venue clears the old name, and an empty meeting point adopts the selected venue', () => {
  const input = { title: '약속', date: '', placeId: 'a', meetingPoint: 'A 음식점' };
  assert.equal(selectAppointmentPlace(input, '', places).meetingPoint, '');
  assert.equal(selectAppointmentPlace({ ...input, placeId: '', meetingPoint: '' }, 'b', places).meetingPoint, 'B 카페');
});

test('same-name branches preserve exact selected identity and a removed target cannot rewrite the draft', () => {
  const input = { title: '약속', date: '', placeId: 'branch-a', meetingPoint: '같은 상호' };
  const next = selectAppointmentPlace(input, 'branch-b', places);
  assert.equal(next.placeId, 'branch-b'); assert.equal(next.meetingPoint, '같은 상호');
  assert.deepEqual(selectAppointmentPlace(input, 'removed-branch', places), input);
});
