/**
 * Creates the system roles, migrates legacy users and bootstraps a super admin.
 * Idempotent; safe to run repeatedly.
 *
 *   npm run rbac:seed -- --super-admin=you@example.com [--reset-system-roles]
 *
 * This is deliberately a CLI script, not an HTTP endpoint: only someone with database
 * credentials can create a super admin.
 */
import { existsSync } from "node:fs";
import mongoose from "mongoose";
import { Role } from "../src/models/Role";
import { User } from "../src/models/User";
import {
  normalizePermissions,
  SUPER_ADMIN_ROLE_KEY,
  SYSTEM_ROLES,
} from "../src/lib/rbac/permissions";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const args = process.argv.slice(2);
const superAdminEmail = args
  .find((arg) => arg.startsWith("--super-admin="))
  ?.split("=")[1]
  ?.trim()
  .toLowerCase();
const resetSystemRoles = args.includes("--reset-system-roles");

const LEGACY_ROLE_MAP: Record<string, string> = { admin: "admin", team: "member" };

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(uri, { dbName: "car_inspection_app" });
  await Promise.all([Role.syncIndexes(), User.syncIndexes()]);

  // 1. System roles
  const rolesByKey = new Map<string, InstanceType<typeof Role>>();
  for (const def of SYSTEM_ROLES) {
    const permissions = def.key === SUPER_ADMIN_ROLE_KEY ? [] : def.permissions;
    let role = await Role.findOne({ key: def.key });
    if (!role) {
      role = await Role.create({ ...def, permissions, isSystem: true });
      console.log(`Created role: ${def.name}`);
    } else if (resetSystemRoles) {
      role.name = def.name;
      role.description = def.description;
      role.permissions = permissions;
      await role.save();
      console.log(`Reset role: ${def.name}`);
    }
    rolesByKey.set(def.key, role);
  }

  // 2. Legacy users ("admin" | "team" string role, no roleId)
  const legacyUsers = await User.find({
    $or: [{ roleId: null }, { roleId: { $exists: false } }],
  });
  for (const user of legacyUsers) {
    const roleKey = LEGACY_ROLE_MAP[user.role ?? ""] ?? "member";
    const role = rolesByKey.get(roleKey)!;
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          roleId: role._id,
          permissions: normalizePermissions(role.permissions),
        },
        $unset: { role: "" },
      }
    );
    console.log(`Migrated ${user.email} -> ${role.name}`);
  }
  await User.updateMany({ role: { $exists: true } }, { $unset: { role: "" } });

  // 3. Super admin bootstrap
  if (superAdminEmail) {
    const user = await User.findOne({ email: superAdminEmail });
    if (!user) throw new Error(`No user with email ${superAdminEmail}`);
    const superRole = rolesByKey.get(SUPER_ADMIN_ROLE_KEY)!;
    await User.updateOne(
      { _id: user._id },
      { $set: { roleId: superRole._id, permissions: [] }, $inc: { sessionVersion: 1 } }
    );
    console.log(`Promoted ${superAdminEmail} to Super Admin`);
  }

  const superCount = await User.countDocuments({
    roleId: rolesByKey.get(SUPER_ADMIN_ROLE_KEY)!._id,
  });
  if (superCount === 0) {
    console.warn(
      "Warning: there is no super admin. Re-run with --super-admin=<email> to create one."
    );
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
