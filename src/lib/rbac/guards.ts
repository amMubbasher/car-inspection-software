// Anti-privilege-escalation rules. Pure functions; every mutating user/role route calls them.
import type { Permission } from "@/lib/rbac/permissions";
import { AuthError, type CurrentUser } from "@/lib/rbac/types";

export type ManagedTarget = {
  id: string;
  isSuperAdmin: boolean;
  permissions: readonly Permission[];
};

function missingFrom(actor: CurrentUser, permissions: readonly Permission[]) {
  if (actor.isSuperAdmin) return [];
  const held = new Set(actor.permissions);
  return permissions.filter((permission) => !held.has(permission));
}

/** Rule 1: an actor can only hand out (or take away) permissions they hold themselves. */
export function canGrant(actor: CurrentUser, permissions: readonly Permission[]) {
  return missingFrom(actor, permissions).length === 0;
}

export function assertCanGrant(actor: CurrentUser, permissions: readonly Permission[]) {
  const missing = missingFrom(actor, permissions);
  if (missing.length > 0) {
    throw new AuthError(
      403,
      `You cannot grant or revoke permissions you do not have: ${missing.join(", ")}`
    );
  }
}

/** Rule 2: an actor can only manage users whose power does not exceed their own. */
export function canManageUser(actor: CurrentUser, target: ManagedTarget) {
  if (actor.isSuperAdmin) return true;
  if (target.isSuperAdmin) return false;
  return missingFrom(actor, target.permissions).length === 0;
}

export function assertCanManageUser(actor: CurrentUser, target: ManagedTarget) {
  if (!canManageUser(actor, target)) {
    throw new AuthError(403, "You cannot manage a user with more access than you");
  }
}

/** Rule 3: nobody changes their own role or permissions. */
export function assertNotSelf(actor: CurrentUser, targetId: string, message: string) {
  if (actor.id === targetId) throw new AuthError(400, message);
}

/** Permissions present in exactly one of the two lists. */
export function permissionDiff(a: readonly Permission[], b: readonly Permission[]) {
  const setA = new Set(a);
  const setB = new Set(b);
  return [
    ...a.filter((permission) => !setB.has(permission)),
    ...b.filter((permission) => !setA.has(permission)),
  ];
}
