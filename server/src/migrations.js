import { User, Ownership, VerifiedUser } from "./models.js";
export async function migrateManagement() {
  for (const model of [User, VerifiedUser])
    await model.collection.updateMany({ status: { $exists: false } }, [
      {
        $set: {
          status: { $cond: [{ $eq: ["$active", false] }, "blocked", "active"] },
        },
      },
    ]);
  const owners = await User.find({ role: "superadmin" }).select("_id");
  if (owners.length > 1)
    throw new Error(
      "Multiple Super Admins found; ownership migration requires operator review",
    );
  // The singleton ownership document replaces the legacy unique role index so an atomic role swap is possible.
  const indexes = await User.collection.indexes();
  for (const index of indexes)
    if (
      index.unique &&
      index.key.role === 1 &&
      Object.keys(index.key).length === 1
    )
      await User.collection.dropIndex(index.name);
  if (owners.length)
    await Ownership.updateOne(
      { _id: "platform" },
      { $setOnInsert: { owner: owners[0]._id } },
      { upsert: true },
    );
}
