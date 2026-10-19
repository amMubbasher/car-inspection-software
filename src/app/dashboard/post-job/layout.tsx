import type { ReactNode } from "react";
import { requirePageAccess } from "@/lib/rbac/server";

export const dynamic = "force-dynamic";

export default async function PostJobLayout({ children }: { children: ReactNode }) {
  await requirePageAccess("jobs.create");
  return children;
}
