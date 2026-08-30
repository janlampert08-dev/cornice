Agent framework — quickstart (for first-time users)

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
  -d '{"background": true, "agentId": "example", "userId": "u1"}'

Run synchronously (dev):
- curl -X POST http://localhost:3000/api/agents \
  -H 'Content-Type: application/json' \
  -H 'x-agent-api-key: <YOUR_KEY>' \
  -d '{"background": false, "agentId": "example", "userId": "u1"}'

Check job status:
- curl -X GET "http://localhost:3000/api/agents/status?jobId=<JOB_ID>" \
  -H 'x-agent-api-key: <YOUR_KEY>'

Tips
- Use the dashboard to observe job status, retries, logs, and to inspect payloads.
- Control retry/backoff/delay via job options in lib/queue.ts (agentQueue.add opts).
- For production, run multiple worker processes (or use container orchestration) and secure Redis.
- Add monitoring and persist job results to a DB if you need long-term auditability.

If Redis is unavailable, the dashboard and enqueueing will fail — ensure docker is running or set REDIS_URL to a reachable instance.

Docker Compose

A convenience compose file exists to start Redis, a worker, and the dashboard together:

- docker-compose up --build
- Services:
  - redis:6379
  - worker: runs the agent worker
  - dashboard: Bull Board at http://localhost:3001/admin/queues

Use docker-compose down to stop and remove containers.

