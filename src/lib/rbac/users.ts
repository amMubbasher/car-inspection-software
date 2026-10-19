// Helpers for loading users/roles with their effective permissions on the server.
import "server-only";
import { Types } from "mongoose";
import { User } from "@/models/User";
import { Role } from "@/models/Role";
import { normalizePermissions, SUPER_ADMIN_ROLE_KEY } from "@/lib/rbac/permissions";
import { canGrant, canManageUser, type ManagedTarget } from "@/lib/rbac/guards";
import { effectivePermissions, toRoleRef, type CurrentUser } from "@/lib/rbac/server";
import type { SafeRole, SafeUser } from "@/lib/serializeUser";

type PopulatedRole = { _id: Types.ObjectId; key: string; name: string } | null;

type RawUser = {
  _id: Types.ObjectId;
  name?: string;
  email: string;
  roleId?: PopulatedRole | Types.ObjectId | null;
  permissions?: string[];
};

export const USER_PUBLIC_FIELDS = "name email roleId permissions";

export function toSafeUser(user: RawUser, viewer?: CurrentUser): SafeUser {
  const role = toRoleRef(user.roleId as PopulatedRole);
  const isSuperAdmin = role?.key === SUPER_ADMIN_ROLE_KEY;
  const safe: SafeUser = {
    _id: user._id.toString(),
    name: user.name,
    email: user.email,
    role,
    permissions: isSuperAdmin
      ? effectivePermissions(role, user.permissions)
      : normalizePermissions(user.permissions),
    isSuperAdmin,
  };
  if (viewer) safe.manageable = canManageUser(viewer, toManagedTarget(safe));
  return safe;
}

export function toManagedTarget(user: SafeUser): ManagedTarget {
  return { id: user._id, isSuperAdmin: user.isSuperAdmin, permissions: user.permissions };
}

export async function loadSafeUser(id: string) {
  const user = await User.findById(id)
    .select(USER_PUBLIC_FIELDS)
    .populate<{ roleId: PopulatedRole }>("roleId", "key name")
    .lean();
  return user ? toSafeUser(user) : null;
}

export async function countSuperAdmins() {
  const role = await Role.findOne({ key: SUPER_ADMIN_ROLE_KEY }).select("_id").lean();
  if (!role) return 0;
  return User.countDocuments({ roleId: role._id });
}

type RawRole = {
  _id: Types.ObjectId;
  key: string;
  name: string;
  description?: string;
  permissions?: string[];
  isSystem?: boolean;
};

export function rolePermissions(role: Pick<RawRole, "key" | "permissions">) {
  return effectivePermissions({ _id: "", key: role.key, name: "" }, role.permissions);
}

/** Rule 4: only a super admin can assign the super admin role. Rule 1 for every other role. */
export function canAssignRole(actor: CurrentUser, role: Pick<RawRole, "key" | "permissions">) {
  if (role.key === SUPER_ADMIN_ROLE_KEY) return actor.isSuperAdmin;
  return canGrant(actor, rolePermissions(role));
}

export function toSafeRole(role: RawRole, actor: CurrentUser, userCount: number): SafeRole {
  const isSuperAdmin = role.key === SUPER_ADMIN_ROLE_KEY;
  const permissions = rolePermissions(role);
  const withinCeiling = canGrant(actor, permissions);
  const canEdit = actor.isSuperAdmin || actor.permissions.includes("roles.edit");
  const canDelete = actor.isSuperAdmin || actor.permissions.includes("roles.delete");
  return {
    _id: role._id.toString(),
    key: role.key,
    name: role.name,
    description: role.description ?? "",
    permissions,
    isSystem: Boolean(role.isSystem),
    isSuperAdmin,
    userCount,
    assignable: canAssignRole(actor, role),
    editable: canEdit && !isSuperAdmin && withinCeiling,
    deletable: canDelete && !role.isSystem && withinCeiling && userCount === 0,
  };
}
