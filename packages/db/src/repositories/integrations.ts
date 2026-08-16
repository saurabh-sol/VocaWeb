import { sql } from '../client.js';

export type IntegrationProvider = 'notion' | 'canva' | 'figma';

export interface UserIntegrationRecord {
  id: string;
  user_id: string;
  provider: IntegrationProvider;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  scopes: string[] | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectImportRecord {
  id: string;
  user_id: string;
  project_id: string | null;
  provider: string;
  external_id: string;
  title: string | null;
  source_url: string | null;
  snapshot_hash: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export async function getUserIntegration(
  userId: string,
  provider: IntegrationProvider,
): Promise<UserIntegrationRecord | null> {
  const rows = await sql`
    SELECT * FROM user_integrations
    WHERE user_id = ${userId} AND provider = ${provider}
  `;
  return (rows[0] as UserIntegrationRecord) ?? null;
}

export async function listUserIntegrations(userId: string): Promise<UserIntegrationRecord[]> {
  const rows = await sql`
    SELECT * FROM user_integrations
    WHERE user_id = ${userId}
    ORDER BY provider ASC
  `;
  return rows as UserIntegrationRecord[];
}

export async function upsertUserIntegration(input: {
  userId: string;
  provider: IntegrationProvider;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  scopes?: string[];
  metadata?: Record<string, unknown>;
}): Promise<UserIntegrationRecord> {
  const rows = await sql`
    INSERT INTO user_integrations (
      user_id, provider, access_token, refresh_token, expires_at, scopes, metadata
    )
    VALUES (
      ${input.userId},
      ${input.provider},
      ${input.accessToken},
      ${input.refreshToken ?? null},
      ${input.expiresAt ?? null},
      ${input.scopes ?? null},
      ${input.metadata ? JSON.stringify(input.metadata) : null}
    )
    ON CONFLICT (user_id, provider) DO UPDATE SET
      access_token = EXCLUDED.access_token,
      refresh_token = COALESCE(EXCLUDED.refresh_token, user_integrations.refresh_token),
      expires_at = EXCLUDED.expires_at,
      scopes = EXCLUDED.scopes,
      metadata = COALESCE(EXCLUDED.metadata, user_integrations.metadata),
      updated_at = now()
    RETURNING *
  `;
  return rows[0] as UserIntegrationRecord;
}

export async function mergeUserIntegrationMetadata(
  userId: string,
  provider: IntegrationProvider,
  patch: Record<string, unknown>,
): Promise<void> {
  const row = await getUserIntegration(userId, provider);
  if (!row) {
    throw new Error(`Integration not found: ${provider}`);
  }
  const metadata = { ...(row.metadata ?? {}), ...patch };
  await sql`
    UPDATE user_integrations
    SET metadata = ${JSON.stringify(metadata)}, updated_at = now()
    WHERE user_id = ${userId} AND provider = ${provider}
  `;
}

export async function deleteUserIntegration(
  userId: string,
  provider: IntegrationProvider,
): Promise<boolean> {
  const rows = await sql`
    DELETE FROM user_integrations
    WHERE user_id = ${userId} AND provider = ${provider}
    RETURNING id
  `;
  return rows.length > 0;
}

export async function logProjectImport(input: {
  userId: string;
  projectId?: string;
  provider: string;
  externalId: string;
  title?: string;
  sourceUrl?: string;
  snapshotHash?: string;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const rows = await sql`
    INSERT INTO project_imports (
      user_id, project_id, provider, external_id, title, source_url, snapshot_hash, metadata
    )
    VALUES (
      ${input.userId},
      ${input.projectId ?? null},
      ${input.provider},
      ${input.externalId},
      ${input.title ?? null},
      ${input.sourceUrl ?? null},
      ${input.snapshotHash ?? null},
      ${input.metadata ? JSON.stringify(input.metadata) : null}
    )
    RETURNING id
  `;
  return (rows[0] as { id: string }).id;
}
