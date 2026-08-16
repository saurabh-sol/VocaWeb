import type { Agent, AgentTask, AgentResult } from './types.js';

export class AgentSupervisor {
  private agents = new Map<string, Agent>();

  register(agent: Agent): void {
    this.agents.set(agent.type, agent);
  }

  async dispatch(task: AgentTask): Promise<AgentResult> {
    const agent = this.agents.get(task.type);
    if (!agent) {
      return {
        taskId: task.id,
        success: false,
        output: `No agent registered for task type: ${task.type}`,
        tokensUsed: { input: 0, output: 0 },
      };
    }

    return agent.execute(task);
  }

  listAgents(): string[] {
    return Array.from(this.agents.keys());
  }
}
