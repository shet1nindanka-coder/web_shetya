import { UserRole } from "@prisma/client";
import { AccountSettingsView, resolveAccountNotice } from "@/components/account-settings-view";
import { requireUser } from "@/lib/auth";

type TeacherSettingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TeacherSettingsPage({ searchParams }: TeacherSettingsPageProps) {
  const user = await requireUser([UserRole.TEACHER, UserRole.DEVELOPER]);
  const resolvedSearchParams = (await searchParams) ?? {};
  const notice = resolveAccountNotice(resolvedSearchParams);

  return <AccountSettingsView user={user} notice={notice} />;
}
