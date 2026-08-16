import {
  readProjectFile,
  writeProjectFile,
  deleteProjectFile,
  listProjectFiles,
} from './project-manager.js';

const ALLOWED_COMMANDS = ['npm install', 'npm run build', 'npm run dev', 'npx', 'git init', 'git add', 'git commit'];

export interface ToolResult {
  success: boolean;
  output: string;
}

export async function executeTool(
  projectId: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  switch (toolName) {
    case 'file_read': {
      const path = String(args.path ?? '');
      const content = readProjectFile(projectId, path);
      if (content === null) return { success: false, output: `File not found: ${path}` };
      return { success: true, output: content };
    }

    case 'file_write': {
      const path = String(args.path ?? '');
      const content = String(args.content ?? '');
      writeProjectFile(projectId, path, content);
      return { success: true, output: `Written: ${path} (${content.length} bytes)` };
    }

    case 'file_delete': {
      const path = String(args.path ?? '');
      const deleted = deleteProjectFile(projectId, path);
      return { success: deleted, output: deleted ? `Deleted: ${path}` : `Not found: ${path}` };
    }

    case 'file_list': {
      const files = listProjectFiles(projectId);
      return { success: true, output: files.join('\n') };
    }

    case 'terminal_run': {
      const command = String(args.command ?? '');
      const isAllowed = ALLOWED_COMMANDS.some((c) => command.startsWith(c));
      if (!isAllowed) {
        return { success: false, output: `Command not allowed: ${command}` };
      }
      return { success: true, output: `[sandbox] Would execute: ${command}\nNote: Real sandbox execution requires Docker (Phase 7 production)` };
    }

    case 'npm_install': {
      const packages = (args.packages as string[]) ?? [];
      return { success: true, output: `[sandbox] Would install: ${packages.join(', ')}` };
    }

    case 'git_commit': {
      const message = String(args.message ?? 'Auto-commit');
      return { success: true, output: `[sandbox] Would commit: "${message}"` };
    }

    default:
      return { success: false, output: `Unknown tool: ${toolName}` };
  }
}
