"use server";

import { revalidatePath } from "next/cache";

import type { UserAccessState } from "@/lib/domain/form-state";
import { saveSignInUser } from "@/lib/services/users";

/**
 * Adds a person or changes their access. Used from both apps' settings pages;
 * who may change what is decided in the service, never by what the page shows.
 */
export async function saveUserAccessAction(
  _previous: UserAccessState,
  formData: FormData,
): Promise<UserAccessState> {
  const field = (name: string) => (formData.has(name) ? String(formData.get(name) ?? "") : undefined);
  const active = field("active");

  try {
    const message = await saveSignInUser({
      email: field("email") ?? "",
      name: field("name"),
      role: field("role"),
      billboards: field("billboards"),
      active: active === undefined ? undefined : active === "yes",
    });
    revalidatePath("/", "layout");
    return { status: "success", message };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
}
