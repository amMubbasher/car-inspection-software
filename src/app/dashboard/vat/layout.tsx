import type { ReactNode } from "react";
import { requirePageAccess } from "@/lib/rbac/server";

export const dynamic = "force-dynamic";

export default async function VatLayout({ children }: { children: ReactNode }) {
  await requirePageAccess("vat.view");
  return children;
}
