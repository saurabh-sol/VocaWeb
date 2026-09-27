import { sql } from '../client.js';

/** Adds one to the user's counter for the day and returns the new total. */
export async function incrementUsageCounter(userId: string, day: string): Promise<number> {
  const rows = await sql`
    INSERT INTO usage_counters (user_id, day, count)
    VALUES (${userId}, ${day}, 1)
    ON CONFLICT (user_id, day)
    DO UPDATE SET count = usage_counters.count + 1, updated_at = now()
    RETURNING count
  `;
  return Number((rows[0] as { count: number }).count);
}

/** Takes one back, never below zero. */
export async function decrementUsageCounter(userId: string, day: string): Promise<void> {
  await sql`
    UPDATE usage_counters
    SET count = GREATEST(count - 1, 0), updated_at = now()
    WHERE user_id = ${userId} AND day = ${day}
  `;
}

export async function readUsageCounter(userId: string, day: string): Promise<number> {
  const rows = await sql`
    SELECT count FROM usage_counters WHERE user_id = ${userId} AND day = ${day}
  `;
  return rows[0] ? Number((rows[0] as { count: number }).count) : 0;
}
