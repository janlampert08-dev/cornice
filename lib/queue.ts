import { Queue, Worker, QueueScheduler, Job } from 'bullmq';
import IORedis from 'ioredis';
import agentManager from './agent-runtime';
import type { AgentJobPayload, AgentContext } from './agents';

const connection = new IORedis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379');
nexport const agentQueue = new Queue('agents', { connection });
nexport async function enqueueAgent(payload: AgentJobPayload) {
  // Ensure payload does not contain secrets or environment variables
  // (AgentJobPayload type is intentionally limited)
  return await agentQueue.add('run', payload, { attempts: 3, backoff: { type: 'exponential', delay: 1000 } });
}
nexport function createAgentWorker() {
  // QueueScheduler ensures stalled jobs are handled and delayed jobs run
  const scheduler = new QueueScheduler('agents', { connection });

  const worker = new Worker('agents', async (job: Job) => {
    const payload = job.data as AgentJobPayload;
    // Reconstruct a runtime-only context (do not inject secrets)
    const context: AgentContext = {
      actor: payload.actor,
      requestId: payload.requestId,
      metadata: payload.metadata,
      capabilities: payload.capabilities,
      services: payload.services,
    };
n    const result = await agentManager.run(payload.agentId, context);
    return result;
  }, { connection, concurrency: 5 });

  worker.on('completed', (job, returnvalue) => {
    console.log(`Agent job ${job.id} completed`);
  });
  worker.on('failed', (job, err) => {
    console.error(`Agent job ${job?.id} failed`, err);
  });
n  return { worker, scheduler };
}

export default { enqueueAgent, createAgentWorker, agentQueue, connection };
