import { redirect } from "next/navigation";

type StudentAccountPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function StudentAccountPage({ searchParams }: StudentAccountPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const nextParams = new URLSearchParams();

  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    if (typeof value === "string") {
      nextParams.set(key, value);
    }
  }

  redirect(nextParams.toString() ? `/student/settings?${nextParams.toString()}` : "/student/settings");
}
