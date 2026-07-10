import { redirect } from "next/navigation";

export default function AddUserPage() {
  redirect("/admin/dashboard/users");
}
