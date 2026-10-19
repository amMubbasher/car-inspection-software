import type { ReactNode } from "react";
import { requirePageAccess } from "@/lib/rbac/server";

export const dynamic = "force-dynamic";

export default async function UsersLayout({ children }: { children: ReactNode }) {
  await requirePageAccess("users.view");
  return children;
}
