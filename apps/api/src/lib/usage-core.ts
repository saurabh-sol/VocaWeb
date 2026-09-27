/**
 * Daily build allowance, independent of where the counters are kept.
 * Every build and AI edit spends platform credit on the AI Gateway, so each account
 * gets a fixed number per UTC day.
 */

export interface UsageSnapshot {
  plan: 'free';
  buildsToday: number;
  dailyLimit: number;
  /** ISO time of the next reset (midnight UTC). */
  resetsAt: string;
}

/** Minimal counter storage. Keys expire on their own after a couple of days. */
export interface UsageStore {
  increment(key: string): Promise<number>;
  decrement(key: string): Promise<void>;
  read(key: string): Promise<number>;
}

export class UsageLimitError extends Error {
  readonly statusCode = 429;
  constructor(readonly usage: UsageSnapshot) {
    super(
      `You have used all ${usage.dailyLimit} builds for today. The allowance resets at midnight UTC.`,
    );
    this.name = 'UsageLimitError';
  }
}

export const DEFAULT_DAILY_LIMIT = 10;
export const USAGE_KEY_PREFIX = 'vocaweb:usage:';

export function parseDailyLimit(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DAILY_LIMIT;
}

export function dayStamp(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function nextReset(now: Date): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  ).toISOString();
}

export interface UsageTrackerOptions {
  store: UsageStore;
  getLimit: () => number;
  now?: () => Date;
}

export function createUsageTracker({ store, getLimit, now = () => new Date() }: UsageTrackerOptions) {
  const keyFor = (userId: string) => `${USAGE_KEY_PREFIX}${userId}:${dayStamp(now())}`;

  const snapshot = (buildsToday: number): UsageSnapshot => ({
    plan: 'free',
    buildsToday,
    dailyLimit: getLimit(),
    resetsAt: nextReset(now()),
  });

  return {
    async getUsage(userId: string): Promise<UsageSnapshot> {
      return snapshot(Math.min(await store.read(keyFor(userId)), getLimit()));
    },

    /**
     * Takes one build from today's allowance. Throws UsageLimitError when none are left.
     * Call the returned function if the work fails, so a failed build costs nothing.
     */
    async reserveBuild(userId: string): Promise<() => Promise<void>> {
      const key = keyFor(userId);
      const count = await store.increment(key);

      if (count > getLimit()) {
        await store.decrement(key);
        throw new UsageLimitError(snapshot(getLimit()));
      }

      let refunded = false;
      return async () => {
        if (refunded) return;
        refunded = true;
        await store.decrement(key);
      };
    },
  };
}

/** In-process counters. Used in tests and while Redis is unreachable. */
export function createMemoryStore(): UsageStore {
  const counts = new Map<string, number>();
  return {
    async increment(key) {
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return next;
    },
    async decrement(key) {
      counts.set(key, Math.max(0, (counts.get(key) ?? 0) - 1));
    },
    async read(key) {
      return counts.get(key) ?? 0;
    },
  };
}
