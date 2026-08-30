// Minimal agent interfaces and manager for the Cornice webapp

export type AgentContext = {
  userId?: string;
  env?: Record<string, any>;
  services?: Record<string, any>; // e.g., db, queue, http clients
};

export type AgentResult = {
  success: boolean;
  data?: any;
  error?: string;
};

export interface Agent {
  id: string; // unique agent id
  description?: string;
  run(context: AgentContext, signal?: AbortSignal): Promise<AgentResult>;
}

export class AgentManager {
  private agents = new Map<string, Agent>();

  register(agent: Agent) {
    this.agents.set(agent.id, agent);
  }

  unregister(agentId: string) {
    this.agents.delete(agentId);
  }

  list(): Agent[] {
    return Array.from(this.agents.values());
  }

  async run(agentId: string, context: AgentContext, signal?: AbortSignal): Promise<AgentResult> {
    const agent = this.agents.get(agentId);
    if (!agent) return { success: false, error: `Agent \"${agentId}\" not found` };

    try {
      return await agent.run(context, signal);
    } catch (err: any) {
      return { success: false, error: String(err) };
    }
  }
}
