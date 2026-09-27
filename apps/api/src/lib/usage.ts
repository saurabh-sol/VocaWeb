import {
  decrementUsageCounter,
  incrementUsageCounter,
  readUsageCounter,
} from '@theo/db';
import {
  createMemoryStore,
  createUsageTracker,
  parseDailyLimit,
  withFallback,
  type UsageStore,
} from './usage-core.js';

export { UsageLimitError } from './usage-core.js';
export type { UsageSnapshot } from './usage-core.js';

/** Counters live in Postgres so they survive restarts and idle sleep. */
const databaseStore: UsageStore = {
  increment: incrementUsageCounter,
  decrement: decrementUsageCounter,
  read: readUsageCounter,
};

const tracker = createUsageTracker({
  store: withFallback(databaseStore, createMemoryStore()),
  getLimit: () => parseDailyLimit(process.env.FREE_DAILY_BUILDS),
});

export const getUsage = tracker.getUsage;
export const reserveBuild = tracker.reserveBuild;
