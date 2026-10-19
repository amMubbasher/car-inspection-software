"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import type { Permission } from "@/lib/rbac/permissions";
import type { RoleSummary } from "@/lib/serializeUser";

type Me = {
  user: { _id: string; name: string; email: string };
  role: RoleSummary | null;
  permissions: Permission[];
  isSuperAdmin: boolean;
};

type PermissionsContextValue = {
  me: Me | null;
  loading: boolean;
  isSuperAdmin: boolean;
  can: (permission: Permission) => boolean;
  canAny: (...permissions: Permission[]) => boolean;
  reload: () => Promise<void>;
};

const PermissionsContext = createContext<PermissionsContextValue | null>(null);

/**
 * Loads the signed-in user's live permissions from /api/me. This only decides what
 * the UI shows; every action is re-checked on the server.
 */
export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/me", { cache: "no-store" });
      if (res.status === 401) {
        setMe(null);
        if (!window.location.pathname.startsWith("/login")) {
          window.location.href = "/login?expired=1";
        }
        return;
      }
      if (res.ok) setMe(await res.json());
    } catch {
      // Keep the last known permissions on network errors.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      reload();
    } else if (status === "unauthenticated") {
      setMe(null);
      setLoading(false);
    }
  }, [status, reload]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const onFocus = () => reload();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [status, reload]);

  const value = useMemo<PermissionsContextValue>(() => {
    const held = new Set(me?.permissions ?? []);
    const can = (permission: Permission) => Boolean(me?.isSuperAdmin) || held.has(permission);
    return {
      me,
      loading,
      isSuperAdmin: Boolean(me?.isSuperAdmin),
      can,
      canAny: (...permissions) => permissions.some(can),
      reload,
    };
  }, [me, loading, reload]);

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (!context) throw new Error("usePermissions must be used inside PermissionsProvider");
  return context;
}
