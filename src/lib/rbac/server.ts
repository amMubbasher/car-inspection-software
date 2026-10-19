// Server-side authorization core. Every API route and protected page goes through here.
// The JWT only identifies the user; permissions are always loaded fresh from the database,
// so revoking a permission takes effect on the very next request.
import "server-only";
import { cache } from "react";
import { getServerSession } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { isValidObjectId, Types } from "mongoose";
import { authOptions } from "@/lib/authOptions";
import { connectToDB } from "@/lib/db";
import { User } from "@/models/User";
import { Role } from "@/models/Role";
import { AuditLog, type IAuditLog } from "@/models/AuditLog";
import {
  ALL_PERMISSIONS,
  normalizePermissions,
  SUPER_ADMIN_ROLE_KEY,
  type Permission,
} from "@/lib/rbac/permissions";

import { AuthError, type CurrentUser, type RoleRef } from "@/lib/rbac/types";

export { AuthError };
export type { CurrentUser, RoleRef };

type PopulatedRole = { _id: Types.ObjectId; key: string; name: string } | null;

export function toRoleRef(role: PopulatedRole | undefined): RoleRef | null {
  if (!role || typeof role !== "object" || !("key" in role)) return null;
  return { _id: role._id.toString(), key: role.key, name: role.name };
}

export function effectivePermissions(
  role: RoleRef | null,
  stored: readonly unknown[] | undefined
): Permission[] {
  if (role?.key === SUPER_ADMIN_ROLE_KEY) return [...ALL_PERMISSIONS];
  return normalizePermissions(stored);
}

// Roles are only used here for their (immutable) key and display name; permissions are
// stored on each user. So a short-lived in-process cache saves a DB round trip per request
// without affecting what anyone is allowed to do.
const ROLE_CACHE_MS = 60_000;
let roleCache: { loadedAt: number; byId: Map<string, RoleRef> } | null = null;

export function invalidateRoleCache() {
  roleCache = null;
}

async function getRoleRef(roleId: string): Promise<RoleRef | null> {
  const fresh = roleCache && Date.now() - roleCache.loadedAt < ROLE_CACHE_MS;
  if (!fresh || !roleCache!.byId.has(roleId)) {
    const roles = await Role.find().select("key name").lean();
    roleCache = {
      loadedAt: Date.now(),
      byId: new Map(roles.map((role) => [role._id.toString(), toRoleRef(role)!])),
    };
  }
  return roleCache!.byId.get(roleId) ?? null;
}

/** Loads the signed-in user fresh from the DB. Deduplicated within one server render. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getServerSession(authOptions);
  const id = session?.user?._id;
  if (!id || !isValidObjectId(id)) return null;

  await connectToDB();
  const user = await User.findById(id)
    .select("name email roleId permissions sessionVersion")
    .lean();
  if (!user) return null;

  // Tokens issued before a password reset / role change / RBAC migration are rejected.
  if (session.user.sv !== (user.sessionVersion ?? 0)) return null;

  const role = user.roleId ? await getRoleRef(user.roleId.toString()) : null;
  return {
    _id: user._id,
    id: user._id.toString(),
    name: user.name?.trim() || "",
    email: user.email,
    role,
    isSuperAdmin: role?.key === SUPER_ADMIN_ROLE_KEY,
    permissions: effectivePermissions(role, user.permissions),
  };
});

export function can(user: CurrentUser, permission: Permission) {
  return user.isSuperAdmin || user.permissions.includes(permission);
}

export function canAny(user: CurrentUser, ...permissions: Permission[]) {
  return permissions.some((permission) => can(user, permission));
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new AuthError(401, "Unauthorized");
  return user;
}

/** Requires every listed permission. */
export async function requirePermission(...permissions: Permission[]) {
  const user = await requireUser();
  if (!permissions.every((permission) => can(user, permission))) {
    throw new AuthError(403, "You do not have permission to do this");
  }
  return user;
}

/** Requires at least one of the listed permissions. */
export async function requireAnyPermission(...permissions: Permission[]) {
  const user = await requireUser();
  if (!canAny(user, ...permissions)) {
    throw new AuthError(403, "You do not have permission to do this");
  }
  return user;
}

export function assertObjectId(id: string, label = "Resource") {
  if (!isValidObjectId(id)) throw new AuthError(404, `${label} not found`);
}

export async function getSuperAdminRoleId() {
  const role = await Role.findOne({ key: SUPER_ADMIN_ROLE_KEY }).select("_id").lean();
  return role?._id ?? null;
}

const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * Converts thrown errors into JSON responses. AuthError messages are safe to show;
 * anything else is logged server-side and replaced by a generic message.
 */
export function routeError(error: unknown, fallback = "Request failed") {
  if (error instanceof AuthError) {
    return NextResponse.json(
      { message: error.message, error: error.message },
      { status: error.status, headers: NO_STORE }
    );
  }
  if (error && typeof error === "object" && "code" in error && error.code === 11000) {
    return NextResponse.json(
      { message: "Duplicate entry", error: "Duplicate entry" },
      { status: 409, headers: NO_STORE }
    );
  }
  console.error(fallback, error);
  return NextResponse.json(
    { message: fallback, error: fallback },
    { status: 500, headers: NO_STORE }
  );
}

export async function audit(
  actor: CurrentUser,
  entry: Omit<IAuditLog, "actorId" | "createdAt" | "ip">
) {
  try {
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "";
    await AuditLog.create({ ...entry, actorId: actor._id, ip });
  } catch (error) {
    // Auditing must never break the request it records.
    console.error("Failed to write audit log", error);
  }
}

/**
 * Page guard for server layouts. Unauthenticated (or revoked) sessions go to the
 * login page, which clears the stale cookie; missing permissions go to the dashboard.
 */
export async function requirePageAccess(...anyOf: Permission[]) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?expired=1");
  if (anyOf.length > 0 && !canAny(user, ...anyOf)) redirect("/dashboard");
  return user;
}
