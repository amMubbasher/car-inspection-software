import type { ReactNode } from "react";
import { requirePageAccess } from "@/lib/rbac/server";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  await requirePageAccess();
  return children;
}
