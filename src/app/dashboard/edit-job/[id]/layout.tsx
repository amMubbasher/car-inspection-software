import type { ReactNode } from "react";
import { requirePageAccess } from "@/lib/rbac/server";

export const dynamic = "force-dynamic";

export default async function EditJobLayout({ children }: { children: ReactNode }) {
  await requirePageAccess("jobs.edit");
  return children;
}
