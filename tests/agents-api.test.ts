import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

// Mock modules that touch network/redis
vi.mock('../lib/queue', () => ({
  enqueueAgent: vi.fn(),
}));

const { enqueueAgent } = await import('../lib/queue');

// Import agent runtime and ensure we can register a test agent
import agentManager from '../lib/agent-runtime';
import { ExampleAgent } from '../lib/agents.example';

import { POST } from '../app/api/agents/route';
import { GET } from '../app/api/agents/status/route';

function makeRequest(url: string, options: any) {
  return new Request(url, options);
}

beforeEach(() => {
  process.env.AGENT_API_KEY = 'test-key';
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('Agent API auth', () => {
  it('rejects when header missing', async () => {
    const req = makeRequest('http://localhost/api/agents', { method: 'POST', body: '{}' });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it('rejects invalid key', async () => {
    const req = makeRequest('http://localhost/api/agents', { method: 'POST', headers: { 'x-agent-api-key': 'wrong' }, body: '{}' });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it('accepts valid key and enqueues sanitized payload', async () => {
    // Ensure example agent is registered
    if (!agentManager.has(ExampleAgent.id)) agentManager.register(ExampleAgent);

    (enqueueAgent as any).mockResolvedValue({ id: 'job123' });

    const body = { background: true, agentId: 'example', actor: { userId: 'u1' }, services: [{ name: 'main-db', secret: 'should-not' }], metadata: { foo: 'bar' } };
    const req = makeRequest('http://localhost/api/agents', { method: 'POST', headers: { 'x-agent-api-key': 'test-key', 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const res = await POST(req as any);
    const text = await res.text();
    expect(res.status).toBe(202);
    expect(enqueueAgent).toHaveBeenCalled();
    const calledWith = (enqueueAgent as any).mock.calls[0][0];
    expect(calledWith.agentId).toBe('example');
    expect(calledWith.services).toEqual([{ name: 'main-db' }]);
    expect(calledWith.metadata).toEqual({ foo: 'bar' });
  });

  it('rejects apiKey in query string', async () => {
    const req = makeRequest('http://localhost/api/agents?apiKey=test-key', { method: 'POST', body: '{}' });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });
});

describe('Agent behavior and capability enforcement', () => {
  it('returns 404 for unknown agent', async () => {
    const req = makeRequest('http://localhost/api/agents', { method: 'POST', headers: { 'x-agent-api-key': 'test-key' }, body: JSON.stringify({ agentId: 'nope' }) });
    const res = await POST(req as any);
    expect(res.status).toBe(404);
  });

  it('enforces required capabilities', async () => {
    // Register a test agent requiring deployment.production
    const testAgent = { id: 'prod-agent', run: async () => ({ success: true }), requiredCapabilities: ['deployment.production'] };
    agentManager.register(testAgent as any);

    const req = makeRequest('http://localhost/api/agents', { method: 'POST', headers: { 'x-agent-api-key': 'test-key' }, body: JSON.stringify({ agentId: 'prod-agent' }) });
    const res = await POST(req as any);
    expect(res.status).toBe(403);
  });
});

describe('Status endpoint', () => {
  it('rejects query-string apiKey', async () => {
    const req = makeRequest('http://localhost/api/agents/status?jobId=1&apiKey=test-key', { method: 'GET' });
    const res = await GET(req as any);
    expect(res.status).toBe(401);
  });
});
