import "server-only";
import { AuthError, can, type CurrentUser } from "@/lib/rbac/server";

/**
 * Mongo filter limiting which jobs a user may see. Every job read/write is
 * combined with this, so out-of-scope jobs behave as if they don't exist.
 */
export function jobScope(user: CurrentUser): Record<string, unknown> {
  if (can(user, "jobs.view_all")) return {};
  if (can(user, "jobs.view_own")) {
    return { $or: [{ createdBy: user._id }, { assignedTo: user._id }] };
  }
  throw new AuthError(403, "You do not have permission to view jobs");
}
