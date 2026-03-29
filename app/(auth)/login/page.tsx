import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { tryGetCurrentUser } from "@/lib/auth";
import { roleHome } from "@/lib/utils";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await tryGetCurrentUser();

  if (user) {
    redirect(roleHome(user.role));
  }

  const resolvedSearchParams = (await searchParams) ?? {};
  const error = typeof resolvedSearchParams.error === "string" ? resolvedSearchParams.error : undefined;

  return (
    <main className="soft-grid relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[380px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.88),transparent_55%)]" />
      <div className="pointer-events-none absolute left-1/2 top-24 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-300/18 blur-3xl" />

      <div className="content-shell mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <LoginForm error={error} />
      </div>
    </main>
  );
}
