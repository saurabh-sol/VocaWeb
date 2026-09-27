import { redis } from './redis.js';
import {
  createMemoryStore,
  createUsageTracker,
  parseDailyLimit,
  type UsageStore,
} from './usage-core.js';

export { UsageLimitError } from './usage-core.js';
export type { UsageSnapshot } from './usage-core.js';

const TWO_DAYS_SECONDS = 60 * 60 * 48;

/** Falls back to in-process counters, so a Redis outage cannot lift the limit. */
const fallback = createMemoryStore();

const redisStore: UsageStore = {
  async increment(key) {
    try {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, TWO_DAYS_SECONDS);
      return count;
    } catch {
      return fallback.increment(key);
    }
  },
  async decrement(key) {
    try {
      const count = await redis.decr(key);
      if (count < 0) await redis.set(key, '0', 'EX', TWO_DAYS_SECONDS);
    } catch {
      await fallback.decrement(key);
    }
  },
  async read(key) {
    try {
      const raw = await redis.get(key);
      return Math.max(0, Number.parseInt(raw ?? '0', 10) || 0);
    } catch {
      return fallback.read(key);
    }
  },
};

const tracker = createUsageTracker({
  store: redisStore,
  getLimit: () => parseDailyLimit(process.env.FREE_DAILY_BUILDS),
});

export const getUsage = tracker.getUsage;
export const reserveBuild = tracker.reserveBuild;
