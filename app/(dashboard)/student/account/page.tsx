import { UserRole } from "@prisma/client";
import { AccountSettingsView, resolveAccountNotice } from "@/components/account-settings-view";
import { requireUser } from "@/lib/auth";

type StudentAccountPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function StudentAccountPage({ searchParams }: StudentAccountPageProps) {
  const user = await requireUser(UserRole.STUDENT);
  const resolvedSearchParams = (await searchParams) ?? {};
  const notice = resolveAccountNotice(resolvedSearchParams);

  return <AccountSettingsView user={user} notice={notice} />;
}
