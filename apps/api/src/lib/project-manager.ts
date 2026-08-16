import { randomUUID } from 'node:crypto';
import { sanitizePath, validateFileSize } from './security.js';

const projectStores = new Map<string, Map<string, string>>();
const FULL_FILE_REWRITE_MAX_LINES = 200;

let dbAvailable: boolean | null = null;

async function getDb() {
  if (dbAvailable === false) return null;
  try {
    const mod = await import('@theo/db');
    dbAvailable = true;
    return mod;
  } catch {
    dbAvailable = false;
    return null;
  }
}

export async function persistProjectToDb(
  projectId: string,
  userId: string,
  name = 'Untitled',
  framework = 'nextjs',
): Promise<void> {
  const db = await getDb();
  if (!db || !userId || userId === 'anonymous') return;

  try {
    const existing = await db.getProject(projectId);
    if (!existing) {
      await db.createProjectInDb(userId, name, framework, projectId, db.buildProjectSlug(name, projectId));
    }

    const files = getProjectFileTree(projectId);
    if (Object.keys(files).length > 0) {
      await db.saveProjectFiles(projectId, files);
    }
  } catch (err) {
    console.error('Failed to persist project to DB:', err);
  }
}

export async function loadProjectFromDb(projectId: string): Promise<boolean> {
  if (projectStores.has(projectId)) return true;

  const db = await getDb();
  if (!db) return false;

  try {
    const files = await db.getProjectFiles(projectId);
    if (Object.keys(files).length === 0) return false;

    const store = new Map<string, string>();
    for (const [path, content] of Object.entries(files)) {
      store.set(path, content);
    }
    projectStores.set(projectId, store);
    return true;
  } catch {
    return false;
  }
}

export function getProjectStore(projectId: string): Map<string, string> {
  if (!projectStores.has(projectId)) {
    projectStores.set(projectId, new Map());
  }
  return projectStores.get(projectId)!;
}

export function writeProjectFile(projectId: string, filePath: string, content: string): void {
  const safePath = sanitizePath(filePath);
  validateFileSize(content);
  getProjectStore(projectId).set(safePath, content);
}

export function readProjectFile(projectId: string, filePath: string): string | null {
  const safePath = sanitizePath(filePath);
  return getProjectStore(projectId).get(safePath) ?? null;
}

export function deleteProjectFile(projectId: string, filePath: string): boolean {
  const safePath = sanitizePath(filePath);
  return getProjectStore(projectId).delete(safePath);
}

export function listProjectFiles(projectId: string): string[] {
  return Array.from(getProjectStore(projectId).keys()).sort();
}

export function getProjectFileTree(projectId: string): Record<string, string> {
  const store = getProjectStore(projectId);
  const result: Record<string, string> = {};
  for (const [path, content] of store) {
    result[path] = content;
  }
  return result;
}

export async function getProjectFileTreeAsync(projectId: string): Promise<Record<string, string>> {
  if (!projectStores.has(projectId)) {
    await loadProjectFromDb(projectId);
  }
  return getProjectFileTree(projectId);
}

function normalizeForSearch(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function tryReplace(existing: string, search: string, replace: string): string | null {
  if (existing.includes(search)) {
    const count = existing.split(search).length - 1;
    if (count === 1) return existing.replace(search, replace);
  }

  const normalizedExisting = normalizeForSearch(existing);
  const normalizedSearch = normalizeForSearch(search);
  if (normalizedExisting.includes(normalizedSearch)) {
    const idx = normalizedExisting.indexOf(normalizedSearch);
    const before = existing.slice(0, idx);
    const after = existing.slice(idx + search.length);
    return `${before}${replace}${after}`;
  }

  return null;
}

function canFullFileRewrite(content: string): boolean {
  return content.split('\n').length <= FULL_FILE_REWRITE_MAX_LINES;
}

export function applyFileOperations(
  projectId: string,
  operations: Array<{
    action: string;
    path: string;
    content?: string;
    search?: string;
    replace?: string;
  }>,
): { applied: number; errors: string[] } {
  const errors: string[] = [];
  let applied = 0;
  const store = getProjectStore(projectId);

  for (const op of operations) {
    try {
      const safePath = sanitizePath(op.path);

      switch (op.action) {
        case 'create': {
          if (!op.content) {
            errors.push(`create ${safePath}: missing content`);
            break;
          }
          validateFileSize(op.content);
          store.set(safePath, op.content);
          applied++;
          break;
        }
        case 'replace': {
          const existing = store.get(safePath);
          if (!existing) {
            errors.push(`replace ${safePath}: file not found`);
            break;
          }
          if (!op.search || op.replace === undefined) {
            errors.push(`replace ${safePath}: missing search/replace`);
            break;
          }

          const updated = tryReplace(existing, op.search, op.replace);
          if (updated) {
            validateFileSize(updated);
            store.set(safePath, updated);
            applied++;
            break;
          }

          if (canFullFileRewrite(existing) && op.replace.trim().length > 0) {
            validateFileSize(op.replace);
            store.set(safePath, op.replace);
            applied++;
            errors.push(`replace ${safePath}: used full-file rewrite fallback`);
            break;
          }

          errors.push(`replace ${safePath}: search string not found`);
          break;
        }
        case 'delete': {
          if (!store.delete(safePath)) {
            errors.push(`delete ${safePath}: file not found`);
          } else {
            applied++;
          }
          break;
        }
        default:
          errors.push(`unknown action: ${op.action}`);
      }
    } catch (err) {
      errors.push(
        `${op.action} ${op.path}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return { applied, errors };
}

export function deleteProject(projectId: string): void {
  projectStores.delete(projectId);
}

export function createProject(
  name: string,
  framework = 'nextjs',
): { id: string; name: string; framework: string } {
  const id = randomUUID();
  projectStores.set(id, new Map());
  return { id, name, framework };
}
