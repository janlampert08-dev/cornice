import { AgentManager } from './agents';
import { ExampleAgent } from './agents.example';

// App-scoped singleton manager. Importing this module always returns the same instance.
export const agentManager = new AgentManager();

// Register built-in agents here. Keep registration idempotent in case of hot reloads.
if (!agentManager.list().some(a => a.id === ExampleAgent.id)) {
  agentManager.register(ExampleAgent);
}

export default agentManager;
