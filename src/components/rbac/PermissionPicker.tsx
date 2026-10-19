"use client";

import {
  normalizePermissions,
  PERMISSION_CATALOG,
  PERMISSION_GROUPS,
  PERMISSION_IMPLIES,
  permissionsImplying,
  type Permission,
} from "@/lib/rbac/permissions";

/**
 * Grouped permission checkboxes. Permissions the viewer cannot grant are shown but
 * disabled (the server rejects them regardless).
 */
export function PermissionPicker({
  value,
  onChange,
  canToggle,
  roleDefaults,
  readOnly = false,
}: {
  value: readonly Permission[];
  onChange?: (next: Permission[]) => void;
  /** Whether the viewer may change this permission. */
  canToggle?: (permission: Permission) => boolean;
  /** When set, permissions are labelled "from role" or "extra". */
  roleDefaults?: readonly Permission[];
  readOnly?: boolean;
}) {
  const selected = new Set(value);
  const defaults = roleDefaults ? new Set(roleDefaults) : null;
  const isToggleable = (permission: Permission) =>
    !readOnly && Boolean(onChange) && (canToggle ? canToggle(permission) : true);

  // Normalizing adds implied permissions and keeps catalog order, so saved values are stable.
  const emit = (next: Set<Permission>) => onChange?.(normalizePermissions([...next]));

  const remove = (next: Set<Permission>, permission: Permission) => {
    next.delete(permission);
    // Removing "view own jobs" also removes "view all jobs", which includes it.
    for (const parent of permissionsImplying(permission)) next.delete(parent);
  };

  const toggle = (permission: Permission) => {
    if (!isToggleable(permission)) return;
    const next = new Set(selected);
    if (next.has(permission)) remove(next, permission);
    else next.add(permission);
    emit(next);
  };

  return (
    <div className="space-y-4">
      {PERMISSION_GROUPS.map((group) => {
        const items = PERMISSION_CATALOG.filter((p) => p.group === group.key);
        const toggleable = items.filter((p) => isToggleable(p.key));
        const allOn = toggleable.length > 0 && toggleable.every((p) => selected.has(p.key));

        const toggleGroup = () => {
          const next = new Set(selected);
          for (const item of toggleable) {
            if (allOn) remove(next, item.key);
            else next.add(item.key);
          }
          emit(next);
        };

        return (
          <div key={group.key} className="rounded-xl border border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2 dark:border-gray-800">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {group.label}
              </p>
              {toggleable.length > 0 && (
                <button
                  type="button"
                  onClick={toggleGroup}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                >
                  {allOn ? "Clear all" : "Select all"}
                </button>
              )}
            </div>
            <ul className="divide-y divide-gray-50 dark:divide-gray-800/60">
              {items.map((item) => {
                const checked = selected.has(item.key);
                const enabled = isToggleable(item.key);
                const fromRole = defaults?.has(item.key);
                const includedBy = permissionsImplying(item.key).filter((key) => selected.has(key));
                const includes = PERMISSION_IMPLIES[item.key] ?? [];
                const labelOf = (key: Permission) =>
                  PERMISSION_CATALOG.find((p) => p.key === key)?.label ?? key;
                return (
                  <li key={item.key}>
                    <label
                      className={`flex items-start gap-3 px-3 py-2.5 ${
                        enabled ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40" : "cursor-not-allowed opacity-60"
                      }`}
                      title={!enabled && !readOnly ? "You cannot grant a permission you don't have" : undefined}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!enabled}
                        onChange={() => toggle(item.key)}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-indigo-600"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                          {item.label}
                          {defaults && checked && !fromRole && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                              Extra
                            </span>
                          )}
                          {defaults && !checked && fromRole && (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                              Removed from role
                            </span>
                          )}
                        </span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400">
                          {item.description}
                        </span>
                        {includedBy.length > 0 && (
                          <span className="mt-0.5 block text-xs text-indigo-600 dark:text-indigo-400">
                            Included with &ldquo;{includedBy.map(labelOf).join(", ")}&rdquo;. Unchecking this also removes it.
                          </span>
                        )}
                        {includes.length > 0 && !checked && (
                          <span className="mt-0.5 block text-xs text-gray-400">
                            Also turns on &ldquo;{includes.map(labelOf).join(", ")}&rdquo;.
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
