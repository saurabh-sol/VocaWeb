import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createMemoryStore,
  createUsageTracker,
  parseDailyLimit,
  withFallback,
  UsageLimitError,
  DEFAULT_DAILY_LIMIT,
  type UsageStore,
} from './usage-core.js';

function tracker(limit: number, now = () => new Date('2026-09-27T10:00:00Z')) {
  return createUsageTracker({ store: createMemoryStore(), getLimit: () => limit, now });
}

test('allows builds up to the daily limit and then refuses', async () => {
  const usage = tracker(2);
  await usage.reserveBuild('user-1');
  await usage.reserveBuild('user-1');

  await assert.rejects(usage.reserveBuild('user-1'), (err: unknown) => {
    assert.ok(err instanceof UsageLimitError);
    assert.equal(err.usage.dailyLimit, 2);
    assert.equal(err.usage.buildsToday, 2);
    return true;
  });

  // A refused request must not push the counter past the limit.
  assert.equal((await usage.getUsage('user-1')).buildsToday, 2);
});

test('a refund gives the build back, once', async () => {
  const usage = tracker(1);
  const refund = await usage.reserveBuild('user-1');
  await refund();
  await refund();

  assert.equal((await usage.getUsage('user-1')).buildsToday, 0);
  await usage.reserveBuild('user-1');
  assert.equal((await usage.getUsage('user-1')).buildsToday, 1);
});

test('each user has a separate allowance', async () => {
  const usage = tracker(1);
  await usage.reserveBuild('user-1');
  await usage.reserveBuild('user-2');
  await assert.rejects(usage.reserveBuild('user-1'), UsageLimitError);
});

test('the allowance resets on the next UTC day', async () => {
  let current = new Date('2026-09-27T23:59:00Z');
  const usage = createUsageTracker({
    store: createMemoryStore(),
    getLimit: () => 1,
    now: () => current,
  });

  await usage.reserveBuild('user-1');
  assert.equal((await usage.getUsage('user-1')).resetsAt, '2026-09-28T00:00:00.000Z');

  current = new Date('2026-09-28T00:01:00Z');
  await usage.reserveBuild('user-1');
  assert.equal((await usage.getUsage('user-1')).buildsToday, 1);
});

test('the limit falls back to the default for missing or invalid values', () => {
  assert.equal(parseDailyLimit(undefined), DEFAULT_DAILY_LIMIT);
  assert.equal(parseDailyLimit('abc'), DEFAULT_DAILY_LIMIT);
  assert.equal(parseDailyLimit('0'), DEFAULT_DAILY_LIMIT);
  assert.equal(parseDailyLimit('-3'), DEFAULT_DAILY_LIMIT);
  assert.equal(parseDailyLimit('25'), 25);
});

test('a refund after midnight returns the build to the day it was taken from', async () => {
  let current = new Date('2026-09-27T23:59:30Z');
  const store = createMemoryStore();
  const usage = createUsageTracker({ store, getLimit: () => 3, now: () => current });

  const refund = await usage.reserveBuild('user-1');
  current = new Date('2026-09-28T00:00:30Z');
  await refund();

  assert.equal(await store.read('user-1', '2026-09-27'), 0);
  assert.equal(await store.read('user-1', '2026-09-28'), 0);
});

test('a failing store falls back instead of lifting the limit', async () => {
  const broken: UsageStore = {
    increment: async () => {
      throw new Error('database down');
    },
    decrement: async () => {
      throw new Error('database down');
    },
    read: async () => {
      throw new Error('database down');
    },
  };
  const usage = createUsageTracker({
    store: withFallback(broken, createMemoryStore()),
    getLimit: () => 1,
    now: () => new Date('2026-09-27T10:00:00Z'),
  });

  await usage.reserveBuild('user-1');
  await assert.rejects(usage.reserveBuild('user-1'), UsageLimitError);
  assert.equal((await usage.getUsage('user-1')).buildsToday, 1);
});
