import type { Agent, AgentContext, AgentResult } from './agents';

export const ExampleAgent: Agent = {
  id: 'example',
  description: 'Simple example agent for demos and local testing',

  async run(context: AgentContext): Promise<AgentResult> {
    // Agents should be pure and use services provided on context for side-effects.
    const who = context.userId ? `user ${context.userId}` : 'anonymous';
    const message = `ExampleAgent ran for ${who}`;

    // Return structured result for callers to inspect
    return { success: true, data: { message } };
  },
};
