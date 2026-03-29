"use server";

import { redirect } from "next/navigation";
import { signIn, signOut } from "@/lib/auth";
import { roleHome } from "@/lib/utils";

export async function loginAction(formData: FormData) {
  const login = String(formData.get("login") ?? formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!login || !password) {
    redirect("/login?error=empty");
  }

  let user = null;

  try {
    user = await signIn(login, password);
  } catch (error) {
    console.error("Failed to sign in.", error);
    redirect("/login?error=database");
  }

  if (!user) {
    redirect("/login?error=invalid");
  }

  redirect(roleHome(user.role));
}

export async function logoutAction() {
  await signOut();
  redirect("/login");
}
