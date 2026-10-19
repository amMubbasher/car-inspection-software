// Dependency-free RBAC types, shared by the server core and the pure guards.
import type { Types } from "mongoose";
import type { Permission } from "@/lib/rbac/permissions";

export type RoleRef = { _id: string; key: string; name: string };

export type CurrentUser = {
  _id: Types.ObjectId;
  id: string;
  name: string;
  email: string;
  role: RoleRef | null;
  isSuperAdmin: boolean;
  /** Effective permissions (the whole catalog for a super admin). */
  permissions: Permission[];
};

export class AuthError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409,
    message: string
  ) {
    super(message);
    this.name = "AuthError";
  }
}
