import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { roleHome } from "@/lib/utils";

export default async function DashboardPage() {
  const user = await requireUser();
  redirect(roleHome(user.role));
}
