import { expireSuspensions } from './suspensions.js';
import { migrateManagement } from './migrations.js';
import mongoose from 'mongoose';
import { readConfig } from './config.js';
import { createApp } from './app.js';
import { models } from './models.js';
import { connectWithRetry, connectionHint } from './database-connection.js';
const controller = new AbortController();
let server, suspensionTimer, stopping = false, initialized = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  controller.abort();
  clearInterval(suspensionTimer);
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  process.exitCode = code;
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { void stop(); });
try {
  const config = readConfig();
  const app = createApp({ ...config, databaseReady: () => initialized });
  await new Promise((resolve, reject) => {
    server = app.listen(config.port, () => { console.log(`CampusBond API: http://localhost:${config.port}; connecting to MongoDB...`); resolve(); });
    server.once('error', reject);
  });
  await connectWithRetry(() => mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10000 }), {
    signal: controller.signal, disconnect: () => mongoose.disconnect(),
  });
  if (!controller.signal.aborted) {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    if (!hello.setName && hello.msg !== 'isdbgrid') throw new Error('MongoDB must use a replica set or Atlas to support transactions.');
    await Promise.all(Object.values(models).map(model => model.init()));
    await migrateManagement();
    await expireSuspensions();
    initialized = true;
    console.log('MongoDB connected; CampusBond API ready.');
    suspensionTimer = setInterval(() => {
      if (mongoose.connection.readyState === 1) expireSuspensions().catch(() => console.error('Suspension expiry check failed'));
    }, 60000);
    suspensionTimer.unref();
  }
} catch (error) {
  console.error(`Startup failed: ${connectionHint(error)}`);
  await stop(1);
}
