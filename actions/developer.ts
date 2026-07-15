"use server";

import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { logErrorEvent, logInfoEvent } from "@/lib/logger";
import { parseSiteSettingsForm, saveSiteSettings } from "@/lib/site-settings";

export async function saveSiteSettingsAction(formData: FormData) {
  const user = await requireUser(UserRole.DEVELOPER);
  const values = parseSiteSettingsForm(formData);
  let failed = false;

  try {
    await saveSiteSettings(values);
    logInfoEvent("site_settings.updated", { userId: user.id });
  } catch (error) {
    failed = true;
    logErrorEvent(
      "site_settings.update_failed",
      { userId: user.id },
      error instanceof Error ? error : undefined,
      "Failed to save site settings."
    );
  }

  redirect(failed ? "/developer/panel?error=save" : "/developer/panel?saved=1");
}
