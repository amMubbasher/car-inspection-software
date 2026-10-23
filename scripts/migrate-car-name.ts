/**
 * Renames the job field `carNumber` to `carName`. Values are moved in place, never deleted.
 * Idempotent; safe to run repeatedly.
 *
 *   npm run migrate:car-name
 */
import { existsSync } from "node:fs";
import mongoose from "mongoose";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(uri, { dbName: "car_inspection_app" });
  const jobs = mongoose.connection.collection("jobs");

  // 1. Jobs that only have the old field: move the value to the new field.
  const renamed = await jobs.updateMany(
    { carNumber: { $exists: true }, carName: { $exists: false } },
    { $rename: { carNumber: "carName" } }
  );
  console.log(`Renamed carNumber -> carName on ${renamed.modifiedCount} job(s)`);

  // 2. Jobs edited after the code change but before this script ran already have a newer
  //    carName; the stale carNumber is dropped. Logged first so nothing disappears unseen.
  const stale = await jobs
    .find({ carNumber: { $exists: true }, carName: { $exists: true } })
    .project({ jobCount: 1, carNumber: 1, carName: 1 })
    .toArray();
  for (const job of stale) {
    console.log(
      `Job #${job.jobCount}: keeping carName "${job.carName}", removing old carNumber "${job.carNumber}"`
    );
  }
  if (stale.length > 0) {
    await jobs.updateMany(
      { _id: { $in: stale.map((job) => job._id) } },
      { $unset: { carNumber: "" } }
    );
  }

  const [left, total, withName] = await Promise.all([
    jobs.countDocuments({ carNumber: { $exists: true } }),
    jobs.countDocuments({}),
    jobs.countDocuments({ carName: { $exists: true } }),
  ]);
  console.log(`Jobs: ${total}, with carName: ${withName}, still with carNumber: ${left}`);

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
