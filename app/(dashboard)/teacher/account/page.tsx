import { UserRole } from "@prisma/client";
import { AccountSettingsView, resolveAccountNotice } from "@/components/account-settings-view";
import { requireUser } from "@/lib/auth";

type TeacherAccountPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TeacherAccountPage({ searchParams }: TeacherAccountPageProps) {
  const user = await requireUser(UserRole.TEACHER);
  const resolvedSearchParams = (await searchParams) ?? {};
  const notice = resolveAccountNotice(resolvedSearchParams);

  return <AccountSettingsView user={user} notice={notice} />;
}
