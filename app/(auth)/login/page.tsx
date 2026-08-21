import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { Logo } from "@/components/logo";
import { tryGetCurrentUser } from "@/lib/auth";
import { getSiteSettings } from "@/lib/site-settings";
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
  const rateLimitedMinutesRaw = Number(resolvedSearchParams.min);
  const rateLimitedMinutes =
    Number.isFinite(rateLimitedMinutesRaw) && rateLimitedMinutesRaw > 0
      ? Math.min(60, Math.ceil(rateLimitedMinutesRaw))
      : undefined;
  const { loginHelpContact } = await getSiteSettings();

  return (
    <main
      className="relative flex min-h-screen w-full items-center justify-center p-6 antialiased"
      style={{
        color: "var(--shbz-text-strong)",
        backgroundColor: "var(--shbz-page-bg)",
        backgroundImage: "var(--shbz-page-glow)"
      }}
    >
      <div className="absolute left-9 top-8">
        <Logo size={26} />
      </div>

      <LoginForm error={error} rateLimitedMinutes={rateLimitedMinutes} helpContact={loginHelpContact} />
    </main>
  );
}
