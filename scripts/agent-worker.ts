import { createAgentWorker } from '../lib/queue';

const { worker, scheduler } = createAgentWorker();

console.log('Agent worker started');

process.on('SIGINT', async () => {
  console.log('Shutting down worker...');
  try {
    await worker.close();
  } catch (e) {
    // ignore
  }
  try {
    await (scheduler as any).close();
  } catch (e) {
    // ignore
  }
  process.exit(0);
});
