import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { readConfig } from "./config.js";
import { User, Ownership } from "./models.js";
try {
  const config = readConfig();
  for (const key of [
    "SEED_ADMIN_EMAIL",
    "SEED_ADMIN_ID",
    "SEED_ADMIN_NAME",
    "SEED_ADMIN_PASSWORD",
  ])
    if (!process.env[key]) throw new Error(`${key} is required`);
  if (
    process.env.SEED_ADMIN_PASSWORD.length < 11 ||
    process.env.SEED_ADMIN_PASSWORD.length > 72
  )
    throw new Error("Seed password must be 11–72 characters");
  await mongoose.connect(config.mongoUri);
  await User.init();
  if (await User.exists({ role: "superadmin" }))
    throw new Error(
      "A Super Admin already exists; bootstrap is intentionally disabled",
    );
  await mongoose.connection.transaction(async (session) => {
    const [user] = await User.create(
      [
        {
          name: process.env.SEED_ADMIN_NAME,
          email: process.env.SEED_ADMIN_EMAIL,
          universityId: process.env.SEED_ADMIN_ID,
          password: await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD, 12),
          role: "superadmin",
        },
      ],
      { session },
    );
    await Ownership.create([{ _id: "platform", owner: user._id }], { session });
  });
  console.log(
    "Owner Super Admin created. Sign in and authorize university accounts.",
  );
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
