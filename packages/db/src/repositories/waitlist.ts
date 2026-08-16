import { sql } from '../client.js';

export interface WaitlistSubscriberRecord {
  id: string;
  email: string;
  name: string | null;
  message: string | null;
  source: string;
  user_agent: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface CreateWaitlistSubscriberInput {
  email: string;
  name?: string | null;
  message?: string | null;
  source?: string;
  userAgent?: string | null;
  ipAddress?: string | null;
}

export async function createWaitlistSubscriber(
  input: CreateWaitlistSubscriberInput,
): Promise<WaitlistSubscriberRecord> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const name = input.name?.trim() || null;
  const message = input.message?.trim() || null;
  const source = input.source?.trim() || 'footer';

  const rows = await sql`
    INSERT INTO waitlist_subscribers (email, name, message, source, user_agent, ip_address)
    VALUES (
      ${normalizedEmail},
      ${name},
      ${message},
      ${source},
      ${input.userAgent ?? null},
      ${input.ipAddress ?? null}
    )
    ON CONFLICT ((lower(email))) DO UPDATE SET
      name = COALESCE(EXCLUDED.name, waitlist_subscribers.name),
      message = COALESCE(EXCLUDED.message, waitlist_subscribers.message),
      source = EXCLUDED.source,
      user_agent = COALESCE(EXCLUDED.user_agent, waitlist_subscribers.user_agent),
      ip_address = COALESCE(EXCLUDED.ip_address, waitlist_subscribers.ip_address)
    RETURNING *
  `;

  return rows[0] as WaitlistSubscriberRecord;
}
