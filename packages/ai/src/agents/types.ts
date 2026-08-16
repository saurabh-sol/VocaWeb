export interface AgentTask {
  id: string;
  type: 'website' | 'ui' | 'backend' | 'database' | 'deployment' | 'git' | 'testing' | 'seo' | 'docs';
  instruction: string;
  context: Record<string, unknown>;
}

export interface AgentResult {
  taskId: string;
  success: boolean;
  output: unknown;
  tokensUsed: { input: number; output: number };
}

export interface Agent {
  id: string;
  type: AgentTask['type'];
  execute(task: AgentTask): Promise<AgentResult>;
}
