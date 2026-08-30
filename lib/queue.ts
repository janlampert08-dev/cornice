import { Queue, Worker, QueueScheduler, Job } from 'bullmq';
import IORedis from 'ioredis';
import agentManager from './agent-runtime';

const connection = new IORedis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379');

export const agentQueue = new Queue('agents', { connection });

export async function enqueueAgent(agentId: string, context: Record<string, any>) {
  return await agentQueue.add('run', { agentId, context }, { attempts: 3, backoff: { type: 'exponential', delay: 1000 } });
}

export function createAgentWorker() {
  // QueueScheduler ensures stalled jobs are handled and delayed jobs run
  const scheduler = new QueueScheduler('agents', { connection });

  const worker = new Worker('agents', async (job: Job) => {
    const { agentId, context } = job.data;
    const result = await agentManager.run(agentId, context);
    return result;
  }, { connection });

  worker.on('completed', (job, returnvalue) => {
    console.log(`Agent job ${job.id} completed`, returnvalue);
  });
  worker.on('failed', (job, err) => {
    console.error(`Agent job ${job?.id} failed`, err);
  });

  return { worker, scheduler };
}

export default { enqueueAgent, createAgentWorker, agentQueue, connection };
