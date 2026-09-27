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

/** Counter storage, one counter per user per UTC day (`YYYY-MM-DD`). */
export interface UsageStore {
  increment(userId: string, day: string): Promise<number>;
  decrement(userId: string, day: string): Promise<void>;
  read(userId: string, day: string): Promise<number>;
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
  const snapshot = (buildsToday: number): UsageSnapshot => ({
    plan: 'free',
    buildsToday,
    dailyLimit: getLimit(),
    resetsAt: nextReset(now()),
  });

  return {
    async getUsage(userId: string): Promise<UsageSnapshot> {
      return snapshot(Math.min(await store.read(userId, dayStamp(now())), getLimit()));
    },

    /**
     * Takes one build from today's allowance. Throws UsageLimitError when none are left.
     * Call the returned function if the work fails, so a failed build costs nothing.
     */
    async reserveBuild(userId: string): Promise<() => Promise<void>> {
      // The day is fixed when the build starts, so a refund after midnight hits the right row.
      const day = dayStamp(now());
      const count = await store.increment(userId, day);

      if (count > getLimit()) {
        await store.decrement(userId, day);
        throw new UsageLimitError(snapshot(getLimit()));
      }

      let refunded = false;
      return async () => {
        if (refunded) return;
        refunded = true;
        await store.decrement(userId, day);
      };
    },
  };
}

/** In-process counters. Used in tests and while the database is unreachable. */
export function createMemoryStore(): UsageStore {
  const counts = new Map<string, number>();
  const keyOf = (userId: string, day: string) => `${userId}:${day}`;
  return {
    async increment(userId, day) {
      const key = keyOf(userId, day);
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return next;
    },
    async decrement(userId, day) {
      const key = keyOf(userId, day);
      counts.set(key, Math.max(0, (counts.get(key) ?? 0) - 1));
    },
    async read(userId, day) {
      return counts.get(keyOf(userId, day)) ?? 0;
    },
  };
}

/** Wraps a store so that a failure falls through to a second one instead of lifting the limit. */
export function withFallback(primary: UsageStore, fallback: UsageStore): UsageStore {
  return {
    async increment(userId, day) {
      try {
        return await primary.increment(userId, day);
      } catch {
        return fallback.increment(userId, day);
      }
    },
    async decrement(userId, day) {
      try {
        await primary.decrement(userId, day);
      } catch {
        await fallback.decrement(userId, day);
      }
    },
    async read(userId, day) {
      try {
        return await primary.read(userId, day);
      } catch {
        return fallback.read(userId, day);
      }
    },
  };
}
