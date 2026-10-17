import { expireSuspensions } from "./suspensions.js";
import { migrateManagement } from "./migrations.js";
import mongoose from "mongoose";
import { readConfig } from "./config.js";
import { createApp } from "./app.js";
import { models } from "./models.js";
try {
  const config = readConfig();
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10000 });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== "isdbgrid")
    throw new Error(
      "MongoDB must use a replica set or Atlas to support transactions. See README.",
    );
  await Promise.all(Object.values(models).map((m) => m.init()));
  await migrateManagement();
  await expireSuspensions();
  const suspensionTimer = setInterval(() => expireSuspensions().catch(() => console.error("Suspension expiry check failed")), 60000);
  suspensionTimer.unref();
  const server = createApp(config).listen(config.port, () =>
    console.log(
      `NUB Connect API: http://localhost:${config.port}; MongoDB connected`,
    ),
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () =>
      server.close(async () => {
        clearInterval(suspensionTimer);
        await mongoose.disconnect();
        process.exit(0);
      }),
    );
} catch (error) {
  console.error(`Startup failed: ${error.message}`);
  process.exitCode = 1;
}
