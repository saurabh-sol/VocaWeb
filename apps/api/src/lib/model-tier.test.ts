import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkTier } from './model-tier.js';

test('v1 is open', () => {
  assert.deepEqual(checkTier('v1'), { tier: 'v1', eligible: true });
});

test('a missing or unknown tier falls back to v1', () => {
  assert.equal(checkTier(undefined).tier, 'v1');
  assert.equal(checkTier('v9').tier, 'v1');
  assert.equal(checkTier(null).eligible, true);
});

test('v2 and v3 are refused with a reason', () => {
  for (const tier of ['v2', 'v3'] as const) {
    const result = checkTier(tier);
    assert.equal(result.eligible, false);
    assert.equal(result.tier, tier);
    assert.match(result.message ?? '', /not available yet/);
  }
});
