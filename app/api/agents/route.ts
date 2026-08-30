import type { AgentResult } from '../../../lib/agents';
import agentManager from '../../../lib/agent-runtime';
import { ExampleAgent } from '../../../lib/agents.example';
import { enqueueAgent } from '../../../lib/queue';

// POST /api/agents
// Body: { agentId?: string, userId?: string, context?: Record<string, any>, background?: boolean }
export async function POST(request: Request) {
  try {
    // Simple API key auth
    const requiredKey = process.env.AGENT_API_KEY;
    const providedKey = request.headers.get('x-agent-api-key') || new URL(request.url).searchParams.get('apiKey');
    if (!requiredKey) {
      return new Response(JSON.stringify({ success: false, error: 'Server misconfigured: AGENT_API_KEY not set' }), { status: 500, headers: { 'content-type': 'application/json' } });
    }
    if (!providedKey || providedKey !== requiredKey) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } });
    }

    const body = await request.json().catch(() => ({}));
    const agentId = body.agentId || ExampleAgent.id;
    const userId = body.userId;
    const providedContext = body.context ?? {};
    const background = Boolean(body.background);

    // Use app-scoped manager instance (registered at module load time)
    const manager = agentManager;

    const context = {
      userId,
      env: process.env,
      services: providedContext.services ?? {},
    };

    if (background) {
      const job = await enqueueAgent(agentId, context);
      return new Response(JSON.stringify({ success: true, enqueued: true, jobId: job.id }), {
        status: 202,
        headers: { 'content-type': 'application/json' },
      });
    }

    const result: AgentResult = await manager.run(agentId, context, (request as any).signal);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err: any) {
    const payload = { success: false, error: String(err) };
    return new Response(JSON.stringify(payload), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
