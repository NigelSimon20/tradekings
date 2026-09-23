"use server";

import { revalidatePath } from "next/cache";

import { can } from "@/lib/auth/roles";
import { getRepository } from "@/lib/data";
import { getCurrentUser } from "@/lib/services/auth";
import type { SheetSetupResult } from "@/lib/data/sheet-setup";

export interface SetupState {
  status: "idle" | "done" | "error";
  messages: string[];
}

/**
 * Prepares the Google Sheet from the app, so setting up does not need a
 * developer with a terminal. It only ever adds what is missing.
 */
export async function setUpSheetAction(): Promise<SetupState> {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "manageSystem")) {
    return { status: "error", messages: ["Only an administrator can set the sheet up."] };
  }

  try {
    // Whoever is setting the sheet up keeps access once sign-in is switched on.
    const result: SheetSetupResult = await getRepository().setUpStorage({
      seedAdmins: [user.email].filter(Boolean),
    });
    revalidatePath("/", "layout");
    return { status: result.ok ? "done" : "error", messages: result.messages };
  } catch (error) {
    return { status: "error", messages: [(error as Error).message] };
  }
}
