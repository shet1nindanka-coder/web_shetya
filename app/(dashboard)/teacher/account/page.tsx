import { redirect } from "next/navigation";

type TeacherAccountPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TeacherAccountPage({ searchParams }: TeacherAccountPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const nextParams = new URLSearchParams();

  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    if (typeof value === "string") {
      nextParams.set(key, value);
    }
  }

  redirect(nextParams.toString() ? `/teacher/settings?${nextParams.toString()}` : "/teacher/settings");
}
