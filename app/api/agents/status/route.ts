import { agentQueue } from '../../../lib/queue';

// GET /api/agents/status?jobId=<id>
export async function GET(request: Request) {
  try {
    // Simple API key auth
    const requiredKey = process.env.AGENT_API_KEY;
    const url = new URL(request.url);
    const providedKey = request.headers.get('x-agent-api-key') || url.searchParams.get('apiKey');
    if (!requiredKey) {
      return new Response(JSON.stringify({ success: false, error: 'Server misconfigured: AGENT_API_KEY not set' }), { status: 500, headers: { 'content-type': 'application/json' } });
    }
    if (!providedKey || providedKey !== requiredKey) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } });
    }

    const jobId = url.searchParams.get('jobId');
    if (!jobId) {
      return new Response(JSON.stringify({ success: false, error: 'jobId query parameter required' }), { status: 400, headers: { 'content-type': 'application/json' } });
    }

    const job = await agentQueue.getJob(jobId as any);
    if (!job) {
      return new Response(JSON.stringify({ success: false, error: 'job not found' }), { status: 404, headers: { 'content-type': 'application/json' } });
    }

    const state = await job.getState();

    const payload = {
      success: true,
      id: job.id,
      name: job.name,
      data: job.data,
      opts: job.opts,
      state,
      attemptsMade: job.attemptsMade,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      returnvalue: job.returnvalue ?? null,
      failedReason: job.failedReason ?? null,
      stacktrace: job.stacktrace ?? null,
    };

    return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: String(err) }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}
