Agent framework design (brief)

Components:
- Agent interface: lightweight, promise-based run(context, signal)
- AgentManager: register/unregister/run/list agents in-process
- Example agent: demonstrates patterns and structured results

Interfaces & contracts:
- AgentContext carries services (db, queues, http clients) and metadata (userId)
- AgentResult is { success, data?, error? } — keep deterministic and observable

Tech choices:
- TypeScript for type-safety and existing codebase alignment
- In-process manager for fast local dev; migrate to workers (BullMQ/Redis or serverless tasks) for background workloads
- Observability: emit structured events and integrate with OpenTelemetry/Prometheus

Next steps:
1. Wire AgentManager into a server route or background worker entrypoint
2. Add unit tests and diagnostics
3. Prototype one background worker (queue) integration
