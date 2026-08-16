-- Track Vercel deployment IDs and project slugs for persistent domains

ALTER TABLE deployments ADD COLUMN IF NOT EXISTS external_id TEXT;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS slug TEXT;

CREATE INDEX IF NOT EXISTS idx_deployments_external_id ON deployments(external_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug) WHERE slug IS NOT NULL;
