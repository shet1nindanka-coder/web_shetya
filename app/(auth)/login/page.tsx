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
    <main
      className="relative flex min-h-screen w-full items-center justify-center bg-white p-6 text-[#0A0A0A] antialiased"
      style={{
        backgroundImage:
          "radial-gradient(720px 420px at 50% -8%, rgba(54,224,164,0.12), rgba(90,200,234,0) 70%)"
      }}
    >
      <div className="absolute left-9 top-8 flex flex-col gap-1">
        <div className="text-[26px] font-black leading-none tracking-[-1.2px] text-[#0A0A0A]">ШБЗ</div>
        <div className="text-[11px] font-semibold tracking-[0.2px] text-[#8B8F96]">Школа Базовых Знаний</div>
      </div>

      <LoginForm error={error} />
    </main>
  );
}
