// Agent framework types and manager (secure-by-default)

// Explicit capability list for agents
export type Capability =
  | 'repository.read'
  | 'repository.write'
  | 'tests.run'
  | 'database.read'
  | 'database.write'
  | 'deployment.preview'
  | 'deployment.production';

// Safe service handles (no credentials or secrets should be carried here)
export interface ServiceHandle {
  name: string; // logical service name (e.g., 'main-db', 'git-repo')
  type?: string; // optional service type
}

// AgentJobPayload is the safe, serializable payload stored in the queue
export interface AgentJobPayload {
  agentId: string;
  actor?: { userId?: string };
  requestId?: string;
  metadata?: Record<string, string | number | boolean>;
  capabilities?: Capability[];
  services?: ServiceHandle[]; // references to services; never secrets/credentials
}

// Runtime context passed to in-process agents (not serialized)
export interface AgentContext {
  actor?: { userId?: string };
  requestId?: string;
  metadata?: Record<string, string | number | boolean>;
  capabilities?: Capability[];
  services?: ServiceHandle[];
}

export type AgentResult = {
  success: boolean;
  data?: unknown;
  error?: string;
};

export interface Agent {
  id: string; // unique agent id
  description?: string;
  // Capability the agent requires to run; default none
  requiredCapabilities?: Capability[];
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

  has(agentId: string): boolean {
    return this.agents.has(agentId);
  }

  // Enforces capability checks before running
  async run(agentId: string, context: AgentContext, signal?: AbortSignal): Promise<AgentResult> {
    const agent = this.agents.get(agentId);
    if (!agent) return { success: false, error: `Agent \"${agentId}\" not found` };

    const required = agent.requiredCapabilities ?? [];
    const provided = context.capabilities ?? [];
    const missing = required.filter(rc => !provided.includes(rc));
    if (missing.length > 0) {
      return { success: false, error: `Missing required capabilities: ${missing.join(', ')}` };
    }

    try {
      return await agent.run(context, signal);
    } catch (err: any) {
      return { success: false, error: String(err) };
    }
  }
}
