import { sql } from '../client.js';

export interface ProjectRecord {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  framework: string;
  status: string;
  custom_domain: string | null;
  vercel_project_id: string | null;
  slug: string | null;
  created_at: string;
  updated_at: string;
}

export async function createProjectInDb(
  userId: string,
  name: string,
  framework = 'nextjs',
  projectId?: string,
  slug?: string,
): Promise<ProjectRecord> {
  if (projectId) {
    const rows = await sql`
      INSERT INTO projects (id, user_id, name, framework, status, slug)
      VALUES (${projectId}::uuid, ${userId}, ${name}, ${framework}, 'active', ${slug ?? null})
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        updated_at = now()
      RETURNING *
    `;
    return rows[0] as ProjectRecord;
  }

  const rows = await sql`
    INSERT INTO projects (user_id, name, framework, status, slug)
    VALUES (${userId}, ${name}, ${framework}, 'active', ${slug ?? null})
    RETURNING *
  `;
  return rows[0] as ProjectRecord;
}

export function buildProjectSlug(name: string, projectId: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
  return `${base || 'site'}-${projectId.slice(0, 8)}`;
}

export function buildPersistentDomain(slug: string, baseDomain?: string): string | null {
  if (!baseDomain) return null;
  return `${slug}.${baseDomain}`;
}

export async function getProject(projectId: string): Promise<ProjectRecord | null> {
  const rows = await sql`SELECT * FROM projects WHERE id = ${projectId}`;
  return (rows[0] as ProjectRecord) ?? null;
}

export async function getUserProjects(userId: string): Promise<ProjectRecord[]> {
  const rows = await sql`
    SELECT * FROM projects WHERE user_id = ${userId}
    ORDER BY updated_at DESC
  `;
  return rows as ProjectRecord[];
}

export async function updateProjectName(projectId: string, name: string): Promise<void> {
  await sql`UPDATE projects SET name = ${name}, updated_at = now() WHERE id = ${projectId}`;
}

export async function updateProjectDomain(projectId: string, domain: string): Promise<void> {
  await sql`UPDATE projects SET custom_domain = ${domain}, updated_at = now() WHERE id = ${projectId}`;
}

export async function updateProjectVercelId(projectId: string, vercelProjectId: string): Promise<void> {
  await sql`UPDATE projects SET vercel_project_id = ${vercelProjectId}, updated_at = now() WHERE id = ${projectId}`;
}

export async function updateProjectStatus(projectId: string, status: string): Promise<void> {
  await sql`UPDATE projects SET status = ${status}, updated_at = now() WHERE id = ${projectId}`;
}

export async function deleteProjectFromDb(projectId: string): Promise<boolean> {
  const rows = await sql`DELETE FROM projects WHERE id = ${projectId} RETURNING id`;
  return rows.length > 0;
}

export async function saveProjectFiles(
  projectId: string,
  files: Record<string, string>,
): Promise<number> {
  let count = 0;
  for (const [path, content] of Object.entries(files)) {
    await sql`
      INSERT INTO project_files (project_id, path, content, size)
      VALUES (${projectId}, ${path}, ${content}, ${content.length})
      ON CONFLICT (project_id, path)
      DO UPDATE SET content = EXCLUDED.content, size = EXCLUDED.size, updated_at = now()
    `;
    count++;
  }
  return count;
}

export async function getProjectFiles(projectId: string): Promise<Record<string, string>> {
  const rows = await sql`
    SELECT path, content FROM project_files
    WHERE project_id = ${projectId} AND content IS NOT NULL
    ORDER BY path
  `;
  const result: Record<string, string> = {};
  for (const row of rows) {
    const r = row as { path: string; content: string };
    result[r.path] = r.content;
  }
  return result;
}

export async function deleteProjectFile(projectId: string, path: string): Promise<boolean> {
  const rows = await sql`
    DELETE FROM project_files
    WHERE project_id = ${projectId} AND path = ${path}
    RETURNING id
  `;
  return rows.length > 0;
}

export async function saveDeployment(
  projectId: string,
  platform: string,
  externalId: string,
  url: string,
  status: string,
  customDomain?: string,
): Promise<void> {
  await sql`
    INSERT INTO deployments (project_id, platform, status, url, custom_domain, external_id, domain)
    VALUES (${projectId}, ${platform}, ${status}, ${url}, ${customDomain ?? null}, ${externalId}, ${customDomain ?? null})
  `;
}

export async function updateDeploymentByExternalId(
  externalId: string,
  status: string,
  url?: string,
): Promise<void> {
  await sql`
    UPDATE deployments
    SET status = ${status},
        url = COALESCE(${url ?? null}, url),
        completed_at = CASE WHEN ${status} IN ('ready', 'error') THEN now() ELSE completed_at END
    WHERE external_id = ${externalId}
  `;
}

export async function getProjectDeployments(projectId: string) {
  return await sql`
    SELECT * FROM deployments
    WHERE project_id = ${projectId}
    ORDER BY created_at DESC
  `;
}

export interface AuthUserRecord {
  id: string;
  email: string;
  name: string;
  image: string | null;
}

/** Looks a user up by the id their sign-in provider gave them. */
export async function findUserByExternalId(externalId: string): Promise<AuthUserRecord | null> {
  const rows = await sql`
    SELECT id, email, name, image FROM users WHERE clerk_user_id = ${externalId}
  `;
  return (rows[0] as AuthUserRecord) ?? null;
}

export async function findOrCreateUser(
  clerkUserId: string,
  email: string,
  name: string,
  image?: string,
): Promise<{ id: string }> {
  const existing = await sql`
    SELECT id FROM users WHERE clerk_user_id = ${clerkUserId}
  `;
  if (existing.length > 0) return existing[0] as { id: string };

  const rows = await sql`
    INSERT INTO users (email, name, image, clerk_user_id, email_verified)
    VALUES (${email}, ${name}, ${image ?? null}, ${clerkUserId}, true)
    ON CONFLICT (email) DO UPDATE SET clerk_user_id = ${clerkUserId}, name = ${name}
    RETURNING id
  `;
  return rows[0] as { id: string };
}
