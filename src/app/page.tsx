// src/app/page.tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/rbac/server";

export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? "/dashboard" : "/login");
}
