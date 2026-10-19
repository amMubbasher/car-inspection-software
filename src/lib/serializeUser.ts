import type { Permission } from "@/lib/rbac/permissions";

export type RoleSummary = { _id: string; key: string; name: string };

export type SafeUser = {
  _id: string;
  name?: string;
  email: string;
  role: RoleSummary | null;
  /** The user's own (copied + extra) permissions. */
  permissions: Permission[];
  isSuperAdmin: boolean;
  /** Whether the current viewer may edit/delete this user. */
  manageable?: boolean;
};

/** Minimal shape used by pickers and filters. */
export type UserOption = { _id: string; name?: string; email: string };

export type SafeRole = {
  _id: string;
  key: string;
  name: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean;
  isSuperAdmin: boolean;
  userCount: number;
  /** Viewer may assign this role to users. */
  assignable: boolean;
  /** Viewer may edit / delete this role. */
  editable: boolean;
  deletable: boolean;
};
