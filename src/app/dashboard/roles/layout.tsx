import type { ReactNode } from "react";
import { requirePageAccess } from "@/lib/rbac/server";

export const dynamic = "force-dynamic";

export default async function RolesLayout({ children }: { children: ReactNode }) {
  await requirePageAccess("roles.view");
  return children;
}
