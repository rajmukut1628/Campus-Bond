import "./config.js";
import { migrateManagement } from "./migrations.js";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { createApp } from "./app.js";
import { models } from "./models.js";
import { randomBytes } from "node:crypto";
// Development only: a real isolated MongoDB replica set with temporary data.
let db, server;
try {
  db = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    instanceOpts: [{ launchTimeout: 60000 }],
    binary: { version: "7.0.14" },
  });
  await mongoose.connect(db.getUri());
  console.log("Temporary database URI: " + db.getUri());
  await Promise.all(Object.values(models).map((m) => m.init()));
  await migrateManagement();
  const config = {
    secret: randomBytes(48).toString("hex"),
    origin: "http://localhost:5173",
    production: false,
    mailConfigPath:
      process.env.MAIL_CONFIG_PATH ||
      new URL("../../.env.mail", import.meta.url),
  };
  server = createApp(config).listen(4000, () =>
    console.log(
      "Temporary local API and MongoDB running on port 4000. Data is deleted when this process stops.",
    ),
  );
  const { User } = models;
  const { default: bcrypt } = await import("bcrypt");
  const password = randomBytes(15).toString("base64url");
  await User.create({
    name: "Local University Owner",
    email: "owner@university.test",
    universityId: "LOCAL-OWNER",
    role: "superadmin",
    password: await bcrypt.hash(password, 12),
  });
  console.log(`Local development login: owner@university.test / ${password}`);
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, async () => {
      server?.close();
      await mongoose.disconnect();
      await db?.stop();
      process.exit(0);
    });
} catch (e) {
  console.error(e);
  await mongoose.disconnect();
  await db?.stop();
  process.exitCode = 1;
}
