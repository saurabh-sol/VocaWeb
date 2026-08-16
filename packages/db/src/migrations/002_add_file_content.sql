-- Add content column to project_files for storing file contents directly
-- (In production, large files should go to object storage and only hash stored here)

ALTER TABLE project_files ADD COLUMN IF NOT EXISTS content TEXT;

-- Add custom_domain to deployments for persistent domain mapping
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS custom_domain TEXT;

-- Add vercel_project_id to projects for linking to Vercel projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS vercel_project_id TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS custom_domain TEXT;

-- Add clerk_user_id to users for Clerk integration (nullable for migration)
ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_user_id TEXT UNIQUE;

-- Index for fast Clerk user lookup
CREATE INDEX IF NOT EXISTS idx_users_clerk_user_id ON users(clerk_user_id);
