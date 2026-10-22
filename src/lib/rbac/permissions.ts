// Single source of truth for every permission the app checks.
// Roles are data (stored in Mongo); permissions are code, because each key maps to a server check.

export const PERMISSION_GROUPS = [
  { key: "jobs", label: "Jobs" },
  { key: "reports", label: "Reports" },
  { key: "users", label: "Users" },
  { key: "roles", label: "Roles" },
] as const;

export type PermissionGroup = (typeof PERMISSION_GROUPS)[number]["key"];

export const PERMISSION_CATALOG = [
  { key: "jobs.view_all", group: "jobs", label: "View all jobs", description: "See every job in the system" },
  { key: "jobs.view_own", group: "jobs", label: "View own jobs", description: "See jobs they created or are assigned to" },
  { key: "jobs.create", group: "jobs", label: "Create jobs", description: "Post new inspection jobs" },
  { key: "jobs.edit", group: "jobs", label: "Edit jobs", description: "Edit job details and inspection results" },
  { key: "jobs.delete", group: "jobs", label: "Delete jobs", description: "Permanently delete jobs" },
  { key: "jobs.inspect", group: "jobs", label: "Perform inspections", description: "Start and complete inspections" },
  { key: "jobs.review", group: "jobs", label: "Review jobs", description: "Accept or reject completed jobs" },
  { key: "jobs.download_pdf", group: "jobs", label: "Download reports", description: "Download inspection PDF reports" },
  { key: "jobs.download_receipt", group: "jobs", label: "Download receipts", description: "Download receipts that include the price" },
  { key: "jobs.mark_payment", group: "jobs", label: "Mark payment received", description: "Mark an order's payment as received" },
  { key: "jobs.undo_payment", group: "jobs", label: "Undo payment received", description: "Clear an order's payment received status" },
  { key: "jobs.filter_by_user", group: "jobs", label: "Filter by inspector", description: "Filter the job list by inspector" },
  { key: "reports.export", group: "reports", label: "Export reports", description: "Export job totals per inspector" },
  { key: "users.view", group: "users", label: "View users", description: "Open the users page" },
  { key: "users.create", group: "users", label: "Create users", description: "Add new user accounts" },
  { key: "users.edit", group: "users", label: "Edit users", description: "Edit name, email and password" },
  { key: "users.delete", group: "users", label: "Delete users", description: "Delete user accounts" },
  { key: "users.assign_roles", group: "users", label: "Assign roles", description: "Change a user's role (copies its permissions)" },
  { key: "users.manage_permissions", group: "users", label: "Manage user permissions", description: "Grant or revoke individual permissions" },
  { key: "roles.view", group: "roles", label: "View roles", description: "Open the roles page" },
  { key: "roles.create", group: "roles", label: "Create roles", description: "Create new roles" },
  { key: "roles.edit", group: "roles", label: "Edit roles", description: "Change a role's name and permissions" },
  { key: "roles.delete", group: "roles", label: "Delete roles", description: "Delete custom roles" },
] as const satisfies readonly {
  key: string;
  group: PermissionGroup;
  label: string;
  description: string;
}[];

export type Permission = (typeof PERMISSION_CATALOG)[number]["key"];

export const ALL_PERMISSIONS = PERMISSION_CATALOG.map((p) => p.key) as [
  Permission,
  ...Permission[],
];

const PERMISSION_SET: ReadonlySet<string> = new Set(ALL_PERMISSIONS);

export function isPermission(value: unknown): value is Permission {
  return typeof value === "string" && PERMISSION_SET.has(value);
}

/**
 * Permissions that come with another one. Granting the key grants these too, and
 * removing one of these removes the key (e.g. "view all jobs" includes "view own jobs").
 */
export const PERMISSION_IMPLIES: Partial<Record<Permission, readonly Permission[]>> = {
  "jobs.view_all": ["jobs.view_own"],
};

/** Permissions that include `permission` (the reverse of PERMISSION_IMPLIES). */
export function permissionsImplying(permission: Permission): Permission[] {
  return ALL_PERMISSIONS.filter((key) => PERMISSION_IMPLIES[key]?.includes(permission));
}

/** Drops unknown keys and duplicates, adds implied permissions, keeps catalog order. */
export function normalizePermissions(values: readonly unknown[] | undefined | null): Permission[] {
  const wanted = new Set((values ?? []).filter(isPermission));
  for (const key of [...wanted]) {
    for (const implied of PERMISSION_IMPLIES[key] ?? []) wanted.add(implied);
  }
  return ALL_PERMISSIONS.filter((key) => wanted.has(key));
}

export const SUPER_ADMIN_ROLE_KEY = "super-admin";

export const SYSTEM_ROLES: {
  key: string;
  name: string;
  description: string;
  permissions: Permission[];
}[] = [
  {
    key: SUPER_ADMIN_ROLE_KEY,
    name: "Super Admin",
    description: "Full, unrestricted access. Cannot be edited or deleted.",
    permissions: [...ALL_PERMISSIONS],
  },
  {
    key: "admin",
    name: "Admin",
    description: "Manages jobs, reports and users.",
    permissions: ALL_PERMISSIONS.filter(
      (key) => !key.startsWith("roles.") || key === "roles.view"
    ),
  },
  {
    key: "member",
    name: "Member",
    description: "Team member who creates and performs inspections.",
    permissions: [
      "jobs.view_all",
      "jobs.create",
      "jobs.edit",
      "jobs.inspect",
      "jobs.download_pdf",
      "jobs.download_receipt",
    ],
  },
];

export const DEFAULT_ROLE_KEY = "member";
