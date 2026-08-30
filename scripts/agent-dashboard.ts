import express from 'express';
import { createBullBoard } from '@bull-board/api';
import { ExpressAdapter } from '@bull-board/express';
import { BullMQAdapter } from '@bull-board/api/bullMQ';
import queueModule from '../lib/queue';

// Dashboard must only run in development/local contexts
if (process.env.NODE_ENV === 'production') {
  console.error('Agent dashboard should NOT run in production. Exiting.');
  process.exit(1);
}

const app = express();
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(queueModule.agentQueue)],
  serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());

const port = process.env.DASHBOARD_PORT ? Number(process.env.DASHBOARD_PORT) : 3001;
app.listen(port, () => {
  console.log(`Bull Board dashboard listening at http://localhost:${port}/admin/queues`);
});
