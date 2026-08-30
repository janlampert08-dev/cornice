import type { AgentResult, AgentJobPayload, AgentContext, Capability } from '../../../lib/agents';
import agentManager from '../../../lib/agent-runtime';
import { ExampleAgent } from '../../../lib/agents.example';
import { enqueueAgent } from '../../../lib/queue';

function sanitizeMetadata(input: any): Record<string, string | number | boolean> | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(input)) {
    if (['string', 'number', 'boolean'].includes(typeof v)) out[k] = v as any;
  }
  return Object.keys(out).length ? out : undefined;
}

function sanitizeServices(input: any): { name: string; type?: string }[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const out: { name: string; type?: string }[] = [];
  for (const s of input) {
    if (s && typeof s === 'object' && typeof s.name === 'string') {
      out.push({ name: s.name, type: typeof s.type === 'string' ? s.type : undefined });
    }
  }
  return out.length ? out : undefined;
}

// POST /api/agents
// Body: { agentId?: string, actor?: { userId }, metadata?, services?, capabilities?: Capability[], requestId?, background?: boolean }
export async function POST(request: Request) {
  try {
    // Simple API key auth (header only)
    const requiredKey = process.env.AGENT_API_KEY;
    const providedKey = request.headers.get('x-agent-api-key');
    if (!requiredKey) {
      return new Response(JSON.stringify({ success: false, error: 'Server misconfigured: AGENT_API_KEY not set' }), { status: 500, headers: { 'content-type': 'application/json' } });
    }
    if (!providedKey || providedKey !== requiredKey) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } });
    }

    const body = await request.json().catch(() => ({}));
    const agentId: string = body.agentId || ExampleAgent.id;
    const actor = body.actor ?? undefined;
    const requestId: string | undefined = body.requestId;
    const metadata = sanitizeMetadata(body.metadata ?? body.context?.metadata);
    const services = sanitizeServices(body.services ?? body.context?.services);
    const capabilities = Array.isArray(body.capabilities) ? (body.capabilities as Capability[]) : undefined;
    const background = Boolean(body.background);

    const manager = agentManager;

    // Reject unknown agents early
    if (!manager.has(agentId)) {
      return new Response(JSON.stringify({ success: false, error: `Agent \"${agentId}\" not found` }), { status: 404, headers: { 'content-type': 'application/json' } });
    }

    // Enforce capability requirements before enqueue/run
    const agentDef = manager.list().find(a => a.id === agentId)!;
    const requiredCaps = agentDef.requiredCapabilities ?? [];
    const providedCaps = capabilities ?? [];
    const missingCaps = requiredCaps.filter(rc => !providedCaps.includes(rc));
    if (missingCaps.length > 0) {
      return new Response(JSON.stringify({ success: false, error: `Missing required capabilities: ${missingCaps.join(', ')}` }), { status: 403, headers: { 'content-type': 'application/json' } });
    }

    // Build a safe job payload
    const payload: AgentJobPayload = {
      agentId,
      actor,
      requestId,
      metadata,
      capabilities,
      services,
    };

    if (background) {
      const job = await enqueueAgent(payload);
      return new Response(JSON.stringify({ success: true, enqueued: true, jobId: job.id }), {
        status: 202,
        headers: { 'content-type': 'application/json' },
      });
    }

    // Synchronous run: convert payload to runtime context
    const context: AgentContext = {
      actor: payload.actor,
      requestId: payload.requestId,
      metadata: payload.metadata,
      capabilities: payload.capabilities,
      services: payload.services,
    };

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
