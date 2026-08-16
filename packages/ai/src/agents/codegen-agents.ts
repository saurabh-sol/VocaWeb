import type { Agent, AgentResult, AgentTask } from './types.js';
import { AgentSupervisor } from './supervisor.js';

export class VerifierAgent implements Agent {
  id = 'verifier-agent';
  type = 'testing' as const;

  async execute(task: AgentTask): Promise<AgentResult> {
    const errors = (task.context.errors as string[] | undefined) ?? [];
    const success = errors.length === 0;

    return {
      taskId: task.id,
      success,
      output: {
        verified: success,
        errors,
        message: success
          ? 'Codegen output verified'
          : `Verification failed with ${errors.length} issue(s)`,
      },
      tokensUsed: { input: 0, output: 0 },
    };
  }
}

export class CoderAgent implements Agent {
  id = 'coder-agent';
  type = 'website' as const;

  async execute(task: AgentTask): Promise<AgentResult> {
    return {
      taskId: task.id,
      success: true,
      output: {
        message: 'Coder agent delegated to orchestrator/agent-loop',
        instruction: task.instruction,
      },
      tokensUsed: { input: 0, output: 0 },
    };
  }
}

export function createDefaultSupervisor(): AgentSupervisor {
  const supervisor = new AgentSupervisor();
  supervisor.register(new VerifierAgent());
  supervisor.register(new CoderAgent());
  return supervisor;
}
