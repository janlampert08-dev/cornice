Agent framework — quickstart (for first-time users)

WARNING: Development prototype and security boundaries

This framework is a local development prototype. It is intentionally NOT production-ready. The following security boundaries are enforced in this branch:

- API keys are accepted via the x-agent-api-key header only. Query-string API keys are rejected.
- No environment variables, secrets, tokens, or credentials are ever serialized into queue/job payloads.
- Agent contexts passed to the queue are strongly typed (AgentJobPayload) and contain only safe references to services (ServiceHandle), metadata, and explicit capabilities.
- The bull-board dashboard is explicitly guarded to run only when NODE_ENV !== 'production'. Do not expose it in production.
- Docker Compose in this repo is for local development only; it creates an unauthenticated Redis instance for convenience. Do NOT use it as a production recommendation.

Prereqs
- Node.js + npm
- Docker (for local Redis) or a reachable Redis instance

Start Redis (local, Docker):
- npm run redis:start
- (stop) npm run redis:stop

Install deps:
- npm install

Start the worker and dashboard (separate terminals):
- npm run worker    # runs scripts/agent-worker.ts
- npm run dashboard # runs scripts/agent-dashboard.ts (http://localhost:3001/admin/queues)

Run an agent (enqueue background job):
- curl -X POST http://localhost:3000/api/agents \
  -H 'Content-Type: application/json' \
  -H 'x-agent-api-key: <YOUR_KEY>' \
  -d '{"background": true, "agentId": "example", "actor": {"userId":"u1"}}'

Run synchronously (dev):
- curl -X POST http://localhost:3000/api/agents \
  -H 'Content-Type: application/json' \
  -H 'x-agent-api-key: <YOUR_KEY>' \
  -d '{"background": false, "agentId": "example", "actor": {"userId":"u1"}}'

Check job status:
- curl -X GET "http://localhost:3000/api/agents/status?jobId=<JOB_ID>" \
  -H 'x-agent-api-key: <YOUR_KEY>'

Security notes
- Do NOT expose AGENT_API_KEY in URLs or public repos. Rotate it before sharing.
- Do NOT embed production secrets in service handles. ServiceHandle is a logical reference only.
- For production, integrate with a secrets manager and an authorization/roles system. This branch only implements a local dev API key.

Tips
- Use the dashboard to observe job status, retries, logs, and to inspect payloads (development only).
- Control retry/backoff/delay via job options in lib/queue.ts (agentQueue.add opts).
- For production, run multiple worker processes (or use container orchestration) and secure Redis.
- Add monitoring and persist job results to a DB if you need long-term auditability.

If Redis is unavailable, the dashboard and enqueueing will fail — ensure docker is running or set REDIS_URL to a reachable instance.

Docker Compose

A convenience compose file exists to start Redis, a worker, and the dashboard together for local development only:

- docker-compose up --build
- Services:
  - redis:6379 (development-only: no auth)
  - worker: runs the agent worker
  - dashboard: Bull Board at http://localhost:3001/admin/queues (development-only)

Use docker-compose down to stop and remove containers.

