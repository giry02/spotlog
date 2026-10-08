import test from 'node:test';
import assert from 'node:assert/strict';
import { errorKindForFailure, errorKindForType, readErrorRoute } from '../src/errorStates.ts';
import { ServiceError } from '../src/serviceRequest.ts';

test('malformed route escapes become recoverable input errors, valid encoded IDs are preserved', () => {
  for (const hash of ['#%', '#%E0%A4%A', '#%ZZ']) assert.equal(readErrorRoute(hash).error, 400);
  assert.deepEqual(readErrorRoute('#journey-%ED%95%9C%EA%B8%80'), { screen: 'journey-한글' });
  assert.deepEqual(readErrorRoute(''), { screen: 'home' });
});
test('explicit error links accept supported names and codes without executing arbitrary input', () => {
  assert.equal(readErrorRoute('#error-session').error, 401);
  assert.equal(readErrorRoute('#error-402').error, 402);
  assert.equal(readErrorRoute('#error-unavailable').error, 503);
  for (const hash of ['#error-999', '#error-401abc', '#error-0401', '#error-javascript%3Aalert(1)']) assert.equal(readErrorRoute(hash).error, 404);
  for (const type of [null, 'unknown', '<script>alert(1)</script>']) assert.equal(errorKindForType(type), 404);
});
test('failure classification preserves transport status without exposing raw messages or mistaking unconfigured for offline', () => {
  assert.equal(errorKindForFailure(new ServiceError(403, 'secret token')), 403);
  assert.equal(errorKindForFailure(new ServiceError(0, 'unconfigured')), 503);
  assert.equal(errorKindForFailure(new ServiceError(504, 'timeout')), 504);
  assert.equal(errorKindForFailure(new ServiceError(422, 'private request')), 400);
  assert.equal(errorKindForFailure(new TypeError('Failed to fetch')), 'network');
  assert.equal(errorKindForFailure(new Error('private stack')), 500);
});
